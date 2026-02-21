import { useEffect, useRef, useCallback, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutoSaveOptions<T> {
  /** Unique key used to namespace the draft in localStorage */
  key: string;
  /** Current form data to persist */
  data: T;
  /** Debounce delay in ms (default: 1500) */
  debounceMs?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Called with the stored draft on successful restore */
  onRestore?: (draft: T) => void;
  /** Fields to exclude from the saved draft */
  excludeFields?: (keyof T)[];
}

export interface AutoSaveReturn<T> {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  /** Manually save now */
  saveNow: () => void;
  /** Clear the saved draft (call on successful submit) */
  clearDraft: () => void;
  /** Whether a draft exists in storage */
  hasDraft: boolean;
  /** Restore the draft and return it */
  restoreDraft: () => T | null;
}

const STORAGE_PREFIX = 'afritec_draft_';

export function useAutoSave<T extends Record<string, unknown>>({
  key,
  data,
  debounceMs = 1500,
  enabled = true,
  onRestore,
  excludeFields = [],
}: AutoSaveOptions<T>): AutoSaveReturn<T> {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);
  const previousDataRef = useRef<string>('');

  // Check if a draft exists on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setHasDraft(Boolean(stored));
    } catch {
      setHasDraft(false);
    }
  }, [storageKey]);

  const getFilteredData = useCallback(
    (raw: T): Partial<T> => {
      if (excludeFields.length === 0) return raw;
      const filtered = { ...raw };
      for (const field of excludeFields) {
        delete filtered[field];
      }
      return filtered;
    },
    [excludeFields]
  );

  const saveNow = useCallback(() => {
    if (!enabled) return;
    try {
      const filtered = getFilteredData(data);
      const serialized = JSON.stringify({
        data: filtered,
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem(storageKey, serialized);
      setStatus('saved');
      setLastSaved(new Date());
      setHasDraft(true);
    } catch {
      setStatus('error');
    }
  }, [enabled, data, storageKey, getFilteredData]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setStatus('idle');
      setLastSaved(null);
      previousDataRef.current = '';
    } catch {
      // ignore
    }
  }, [storageKey]);

  const restoreDraft = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return (parsed.data ?? null) as T | null;
    } catch {
      return null;
    }
  }, [storageKey]);

  // Restore on mount (once)
  useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;

    if (!enabled || !onRestore) return;

    const draft = restoreDraft();
    if (draft) {
      onRestore(draft as T);
      setHasDraft(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save on data change
  useEffect(() => {
    if (!enabled) return;

    const serialized = JSON.stringify(getFilteredData(data));

    // Skip if data hasn't changed
    if (serialized === previousDataRef.current) return;

    // Skip initial empty state
    const isEmpty = Object.values(data).every(
      (v) => v === '' || v === null || v === undefined
    );
    if (isEmpty && !previousDataRef.current) return;

    previousDataRef.current = serialized;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setStatus('saving');

    debounceTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            data: getFilteredData(data),
            savedAt: new Date().toISOString(),
          })
        );
        setStatus('saved');
        setLastSaved(new Date());
        setHasDraft(true);
      } catch {
        setStatus('error');
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [data, enabled, debounceMs, storageKey, getFilteredData]);

  // Reset "saved" indicator back to "idle" after 3 seconds
  useEffect(() => {
    if (status !== 'saved') return;
    const timer = setTimeout(() => setStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  return { status, lastSaved, saveNow, clearDraft, hasDraft, restoreDraft };
}

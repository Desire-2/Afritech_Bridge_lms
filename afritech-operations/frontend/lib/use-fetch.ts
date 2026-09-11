'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api';

export function useFetch<T = any>(path: string, deps: any[] = [], params?: Record<string, any>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const reload = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setData(null);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    api<T>(path, { params: paramsRef.current })
      .then((d) => {
        if (!cancelled) { setData(d); setLoading(false); }
      })
      .catch((e: any) => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, fetchKey, ...deps]);

  return { data, error, loading, reload, setData };
}

export function useMemoParams(params: Record<string, any> | undefined) {
  return params;
}

/** Converts a Date to a YYYY-MM-DD string using LOCAL time (not UTC), so the
 *  default filter range always matches the user's local calendar date. */
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local date (YYYY-MM-DD), optionally shifted by whole days. */
export function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalIso(d);
}

export function yearAgoIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return toLocalIso(d);
}
'use client';

import { useEffect } from 'react';

/**
 * Opens a page's create dialog when the URL carries `?new=1`.
 *
 * Reads `window.location` instead of `useSearchParams` so the route stays
 * statically prerenderable (no Suspense boundary needed), then strips the
 * flag from the address bar so a reload does not reopen the dialog. Every
 * remaining query parameter is handed to `open` as a form prefill, which is
 * how a quick action can deep-link with context:
 *
 *     /follow-ups?new=1&subject=TXN-… follow up&employee_id=12
 */
export function useQuickCreate(open: (patch?: Record<string, any>) => void) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') !== '1') return;
    params.delete('new');

    const patch: Record<string, any> = {};
    params.forEach((value, key) => {
      patch[key] = value;
    });

    open(patch);

    const rest = params.toString();
    window.history.replaceState(
      null, '', window.location.pathname + (rest ? `?${rest}` : '')
    );
    // Run once on mount: `open` is a per-render closure over page state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * True only for the plain patches built above.
 *
 * Create handlers are often bound straight to a button
 * (`onClick={openCreate}`), which hands them a React click event. Spreading
 * that event into form state copies `view` (window), `nativeEvent` and DOM
 * nodes into the request body, and `JSON.stringify` then walks
 * window → document → React's root fiber and throws
 * "Converting circular structure to JSON". Callers spread
 * `isQuickPatch(patch) ? patch : {}` instead, so an accidental event is ignored.
 */
export function isQuickPatch(value: unknown): value is Record<string, any> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

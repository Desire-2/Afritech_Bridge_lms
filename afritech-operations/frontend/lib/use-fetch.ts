'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

export function useFetch<T = any>(path: string, deps: any[] = [], params?: Record<string, any>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const paramsKey = JSON.stringify(params || {});

  const reload = useCallback(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    api<T>(path, { params })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

export function useMemoParams(params: Record<string, any> | undefined) {
  return params;
}

/** Converts a Date input value (YYYY-MM-DD) into a nice label; returns raw otherwise */
export function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function yearAgoIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
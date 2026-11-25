'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getTalentErrorStatus,
  type TalentApiError,
} from '@/services/talent-passport.service';

/** Small loading/error/reload helper shared by every passport page. */
export function usePassportResource<T>(loader: () => Promise<T>, depKey = '') {
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<TalentApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef.current()
      .then((result) => {
        if (!active) return;
        setData(result);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason as TalentApiError);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [depKey, nonce]);

  return {
    data,
    error,
    loading,
    reload,
    status: error ? getTalentErrorStatus(error) : null,
  };
}

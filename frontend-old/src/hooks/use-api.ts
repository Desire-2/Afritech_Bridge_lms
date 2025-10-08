import { useState, useEffect, useCallback } from 'react';
import { ApiErrorHandler } from '@/lib/error-handler';

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncReturn<T> extends UseAsyncState<T> {
  execute: () => Promise<void>;
  reset: () => void;
}

/**
 * Generic hook for handling async operations with loading, error, and data states
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  dependencies: any[] = []
): UseAsyncReturn<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await asyncFunction();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: ApiErrorHandler.getErrorMessage(err),
      });
    }
  }, dependencies);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    execute();
  }, [execute]);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Hook for handling mutations (create, update, delete operations)
 */
export function useMutation<TData, TVariables = void>() {
  const [state, setState] = useState<{
    data: TData | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(async (
    mutationFn: (variables: TVariables) => Promise<TData>,
    variables: TVariables
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await mutationFn(variables);
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      const error = ApiErrorHandler.getErrorMessage(err);
      setState(prev => ({ ...prev, loading: false, error }));
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

/**
 * Hook for pagination
 */
export function usePagination(initialPage: number = 1, initialPerPage: number = 10) {
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);

  const nextPage = useCallback(() => setPage(prev => prev + 1), []);
  const prevPage = useCallback(() => setPage(prev => Math.max(1, prev - 1)), []);
  const goToPage = useCallback((newPage: number) => setPage(Math.max(1, newPage)), []);
  const changePerPage = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1); // Reset to first page when changing page size
  }, []);

  return {
    page,
    perPage,
    nextPage,
    prevPage,
    goToPage,
    changePerPage,
    setPage,
    setPerPage,
  };
}

/**
 * Hook for debounced search
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for search functionality with debouncing
 */
export function useSearch(searchFunction: (query: string) => Promise<any>, delay: number = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, delay);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await searchFunction(debouncedQuery);
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(ApiErrorHandler.getErrorMessage(err));
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    search();
  }, [debouncedQuery, searchFunction]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearResults: () => setResults([]),
  };
}

/**
 * Hook for managing form state with API integration
 */
export function useFormSubmission<TData>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = useCallback(async (
    submitFunction: () => Promise<TData>
  ) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const result = await submitFunction();
      setSuccess(true);
      return result;
    } catch (err) {
      setError(ApiErrorHandler.getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(false);
  }, []);

  return {
    loading,
    error,
    success,
    submit,
    reset,
  };
}
import { useState, useEffect } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION = 30000; // 30 segundos

export function useCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check cache first
        const cached = cache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          if (!cancelled) {
            setData(cached.data);
            setIsLoading(false);
          }
          return;
        }

        // Fetch fresh data
        const freshData = await fetchFn();

        if (!cancelled) {
          setData(freshData);
          cache.set(key, { data: freshData, timestamp: Date.now() });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [key, ...dependencies]);

  const invalidateCache = () => {
    cache.delete(key);
  };

  const refetch = async () => {
    invalidateCache();
    setIsLoading(true);
    try {
      const freshData = await fetchFn();
      setData(freshData);
      cache.set(key, { data: freshData, timestamp: Date.now() });
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch, invalidateCache };
}

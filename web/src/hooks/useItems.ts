import { useState, useEffect, useCallback, useRef } from 'react';
import { ItemSummary } from '../types';
import { getItems } from '../api/client';

const POLL_INTERVAL_MS = 2000;

interface UseItemsResult {
  items: ItemSummary[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches the items list and polls every 2 s while any item is pending.
 * Polling stops automatically once all items are in a terminal state
 * (ready or failed), avoiding unnecessary network traffic.
 */
export function useItems(): UseItemsResult {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await getItems();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Manage polling: start/stop based on whether any item is pending
  useEffect(() => {
    const hasPending = items.some((item) => item.status === 'pending');

    if (hasPending) {
      if (intervalRef.current === null) {
        intervalRef.current = setInterval(() => {
          void fetchItems();
        }, POLL_INTERVAL_MS);
      }
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [items, fetchItems]);

  // Initial fetch on mount
  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  return { items, isLoading, error, refresh: fetchItems };
}

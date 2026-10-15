import { useState, useCallback } from 'react';
import { QueryResult } from '../types';
import { queryKnowledge, ApiResponseError } from '../api/client';

interface UseAskResult {
  result: QueryResult | null;
  isLoading: boolean;
  error: string | null;
  ask: (question: string) => Promise<void>;
  clear: () => void;
}

/**
 * Manages state for the query flow: loading, error, and result.
 * Consumed by AskBox and AnswerPanel in Phase 9.
 */
export function useAsk(): UseAskResult {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (question: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await queryKnowledge(question);
      setResult(data);
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setError(err.apiError.message);
      } else {
        setError(err instanceof Error ? err.message : 'Query failed');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isLoading, error, ask, clear };
}

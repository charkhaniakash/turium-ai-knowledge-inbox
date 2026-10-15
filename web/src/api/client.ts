import { ItemSummary, QueryResult, ApiError } from '../types';

/**
 * Single fetch wrapper for all API calls.
 * All components access the API exclusively through this module —
 * never via raw fetch() calls — so the base URL and error handling
 * live in one place.
 */

class ApiResponseError extends Error {
  readonly apiError: ApiError;
  readonly status: number;

  constructor(status: number, apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.apiError = apiError;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let apiError: ApiError;
    try {
      const body = await res.json() as { error: ApiError };
      apiError = body.error;
    } catch {
      apiError = { code: 'UNKNOWN_ERROR', message: `HTTP ${res.status}` };
    }
    throw new ApiResponseError(res.status, apiError);
  }

  return res.json() as Promise<T>;
}

// ── Typed endpoints ────────────────────────────────────────────────────────────

export async function getItems(): Promise<ItemSummary[]> {
  const data = await request<{ items: ItemSummary[] }>('/items');
  return data.items;
}

export async function ingestNote(content: string): Promise<ItemSummary> {
  const data = await request<{ item: ItemSummary }>('/ingest', {
    method: 'POST',
    body: JSON.stringify({ type: 'note', content }),
  });
  return data.item;
}

export async function ingestUrl(url: string): Promise<ItemSummary> {
  const data = await request<{ item: ItemSummary }>('/ingest', {
    method: 'POST',
    body: JSON.stringify({ type: 'url', content: url }),
  });
  return data.item;
}

export async function queryKnowledge(question: string): Promise<QueryResult> {
  return request<QueryResult>('/query', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export { ApiResponseError };

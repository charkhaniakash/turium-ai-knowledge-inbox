/**
 * Frontend domain types — mirrors the server's API response shapes.
 * Kept in one file so all components import from a single source of truth.
 */

export type SourceType = 'note' | 'url';
export type ItemStatus = 'pending' | 'ready' | 'failed';

export interface ItemSummary {
  id: string;
  sourceType: SourceType;
  url: string | null;
  title: string | null;
  preview: string;
  status: ItemStatus;
  error: string | null;
  createdAt: string;
  chunkCount: number;
}

export interface Source {
  index: number;
  itemId: string;
  chunkId: string;
  title: string | null;
  url: string | null;
  snippet: string;
  score: number;
}

export interface QueryResult {
  answer: string;
  sources: Source[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

/**
 * Core domain types shared across all layers.
 * These are plain data shapes — no methods, no ORM decorators.
 */

export type SourceType = 'note' | 'url';
export type ItemStatus = 'pending' | 'ready' | 'failed';

export interface Item {
  readonly id: string;
  readonly sourceType: SourceType;
  readonly url: string | null;
  readonly title: string | null;
  readonly rawContent: string | null;
  readonly status: ItemStatus;
  readonly error: string | null;
  readonly createdAt: string; // ISO 8601
}

export interface Chunk {
  readonly id: string;
  readonly itemId: string;
  readonly chunkIndex: number;
  readonly text: string;
  readonly embedding: Float32Array;
  readonly createdAt: string; // ISO 8601
}

/** Shape returned by GET /items — preview only, no full raw content */
export interface ItemSummary {
  readonly id: string;
  readonly sourceType: SourceType;
  readonly url: string | null;
  readonly title: string | null;
  readonly preview: string;
  readonly status: ItemStatus;
  readonly error: string | null;
  readonly createdAt: string;
  readonly chunkCount: number;
}

/** A single source citation in a query result */
export interface Source {
  readonly index: number;
  readonly itemId: string;
  readonly chunkId: string;
  readonly title: string | null;
  readonly url: string | null;
  readonly snippet: string;
  readonly score: number;
}

export interface QueryResult {
  readonly answer: string;
  readonly sources: Source[];
}

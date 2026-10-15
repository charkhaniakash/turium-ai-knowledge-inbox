import { Item, Chunk, ItemSummary, QueryResult } from './types';

/**
 * Domain interfaces — the contracts that SOLID depends on.
 * Concrete implementations live in services/ and db/.
 * All callers depend on these interfaces, never on concrete classes.
 */

// ── Repositories ────────────────────────────────────────────────────────────

export interface ItemRepository {
  save(item: Item): void;
  findById(id: string): Item | null;
  findAll(): ItemSummary[];
  updateStatus(
    id: string,
    status: Item['status'],
    extra?: { title?: string; error?: string }
  ): void;
}

export interface ChunkRepository {
  saveAll(chunks: Chunk[]): void;
  findByItemId(itemId: string): Chunk[];
  findAllReady(): Chunk[];
  countByItemId(itemId: string): number;
}

// ── Chunking (Strategy pattern) ──────────────────────────────────────────────

export interface Chunker {
  /** Split text into overlapping chunks. Deterministic and pure. */
  chunk(text: string): string[];
}

// ── Embeddings (Adapter pattern) ─────────────────────────────────────────────

export interface EmbeddingProvider {
  /**
   * Embed one or more texts in a single batched request.
   * Returns normalised vectors (unit length) ready for dot-product similarity.
   */
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

// ── LLM (Adapter pattern) ────────────────────────────────────────────────────

export interface LLMProvider {
  complete(systemPrompt: string, userMessage: string): Promise<string>;
}

// ── Vector store (Repository-like, swappable for pgvector/Qdrant) ────────────

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}

export interface VectorStore {
  /**
   * Find the top-K most similar chunks to queryVector.
   * Only considers chunks from items with status = 'ready'.
   */
  search(queryVector: Float32Array, topK: number): ScoredChunk[];
}

// ── Ingestors (Factory pattern produces these) ───────────────────────────────

export interface IngestResult {
  item: Item;
}

export interface Ingestor {
  ingest(content: string): Promise<IngestResult>;
}

// ── Processing pipeline ───────────────────────────────────────────────────────

export interface ProcessingPipeline {
  run(itemId: string): Promise<void>;
}

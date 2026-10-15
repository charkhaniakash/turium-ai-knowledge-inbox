import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../services/retrieval/cosineSimilarity';
import { InMemoryVectorStore } from '../services/retrieval/InMemoryVectorStore';
import { Retriever } from '../services/retrieval/Retriever';
import { Chunk } from '../domain/types';
import { EmbeddingProvider, VectorStore, ScoredChunk, ChunkRepository } from '../domain/interfaces';

// ── Helpers ──────────────────────────────────────────────────────────────────

function vec(...values: number[]): Float32Array {
  return new Float32Array(values);
}

/** Normalise a vector to unit length — mirrors GeminiEmbeddingProvider */
function normalise(v: Float32Array): Float32Array {
  const mag = Math.sqrt(Array.from(v).reduce((s, x) => s + x * x, 0));
  return new Float32Array(Array.from(v).map((x) => x / mag));
}

function makeChunk(id: string, itemId: string, embedding: Float32Array): Chunk {
  return {
    id,
    itemId,
    chunkIndex: 0,
    text: `Text for chunk ${id}`,
    embedding,
    createdAt: new Date().toISOString(),
  };
}

// ── Fake implementations (satisfy the same interfaces as real impls) ──────────

class FakeChunkRepository implements ChunkRepository {
  private readonly chunks: Chunk[];
  constructor(chunks: Chunk[]) { this.chunks = chunks; }
  saveAll(): void { /* no-op */ }
  findByItemId(itemId: string): Chunk[] { return this.chunks.filter((c) => c.itemId === itemId); }
  findAllReady(): Chunk[] { return this.chunks; }
  countByItemId(itemId: string): number { return this.chunks.filter((c) => c.itemId === itemId).length; }
}

class FakeEmbeddingProvider implements EmbeddingProvider {
  private readonly fixedVector: Float32Array;
  constructor(fixedVector: Float32Array) { this.fixedVector = fixedVector; }
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return texts.map(() => this.fixedVector);
  }
}

class FakeVectorStore implements VectorStore {
  private readonly results: ScoredChunk[];
  constructor(results: ScoredChunk[]) { this.results = results; }
  search(_queryVector: Float32Array, topK: number): ScoredChunk[] {
    return this.results.slice(0, topK);
  }
}

class EmptyEmbeddingProvider implements EmbeddingProvider {
  async embedBatch(): Promise<Float32Array[]> { return []; }
}

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical unit vectors', () => {
    const v = normalise(vec(1, 2, 3));
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = normalise(vec(1, 0, 0));
    const b = normalise(vec(0, 1, 0));
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('returns -1.0 for opposite vectors', () => {
    const a = normalise(vec(1, 0));
    const b = normalise(vec(-1, 0));
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('returns a value between -1 and 1 for arbitrary vectors', () => {
    const a = normalise(vec(1, 2, 3, 4));
    const b = normalise(vec(4, 3, 2, 1));
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('throws when vectors have different dimensions', () => {
    expect(() => cosineSimilarity(vec(1, 2), vec(1, 2, 3))).toThrow();
  });

  it('is commutative: sim(a,b) === sim(b,a)', () => {
    const a = normalise(vec(1, 5, 3));
    const b = normalise(vec(2, 1, 4));
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 8);
  });
});

// ── InMemoryVectorStore ───────────────────────────────────────────────────────

describe('InMemoryVectorStore', () => {
  const chunkA = makeChunk('a', 'item-1', normalise(vec(1, 0, 0)));
  const chunkB = makeChunk('b', 'item-1', normalise(vec(0, 1, 0)));
  const chunkC = makeChunk('c', 'item-2', normalise(vec(1, 1, 0)));

  it('returns chunks ranked by similarity descending', () => {
    const store = new InMemoryVectorStore(
      new FakeChunkRepository([chunkA, chunkB, chunkC])
    );
    const query = normalise(vec(1, 0, 0)); // identical to chunkA
    const results = store.search(query, 3);

    expect(results[0]?.chunk.id).toBe('a');
    expect(results[0]?.score).toBeCloseTo(1.0, 5);
    // Ensure ordering is descending
    expect(results[1]?.score).toBeGreaterThanOrEqual(results[2]?.score ?? -1);
  });

  it('respects the topK limit', () => {
    const store = new InMemoryVectorStore(
      new FakeChunkRepository([chunkA, chunkB, chunkC])
    );
    const results = store.search(normalise(vec(1, 0, 0)), 2);
    expect(results).toHaveLength(2);
  });

  it('returns empty array when no chunks exist', () => {
    const store = new InMemoryVectorStore(new FakeChunkRepository([]));
    expect(store.search(normalise(vec(1, 0, 0)), 5)).toEqual([]);
  });

  it('returns all chunks when topK exceeds chunk count', () => {
    const store = new InMemoryVectorStore(
      new FakeChunkRepository([chunkA, chunkB])
    );
    const results = store.search(normalise(vec(1, 0, 0)), 100);
    expect(results).toHaveLength(2);
  });
});

// ── Retriever ─────────────────────────────────────────────────────────────────

describe('Retriever', () => {
  const highScoreChunk = makeChunk('high', 'item-1', normalise(vec(1, 0)));
  const lowScoreChunk  = makeChunk('low',  'item-2', normalise(vec(0, 1)));
  const fixedQuery = normalise(vec(1, 0));

  it('returns results above the minimum score threshold', async () => {
    const fakeStore = new FakeVectorStore([
      { chunk: highScoreChunk, score: 0.9 },
      { chunk: lowScoreChunk,  score: 0.1 },
    ]);

    const retriever = new Retriever(
      new FakeEmbeddingProvider(fixedQuery),
      fakeStore,
      5,    // topK
      0.5   // minScore
    );

    const results = await retriever.retrieve('test question');
    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.id).toBe('high');
  });

  it('returns empty array when all scores are below threshold', async () => {
    const fakeStore = new FakeVectorStore([
      { chunk: highScoreChunk, score: 0.1 },
      { chunk: lowScoreChunk,  score: 0.05 },
    ]);

    const retriever = new Retriever(
      new FakeEmbeddingProvider(fixedQuery),
      fakeStore,
      5,    // topK
      0.5   // minScore
    );

    const results = await retriever.retrieve('unrelated question');
    expect(results).toHaveLength(0);
  });

  it('respects topK by passing it to the vector store', async () => {
    const manyChunks: ScoredChunk[] = Array.from({ length: 10 }, (_, i) => ({
      chunk: makeChunk(`chunk-${i}`, 'item-1', fixedQuery),
      score: 0.9,
    }));

    const retriever = new Retriever(
      new FakeEmbeddingProvider(fixedQuery),
      new FakeVectorStore(manyChunks),
      3,    // topK
      0.0   // minScore
    );

    const results = await retriever.retrieve('question');
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array when embedding provider returns no vectors', async () => {
    const retriever = new Retriever(
      new EmptyEmbeddingProvider(),
      new FakeVectorStore([]),
      5,    // topK
      0.2   // minScore
    );

    const results = await retriever.retrieve('question');
    expect(results).toHaveLength(0);
  });
});

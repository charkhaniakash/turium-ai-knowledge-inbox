import { VectorStore, ScoredChunk, ChunkRepository } from '../../domain/interfaces';
import { cosineSimilarity } from './cosineSimilarity';

/**
 * VectorStore implementation: loads all ready chunk embeddings into memory
 * and performs a linear scan to find the top-K most similar chunks.
 *
 * Why SQLite + in-memory scan rather than a dedicated vector DB:
 *   At this scale (single user, hundreds to low-thousands of chunks) a linear
 *   scan over Float32 arrays in memory is fast enough (<10ms typically) and
 *   requires zero additional infrastructure. Swapping to pgvector or Qdrant
 *   only requires adding a new VectorStore implementation here — callers are
 *   unaffected because they depend on the VectorStore interface.
 *
 * Trade-off: memory grows linearly with the corpus. For tens of thousands of
 * chunks this remains fine; beyond that, an ANN index is warranted.
 */
export class InMemoryVectorStore implements VectorStore {
  private readonly chunkRepository: ChunkRepository;

  constructor(chunkRepository: ChunkRepository) {
    this.chunkRepository = chunkRepository;
  }

  search(queryVector: Float32Array, topK: number): ScoredChunk[] {
    const chunks = this.chunkRepository.findAllReady();

    if (chunks.length === 0) return [];

    // Score every chunk against the query vector
    const scored: ScoredChunk[] = chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVector, chunk.embedding),
    }));

    // Sort descending by score, take top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

import { EmbeddingProvider, VectorStore, ScoredChunk } from '../../domain/interfaces';
import { logger } from '../../lib/logger';

/**
 * Retriever: embeds the query question and returns the top-K chunks
 * whose similarity score meets the minimum threshold.
 *
 * Only considers chunks from items with status = 'ready' (enforced by
 * the VectorStore implementation, not here — single responsibility).
 */
export class Retriever {
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly vectorStore: VectorStore;
  private readonly topK: number;
  private readonly minScore: number;

  constructor(
    embeddingProvider: EmbeddingProvider,
    vectorStore: VectorStore,
    topK: number,
    minScore: number
  ) {
    this.embeddingProvider = embeddingProvider;
    this.vectorStore = vectorStore;
    this.topK = topK;
    this.minScore = minScore;
  }

  async retrieve(question: string): Promise<ScoredChunk[]> {
    const embedStart = Date.now();
    const [queryVector] = await this.embeddingProvider.embedBatch([question]);
    if (queryVector === undefined) {
      return [];
    }
    logger.debug({ durationMs: Date.now() - embedStart }, 'Retriever: query embedded');

    const searchStart = Date.now();
    const candidates = this.vectorStore.search(queryVector, this.topK);

    // Filter by minimum similarity score
    const results = candidates.filter((c) => c.score >= this.minScore);

    logger.info(
      {
        topK: this.topK,
        candidates: candidates.length,
        aboveThreshold: results.length,
        minScore: this.minScore,
        topScores: results.slice(0, 3).map((c) => c.score.toFixed(4)),
        durationMs: Date.now() - searchStart,
      },
      'Retriever: search complete'
    );

    return results;
  }
}

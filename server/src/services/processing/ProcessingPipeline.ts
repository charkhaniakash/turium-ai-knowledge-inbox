import { randomUUID } from 'crypto';
import {
  ProcessingPipeline as IProcessingPipeline,
  Chunker,
  EmbeddingProvider,
  ItemRepository,
  ChunkRepository,
} from '../../domain/interfaces';
import { Chunk } from '../../domain/types';
import { logger } from '../../lib/logger';
import { UpstreamServiceError } from '../../lib/errors';

/**
 * Pipeline pattern: orchestrates the fixed sequence of processing steps:
 *   fetch raw content → chunk → embed → store chunks → mark item ready
 *
 * Each step is a composed dependency injected via constructor.
 * URL fetching is handled upstream (UrlIngestor) before this pipeline runs —
 * by the time ProcessingPipeline.run() is called, rawContent is already set.
 */
export class ProcessingPipeline implements IProcessingPipeline {
  private readonly chunker: Chunker;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly itemRepository: ItemRepository;
  private readonly chunkRepository: ChunkRepository;

  constructor(
    chunker: Chunker,
    embeddingProvider: EmbeddingProvider,
    itemRepository: ItemRepository,
    chunkRepository: ChunkRepository
  ) {
    this.chunker = chunker;
    this.embeddingProvider = embeddingProvider;
    this.itemRepository = itemRepository;
    this.chunkRepository = chunkRepository;
  }

  async run(itemId: string): Promise<void> {
    const item = this.itemRepository.findById(itemId);
    if (item === null) {
      logger.warn({ itemId }, 'Pipeline: item not found, skipping');
      return;
    }

    if (item.rawContent === null || item.rawContent.trim().length === 0) {
      this.itemRepository.updateStatus(itemId, 'failed', {
        error: 'Item has no content to process',
      });
      return;
    }

    try {
      const pipelineLog = logger.child({ itemId, sourceType: item.sourceType });
      pipelineLog.info('Pipeline: starting');

      // Step 1 — chunk
      const chunkStart = Date.now();
      const texts = this.chunker.chunk(item.rawContent);
      pipelineLog.info({ chunkCount: texts.length, durationMs: Date.now() - chunkStart }, 'Pipeline: chunked');

      if (texts.length === 0) {
        this.itemRepository.updateStatus(itemId, 'failed', {
          error: 'Content produced no chunks after processing',
        });
        return;
      }

      // Step 2 — embed (single batched request for all chunks)
      const embedStart = Date.now();
      const embeddings = await this.embeddingProvider.embedBatch(texts);
      pipelineLog.info(
        { batchSize: texts.length, durationMs: Date.now() - embedStart },
        'Pipeline: embedded'
      );

      // Step 3 — build Chunk records
      const now = new Date().toISOString();
      const chunks: Chunk[] = texts.map((text, index) => ({
        id: randomUUID(),
        itemId,
        chunkIndex: index,
        text,
        embedding: embeddings[index] ?? new Float32Array(0),
        createdAt: now,
      }));

      // Step 4 — persist chunks
      this.chunkRepository.saveAll(chunks);

      // Step 5 — mark item ready
      this.itemRepository.updateStatus(itemId, 'ready');
      pipelineLog.info({ chunkCount: chunks.length }, 'Pipeline: complete, item ready');
    } catch (err) {
      const message =
        err instanceof UpstreamServiceError
          ? err.message
          : 'Processing failed due to an unexpected error';

      logger.error({ err, itemId }, 'Pipeline: failed');
      this.itemRepository.updateStatus(itemId, 'failed', { error: message });
    }
  }
}

import { randomUUID } from 'crypto';
import {
  ProcessingPipeline as IProcessingPipeline,
  Chunker,
  EmbeddingProvider,
  ItemRepository,
  ChunkRepository,
} from '../../domain/interfaces';
import { Chunk } from '../../domain/types';
import { UrlFetcher } from '../url/UrlFetcher';
import { ContentExtractor } from '../url/ContentExtractor';
import { logger } from '../../lib/logger';
import { UpstreamServiceError, UnprocessableContentError } from '../../lib/errors';

/**
 * Pipeline pattern: orchestrates the fixed sequence of processing steps:
 *   [fetch + extract (URLs only)] → chunk → embed → store chunks → mark item ready
 *
 * Notes arrive with rawContent already set; URLs arrive with rawContent = null
 * and need fetching first. Both paths converge at the chunk step.
 */
export class ProcessingPipeline implements IProcessingPipeline {
  private readonly chunker: Chunker;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly itemRepository: ItemRepository;
  private readonly chunkRepository: ChunkRepository;
  private readonly urlFetcher: UrlFetcher;
  private readonly contentExtractor: ContentExtractor;

  constructor(
    chunker: Chunker,
    embeddingProvider: EmbeddingProvider,
    itemRepository: ItemRepository,
    chunkRepository: ChunkRepository,
    urlFetcher: UrlFetcher,
    contentExtractor: ContentExtractor
  ) {
    this.chunker = chunker;
    this.embeddingProvider = embeddingProvider;
    this.itemRepository = itemRepository;
    this.chunkRepository = chunkRepository;
    this.urlFetcher = urlFetcher;
    this.contentExtractor = contentExtractor;
  }

  async run(itemId: string): Promise<void> {
    const item = this.itemRepository.findById(itemId);
    if (item === null) {
      logger.warn({ itemId }, 'Pipeline: item not found, skipping');
      return;
    }

    const pipelineLog = logger.child({ itemId, sourceType: item.sourceType });
    pipelineLog.info('Pipeline: starting');

    try {
      // Step 1 — resolve raw content
      // Notes have content already; URLs require fetching
      let rawContent: string;
      let title: string | null = item.title;

      if (item.sourceType === 'url') {
        if (item.url === null) {
          throw new UnprocessableContentError('URL item is missing a URL');
        }
        const fetchStart = Date.now();
        const fetched = await this.urlFetcher.fetch(item.url);
        const extracted = this.contentExtractor.extract(
          fetched.body,
          fetched.contentType,
          fetched.url
        );
        rawContent = extracted.text;
        title = extracted.title;
        pipelineLog.info({ durationMs: Date.now() - fetchStart }, 'Pipeline: fetched and extracted URL');

        // Persist the extracted title while keeping status pending
        this.itemRepository.updateStatus(
          itemId,
          'pending',
          title !== null ? { title } : undefined
        );
      } else {
        if (item.rawContent === null || item.rawContent.trim().length === 0) {
          throw new UnprocessableContentError('Item has no content to process');
        }
        rawContent = item.rawContent;
      }

      // Step 2 — chunk
      const chunkStart = Date.now();
      const texts = this.chunker.chunk(rawContent);
      pipelineLog.info(
        { chunkCount: texts.length, durationMs: Date.now() - chunkStart },
        'Pipeline: chunked'
      );

      if (texts.length === 0) {
        throw new UnprocessableContentError('Content produced no chunks after processing');
      }

      // Step 3 — embed (batched)
      const embedStart = Date.now();
      const embeddings = await this.embeddingProvider.embedBatch(texts);
      pipelineLog.info(
        { batchSize: texts.length, durationMs: Date.now() - embedStart },
        'Pipeline: embedded'
      );

      // Step 4 — build and persist Chunk records
      const now = new Date().toISOString();
      const chunks: Chunk[] = texts.map((text, index) => ({
        id: randomUUID(),
        itemId,
        chunkIndex: index,
        text,
        embedding: embeddings[index] ?? new Float32Array(0),
        createdAt: now,
      }));
      this.chunkRepository.saveAll(chunks);

      // Mark item ready — include extracted title if available
      this.itemRepository.updateStatus(
        itemId,
        'ready',
        title !== null ? { title } : undefined
      );
      pipelineLog.info({ chunkCount: chunks.length }, 'Pipeline: complete, item ready');
    } catch (err) {
      // Surface a user-safe message; log the full error for debugging
      const message =
        err instanceof UnprocessableContentError || err instanceof UpstreamServiceError
          ? err.message
          : 'Processing failed due to an unexpected error';

      logger.error({ err, itemId }, 'Pipeline: failed');
      this.itemRepository.updateStatus(itemId, 'failed', { error: message });
    }
  }
}

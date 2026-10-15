import { randomUUID } from 'crypto';
import { Item } from '../../domain/types';
import { Ingestor, IngestResult, ItemRepository } from '../../domain/interfaces';
import { UrlFetcher } from '../url/UrlFetcher';
import { ContentExtractor } from '../url/ContentExtractor';
import { assertNotSsrf } from '../url/ssrfGuard';
import { appEvents } from '../../lib/events';
import { logger } from '../../lib/logger';

/**
 * Handles URL ingestion asynchronously:
 *   1. SSRF guard checked synchronously before accepting (fast-fail for obvious cases)
 *   2. Item saved as 'pending', event emitted, response returned immediately (202)
 *   3. ItemProcessor picks up 'item.created' and runs the full pipeline in background:
 *      fetch → extract → chunk → embed → store → mark ready
 *
 * Why async: URL fetching is I/O-bound and can take several seconds. Holding
 * the HTTP connection open for the full pipeline would hurt UX and waste connections.
 */
export class UrlIngestor implements Ingestor {
  private readonly itemRepository: ItemRepository;
  private readonly urlFetcher: UrlFetcher;
  private readonly contentExtractor: ContentExtractor;

  constructor(
    itemRepository: ItemRepository,
    urlFetcher: UrlFetcher,
    contentExtractor: ContentExtractor
  ) {
    this.itemRepository = itemRepository;
    this.urlFetcher = urlFetcher;
    this.contentExtractor = contentExtractor;
  }

  async ingest(url: string): Promise<IngestResult> {
    // Synchronous SSRF pre-check — rejects obviously private URLs before storing anything
    await assertNotSsrf(url);

    const item: Item = {
      id: randomUUID(),
      sourceType: 'url',
      url,
      title: null,
      rawContent: null,
      status: 'pending',
      error: null,
      createdAt: new Date().toISOString(),
    };

    this.itemRepository.save(item);
    logger.info({ itemId: item.id, url }, 'UrlIngestor: item saved as pending');

    // Emit event for background processing — ItemProcessor will pick this up
    appEvents.emit('item.created', item.id);

    return { item };
  }
}

import { randomUUID } from 'crypto';
import { Item } from '../../domain/types';
import { Ingestor, IngestResult, ItemRepository } from '../../domain/interfaces';
import { appEvents } from '../../lib/events';

/**
 * Handles ingestion of plain-text notes.
 * Stores the item as 'pending' and emits 'item.created' so the processing
 * pipeline (wired in Phase 4) can pick it up asynchronously.
 * Notes are small enough that the pipeline can run inline, but using the
 * same event-driven pattern as URLs keeps the architecture uniform.
 */
export class NoteIngestor implements Ingestor {
  private readonly itemRepository: ItemRepository;

  constructor(itemRepository: ItemRepository) {
    this.itemRepository = itemRepository;
  }

  async ingest(content: string): Promise<IngestResult> {
    const item: Item = {
      id: randomUUID(),
      sourceType: 'note',
      url: null,
      title: null,
      rawContent: content,
      status: 'pending',
      error: null,
      createdAt: new Date().toISOString(),
    };

    this.itemRepository.save(item);
    appEvents.emit('item.created', item.id);

    return { item };
  }
}

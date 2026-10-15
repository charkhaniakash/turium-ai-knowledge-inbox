import { Ingestor, ItemRepository } from '../../domain/interfaces';
import { NoteIngestor } from './NoteIngestor';
import { SourceType } from '../../domain/types';

/**
 * Factory pattern: returns the correct Ingestor implementation for a given
 * source type. Adding a new ingestor (e.g. PDFIngestor) only requires adding
 * a new case here — no changes to callers.
 * UrlIngestor is wired in Phase 5.
 */
export class IngestorFactory {
  private readonly itemRepository: ItemRepository;

  constructor(itemRepository: ItemRepository) {
    this.itemRepository = itemRepository;
  }

  create(sourceType: SourceType): Ingestor {
    switch (sourceType) {
      case 'note':
        return new NoteIngestor(this.itemRepository);
      case 'url':
        // UrlIngestor added in Phase 5; factory extended without modifying callers
        throw new Error('URL ingestor not yet implemented');
    }
  }
}

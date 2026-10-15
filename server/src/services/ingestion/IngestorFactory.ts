import { Ingestor, ItemRepository } from '../../domain/interfaces';
import { NoteIngestor } from './NoteIngestor';
import { UrlIngestor } from './UrlIngestor';
import { UrlFetcher } from '../url/UrlFetcher';
import { ContentExtractor } from '../url/ContentExtractor';
import { SourceType } from '../../domain/types';

/**
 * Factory pattern: returns the correct Ingestor implementation for a given
 * source type. Adding a new ingestor only requires adding a new case here —
 * callers (IngestService) are unaffected.
 */
export class IngestorFactory {
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

  create(sourceType: SourceType): Ingestor {
    switch (sourceType) {
      case 'note':
        return new NoteIngestor(this.itemRepository);
      case 'url':
        return new UrlIngestor(
          this.itemRepository,
          this.urlFetcher,
          this.contentExtractor
        );
    }
  }
}

import { IngestResult } from '../../domain/interfaces';
import { IngestorFactory } from './IngestorFactory';
import { SourceType } from '../../domain/types';

/**
 * Thin orchestration layer: delegates to the appropriate Ingestor via the factory.
 * Route handlers call this service — they never touch ingestors directly.
 */
export class IngestService {
  private readonly ingestorFactory: IngestorFactory;

  constructor(ingestorFactory: IngestorFactory) {
    this.ingestorFactory = ingestorFactory;
  }

  async ingest(sourceType: SourceType, content: string): Promise<IngestResult> {
    const ingestor = this.ingestorFactory.create(sourceType);
    return ingestor.ingest(content);
  }
}

import Database from 'better-sqlite3';
import { config } from './config';
import { openDatabase } from './db/database';
import { SqliteItemRepository } from './db/SqliteItemRepository';
import { SqliteChunkRepository } from './db/SqliteChunkRepository';
import { IngestorFactory } from './services/ingestion/IngestorFactory';
import { IngestService } from './services/ingestion/IngestService';
import { ParagraphChunker } from './services/chunking/ParagraphChunker';
import { GeminiEmbeddingProvider } from './services/embedding/GeminiEmbeddingProvider';
import { ProcessingPipeline } from './services/processing/ProcessingPipeline';
import { ItemProcessor } from './services/processing/ItemProcessor';
import { UrlFetcher } from './services/url/UrlFetcher';
import { ContentExtractor } from './services/url/ContentExtractor';
import { ItemRepository, ChunkRepository } from './domain/interfaces';

/**
 * Composition root — the single place where all concrete implementations
 * are instantiated and wired together via constructor injection.
 * Nothing outside this file calls `new ConcreteService(...)`.
 */
export interface Container {
  db: Database.Database;
  config: typeof config;
  itemRepository: ItemRepository;
  chunkRepository: ChunkRepository;
  ingestService: IngestService;
}

export function buildContainer(): Container {
  const db = openDatabase(config.DATABASE_PATH);

  // ── Repositories ────────────────────────────────────────────────────────────
  const itemRepository = new SqliteItemRepository(db);
  const chunkRepository = new SqliteChunkRepository(db);

  // ── URL services ────────────────────────────────────────────────────────────
  const urlFetcher = new UrlFetcher(
    config.URL_FETCH_TIMEOUT_MS,
    config.URL_MAX_BYTES
  );
  const contentExtractor = new ContentExtractor();

  // ── Chunking & embedding ────────────────────────────────────────────────────
  const chunker = new ParagraphChunker();
  const embeddingProvider = new GeminiEmbeddingProvider(
    config.GEMINI_API_KEY,
    config.EMBEDDING_MODEL
  );

  // ── Processing pipeline (fetch → extract → chunk → embed → store) ───────────
  const pipeline = new ProcessingPipeline(
    chunker,
    embeddingProvider,
    itemRepository,
    chunkRepository,
    urlFetcher,
    contentExtractor
  );

  // Start background listener — runs pipeline when item.created fires
  const itemProcessor = new ItemProcessor(pipeline);
  itemProcessor.start();

  // ── Ingestion ───────────────────────────────────────────────────────────────
  const ingestorFactory = new IngestorFactory(
    itemRepository,
    urlFetcher,
    contentExtractor
  );
  const ingestService = new IngestService(ingestorFactory);

  return {
    db,
    config,
    itemRepository,
    chunkRepository,
    ingestService,
  };
}

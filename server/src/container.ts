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
import { InMemoryVectorStore } from './services/retrieval/InMemoryVectorStore';
import { Retriever } from './services/retrieval/Retriever';
import { GeminiLLMProvider } from './services/answering/GeminiLLMProvider';
import { AnswerService } from './services/answering/AnswerService';
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
  retriever: Retriever;
  answerService: AnswerService;
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

  // ── Retrieval ───────────────────────────────────────────────────────────────
  const vectorStore = new InMemoryVectorStore(chunkRepository);
  const retriever = new Retriever(
    embeddingProvider,
    vectorStore,
    config.RETRIEVAL_TOP_K,
    config.MIN_SIMILARITY_SCORE
  );

  // ── Answering ───────────────────────────────────────────────────────────────
  const llmProvider = new GeminiLLMProvider(config.GEMINI_API_KEY, config.CHAT_MODEL);
  const answerService = new AnswerService(retriever, llmProvider, itemRepository);

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
    retriever,
    answerService,
  };
}

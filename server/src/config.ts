import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  CHAT_MODEL: z.string().default('gemini-1.5-flash'),
  DATABASE_PATH: z.string().default('./data/inbox.db'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
  URL_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  URL_MAX_BYTES: z.coerce.number().int().positive().default(2_000_000),
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(5),
  MIN_SIMILARITY_SCORE: z.coerce.number().min(0).max(1).default(0.2),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

function loadConfig() {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    // Fail fast — misconfigured app must not start silently
    console.error(`Configuration error:\n${messages}`);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;

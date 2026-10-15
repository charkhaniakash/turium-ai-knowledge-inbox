import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbeddingProvider } from '../../domain/interfaces';
import { UpstreamServiceError } from '../../lib/errors';
import { logger } from '../../lib/logger';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

/**
 * Adapter: wraps the Gemini embeddings API behind the EmbeddingProvider interface.
 *
 * Batching: uses batchEmbedContents for efficient multi-text embedding in one
 * API call instead of firing N separate requests.
 *
 * Normalisation: vectors are L2-normalised before being returned so that
 * cosine similarity reduces to a simple dot product at query time.
 * (cos_sim(a,b) = a·b when |a|=|b|=1)
 *
 * Retry: transient 429/5xx errors are retried up to MAX_RETRIES times
 * with exponential backoff before surfacing an UpstreamServiceError.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];

    logger.debug({ count: texts.length, model: this.model }, 'Embedding batch');

    return this.embedBatchWithRetry(texts);
  }

  private async embedBatchWithRetry(texts: string[]): Promise<Float32Array[]> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.callBatchEmbedApi(texts);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) break;

        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(
          { attempt: attempt + 1, delay },
          'Embedding retry after transient error'
        );
        await sleep(delay);
      }
    }

    throw new UpstreamServiceError(
      `Gemini embedding failed after ${MAX_RETRIES} attempts: ${errorMessage(lastError)}`
    );
  }

  private async callBatchEmbedApi(texts: string[]): Promise<Float32Array[]> {
    const embeddingModel = this.client.getGenerativeModel({ model: this.model });

    const result = await embeddingModel.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
      })),
    });

    return result.embeddings.map((e) => normalise(new Float32Array(e.values)));
  }
}

/**
 * L2-normalise a vector so |v| = 1.
 * After normalisation, dot product equals cosine similarity.
 */
function normalise(vec: Float32Array): Float32Array {
  let sumOfSquares = 0;
  for (const v of vec) {
    sumOfSquares += v * v;
  }
  const magnitude = Math.sqrt(sumOfSquares);
  if (magnitude === 0) return vec;

  const normalised = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    normalised[i] = (vec[i] ?? 0) / magnitude;
  }
  return normalised;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    return /429|500|503|rate.?limit|quota|server.?error/i.test(err.message);
  }
  return false;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

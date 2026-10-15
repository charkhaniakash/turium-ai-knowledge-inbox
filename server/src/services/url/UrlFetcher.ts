import { assertNotSsrf } from './ssrfGuard';
import { UnprocessableContentError } from '../../lib/errors';
import { logger } from '../../lib/logger';

const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain'];
const MAX_REDIRECTS = 5;

export interface FetchedPage {
  readonly url: string;       // final URL after redirects
  readonly contentType: string;
  readonly body: string;
}

/**
 * Fetches a URL safely:
 *   - SSRF guard checked before initial request and after each redirect
 *   - Hard timeout and response-size cap
 *   - Only text/html and text/plain content types accepted
 *   - Manual redirect handling so we can re-check SSRF after each hop
 */
export class UrlFetcher {
  private readonly timeoutMs: number;
  private readonly maxBytes: number;

  constructor(timeoutMs: number, maxBytes: number) {
    this.timeoutMs = timeoutMs;
    this.maxBytes = maxBytes;
  }

  async fetch(url: string): Promise<FetchedPage> {
    let currentUrl = url;

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      await assertNotSsrf(currentUrl);

      const response = await this.fetchWithTimeout(currentUrl);

      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        if (location === null) {
          throw new UnprocessableContentError(
            'Redirect response missing Location header'
          );
        }
        // Resolve relative redirects against the current URL
        currentUrl = new URL(location, currentUrl).href;
        logger.debug({ redirect: redirect + 1, url: currentUrl }, 'Following redirect');
        continue;
      }

      if (!response.ok) {
        throw new UnprocessableContentError(
          `URL returned HTTP ${response.status}`
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      assertAllowedContentType(contentType);

      const body = await this.readBodyWithLimit(response);
      return { url: currentUrl, contentType, body };
    }

    throw new UnprocessableContentError(
      `Exceeded maximum redirect limit (${MAX_REDIRECTS})`
    );
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        signal: controller.signal,
        redirect: 'manual', // handle redirects ourselves for SSRF re-check
        headers: { 'User-Agent': 'AI-Knowledge-Inbox/1.0' },
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UnprocessableContentError(
          `Request timed out after ${this.timeoutMs}ms`
        );
      }
      throw new UnprocessableContentError(
        `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async readBodyWithLimit(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (reader === undefined) {
      throw new UnprocessableContentError('Response has no body');
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > this.maxBytes) {
          throw new UnprocessableContentError(
            `Response exceeds maximum size of ${this.maxBytes} bytes`
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder().decode(combined);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function assertAllowedContentType(contentType: string): void {
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_CONTENT_TYPES.some((allowed) => base === allowed)) {
    throw new UnprocessableContentError(
      `Unsupported content type: ${base}. Only text/html and text/plain are accepted.`
    );
  }
}

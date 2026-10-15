import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { UnprocessableContentError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export interface ExtractedContent {
  readonly title: string | null;
  readonly text: string;
}

/**
 * Extracts clean readable text from raw HTML (or plain text).
 *
 * Strategy:
 *   1. If content-type is text/plain, return as-is.
 *   2. Parse HTML with JSDOM and try Mozilla Readability — best for articles.
 *   3. Fall back to stripping all tags from the <body> if Readability returns
 *      nothing (handles SPAs, simple pages, or non-article content).
 *   4. Fail with a clear error if the result is still empty.
 */
export class ContentExtractor {
  extract(html: string, contentType: string, url: string): ExtractedContent {
    const baseType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';

    if (baseType === 'text/plain') {
      const text = html.trim();
      if (text.length === 0) {
        throw new UnprocessableContentError('URL returned empty plain text content');
      }
      return { title: null, text };
    }

    return this.extractFromHtml(html, url);
  }

  private extractFromHtml(html: string, url: string): ExtractedContent {
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Attempt 1: Mozilla Readability (best for article-style pages)
    const readabilityResult = this.tryReadability(document.cloneNode(true) as Document);
    if (readabilityResult !== null) {
      logger.debug({ url }, 'ContentExtractor: used Readability');
      return readabilityResult;
    }

    // Attempt 2: Fallback — strip all tags from body text
    logger.debug({ url }, 'ContentExtractor: Readability returned nothing, using body fallback');
    return this.extractBodyText(document, url);
  }

  private tryReadability(document: Document): ExtractedContent | null {
    try {
      const reader = new Readability(document);
      const article = reader.parse();

      if (article === null || article.textContent.trim().length === 0) {
        return null;
      }

      return {
        title: article.title?.trim() || null,
        text: article.textContent.trim(),
      };
    } catch {
      return null;
    }
  }

  private extractBodyText(document: Document, url: string): ExtractedContent {
    // Remove script, style, and other non-content elements before extracting text
    const REMOVE_TAGS = ['script', 'style', 'noscript', 'nav', 'footer', 'header'];
    for (const tag of REMOVE_TAGS) {
      for (const el of Array.from(document.querySelectorAll(tag))) {
        el.remove();
      }
    }

    const bodyText = document.body?.textContent?.trim() ?? '';
    const title = document.title?.trim() || null;

    if (bodyText.length === 0) {
      throw new UnprocessableContentError(
        `No readable content could be extracted from URL: ${url}`
      );
    }

    // Collapse excessive whitespace that appears after tag removal
    const cleaned = bodyText.replace(/\s{3,}/g, '\n\n').trim();
    return { title, text: cleaned };
  }
}

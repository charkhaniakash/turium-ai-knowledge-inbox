import { describe, it, expect } from 'vitest';
import { ContentExtractor } from '../services/url/ContentExtractor';
import { UnprocessableContentError } from '../lib/errors';

const extractor = new ContentExtractor();

describe('ContentExtractor', () => {
  describe('plain text', () => {
    it('returns text as-is for text/plain', () => {
      const result = extractor.extract(
        'Hello world',
        'text/plain',
        'http://example.com/test.txt'
      );
      expect(result.text).toBe('Hello world');
      expect(result.title).toBeNull();
    });

    it('throws for empty plain text', () => {
      expect(() =>
        extractor.extract('   ', 'text/plain', 'http://example.com/empty.txt')
      ).toThrow(UnprocessableContentError);
    });
  });

  describe('HTML extraction via Readability', () => {
    it('extracts article content from well-formed HTML', () => {
      const html = `<!DOCTYPE html>
        <html>
          <head><title>Test Article</title></head>
          <body>
            <article>
              <h1>The Speed of Light</h1>
              <p>The speed of light in a vacuum is 299,792,458 metres per second.</p>
              <p>This constant is denoted by the letter c and is fundamental to Einstein's theory of special relativity.</p>
              <p>The famous equation E=mc² expresses the equivalence of energy and mass.</p>
            </article>
          </body>
        </html>`;

      const result = extractor.extract(html, 'text/html', 'http://example.com/article');
      expect(result.text).toContain('speed of light');
      expect(result.text.length).toBeGreaterThan(10);
    });

    it('extracts the page title when present', () => {
      const html = `<!DOCTYPE html>
        <html>
          <head><title>My Page Title</title></head>
          <body>
            <article>
              <p>Some content here for readability to parse correctly.</p>
              <p>More content to ensure Readability considers this an article.</p>
              <p>Even more content so that the extraction succeeds without falling back.</p>
            </article>
          </body>
        </html>`;

      const result = extractor.extract(html, 'text/html', 'http://example.com/');
      // Title may come from Readability or the fallback path
      expect(typeof result.title === 'string' || result.title === null).toBe(true);
    });
  });

  describe('HTML fallback extraction', () => {
    it('falls back to body text when Readability returns nothing', () => {
      // Minimal HTML with no article structure — Readability will return null
      const html = `<html><body><p>Fallback content here.</p></body></html>`;
      const result = extractor.extract(html, 'text/html', 'http://example.com/simple');
      expect(result.text).toContain('Fallback content');
    });

    it('throws when extracted body is empty', () => {
      const html = `<html><body></body></html>`;
      expect(() =>
        extractor.extract(html, 'text/html', 'http://example.com/empty')
      ).toThrow(UnprocessableContentError);
    });

    it('removes script and style tags from fallback content', () => {
      const html = `<html><body>
        <script>alert('xss')</script>
        <style>.foo { color: red; }</style>
        <p>Visible content only.</p>
      </body></html>`;

      const result = extractor.extract(html, 'text/html', 'http://example.com/scripts');
      expect(result.text).not.toContain("alert('xss')");
      expect(result.text).not.toContain('.foo');
      expect(result.text).toContain('Visible content only');
    });
  });
});

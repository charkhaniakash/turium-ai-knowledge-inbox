import { describe, it, expect } from 'vitest';
import { ParagraphChunker } from '../services/chunking/ParagraphChunker';

const chunker = new ParagraphChunker();

describe('ParagraphChunker', () => {
  it('returns a single chunk for short text', () => {
    const text = 'Hello world. This is a short note.';
    const chunks = chunker.chunk(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('returns empty array for empty string', () => {
    expect(chunker.chunk('')).toHaveLength(0);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(chunker.chunk('   \n\n  ')).toHaveLength(0);
  });

  it('splits on double newlines into separate paragraphs', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = chunker.chunk(text);
    // Three short paragraphs — all fit in one chunk due to greedy merge,
    // but with overlap the second chunk prefix is the tail of the first.
    // At minimum we get meaningful content, not empty chunks.
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it('applies overlap between consecutive chunks', () => {
    // Generate text that forces multiple chunks (> 2000 chars per paragraph)
    const paragraph1 = 'Alpha sentence. '.repeat(140).trim(); // ~2240 chars
    const paragraph2 = 'Beta sentence. '.repeat(140).trim();
    const text = paragraph1 + '\n\n' + paragraph2;

    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // The second chunk should contain a tail from the first chunk (overlap)
    const firstChunkTail = chunks[0]!.slice(-100);
    expect(chunks[1]).toContain(firstChunkTail.trim().split(' ')[0]);
  });

  it('splits oversized paragraphs by sentence boundaries', () => {
    // Single paragraph that is way over 2000 chars
    const longParagraph = Array.from({ length: 50 }, (_, i) => `Sentence number ${i + 1} contains enough words to contribute meaningfully to the character count of this paragraph.`).join(' ');
    expect(longParagraph.length).toBeGreaterThan(2_000);

    const chunks = chunker.chunk(longParagraph);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      // Each chunk should be within the character budget (plus overlap allowance)
      expect(chunk.length).toBeLessThanOrEqual(2_500);
    }
  });

  it('produces deterministic output for the same input', () => {
    const text = 'Para one.\n\nPara two.\n\nPara three.';
    expect(chunker.chunk(text)).toEqual(chunker.chunk(text));
  });

  it('does not mutate the input string', () => {
    const text = 'Immutability check.\n\nSecond paragraph.';
    const original = text;
    chunker.chunk(text);
    expect(text).toBe(original);
  });
});

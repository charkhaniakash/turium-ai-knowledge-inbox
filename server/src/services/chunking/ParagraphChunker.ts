import { Chunker } from '../../domain/interfaces';

/**
 * Strategy: ParagraphChunker
 *
 * Splits on paragraph boundaries first (double-newline), then breaks any
 * paragraph that exceeds MAX_CHARS by sentence boundaries.
 *
 * Target: ~500 tokens ≈ 2,000 characters per chunk.
 * Overlap: ~10–15% — the last OVERLAP_CHARS of a chunk are prepended to the
 * next chunk to preserve context across boundaries.
 *
 * Why paragraph-first over fixed-size:
 *   Fixed-size windows cut mid-sentence, destroying semantic units. Paragraphs
 *   are natural topic boundaries in prose and notes, so splitting on them keeps
 *   each chunk thematically coherent. Sentence-level fallback handles dense
 *   paragraphs that would otherwise exceed the embedding model's context.
 *
 * Why not semantic/heading-aware chunking yet:
 *   Requires a second LLM call per document or a custom parser — cost and
 *   latency not justified at this scale. Easy to swap in by adding a new
 *   Chunker strategy without touching any callers.
 */

const MAX_CHARS = 2_000;
const OVERLAP_CHARS = 250; // ~12.5% of MAX_CHARS

export class ParagraphChunker implements Chunker {
  chunk(text: string): string[] {
    const paragraphs = splitParagraphs(text);
    const segments = flattenOversizedParagraphs(paragraphs);
    return mergeWithOverlap(segments);
  }
}

/** Split on one or more blank lines, trim each paragraph. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Any paragraph over MAX_CHARS gets split into sentences.
 * Returns a flat list of segments all ≤ MAX_CHARS.
 */
function flattenOversizedParagraphs(paragraphs: string[]): string[] {
  const segments: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= MAX_CHARS) {
      segments.push(para);
    } else {
      segments.push(...splitBySentence(para));
    }
  }
  return segments;
}

/**
 * Split text into sentences using punctuation boundaries.
 * Consecutive short sentences are joined greedily until MAX_CHARS is reached.
 */
function splitBySentence(text: string): string[] {
  // Match sentence-ending punctuation followed by whitespace or end-of-string
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const result: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length === 0) {
      current = sentence;
    } else if (current.length + 1 + sentence.length <= MAX_CHARS) {
      current += ' ' + sentence;
    } else {
      result.push(current);
      current = sentence;
    }
  }

  if (current.length > 0) {
    result.push(current);
  }

  return result;
}

/**
 * Walk segments and apply overlap: prepend the tail of the previous chunk
 * to the current one so context is not lost at boundaries.
 * Single-segment texts are returned as-is (no overlap needed).
 */
function mergeWithOverlap(segments: string[]): string[] {
  if (segments.length <= 1) {
    return segments;
  }

  const chunks: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const current = segments[i] ?? '';
    if (i === 0) {
      chunks.push(current);
    } else {
      const previous = chunks[chunks.length - 1] ?? '';
      const overlap = previous.slice(-OVERLAP_CHARS);
      chunks.push(overlap + '\n\n' + current);
    }
  }

  return chunks;
}

import { ScoredChunk } from '../../domain/interfaces';

const SNIPPET_PREVIEW_LENGTH = 500;

export interface BuiltPrompt {
  readonly systemPrompt: string;
  readonly userMessage: string;
}

/**
 * Builds the system prompt and user message for the RAG query.
 *
 * Context blocks are numbered 1..N in the same order as the sources array
 * so that [1], [2], ... citations in the answer map exactly to source cards
 * in the frontend.
 *
 * The system prompt explicitly instructs the model to:
 *   - Answer only from the provided context
 *   - Cite sources using [n] notation
 *   - Admit when the context is insufficient rather than fabricating
 */
export function buildPrompt(question: string, chunks: ScoredChunk[]): BuiltPrompt {
  const contextBlocks = chunks
    .map((sc, index) => {
      const snippet = sc.chunk.text.slice(0, SNIPPET_PREVIEW_LENGTH);
      return `[${index + 1}] ${snippet}`;
    })
    .join('\n\n');

  const systemPrompt = [
    'You are a helpful assistant that answers questions strictly based on the provided context.',
    '',
    'Rules:',
    '- Answer ONLY using information from the numbered context blocks below.',
    '- Cite your sources inline using [n] notation, where n matches the context block number.',
    '- If multiple context blocks support a statement, cite all relevant ones, e.g. [1][3].',
    '- If the context does not contain enough information to answer the question, say:',
    '  "The saved content does not contain enough information to answer this question."',
    '- Do NOT fabricate information, make assumptions, or use outside knowledge.',
    '- Keep your answer concise and focused on the question.',
    '',
    'Context:',
    contextBlocks,
  ].join('\n');

  return { systemPrompt, userMessage: question };
}

/**
 * Message returned when no chunks meet the similarity threshold.
 * The LLM is NOT called in this case — we respond directly.
 */
export const NO_CONTEXT_ANSWER =
  'The saved content does not contain enough information to answer this question.';

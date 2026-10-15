import { LLMProvider } from '../../domain/interfaces';
import { Retriever } from '../retrieval/Retriever';
import { ItemRepository } from '../../domain/interfaces';
import { QueryResult, Source } from '../../domain/types';
import { buildPrompt, NO_CONTEXT_ANSWER } from './promptBuilder';
import { logger } from '../../lib/logger';

const SNIPPET_LENGTH = 300;

/**
 * Orchestrates the full RAG pipeline for a question:
 *   1. Retrieve top-K similar chunks
 *   2. Short-circuit if no chunk meets MIN_SIMILARITY_SCORE (no LLM call)
 *   3. Build the prompt with numbered context blocks
 *   4. Call the LLM and return the answer with mapped source citations
 */
export class AnswerService {
  private readonly retriever: Retriever;
  private readonly llmProvider: LLMProvider;
  private readonly itemRepository: ItemRepository;

  constructor(
    retriever: Retriever,
    llmProvider: LLMProvider,
    itemRepository: ItemRepository
  ) {
    this.retriever = retriever;
    this.llmProvider = llmProvider;
    this.itemRepository = itemRepository;
  }

  async answer(question: string): Promise<QueryResult> {
    // Step 1 — retrieve relevant chunks
    const scoredChunks = await this.retriever.retrieve(question);

    // Step 2 — short-circuit: no relevant context found
    if (scoredChunks.length === 0) {
      logger.info({ question }, 'AnswerService: no relevant chunks, skipping LLM');
      return { answer: NO_CONTEXT_ANSWER, sources: [] };
    }

    // Step 3 — build prompt with numbered context blocks
    const { systemPrompt, userMessage } = buildPrompt(question, scoredChunks);

    // Step 4 — call LLM
    const answerText = await this.llmProvider.complete(systemPrompt, userMessage);

    // Step 5 — map scored chunks to source objects (1-indexed to match [n] citations)
    const sources: Source[] = scoredChunks.map((sc, index) => {
      const item = this.itemRepository.findById(sc.chunk.itemId);
      return {
        index: index + 1,
        itemId: sc.chunk.itemId,
        chunkId: sc.chunk.id,
        title: item?.title ?? null,
        url: item?.url ?? null,
        snippet: sc.chunk.text.slice(0, SNIPPET_LENGTH),
        score: sc.score,
      };
    });

    logger.info(
      { sourceCount: sources.length, topScore: sources[0]?.score.toFixed(4) },
      'AnswerService: answer generated'
    );

    return { answer: answerText, sources };
  }
}

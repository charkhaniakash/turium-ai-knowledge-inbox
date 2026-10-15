import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider } from '../../domain/interfaces';
import { UpstreamServiceError } from '../../lib/errors';
import { logger } from '../../lib/logger';

/**
 * Adapter: wraps the Gemini chat API behind the LLMProvider interface.
 * Low temperature (0.2) keeps answers grounded in the provided context
 * and reduces hallucination risk in the RAG prompt.
 */
export class GeminiLLMProvider implements LLMProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.2,
      },
    });

    const start = Date.now();

    let result;
    try {
      result = await generativeModel.generateContent(userMessage);
    } catch (err) {
      throw new UpstreamServiceError(
        `Gemini LLM call failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const response = result.response;
    const text = response.text();

    // Log token usage when available — useful for cost/latency monitoring
    const usage = response.usageMetadata;
    logger.info(
      {
        model: this.model,
        promptTokens: usage?.promptTokenCount,
        candidateTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
        durationMs: Date.now() - start,
      },
      'LLM: generation complete'
    );

    return text;
  }
}

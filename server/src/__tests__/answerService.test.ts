import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, NO_CONTEXT_ANSWER } from '../services/answering/promptBuilder';
import { AnswerService } from '../services/answering/AnswerService';
import { Chunk, Item } from '../domain/types';
import { LLMProvider, ItemRepository, ScoredChunk } from '../domain/interfaces';
import { Retriever } from '../services/retrieval/Retriever';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChunk(id: string, itemId: string, text: string): Chunk {
  return {
    id,
    itemId,
    chunkIndex: 0,
    text,
    embedding: new Float32Array([0.1, 0.2]),
    createdAt: new Date().toISOString(),
  };
}

function makeScoredChunk(id: string, itemId: string, text: string, score: number): ScoredChunk {
  return { chunk: makeChunk(id, itemId, text), score };
}

function makeItem(id: string, title: string | null = null, url: string | null = null): Item {
  return {
    id,
    sourceType: url !== null ? 'url' : 'note',
    url,
    title,
    rawContent: 'some content',
    status: 'ready',
    error: null,
    createdAt: new Date().toISOString(),
  };
}

// ── Fake implementations ──────────────────────────────────────────────────────

class FakeLLMProvider implements LLMProvider {
  readonly calls: Array<{ system: string; user: string }> = [];
  private readonly response: string;
  constructor(response: string) { this.response = response; }
  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    this.calls.push({ system: systemPrompt, user: userMessage });
    return this.response;
  }
}

class FakeItemRepository implements ItemRepository {
  private readonly items: Map<string, Item>;
  constructor(items: Item[]) {
    this.items = new Map(items.map((i) => [i.id, i]));
  }
  save(): void { /* no-op */ }
  findById(id: string): Item | null { return this.items.get(id) ?? null; }
  findAll() { return []; }
  updateStatus(): void { /* no-op */ }
}

// Spy on Retriever.retrieve without calling real embeddings
function makeRetriever(chunks: ScoredChunk[]): Retriever {
  const fakeRetriever = {
    retrieve: vi.fn().mockResolvedValue(chunks),
  } as unknown as Retriever;
  return fakeRetriever;
}

// ── promptBuilder tests ───────────────────────────────────────────────────────

describe('promptBuilder', () => {
  it('numbers context blocks starting at 1', () => {
    const chunks = [
      makeScoredChunk('c1', 'i1', 'First chunk content', 0.9),
      makeScoredChunk('c2', 'i2', 'Second chunk content', 0.8),
    ];
    const { systemPrompt } = buildPrompt('What is this?', chunks);

    expect(systemPrompt).toContain('[1] First chunk content');
    expect(systemPrompt).toContain('[2] Second chunk content');
  });

  it('includes the question as the user message', () => {
    const chunks = [makeScoredChunk('c1', 'i1', 'Some content', 0.9)];
    const { userMessage } = buildPrompt('What is the speed of light?', chunks);
    expect(userMessage).toBe('What is the speed of light?');
  });

  it('includes citation instructions in the system prompt', () => {
    const chunks = [makeScoredChunk('c1', 'i1', 'Content', 0.9)];
    const { systemPrompt } = buildPrompt('Question?', chunks);
    expect(systemPrompt).toContain('[n]');
    expect(systemPrompt).toContain('Do NOT fabricate');
  });

  it('truncates long chunks to SNIPPET_PREVIEW_LENGTH in the prompt', () => {
    const longText = 'x'.repeat(2000);
    const chunks = [makeScoredChunk('c1', 'i1', longText, 0.9)];
    const { systemPrompt } = buildPrompt('Question?', chunks);
    // The context block should not contain the full 2000-char text
    expect(systemPrompt.length).toBeLessThan(3000);
  });

  it('handles a single chunk correctly', () => {
    const chunks = [makeScoredChunk('c1', 'i1', 'Only chunk', 0.9)];
    const { systemPrompt } = buildPrompt('Question?', chunks);
    expect(systemPrompt).toContain('[1] Only chunk');
    expect(systemPrompt).not.toContain('[2]');
  });
});

// ── AnswerService tests ───────────────────────────────────────────────────────

describe('AnswerService', () => {
  it('returns NO_CONTEXT_ANSWER and empty sources when retriever finds nothing', async () => {
    const llm = new FakeLLMProvider('This should not be called');
    const service = new AnswerService(
      makeRetriever([]),
      llm,
      new FakeItemRepository([])
    );

    const result = await service.answer('What is quantum physics?');

    expect(result.answer).toBe(NO_CONTEXT_ANSWER);
    expect(result.sources).toHaveLength(0);
    // LLM must NOT be called when there is no context
    expect(llm.calls).toHaveLength(0);
  });

  it('calls the LLM when relevant chunks are found', async () => {
    const chunks = [makeScoredChunk('c1', 'item-1', 'Light travels fast.', 0.85)];
    const llm = new FakeLLMProvider('Light is very fast [1].');
    const item = makeItem('item-1', 'Physics Note');

    const service = new AnswerService(
      makeRetriever(chunks),
      llm,
      new FakeItemRepository([item])
    );

    const result = await service.answer('How fast does light travel?');

    expect(llm.calls).toHaveLength(1);
    expect(result.answer).toBe('Light is very fast [1].');
  });

  it('maps sources with correct index, title, url, and snippet', async () => {
    const chunks = [
      makeScoredChunk('c1', 'item-1', 'Note content', 0.9),
      makeScoredChunk('c2', 'item-2', 'URL content', 0.8),
    ];
    const items = [
      makeItem('item-1', 'My Note', null),
      makeItem('item-2', 'Example Site', 'https://example.com'),
    ];
    const llm = new FakeLLMProvider('Answer citing [1] and [2].');

    const service = new AnswerService(
      makeRetriever(chunks),
      llm,
      new FakeItemRepository(items)
    );

    const result = await service.answer('Tell me about notes and sites');

    expect(result.sources).toHaveLength(2);

    const src1 = result.sources[0];
    expect(src1?.index).toBe(1);
    expect(src1?.title).toBe('My Note');
    expect(src1?.url).toBeNull();
    expect(src1?.snippet).toBe('Note content');
    expect(src1?.score).toBe(0.9);

    const src2 = result.sources[1];
    expect(src2?.index).toBe(2);
    expect(src2?.title).toBe('Example Site');
    expect(src2?.url).toBe('https://example.com');
  });

  it('passes numbered context to LLM in correct order', async () => {
    const chunks = [
      makeScoredChunk('c1', 'i1', 'First context', 0.9),
      makeScoredChunk('c2', 'i2', 'Second context', 0.8),
    ];
    const llm = new FakeLLMProvider('Answer [1][2].');

    const service = new AnswerService(
      makeRetriever(chunks),
      llm,
      new FakeItemRepository([makeItem('i1'), makeItem('i2')])
    );

    await service.answer('Question?');

    expect(llm.calls[0]?.system).toContain('[1] First context');
    expect(llm.calls[0]?.system).toContain('[2] Second context');
  });
});

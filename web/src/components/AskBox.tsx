import { useState, FormEvent } from 'react';

interface AskBoxProps {
  hasReadyItems: boolean;
  isLoading: boolean;
  onAsk: (question: string) => void;
}

/** Stub — fully built in Phase 9 */
export function AskBox({ hasReadyItems, isLoading, onAsk }: AskBoxProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (q.length >= 3) onAsk(q);
  };

  return (
    <form className="ask-box" onSubmit={handleSubmit}>
      <input
        type="text"
        className="ask-input"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={hasReadyItems ? 'Ask a question about your notes…' : 'Add some notes first…'}
        disabled={!hasReadyItems || isLoading}
        aria-label="Question"
        minLength={3}
        maxLength={1000}
      />
      <button
        type="submit"
        className="submit-btn"
        disabled={!hasReadyItems || isLoading || question.trim().length < 3}
        aria-busy={isLoading}
      >
        {isLoading ? <span className="spinner" aria-label="Thinking…" /> : 'Ask'}
      </button>
    </form>
  );
}

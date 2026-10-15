import { useState, FormEvent, KeyboardEvent } from 'react';

interface AskBoxProps {
  hasReadyItems: boolean;
  isLoading: boolean;
  onAsk: (question: string) => void;
}

/**
 * Text input + submit button for asking questions.
 * Disabled entirely when there are no ready items — asking against an empty
 * knowledge base would always return the no-context answer.
 */
export function AskBox({ hasReadyItems, isLoading, onAsk }: AskBoxProps) {
  const [question, setQuestion] = useState('');

  const canSubmit = hasReadyItems && !isLoading && question.trim().length >= 3;

  const submit = () => {
    const q = question.trim();
    if (q.length >= 3) {
      onAsk(q);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  // Allow Ctrl+Enter / Cmd+Enter to submit from the textarea
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  const placeholder = hasReadyItems
    ? 'Ask a question about your saved notes and URLs…'
    : 'Add and process some items before asking questions.';

  return (
    <form className="ask-box" onSubmit={handleSubmit} aria-label="Ask a question">
      <textarea
        className="ask-input"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={!hasReadyItems || isLoading}
        aria-label="Your question"
        rows={2}
        maxLength={1000}
      />
      <div className="ask-actions">
        <span className="ask-hint">
          {canSubmit ? 'Press Ask or Ctrl+Enter' : ''}
        </span>
        <button
          type="submit"
          className="submit-btn"
          disabled={!canSubmit}
          aria-busy={isLoading}
        >
          {isLoading
            ? <span className="spinner" aria-label="Thinking…" />
            : 'Ask'}
        </button>
      </div>
    </form>
  );
}

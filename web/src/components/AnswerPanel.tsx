import { QueryResult } from '../types';

interface AnswerPanelProps {
  result: QueryResult | null;
  error: string | null;
}

/** Stub — fully built in Phase 9 */
export function AnswerPanel({ result, error }: AnswerPanelProps) {
  if (error !== null) {
    return <p className="answer-error" role="alert">Error: {error}</p>;
  }
  if (result === null) return null;

  return (
    <div className="answer-panel">
      <p className="answer-text">{result.answer}</p>
      {result.sources.length > 0 && (
        <p className="answer-meta">{result.sources.length} source(s) — full display in Phase 9</p>
      )}
    </div>
  );
}

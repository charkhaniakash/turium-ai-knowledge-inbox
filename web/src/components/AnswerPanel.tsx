import { QueryResult, Source } from '../types';

interface AnswerPanelProps {
  result: QueryResult | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Displays the RAG answer and its source cards.
 *
 * Citation rendering: [n] markers in the answer text are replaced with
 * highlighted <sup> badges that visually match the numbered source cards below.
 */
export function AnswerPanel({ result, error, isLoading }: AnswerPanelProps) {
  if (isLoading) {
    return (
      <div className="answer-panel answer-loading" aria-live="polite">
        <span className="spinner spinner-dark" aria-label="Generating answer…" />
        <span className="answer-loading-text">Thinking…</span>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="answer-panel" aria-live="polite">
        <p className="answer-error" role="alert">⚠ {error}</p>
      </div>
    );
  }

  if (result === null) return null;

  const hasNoContext = result.sources.length === 0;

  return (
    <div className="answer-panel" aria-live="polite">
      <div className="answer-body">
        <p className="answer-label">Answer</p>
        <div className="answer-text">
          {renderAnswerWithCitations(result.answer)}
        </div>
      </div>

      {!hasNoContext && (
        <div className="sources-section">
          <p className="sources-label">Sources</p>
          <div className="source-cards">
            {result.sources.map((source) => (
              <SourceCard key={source.chunkId} source={source} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Citation rendering ────────────────────────────────────────────────────────

/**
 * Splits the answer text on [n] citation markers and renders each segment
 * with inline citation badges. E.g. "Light travels fast [1][2]." becomes
 * text nodes interspersed with <sup class="citation">[1]</sup> elements.
 */
function renderAnswerWithCitations(text: string): React.ReactNode {
  const CITATION_RE = /(\[\d+\])/g;
  const parts = text.split(CITATION_RE);

  return parts.map((part, i) => {
    if (CITATION_RE.test(part)) {
      // Reset lastIndex after test() consumed it
      CITATION_RE.lastIndex = 0;
      return (
        <sup key={i} className="citation-badge">
          {part}
        </sup>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ source }: { source: Source }) {
  const displayTitle = source.title ?? source.url ?? `Item ${source.itemId.slice(0, 8)}`;
  const scorePercent = Math.round(source.score * 100);

  return (
    <div className="source-card" aria-label={`Source ${source.index}`}>
      <div className="source-header">
        <span className="source-index" aria-label={`Citation ${source.index}`}>
          {source.index}
        </span>
        <span className="source-title" title={displayTitle}>
          {source.url !== null ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="source-link"
            >
              {displayTitle}
            </a>
          ) : (
            displayTitle
          )}
        </span>
        <span className="source-score" aria-label={`Relevance ${scorePercent}%`}>
          {scorePercent}%
        </span>
      </div>
      <p className="source-snippet">{source.snippet}</p>
    </div>
  );
}

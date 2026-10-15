import { useState, FormEvent } from 'react';
import { ingestNote, ingestUrl, ApiResponseError } from '../api/client';
import { ItemSummary } from '../types';

interface AddItemFormProps {
  onItemAdded: (item: ItemSummary) => void;
}

type SourceType = 'note' | 'url';

export function AddItemForm({ onItemAdded }: AddItemFormProps) {
  const [type, setType] = useState<SourceType>('note');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const item =
        type === 'note'
          ? await ingestNote(trimmed)
          : await ingestUrl(trimmed);
      onItemAdded(item);
      setContent('');
    } catch (err) {
      if (err instanceof ApiResponseError && err.apiError.details) {
        setError(err.apiError.details.map((d) => d.message).join(', '));
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save item');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const placeholder =
    type === 'note'
      ? 'Enter your note (up to 20,000 characters)…'
      : 'https://example.com/article';

  const isValid = content.trim().length > 0;

  return (
    <form className="add-item-form" onSubmit={(e) => { void handleSubmit(e); }}>
      <div className="type-toggle">
        <button
          type="button"
          className={`toggle-btn ${type === 'note' ? 'active' : ''}`}
          onClick={() => { setType('note'); setContent(''); setError(null); }}
        >
          📝 Note
        </button>
        <button
          type="button"
          className={`toggle-btn ${type === 'url' ? 'active' : ''}`}
          onClick={() => { setType('url'); setContent(''); setError(null); }}
        >
          🔗 URL
        </button>
      </div>

      {type === 'note' ? (
        <textarea
          className="content-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={isSubmitting}
          maxLength={20000}
          aria-label="Note content"
        />
      ) : (
        <input
          type="url"
          className="content-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          maxLength={2048}
          aria-label="URL to ingest"
        />
      )}

      {error !== null && (
        <p className="form-error" role="alert">{error}</p>
      )}

      <button
        type="submit"
        className="submit-btn"
        disabled={!isValid || isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? (
          <span className="spinner" aria-label="Saving…" />
        ) : (
          type === 'note' ? 'Save Note' : 'Fetch & Save URL'
        )}
      </button>
    </form>
  );
}

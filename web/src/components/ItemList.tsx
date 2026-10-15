import { ItemSummary } from '../types';

interface ItemListProps {
  items: ItemSummary[];
  isLoading: boolean;
  error: string | null;
}

export function ItemList({ items, isLoading, error }: ItemListProps) {
  if (isLoading) {
    return <p className="list-state">Loading items…</p>;
  }

  if (error !== null) {
    return <p className="list-state error" role="alert">Error: {error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No items yet.</p>
        <p>Add a note or URL above to get started.</p>
      </div>
    );
  }

  return (
    <ul className="item-list" aria-label="Saved items">
      {items.map((item) => (
        <li key={item.id} className="item-card">
          <div className="item-header">
            <span className="item-type">
              {item.sourceType === 'note' ? '📝' : '🔗'}
            </span>
            <span className="item-title">
              {item.title ??
                (item.url !== null ? item.url : 'Untitled note')}
            </span>
            <StatusBadge status={item.status} />
          </div>

          {item.preview.length > 0 && (
            <p className="item-preview">{item.preview}</p>
          )}

          {item.status === 'failed' && item.error !== null && (
            <p className="item-error" role="alert">⚠ {item.error}</p>
          )}

          <div className="item-footer">
            <span className="item-meta">
              {formatDate(item.createdAt)}
            </span>
            {item.status === 'ready' && (
              <span className="item-meta">
                {item.chunkCount} chunk{item.chunkCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: ItemSummary['status'] }) {
  const labels: Record<ItemSummary['status'], string> = {
    pending: '⏳ Processing',
    ready: '✅ Ready',
    failed: '❌ Failed',
  };
  return (
    <span className={`status-badge status-${status}`} aria-label={`Status: ${status}`}>
      {labels[status]}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

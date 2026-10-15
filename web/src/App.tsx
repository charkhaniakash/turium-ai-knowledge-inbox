import { useCallback } from 'react';
import { AddItemForm } from './components/AddItemForm';
import { ItemList } from './components/ItemList';
import { AskBox } from './components/AskBox';
import { AnswerPanel } from './components/AnswerPanel';
import { useItems } from './hooks/useItems';
import { useAsk } from './hooks/useAsk';
import { ItemSummary } from './types';
import './App.css';

export default function App() {
  const { items, isLoading: itemsLoading, error: itemsError, refresh } = useItems();
  const { result, isLoading: askLoading, error: askError, ask } = useAsk();

  const hasReadyItems = items.some((item) => item.status === 'ready');

  const handleItemAdded = useCallback(
    (newItem: ItemSummary) => {
      // Optimistically prepend the new item, then refresh to get server state
      refresh();
      void newItem; // item will appear via refresh
    },
    [refresh]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">AI Knowledge Inbox</h1>
        <p className="app-subtitle">Save notes and URLs, then ask questions about them.</p>
      </header>

      <main className="app-main">
        <section className="section" aria-label="Add content">
          <h2 className="section-title">Add Content</h2>
          <AddItemForm onItemAdded={handleItemAdded} />
        </section>

        <section className="section" aria-label="Ask a question">
          <h2 className="section-title">Ask a Question</h2>
          <AskBox
            hasReadyItems={hasReadyItems}
            isLoading={askLoading}
            onAsk={ask}
          />
          <AnswerPanel result={result} error={askError} />
        </section>

        <section className="section" aria-label="Saved items">
          <h2 className="section-title">
            Saved Items
            {items.length > 0 && (
              <span className="item-count"> ({items.length})</span>
            )}
          </h2>
          <ItemList items={items} isLoading={itemsLoading} error={itemsError} />
        </section>
      </main>
    </div>
  );
}

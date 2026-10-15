import Database from 'better-sqlite3';
import { Item, ItemSummary, ItemStatus } from '../domain/types';
import { ItemRepository } from '../domain/interfaces';

interface ItemRow {
  id: string;
  source_type: string;
  url: string | null;
  title: string | null;
  raw_content: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

interface ChunkCountRow {
  item_id: string;
  count: number;
}

const PREVIEW_LENGTH = 200;

/**
 * Repository pattern: wraps all SQLite access for the items table.
 * Callers depend on ItemRepository (interface), not this class directly.
 */
export class SqliteItemRepository implements ItemRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  save(item: Item): void {
    const stmt = this.db.prepare<[string, string, string | null, string | null, string | null, string, string | null, string]>(`
      INSERT INTO items (id, source_type, url, title, raw_content, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      item.id,
      item.sourceType,
      item.url ?? null,
      item.title ?? null,
      item.rawContent ?? null,
      item.status,
      item.error ?? null,
      item.createdAt
    );
  }

  findById(id: string): Item | null {
    const stmt = this.db.prepare<[string], ItemRow>(
      'SELECT * FROM items WHERE id = ?'
    );
    const row = stmt.get(id);
    return row ? this.rowToItem(row) : null;
  }

  findAll(): ItemSummary[] {
    const items = this.db
      .prepare<[], ItemRow>('SELECT * FROM items ORDER BY created_at DESC')
      .all();

    const counts = this.db
      .prepare<[], ChunkCountRow>(
        'SELECT item_id, COUNT(*) as count FROM chunks GROUP BY item_id'
      )
      .all();

    const countMap = new Map<string, number>(
      counts.map((r) => [r.item_id, r.count])
    );

    return items.map((row) => this.rowToSummary(row, countMap.get(row.id) ?? 0));
  }

  updateStatus(
    id: string,
    status: ItemStatus,
    extra?: { title?: string; error?: string }
  ): void {
    const stmt = this.db.prepare<[string, string | null, string | null, string]>(`
      UPDATE items SET status = ?, title = COALESCE(?, title), error = ? WHERE id = ?
    `);
    stmt.run(
      status,
      extra?.title ?? null,
      extra?.error ?? null,
      id
    );
  }

  private rowToItem(row: ItemRow): Item {
    return {
      id: row.id,
      sourceType: row.source_type as Item['sourceType'],
      url: row.url,
      title: row.title,
      rawContent: row.raw_content,
      status: row.status as Item['status'],
      error: row.error,
      createdAt: row.created_at,
    };
  }

  private rowToSummary(row: ItemRow, chunkCount: number): ItemSummary {
    const raw = row.raw_content ?? '';
    return {
      id: row.id,
      sourceType: row.source_type as ItemSummary['sourceType'],
      url: row.url,
      title: row.title,
      preview: raw.slice(0, PREVIEW_LENGTH),
      status: row.status as ItemSummary['status'],
      error: row.error,
      createdAt: row.created_at,
      chunkCount,
    };
  }
}

import Database from 'better-sqlite3';
import { Chunk } from '../domain/types';
import { ChunkRepository } from '../domain/interfaces';

interface ChunkRow {
  id: string;
  item_id: string;
  chunk_index: number;
  text: string;
  embedding: Buffer;
  created_at: string;
}

/**
 * Repository pattern: wraps all SQLite access for the chunks table.
 * Embeddings are stored as raw Float32 bytes (BLOB) and deserialized on read.
 */
export class SqliteChunkRepository implements ChunkRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  saveAll(chunks: Chunk[]): void {
    const stmt = this.db.prepare<[string, string, number, string, Buffer, string]>(`
      INSERT INTO chunks (id, item_id, chunk_index, text, embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((rows: Chunk[]) => {
      for (const chunk of rows) {
        stmt.run(
          chunk.id,
          chunk.itemId,
          chunk.chunkIndex,
          chunk.text,
          Buffer.from(chunk.embedding.buffer),
          chunk.createdAt
        );
      }
    });

    insertMany(chunks);
  }

  findByItemId(itemId: string): Chunk[] {
    const rows = this.db
      .prepare<[string], ChunkRow>(
        'SELECT * FROM chunks WHERE item_id = ? ORDER BY chunk_index ASC'
      )
      .all(itemId);
    return rows.map(this.rowToChunk);
  }

  findAllReady(): Chunk[] {
    // Only return chunks from items that have finished processing
    const rows = this.db
      .prepare<[], ChunkRow>(`
        SELECT c.* FROM chunks c
        INNER JOIN items i ON i.id = c.item_id
        WHERE i.status = 'ready'
        ORDER BY c.item_id, c.chunk_index ASC
      `)
      .all();
    return rows.map(this.rowToChunk);
  }

  countByItemId(itemId: string): number {
    const result = this.db
      .prepare<[string], { count: number }>(
        'SELECT COUNT(*) as count FROM chunks WHERE item_id = ?'
      )
      .get(itemId);
    return result?.count ?? 0;
  }

  private rowToChunk(row: ChunkRow): Chunk {
    return {
      id: row.id,
      itemId: row.item_id,
      chunkIndex: row.chunk_index,
      text: row.text,
      // Deserialize BLOB bytes back to Float32Array
      embedding: new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
      ),
      createdAt: row.created_at,
    };
  }
}

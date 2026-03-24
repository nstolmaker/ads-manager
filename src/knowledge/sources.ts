import { query } from '../db/pool.js';

export interface SourceInfo {
  source: string;
  knowledge_type: string;
  chunkCount: number;
  lastUpdated: string;
}

export async function listSources(): Promise<SourceInfo[]> {
  const rows = await query(
    `SELECT source, knowledge_type, COUNT(*)::int AS chunk_count, MAX(created_at) AS last_updated
     FROM embeddings
     GROUP BY source, knowledge_type
     ORDER BY source`,
  );
  return rows.map(r => ({
    source: r.source,
    knowledge_type: r.knowledge_type,
    chunkCount: r.chunk_count,
    lastUpdated: r.last_updated,
  }));
}

export async function deleteSource(source: string): Promise<number> {
  const rows = await query(
    `DELETE FROM embeddings WHERE source = $1 RETURNING id`,
    [source],
  );
  return rows.length;
}

import { query } from '../db/pool.js';
import { generateEmbedding } from './embedding.js';

export interface ChunkResult {
  source: string;
  chunk: string;
  metadata: Record<string, any>;
  similarity: number;
}

export async function searchKnowledge(
  queryText: string,
  knowledgeType?: string,
  limit = 5,
): Promise<ChunkResult[]> {
  const embedding = await generateEmbedding(queryText);
  const vectorLiteral = `[${embedding.join(',')}]`;

  const whereClause = knowledgeType
    ? `WHERE knowledge_type = $2`
    : '';
  const params: any[] = [vectorLiteral];
  if (knowledgeType) params.push(knowledgeType);

  const limitParam = `$${params.length + 1}`;
  params.push(limit);

  const rows = await query(
    `SELECT source, chunk, metadata, 1 - (embedding <=> $1::vector) AS similarity
     FROM embeddings
     ${whereClause}
     ORDER BY embedding <=> $1::vector
     LIMIT ${limitParam}`,
    params,
  );

  return rows.map(r => ({
    source: r.source,
    chunk: r.chunk,
    metadata: r.metadata,
    similarity: parseFloat(r.similarity),
  }));
}

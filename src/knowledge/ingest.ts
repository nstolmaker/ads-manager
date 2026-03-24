import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { query } from '../db/pool.js';
import { generateEmbedding } from './embedding.js';
import { logger } from '../utils/logger.js';

export async function ingestFile(
  filePath: string,
  source: string,
  knowledgeType: string,
): Promise<{ inserted: number; skipped: number }> {
  const buffer = fs.readFileSync(filePath);
  const pdf = await pdfParse(buffer);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 250,
  });
  const chunks = await splitter.splitText(pdf.text);

  let inserted = 0;
  let skipped = 0;
  const fileName = path.basename(filePath);

  for (let i = 0; i < chunks.length; i++) {
    // Check if chunk already exists (resumable)
    const existing = await query(
      `SELECT COUNT(*)::int as cnt FROM embeddings WHERE source = $1 AND metadata->>'chunkIndex' = $2`,
      [source, String(i)],
    );
    if (existing[0]?.cnt > 0) {
      skipped++;
      continue;
    }

    const embedding = await generateEmbedding(chunks[i]);

    await query(
      `INSERT INTO embeddings (source, knowledge_type, chunk, embedding, metadata)
       VALUES ($1, $2, $3, $4::vector, $5)`,
      [
        source,
        knowledgeType,
        chunks[i],
        `[${embedding.join(',')}]`,
        JSON.stringify({
          chunkIndex: i,
          totalChunks: chunks.length,
          fileName,
          filePath,
        }),
      ],
    );

    inserted++;

    if ((inserted + skipped) % 10 === 0) {
      logger.info(`[ingest] ${fileName}: ${inserted + skipped}/${chunks.length} chunks processed (${inserted} new, ${skipped} skipped)`);
    }
  }

  logger.info(`[ingest] ${fileName}: done — ${inserted} inserted, ${skipped} skipped`);
  return { inserted, skipped };
}

export async function scanAndIngest(
  sourceDir: string,
  knowledgeType: string,
): Promise<{ file: string; inserted: number; skipped: number }[]> {
  const files = fs.readdirSync(sourceDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const results: { file: string; inserted: number; skipped: number }[] = [];

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const source = path.basename(file, '.pdf');
    logger.info(`[ingest] Starting: ${file}`);
    const result = await ingestFile(filePath, source, knowledgeType);
    results.push({ file, ...result });
  }

  return results;
}

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const EPub = require('epub');

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { query } from '../db/pool.js';
import { generateEmbedding } from './embedding.js';
import { logger } from '../utils/logger.js';

// ── Text extractors ──────────────────────────────────────────────────────────

async function extractPdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const pdf = await pdfParse(buffer);
  return pdf.text;
}

async function extractEpub(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const book = new EPub(filePath);
    book.on('error', reject);
    book.on('end', async () => {
      try {
        const chapterTexts = await Promise.all(
          book.flow.map(
            (ch: any) =>
              new Promise<string>((res, rej) => {
                book.getChapter(ch.id, (err: any, text: string) => {
                  if (err) return rej(err);
                  // Strip HTML tags
                  res(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
                });
              }),
          ),
        );
        resolve(chapterTexts.join('\n\n'));
      } catch (err) {
        reject(err);
      }
    });
    book.parse();
  });
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return extractPdf(filePath);
  if (ext === '.epub') return extractEpub(filePath);
  throw new Error(`Unsupported file type: ${ext}`);
}

// ── Core ingest ──────────────────────────────────────────────────────────────

export async function ingestFile(
  filePath: string,
  source: string,
  knowledgeType: string,
): Promise<{ inserted: number; skipped: number }> {
  const fileName = path.basename(filePath);
  const text = await extractText(filePath);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 250,
  });
  const chunks = await splitter.splitText(text);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < chunks.length; i++) {
    // Resumable: skip if chunk already exists
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
        JSON.stringify({ chunkIndex: i, totalChunks: chunks.length, fileName, filePath }),
      ],
    );

    inserted++;

    if ((inserted + skipped) % 10 === 0) {
      logger.info(
        `[ingest] ${fileName}: ${inserted + skipped}/${chunks.length} chunks processed (${inserted} new, ${skipped} skipped)`,
      );
    }
  }

  logger.info(`[ingest] ${fileName}: done — ${inserted} inserted, ${skipped} skipped`);
  return { inserted, skipped };
}

// ── Scan folder ──────────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = ['.pdf', '.epub'];

export async function scanAndIngest(
  sourceDir: string,
  knowledgeType: string,
): Promise<{ file: string; inserted: number; skipped: number }[]> {
  const files = fs
    .readdirSync(sourceDir)
    .filter(f => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()));

  const results: { file: string; inserted: number; skipped: number }[] = [];

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const ext = path.extname(file).toLowerCase();
    const source = path.basename(file, ext);
    logger.info(`[ingest] Starting: ${file}`);
    const result = await ingestFile(filePath, source, knowledgeType);
    results.push({ file, ...result });
  }

  return results;
}

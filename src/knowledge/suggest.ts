/**
 * knowledge/suggest.ts
 * Pulls Google Autocomplete suggestions for a seed keyword,
 * filters to buyer-intent terms, and ingests them into the KB
 * as knowledge_type = "buyer_language".
 */
import { query } from "../db/pool.js";
import { generateEmbedding } from "./embedding.js";
import { logger } from "../utils/logger.js";

const RATE_LIMIT_MS = 400; // ~2.5 req/sec — polite
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Expanders: alpha + common intent prefixes
const ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");
const INTENT_PREFIXES = [
  "for", "near", "help", "cost", "price", "rate", "rates", "how", "what",
  "why", "best", "vs", "without", "small business", "startup", "freelance",
];

// Terms that signal non-buyer intent (jobs, education, news, geography noise)
const NOISE_PATTERNS = [
  /\b(salary|salaries|jobs?|careers?|hiring|internship|interview|certification|course|degree|training|bootcamp|reddit|linkedin|youtube|pdf|template|logo|icon|image|naics|meaning|definition|wikipedia)\b/i,
  /\b(india|uk|australia|canada|london|dubai|singapore|toronto|sydney|ireland|germany|france|pakistan|nigeria|kenya|zarobki|quebec|oslo|nz|zealand)\b/i,
  /\b(reviews?|yelp|glassdoor|indeed|salary\.com)\b/i,
];

function isBuyerIntent(term: string): boolean {
  return !NOISE_PATTERNS.some(p => p.test(term));
}

async function fetchSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&hl=en`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j[1] ?? []) as string[];
  } catch {
    return [];
  }
}

export interface SuggestIngestResult {
  seed: string;
  total: number;
  buyerIntent: number;
  inserted: number;
  skipped: number;
}

export async function ingestSuggestions(
  seed: string,
  personaSlug?: string,
): Promise<SuggestIngestResult> {
  const source = `suggest:${seed}`;
  const knowledgeType = "buyer_language";
  const all = new Set<string>();

  // Base query
  const base = await fetchSuggestions(seed);
  base.forEach(s => all.add(s.toLowerCase().trim()));
  await sleep(RATE_LIMIT_MS);

  // Expanded queries
  const expanders = [...ALPHA, ...INTENT_PREFIXES];
  for (const exp of expanders) {
    const results = await fetchSuggestions(`${seed} ${exp}`);
    results.forEach(s => all.add(s.toLowerCase().trim()));
    await sleep(RATE_LIMIT_MS);
  }

  // Filter to buyer intent
  const buyerTerms = [...all].filter(isBuyerIntent);

  logger.info(`[suggest] "${seed}": ${all.size} total suggestions, ${buyerTerms.length} buyer-intent`);

  let inserted = 0;
  let skipped = 0;

  for (const term of buyerTerms) {
    // Deduplicate by source + chunk
    const existing = await query(
      `SELECT COUNT(*)::int as cnt FROM embeddings WHERE source = $1 AND chunk = $2`,
      [source, term],
    );
    if (existing[0]?.cnt > 0) {
      skipped++;
      continue;
    }

    const embedding = await generateEmbedding(term);
    await query(
      `INSERT INTO embeddings (source, knowledge_type, chunk, embedding, metadata)
       VALUES ($1, $2, $3, $4::vector, $5)`,
      [
        source,
        knowledgeType,
        term,
        `[${embedding.join(",")}]`,
        JSON.stringify({ seed, personaSlug: personaSlug ?? null, filtered: true }),
      ],
    );
    inserted++;
  }

  logger.info(`[suggest] "${seed}": ${inserted} inserted, ${skipped} skipped`);
  return { seed, total: all.size, buyerIntent: buyerTerms.length, inserted, skipped };
}

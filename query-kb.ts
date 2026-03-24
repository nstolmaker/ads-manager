import 'dotenv/config';
import { searchKnowledge } from './src/knowledge/search.js';

const results = await searchKnowledge('choosing PPC keywords', undefined, 5);
for (const r of results) {
  console.log(`\n--- [${r.source}] similarity: ${(r as any).similarity?.toFixed(3)} ---`);
  console.log(r.chunk.slice(0, 600));
}
process.exit(0);

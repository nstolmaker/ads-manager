import 'dotenv/config';
const { searchKnowledge } = await import('./src/knowledge/search.js');

const results = await searchKnowledge('choosing PPC keywords', undefined, 5);
for (const r of results) {
  console.log(`\n--- [${r.source}] similarity: ${r.similarity?.toFixed(3)} ---`);
  console.log(r.chunk.slice(0, 500));
}
process.exit(0);

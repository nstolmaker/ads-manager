/**
 * scripts/seed-keywords.ts
 * One-off initial keyword seed per persona for loop testing
 * Run: TEST=1 npx tsx scripts/seed-keywords.ts
 */
import 'dotenv/config';
import { addKeywords, getFirstAdGroupId } from '../src/google-ads/keywords.js';
import { pool } from '../src/db/pool.js';

const seeds: Record<string, string[]> = {
  '23688917485': [ // AI Department
    'ai consulting services',
    'hire ai consultant',
    'ai strategy for business',
    'ai implementation consultant',
    'business ai automation',
  ],
  '23684245841': [ // Pressure Release
    'automate business processes',
    'reduce team workload',
    'business process automation consultant',
    'ai workflow automation',
    'overwhelmed business owner help',
  ],
  '23684245874': [ // Turbocharger
    'increase team productivity',
    'ai tools for business productivity',
    'scale business with ai',
    'ai powered business growth',
    'automate repetitive tasks business',
  ],
};

async function run() {
  console.log(`\n🌱 Seeding keywords (TEST=${process.env.TEST})\n`);

  for (const [campaignId, keywords] of Object.entries(seeds)) {
    console.log(`▶ Campaign ${campaignId}`);

    const adGroupId = await getFirstAdGroupId(campaignId);
    if (!adGroupId) {
      console.error(`  ❌ No ad group found`);
      continue;
    }

    console.log(`  Ad group: ${adGroupId}`);
    const created = await addKeywords(campaignId, adGroupId, keywords);
    console.log(`  ✅ Added ${created.length} keywords\n`);
  }

  await pool.end();
  console.log('Done.');
}

run().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});

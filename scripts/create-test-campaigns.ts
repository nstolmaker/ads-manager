/**
 * scripts/create-test-campaigns.ts
 * Creates one Search campaign per marketing persona in the test account
 * Run: TEST=1 npx tsx scripts/create-test-campaigns.ts
 */
import 'dotenv/config';
import { createCampaign, createAdGroup } from '../src/google-ads/campaigns.js';
import { pool } from '../src/db/pool.js';

const DAILY_BUDGET_USD = 26.67; // $800/mo ÷ 3 personas ÷ 30 days
const DAILY_BUDGET_MICROS = Math.round(DAILY_BUDGET_USD * 1_000_000);

const personas = [
  {
    slug: 'ai-department',
    name: 'Noah Consulting — AI Department',
    finalUrl: 'https://noah.consulting/lp/ai-department',
  },
  {
    slug: 'pressure-release',
    name: 'Noah Consulting — Pressure Release',
    finalUrl: 'https://noah.consulting/lp/pressure-release',
  },
  {
    slug: 'turbocharger',
    name: 'Noah Consulting — Turbocharger',
    finalUrl: 'https://noah.consulting/lp/turbocharger',
  },
];

async function run() {
  console.log(`\n🚀 Creating campaigns (TEST=${process.env.TEST})\n`);

  for (const persona of personas) {
    try {
      console.log(`▶ ${persona.name}`);

      const campaignId = await createCampaign({
        personaSlug: persona.slug,
        name: persona.name,
        dailyBudgetMicros: DAILY_BUDGET_MICROS,
        finalUrl: persona.finalUrl,
      });

      const adGroupId = await createAdGroup(
        campaignId,
        `${persona.name} — Main`,
        2_000_000, // $2.00 default CPC
      );

      console.log(`  ✅ Campaign: ${campaignId} | Ad Group: ${adGroupId}\n`);
    } catch (e: any) {
      console.error(`  ❌ Failed for ${persona.slug}:`, e.message);
      if (e.errors) e.errors.forEach((err: any) => console.error('   ', err.message, JSON.stringify(err.location?.field_path_elements)));
    }
  }

  await pool.end();
  console.log('Done.');
}

run().catch(e => {
  console.error(e.message);
  process.exit(1);
});

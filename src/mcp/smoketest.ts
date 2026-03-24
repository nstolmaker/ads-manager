/**
 * MCP server smoketest
 * Runs three checks:
 *   1. Logger + server instantiation + all 9 tools registered
 *   2. DB connection — lists campaigns from Postgres
 *   3. Google Ads API — lists campaigns via test account, then reads keyword count
 *
 * Safe to run anytime — uses TEST=1 for Google Ads (test account).
 * No destructive operations.
 */
process.env.TEST = '1'; // Use test Google Ads account

import { createServer } from './server.js';
import { logger } from '../utils/logger.js';
import { query } from '../db/pool.js';
import { listCampaigns } from '../google-ads/campaigns.js';
import { getCustomer } from '../google-ads/client.js';

const EXPECTED_TOOLS = [
  'create_campaign',
  'list_campaigns',
  'set_campaign_status',
  'set_campaign_budget',
  'add_keywords',
  'remove_keywords',
  'list_keywords',
  'create_ad',
  'get_performance',
];

let passed = 0;
let failed = 0;

function ok(msg: string) { console.log(`   ✅ ${msg}`); passed++; }
function fail(msg: string) { console.log(`   ❌ ${msg}`); failed++; }

console.log('=== MCP Server Smoketest ===\n');

// ── 1. Logger + server + tools ──────────────────────────
console.log('1. Logger, server instantiation, tool registration...');
logger.info('Logger OK');
logger.notice('Notice level OK');

let server: ReturnType<typeof createServer>;
try {
  server = createServer();
  ok('Server instantiated');
} catch (err: any) {
  fail(`Server creation failed: ${err.message}`);
  process.exit(1);
}

const registeredTools: string[] = Object.keys((server as any)._registeredTools ?? {});
let allToolsFound = true;
for (const tool of EXPECTED_TOOLS) {
  if (!registeredTools.includes(tool)) {
    fail(`Missing tool: ${tool}`);
    allToolsFound = false;
  }
}
if (allToolsFound) ok(`All ${EXPECTED_TOOLS.length} tools registered`);

// ── 2. DB connection ─────────────────────────────────────
console.log('\n2. Database connection...');
try {
  const rows = await query<{ id: number; name: string; google_campaign_id: string; status: string }>(
    'SELECT id, name, google_campaign_id, status FROM campaigns ORDER BY id'
  );
  if (rows.length === 0) {
    ok('DB connected (no campaigns in DB yet)');
  } else {
    ok(`DB connected — ${rows.length} campaign(s) in DB:`);
    for (const r of rows) {
      console.log(`      [${r.id}] ${r.name} (${r.google_campaign_id}) — ${r.status}`);
    }
  }
} catch (err: any) {
  fail(`DB connection failed: ${err.message}`);
}

// ── 3. Google Ads API (test account) ─────────────────────
console.log('\n3. Google Ads API (test account)...');
try {
  const campaigns = await listCampaigns();
  ok(`API connected — ${campaigns.length} campaign(s) in test account:`);
  for (const c of campaigns) {
    console.log(`      [${c.googleId}] ${c.name} — status:${c.status} budget:$${c.dailyBudgetUsd}/day impressions:${c.impressions} clicks:${c.clicks}`);
  }

  // Also query keyword count across all campaigns
  const customer = getCustomer();
  const kwRows = await customer.query(`
    SELECT ad_group_criterion.keyword.text, ad_group_criterion.status
    FROM ad_group_criterion
    WHERE ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.status != 'REMOVED'
  `);
  ok(`Keyword query OK — ${kwRows.length} active keyword(s) in test account`);
} catch (err: any) {
  fail(`Google Ads API failed: ${err.message}`);
}

// ── Summary ──────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);

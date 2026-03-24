/**
 * Migration 001: Remove phantom campaign IDs that were seeded for testing
 * but were never actually created in Google Ads.
 *
 * Phantom IDs: 23688917485, 23684245841, 23684245874
 * Real campaigns: 23667349863 (PMax "Campaign #1"), 23679050097 (Portland Search)
 */
import 'dotenv/config';
import { query } from '../pool.js';

const PHANTOM_GOOGLE_IDS = [
  '23688917485', // Noah Consulting — AI Department (never created)
  '23684245841', // Noah Consulting — Pressure Release (never created)
  '23684245874', // Noah Consulting — Turbocharger (never created)
];

console.log('Migration 001: Removing phantom campaign records...');

// Remove dependent records first (keyword_snapshots, ad_snapshots reference campaign_id)
const campaigns = await query<{ id: number; google_campaign_id: string; name: string }>(
  `SELECT id, google_campaign_id, name FROM campaigns WHERE google_campaign_id = ANY($1)`,
  [PHANTOM_GOOGLE_IDS],
);

if (campaigns.length === 0) {
  console.log('No phantom campaigns found — already clean.');
  process.exit(0);
}

const ids = campaigns.map(c => c.id);
console.log(`Found ${campaigns.length} phantom campaigns:`, campaigns.map(c => `${c.name} (${c.google_campaign_id})`));

// Delete dependent data
await query(`DELETE FROM keyword_snapshots WHERE campaign_id = ANY($1)`, [ids]);
await query(`DELETE FROM ad_snapshots WHERE campaign_id = ANY($1)`, [ids]);
await query(`DELETE FROM campaigns WHERE id = ANY($1)`, [ids]);

console.log(`✅ Deleted ${campaigns.length} phantom campaigns and their dependent records.`);
process.exit(0);

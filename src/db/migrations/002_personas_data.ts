/**
 * Migration 002: Add data (JSONB) and google_campaign_id to personas table
 */
import 'dotenv/config';
import { query } from '../pool.js';

console.log('Migration 002: Updating personas table...');

await query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'`);
await query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS google_campaign_id TEXT`);

console.log('  added: data JSONB');
console.log('  added: google_campaign_id TEXT');
console.log('OK');
process.exit(0);

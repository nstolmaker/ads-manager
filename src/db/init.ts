/**
 * init.ts — one-time database setup
 * Run: npx tsx src/db/init.ts
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function init() {
  console.log('[init] Connecting to database...');

  // Create database if it doesn't exist
  const adminPool = new (await import('pg')).Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: 'postgres',
  });

  const dbName = process.env.PG_DATABASE || 'ads_manager';
  const exists = await adminPool.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
  );
  if (exists.rows.length === 0) {
    await adminPool.query(`CREATE DATABASE ${dbName}`);
    console.log(`[init] Created database: ${dbName}`);
  } else {
    console.log(`[init] Database already exists: ${dbName}`);
  }
  await adminPool.end();

  // Run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('[init] Schema applied.');

  // Seed personas
  await pool.query(`
    INSERT INTO personas (slug, name, lp_url) VALUES
      ('ai-department',   'AI Department',   'https://noah.consulting/lp/ai-department'),
      ('pressure-release','Pressure Release', 'https://noah.consulting/lp/pressure-release'),
      ('turbocharger',    'Turbocharger',     'https://noah.consulting/lp/turbocharger')
    ON CONFLICT (slug) DO NOTHING
  `);
  console.log('[init] Personas seeded.');

  await pool.end();
  console.log('[init] Done. Database is ready.');
}

init().catch(e => {
  console.error('[init] Failed:', e.message);
  process.exit(1);
});

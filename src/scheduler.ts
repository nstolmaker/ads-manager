/**
 * scheduler.ts
 * pm2 entry point — runs the optimization loop on schedule
 * pm2 cron handles timing; this script runs once and exits
 */
import 'dotenv/config';
import { runOptimizationLoop } from './optimizer/loop.js';
import { pool } from './db/pool.js';

console.log('[scheduler] Ads Manager optimization run starting...');

runOptimizationLoop()
  .then(() => {
    console.log('[scheduler] Done.');
    pool.end();
  })
  .catch((e) => {
    console.error('[scheduler] Fatal error:', e.message);
    pool.end();
    process.exit(1);
  });

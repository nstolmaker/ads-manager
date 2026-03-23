/**
 * optimizer/loop.ts
 * Main optimization loop — runs per persona every 7 days
 * HITL mode: posts to #ads-manager @Claude, waits for approval via webhook
 */
import { query } from '../db/pool.js';
import { loadPersonaCampaigns, analyzePersona, formatAnalysisForDiscord } from './analyze.js';
import { notifyOptimizationRun } from '../discord/notify.js';
import 'dotenv/config';

const WEBHOOK_URL = `http://localhost:${process.env.WEBHOOK_PORT || 9722}/webhook/response`;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const MODE = process.env.MODE || 'hitl'; // hitl | auto

export async function runOptimizationLoop() {
  const runAt = new Date();
  console.log(`\n[loop] Starting optimization run — ${runAt.toISOString()} — mode=${MODE}`);

  const personas = await loadPersonaCampaigns();
  if (personas.length === 0) {
    console.log('[loop] No active personas found. Exiting.');
    return;
  }

  console.log(`[loop] Processing ${personas.length} personas`);

  for (const persona of personas) {
    console.log(`\n[loop] ─── ${persona.personaName} ───`);

    // 1. Create an optimization run record
    const [run] = await query<{ id: number }>(
      `INSERT INTO optimization_runs (persona_id, mode, status, run_date)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id`,
      [persona.personaId, MODE],
    );
    const runId = run.id;

    try {
      // 2. Analyze performance
      const ctx = await analyzePersona(persona);
      const analysisText = formatAnalysisForDiscord(ctx);

      // 3. Save analysis to DB
      await query(
        `UPDATE optimization_runs SET analysis = $1 WHERE id = $2`,
        [analysisText, runId],
      );

      // 4. Post to #ads-manager @Claude for reasoning + approval
      await notifyOptimizationRun({
        runId,
        personaName: persona.personaName,
        summary: analysisText,
        recommendations: [], // Claude will generate these
        webhookUrl: WEBHOOK_URL,
        webhookSecret: WEBHOOK_SECRET,
      });

      console.log(`[loop] Run #${runId} posted to Discord for ${persona.personaName}`);

      if (MODE === 'auto') {
        // Auto mode: Claude processes and calls webhook autonomously
        // (no waiting needed — Claude will POST back when ready)
        console.log(`[loop] Auto mode — Claude will respond and execute`);
      } else {
        console.log(`[loop] HITL mode — waiting for Noah's approval in Discord`);
      }

    } catch (e: any) {
      console.error(`[loop] Error processing ${persona.personaName}:`, JSON.stringify(e, null, 2));
      await query(
        `UPDATE optimization_runs SET status = 'skipped', notes = $1 WHERE id = $2`,
        [e.message, runId],
      );
    }

    // Small delay between personas to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n[loop] Run complete. Check #ads-manager for pending approvals.`);
}

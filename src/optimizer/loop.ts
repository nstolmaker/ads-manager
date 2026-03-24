/**
 * optimizer/loop.ts
 * Main optimization loop — runs per persona on a cron schedule.
 * Posts analysis to #ads-manager and tags Claude CLI, who then uses
 * MCP tools (add_keywords, set_campaign_budget, etc.) to act on it.
 * No webhook approval flow — Claude handles execution directly via MCP.
 */
import { query } from '../db/pool.js';
import { loadPersonaCampaigns, analyzePersona, formatAnalysisForDiscord } from './analyze.js';
import { notifyOptimizationRun } from '../discord/notify.js';
import { logger } from '../utils/logger.js';
import 'dotenv/config';

export async function runOptimizationLoop() {
  const runAt = new Date();
  logger.info(`[loop] Starting optimization run — ${runAt.toISOString()}`);

  const personas = await loadPersonaCampaigns();
  if (personas.length === 0) {
    logger.info('[loop] No active personas found. Exiting.');
    return;
  }

  logger.info(`[loop] Processing ${personas.length} persona(s)`);

  for (const persona of personas) {
    logger.info(`[loop] --- ${persona.personaName} ---`);

    const [run] = await query<{ id: number }>(
      `INSERT INTO optimization_runs (persona_id, mode, status, run_date)
       VALUES ($1, 'mcp', 'pending', NOW())
       RETURNING id`,
      [persona.personaId],
    );
    const runId = run.id;

    try {
      const ctx = await analyzePersona(persona);
      const analysisText = formatAnalysisForDiscord(ctx);

      await query(
        `UPDATE optimization_runs SET analysis = $1, status = 'posted' WHERE id = $2`,
        [analysisText, runId],
      );

      await notifyOptimizationRun({
        runId,
        personaName: persona.personaName,
        summary: analysisText,
        recommendations: [],
      });

      logger.info(`[loop] Run #${runId} posted to Discord for ${persona.personaName}`);

    } catch (e: any) {
      logger.error(`[loop] Error processing ${persona.personaName}: ${e.message}`);
      await query(
        `UPDATE optimization_runs SET status = 'error', notes = $1 WHERE id = $2`,
        [e.message, runId],
      );
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  logger.info(`[loop] Run complete.`);
}

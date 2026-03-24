/**
 * discord/webhook.ts
 * Express server that receives structured responses from Claude
 * Claude calls POST /webhook/response after interpreting Noah's approval in Discord
 */
import express from 'express';
import 'dotenv/config';
import { query } from '../db/pool.js';
import { executeRun } from '../optimizer/execute.js';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.WEBHOOK_PORT || '9722');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

export interface ApprovalPayload {
  run_id: number;
  action: 'propose' | 'approve' | 'reject' | 'approve_partial';
  recommendations?: any[];    // Claude posts these when proposing
  approved_items?: number[];  // indices of approved recommendations
  rejected_items?: number[];
  notes?: string;
  approved_by?: string;
}

// Handle proposal (Claude posting recommendations before approval)
async function handleProposal(runId: number, recommendations: any[]) {
  await query(
    `UPDATE optimization_runs SET recommendations = $1, status = 'pending' WHERE id = $2`,
    [JSON.stringify(recommendations), runId],
  );
  console.log(`[webhook] Stored ${recommendations.length} recommendations for run #${runId}`);
}

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'ads-manager-webhook', port: PORT });
});

app.post('/webhook/response', async (req, res) => {
  // Validate shared secret
  if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    console.warn('[webhook] Rejected — invalid secret');
    return res.sendStatus(403);
  }

  res.sendStatus(200); // Respond immediately

  const payload = req.body as ApprovalPayload;
  console.log(`[webhook] Received for run #${payload.run_id}: ${payload.action}`);

  // Handle proposal — Claude storing recommendations
  if (payload.action === 'propose' && payload.recommendations) {
    await handleProposal(payload.run_id, payload.recommendations);
    return;
  }

  try {
    const status = payload.action === 'approve' ? 'approved'
      : payload.action === 'reject' ? 'rejected'
      : 'approved'; // approve_partial counts as approved (with subset)

    await query(
      `UPDATE optimization_runs
       SET status = $1, approved_by = $2, notes = $3
       WHERE id = $4`,
      [status, payload.approved_by || 'claude', payload.notes || null, payload.run_id],
    );

    if (status === 'approved') {
      console.log(`[webhook] Run #${payload.run_id} approved — executing`);
      executeRun({
        runId: payload.run_id,
        approvedIndices: payload.approved_items ?? [],
        approvedBy: payload.approved_by || 'claude',
        notes: payload.notes,
      }).catch(e => console.error('[webhook] Execute error:', e.message));
    } else {
      console.log(`[webhook] Run #${payload.run_id} rejected`);
    }
  } catch (e: any) {
    console.error('[webhook] Failed to process approval:', e.message);
  }
});

app.listen(PORT, () => {
  console.log(`🔌 Ads Manager webhook listening on http://localhost:${PORT}`);
  console.log(`   POST /webhook/response — Claude approval callback`);
});

export default app;

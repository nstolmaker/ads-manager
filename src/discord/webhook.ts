/**
 * discord/webhook.ts
 * Express server that receives structured responses from Claude
 * Claude calls POST /webhook/response after interpreting Noah's approval in Discord
 */
import express from 'express';
import 'dotenv/config';
import { query } from '../db/pool.js';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.WEBHOOK_PORT || '9722');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

export interface ApprovalPayload {
  run_id: number;
  action: 'approve' | 'reject' | 'approve_partial';
  approved_items?: number[];  // indices of approved recommendations
  rejected_items?: number[];
  notes?: string;             // Claude's interpretation notes
  approved_by?: string;       // Discord username who approved
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
  console.log(`[webhook] Received approval for run #${payload.run_id}: ${payload.action}`);

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
      console.log(`[webhook] Run #${payload.run_id} approved — queuing execution`);
      // TODO: trigger execute.ts
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

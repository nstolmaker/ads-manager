/**
 * optimizer/execute.ts
 * Apply approved campaign changes to Google Ads API
 * Called by the webhook handler after Noah approves
 */
import { query, queryOne } from '../db/pool.js';
import { addKeywords, pauseKeywords, getKeywordResourceNames, getFirstAdGroupId } from '../google-ads/keywords.js';
import { createResponsiveSearchAd, pauseAd, updateCampaignBudget } from '../google-ads/ads.js';
import { notify } from '../discord/notify.js';

export type RecommendationAction =
  | { type: 'add_keywords';    keywords: string[]; }
  | { type: 'pause_keywords';  keywords: string[]; }
  | { type: 'create_ad';       headlines: string[]; descriptions: string[]; finalUrl: string; }
  | { type: 'pause_ad';        googleAdId: string; }
  | { type: 'update_budget';   dailyBudgetUsd: number; }
  | { type: 'seed_idea';       title: string; keywords: string[]; headlines: string[]; descriptions: string[]; finalUrl: string; rationale: string; };

export interface Recommendation {
  action: RecommendationAction;
  rationale: string;
}

export interface ExecutePayload {
  runId: number;
  approvedIndices: number[]; // which recommendations to execute (all if undefined)
  approvedBy: string;
  notes?: string;
}

/**
 * Execute approved recommendations for an optimization run
 */
export async function executeRun(payload: ExecutePayload): Promise<void> {
  const { runId, approvedIndices, approvedBy, notes } = payload;

  // Load the run
  const run = await queryOne<any>(
    `SELECT or2.*, c.google_campaign_id, p.lp_url, p.name AS persona_name
     FROM optimization_runs or2
     JOIN personas p ON p.id = or2.persona_id
     JOIN campaigns c ON c.persona_id = or2.persona_id AND c.status != 'removed'
     WHERE or2.id = $1`,
    [runId],
  );

  if (!run) throw new Error(`Run #${runId} not found`);
  if (!run.recommendations) {
    console.log(`[execute] Run #${runId} has no recommendations — nothing to execute`);
    return;
  }

  const allRecs: Recommendation[] = Array.isArray(run.recommendations)
    ? run.recommendations
    : JSON.parse(run.recommendations);

  const toExecute = approvedIndices?.length > 0
    ? allRecs.filter((_, i) => approvedIndices.includes(i))
    : allRecs;

  console.log(`\n[execute] Run #${runId} — executing ${toExecute.length}/${allRecs.length} recommendations`);

  const googleCampaignId = run.google_campaign_id;
  const adGroupId = await getFirstAdGroupId(googleCampaignId);
  if (!adGroupId) throw new Error(`No ad group found for campaign ${googleCampaignId}`);

  const results: string[] = [];

  for (const [i, rec] of toExecute.entries()) {
    try {
      const result = await executeOne(rec, googleCampaignId, adGroupId, run.lp_url, runId);
      results.push(`✅ ${result}`);
      console.log(`[execute] #${i + 1} ✅ ${result}`);
    } catch (e: any) {
      results.push(`❌ ${rec.action.type}: ${e.message}`);
      console.error(`[execute] #${i + 1} ❌ ${rec.action.type}:`, e.message);
    }
  }

  // Mark run as executed
  await query(
    `UPDATE optimization_runs
     SET status = 'executed', executed_at = NOW(), approved_by = $1, notes = $2
     WHERE id = $3`,
    [approvedBy, notes || null, runId],
  );

  // Post execution summary to Discord
  await notify({
    content: [
      `✅ **Run #${runId} executed** for **${run.persona_name}**`,
      ``,
      results.join('\n'),
    ].join('\n'),
    mentionClaude: false,
  });

  console.log(`[execute] Run #${runId} complete`);
}

/**
 * Execute a single recommendation
 */
async function executeOne(
  rec: Recommendation,
  googleCampaignId: string,
  adGroupId: string,
  lpUrl: string,
  runId: number,
): Promise<string> {
  const { action } = rec;

  switch (action.type) {
    case 'add_keywords': {
      const created = await addKeywords(googleCampaignId, adGroupId, action.keywords);
      return `Added ${created.length} keywords: ${action.keywords.slice(0, 3).join(', ')}${action.keywords.length > 3 ? '...' : ''}`;
    }

    case 'pause_keywords': {
      const rnMap = await getKeywordResourceNames(googleCampaignId, action.keywords);
      const rns = Object.values(rnMap);
      if (rns.length > 0) await pauseKeywords(rns);
      return `Paused ${rns.length} keywords: ${action.keywords.slice(0, 3).join(', ')}`;
    }

    case 'create_ad': {
      const adId = await createResponsiveSearchAd(adGroupId, {
        headlines: action.headlines,
        descriptions: action.descriptions,
        finalUrl: action.finalUrl || lpUrl,
      });
      return `Created RSA ad ${adId}`;
    }

    case 'pause_ad': {
      const cid = process.env.TEST === '1'
        ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
        : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;
      const rn = `customers/${cid}/adGroupAds/${adGroupId}~${action.googleAdId}`;
      await pauseAd(rn);
      return `Paused ad ${action.googleAdId}`;
    }

    case 'update_budget': {
      const micros = Math.round(action.dailyBudgetUsd * 1_000_000);
      await updateCampaignBudget(googleCampaignId, micros);
      return `Updated daily budget to $${action.dailyBudgetUsd.toFixed(2)}`;
    }

    case 'seed_idea': {
      // Create keywords + ad for seed idea, track in DB
      const created = await addKeywords(googleCampaignId, adGroupId, action.keywords);
      const adId = await createResponsiveSearchAd(adGroupId, {
        headlines: action.headlines,
        descriptions: action.descriptions,
        finalUrl: lpUrl,
      });
      await query(
        `INSERT INTO seed_ideas (persona_id, run_id, idea_text, rationale, status, approved_at)
         SELECT persona_id, $1, $2, $3, 'running', NOW()
         FROM optimization_runs WHERE id = $1`,
        [runId, action.title, rec.rationale],
      );
      return `Seed idea "${action.title}": ${created.length} keywords + ad ${adId}`;
    }

    default:
      throw new Error(`Unknown action type: ${(action as any).type}`);
  }
}

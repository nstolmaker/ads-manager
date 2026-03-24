/**
 * optimizer/analyze.ts
 * Pull performance data, snapshot to DB, build structured analysis context for Claude
 */
import { query, queryOne } from '../db/pool.js';
import { snapshotKeywords, snapshotAds, getCampaignSummary, lastNDays } from '../google-ads/reporting.js';
import { TimingTracker } from '../utils/timing.js';

export interface PersonaCampaign {
  personaId: number;
  personaSlug: string;
  personaName: string;
  lpUrl: string;
  campaignDbId: number;
  googleCampaignId: string;
}

export interface AnalysisContext {
  persona: PersonaCampaign;
  window: { startDate: string; endDate: string };
  summary: {
    impressions: number;
    clicks: number;
    conversions: number;
    costUsd: number;
    ctr: number;
    cpa: number;
  };
  topKeywords: any[];
  bottomKeywords: any[];
  topAds: any[];
  bottomAds: any[];
  hasData: boolean;
}

/**
 * Load all active persona campaigns from DB
 */
export async function loadPersonaCampaigns(): Promise<PersonaCampaign[]> {
  const rows = await query<any>(`
    SELECT
      p.id AS persona_id,
      p.slug AS persona_slug,
      p.name AS persona_name,
      p.lp_url,
      c.id AS campaign_db_id,
      c.google_campaign_id
    FROM personas p
    JOIN campaigns c ON c.persona_id = p.id
    WHERE p.status = 'active'
      AND c.status != 'removed'
    ORDER BY p.id
  `);

  return rows.map(r => ({
    personaId: r.persona_id,
    personaSlug: r.persona_slug,
    personaName: r.persona_name,
    lpUrl: r.lp_url,
    campaignDbId: r.campaign_db_id,
    googleCampaignId: r.google_campaign_id,
  }));
}

/**
 * Run a full analysis for one persona campaign:
 * 1. Pull performance data from Google Ads
 * 2. Save snapshots to DB
 * 3. Return structured context for Claude
 */
export async function analyzePersona(pc: PersonaCampaign): Promise<AnalysisContext> {
  const tracker = new TimingTracker();
  const window = lastNDays(7);

  console.log(`\n[analyze] ${pc.personaName} | ${window.startDate} → ${window.endDate}`);

  // Pull and snapshot keyword + ad data
  const [kwCount, adCount] = await Promise.all([
    tracker.track('snapshot_keywords', () =>
      snapshotKeywords(pc.personaId, pc.campaignDbId, pc.googleCampaignId, window),
    ),
    tracker.track('snapshot_ads', () =>
      snapshotAds(pc.personaId, pc.campaignDbId, pc.googleCampaignId, window),
    ),
  ]);

  console.log(`[analyze] Saved ${kwCount} keyword rows, ${adCount} ad rows`);

  // Pull campaign summary
  const summary = await tracker.track('campaign_summary', () =>
    getCampaignSummary(pc.googleCampaignId, window),
  );

  const hasData = summary.impressions > 0 || kwCount > 0;

  // Load top/bottom keywords from DB (last 7 days)
  const topKeywords = await query<any>(`
    SELECT keyword, match_type,
           SUM(impressions) AS impressions,
           SUM(clicks) AS clicks,
           SUM(conversions) AS conversions,
           SUM(cost_micros) / 1000000.0 AS cost_usd,
           CASE WHEN SUM(impressions) > 0
                THEN ROUND(SUM(clicks)::numeric / SUM(impressions) * 100, 2)
                ELSE 0 END AS ctr_pct
    FROM keyword_snapshots
    WHERE persona_id = $1
      AND snapshot_date >= $2
    GROUP BY keyword, match_type
    ORDER BY conversions DESC, clicks DESC
    LIMIT 10
  `, [pc.personaId, window.startDate]);

  const bottomKeywords = await query<any>(`
    SELECT keyword, match_type,
           SUM(impressions) AS impressions,
           SUM(clicks) AS clicks,
           SUM(conversions) AS conversions,
           SUM(cost_micros) / 1000000.0 AS cost_usd
    FROM keyword_snapshots
    WHERE persona_id = $1
      AND snapshot_date >= $2
    GROUP BY keyword, match_type
    HAVING SUM(impressions) > 5 AND SUM(conversions) = 0
    ORDER BY cost_usd DESC
    LIMIT 10
  `, [pc.personaId, window.startDate]);

  const topAds = await query<any>(`
    SELECT google_ad_id, headline_1, headline_2, description_1,
           SUM(impressions) AS impressions,
           SUM(clicks) AS clicks,
           SUM(conversions) AS conversions,
           CASE WHEN SUM(impressions) > 0
                THEN ROUND(SUM(clicks)::numeric / SUM(impressions) * 100, 2)
                ELSE 0 END AS ctr_pct
    FROM ad_snapshots
    WHERE persona_id = $1
      AND snapshot_date >= $2
    GROUP BY google_ad_id, headline_1, headline_2, description_1
    ORDER BY conversions DESC, ctr_pct DESC
    LIMIT 5
  `, [pc.personaId, window.startDate]);

  const bottomAds = await query<any>(`
    SELECT google_ad_id, headline_1, headline_2, description_1,
           SUM(impressions) AS impressions,
           SUM(clicks) AS clicks,
           SUM(conversions) AS conversions
    FROM ad_snapshots
    WHERE persona_id = $1
      AND snapshot_date >= $2
    GROUP BY google_ad_id, headline_1, headline_2, description_1
    HAVING SUM(impressions) > 10 AND SUM(conversions) = 0
    ORDER BY SUM(cost_micros) DESC
    LIMIT 5
  `, [pc.personaId, window.startDate]);

  tracker.log(`[analyze] ${pc.personaSlug} `);

  return {
    persona: pc,
    window,
    summary,
    topKeywords,
    bottomKeywords,
    topAds,
    bottomAds,
    hasData,
  };
}

/**
 * Format analysis context as markdown for Discord / Claude prompt
 */
export function formatAnalysisForDiscord(ctx: AnalysisContext): string {
  const { persona, window, summary, topKeywords, bottomKeywords, topAds, hasData } = ctx;

  const lines: string[] = [
    `## 📊 ${persona.personaName}`,
    `**Period:** ${window.startDate} → ${window.endDate}`,
    `**LP:** ${persona.lpUrl}`,
    ``,
  ];

  if (!hasData) {
    lines.push(`_No performance data yet — campaign is paused or too new._`);
    lines.push(``);
    lines.push(`**Recommended action:** Add keywords and activate campaign.`);
    return lines.join('\n');
  }

  lines.push(`**Summary:**`);
  lines.push(`- Impressions: ${summary.impressions.toLocaleString()}`);
  lines.push(`- Clicks: ${summary.clicks.toLocaleString()} (CTR: ${(summary.ctr * 100).toFixed(2)}%)`);
  lines.push(`- Conversions: ${summary.conversions}`);
  lines.push(`- Spend: $${summary.costUsd.toFixed(2)} | CPA: ${summary.conversions > 0 ? '$' + summary.cpa.toFixed(2) : 'N/A'}`);
  lines.push(``);

  if (topKeywords.length > 0) {
    lines.push(`**Top Keywords:**`);
    for (const kw of topKeywords.slice(0, 5)) {
      lines.push(`- \`[${kw.match_type}]\` ${kw.keyword} — ${kw.clicks} clicks, ${kw.conversions} conv`);
    }
    lines.push(``);
  }

  if (bottomKeywords.length > 0) {
    lines.push(`**Underperforming Keywords (spend, 0 conversions):**`);
    for (const kw of bottomKeywords.slice(0, 5)) {
      lines.push(`- \`[${kw.match_type}]\` ${kw.keyword} — $${Number(kw.cost_usd).toFixed(2)} spent, 0 conv`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}

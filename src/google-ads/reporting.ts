/**
 * google-ads/reporting.ts
 * Pull 7-day performance snapshots from Google Ads and save to DB
 */
import { getCustomer } from './client.js';
import { query } from '../db/pool.js';
import { TimingTracker } from '../utils/timing.js';

export interface PerformanceWindow {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/**
 * Get the last N days as a date window
 */
export function lastNDays(n = 7): PerformanceWindow {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - n);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { startDate: fmt(start), endDate: fmt(end) };
}

/**
 * Pull keyword performance for a campaign and save snapshots to DB
 */
export async function snapshotKeywords(
  personaId: number,
  campaignDbId: number,
  googleCampaignId: string,
  window: PerformanceWindow,
): Promise<number> {
  const tracker = new TimingTracker();
  const customer = getCustomer();

  const rows = await tracker.track('fetch_keywords', () =>
    customer.query(`
      SELECT
        keyword_view.resource_name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM keyword_view
      WHERE
        campaign.id = ${googleCampaignId}
        AND segments.date BETWEEN '${window.startDate}' AND '${window.endDate}'
    `),
  );

  if (rows.length === 0) {
    console.log(`[reporting] No keyword data for campaign ${googleCampaignId} (test account — expected)`);
    return 0;
  }

  let saved = 0;
  for (const row of rows) {
    const kw = row.ad_group_criterion?.keyword;
    const m = row.metrics;
    if (!kw?.text) continue;

    await query(
      `INSERT INTO keyword_snapshots
         (persona_id, campaign_id, keyword, match_type, impressions, clicks, conversions, cost_micros, snapshot_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        personaId,
        campaignDbId,
        kw.text,
        kw.match_type ?? 'EXACT',
        m?.impressions ?? 0,
        m?.clicks ?? 0,
        m?.conversions ?? 0,
        m?.cost_micros ?? 0,
        window.endDate,
      ],
    );
    saved++;
  }

  tracker.log(`[reporting] keywords campaign=${googleCampaignId} `);
  return saved;
}

/**
 * Pull ad performance for a campaign and save snapshots to DB
 */
export async function snapshotAds(
  personaId: number,
  campaignDbId: number,
  googleCampaignId: string,
  window: PerformanceWindow,
): Promise<number> {
  const tracker = new TimingTracker();
  const customer = getCustomer();

  const rows = await tracker.track('fetch_ads', () =>
    customer.query(`
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.status,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM ad_group_ad
      WHERE
        campaign.id = ${googleCampaignId}
        AND segments.date BETWEEN '${window.startDate}' AND '${window.endDate}'
    `),
  );

  if (rows.length === 0) {
    console.log(`[reporting] No ad data for campaign ${googleCampaignId} (test account — expected)`);
    return 0;
  }

  let saved = 0;
  for (const row of rows) {
    const ad = row.ad_group_ad?.ad;
    const rsa = ad?.responsive_search_ad;
    const m = row.metrics;
    if (!ad?.id) continue;

    const headlines = rsa?.headlines?.map((h: any) => h.text) ?? [];
    const descriptions = rsa?.descriptions?.map((d: any) => d.text) ?? [];

    await query(
      `INSERT INTO ad_snapshots
         (persona_id, campaign_id, google_ad_id, headline_1, headline_2, headline_3,
          description_1, description_2, impressions, clicks, conversions, cost_micros, snapshot_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        personaId,
        campaignDbId,
        String(ad.id),
        headlines[0] ?? null,
        headlines[1] ?? null,
        headlines[2] ?? null,
        descriptions[0] ?? null,
        descriptions[1] ?? null,
        m?.impressions ?? 0,
        m?.clicks ?? 0,
        m?.conversions ?? 0,
        m?.cost_micros ?? 0,
        window.endDate,
      ],
    );
    saved++;
  }

  tracker.log(`[reporting] ads campaign=${googleCampaignId} `);
  return saved;
}

/**
 * Pull campaign-level summary metrics
 */
export async function getCampaignSummary(
  googleCampaignId: string,
  window: PerformanceWindow,
): Promise<{
  impressions: number;
  clicks: number;
  conversions: number;
  costUsd: number;
  ctr: number;
  cpa: number;
}> {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr
    FROM campaign
    WHERE
      campaign.id = ${googleCampaignId}
      AND segments.date BETWEEN '${window.startDate}' AND '${window.endDate}'
  `);

  const totals = rows.reduce(
    (acc, r) => {
      acc.impressions += Number(r.metrics?.impressions ?? 0);
      acc.clicks += Number(r.metrics?.clicks ?? 0);
      acc.conversions += Number(r.metrics?.conversions ?? 0);
      acc.costMicros += Number(r.metrics?.cost_micros ?? 0);
      return acc;
    },
    { impressions: 0, clicks: 0, conversions: 0, costMicros: 0 },
  );

  const costUsd = totals.costMicros / 1_000_000;
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const cpa = totals.conversions > 0 ? costUsd / totals.conversions : 0;

  return { ...totals, costUsd, ctr, cpa };
}

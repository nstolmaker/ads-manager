/**
 * google-ads/campaigns.ts
 * Create, read, and manage campaigns per marketing persona
 */
import { getCustomer } from './client.js';
import { query, queryOne } from '../db/pool.js';

export interface CampaignConfig {
  personaSlug: string;       // 'ai-department' | 'pressure-release' | 'turbocharger'
  name: string;              // Human-readable campaign name
  dailyBudgetMicros: number; // Budget in micros (1 USD = 1,000,000 micros)
  finalUrl: string;          // Landing page URL
}

/**
 * Create a new Search campaign for a persona
 * Returns the Google Ads campaign ID
 */
export async function createCampaign(config: CampaignConfig): Promise<string> {
  const customer = getCustomer();

  // 1. Create a campaign budget
  const [budgetResult] = await customer.campaignBudgets.create([{
    name: `${config.name} Budget`,
    amount_micros: config.dailyBudgetMicros,
    delivery_method: 'STANDARD',
    explicitly_shared: false,
  }]);

  const budgetResourceName = budgetResult.results?.[0]?.resource_name;
  if (!budgetResourceName) throw new Error('Failed to create campaign budget');

  // 2. Create the campaign
  const [campaignResult] = await customer.campaigns.create([{
    name: config.name,
    status: 'PAUSED', // Start paused — activate when ready
    advertising_channel_type: 'SEARCH',
    campaign_budget: budgetResourceName,
    manual_cpc: {
      enhanced_cpc_enabled: false,
    },
    network_settings: {
      target_google_search: true,
      target_search_network: true,
      target_content_network: false,
      target_partner_search_network: false,
    },
    geo_target_type_setting: {
      positive_geo_target_type: 'PRESENCE_OR_INTEREST',
    },
  }]);

  const campaignResourceName = campaignResult.results?.[0]?.resource_name;
  if (!campaignResourceName) throw new Error('Failed to create campaign');

  // Extract numeric campaign ID from resource name (customers/xxx/campaigns/yyy)
  const googleCampaignId = campaignResourceName.split('/').pop()!;

  // 3. Persist to DB
  const persona = await queryOne<{ id: number }>(
    'SELECT id FROM personas WHERE slug = $1',
    [config.personaSlug],
  );
  if (!persona) throw new Error(`Persona not found: ${config.personaSlug}`);

  await query(
    `INSERT INTO campaigns (persona_id, google_campaign_id, name, status)
     VALUES ($1, $2, $3, 'paused')
     ON CONFLICT (google_campaign_id) DO NOTHING`,
    [persona.id, googleCampaignId, config.name],
  );

  console.log(`[campaigns] Created: ${config.name} (ID: ${googleCampaignId})`);
  return googleCampaignId;
}

/**
 * Create a default ad group inside a campaign
 */
export async function createAdGroup(
  googleCampaignId: string,
  name: string,
  defaultCpcMicros: number = 2_000_000, // $2.00 default CPC
): Promise<string> {
  const customer = getCustomer();

  const customerId = process.env.TEST === '1'
    ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
    : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;

  const campaignResourceName = `customers/${customerId}/campaigns/${googleCampaignId}`;

  const [result] = await customer.adGroups.create([{
    name,
    status: 'ENABLED',
    campaign: campaignResourceName,
    type: 'SEARCH_STANDARD',
    cpc_bid_micros: defaultCpcMicros,
  }]);

  const adGroupResourceName = result.results?.[0]?.resource_name;
  if (!adGroupResourceName) throw new Error('Failed to create ad group');

  const adGroupId = adGroupResourceName.split('/').pop()!;
  console.log(`[campaigns] Created ad group: ${name} (ID: ${adGroupId})`);
  return adGroupId;
}

/**
 * List all campaigns from DB with Google Ads status
 */
export async function listCampaigns() {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    ORDER BY campaign.name
  `);

  return rows.map(r => ({
    googleId: String(r.campaign?.id),
    name: r.campaign?.name,
    status: r.campaign?.status,
    dailyBudgetUsd: ((r.campaign_budget?.amount_micros ?? 0) / 1_000_000).toFixed(2),
    impressions: r.metrics?.impressions ?? 0,
    clicks: r.metrics?.clicks ?? 0,
    costUsd: ((r.metrics?.cost_micros ?? 0) / 1_000_000).toFixed(2),
  }));
}

/**
 * Pause or enable a campaign
 */
export async function setCampaignStatus(
  googleCampaignId: string,
  status: 'ENABLED' | 'PAUSED',
): Promise<void> {
  const customer = getCustomer();
  const customerId = process.env.TEST === '1'
    ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
    : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;

  await customer.campaigns.update([{
    resource_name: `customers/${customerId}/campaigns/${googleCampaignId}`,
    status,
  }]);

  await query(
    `UPDATE campaigns SET status = $1 WHERE google_campaign_id = $2`,
    [status.toLowerCase(), googleCampaignId],
  );

  console.log(`[campaigns] ${googleCampaignId} → ${status}`);
}

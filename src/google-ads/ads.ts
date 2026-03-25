/**
 * google-ads/ads.ts
 * Create and manage responsive search ads
 */
import { adsRequest } from './rest.js';
import 'dotenv/config';

const customerId = () => process.env.TEST === '1'
  ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
  : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;

export interface RSAHeadline {
  text: string;
  pinnedField?: "HEADLINE_1" | "HEADLINE_2" | "HEADLINE_3";
}
export interface RSADescription {
  text: string;
  pinnedField?: "DESCRIPTION_1" | "DESCRIPTION_2";
}
export interface RSASpec {
  headlines: (string | RSAHeadline)[];
  descriptions: (string | RSADescription)[];
  finalUrl: string;
}

/**
 * Create a responsive search ad in an ad group
 */
export async function createResponsiveSearchAd(
  adGroupId: string,
  spec: RSASpec,
): Promise<string> {
  const cid = customerId();
  const adGroupResourceName = `customers/${cid}/adGroups/${adGroupId}`;

  const result = await adsRequest('/adGroupAds:mutate', 'POST', {
    operations: [{
      create: {
        adGroup: adGroupResourceName,
        status: 'ENABLED',
        ad: {
          finalUrls: [spec.finalUrl],
          responsiveSearchAd: {
            headlines: spec.headlines.map(h =>
              typeof h === "string" ? { text: h } : { text: h.text, ...(h.pinnedField ? { pinnedField: h.pinnedField } : {}) }
            ),
            descriptions: spec.descriptions.map(d =>
              typeof d === "string" ? { text: d } : { text: d.text, ...(d.pinnedField ? { pinnedField: d.pinnedField } : {}) }
            ),
          },
        },
      },
    }],
  });

  const resourceName = result?.results?.[0]?.resourceName;
  if (!resourceName) throw new Error(`Failed to create RSA: ${JSON.stringify(result)}`);

  const adId = resourceName.split('~').pop()!;
  console.log(`[ads] Created RSA ${adId} in ad group ${adGroupId}`);
  return adId;
}

/**
 * Pause an ad by resource name
 */
export async function pauseAd(resourceName: string): Promise<void> {
  await adsRequest('/adGroupAds:mutate', 'POST', {
    operations: [{
      update: {
        resourceName,
        status: 'PAUSED',
      },
      updateMask: 'status',
    }],
  });
  console.log(`[ads] Paused ad: ${resourceName}`);
}

/**
 * Update campaign daily budget
 */
export async function updateCampaignBudget(
  googleCampaignId: string,
  newDailyBudgetMicros: number,
): Promise<void> {
  // First get the budget resource name
  const { getCustomer } = await import('./client.js');
  const customer = getCustomer();
  const rows = await customer.query(`
    SELECT campaign_budget.resource_name
    FROM campaign
    WHERE campaign.id = ${googleCampaignId}
  `);

  const budgetRn = rows[0]?.campaign_budget?.resource_name;
  if (!budgetRn) throw new Error(`No budget found for campaign ${googleCampaignId}`);

  await adsRequest('/campaignBudgets:mutate', 'POST', {
    operations: [{
      update: {
        resourceName: budgetRn,
        amountMicros: String(newDailyBudgetMicros),
      },
      updateMask: 'amountMicros',
    }],
  });

  console.log(`[ads] Updated budget for campaign ${googleCampaignId}: $${(newDailyBudgetMicros / 1_000_000).toFixed(2)}/day`);
}


/**
 * google-ads/keywords.ts
 * Add, pause, and remove keywords from ad groups
 */
import { adsRequest } from './rest.js';
import { getCustomer } from './client.js';
import 'dotenv/config';

const customerId = () => process.env.TEST === '1'
  ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
  : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;

/**
 * Get the first ad group ID for a campaign
 */
export async function getFirstAdGroupId(googleCampaignId: string): Promise<string | null> {
  const customer = getCustomer();
  const rows = await customer.query(`
    SELECT ad_group.id, ad_group.name
    FROM ad_group
    WHERE campaign.id = ${googleCampaignId}
      AND ad_group.status != 'REMOVED'
    ORDER BY ad_group.id
    LIMIT 1
  `);
  const id = rows[0]?.ad_group?.id;
  return id ? String(id) : null;
}

/**
 * Add exact-match keywords to an ad group
 */
export async function addKeywords(
  googleCampaignId: string,
  adGroupId: string,
  keywords: string[],
): Promise<string[]> {
  const cid = customerId();
  const adGroupResourceName = `customers/${cid}/adGroups/${adGroupId}`;

  const operations = keywords.map(kw => ({
    create: {
      adGroup: adGroupResourceName,
      status: 'ENABLED',
      keyword: {
        text: kw,
        matchType: 'EXACT',
      },
    },
  }));

  const result = await adsRequest('/adGroupCriteria:mutate', 'POST', {
    operations,
    partialFailure: true,
  });

  const created = (result.results ?? [])
    .map((r: any) => r.resourceName)
    .filter(Boolean);

  if (result.partialFailureError) {
    console.warn('[keywords] Partial failure:', JSON.stringify(result.partialFailureError));
  }

  console.log(`[keywords] Added ${created.length}/${keywords.length} keywords to ad group ${adGroupId}`);
  return created;
}

/**
 * Pause keywords by resource name
 */
export async function pauseKeywords(resourceNames: string[]): Promise<void> {
  if (resourceNames.length === 0) return;

  const operations = resourceNames.map(rn => ({
    update: {
      resourceName: rn,
      status: 'PAUSED',
    },
    updateMask: 'status',
  }));

  await adsRequest('/adGroupCriteria:mutate', 'POST', {
    operations,
    partialFailure: true,
  });

  console.log(`[keywords] Paused ${resourceNames.length} keywords`);
}

/**
 * Get keyword resource names by keyword text for a campaign
 */
export async function getKeywordResourceNames(
  googleCampaignId: string,
  keywordTexts: string[],
): Promise<Record<string, string>> {
  const customer = getCustomer();
  const textList = keywordTexts.map(k => `'${k}'`).join(',');

  const rows = await customer.query(`
    SELECT
      ad_group_criterion.resource_name,
      ad_group_criterion.keyword.text
    FROM ad_group_criterion
    WHERE campaign.id = ${googleCampaignId}
      AND ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.keyword.text IN (${textList})
  `);

  const map: Record<string, string> = {};
  for (const row of rows) {
    const text = row.ad_group_criterion?.keyword?.text;
    const rn = row.ad_group_criterion?.resource_name;
    if (text && rn) map[text] = rn;
  }
  return map;
}

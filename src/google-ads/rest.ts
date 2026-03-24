/**
 * google-ads/rest.ts
 * Thin REST client for Google Ads API v19
 * Used for operations not yet supported by the SDK (e.g. contains_eu_political_advertising)
 */
import 'dotenv/config';

const API_VERSION = 'v23';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}/customers`;

let _accessToken: string | null = null;
let _tokenExpiry = 0;

/**
 * Get a valid OAuth2 access token, refreshing if needed
 */
async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) {
    return _accessToken;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json() as any;
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in * 1000);
  return _accessToken!;
}

/**
 * Make an authenticated Google Ads REST API call
 */
export async function adsRequest(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: any,
): Promise<any> {
  const useTest = process.env.TEST === '1';
  const customerId = useTest
    ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
    : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;
  const mccId = useTest
    ? process.env.TEST_GOOGLE_ADS_MCC_CUSTOMER_ID!
    : process.env.GOOGLE_ADS_MCC_CUSTOMER_ID!;

  const token = await getAccessToken();
  const url = path.startsWith('http') ? path : `${BASE_URL}/${customerId}${path}`;

  // console.log(`[rest] ${method} ${url}`);
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      'login-customer-id': mccId,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await res.text();
  let json: any;
  try { json = JSON.parse(rawText); } catch { throw new Error(`Non-JSON response (${res.status}): ${rawText.substring(0, 200)}`); }
  if (!res.ok) {
    const errMsg = json?.error?.details?.[0]?.errors?.[0]?.message
      || json?.error?.message
      || JSON.stringify(json);
    throw new Error(`Google Ads REST ${method} ${path} failed (${res.status}): ${errMsg}`);
  }

  return json;
}

/**
 * Create a campaign via REST (supports contains_eu_political_advertising)
 */
export async function createCampaignRest(campaign: {
  name: string;
  budgetResourceName: string;
  dailyBudgetMicros?: number;
}): Promise<string> {
  const useTest = process.env.TEST === '1';
  const customerId = useTest
    ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
    : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;

  const result = await adsRequest('/campaigns:mutate', 'POST', {
    operations: [{
      create: {
        name: campaign.name,
        status: 'PAUSED',
        advertisingChannelType: 'SEARCH',
        campaignBudget: campaign.budgetResourceName,
        manualCpc: { enhancedCpcEnabled: false },
        networkSettings: {
          targetGoogleSearch: true,
          targetSearchNetwork: true,
          targetContentNetwork: false,
          targetPartnerSearchNetwork: false,
        },
        geoTargetTypeSetting: {
          positiveGeoTargetType: 'PRESENCE_OR_INTEREST',
        },
        containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
      },
    }],
  });

  const resourceName = result?.results?.[0]?.resourceName;
  if (!resourceName) throw new Error(`No resource name in campaign create response: ${JSON.stringify(result)}`);

  // Extract ID from customers/xxx/campaigns/yyy
  return resourceName.split('/').pop()!;
}

/**
 * Create a campaign budget via REST
 */
export async function createBudgetRest(name: string, dailyBudgetMicros: number): Promise<string> {
  const result = await adsRequest('/campaignBudgets:mutate', 'POST', {
    operations: [{
      create: {
        name,
        amountMicros: String(dailyBudgetMicros),
        deliveryMethod: 'STANDARD',
        explicitlyShared: false,
      },
    }],
  });

  const resourceName = result?.results?.[0]?.resourceName;
  if (!resourceName) throw new Error(`No resource name in budget create response: ${JSON.stringify(result)}`);

  return resourceName; // full resource name needed for campaign link
}

/**
 * google-ads/client.ts
 * Shared authenticated Google Ads customer instance
 * Set TEST=1 env var to use test account credentials
 */
import { GoogleAdsApi, Customer } from 'google-ads-api';
import 'dotenv/config';

const useTest = process.env.TEST === '1';

export const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
});

export function getCustomer(): Customer {
  const accountId = useTest
    ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
    : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;

  const mccId = useTest
    ? process.env.TEST_GOOGLE_ADS_MCC_CUSTOMER_ID!
    : process.env.GOOGLE_ADS_MCC_CUSTOMER_ID!;

  return googleAdsClient.Customer({
    customer_id: accountId,
    login_customer_id: mccId,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });
}

export const isTestMode = useTest;
export const accountId = useTest
  ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!
  : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;

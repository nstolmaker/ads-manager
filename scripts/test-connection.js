/**
 * scripts/test-connection.ts
 *
 * Verifies Google Ads API connectivity.
 * Set TEST=1 to use test account credentials.
 * Run: npx tsx scripts/test-connection.ts
 * Run (test): TEST=1 npx tsx scripts/test-connection.ts
 */
import { GoogleAdsApi } from 'google-ads-api';
import 'dotenv/config';
const useTest = process.env.TEST === '1';
const mccId = useTest
    ? process.env.TEST_GOOGLE_ADS_MCC_CUSTOMER_ID
    : process.env.GOOGLE_ADS_MCC_CUSTOMER_ID;
const accountId = useTest
    ? process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID
    : process.env.GOOGLE_ADS_ACCOUNT_CUSTOMER_ID;
console.log(`\n🔌 Testing Google Ads API (${useTest ? 'TEST' : 'PRODUCTION'} account)...`);
console.log(`   MCC: ${mccId} | Account: ${accountId}\n`);
const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});
const customer = client.Customer({
    customer_id: accountId,
    login_customer_id: mccId,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});
async function test() {
    // Account info
    const [account] = await customer.query(`
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone,
      customer.test_account
    FROM customer
    LIMIT 1
  `);
    if (account) {
        console.log(`✅ Connected!`);
        console.log(`   Account: ${account.customer?.descriptive_name}`);
        console.log(`   ID: ${account.customer?.id}`);
        console.log(`   Currency: ${account.customer?.currency_code}`);
        console.log(`   Timezone: ${account.customer?.time_zone}`);
        console.log(`   Test account: ${account.customer?.test_account}`);
    }
    // Campaigns
    const campaigns = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status
    FROM campaign
    ORDER BY campaign.name
    LIMIT 10
  `);
    if (campaigns.length === 0) {
        console.log('\n📋 No campaigns yet.');
    }
    else {
        console.log(`\n📋 Campaigns (${campaigns.length}):`);
        for (const row of campaigns) {
            console.log(`   • [${row.campaign?.id}] ${row.campaign?.name} — ${row.campaign?.status}`);
        }
    }
    console.log('\n✅ All checks passed.\n');
}
test().catch(e => {
    console.error('\n❌ Connection failed:', e.message);
    if (e.errors) {
        for (const err of e.errors) {
            console.error('  ', err.message);
        }
    }
    process.exit(1);
});
//# sourceMappingURL=test-connection.js.map
import 'dotenv/config';
import { getCustomer } from '../src/google-ads/client.js';

const customer = getCustomer();
const customerId = process.env.TEST_GOOGLE_ADS_ACCOUNT_CUSTOMER_ID!;

async function run() {
  // First create a real budget (needed for campaign resource name)
  let budgetResourceName: string;
  try {
    const budgetRes = await customer.campaignBudgets.create([{
      name: 'Test Budget Debug',
      amount_micros: 10_000_000,
      delivery_method: 'STANDARD',
      explicitly_shared: false,
    }]);
    budgetResourceName = (budgetRes as any).results?.[0]?.resource_name;
    console.log('Budget created:', budgetResourceName);
  } catch(e: any) {
    console.log('Budget error:', e.message);
    e.errors?.forEach((err: any) => console.log('  field:', JSON.stringify(err.location?.field_path_elements), 'msg:', err.message));
    return;
  }

  // Now try minimal campaign
  try {
    const result = await customer.campaigns.create([{
      name: 'Test Campaign Debug',
      status: 'PAUSED',
      advertising_channel_type: 'SEARCH',
      campaign_budget: budgetResourceName!,
      manual_cpc: { enhanced_cpc_enabled: false },
      network_settings: {
        target_google_search: true,
        target_search_network: false,
        target_content_network: false,
        target_partner_search_network: false,
      },
      contains_eu_political_advertising: false,
    } as any], { validate_only: true });
    console.log('Campaign validate_only result:', JSON.stringify(result, null, 2));
  } catch(e: any) {
    console.log('Campaign error:', e.message);
    e.errors?.forEach((err: any) => console.log('  field:', JSON.stringify(err.location?.field_path_elements), 'msg:', err.message));
  }
}

run().catch(console.error);

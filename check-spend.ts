import 'dotenv/config';
import { getCustomer } from './src/google-ads/client.js';

const customer = getCustomer();
const rows = await customer.query(`
  SELECT campaign.name, metrics.cost_micros, metrics.impressions
  FROM campaign
  WHERE segments.date DURING TODAY
    AND campaign.id IN (23692337179, 23687649518, 23692336765)
`);
const dark = rows.filter((r: any) => (r.metrics?.cost_micros as number) === 0);
if (dark.length > 0) {
  console.log('ALERT:' + dark.map((r: any) => r.campaign?.name).join(', '));
} else {
  console.log('OK');
}

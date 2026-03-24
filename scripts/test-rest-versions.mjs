import { config } from 'dotenv';
config();

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  })
});
const {access_token} = await tokenRes.json();
console.log('token ok:', !!access_token);

for (const v of ['v23', 'v22', 'v21', 'v20', 'v19', 'v18']) {
  const r = await fetch(`https://googleads.googleapis.com/${v}/customers/9718750892/campaignBudgets:mutate`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + access_token,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': process.env.TEST_GOOGLE_ADS_MCC_CUSTOMER_ID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      operations: [{create: {name: 'T', amountMicros: '1000000', deliveryMethod: 'STANDARD', explicitlyShared: false}}]
    })
  });
  const t = await r.text();
  console.log(v, r.status, t.substring(0, 120));
}

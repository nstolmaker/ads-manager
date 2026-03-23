/**
 * scripts/get-refresh-token.ts
 *
 * One-time OAuth flow to get a Google Ads refresh token.
 * Run: npx tsx scripts/get-refresh-token.ts
 *
 * Works with Desktop app OAuth clients (no redirect URI registration needed).
 * 1. Opens browser to Google consent screen
 * 2. Google redirects to localhost — browser shows "connection refused", that's fine
 * 3. Copy the full URL from your browser's address bar and paste it here
 * 4. Script extracts the code and exchanges it for a refresh token
 */

import { exec } from 'child_process';
import * as readline from 'readline';
import 'dotenv/config';

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!;
const REDIRECT_URI = 'http://localhost';
const SCOPES = 'https://www.googleapis.com/auth/adwords';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET in .env');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent'); // forces refresh_token to be returned

console.log('\n🔐 Google Ads OAuth Flow');
console.log('Opening browser...\n');

exec(`start "" "${authUrl.toString()}"`);

console.log('After you approve access, your browser will redirect to localhost');
console.log('and show a "connection refused" error — that\'s expected.\n');
console.log('Copy the FULL URL from your browser address bar and paste it below.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste the full redirect URL here: ', async (input) => {
  rl.close();

  let code: string | null = null;
  try {
    const url = new URL(input.trim());
    code = url.searchParams.get('code');
  } catch {
    console.error('❌ Could not parse URL. Make sure you pasted the full URL.');
    process.exit(1);
  }

  if (!code) {
    console.error('❌ No "code" parameter found in URL.');
    process.exit(1);
  }

  console.log('\n✅ Code received, exchanging for tokens...');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json() as any;

  if (tokens.error) {
    console.error('\n❌ Token exchange failed:', tokens.error_description || tokens.error);
    process.exit(1);
  }

  console.log('\n✅ Got tokens!\n');
  console.log('─'.repeat(60));
  console.log('GOOGLE_ADS_REFRESH_TOKEN=' + tokens.refresh_token);
  console.log('─'.repeat(60));
  console.log('\nAdd the above line to your .env file.\n');

  if (!tokens.refresh_token) {
    console.warn('⚠️  No refresh_token returned. If you previously authorized this app,');
    console.warn('   revoke it at: https://myaccount.google.com/permissions');
    console.warn('   Then run this script again.\n');
  }
});

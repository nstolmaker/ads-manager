/**
 * scripts/get-refresh-token.ts
 *
 * One-time OAuth flow to get a Google Ads refresh token.
 * Run: npx tsx scripts/get-refresh-token.ts
 *
 * 1. Opens your browser to Google's OAuth consent screen
 * 2. Listens on localhost:8080 for the callback
 * 3. Exchanges the auth code for tokens
 * 4. Prints the refresh token — paste it into your .env
 */

import http from 'http';
import { exec } from 'child_process';
import 'dotenv/config';

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!;
const REDIRECT_URI = 'http://localhost:8080/oauth/callback';
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
console.log('If browser does not open, visit:\n', authUrl.toString(), '\n');

// Open browser (Windows)
exec(`start "" "${authUrl.toString()}"`);

// Local callback server
const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth/callback')) {
    res.end('Not found');
    return;
  }

  const url = new URL(req.url, 'http://localhost:8080');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.end(`<h2>Error: ${error}</h2>`);
    console.error('\n❌ OAuth error:', error);
    server.close();
    return;
  }

  if (!code) {
    res.end('<h2>No code received</h2>');
    server.close();
    return;
  }

  console.log('✅ Auth code received, exchanging for tokens...');

  // Exchange code for tokens
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
    res.end(`<h2>Token exchange failed: ${tokens.error_description}</h2>`);
    console.error('\n❌ Token exchange failed:', tokens);
    server.close();
    return;
  }

  res.end('<h2>✅ Success! You can close this tab and check your terminal.</h2>');

  console.log('\n✅ Got tokens!\n');
  console.log('─'.repeat(60));
  console.log('GOOGLE_ADS_REFRESH_TOKEN=' + tokens.refresh_token);
  console.log('─'.repeat(60));
  console.log('\nAdd the above line to your .env file.\n');

  if (!tokens.refresh_token) {
    console.warn('⚠️  No refresh_token returned. This can happen if you already');
    console.warn('   authorized this app. Revoke access at:');
    console.warn('   https://myaccount.google.com/permissions');
    console.warn('   Then run this script again.\n');
  }

  server.close();
});

server.listen(8080, () => {
  console.log('Listening on http://localhost:8080 for OAuth callback...');
});

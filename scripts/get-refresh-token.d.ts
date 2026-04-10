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
import 'dotenv/config';
//# sourceMappingURL=get-refresh-token.d.ts.map
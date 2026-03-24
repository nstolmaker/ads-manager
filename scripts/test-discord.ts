/**
 * scripts/test-discord.ts
 * Verify the bot can post to #ads-manager with @mention
 * Run: npx tsx scripts/test-discord.ts
 */
import 'dotenv/config';
import { notify } from '../src/discord/notify.js';

async function test() {
  console.log('Testing Discord bot @mention...');
  const msgId = await notify({
    content: 'Test @mention — does this ping you?',
    mentionClaude: true,
  });
  console.log(`✅ Posted message ID: ${msgId}`);
}

test().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});

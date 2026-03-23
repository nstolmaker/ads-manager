/**
 * scripts/test-discord.ts
 * Verify the bot can post to #ads-manager
 * Run: npx tsx scripts/test-discord.ts
 */
import 'dotenv/config';
import { notify } from '../src/discord/notify.js';

async function test() {
  console.log('Testing Discord bot...');
  const msgId = await notify({
    content: '👋 Ads Manager bot online. Test message — ignore this.',
    mentionClaude: false,
  });
  console.log(`✅ Posted message ID: ${msgId}`);
}

test().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});

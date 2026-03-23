/**
 * discord/notify.ts
 * Posts messages to #ads-manager via Discord bot REST API
 * @mentions Claude so OpenClaw routes the message to the agent
 */
import 'dotenv/config';

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID!; // #ads-manager
const CLAUDE_USER_ID = '1476805236977832020'; // Claude's Discord user ID

export interface NotifyOptions {
  content: string;
  mentionClaude?: boolean;  // default true
  embeds?: DiscordEmbed[];
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

/**
 * Post a message to #ads-manager
 */
export async function notify(options: NotifyOptions): Promise<string> {
  const mention = options.mentionClaude !== false ? `<@${CLAUDE_USER_ID}> ` : '';
  const content = `${mention}${options.content}`;

  const body: any = { content };
  if (options.embeds?.length) {
    body.embeds = options.embeds;
  }

  const res = await fetch(`${DISCORD_API}/channels/${CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[discord] Failed to post message: ${res.status} ${err}`);
  }

  const msg = await res.json() as { id: string };
  console.log(`[discord] Posted message ${msg.id} to #ads-manager`);
  return msg.id;
}

/**
 * Post an optimization run summary to #ads-manager
 */
export async function notifyOptimizationRun(opts: {
  runId: number;
  personaName: string;
  summary: string;
  recommendations: any[];
  seedIdea?: any;
  webhookUrl: string;
  webhookSecret: string;
}): Promise<string> {
  const recCount = opts.recommendations.length;
  const seedLine = opts.seedIdea
    ? `\n🌱 **Seed idea:** ${opts.seedIdea.title}`
    : '';

  const content = [
    `📊 **Optimization Run #${opts.runId} — ${opts.personaName}**`,
    ``,
    opts.summary,
    ``,
    `**${recCount} recommendation${recCount !== 1 ? 's' : ''} pending your approval.**${seedLine}`,
    ``,
    `Reply with your decision. I'll interpret it and execute approved changes.`,
    ``,
    `\`\`\`json`,
    `{ "run_id": ${opts.runId}, "webhook": "${opts.webhookUrl}", "secret": "${opts.webhookSecret}" }`,
    `\`\`\``,
  ].join('\n');

  return notify({ content });
}

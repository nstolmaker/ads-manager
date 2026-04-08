/**
 * mcp/server.ts
 * MCP server exposing Google Ads management tools
 */
import 'dotenv/config';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../utils/logger.js';
import { notify } from '../discord/notify.js';
import {
  createCampaign,
  createAdGroup,
  listCampaigns,
  setCampaignStatus,
} from '../google-ads/campaigns.js';
import { updateCampaignBudget } from '../google-ads/ads.js';
import {
  createResponsiveSearchAd,
  type RSASpec,
} from '../google-ads/ads.js';
import {
  getFirstAdGroupId,
  addKeywords,
  getKeywordResourceNames,
  pauseKeywords,
} from '../google-ads/keywords.js';
import { getCustomer } from '../google-ads/client.js';
import { getKeywordMetrics } from '../google-ads/keyword-planner.js';
import { getDomainPaidKeywords, getDomainPpcCompetitors, getKeywordStats } from '../google-ads/spyfu.js';
import { query } from '../db/pool.js';

const NOAH_DISCORD_ID = '626600779666423819';

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'ads-manager', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  // ── Campaign tools ──────────────────────────────────────

  server.registerTool(
    'create_campaign',
    {
      description: 'Create a new Google Ads search campaign for a persona',
      inputSchema: {
        personaSlug: z.string().describe('Persona slug: ai-department, pressure-release, or turbocharger'),
        name: z.string().describe('Human-readable campaign name'),
        dailyBudgetUsd: z.number().describe('Daily budget in USD'),
        finalUrl: z.string().describe('Landing page URL'),
      },
    },
    async ({ personaSlug, name, dailyBudgetUsd, finalUrl }) => {
      try {
        const dailyBudgetMicros = Math.round(dailyBudgetUsd * 1_000_000);
        const googleCampaignId = await createCampaign({
          personaSlug,
          name,
          dailyBudgetMicros,
          finalUrl,
        });
        const adGroupId = await createAdGroup(googleCampaignId, `${name} — Ad Group 1`);
        logger.info(`Created campaign ${googleCampaignId} with ad group ${adGroupId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify({ googleCampaignId, adGroupId }) }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error creating campaign: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_campaigns',
    {
      description: 'List all Google Ads campaigns with status and metrics',
    },
    async () => {
      try {
        const campaigns = await listCampaigns();
        return { content: [{ type: 'text', text: JSON.stringify(campaigns, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error listing campaigns: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'set_campaign_status',
    {
      description: 'Enable or pause a Google Ads campaign',
      inputSchema: {
        googleCampaignId: z.string().describe('Google Ads campaign ID'),
        status: z.enum(['ENABLED', 'PAUSED']).describe('New campaign status'),
      },
    },
    async ({ googleCampaignId, status }) => {
      try {
        await setCampaignStatus(googleCampaignId, status);
        return { content: [{ type: 'text', text: `Campaign ${googleCampaignId} set to ${status}` }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error setting status: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'set_campaign_budget',
    {
      description: 'Update daily budget for a Google Ads campaign. Notifies Noah on Discord.',
      inputSchema: {
        googleCampaignId: z.string().describe('Google Ads campaign ID'),
        dailyBudgetUsd: z.number().describe('New daily budget in USD'),
      },
    },
    async ({ googleCampaignId, dailyBudgetUsd }) => {
      try {
        const micros = Math.round(dailyBudgetUsd * 1_000_000);
        await updateCampaignBudget(googleCampaignId, micros);

        const msg = `Budget updated: campaign ${googleCampaignId} → $${dailyBudgetUsd.toFixed(2)}/day`;
        logger.notice(msg);
        await notify({
          content: `<@${NOAH_DISCORD_ID}> ${msg}`,
          mentionClaude: false,
        });

        return { content: [{ type: 'text', text: msg }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error setting budget: ${err.message}` }], isError: true };
      }
    },
  );

  // ── Keyword tools ───────────────────────────────────────

  server.registerTool(
    'add_keywords',
    {
      description: 'Add exact-match keywords to a campaign',
      inputSchema: {
        googleCampaignId: z.string().describe('Google Ads campaign ID'),
        keywords: z.array(z.string()).describe('Keywords to add'),
      },
    },
    async ({ googleCampaignId, keywords }) => {
      try {
        const adGroupId = await getFirstAdGroupId(googleCampaignId);
        if (!adGroupId) {
          return { content: [{ type: 'text', text: `No ad group found for campaign ${googleCampaignId}` }], isError: true };
        }
        const created = await addKeywords(googleCampaignId, adGroupId, keywords);
        return { content: [{ type: 'text', text: JSON.stringify({ added: created.length, resourceNames: created }) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error adding keywords: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'remove_keywords',
    {
      description: 'Pause (remove) keywords from a campaign by text',
      inputSchema: {
        googleCampaignId: z.string().describe('Google Ads campaign ID'),
        keywords: z.array(z.string()).describe('Keyword texts to remove'),
      },
    },
    async ({ googleCampaignId, keywords }) => {
      try {
        const rnMap = await getKeywordResourceNames(googleCampaignId, keywords);
        const resourceNames = Object.values(rnMap);
        if (resourceNames.length === 0) {
          return { content: [{ type: 'text', text: 'No matching keywords found to remove' }] };
        }
        await pauseKeywords(resourceNames);
        return { content: [{ type: 'text', text: JSON.stringify({ paused: resourceNames.length, keywords: Object.keys(rnMap) }) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error removing keywords: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_keywords',
    {
      description: 'List active keywords for a campaign',
      inputSchema: {
        googleCampaignId: z.string().describe('Google Ads campaign ID'),
      },
    },
    async ({ googleCampaignId }) => {
      try {
        const customer = getCustomer();
        const rows = await customer.query(`
          SELECT
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros
          FROM keyword_view
          WHERE campaign.id = ${googleCampaignId}
            AND ad_group_criterion.status != 'REMOVED'
          ORDER BY metrics.impressions DESC
        `);
        const keywords = rows.map(r => ({
          text: r.ad_group_criterion?.keyword?.text,
          matchType: r.ad_group_criterion?.keyword?.match_type,
          status: r.ad_group_criterion?.status,
          impressions: r.metrics?.impressions ?? 0,
          clicks: r.metrics?.clicks ?? 0,
          costUsd: ((r.metrics?.cost_micros ?? 0) / 1_000_000).toFixed(2),
        }));
        return { content: [{ type: 'text', text: JSON.stringify(keywords, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error listing keywords: ${err.message}` }], isError: true };
      }
    },
  );

  // ── Ad tools ────────────────────────────────────────────

  server.registerTool(
    'create_ad',
    {
      description: 'Create a responsive search ad in a campaign',
      inputSchema: {
        googleCampaignId: z.string().describe('Google Ads campaign ID'),
        headlines: z.array(z.string()).describe('3-15 headlines, max 30 chars each'),
        descriptions: z.array(z.string()).describe('2-4 descriptions, max 90 chars each'),
        finalUrl: z.string().describe('Landing page URL'),
      },
    },
    async ({ googleCampaignId, headlines, descriptions, finalUrl }) => {
      try {
        const adGroupId = await getFirstAdGroupId(googleCampaignId);
        if (!adGroupId) {
          return { content: [{ type: 'text', text: `No ad group found for campaign ${googleCampaignId}` }], isError: true };
        }
        const spec: RSASpec = { headlines, descriptions, finalUrl };
        const adId = await createResponsiveSearchAd(adGroupId, spec);
        return { content: [{ type: 'text', text: JSON.stringify({ adId }) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error creating ad: ${err.message}` }], isError: true };
      }
    },
  );

  // ── Performance tool ────────────────────────────────────

  server.registerTool(
    'get_performance',
    {
      description: 'Get performance metrics for all campaigns or a specific one',
      inputSchema: {
        googleCampaignId: z.string().optional().describe('Google Ads campaign ID (omit for all campaigns)'),
      },
    },
    async ({ googleCampaignId }) => {
      try {
        const campaigns = await listCampaigns();
        const result = googleCampaignId
          ? campaigns.filter(c => c.googleId === googleCampaignId)
          : campaigns;
        if (googleCampaignId && result.length === 0) {
          return { content: [{ type: 'text', text: `Campaign ${googleCampaignId} not found` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error getting performance: ${err.message}` }], isError: true };
      }
    },
  );

  // -- Keyword Planner tool ----------------------------------------

  server.registerTool(
    'keyword_planner',
    {
      description: 'Get historical search volume, competition level, and CPC bid range for a list of keywords. Use before add_keywords to prioritize by ROI.',
      inputSchema: {
        keywords: z.array(z.string()).describe('Keywords to look up � plain text, no match type brackets'),
      },
    },
    async ({ keywords }) => {
      try {
        const metrics = await getKeywordMetrics(keywords);
        metrics.sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches);
        const table = metrics.map(m => ({
          keyword: m.keyword,
          monthlySearches: m.avgMonthlySearches,
          competition: m.competition,
          competitionIndex: m.competitionIndex,
          cpcRangeUsd: `$${m.lowTopOfPageBidUsd}--$${m.highTopOfPageBidUsd}`,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(table, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error fetching keyword metrics: ${err.message}` }], isError: true };
      }
    },
  );
  // -- SpyFu tools
  server.registerTool(
    'spyfu_domain_keywords',
    {
      title: 'SpyFu: Domain Paid Keywords',
      description: 'Returns the top PPC keywords a competitor domain is bidding on, sorted by search volume. Use this to discover what keywords competitors are spending money on.',
      inputSchema: {
        domain: z.string().describe('Competitor domain, e.g. "slalom.com"'),
        limit: z.number().int().min(1).max(100).default(20).optional().describe('Number of keywords to return (default 20)'),
      },
    },
    async ({ domain, limit = 20 }) => {
      const result = await getDomainPaidKeywords(domain, limit);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'spyfu_domain_competitors',
    {
      title: 'SpyFu: Domain PPC Competitors',
      description: 'Returns the top PPC competitors for a domain � other domains bidding on overlapping paid keywords. Use this to discover the competitive landscape around a given domain.',
      inputSchema: {
        domain: z.string().describe('Domain to find competitors for, e.g. "slalom.com"'),
        limit: z.number().int().min(1).max(100).default(20).optional().describe('Number of competitors to return (default 20)'),
      },
    },
    async ({ domain, limit = 20 }) => {
      const result = await getDomainPpcCompetitors(domain, limit);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  // -- Persona tools ---------------------------------------------------------

  server.registerTool(
    'list_personas',
    {
      description: 'List all personas with their campaign IDs, budget, and data',
    },
    async () => {
      try {
        const rows = await query<any>(`
          SELECT id, slug, name, lp_url, budget_floor_pct, status,
                 google_campaign_id, data, created_at, updated_at
          FROM personas
          ORDER BY id
        `);
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error listing personas: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_persona',
    {
      description: 'Get a single persona by slug with full data',
      inputSchema: {
        slug: z.string().describe('Persona slug e.g. ai-department'),
      },
    },
    async ({ slug }) => {
      try {
        const rows = await query<any>(
          `SELECT id, slug, name, lp_url, budget_floor_pct, status,
                  google_campaign_id, data, created_at, updated_at
           FROM personas WHERE slug = $1`,
          [slug],
        );
        if (rows.length === 0) {
          return { content: [{ type: 'text', text: `Persona not found: ${slug}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error getting persona: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'create_persona',
    {
      description: 'Create a new persona in the database',
      inputSchema: {
        slug: z.string().describe('URL-safe unique identifier e.g. my-new-persona'),
        name: z.string().describe('Human-readable persona name'),
        lpUrl: z.string().describe('Landing page URL'),
        data: z.string().describe('Persona context as JSON string � seed idea, pain points, audience, etc.'),
        budgetFloorPct: z.number().optional().default(0.1).describe('Minimum budget share (0.1 = 10%)'),
      },
    },
    async ({ slug, name, lpUrl, data: dataStr, budgetFloorPct }) => {
      try {
        const data = JSON.parse(dataStr);
        const rows = await query<any>(
          `INSERT INTO personas (slug, name, lp_url, budget_floor_pct, status, data)
           VALUES ($1, $2, $3, $4, 'active', $5)
           RETURNING id, slug, name`,
          [slug, name, lpUrl, budgetFloorPct, JSON.stringify(data)],
        );
        logger.info(`Created persona: ${slug}`);
        return { content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error creating persona: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'edit_persona',
    {
      description: 'Update fields on an existing persona. Only provided fields are updated.',
      inputSchema: {
        slug: z.string().describe('Persona slug to update'),
        name: z.string().optional().describe('New human-readable name'),
        lpUrl: z.string().optional().describe('New landing page URL'),
        data: z.string().optional().describe('Updated persona context as JSON string'),
        status: z.enum(['active', 'paused']).optional().describe('Persona status'),
        budgetFloorPct: z.number().optional().describe('New minimum budget share'),
        googleCampaignId: z.string().optional().describe('Link to a Google Ads campaign ID'),
      },
    },
    async ({ slug, name, lpUrl, data: dataStr, status, budgetFloorPct, googleCampaignId }) => {
      try {
        const updates: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let i = 1;

        if (name)             { updates.push(`name = ${i++}`);               values.push(name); }
        if (lpUrl)            { updates.push(`lp_url = ${i++}`);             values.push(lpUrl); }
        if (dataStr)          { updates.push(`data = ${i++}`);               values.push(JSON.parse(dataStr)); }
        if (status)           { updates.push(`status = ${i++}`);             values.push(status); }
        if (budgetFloorPct !== undefined) { updates.push(`budget_floor_pct = ${i++}`); values.push(budgetFloorPct); }
        if (googleCampaignId) { updates.push(`google_campaign_id = ${i++}`); values.push(googleCampaignId); }

        if (values.length === 0) {
          return { content: [{ type: 'text', text: 'No fields provided to update' }], isError: true };
        }

        values.push(slug);
        const rows = await query<any>(
          `UPDATE personas SET ${updates.join(', ')} WHERE slug = ${i} RETURNING id, slug, name, updated_at`,
          values,
        );
        if (rows.length === 0) {
          return { content: [{ type: 'text', text: `Persona not found: ${slug}` }], isError: true };
        }
        logger.info(`Updated persona: ${slug}`);
        return { content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error editing persona: ${err.message}` }], isError: true };
      }
    },
  );

  return server;
}







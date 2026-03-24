/**
 * mcp/index.ts
 * Entry point — starts the MCP server with stdio transport
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from '../utils/logger.js';

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server running on stdio');
}

main().catch((err) => {
  logger.urgent(`Fatal error: ${err.message}`);
  process.exit(1);
});

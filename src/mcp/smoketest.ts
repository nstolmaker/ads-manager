/**
 * MCP server smoketest
 * Verifies the server instantiates and all 9 tools are registered.
 * No live API calls — safe to run anytime.
 */
import { createServer } from './server.js';
import { LogLevel, logger } from '../utils/logger.js';

const EXPECTED_TOOLS = [
  'create_campaign',
  'list_campaigns',
  'set_campaign_status',
  'set_campaign_budget',
  'add_keywords',
  'remove_keywords',
  'list_keywords',
  'create_ad',
  'get_performance',
];

console.log('=== MCP Server Smoketest ===\n');

// 1. Logger check
console.log('1. Logger...');
logger.debug('debug message (hidden at default Info level)');
logger.info('logger initialized');
logger.notice('notice level works');
console.log('   ✅ Logger OK\n');

// 2. Server instantiation
console.log('2. Server instantiation...');
let server: ReturnType<typeof createServer>;
try {
  server = createServer();
  console.log('   ✅ Server created OK\n');
} catch (err: any) {
  console.error('   ❌ Server creation failed:', err.message);
  process.exit(1);
}

// 3. Tool registration — access internal tool registry
console.log('3. Tool registration...');
const registeredTools: string[] = Object.keys((server as any)._registeredTools ?? {});

let allFound = true;
for (const tool of EXPECTED_TOOLS) {
  const found = registeredTools.includes(tool);
  console.log(`   ${found ? '✅' : '❌'} ${tool}`);
  if (!found) allFound = false;
}

if (registeredTools.length > EXPECTED_TOOLS.length) {
  const extra = registeredTools.filter(t => !EXPECTED_TOOLS.includes(t));
  console.log(`\n   ℹ️  Extra tools registered: ${extra.join(', ')}`);
}

console.log(`\n   ${allFound ? '✅ All 9 tools registered' : '❌ Some tools missing!'}`);

console.log('\n=== Smoketest complete ===');
process.exit(allFound ? 0 : 1);

module.exports = {
  apps: [
    {
      // Webhook server — always running, receives Claude's approval callbacks
      name: 'ads-webhook',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/discord/webhook.ts',
      interpreter: 'node',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      // Optimization loop — runs every 7 days via cron
      name: 'ads-optimizer',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/scheduler.ts',
      interpreter: 'node',
      cwd: __dirname,
      watch: false,
      autorestart: false,  // One-shot per cron trigger
      cron_restart: '0 9 * * 1', // Every Monday at 9:00 AM
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

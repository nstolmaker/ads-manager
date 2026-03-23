module.exports = {
  apps: [
    {
      // Webhook server — always running, receives Claude's approval callbacks
      name: 'ads-webhook',
      script: 'npx',
      args: 'tsx src/discord/webhook.ts',
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
      script: 'npx',
      args: 'tsx src/scheduler.ts',
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

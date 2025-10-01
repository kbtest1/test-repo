import { App, LogLevel } from '@slack/bolt';
import { config } from 'dotenv';
import { registerMessageHandler } from './handlers/messageHandler.js';

config();

if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
  throw new Error('Missing Slack credentials. Please set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET.');
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
});

registerMessageHandler(app);

async function start() {
  const port = Number(process.env.PORT ?? 3000);

  await app.start(port);
  // eslint-disable-next-line no-console
  console.log(`⚡️ Slack AI Assistant is running on port ${port}`);
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start Slack AI Assistant', error);
  process.exit(1);
});

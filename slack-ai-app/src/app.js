import { App, LogLevel } from '@slack/bolt';
import { registerMessageHandler } from './handlers/messageHandler.js';

export async function startApp() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
    logLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
  });

  registerMessageHandler(app);

  const port = Number(process.env.PORT ?? 3000);

  await app.start(port);
  // eslint-disable-next-line no-console
  console.log(`⚡️ Slack AI Assistant is running on port ${port}`);
}

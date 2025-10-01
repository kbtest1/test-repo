import { getChatCompletion } from '../services/openAiClient.js';

function buildContextFromThread(threadMessages = []) {
  return threadMessages.map((msg) => ({
    role: msg.user === 'assistant' ? 'assistant' : 'user',
    content: msg.text ?? ''
  }));
}

export function registerMessageHandler(app) {
  app.message(async ({ message, client, say, logger }) => {
    try {
      if (message.subtype && message.subtype !== 'bot_message') {
        return;
      }

      const threadTs = message.thread_ts ?? message.ts;
      const threadResponse = await client.conversations.replies({
        channel: message.channel,
        ts: threadTs,
        inclusive: true
      });

      const context = buildContextFromThread(threadResponse.messages ?? []);
      const responseText = await getChatCompletion({ userMessage: message.text, context });

      await say({
        text: responseText,
        thread_ts: threadTs
      });
    } catch (error) {
      logger.error(error);
      await say({
        text: "I ran into an error generating a response. Please check the server logs for more details.",
        thread_ts: message.ts
      });
    }
  });

  app.command('/ask-ai', async ({ ack, respond, command, logger }) => {
    await ack();

    try {
      const responseText = await getChatCompletion({ userMessage: command.text });
      await respond({ text: responseText, response_type: 'in_channel' });
    } catch (error) {
      logger.error(error);
      await respond({
        text: 'Something went wrong when talking to OpenAI. Please try again later.',
        response_type: 'ephemeral'
      });
    }
  });
}

import { getChatCompletion } from '../services/openAiClient.js';

// Bot replies carry `bot_id`, and incoming webhooks carry the `bot_message`
// subtype without one. Slack never sends `user: 'assistant'`; the legacy value
// is kept only for backwards compatibility.
function isBotAuthoredMessage(message = {}, botUserId) {
  return (
    Boolean(message.bot_id) ||
    message.subtype === 'bot_message' ||
    message.user === 'assistant' ||
    (Boolean(botUserId) && message.user === botUserId)
  );
}

function isTriggerMessage(message, triggerTs) {
  return triggerTs !== undefined && message.ts === triggerTs;
}

/**
 * Maps Slack thread messages to OpenAI chat turns.
 *
 * The triggering message is dropped when `triggerTs` is given, because the
 * caller appends it again as the `userMessage`. Without this, the model sees
 * the same question twice.
 */
export function buildContextFromThread(threadMessages = [], triggerTs, botUserId) {
  return threadMessages
    .filter((msg) => msg && !isTriggerMessage(msg, triggerTs))
    .map((msg) => ({
      role: isBotAuthoredMessage(msg, botUserId) ? 'assistant' : 'user',
      content: msg.text ?? ''
    }));
}

/**
 * True for messages this app must never answer: bot posts (including its own
 * replies) and its own bot user. Answering them causes a self-reply loop.
 */
export function isBotMessage(message = {}, botUserId) {
  if (message.bot_id) {
    return true;
  }

  if (message.subtype === 'bot_message') {
    return true;
  }

  return Boolean(botUserId) && message.user === botUserId;
}

export function registerMessageHandler(app, { complete = getChatCompletion } = {}) {
  app.message(async ({ message, client, say, logger, context: boltContext }) => {
    try {
      if (message.subtype && message.subtype !== 'bot_message') {
        return;
      }

      if (isBotMessage(message, boltContext?.botUserId)) {
        return;
      }

      const threadTs = message.thread_ts ?? message.ts;
      const threadResponse = await client.conversations.replies({
        channel: message.channel,
        ts: threadTs,
        inclusive: true
      });

      const context = buildContextFromThread(
        threadResponse.messages ?? [],
        message.ts,
        boltContext?.botUserId
      );
      const responseText = await complete({ userMessage: message.text, context });

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
      const responseText = await complete({ userMessage: command.text });
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

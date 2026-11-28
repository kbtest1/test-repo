import { getChatCompletion, isFallbackReply } from '../services/openAiClient.js';
import { ANALYTICS_EVENTS, analytics, bucketTextLength } from '../services/analytics.js';

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

// The single place that decides whether a message counts: internal test traffic
// (by Slack id) and a Slack retry of a ts already counted do not. Bot messages
// are rejected by `isBotMessage` above.
const countedKeys = new Set();
const COUNTED_KEY_LIMIT = 1000;

function idList(value) {
  return new Set(
    String(value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

function counts({ channel, user, key }, env = process.env) {
  if (idList(env.ANALYTICS_TEST_CHANNEL_IDS).has(channel)) return false;
  if (idList(env.ANALYTICS_TEST_USER_IDS).has(user)) return false;
  if (!key) return true;
  if (countedKeys.has(key)) return false;

  countedKeys.add(key);

  while (countedKeys.size > COUNTED_KEY_LIMIT) {
    countedKeys.delete(countedKeys.values().next().value);
  }

  return true;
}

function outcomeOf(text) {
  return isFallbackReply(text) ? 'fallback' : 'ok';
}

export function registerMessageHandler(app, { complete = getChatCompletion } = {}) {
  app.message(async ({ message, client, say, logger, context: boltContext }) => {
    // Resolved before the try block so the error reply lands in the same thread
    // as a successful reply.
    const threadTs = message.thread_ts ?? message.ts;
    const startedAt = Date.now();
    const identity = analytics.identify({
      teamId: boltContext?.teamId ?? message.team,
      userId: message.user
    });
    let failedStep = ANALYTICS_EVENTS.MESSAGE_RECEIVED;
    let track = false;
    const record = (event, properties) => {
      if (track) analytics.capture(event, { ...identity, source: 'message', ...properties });
    };

    try {
      if (message.subtype && message.subtype !== 'bot_message') {
        return;
      }

      if (isBotMessage(message, boltContext?.botUserId)) {
        return;
      }

      track = counts({
        channel: message.channel,
        user: message.user,
        key: `${message.team_id ?? message.team ?? ''}:${message.channel ?? ''}:${message.ts ?? ''}`
      });

      record(ANALYTICS_EVENTS.MESSAGE_RECEIVED, {
        thread_reply: threadTs !== message.ts,
        message_length_bucket: bucketTextLength(message.text)
      });

      failedStep = ANALYTICS_EVENTS.THREAD_CONTEXT_LOADED;
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

      record(ANALYTICS_EVENTS.THREAD_CONTEXT_LOADED, { context_message_count: context.length });

      failedStep = ANALYTICS_EVENTS.MODEL_COMPLETION_FINISHED;
      const modelStartedAt = Date.now();
      const responseText = await complete({ userMessage: message.text, context });
      const modelDurationMs = Date.now() - modelStartedAt;

      record(ANALYTICS_EVENTS.MODEL_COMPLETION_FINISHED, {
        success: true,
        outcome: outcomeOf(responseText),
        duration_ms: modelDurationMs,
        response_length_bucket: bucketTextLength(responseText)
      });

      failedStep = ANALYTICS_EVENTS.REPLY_POSTED;
      await say({
        text: responseText,
        thread_ts: threadTs
      });

      record(ANALYTICS_EVENTS.REPLY_POSTED, { success: true, outcome: outcomeOf(responseText) });
    } catch (error) {
      record(ANALYTICS_EVENTS.HANDLER_FAILED, {
        failed_step: failedStep,
        success: false,
        error_type: error?.name ?? 'Error',
        duration_ms: Date.now() - startedAt
      });

      logger.error(error);
      await say({
        text: "I ran into an error generating a response. Please check the server logs for more details.",
        thread_ts: threadTs
      });
    }
  });

  app.command('/ask-ai', async ({ ack, respond, command, logger }) => {
    await ack();

    const startedAt = Date.now();
    const identity = analytics.identify({ teamId: command.team_id, userId: command.user_id });
    const track = counts({
      channel: command.channel_id,
      user: command.user_id,
      key: command.trigger_id ? `command:${command.trigger_id}` : ''
    });
    let failedStep = ANALYTICS_EVENTS.ASK_AI_COMMAND_INVOKED;
    const record = (event, properties) => {
      if (track) analytics.capture(event, { ...identity, source: 'slash_command', ...properties });
    };

    record(ANALYTICS_EVENTS.ASK_AI_COMMAND_INVOKED, {
      message_length_bucket: bucketTextLength(command.text)
    });

    try {
      failedStep = ANALYTICS_EVENTS.MODEL_COMPLETION_FINISHED;
      const modelStartedAt = Date.now();
      const responseText = await complete({ userMessage: command.text });
      const modelDurationMs = Date.now() - modelStartedAt;

      record(ANALYTICS_EVENTS.MODEL_COMPLETION_FINISHED, {
        success: true,
        outcome: outcomeOf(responseText),
        duration_ms: modelDurationMs,
        response_length_bucket: bucketTextLength(responseText)
      });

      failedStep = ANALYTICS_EVENTS.REPLY_POSTED;
      await respond({ text: responseText, response_type: 'in_channel' });

      record(ANALYTICS_EVENTS.REPLY_POSTED, { success: true, outcome: outcomeOf(responseText) });
    } catch (error) {
      record(ANALYTICS_EVENTS.HANDLER_FAILED, {
        failed_step: failedStep,
        success: false,
        error_type: error?.name ?? 'Error',
        duration_ms: Date.now() - startedAt
      });

      logger.error(error);
      await respond({
        text: 'Something went wrong when talking to OpenAI. Please try again later.',
        response_type: 'ephemeral'
      });
    }
  });
}

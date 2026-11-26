import assert from 'node:assert/strict';
import test from 'node:test';

// `src/services/openAiClient.js` builds its client at import time, so a dummy
// key keeps the module importable. No request is made: the tests inject their
// own completion function into the handler.
process.env.OPENAI_API_KEY ??= 'test-key';

const { buildContextFromThread, isBotMessage, registerMessageHandler } = await import(
  '../src/handlers/messageHandler.js'
);

const BOT_USER_ID = 'UBOTAPP';

function collectHandlers(complete) {
  const handlers = {};
  const app = {
    message: (fn) => {
      handlers.message = fn;
    },
    command: (name, fn) => {
      handlers[`command:${name}`] = fn;
    }
  };

  registerMessageHandler(app, { complete });
  return handlers;
}

function createHarness({ threadMessages = [], complete } = {}) {
  const calls = { replies: [], said: [], errors: [], completions: [] };

  const completeFn = async (args) => {
    calls.completions.push(args);
    return complete ? complete(args) : 'assistant reply';
  };

  const handlers = collectHandlers(completeFn);

  const run = (message) =>
    handlers.message({
      message,
      client: {
        conversations: {
          replies: async (args) => {
            calls.replies.push(args);
            return { messages: threadMessages };
          }
        }
      },
      context: { botUserId: BOT_USER_ID },
      say: async (payload) => {
        calls.said.push(payload);
      },
      logger: { error: (error) => calls.errors.push(error) }
    });

  return { calls, run };
}

test('ignores a message posted by a bot', async () => {
  const harness = createHarness();

  await harness.run({
    type: 'message',
    user: 'UBOT1',
    bot_id: 'B1',
    text: 'automated notice',
    channel: 'C1',
    ts: '100.1'
  });

  assert.equal(harness.calls.replies.length, 0, 'thread is not fetched');
  assert.equal(harness.calls.completions.length, 0, 'model is not called');
  assert.equal(harness.calls.said.length, 0, 'nothing is posted to Slack');
});

test('ignores a bot_message subtype event', async () => {
  const harness = createHarness();

  await harness.run({
    type: 'message',
    subtype: 'bot_message',
    text: 'handled by the app',
    channel: 'C1',
    ts: '100.2'
  });

  assert.equal(harness.calls.said.length, 0);
  assert.equal(harness.calls.completions.length, 0);
});

test('ignores a message from the app own bot user id', async () => {
  const harness = createHarness();

  await harness.run({
    type: 'message',
    user: BOT_USER_ID,
    text: 'own reply',
    channel: 'C1',
    ts: '100.3'
  });

  assert.equal(harness.calls.said.length, 0);
  assert.equal(harness.calls.completions.length, 0);
});

test('still answers a human message and replies in the thread', async () => {
  const harness = createHarness({ threadMessages: [{ user: 'U1', text: 'hello', ts: '100.4' }] });

  await harness.run({ type: 'message', user: 'U1', text: 'hello', channel: 'C1', ts: '100.4' });

  assert.equal(harness.calls.replies.length, 1);
  assert.deepEqual(harness.calls.replies[0], { channel: 'C1', ts: '100.4', inclusive: true });
  assert.equal(harness.calls.said.length, 1);
  assert.deepEqual(harness.calls.said[0], { text: 'assistant reply', thread_ts: '100.4' });
  assert.deepEqual(harness.calls.completions[0].context, [], 'a lone trigger leaves no context');
});

test('answers in an existing thread and replies to the thread root', async () => {
  const harness = createHarness({
    threadMessages: [
      { user: 'U1', text: 'thread root', ts: '80.1' },
      { user: 'UBOT1', bot_id: 'B1', text: 'first answer', ts: '80.2' },
      { user: 'U1', text: 'threaded trigger', ts: '80.3' }
    ]
  });

  await harness.run({
    type: 'message',
    user: 'U1',
    text: 'threaded trigger',
    channel: 'C1',
    thread_ts: '80.1',
    ts: '80.3'
  });

  assert.equal(harness.calls.replies[0].ts, '80.1', 'the whole thread is read');
  assert.equal(harness.calls.said[0].thread_ts, '80.1', 'the answer goes to the thread root');
  assert.deepEqual(harness.calls.completions[0].context, [
    { role: 'user', content: 'thread root' },
    { role: 'assistant', content: 'first answer' }
  ]);
});

test('maps bot replies in the thread to the assistant role', async () => {
  const harness = createHarness({
    threadMessages: [
      { user: 'U1', text: 'earlier question', ts: '90.1' },
      { user: 'UBOT1', bot_id: 'B1', text: 'earlier answer', ts: '90.2' },
      { user: 'U2', text: 'follow-up', ts: '91.1' }
    ]
  });

  await harness.run({ type: 'message', user: 'U2', text: 'follow-up', channel: 'C1', ts: '91.1' });

  assert.deepEqual(harness.calls.completions[0].context, [
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' }
  ]);
});

test('maps webhook and own-user posts without bot_id to the assistant role', async () => {
  const context = buildContextFromThread(
    [
      { subtype: 'bot_message', text: 'webhook reply', ts: '1' },
      { user: BOT_USER_ID, text: 'own reply without bot_id', ts: '2' },
      { user: 'U1', text: 'human', ts: '3' }
    ],
    undefined,
    BOT_USER_ID
  );

  assert.deepEqual(context, [
    { role: 'assistant', content: 'webhook reply' },
    { role: 'assistant', content: 'own reply without bot_id' },
    { role: 'user', content: 'human' }
  ]);
});

test('does not duplicate the trigger message in the model context', async () => {
  const harness = createHarness({
    threadMessages: [
      { user: 'U1', text: 'first', ts: '90.1' },
      { user: 'UBOT1', bot_id: 'B1', text: 'answer one', ts: '90.2' },
      { user: 'U1', text: 'the trigger text', ts: '90.3' }
    ]
  });

  await harness.run({ type: 'message', user: 'U1', text: 'the trigger text', channel: 'C1', ts: '90.3' });

  const { context, userMessage } = harness.calls.completions[0];
  assert.equal(userMessage, 'the trigger text');
  assert.equal(context.length, 2);
  assert.deepEqual(
    context.map((turn) => turn.content),
    ['first', 'answer one']
  );
  assert.ok(
    !context.some((turn) => turn.content === 'the trigger text'),
    'trigger text appears only as the userMessage'
  );
});

test('buildContextFromThread drops only the trigger and defaults missing text', () => {
  const context = buildContextFromThread(
    [
      { user: 'U1', text: 'before', ts: '1' },
      { user: 'U1', text: 'trigger', ts: '2' },
      { bot_id: 'B1', ts: '3' }
    ],
    '2'
  );

  assert.deepEqual(context, [
    { role: 'user', content: 'before' },
    { role: 'assistant', content: '' }
  ]);
  assert.deepEqual(buildContextFromThread(), []);
});

test('isBotMessage detects bot posts and the app own bot user', () => {
  assert.equal(isBotMessage({ bot_id: 'B1' }, BOT_USER_ID), true);
  assert.equal(isBotMessage({ user: 'U1' }), false, 'a human message is not a bot message');
  assert.equal(isBotMessage({ subtype: 'bot_message' }, BOT_USER_ID), true);
  assert.equal(isBotMessage({ user: BOT_USER_ID }, BOT_USER_ID), true);
  assert.equal(isBotMessage({ user: 'U1' }, BOT_USER_ID), false);
  assert.equal(isBotMessage({ user: BOT_USER_ID }), false, 'without a bot user id it cannot match');
});

test('posts an error message when the model call fails', async () => {
  const harness = createHarness({
    complete: () => {
      throw new Error('boom');
    }
  });

  await harness.run({ type: 'message', user: 'U1', text: 'hello', channel: 'C1', ts: '70.1' });

  assert.equal(harness.calls.errors.length, 1);
  assert.equal(harness.calls.said.length, 1);
  assert.equal(harness.calls.said[0].thread_ts, '70.1');
});

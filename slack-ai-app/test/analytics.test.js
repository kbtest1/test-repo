import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';

// `src/services/openAiClient.js` builds its client at import time, so a dummy
// key keeps the module importable. No request is made: every test injects its
// own `complete` function.
process.env.OPENAI_API_KEY ??= 'test-key';

const { ANALYTICS_EVENTS, sanitizeProperties } = await import('../src/services/analytics.js');
const { FALLBACK_REPLY } = await import('../src/services/openAiClient.js');
const { registerMessageHandler } = await import('../src/handlers/messageHandler.js');

const realFetch = globalThis.fetch;
let sent = [];
let nextTs = 0;

function message(overrides = {}) {
  nextTs += 1;

  return {
    type: 'message',
    user: 'U1',
    text: 'how do I deploy the service?',
    channel: 'C123',
    ts: `1700000000.${String(nextTs).padStart(6, '0')}`,
    ...overrides
  };
}

function harness({ complete = async () => 'assistant reply', threadMessages = [] } = {}) {
  const handlers = {};

  registerMessageHandler(
    {
      message: (fn) => {
        handlers.message = fn;
      },
      command: (name, fn) => {
        handlers[`command:${name}`] = fn;
      }
    },
    { complete }
  );

  const said = [];
  const run = (payload) =>
    handlers.message({
      message: payload,
      client: { conversations: { replies: async () => ({ messages: threadMessages }) } },
      say: async (reply) => said.push(reply),
      logger: { error() {} },
      context: { botUserId: 'UBOT', teamId: 'T123' }
    });

  return { run, said, handlers };
}

async function flush() {
  for (let pass = 0; pass < 3; pass += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setImmediate(resolve));
  }
}

beforeEach(() => {
  sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(init.body) });
    return { ok: true, status: 200 };
  };
  process.env.ANALYTICS_API_KEY = 'phc_test_key';
  delete process.env.ANALYTICS_TEST_CHANNEL_IDS;
  delete process.env.ANALYTICS_TEST_USER_IDS;
});

after(() => {
  globalThis.fetch = realFetch;
  delete process.env.ANALYTICS_API_KEY;
});

test('a normal message emits the journey in order and leaks no message text', async () => {
  const { run, said } = harness({ threadMessages: [{ user: 'U1', text: 'thread question' }] });

  await run(message());
  await flush();

  const events = sent.map((request) => request.body.event);

  assert.deepEqual(events, [
    ANALYTICS_EVENTS.MESSAGE_RECEIVED,
    ANALYTICS_EVENTS.THREAD_CONTEXT_LOADED,
    ANALYTICS_EVENTS.MODEL_COMPLETION_FINISHED,
    ANALYTICS_EVENTS.REPLY_POSTED
  ]);

  // The full vocabulary, in journey order.
  assert.deepEqual(Object.values(ANALYTICS_EVENTS), [
    'message_received',
    'thread_context_loaded',
    'model_completion_finished',
    'reply_posted',
    'handler_failed',
    'ask_ai_command_invoked'
  ]);

  for (const { body } of sent) {
    assert.equal(body.distinct_id, 'T123:U1');
    assert.equal('text' in body.properties, false);
    assert.equal('prompt' in body.properties, false);
    assert.equal('channel_name' in body.properties, false);
  }

  const serialized = JSON.stringify(sent);

  assert.equal(serialized.includes('how do I deploy the service?'), false);
  assert.equal(serialized.includes('assistant reply'), false);
  assert.equal(serialized.includes('thread question'), false);
  assert.equal(serialized.includes('C123'), false);
  assert.equal(said[0].text, 'assistant reply');
});

test('a bot message emits nothing', async () => {
  const { run, said } = harness();

  await run(message({ bot_id: 'B1', user: 'UBOT' }));
  await run(message({ subtype: 'bot_message' }));
  await flush();

  assert.deepEqual(sent, []);
  assert.deepEqual(said, []);
});

test('the same Slack ts twice emits one journey', async () => {
  const { run, said } = harness();
  const payload = message();

  await run(payload);
  await run({ ...payload });
  await flush();

  assert.equal(sent.length, 4);
  assert.equal(said.length, 2, 'analytics de-duplicates; replies are unchanged');
});

test('a test channel or test user is not counted', async () => {
  process.env.ANALYTICS_TEST_CHANNEL_IDS = 'C_TEST';
  process.env.ANALYTICS_TEST_USER_IDS = 'U_QA';

  const { run } = harness();

  await run(message({ channel: 'C_TEST' }));
  await run(message({ user: 'U_QA' }));
  await flush();

  assert.deepEqual(sent, []);
});

test('a fallback answer is reported as fallback and the reply is unchanged', async () => {
  const { run, said } = harness({ complete: async () => FALLBACK_REPLY });

  await run(message());
  await flush();

  const [, , model, reply] = sent.map((request) => request.body.properties);

  assert.equal(model.outcome, 'fallback');
  assert.equal(reply.outcome, 'fallback');
  assert.equal(said[0].text, FALLBACK_REPLY);
});

test('a failing step emits handler_failed without the error text', async () => {
  const { run } = harness({
    complete: async () => {
      throw new Error('model exploded on how do I deploy the service?');
    }
  });

  await run(message());
  await flush();

  const failed = sent.at(-1).body.properties;

  assert.equal(sent.at(-1).body.event, ANALYTICS_EVENTS.HANDLER_FAILED);
  assert.equal(failed.failed_step, 'model_completion_finished');
  assert.equal(failed.error_type, 'Error');
  assert.equal(JSON.stringify(sent).includes('model exploded'), false);
});

test('the slash command journey is tagged and counted once per trigger', async () => {
  const { handlers } = harness();
  const respond = [];
  const command = { team_id: 'T123', user_id: 'U9', channel_id: 'C1', text: 'summarize', trigger_id: 't1' };
  const runCommand = () =>
    handlers['command:/ask-ai']({
      ack: async () => {},
      respond: async (payload) => respond.push(payload),
      command,
      logger: { error() {} }
    });

  await runCommand();
  await runCommand();
  await flush();

  assert.deepEqual(
    sent.map((request) => request.body.event),
    [
      ANALYTICS_EVENTS.ASK_AI_COMMAND_INVOKED,
      ANALYTICS_EVENTS.MODEL_COMPLETION_FINISHED,
      ANALYTICS_EVENTS.REPLY_POSTED
    ]
  );
  assert.equal(sent[0].body.properties.source, 'slash_command');
  assert.equal(respond.length, 2, 'the re-delivered command is still answered');
});

test('the handler runs normally with analytics switched off', async () => {
  delete process.env.ANALYTICS_API_KEY;

  const { run, said } = harness();

  await assert.doesNotReject(run(message()));
  await flush();

  assert.deepEqual(sent, []);
  assert.equal(said.length, 1);
});

test('sanitizeProperties drops anything outside the allow-list', () => {
  assert.deepEqual(
    sanitizeProperties({
      team_id: 'T1',
      user_id: 'U1',
      outcome: 'ok',
      text: 'message text',
      prompt: 'prompt text',
      output: 'model output',
      channel_name: '#secret',
      user_name: 'Ada',
      api_key: 'sk-live'
    }),
    { team_id: 'T1', user_id: 'U1', outcome: 'ok' }
  );
});

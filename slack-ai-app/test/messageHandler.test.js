import assert from 'node:assert/strict';
import test from 'node:test';

// The handler imports the OpenAI client, which builds a client at module load
// and refuses to start without an API key. A placeholder keeps the import
// offline; no request is made by these tests.
process.env.OPENAI_API_KEY ??= 'test-placeholder-key';

const { buildContextFromThread } = await import('../src/handlers/messageHandler.js');

test('buildContextFromThread keeps assistant messages in the assistant role', () => {
  const context = buildContextFromThread([{ user: 'assistant', text: 'Here is how to deploy.' }]);

  assert.deepEqual(context, [{ role: 'assistant', content: 'Here is how to deploy.' }]);
});

test('buildContextFromThread maps every other author to the user role', () => {
  const context = buildContextFromThread([
    { user: 'U024BE7LH', text: 'How do I deploy?' },
    { user: 'bot', text: 'Ask a workspace admin.' }
  ]);

  assert.deepEqual(context, [
    { role: 'user', content: 'How do I deploy?' },
    { role: 'user', content: 'Ask a workspace admin.' }
  ]);
});

test('buildContextFromThread replaces missing text with an empty string', () => {
  const context = buildContextFromThread([
    { user: 'U024BE7LH' },
    { user: 'assistant', text: null },
    { user: 'U024BE7MG', text: 'Still there?' }
  ]);

  assert.deepEqual(context, [
    { role: 'user', content: '' },
    { role: 'assistant', content: '' },
    { role: 'user', content: 'Still there?' }
  ]);
});

test('buildContextFromThread returns an empty list when the thread is empty', () => {
  assert.deepEqual(buildContextFromThread([]), []);
  assert.deepEqual(buildContextFromThread(), []);
});

import '../config.js';
import { OpenAI } from 'openai';

const defaultModel = process.env.MODEL ?? 'gpt-4o-mini';
const defaultSystemPrompt =
  process.env.SYSTEM_PROMPT ??
  'You are a helpful assistant that responds with clear, concise answers and actionable guidance.';
const defaultMaxTokens = process.env.MAX_TOKENS ? Number(process.env.MAX_TOKENS) : 600;

let client;

// Build the client on first use so importing this module never throws.
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

export async function getChatCompletion({ userMessage, context = [] }) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  const messages = [
    { role: 'system', content: defaultSystemPrompt },
    ...context,
    { role: 'user', content: userMessage }
  ];

  const response = await getClient().responses.create({
    model: defaultModel,
    input: messages,
    max_output_tokens: defaultMaxTokens
  });

  const messageContent = response.output?.[0]?.content;
  const text = Array.isArray(messageContent)
    ? messageContent
        .filter((item) => item.type === 'output_text' && item.text)
        .map((item) => item.text)
        .join('\n')
    : undefined;

  return text ?? 'I was unable to generate a response. Please try again.';
}

# Slack AI Assistant 👀

This project scaffolds a Slack app that uses the Slack Bolt framework together with the OpenAI API to deliver AI-assisted conversations directly in Slack. It comes with a simple event-driven architecture, development tooling, and guidance on how to configure secrets for local development.

## Features

- Responds to channel messages and `/ask-ai` slash command with OpenAI-powered answers
- Built with the [Slack Bolt](https://slack.dev/bolt-js) framework and the official [OpenAI Node SDK](https://github.com/openai/openai-node)
- Structured handlers and services to keep your AI logic modular
- Uses Socket Mode for local development without setting up a public URL

## Project Structure

```
slack-ai-app/
├── package.json
├── README.md
├── .env.example
├── src
│   ├── index.js
│   ├── handlers
│   │   └── messageHandler.js
│   └── services
│       ├── analytics.js
│       └── openAiClient.js
├── scripts
│   └── verify-analytics.mjs
└── test
    ├── analytics.test.js
    └── messageHandlerBehavior.test.js
```

- `src/index.js` wires the Slack Bolt app, registers event handlers, and starts the app.
- `src/handlers/messageHandler.js` contains the chat message and slash command logic.
- `src/services/openAiClient.js` exports a convenience wrapper around the OpenAI chat completion API.
- `src/services/analytics.js` is the optional, provider-agnostic analytics client described below.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Duplicate the environment template**

   ```bash
   cp .env.example .env
   ```

3. **Fill in the required environment variables**

   - `SLACK_BOT_TOKEN`
   - `SLACK_SIGNING_SECRET`
   - `SLACK_APP_TOKEN`
   - `OPENAI_API_KEY`

   These should match the credentials from your Slack app configuration and OpenAI account.

4. **Run the development server**

   ```bash
   npm run dev
   ```

   This uses Socket Mode, so you do not need to expose a public URL. Make sure Socket Mode is enabled in your Slack app configuration.

5. **Deploying**

   For production deployments, disable Socket Mode and provide a public URL for Slack requests or host the app in an environment where Socket Mode is supported.

## Environment Variables

See `.env.example` for the full list of supported variables. The Bolt app accepts optional tuning parameters:

- `MODEL` – Override the default OpenAI chat model (defaults to `gpt-4o-mini`).
- `SYSTEM_PROMPT` – Custom system message to steer the assistant behaviour.
- `MAX_TOKENS` – Maximum number of tokens to generate in responses.

### Product analytics (optional)

Analytics is off by default. When `ANALYTICS_API_KEY` is empty, every capture call is a no-op and the app makes no analytics request.

- `ANALYTICS_API_KEY` – Project API key of a PostHog-compatible capture endpoint. Enables tracking when set.
- `ANALYTICS_HOST` – Capture endpoint base URL. Defaults to `https://us.i.posthog.com`. Events are POSTed to `<ANALYTICS_HOST>/capture/`. It must use `https:`; plain `http:` is accepted only for `localhost` and `127.0.0.1`.
- `ANALYTICS_TEST_CHANNEL_IDS` – Comma-separated Slack channel ids that are never tracked.
- `ANALYTICS_TEST_USER_IDS` – Comma-separated Slack user ids that are never tracked.

To check delivery as soon as a key exists:

```bash
npm run verify:analytics
```

The command sends one `message_received` event for the test identity `T_VERIFY_ANALYTICS` / `U_VERIFY_ANALYTICS`, prints the HTTP status and the provider response, and exits non-zero when no key is configured or the request fails. It proves the transport and that the endpoint accepts the event. It does not prove dashboard rendering, property typing, or that the event reaches a specific insight.

The Slack AI journey emits these events:

| Event | When it fires |
| --- | --- |
| `message_received` | A person's message passed the bot and test-traffic filters. |
| `thread_context_loaded` | The thread history was fetched, with `context_message_count`. |
| `model_completion_finished` | The model call returned, with `duration_ms` and `outcome`. |
| `reply_posted` | The reply was posted to Slack. |
| `handler_failed` | A journey step failed, with `failed_step` and `error_type`. |
| `ask_ai_command_invoked` | The `/ask-ai` slash command was used. |

Payload rules:

- Identity uses the Slack team id and user id. Event properties are an allow-list, so message text, prompts, model output, channel names, user names and secrets are never sent.
- `model_completion_finished` and `reply_posted` carry `outcome`: `ok` for a real answer, `fallback` when the model returned no usable text and the app sent its fixed fallback reply. The reply text itself is unchanged.
- Message and reply lengths are reported as coarse buckets such as `1-200`, never as exact lengths.
- Messages from bots, from a configured test channel or test user, and Slack retries of the same message `ts` produce no events. `/ask-ai` invocations from a configured test user are skipped too.
- A failing analytics provider never delays or breaks a reply.

## Testing

The app uses the Node.js built-in test runner. Node.js 22 or newer is required.

```bash
npm test
```

The tests run offline: each test injects its own `complete` function and replaces the analytics transport with a recorder, so no request leaves the machine.

## Extending the App

- Add new handlers in `src/handlers` and register them in `src/index.js`.
- Use the OpenAI client wrapper to add tools such as function calling or embeddings.
- Implement persistence for conversation history or user preferences.

## License

MIT

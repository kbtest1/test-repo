# Slack AI Assistant

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
└── src
    ├── index.js
    ├── handlers
    │   └── messageHandler.js
    └── services
        └── openAiClient.js
```

- `src/index.js` wires the Slack Bolt app, registers event handlers, and starts the app.
- `src/handlers/messageHandler.js` contains the chat message and slash command logic.
- `src/services/openAiClient.js` exports a convenience wrapper around the OpenAI chat completion API.

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

## Extending the App

- Add new handlers in `src/handlers` and register them in `src/index.js`.
- Use the OpenAI client wrapper to add tools such as function calling or embeddings.
- Implement persistence for conversation history or user preferences.

## License

MIT

# test-repo 👀

A monorepo containing a **Next.js** web application and a **Slack AI Assistant** bot.

## Summary

This repository houses two main projects:

### Next.js Web App

The root of the repo is a [Next.js](https://nextjs.org) application bootstrapped with the App Router, [Tailwind CSS](https://tailwindcss.com), and [shadcn/ui](https://ui.shadcn.com) components. It provides the foundation for building a modern, component-driven web interface.

### Slack AI Assistant (`slack-ai-app/`)

A Slack bot built with the [Slack Bolt](https://slack.dev/bolt-js) framework and the [OpenAI Node SDK](https://github.com/openai/openai-node). It listens for channel messages and the `/ask-ai` slash command, sends conversation context to OpenAI, and replies with AI-generated answers — all within Slack.

Key highlights:

- **Event-driven** — responds to messages and slash commands in real time
- **Thread-aware** — gathers conversation history for richer context
- **Configurable** — model, system prompt, and max tokens are all tuneable via environment variables
- **Socket Mode** — works locally without exposing a public URL

See [`slack-ai-app/README.md`](slack-ai-app/README.md) for detailed setup and usage instructions.

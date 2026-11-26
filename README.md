# test-repo

A small demonstration repository that holds two independent apps. Neither app
shares code, a backend, or a database with the other.

| App | Folder | What it does |
| --- | --- | --- |
| Slack AI Assistant | [`slack-ai-app/`](slack-ai-app/) | Slack bot that answers messages and `/ask-ai` commands with OpenAI replies |
| Event website | [`website/`](website/) | Static conference landing page with a speaker grid |

## Slack AI Assistant (`slack-ai-app/`)

A Node.js Slack app built on [Slack Bolt](https://slack.dev/bolt-js) that sends
channel messages and slash commands to the OpenAI API and posts the answer back
in the same thread.

- Runs in **Socket Mode**, so you do not need a public URL or a tunnel for local
  development.
- Replies in-thread for channel messages, and loads earlier thread messages to
  give the model conversation context.
- Answers the `/ask-ai` slash command and posts the response in the channel.
- Reads its settings from environment variables (see
  [`slack-ai-app/.env.example`](slack-ai-app/.env.example)).

### Requirements

- Node.js 18 or later
- A Slack app with Socket Mode enabled, plus a bot token, an app-level token,
  and a signing secret
- An OpenAI API key

### Run the Slack app

```bash
cd slack-ai-app
npm install
cp .env.example .env    # then fill in the values
npm run dev             # nodemon, restarts on file changes
```

Use `npm start` to run it once without the watcher.

### Configuration

| Variable | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Bot token from your Slack app (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Signing secret from your Slack app |
| `SLACK_APP_TOKEN` | App-level token for Socket Mode (`xapp-...`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `MODEL` | Optional. Chat model, defaults to `gpt-4o-mini` |
| `SYSTEM_PROMPT` | Optional. System message that steers the assistant |
| `MAX_TOKENS` | Optional. Maximum output tokens, defaults to `600` |
| `PORT` | Optional. Port value passed to Bolt, defaults to `3000` |
| `NODE_ENV` | Set to `production` to lower the log level |

The app exits at startup when `SLACK_BOT_TOKEN` or `SLACK_SIGNING_SECRET` is
missing. It reports an error when `OPENAI_API_KEY` is missing.

### Code layout

```
slack-ai-app/
├── src/
│   ├── index.js                     # creates the Bolt app and starts it
│   ├── handlers/messageHandler.js   # message events and the /ask-ai command
│   └── services/openAiClient.js     # OpenAI wrapper with thread context
├── .env.example
└── package.json
```

See [`slack-ai-app/README.md`](slack-ai-app/README.md) for more detail on this
app.

## Event website (`website/`)

A static site with no build step and no framework. It has these sections:
hero, about, speakers, schedule, FAQ, registration call to action, and footer.

### Run the website

Open `website/index.html` in a browser, or serve the folder:

```bash
npx serve website
```

### Speaker grid

Speaker cards come from the `window.SPEAKERS` array in
[`website/speakers.js`](website/speakers.js). Each entry has `name`, `title`,
`company`, `bio`, and `photo`. Put headshots in `website/assets/speakers/`.
Cards render in array order. A card with no `photo` shows the speaker's
initials instead.

Other files:

- `website/main.js` builds the speaker cards and sets the footer year.
- `website/styles.css` holds the theme variables and layout.

See [`website/README.md`](website/README.md) for the asset rules.

## Repository layout

```
test-repo/
├── README.md              # this file
├── .gitignore             # ignores node_modules, .env files, .DS_Store
├── app.js                 # empty placeholder
├── package-lock.json      # empty placeholder lockfile
├── slack-ai-app/          # Slack Bolt + OpenAI bot
└── website/               # static event landing page
```

## License

MIT

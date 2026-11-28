# Feature-to-metric coverage inventory

Scope: `slack-ai-app/` (Slack Bolt + OpenAI bot) and `website/` (static landing page).

Baseline: `main` at `b55a463`, checked on 2026-11-28.

Result: **1 journey, 6 steps, 0 tracked.**

Only journeys that a real user can complete end to end are counted. The Slack bot
qualifies. The website does not: it is scaffold content with placeholder copy and
no registration destination, so its steps are listed separately and excluded from
the denominator.

## How the tracking state was checked

This inventory is based on reading the code, not on assumption. The checks below
were run against tracked files at `b55a463`.

| Check | Method | Result |
| --- | --- | --- |
| Analytics or telemetry library | Search of all tracked files for known analytics names (pattern below) | No matches |
| Event attributes in the page markup | `git grep -n "data-" -- website` | No matches |
| Instrumentation dependencies | `slack-ai-app/package.json` | Only `@slack/bolt`, `dotenv`, `openai`; no analytics package |
| Log statements | `git grep -n -E "console\.\|logger\." -- slack-ai-app/src website` | 2 `logger.error` calls, 2 startup `console` calls; no structured events |
| Placeholder copy in the website | `git grep -n -i -E "event name\|date tbd\|goes here\|describe the event" -- website` | 7 matches, listed below |
| Deployment or CI definition | `git ls-files` | No `.github/` directory and no deploy config tracked |
| Tests | `slack-ai-app/package.json` | No `test` script |

The analytics search pattern was:

```
git grep -n -iE "posthog|segment|mixpanel|amplitude|gtag|googletagmanager|analytics|metrics|track\(|trackEvent|dataLayer|plausible|umami|sentry|datadog|matomo|fathom|statsd|prometheus|opentelemetry" -- . ':!*package-lock.json'
```

Files read in full: `slack-ai-app/src/index.js`,
`slack-ai-app/src/handlers/messageHandler.js`,
`slack-ai-app/src/services/openAiClient.js`, `website/index.html`,
`website/main.js`, `website/speakers.js`.

## The counted journey

Journey: **a Slack user asks a question and gets an answer.** It has two entry
points, a channel message and the `/ask-ai` command, and six steps. All six are
untracked.

| Journey | Step | User-facing feature | Tracked today | Event that would track it | Decision the metric supports | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Answer a question in Slack | S1 Message received | Bot receives a channel message (`handlers/messageHandler.js:11`) | No | `slack_message_received` (`channel_id`, `channel_type`, `user_id`, `is_thread_reply`, `request_id`) | Is the bot in the right channels, and how much demand exists? | P1 |
| Answer a question in Slack | S2 Thread context loaded | Bot reads the thread before answering (`handlers/messageHandler.js:17-24`) | No | `slack_thread_context_loaded` (`thread_message_count`, `latency_ms`, `outcome`) | Does context reading fail or slow replies, and does long context correlate with worse answers? | P1 |
| Answer a question in Slack | S3 Model completion returned | OpenAI answer generated (`services/openAiClient.js:25-39`) | No | `slack_completion_finished` (`model`, `latency_ms`, `outcome` is `ok`, `fallback_text`, or `error`, and `context_message_count`) | Is the model fast enough, and how often does it return no usable text? | P0 |
| Answer a question in Slack | S4 Reply posted | Answer visible in the thread (`handlers/messageHandler.js:27-30`) | No | `slack_reply_posted` (`slack_ok`, `latency_ms`, `outcome`, `request_id`) | Did the user actually get an answer? This is the product's value moment | P0 |
| Answer a question in Slack | S5 Error path | Generic error reply, or no reply at all (`handlers/messageHandler.js:31-37`) | No | `slack_handler_error` (`error_class`, `failed_step`, `request_id`) | How often does the bot fail, and at which step? | P0 |
| Answer a question in Slack | S6 `/ask-ai` answer | Slash command acknowledged, answered in channel (`handlers/messageHandler.js:40-53`) | No | `ask_ai_command_received` and `ask_ai_response_posted` (`user_id`, `latency_ms`, `slack_ok`), plus `ask_ai_error` (`error_class`, `failed_step`) | Is the second entry point used enough to justify its support cost? | P2 |

Step S6 has four internal stages: acknowledgement, completion, response, and error.
It counts as one step because it is one user action. The two events plus the error
event carry the stage as `failed_step`, so the stages are still measurable.

The subtype filter at `handlers/messageHandler.js:13-15` is not a seventh step. It
is an internal gate that drops non-`bot_message` subtypes silently, so raw Slack
volume overstates traffic. Emit `slack_message_skipped_subtype` to quantify the
difference and to keep the S1 denominator honest.

## Placeholder and non-functional content (not counted)

The website is scaffold content, so no visitor can complete a journey there. The
code holds this evidence:

| Evidence | Location |
| --- | --- |
| `Event Name` as the page title, logo, and footer | `website/index.html:6,13,91` |
| `Date TBD · City, Venue` in the hero | `website/index.html:27` |
| `Describe the event: the theme, the format, and what attendees walk away with.` | `website/index.html:41` |
| `Speaker cards are generated from speakers.js. Add a speaker by adding one entry there.` | `website/index.html:54` |
| `Venue and address go here.` / `Answer goes here.` / `Link to it here.` | `website/index.html:75-77` |
| Two speaker entries with empty `title`, `company`, and `bio` | `website/speakers.js:5-6` |

The last two CTAs also have no destination: `Get tickets` and the header
`Register` scroll to `#register`, and `Register now` has `href="#"`. The
`#register` section has no form and no backend.

**What must exist before these steps become a real journey:** a real event
identity and copy, a registration destination with a ticketing backend, speaker
data with a reason to click a card, and hosting whose request logs can be read or
a consent decision for a client-side script.

| Feature | What the code does today | What must exist first | Event to add later |
| --- | --- | --- | --- |
| W1 Page view | Static HTML, no analytics script | Readable host logs, or an approved client script | `web_page_view` |
| W2 In-page anchor navigation | Links scroll to sections; no new document load | Real content in each section | `web_section_view` |
| W3 Speaker grid render | Builds 2 cards from `speakers.js` | Real speaker data | `web_speaker_grid_rendered` |
| W4 Speaker card click | `<article>` with no link and no listener (`main.js:6-19`) | A clickable card and a destination | `web_speaker_card_clicked` |
| W5 Header Register CTA | `href="#register"`, no form (`index.html:19`) | Registration destination | `web_cta_clicked` (`cta_id = nav_register`) |
| W6 Hero Get tickets CTA | `href="#register"`, no form (`index.html:31`) | Registration destination | `web_cta_clicked` (`cta_id = hero_get_tickets`) |
| W7 Hero Meet the speakers CTA | `href="#speakers"` (`index.html:32`) | Real speaker content | `web_cta_clicked` (`cta_id = hero_meet_speakers`) |
| W8 Register now CTA | `href="#"`, no destination (`index.html:85`) | Ticketing endpoint | `web_cta_clicked` (`cta_id = register_now`) |

Instrumenting a placeholder page would produce numbers about a page that cannot
convert. These rows are recorded so the work is not lost, not counted as coverage.

## Largest gaps, ranked

1. **Reply outcome (S3, S4).** The bot's core promise is an answer in the thread.
   Today there is no event, no timestamp, and no correlation ID on that path, so
   the team cannot compute a reply success rate, a latency percentile, or a
   completion volume. Worse, `services/openAiClient.js:39` returns a fixed
   sentence (`"I was unable to generate a response. Please try again."`) when the
   model returns no text, and the handler posts that sentence as a normal success.
   A silent model failure therefore looks like a delivered answer to any observer
   of Slack history. This is the first gap to close.
2. **Error path (S5).** Errors reach only `logger.error(error)` with no channel,
   user, request ID, or failed step. The error reply is itself sent inside the
   `catch` block with no second `try`, so a failed error reply leaves no trace at
   all. An acknowledgement failure in `/ask-ai` sits outside the `try` entirely.
3. **Eligible traffic (S1).** No event on receipt, and the subtype filter drops
   messages without a trace, so there is no denominator for any rate.
4. **`/ask-ai` usage (S6).** No data on a second entry point that the README
   advertises as a feature.

The website's missing registration destination is a product gap, not a coverage
gap, and it does not appear in this ranking.

## Questions that cannot be answered today

| Question | Why it cannot be answered | Smallest instrumentation change |
| --- | --- | --- |
| How many messages does the bot answer per day? | No event on message receipt; Slack history shows replies, not attempts or skips | One `slack_message_received` event at `handlers/messageHandler.js:11`, before the filter |
| What share of attempts produce a real answer? | The fallback sentence is posted as normal text; no outcome field exists | Emit `outcome = fallback_text` at `services/openAiClient.js:39`, and `slack_reply_posted` after `say` |
| How fast is the bot? | No timestamps are recorded around the thread read or the model call | Record `Date.now()` before and after `getChatCompletion`, emit `latency_ms` |
| How often does the bot fail, and where? | Two `logger.error` calls carry no context, and both catch blocks merge all failure steps into one line | One `error_class` and `failed_step` property on each of the two catch blocks |
| Does the bot fail more on long threads? | Thread length is never recorded | Add `thread_message_count` to the context event |
| Is `/ask-ai` used? | No event on command receipt or response | One event at `handlers/messageHandler.js:41` |
| How many messages are skipped by the subtype filter? | The filter returns silently | One `slack_message_skipped_subtype` event with `subtype` |

These questions are blocked until the website is functional. They are not
coverage gaps today:

| Question | Blocked by |
| --- | --- |
| How many people visit the site, and from where? | No analytics script; hosting logs unconfirmed |
| Which sections or speakers draw attention? | Placeholder content; speaker cards are not interactive |
| Do the CTAs convert? | No registration destination or ticketing backend |

## Notes and caveats

- **No traffic or volume numbers are reported.** The page copy shows `1 day`,
  `10+ speakers`, and `300 attendees` (`index.html:44-46`), but the rest of the
  page is placeholder text, so treat these as template values with no data source.
- **`speakers.js` has 2 entries**, while the page copy claims `10+ speakers`. Both
  are placeholder content. The section intro also tells developers how to edit the
  file, which confirms the page is not in a user-facing state.
- **`handlers/messageHandler.js:5`** maps a thread author to the `assistant` role
  only when `msg.user === 'assistant'`. Slack does not send that literal value as
  `user`, so bot replies enter the context as `user` messages. This is a product
  defect, not a metric gap; it is recorded because it changes what "context
  loaded" means, and it is out of scope for this documentation PR.
- **No user identity is persisted.** Slack payloads carry `user_id`, but the app
  stores nothing, so per-user cohorts and unique-user counts are impossible today.
- **Log retention and access were not verified.** The inventory does not assume
  that production logs exist, are retained, or are readable by the team.

## Proposed event properties

Keep payloads free of message content, prompts, and completions.

| Property | Applies to | Purpose |
| --- | --- | --- |
| `request_id` | All Slack events | Correlates S1-S6 into one attempt |
| `workspace_id`, `channel_id`, `channel_type` | Slack events | Segment by workspace and channel |
| `user_id` | Slack events | Unique-user counts and cohorts (store the Slack ID, not the profile) |
| `is_thread_reply`, `thread_message_count` | Slack message events | Context and cohort analysis |
| `model` | Completion events | Compare model versions |
| `latency_ms` | Context, completion, reply events | Percentiles |
| `outcome` | Completion, reply events | `ok`, `fallback_text`, `error` |
| `error_class`, `failed_step` | Error events | Attribution |
| `session_id`, `path`, `referrer_class` | Website events, only after the site is functional | Funnel and attribution |
| `cta_id` | Website CTA events, only after a destination exists | Compare placements |
| `app_version` | All events | Correlate behaviour with releases |

## Non-goals of this PR

This PR adds documentation only. It does not change any file under
`slack-ai-app/src` or `website`, and it adds no dependency or configuration. It is
therefore independent of the open instrumentation and CI pull requests.

This inventory describes `main` at `b55a463`. An open pull request,
https://github.com/kbtest1/test-repo/pull/27, proposes instrumentation for the
Slack journey. If that pull request merges, re-check the Slack rows before you
use this table; the tracking column will be stale for any step it covers.

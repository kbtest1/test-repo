# Feature-to-metric coverage inventory

Scope: `slack-ai-app/` (Slack Bolt + OpenAI bot) and `website/` (static conference landing page).

Baseline: `main` at `b55a463`, checked on 2026-11-27.

Result: **0 of 18 journey steps are tracked today.** Neither app sends an analytics
event, and neither app writes a structured log line that a metric can be built
from.

## How the tracking state was checked

This inventory is based on reading the code, not on assumption. The checks below
were run against tracked files at `b55a463`.

| Check | Method | Result |
| --- | --- | --- |
| Analytics or telemetry library | Search of all tracked files for known analytics names (pattern below) | No matches |
| Event attributes in the page markup | `git grep -n "data-" -- website` | No matches |
| Instrumentation dependencies | `slack-ai-app/package.json` | Only `@slack/bolt`, `dotenv`, `openai`; no analytics package |
| Log statements | `git grep -n -E "console\.\|logger\." -- slack-ai-app/src website` | 2 `logger.error` calls, 2 startup `console` calls; no structured events |
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

## Coverage table

"Tracked today" is `No` for every row, because the checks above found no event
emission on any path.

| Journey | Step | User-facing feature | Tracked today | Event that would track it | Decision the metric supports | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Slack message | S1 Message received by the app | Bot receives a channel message (`messageHandler.js:11`) | No | `slack_message_received` (`channel_id`, `channel_type`, `user_id`, `is_thread_reply`, `request_id`) | Is the bot in the right channels, and how much demand exists? | P1 |
| Slack message | S2 Subtype filter passes | Non-standard message subtypes are skipped silently (`messageHandler.js:13-15`) | No | `slack_message_skipped_subtype` (`subtype`) | Correct the denominator for every rate: raw Slack traffic is not the same as eligible traffic | P2 |
| Slack message | S3 Thread context loaded | Bot reads the thread before answering (`messageHandler.js:17-24`) | No | `slack_thread_context_loaded` (`thread_message_count`, `latency_ms`, `outcome`) | Does context reading fail or slow replies, and does long context correlate with worse answers? | P1 |
| Slack message | S4 Model completion returned | OpenAI answer generated (`openAiClient.js:25-39`) | No | `slack_completion_finished` (`model`, `latency_ms`, `outcome` is `ok`, `fallback_text`, or `error`, and `context_message_count`) | Is the model fast enough, and how often does it return no usable text? | P0 |
| Slack message | S5 Reply posted in thread | Answer visible in Slack (`messageHandler.js:27-30`) | No | `slack_reply_posted` (`slack_ok`, `latency_ms`, `outcome`, `request_id`) | Did the user actually get an answer? This is the product's value moment | P0 |
| Slack message | S6 Error path | Generic error reply in thread (`messageHandler.js:31-37`) | No | `slack_handler_error` (`error_class`, `failed_step`, `request_id`) | How often does the bot fail, and at which step? | P0 |
| `/ask-ai` | S7 Command received and acknowledged | Slash command acknowledged (`messageHandler.js:41`) | No | `ask_ai_command_received` (`user_id`, `request_id`) | Is the second entry point used enough to justify its support cost? | P2 |
| `/ask-ai` | S8 Completion returned (no thread context) | Answer generated without context (`messageHandler.js:44`) | No | `ask_ai_completion_finished` (`model`, `latency_ms`, `outcome`) | Same latency and fallback question as S4, for a different input shape | P2 |
| `/ask-ai` | S9 In-channel response posted | Answer visible to the channel (`messageHandler.js:45`) | No | `ask_ai_response_posted` (`slack_ok`, `latency_ms`) | Did the command deliver an answer? | P2 |
| `/ask-ai` | S10 Error path | Ephemeral error message (`messageHandler.js:46-52`) | No | `ask_ai_error` (`error_class`, `failed_step`) | Command reliability, separate from message reliability | P2 |
| Website | W1 Page view | Landing page loads (`index.html`) | No | `web_page_view` (`path`, `referrer_class`, `session_id`) | How many people reach the site, and from where? | P2 |
| Website | W2 In-page anchor navigation | Nav and hero anchor links (`index.html:13-18,32`) | No | `web_section_view` (`section`, `source`) | Which sections do visitors actually read? | P2 |
| Website | W3 Speaker grid renders | Speaker cards built from `speakers.js` (`main.js:21-22`) | No | `web_speaker_grid_rendered` (`speaker_count`) | Does the speaker data render, and how many cards are shown? | P2 |
| Website | W4 Speaker card click | Speaker card (`main.js:6-19`) | No | `web_speaker_card_clicked` (`speaker_name`) | Which speakers draw interest? | P2 |
| Website | W5 Header Register CTA click | `Register` in the header (`index.html:19`) | No | `web_cta_clicked` (`cta_id` = `nav_register`) | Which CTA placement drives registration intent? | P1 |
| Website | W6 Hero Get tickets CTA click | `Get tickets` in the hero (`index.html:31`) | No | `web_cta_clicked` (`cta_id` = `hero_get_tickets`) | Does the main above-the-fold CTA work? | P1 |
| Website | W7 Hero Meet the speakers CTA click | `Meet the speakers` (`index.html:32`) | No | `web_cta_clicked` (`cta_id` = `hero_meet_speakers`) | Is the speaker programme a reason to engage? | P2 |
| Website | W8 Final Register CTA click | `Register now` in the `#register` section (`index.html:85`) | No | `web_cta_clicked` (`cta_id` = `register_now`) | Does the closing CTA convert intent? | P1 |

## Largest gaps, ranked

1. **Slack reply outcome (S4, S5).** The bot's core promise is an answer in the
   thread. Today there is no event, no timestamp, and no correlation ID on that
   path, so the team cannot compute a reply success rate, a latency percentile,
   or a completion volume. Worse, `openAiClient.js:39` returns a fixed sentence
   (`"I was unable to generate a response. Please try again."`) when the model
   returns no text, and the handler posts that sentence as a normal success. A
   silent model failure therefore looks like a delivered answer to any observer
   of Slack history. This is the first gap to close.
2. **Slack error path (S6, S10).** Errors reach only `logger.error(error)` with
   no channel, user, request ID, or failed step. The error reply is itself sent
   inside the `catch` block with no second `try`, so a failed error reply leaves
   no trace at all.
3. **Website register CTA (W5, W6, W8).** All three register CTAs point to
   `#register` or to `#`; the final `Register now` button has `href="#"`, so it
   has no destination. Intent cannot be measured, and the funnel has no end
   event even if a click were tracked.
4. **Message volume and eligible denominator (S1, S2).** The subtype filter at
   `messageHandler.js:13-15` drops every non-`bot_message` subtype without a
   trace. Raw Slack traffic therefore overstates the messages the bot acts on.
5. **Website engagement (W1-W4, W7).** Zero page-level or section-level data.
6. **`/ask-ai` usage (S7-S10).** Zero data on a second entry point that the
   README advertises as a feature.

## Questions that cannot be answered today

| Question | Why it cannot be answered | Smallest instrumentation change |
| --- | --- | --- |
| How many messages does the bot answer per day? | No event on message receipt; Slack history shows replies, not attempts or skips | One `slack_message_received` event at `messageHandler.js:11`, before the filter |
| What share of attempts produce a real answer? | The fallback sentence is posted as normal text; no outcome field exists | Emit `outcome = fallback_text` at `openAiClient.js:39`, and `slack_reply_posted` after `say` |
| How fast is the bot? | No timestamps are recorded around the thread read or the model call | Record `Date.now()` before and after `getChatCompletion`, emit `latency_ms` |
| How often does the bot fail, and where? | Two `logger.error` calls carry no context, and both catch blocks merge all failure steps into one line | One `error_class` and `failed_step` property on each of the two catch blocks |
| Does the bot fail more on long threads? | Thread length is never recorded | Add `thread_message_count` to the context event |
| Is `/ask-ai` used? | No event on command receipt or response | One event at `messageHandler.js:41` |
| How many people visit the site? | No client-side analytics script and no known hosting access log | One `web_page_view` call in `main.js`, or a hosting log export |
| Which speakers get attention? | Cards are non-interactive `<article>` elements with no links or handlers | Wrap the card or add a `click` listener, then emit one event with `speaker_name` |
| Do the CTAs convert? | No click handler anywhere, and `Register now` has `href="#"` | Give each CTA a stable `data-cta-id`, add one delegated click listener, emit `web_cta_clicked`; give the final CTA a real destination |
| How many registrations result? | No registration system or endpoint exists in this repository | Decide the ticketing destination first; it is a product gap, not an instrumentation gap |

## Notes and caveats

- **No traffic or volume numbers are reported.** The page copy shows `1 day`, `10+ speakers`, and
  `300 attendees` (`index.html:44-46`), but these are template placeholders with
  no data source. Do not report them as measured values.
- **`speakers.js` has 2 entries**, while the page copy claims `10+ speakers`.
  Either the list or the copy is placeholder content. Treat both as unverified.
- **Speaker cards are not clickable.** `main.js:6-19` builds an `<article>` with
  no link and no listener, so "speaker card click" is a step that does not exist
  in the product yet.
- **`messageHandler.js:5`** maps a thread author to the `assistant` role only when
  `msg.user === 'assistant'`. Slack does not send that literal value as `user`,
  so bot replies enter the context as `user` messages. This is a product defect, not a
  metric gap; it is recorded here because it changes what "context loaded" means,
  and it is out of scope for this documentation PR.
- **No user identity is persisted.** Slack payloads carry `user_id`, but the app
  stores nothing, so per-user cohorts and unique-user counts are impossible today.
- **Log retention and access were not verified.** The inventory does not assume
  that production logs exist, are retained, or are readable by the team.

## Proposed event properties

Keep payloads free of message content, prompts, and completions.

| Property | Applies to | Purpose |
| --- | --- | --- |
| `request_id` | All Slack events | Correlates S1-S6 or S7-S10 into one attempt |
| `workspace_id`, `channel_id`, `channel_type` | Slack events | Segment by workspace and channel |
| `user_id` | Slack events | Unique-user counts and cohorts (store the Slack ID, not the profile) |
| `is_thread_reply`, `thread_message_count` | Slack message events | Context and cohort analysis |
| `model` | Completion events | Compare model versions |
| `latency_ms` | Context, completion, reply events | Percentiles |
| `outcome` | Completion, reply events | `ok`, `fallback_text`, `error` |
| `error_class`, `failed_step` | Error events | Attribution |
| `session_id`, `path`, `referrer_class` | Website events | Funnel and attribution |
| `cta_id` | Website CTA events | Compare placements |
| `app_version` | All events | Correlate behaviour with releases |

## Non-goals of this PR

This PR adds documentation only. It does not change any file under
`slack-ai-app/src` or `website`, and it adds no dependency or configuration. It is
therefore independent of the open instrumentation and CI pull requests.

This inventory describes `main` at `b55a463`. An open pull request, #27, proposes
instrumentation for the Slack journey. If #27 merges, re-check the Slack rows
before you use this table; the tracking column will be stale for any step that
#27 covers.

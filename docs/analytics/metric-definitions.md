# Metric definitions

Companion to [feature-metric-coverage.md](./feature-metric-coverage.md).

Every metric below is **proposed**. None can be computed from the current code,
because neither app emits an event and neither app writes a structured log line
(see the coverage inventory for the checks). Each definition therefore states
what exists today as the source of truth, and what would become the source of
truth after instrumentation.

## Conventions

- **Day boundary:** UTC calendar day. A daily report for 2026-11-26 covers
  `2026-11-26T00:00:00Z` to `2026-11-26T23:59:59Z`.
- **Counting unit:** one event per `request_id` for attempt-based metrics. Counts
  are distinct, not raw event rows, so a retried delivery cannot double count.
- **Exclusions:** the test workspace, test channels, and the bot's own posts.
  The exclusion list must be configuration, not a code constant. Until the list
  exists, every number is an estimate that includes test traffic.
- **Small samples:** label any rate computed from fewer than 30 attempts as
  `small sample`. Do not publish a percentage for it.
- **Sensitive data:** no message text, prompt, completion text, or user profile
  enters an event. Slack `user_id` is the only identifier, and it stays inside
  company-internal dashboards.
- **Percentiles:** nearest-rank, computed over raw `latency_ms` values, never over
  pre-averaged buckets.
- **Website dependency:** M1 to M7 depend on the Slack app only. M8, M9, and M10
  depend on the website being functional. The site is scaffold content today, so
  those three are definitions for later, not instrumentation targets now. Do not
  build a dashboard on them before a user can complete a journey there.

## Metric index

| ID | Metric | Answers | Computable today? | Depends on a functional website |
| --- | --- | --- | --- | --- |
| M1 | Messages handled per day | How much demand the bot serves | No | No |
| M2 | Reply success rate | Whether the bot answered | No | No |
| M3 | Model latency (p50, p95) | Whether the bot is fast enough | No | No |
| M4 | Error rate | How often and where the bot fails | No (partial logs only) | No |
| M5 | Completion fallback rate | How often the model returns no usable text | No | No |
| M6 | Thread context load failure rate | Whether context retrieval is a failure source | No | No |
| M7 | `/ask-ai` usage | Whether the slash command earns its support cost | No | No |
| M8 | Website page views | Site reach and traffic mix | No | Yes |
| M9 | Speaker section engagement rate | Whether visitors reach the speaker programme | No | Yes |
| M10 | Register CTA click-through rate | Whether the page drives registration intent | No | Yes |

## M1 — Messages handled per day

| Field | Value |
| --- | --- |
| Definition | The number of Slack message events for which the bot attempted an answer, including attempts that ended in an error reply. An attempt starts when a message passes the subtype filter at `handlers/messageHandler.js:13-15` and ends after `say` resolves or rejects. |
| Numerator | Count of distinct `request_id` values that reached at least one of `slack_completion_finished`, `slack_handler_error`, or `slack_reply_posted`. |
| Denominator | Not applicable. This is a count metric, not a ratio. |
| Cohort | All channels where the app is a member, excluding test channels. Report total, plus a split by `channel_type` (channel, group, direct message) and by `is_thread_reply`. |
| Reporting window | Daily, compared with the trailing 7-day median for the same weekday. |
| Source of truth today | None for attempts. Slack message history shows messages the bot posted, which is a lower bound only: a skipped message, a failed attempt, and a failed error reply all leave no bot message. |
| Source of truth after instrumentation | Event store, `slack_completion_finished` plus `slack_handler_error`, deduplicated on `request_id`. |
| Notes | Do not substitute raw Slack message volume. The subtype filter drops edits, joins, and other non-`bot_message` subtypes, so raw volume overstates handled messages. Emit `slack_message_skipped_subtype` to quantify the difference. |

## M2 — Reply success rate

| Field | Value |
| --- | --- |
| Definition | The share of answered-message attempts that ended with a bot reply containing real model output, delivered successfully to Slack. An attempt counts as a success only when all three conditions hold: the model returned `output_text`, the reply text is not the fallback sentence, and `say` resolved with `ok`. |
| Numerator | Count of distinct `request_id` values with `slack_reply_posted` where `outcome = ok` and `slack_ok = true`. |
| Denominator | Count of distinct `request_id` values with `slack_completion_finished` or `slack_handler_error` (that is, M1). |
| Cohort | Per workspace, per channel, and split by `is_thread_reply` and by `model`. Exclude the test workspace and test channels. |
| Reporting window | 7-day rolling, reported each day, with the daily value alongside it. |
| Source of truth today | None. Slack history cannot separate a real answer from the fixed fallback sentence at `services/openAiClient.js:39` without reading every reply's text, and even then the sentence is not unique to the fallback path. |
| Source of truth after instrumentation | Event store, join of `slack_reply_posted` and `slack_completion_finished` on `request_id`, with `outcome` set at the source. |
| Notes | This metric is misleading if `outcome` is derived from the reply text after the fact. Set `outcome = fallback_text` at the point where the fallback is returned. The complementary view is M5; a rise in M5 depresses M2 by construction. |

## M3 — Model latency

| Field | Value |
| --- | --- |
| Definition | The p50 and p95 wall-clock time of one model call, measured from immediately before `client.responses.create` to the moment the response resolves, for calls that return non-fallback text. Reported per journey, because the message path includes thread context and the `/ask-ai` path does not. |
| Numerator | Not applicable. This is a distribution metric. The sample size is the number of qualifying calls in the window and must be reported with the percentiles. |
| Denominator | Not applicable. Report `n` (qualifying calls) for every percentile. |
| Cohort | Split by `model`, by journey (`slack_message`, `ask_ai`), and by `context_message_count` bucket (0 for `/ask-ai`, then 1-5, 6-20, 21+; the message path always reads at least one message because `inclusive: true` is set). |
| Reporting window | 7-day rolling, reported each day, with the daily p50 and p95. |
| Source of truth today | None. No timestamps are recorded around the call, and the OpenAI dashboard reports usage and tokens for the account, not per-request latency tied to a Slack message. |
| Source of truth after instrumentation | Event store, percentile of `latency_ms` on `slack_completion_finished` and `ask_ai_completion_finished`. |
| Notes | Measure on the server, not in Slack. Slack's own delivery time is not model latency. If the OpenAI client exposes a request ID, store it as `provider_request_id` so a slow tail can be traced to a provider incident. End-to-end latency (M1 attempt start to reply posted) should be reported as a separate number, not merged into this metric. |

## M4 — Error rate

| Field | Value |
| --- | --- |
| Definition | The share of attempts that threw an exception and reached a `catch` block, per journey. An error is counted once per `request_id`, at the step where it first failed. |
| Numerator | Count of distinct `request_id` values with `slack_handler_error` (message journey) or `ask_ai_error` (`/ask-ai` journey). |
| Denominator | M1 for the message journey; count of `ask_ai_command_received` for the `/ask-ai` journey. |
| Cohort | Split by `error_class`, by `failed_step` (`thread_context`, `model`, `reply`), by channel, and by journey. |
| Reporting window | Daily, with a 7-day rolling value and the count of errors by `error_class`. |
| Source of truth today | Partial. `handlers/messageHandler.js:32` and `:47` call `logger.error(error)`, which gives a count of thrown errors if the logs are retained, but no attempt denominator, no channel, no user, and no failed step. An error that occurs inside the error reply itself is not logged at all, because the `await say` and `await respond` calls sit inside `catch` with no second `try`. |
| Source of truth after instrumentation | Event store, both error events joined to their attempt denominator on `request_id`. |
| Notes | `error_class` must be a bounded set (for example `auth`, `rate_limit`, `timeout`, `slack_api`, `upstream_5xx`, `unknown`). Do not send the raw error message: it can contain tokens or request data. The `ack()` call at `handlers/messageHandler.js:41` sits outside the `try`, so an acknowledgement failure never reaches `ask_ai_error`; it appears only in Bolt's own logs and must be checked separately. |

## M5 — Completion fallback rate

| Field | Value |
| --- | --- |
| Definition | The share of model calls that returned the hard-coded fallback sentence instead of usable `output_text`, as produced at `services/openAiClient.js:39`. These are silent failures: the handler treats them as success and posts them as a normal reply. |
| Numerator | Count of distinct `request_id` values with `slack_completion_finished` or `ask_ai_completion_finished` where `outcome = fallback_text`. |
| Denominator | Count of all completion events for the journey. |
| Cohort | Split by `model`, journey, and `context_message_count` bucket. |
| Reporting window | Daily, with a 7-day rolling value. |
| Source of truth today | None. The fallback value is returned as an ordinary string, so it is indistinguishable from model output in Slack history and in the logs. |
| Source of truth after instrumentation | Event store, `outcome = fallback_text`, set where the fallback is constructed. |
| Notes | Do not compute this by string-matching replies after the fact. The string can change, and a user can post the same sentence. |

## M6 — Thread context load failure rate

| Field | Value |
| --- | --- |
| Definition | The share of message attempts where `client.conversations.replies` failed, causing the attempt to end without a model call. |
| Numerator | Count of distinct `request_id` values with `slack_handler_error` where `failed_step = thread_context`. |
| Denominator | M1. |
| Cohort | Split by `channel_type`, `is_thread_reply`, and whether the thread had more than one message. |
| Reporting window | 7-day rolling, reported daily. |
| Source of truth today | None. The single `catch` at `handlers/messageHandler.js:31` merges context failures, model failures, and reply failures into one `logger.error` line, so they cannot be separated after the fact. |
| Source of truth after instrumentation | Event store, `failed_step` on `slack_handler_error`. |
| Notes | Requires `failed_step` at the source. Without it, this metric cannot be backfilled from existing logs. |

## M7 — `/ask-ai` usage

| Field | Value |
| --- | --- |
| Definition | The number of `/ask-ai` invocations per day and the number of distinct users who invoked it, plus the success rate of those invocations. |
| Numerator | Count of distinct `request_id` values with `ask_ai_response_posted` where `outcome = ok`, and count of distinct `user_id` values with `ask_ai_command_received`. |
| Denominator | Count of distinct `request_id` values with `ask_ai_command_received`. |
| Cohort | Per workspace, per user, excluding test users. |
| Reporting window | Daily, with a 7-day rolling value. |
| Source of truth today | None. `handlers/messageHandler.js:40-53` emits no event and no log line on the success path. |
| Source of truth after instrumentation | Event store, `/ask-ai` events joined on `request_id`. |
| Notes | Slack slash command payloads are a separate traffic class from channel messages. Never merge the two denominators. |

## M8 — Website page views

**Depends on a functional website:** yes. The page is placeholder content and has
no analytics script. Do not instrument it until the site has real content and a
hosting setup whose logs, or an approved client script, can be read.

| Field | Value |
| --- | --- |
| Definition | The number of page loads of the landing page per day, and the number of distinct sessions, split by path and by referrer class (direct, search, social, internal). |
| Numerator | Count of `web_page_view` events; distinct sessions by `session_id`. |
| Denominator | Not applicable. This is a count metric. |
| Cohort | All visitors, excluding internal and test traffic. Split by `path`, `referrer_class`, and device class. |
| Reporting window | Daily, with a 7-day rolling value, and a week-over-week comparison. |
| Source of truth today | None that this repository can confirm. The site is static with no analytics script (`website/main.js` only renders speaker cards and the footer year). Hosting is not defined in the repository, so we could not verify whether a host or CDN keeps request logs. If such logs exist, they become the only interim source. |
| Source of truth after instrumentation | Event store, `web_page_view`. |
| Notes | The page uses in-page anchors (`#about`, `#speakers`, and others), which do not load a new document. A page-load-only counter will therefore report one view per session, not one view per section. Do not treat anchor use as a page view. |

## M9 — Speaker section engagement rate

**Depends on a functional website:** yes. Speaker cards hold empty titles,
companies, and bios, and they are not interactive, so there is no real
engagement to measure.

| Field | Value |
| --- | --- |
| Definition | The share of sessions with a page view that reached the speaker section, by anchor navigation or by scrolling the section into view. |
| Numerator | Count of distinct `session_id` values with `web_section_view` where `section = speakers`. |
| Denominator | Count of distinct `session_id` values with `web_page_view`. |
| Cohort | All sessions, excluding internal and test traffic. Split by `referrer_class`. |
| Reporting window | 7-day rolling, reported daily. |
| Source of truth today | None. There is no section tracking and no scroll listener. |
| Source of truth after instrumentation | Event store, `web_section_view` with `section` and `source` (`anchor` or `scroll`). |
| Notes | A speaker card click cannot be measured today because the cards are non-interactive `<article>` elements with no link and no listener (`website/main.js:6-19`). If cards become links, track `web_speaker_card_clicked` as a separate step from section engagement. |

## M10 — Register CTA click-through rate

**Depends on a functional website:** yes. No CTA has a destination that can
complete a registration, so clicks could be counted but never converted.

| Field | Value |
| --- | --- |
| Definition | The share of sessions with a page view that clicked any register call to action: the header `Register`, the hero `Get tickets`, or the closing `Register now`. |
| Numerator | Count of distinct `session_id` values with `web_cta_clicked` where `cta_id` is one of `nav_register`, `hero_get_tickets`, `register_now`. |
| Denominator | Count of distinct `session_id` values with `web_page_view`. |
| Cohort | All sessions, excluding internal and test traffic. Split by `cta_id`, `referrer_class`, and device class. |
| Reporting window | 7-day rolling, reported daily. |
| Source of truth today | None. There is no click handler on any CTA. In addition, the closing CTA at `website/index.html:85` has `href="#"`, so it has no destination and cannot lead to a registration. |
| Source of truth after instrumentation | Event store, `web_cta_clicked`, plus a registration-complete event from the chosen ticketing destination. |
| Notes | Click-through is not conversion. There is no registration system in this repository, so the terminal conversion metric has no source of truth at all until a ticketing destination is chosen. Report clicks as intent only, and never label them `registrations`. |

## Validation before any metric is called complete

1. **Reconcile counts.** Compare one day of stored events with the Slack history
   count of bot replies in the same window. Investigate every gap and record its
   cause before you publish the metric; a gap is a defect in the events or in the
   query, not a traffic fact.
2. **Deduplicate.** Confirm that a redelivered Slack event with the same
   `request_id` produces one counted attempt.
3. **Check identities.** Confirm that `user_id` counts match Slack's own
   membership for a sampled channel, and that no profile fields are stored.
4. **Confirm exclusions.** Send a message from the test workspace and confirm that
   no metric changes.
5. **Compare model volume.** Compare completion counts with the OpenAI dashboard
   usage for the same period. Expect a difference for retries and for other
   applications that share the API key; record the difference rather than
   adjusting the event data.
6. **Recompute by hand.** For a single day, recompute M2 and M4 from raw events
   and compare them with the dashboard. A mismatch blocks publication.

## Open questions

These need an owner decision before implementation. This document does not
assume an answer.

- **Analytics destination.** No analytics project exists for this repository. The
  destination must be chosen (a PostHog project, or structured logs with a query
  layer) before event names become final.
- **Company KPIs.** No KPI set is documented. M2 and M4 are proposed as the
  primary health metrics because they describe the product's core promise; the
  owner must confirm this.
- **Metric definitions.** The definitions above are proposals. Each needs an
  explicit owner sign-off, especially the denominator choice for M2.
- **Registration destination.** The website has no ticketing endpoint, so no
  conversion metric is possible yet.
- **Hosting and logs.** The site's host is not defined in the repository, so we
  could not verify whether request logs exist or are retained.
- **Data retention and access.** Retention period, dashboard access, and who may
  query customer-level data are undecided.

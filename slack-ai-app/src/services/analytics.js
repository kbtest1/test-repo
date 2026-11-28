// Provider-agnostic product analytics for the Slack AI assistant.
//
// Inert until ANALYTICS_API_KEY is set. Events go to any PostHog-compatible
// capture endpoint. Two rules hold here: nothing may throw into a Slack
// handler, and only allow-listed properties leave the process, so message text,
// prompts, model output, channel names, user names and secrets cannot be sent.

const DEFAULT_HOST = 'https://us.i.posthog.com';
const MAX_STRING_LENGTH = 120;
const REQUEST_TIMEOUT_MS = 2000;

export const ANALYTICS_EVENTS = Object.freeze({
  MESSAGE_RECEIVED: 'message_received',
  THREAD_CONTEXT_LOADED: 'thread_context_loaded',
  MODEL_COMPLETION_FINISHED: 'model_completion_finished',
  REPLY_POSTED: 'reply_posted',
  HANDLER_FAILED: 'handler_failed',
  ASK_AI_COMMAND_INVOKED: 'ask_ai_command_invoked'
});

// Slack ids, coarse buckets, timings and outcomes are enough for funnels;
// free text is never on the list.
const ALLOWED_PROPERTY_KEYS = [
  'team_id',
  'user_id',
  'source',
  'outcome',
  'failed_step',
  'error_type',
  'duration_ms',
  'success',
  'thread_reply',
  'message_length_bucket',
  'response_length_bucket',
  'context_message_count'
];

/** Coarse length bucket, so exact message sizes never leave the process. */
export function bucketTextLength(text) {
  const length = typeof text === 'string' ? text.length : 0;

  if (length === 0) return 'empty';
  if (length <= 200) return '1-200';
  if (length <= 600) return '201-600';
  if (length <= 2000) return '601-2000';
  return '2001+';
}

/** Drops unknown keys, non-scalar values and over-long strings. */
export function sanitizeProperties(properties = {}) {
  const clean = {};

  for (const key of ALLOWED_PROPERTY_KEYS) {
    const value = properties[key];

    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      clean[key] = value;
    } else if (typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING_LENGTH) {
      clean[key] = value;
    }
  }

  return clean;
}

/** Creates a client. Everything is injectable so tests run without a network. */
export function createAnalytics({ env = process.env, fetchImpl, now = () => Date.now() } = {}) {
  const transport = fetchImpl;

  // Resolved per call: dotenv may load .env after import, and tests change the
  // environment between cases.
  function resolveConfig() {
    const apiKey = typeof env.ANALYTICS_API_KEY === 'string' ? env.ANALYTICS_API_KEY.trim() : '';

    if (!apiKey) return null;

    const rawHost =
      typeof env.ANALYTICS_HOST === 'string' && env.ANALYTICS_HOST.trim()
        ? env.ANALYTICS_HOST.trim()
        : DEFAULT_HOST;

    let parsedHost;

    try {
      parsedHost = new URL(rawHost);
    } catch {
      return null;
    }

    // The key travels with every request, so plain HTTP is refused off-localhost.
    const isLocalHost = parsedHost.hostname === 'localhost' || parsedHost.hostname === '127.0.0.1';

    if (parsedHost.protocol !== 'https:' && !isLocalHost) return null;

    return { apiKey, host: rawHost.replace(/\/+$/, '') };
  }

  function isEnabled() {
    try {
      return resolveConfig() !== null;
    } catch {
      return false;
    }
  }

  function identify({ teamId, userId } = {}) {
    return {
      ...(teamId ? { team_id: teamId } : {}),
      ...(userId ? { user_id: userId } : {})
    };
  }

  /** Sends one event; returns false when analytics is off or anything failed. */
  function capture(event, properties = {}) {
    try {
      if (!Object.values(ANALYTICS_EVENTS).includes(event)) return false;

      const config = resolveConfig();
      if (!config) return false;

      const clean = sanitizeProperties(properties);
      const distinctId =
        clean.team_id && clean.user_id
          ? `${clean.team_id}:${clean.user_id}`
          : clean.user_id || clean.team_id || 'unknown-slack-identity';
      const send = transport ?? globalThis.fetch;

      if (typeof send !== 'function') return false;

      const sendOptions = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: config.apiKey,
          event,
          distinct_id: distinctId,
          properties: clean,
          timestamp: new Date(now()).toISOString()
        })
      };

      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        sendOptions.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      }

      // Fire and forget: a slow or failing provider must never delay a reply.
      Promise.resolve()
        .then(() => send(`${config.host}/capture/`, sendOptions))
        .catch(() => {});

      return true;
    } catch {
      return false;
    }
  }

  return { capture, identify, isEnabled };
}

/** Process-wide client configured from the environment. */
export const analytics = createAnalytics();

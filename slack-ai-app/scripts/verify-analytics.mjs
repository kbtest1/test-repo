#!/usr/bin/env node
// One-command ingestion check for the analytics pipeline.
//
// Sends a single synthetic message_received event through the same analytics
// module the app uses, prints the HTTP status and the provider response, and
// exits non-zero when no key is configured or the request fails.
//
// It proves that the transport works and that the endpoint accepts the event.
// It does not prove dashboard rendering, property typing or that the event
// reaches a specific insight.

import { config } from 'dotenv';
import { ANALYTICS_EVENTS, createAnalytics } from '../src/services/analytics.js';

config();

// Clearly marked so the event is easy to find and delete in the project.
const TEST_TEAM_ID = 'T_VERIFY_ANALYTICS';
const TEST_USER_ID = 'U_VERIFY_ANALYTICS';
const MAX_RESPONSE_LENGTH = 500;

function describeSend(result) {
  if (result.error) {
    return `Request failed: ${result.error}`;
  }

  const body = result.body ? result.body.slice(0, MAX_RESPONSE_LENGTH) : '(empty response body)';
  return `Status: ${result.status}\nResponse: ${body}`;
}

async function main() {
  let settle;
  const delivered = new Promise((resolve) => {
    settle = resolve;
  });

  const fetchImpl = async (url, init) => {
    try {
      const response = await fetch(url, init);
      const body = await response.text();
      settle({ status: response.status, ok: response.ok, body });
      return response;
    } catch (error) {
      settle({ status: 0, ok: false, error: error?.message ?? String(error) });
      throw error;
    }
  };

  const client = createAnalytics({ fetchImpl });

  if (!client.isEnabled()) {
    console.error('No analytics key configured.');
    console.error('Set ANALYTICS_API_KEY in the environment or .env, then run this command again.');
    process.exitCode = 1;
    return;
  }

  const accepted = client.capture(ANALYTICS_EVENTS.MESSAGE_RECEIVED, {
    team_id: TEST_TEAM_ID,
    user_id: TEST_USER_ID,
    source: 'verification',
    message_length_bucket: '1-200',
    thread_reply: false
  });

  if (!accepted) {
    console.error('The analytics module refused the event, so nothing was sent.');
    console.error('Check ANALYTICS_HOST and the event name, then run this command again.');
    process.exitCode = 1;
    return;
  }

  console.log(`Event:    ${ANALYTICS_EVENTS.MESSAGE_RECEIVED}`);
  console.log(`Identity: ${TEST_TEAM_ID}:${TEST_USER_ID}`);

  const result = await delivered;
  console.log(describeSend(result));

  if (!result.ok) {
    process.exitCode = 1;
    return;
  }

  console.log('Accepted by the endpoint. Check the analytics project for the event above.');
}

await main();

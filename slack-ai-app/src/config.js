import { config } from 'dotenv';

// Load .env once, before any module reads process.env. Keep the output quiet so
// a run without a .env file does not print a dotenv banner before our own
// missing-variable report.
config({ quiet: true });

export const REQUIRED_ENV_VARS = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_APP_TOKEN',
  'OPENAI_API_KEY'
];

export function getMissingEnvVars(env = process.env) {
  return REQUIRED_ENV_VARS.filter((name) => {
    const value = env[name];
    return typeof value !== 'string' || value.trim() === '';
  });
}

export function formatMissingEnvMessage(missing) {
  return [
    `Missing required environment variables: ${missing.join(', ')}`,
    'Set every listed value in .env in the folder you run this command from (copy .env.example), then run the command again. An exported empty value overrides .env.'
  ].join('\n');
}

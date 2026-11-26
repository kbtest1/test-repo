import { formatMissingEnvMessage, getMissingEnvVars } from './config.js';

async function main() {
  // Validate the environment before any third-party module is loaded, so a
  // clean checkout always reports the missing variable names instead of a
  // dependency stack trace.
  const missingEnvVars = getMissingEnvVars();

  if (missingEnvVars.length > 0) {
    // eslint-disable-next-line no-console
    console.error(formatMissingEnvMessage(missingEnvVars));
    // Set the code instead of exiting, so the message always flushes.
    process.exitCode = 1;
    return;
  }

  const { startApp } = await import('./app.js');

  await startApp();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start Slack AI Assistant', error);
  process.exit(1);
});

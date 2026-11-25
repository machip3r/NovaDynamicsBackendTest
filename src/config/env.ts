export function readConfig(env: NodeJS.ProcessEnv) {
  const port = Number(env.PORT ?? '3000');

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return { port };
}

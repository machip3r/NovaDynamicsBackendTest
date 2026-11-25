import { createApp } from './app.ts';
import { readConfig } from './config/env.ts';

const { port } = readConfig(process.env);

createApp().listen(port, (error) => {
  if (error) {
    console.error(`Could not start the API on port ${port}.`, error);
    process.exitCode = 1;
    return;
  }

  console.log(`API listening on port ${port}`);
});

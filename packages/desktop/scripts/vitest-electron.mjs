import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const electronPath = require('electron');
const vitestEntry = require.resolve('vitest/vitest.mjs');

const argv = process.argv.slice(2);

const child = spawn(electronPath, [vitestEntry, ...argv], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
});

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code);
  if (signal) process.exit(1);
  process.exit(1);
});


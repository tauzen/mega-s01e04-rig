import { serve } from '@hono/node-server';
import { writeFileSync } from 'node:fs';
import { createApp } from '../src/app.js';

const readyFile = process.argv[2];
if (!readyFile) throw new Error('A temporary readiness file path is required.');

// Export only: no heartbeat, .env loading, or listener on the public interfaces.
serve({ fetch: createApp().fetch, hostname: '127.0.0.1', port: 8787 }, () => {
  writeFileSync(readyFile, 'ready\n');
});

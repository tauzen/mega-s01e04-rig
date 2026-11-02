import { Hono } from 'hono';
import type { NightReader } from './types.js';

export function registerDigestJson(app: Hono, runsDir: string, readNight: NightReader): void {
  app.get('/api/digest/:night', (c) => {
    const result = readNight(runsDir, c.req.param('night'));
    if (result === null) return c.json({ error: 'Night not found' }, 404);

    return c.json(result);
  });
}

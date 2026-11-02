import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { NightReader } from '../src/digest/types.js';
import { readStatus } from '../src/status.js';
import { StatusBoard } from '../src/views/status.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

describe('status board digest counts', () => {
  it('links each night and displays valid event counts with missing values as dashes', async () => {
    const readNight: NightReader = (_runsDir, night) => {
      if (night === '2026-10-28') {
        return {
          rows: [],
          badLines: 1,
          counts: { ok: 4, retry: 2, fail: 1 },
        };
      }
      return null;
    };
    const app = new Hono();
    app.get('/', (c) => c.html(<StatusBoard status={readStatus(config, readNight)} />));

    const response = await app.request('/');
    const html = await response.text();

    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok events');
    expect(html).toContain('retry events');
    expect(html).toContain('fail events');
    expect(html).toContain('valid log events, not final job states');
    expect(html).toContain('<td>4</td><td>2</td><td>1</td>');
    expect(html).toContain('<td>—</td><td>—</td><td>—</td>');
  });
});

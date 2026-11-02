import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { registerDigestJson } from '../src/digest/json-route.js';
import type { DigestResult, NightReader } from '../src/digest/types.js';

const result: DigestResult = {
  rows: [
    {
      job: 'alpha',
      owner: 'Ada',
      runs: 2,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T01:00:00+01:00',
      lastAt: '2026-10-28T01:05:00+01:00',
      hasFailure: false,
    },
    {
      job: 'zeta',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'failed',
      firstAt: '2026-10-28T01:10:00+01:00',
      lastAt: '2026-10-28T01:10:00+01:00',
      hasFailure: true,
    },
  ],
  badLines: 1,
  counts: { ok: 2, retry: 1, fail: 1 },
};

function makeApp(readNight: NightReader) {
  const app = new Hono();
  registerDigestJson(app, '/runs', readNight);
  return app;
}

describe('digest JSON route', () => {
  it('returns the reader result without changing its rows or order', async () => {
    const readNight = vi.fn<NightReader>(() => result);
    const response = await makeApp(readNight).request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(result);
    expect(readNight).toHaveBeenCalledWith('/runs', '2026-10-28');
  });

  it('returns a JSON 404 when the reader has no matching night', async () => {
    const readNight: NightReader = () => null;
    const response = await makeApp(readNight).request('/api/digest/2026-10-29');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Night not found' });
  });
});

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestResult } from '../src/digest/types.js';

const tempDirs: string[] = [];

async function makeRunsDir(files: Record<string, string> = {}) {
  const runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-routes-'));
  tempDirs.push(runsDir);

  await Promise.all(
    Object.entries(files).map(([name, contents]) => writeFile(join(runsDir, name), contents)),
  );

  return runsDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function configFor(runsDir: string) {
  return {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
}

function rowContaining(html: string, job: string) {
  return html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)?.find((row) => row.includes(job));
}

describe('digest routes', () => {
  it('serves matching page and JSON data, preserving sorting, owners, offsets, and warnings', async () => {
    const runsDir = await makeRunsDir({
      '2026-10-28.jsonl': [
        JSON.stringify({ at: '2026-10-28T10:00:00-04:00', job: 'zulu-retries', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T10:00:00+02:00', job: 'zulu-retries', status: 'retry', owner: 'ops' }),
        JSON.stringify({ at: '2026-10-28T07:30:00+00:00', job: 'zulu-retries', status: 'retry', owner: 'ops' }),
        JSON.stringify({ at: '2026-10-28T08:00:00+05:30', job: 'alpha-recovered', status: 'fail', owner: 'build', error: 'compiler failed' }),
        JSON.stringify({ at: '2026-10-28T09:00:00-04:00', job: 'alpha-recovered', status: 'ok', owner: null }),
        'not json',
      ].join('\n'),
    });
    const app = createApp(configFor(runsDir));

    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/api/digest/2026-10-28'),
    ]);
    const html = await pageResponse.text();
    const result = (await jsonResponse.json()) as DigestResult;

    expect(pageResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(result.badLines).toBe(1);
    expect(result.counts).toEqual({ ok: 1, retry: 3, fail: 1 });
    expect(result.rows.map(({ job }) => job)).toEqual(['alpha-recovered', 'zulu-retries']);
    expect(result.rows[0]).toMatchObject({
      owner: null,
      runs: 2,
      retries: 0,
      lastStatus: 'ok',
      lastError: 'compiler failed',
      firstAt: '2026-10-28T08:00:00+05:30',
      lastAt: '2026-10-28T09:00:00-04:00',
      hasFailure: true,
    });
    expect(result.rows[1]).toMatchObject({
      owner: null,
      runs: 3,
      retries: 3,
      firstAt: '2026-10-28T07:30:00+00:00',
      lastAt: '2026-10-28T10:00:00-04:00',
    });

    const htmlOrder = ['alpha-recovered', 'zulu-retries'].map((job) => html.indexOf(job));
    expect(htmlOrder[0]).toBeGreaterThanOrEqual(0);
    expect(htmlOrder[1]).toBeGreaterThan(htmlOrder[0]);
    expect(html).toMatch(/(?:1 bad line|bad lines?:\s*1)/i);
    expect(html).toContain('2026-10-28T08:00:00+05:30');
    expect(html).toContain('2026-10-28T09:00:00-04:00');
    const recoveredRow = rowContaining(html, 'alpha-recovered');
    expect(recoveredRow).toContain('—');
    expect(recoveredRow).toMatch(/class="warn"/);
    expect(rowContaining(html, 'zulu-retries')).toMatch(/class="warn"/);
  });

  it('returns 404 from both routes when the night file is missing', async () => {
    const runsDir = await makeRunsDir();
    const app = createApp(configFor(runsDir));

    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/api/digest/2026-10-28'),
    ]);

    expect(pageResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('renders an empty night as “nothing ran” and returns the empty result contract', async () => {
    const runsDir = await makeRunsDir({ '2026-10-28.jsonl': '' });
    const app = createApp(configFor(runsDir));

    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/api/digest/2026-10-28'),
    ]);
    const html = await pageResponse.text();
    const result = (await jsonResponse.json()) as DigestResult;

    expect(pageResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(result).toEqual({ rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });
});

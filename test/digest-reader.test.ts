import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const empty = { rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
const event = { at: '2026-10-28T23:00:00+01:00', job: 'job', status: 'ok', owner: 'rook' };
const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-reader-'));
  tempDirs.push(dir);
  return dir;
}

function log(contents: string): string {
  const dir = tempDir();
  writeFileSync(join(dir, `${night}.jsonl`), contents);
  return dir;
}

function jsonl(events: unknown[]): string {
  return events.map((value) => JSON.stringify(value)).join('\n');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('reads the real fixture without changing it, including warning data and null owners', () => {
    const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));
    expect(readNight(runsDir, night)).toEqual({
      badLines: 1,
      counts: { ok: 10, retry: 4, fail: 1 },
      rows: [
        { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00', hasFailure: false },
        { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00', hasFailure: false },
        { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00', hasFailure: false },
        { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00', hasFailure: true },
        { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00', hasFailure: false },
      ],
    });
  });

  it.each(['', '\n\r\n \t\r\n'])('returns an empty result for empty or blank input', (contents) => {
    expect(readNight(log(contents), night)).toEqual(empty);
  });

  it('returns null for a missing night or runs directory', () => {
    const dir = tempDir();
    expect(readNight(dir, night)).toBeNull();
    expect(readNight(join(dir, 'missing'), night)).toBeNull();
  });

  it('counts malformed JSON and schema lines, ignores blank lines and continues reading', () => {
    const invalid = [
      null, [], 7, true, 'text', {},
      { ...event, at: null }, { ...event, at: 123 },
      { ...event, job: null }, { ...event, job: '' }, { ...event, job: ' \t' },
      { ...event, status: 'warning' }, { ...event, status: null },
      { ...event, owner: 7 }, { ...event, owner: {} },
      { ...event, error: 7 }, { ...event, error: {} },
      ...Object.keys(event).map((key) => Object.fromEntries(Object.entries(event).filter(([field]) => field !== key))),
    ];
    const contents = [
      '{broken', '', '  \t', jsonl(invalid),
      JSON.stringify({ ...event, owner: null, extra: { ignored: true } }),
      '{"truncated":',
      JSON.stringify({ ...event, at: '2026-10-29T00:00:00Z', error: null }),
      '',
    ].join('\r\n');
    const result = readNight(log(contents), night);
    expect(result).toMatchObject({
      badLines: invalid.length + 2,
      counts: { ok: 2, retry: 0, fail: 0 },
      rows: [{ runs: 2, owner: 'rook', lastError: null }],
    });
  });

  it.each([
    'not a date', '2026-10-28', '2026-10-28T23:00:00',
    '2026-10-28T23:00:00+24:00', '2026-10-28T23:00:00+01:60',
    '2026-10-28T24:00:00Z', '2026-10-28T23:60:00Z', '2026-10-28T23:00:60Z',
    '2026-00-28T23:00:00Z', '2026-13-28T23:00:00Z', '2026-10-00T23:00:00Z',
    '2026-02-29T23:00:00Z', '2026-02-30T23:00:00Z', '2026-04-31T23:00:00Z',
  ])('rejects invalid timestamps or missing/invalid offsets: %s', (at) => {
    expect(readNight(log(jsonl([{ ...event, at }])), night)).toEqual({ ...empty, badLines: 1 });
  });

  it('accepts leap days, fractional seconds and explicit positive, negative or UTC offsets', () => {
    const timestamps = [
      '2024-02-29T23:00:00.123Z', '2026-10-28T23:00:00+01:30', '2026-10-28T23:00:00-04:00',
    ];
    const result = readNight(log(jsonl(timestamps.map((at) => ({ ...event, at })))), night);
    expect(result).toMatchObject({ badLines: 0, counts: { ok: 3, retry: 0, fail: 0 }, rows: [{ runs: 3 }] });
  });

  it('aggregates unordered events by instant, retaining raw offsets and failures before recovery', () => {
    const contents = jsonl([
      { ...event, at: '2026-10-28T20:30:00-04:00', owner: null },
      { ...event, at: '2026-10-28T23:45:00Z', status: 'fail', error: 'old failure' },
      { ...event, at: '2026-10-29T03:15:00+04:00', owner: 'first' },
      { ...event, at: '2026-10-29T01:00:00+01:00', status: 'retry', error: '  latest error  ' },
    ]);
    expect(readNight(log(contents), night)).toEqual({
      badLines: 0,
      counts: { ok: 2, retry: 1, fail: 1 },
      rows: [{ job: 'job', owner: null, runs: 4, retries: 1, lastStatus: 'ok', lastError: '  latest error  ',
        firstAt: '2026-10-29T03:15:00+04:00', lastAt: '2026-10-28T20:30:00-04:00', hasFailure: true }],
    });
  });

  it('uses file order to break equal-instant ties for timestamps, owner, status and error', () => {
    const contents = jsonl([
      { ...event, at: '2026-10-29T01:00:00+01:00', status: 'fail', error: 'first' },
      { ...event, at: '2026-10-29T00:00:00Z', status: 'retry', error: 'last' },
      { ...event, at: '2026-10-28T20:00:00-04:00', owner: null },
    ]);
    expect(readNight(log(contents), night)?.rows).toEqual([
      { job: 'job', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: 'last',
        firstAt: '2026-10-29T01:00:00+01:00', lastAt: '2026-10-28T20:00:00-04:00', hasFailure: true },
    ]);
  });

  it('does not clear the last nonempty error with missing, null, empty or whitespace errors', () => {
    const contents = jsonl([
      { ...event, status: 'fail', error: ' keep this ' },
      { ...event, error: null }, { ...event, error: '' }, { ...event, error: ' \t' }, event,
    ]);
    expect(readNight(log(contents), night)?.rows).toMatchObject([
      { runs: 5, lastStatus: 'ok', hasFailure: true, lastError: ' keep this ' },
    ]);
  });

  it('sorts jobs by code units and safely keeps names resembling object properties', () => {
    const jobs = ['ä', 'z', 'constructor', 'a', '__proto__', 'A'];
    const result = readNight(log(jsonl(jobs.map((job) => ({ ...event, job })))), night);
    expect(result?.rows.map((row) => row.job)).toEqual(['A', '__proto__', 'a', 'constructor', 'z', 'ä']);
    expect(result?.counts).toEqual({ ok: 6, retry: 0, fail: 0 });
  });

  it.each([
    '', '.', '..', '../secret', 'nested/2026-10-28', '/2026-10-28', '..\\secret',
    '%2e%2e%2fsecret', '2026-10-28.jsonl', '2026-1-28', '2026-10-8',
    ' 2026-10-28', '2026-10-28 ', '2026-10-28\n', '2026-10-28\0',
  ])('rejects unsafe or incorrectly formatted night filenames: %j', (invalidNight) => {
    const dir = tempDir();
    const runsDir = join(dir, 'runs');
    mkdirSync(runsDir);
    writeFileSync(join(dir, 'secret.jsonl'), JSON.stringify(event));
    expect(readNight(runsDir, invalidNight)).toBeNull();
  });

  it('allows non-ENOENT filesystem errors to propagate rather than reporting missing data', () => {
    const dir = tempDir();
    const notADirectory = join(dir, 'file');
    writeFileSync(notADirectory, 'not a directory');
    expect(() => readNight(notADirectory, night)).toThrow();
  });
});

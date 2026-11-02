import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestResult, DigestRow, DigestStatus, NightReader } from './types.js';

interface RunEvent {
  at: string;
  instant: number;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
}

// Require an explicit offset, rather than interpreting a timestamp in the host's timezone.
function timestampInstant(at: string): number | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(at);
  if (!parts) return null;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]) return null;

  const instant = Date.parse(at);
  return Number.isFinite(instant) ? instant : null;
}

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.at !== 'string' ||
    typeof record.job !== 'string' || record.job.trim().length === 0 ||
    (record.status !== 'ok' && record.status !== 'retry' && record.status !== 'fail') ||
    (typeof record.owner !== 'string' && record.owner !== null) ||
    (record.error !== undefined && record.error !== null && typeof record.error !== 'string')
  ) return null;

  const instant = timestampInstant(record.at);
  if (instant === null) return null;
  return {
    at: record.at,
    instant,
    job: record.job,
    status: record.status,
    owner: record.owner,
    error: typeof record.error === 'string' ? record.error : null,
  };
}

export const readNight: NightReader = (runsDir, night) => {
  // The length check also rejects a final newline, which `$` alone would accept.
  if (night.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const result: DigestResult = { rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
  const events: RunEvent[] = [];
  for (const line of contents.split('\n')) {
    if (line.trim().length === 0) continue;
    const event = parseEvent(line);
    if (event === null) {
      result.badLines += 1;
      continue;
    }
    events.push(event);
    result.counts[event.status] += 1;
  }

  // Stable sorting makes the later file line win when instants are equal.
  events.sort((a, b) => a.instant - b.instant);
  const rows = new Map<string, DigestRow>();
  for (const event of events) {
    let row = rows.get(event.job);
    if (!row) {
      row = {
        job: event.job,
        owner: event.owner,
        runs: 0,
        retries: 0,
        lastStatus: event.status,
        lastError: null,
        firstAt: event.at,
        lastAt: event.at,
        hasFailure: false,
      };
      rows.set(event.job, row);
    }
    row.runs += 1;
    if (event.status === 'retry') row.retries += 1;
    if (event.status === 'fail') row.hasFailure = true;
    row.owner = event.owner;
    row.lastStatus = event.status;
    row.lastAt = event.at;
    if (event.error !== null && event.error.trim().length > 0) row.lastError = event.error;
  }
  result.rows = [...rows.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return result;
};

export type DigestStatus = 'ok' | 'retry' | 'fail';

/** One job's valid events, ordered by chronological instant rather than log order. */
export interface DigestRow {
  job: string;
  /** Owner on the latest event, including null (never carry an older owner forward). */
  owner: string | null;
  /** All valid events for the job, including retries and failures. */
  runs: number;
  /** Number of valid events whose status is retry. */
  retries: number;
  lastStatus: DigestStatus;
  /** Last nonempty error chronologically, even if the final event is ok; otherwise null. */
  lastError: string | null;
  /** Earliest event's original timestamp, with its raw offset retained for display. */
  firstAt: string;
  /** Latest event's original timestamp, with its raw offset retained for display. */
  lastAt: string;
  /** True if any valid event failed, even when lastStatus is ok. */
  hasFailure: boolean;
}

/** Counts of valid events across the night, not counts of jobs or final statuses. */
export interface DigestCounts {
  ok: number;
  retry: number;
  fail: number;
}

export interface DigestResult {
  /** One row per job, sorted ascending by job using string/code-unit order. */
  rows: DigestRow[];
  /** Invalid JSON or schema lines; blank lines are ignored. */
  badLines: number;
  counts: DigestCounts;
}

/**
 * Synchronous reader contract. Implemented in reader.ts as:
 *   export const readNight: NightReader = (runsDir, night) => ...;
 * Explicit signature: readNight(runsDir: string, night: string): DigestResult | null.
 *
 * Reads runsDir/<night>.jsonl. Return null for a missing file or a night that does
 * not match strict YYYY-MM-DD (/^\d{4}-\d{2}-\d{2}$/); never use an invalid night
 * as a path. An empty file returns { rows: [], badLines: 0,
 * counts: { ok: 0, retry: 0, fail: 0 } }, not null.
 *
 * A valid line is a JSON object with a parseable timestamp string `at`, a
 * nonempty string `job`, a DigestStatus `status`, `owner` as string or null,
 * and optional `error` as string or null. Unknown fields are ignored. Count
 * invalid JSON/schema lines in badLines and continue; ignore blank lines.
 * Only valid events contribute to rows and counts.
 *
 * Compare timestamps as chronological instants, but return their original raw
 * strings (including offsets). Equal instants retain file order: the earlier
 * line is first and the later line wins latest status, owner and error.
 * lastError is the latest error whose trimmed value is nonempty, returned
 * unmodified; missing, null or whitespace-only errors do not clear it.
 */
export interface NightReader {
  (runsDir: string, night: string): DigestResult | null;
}

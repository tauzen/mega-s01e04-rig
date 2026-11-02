import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import type { DigestCounts, NightReader } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  nightCounts?: Record<string, DigestCounts | null>;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig, readNight?: NightReader): Status {
  const nights = nightsOnDisk(config.runsDir);
  const nightCounts: Record<string, DigestCounts | null> = {};

  if (readNight) {
    for (const night of nights) {
      try {
        nightCounts[night] = readNight(config.runsDir, night)?.counts ?? null;
      } catch {
        nightCounts[night] = null;
      }
    }
  }

  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    ...(readNight ? { nightCounts } : {}),
  };
}

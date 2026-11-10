/** Writes content/zones/<zone>.json from each plan and Book 9's island grid.   npm run zones */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../art/loadTitleArt.ts';
import { expandZone, parseBlockGrid, zoneMapText } from './zones.ts';
import type { ZonePlan } from './zones.ts';

export const ZONES_DIR = 'content/zones';
export const ISLAND_GRID = 'docs/levels/skarvholm_blocks.txt';

/** Every generated zone map, keyed by its repository path. */
export function generatedZones(): Map<string, string> {
  const grid = parseBlockGrid(readFileSync(join(REPO_ROOT, ISLAND_GRID), 'utf8'));
  const out = new Map<string, string>();
  for (const file of readdirSync(join(REPO_ROOT, ZONES_DIR)).sort()) {
    if (!file.endsWith('.plan.json')) continue;
    const plan = JSON.parse(readFileSync(join(REPO_ROOT, ZONES_DIR, file), 'utf8')) as ZonePlan;
    out.set(
      `${ZONES_DIR}/${file.replace('.plan.json', '.json')}`,
      zoneMapText(expandZone(plan, grid)),
    );
  }
  return out;
}

/** Generated zone files that differ from what the plans produce now. */
export function staleZoneFiles(): string[] {
  return [...generatedZones()]
    .filter(([path, text]) => {
      try {
        return readFileSync(join(REPO_ROOT, path), 'utf8') !== text;
      } catch {
        return true;
      }
    })
    .map(([path]) => path);
}

if (import.meta.filename === process.argv[1]) {
  for (const [path, text] of generatedZones()) {
    writeFileSync(join(REPO_ROOT, path), text);
    console.log(`wrote ${path}`);
  }
}

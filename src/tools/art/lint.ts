/**
 * Art lint (npm run art:lint, also part of npm run lint): Book 7's QA rules for every sheet, and
 * a check that generated sheets and compiled atlases match their sources.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLayerDefs, loadPalette, loadSheets } from './artFiles.ts';
import { layerProblems, lintSheet, placeholders } from './artLint.ts';
import { compiledAtlases } from './compile.ts';
import { generatedSheets } from './generate-sheets.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { parseZoneMap } from '../../content/zoneMap.ts';
import type { ZoneMap } from '../../content/zoneMap.ts';
import type { Sheet } from '../../render/sheet.ts';
import {
  densityProblems,
  shadowProblems,
  transitionProblems,
  variantProblems,
} from './standard.ts';
import type { StandardProblem } from './standard.ts';

/** The ground sheet each zone is drawn with. */
export const ZONE_GROUND: Readonly<Record<string, string>> = {
  ZONE_SK_STRAND: 'tile_strand',
  ZONE_SK_MACHAIR: 'tile_strand',
  ZONE_SK_HAGSEAT: 'tile_strand',
  ZONE_SK_CAIRN: 'tile_strand',
};

/** Every generated zone map in content/zones. */
export function loadZoneMaps(): ZoneMap[] {
  const dir = join(REPO_ROOT, 'content/zones');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.plan.json'))
    .map((f) => parseZoneMap(JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown, f));
}

/** The Book 7 section 14 standard over every sheet and zone. */
export function standardProblems(
  sheets: readonly Sheet[],
  zones: readonly ZoneMap[],
): StandardProblem[] {
  const byName = new Map(sheets.map((s) => [s.name, s]));
  const out = shadowProblems(sheets);
  for (const map of zones) {
    out.push(...transitionProblems(map), ...densityProblems(map));
    const ground = byName.get(ZONE_GROUND[map.zone] ?? '');
    if (ground === undefined)
      out.push({
        where: map.zone,
        problem: 'has no ground sheet in ZONE_GROUND (src/tools/art/lint.ts)',
      });
    else out.push(...variantProblems(map, ground));
  }
  return out;
}

/** Files whose committed content differs from what their sources generate. */
export function staleArtFiles(): string[] {
  const stale: string[] = [];
  const expect = new Map<string, Buffer | string>([...generatedSheets(), ...compiledAtlases()]);
  for (const [path, data] of expect) {
    const file = join(REPO_ROOT, path);
    if (!existsSync(file)) {
      stale.push(`${path} (missing)`);
      continue;
    }
    const actual = readFileSync(file);
    const wanted = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    if (!actual.equals(wanted)) stale.push(path);
  }
  return stale;
}

if (import.meta.filename === process.argv[1]) {
  const palette = loadPalette();
  const sheets = loadSheets(palette);
  const issues = [
    ...sheets.flatMap((s) => lintSheet(s, palette)),
    ...layerProblems(sheets, loadLayerDefs(), palette),
  ];
  for (const issue of issues)
    console.error(
      `${issue.sheet}${issue.frame === undefined ? '' : ` ${issue.frame}`}: ${issue.reason}`,
    );
  const stale = staleArtFiles();
  for (const path of stale)
    console.error(`${path}: out of date; run npm run art:sheets and npm run art:compile`);
  const standard = standardProblems(sheets, loadZoneMaps());
  for (const p of standard) console.error(`${p.where}: ${p.problem}`);
  const held = placeholders(sheets);
  if (held.length > 0) console.log(`placeholders: ${held.join(', ')}`);
  if (issues.length > 0 || stale.length > 0 || standard.length > 0) {
    console.error(`art lint: ${issues.length + stale.length + standard.length} problem(s)`);
    process.exit(1);
  }
  console.log(
    `art lint: clean (${sheets.length} sheets, ${sheets.reduce((n, s) => n + s.frames.size, 0)} frames, ${held.length} placeholders)`,
  );
}

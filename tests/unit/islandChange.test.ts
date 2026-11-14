/**
 * Stage 14 acceptance check 3, the data part: every scene of Skarvholm changes with season and
 * tide (Book 10 section 20, `change`; Book 9 section 03, "Tide, season, secrets and resources").
 * What the island's data changes is checked here: its resource nodes and collectibles by season and
 * tide, its tidal ground, the deep passage's flood and the cairn's feast light; the drawn changes
 * (snow, bloom, frozen pools, birds, the upper stream) are package D's `assets/art/seasons.json`,
 * whose listing of every scene is checked too. Book 9's own exceptions are named: Rook Hill, the bog,
 * the inland machair and cairn ground and the surf-bound cliffs have no tide, and the cairn's inside no season but the festival sun.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SEASONS } from '../../src/content/balance.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { TERRAIN } from '../../src/content/zoneMap.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';

const balance = loadBalanceJson();
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const island = land.island;
if (island == null) throw new Error('no island context');
const seasons = JSON.parse(readFileSync(`${REPO_ROOT}/assets/art/seasons.json`, 'utf8')) as {
  zones: Record<string, unknown>;
  default?: unknown;
  seasonless?: Record<string, string>;
};
const scenes = [...land.maps.keys()].filter((z) => z.startsWith('ZONE_SK_')).sort();
/**
 * No tide reaches them: Rook Hill and the bog (Book 9 section 03, "No tide"), the machair and the
 * cairn's ground inland, and the west cliffs, whose foot "is surf at every tide" (decision S14-83).
 */
const TIDELESS = new Set([
  'ZONE_SK_ROOK',
  'ZONE_SK_BOG',
  'ZONE_SK_MACHAIR',
  'ZONE_SK_CAIRN',
  'ZONE_SK_CLIFFS',
]);
const TIDAL = new Set(['flats', 'causeway', 'springfloor', 'foreshore']);

describe(`every scene changes with season and tide (scenes: ${scenes.join(', ')})`, () => {
  for (const zone of scenes) {
    const map = land.maps.get(zone);
    if (map === undefined) continue;
    it(`${zone}: changes with the tide${TIDELESS.has(zone) ? ' (Book 9: no tide)' : ''}`, () => {
      if (TIDELESS.has(zone)) return;
      const ground = map.rows.some((r) =>
        Array.from(r).some((c) => TIDAL.has(TERRAIN[c as keyof typeof TERRAIN])),
      );
      const tideThings =
        island.island.nodes.some(
          (n) => n.scene === zone && island.ib.nodes.get(n.kind)?.tide === 'LOW',
        ) ||
        island.collectibles.some(
          (c) => c.scene === zone && JSON.stringify(c.conditions ?? []).includes('"tide"'),
        ) ||
        zone === island.puzzles.passage.zone ||
        island.puzzles.turning.cutOff.some((r) => r.zone === zone);
      expect(ground || tideThings).toBe(true);
    });
    it(`${zone}: changes with the season`, () => {
      const seasonal = island.island.nodes.some((n) => {
        const nb = island.ib.nodes.get(n.kind);
        return (
          n.scene === zone &&
          nb !== undefined &&
          (nb.seasons.length < SEASONS.length || nb.days !== undefined)
        );
      });
      const drawn = seasons.zones[zone] !== undefined || seasons.default !== undefined;
      const exception = seasons.seasonless?.[zone];
      // The cairn's inside: no season but the festival sun through its east door (the alignment).
      if (exception !== undefined) {
        expect(
          island.puzzles.puzzles.some(
            (p) =>
              p.scenes.includes(zone) &&
              p.transitions.some((t) => t.when.some((c) => 'festivalDawn' in c)),
          ),
        ).toBe(true);
        return;
      }
      expect(seasonal || drawn).toBe(true);
    });
  }
});

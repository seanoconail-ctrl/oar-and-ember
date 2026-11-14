/**
 * Stage 14, work package A (decisions S14-30 to S14-49): the eight new scenes against the Book 7
 * terrain art standard (section 14), as tests/unit/standard.test.ts holds the strand: art lint's
 * standard checks (transitions, variants, plant density, shadows) on each zone and its sheets;
 * every ground tile, plant, decal and prop each zone draws exists in its sheet; the ground sheet
 * the zone names is the one art lint holds it to; every zone has things that move (plants in the
 * wind, water, wildlife or looping fx); and its markup lies inside it. The share of the screen
 * that keeps moving with the camera still (at least 80%) is measured in the browser
 * (tests/browser/island.spec.ts), as the strand's is.
 */
import { describe, expect, it } from 'vitest';
import { phaseOf, tileState, visualCorners } from '../../src/render/autotile.ts';
import { groundSheetOf, plantSheetOf } from '../../src/scenes/zoneScene.ts';
import { landContext } from '../../src/sim/land/context.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';
import { PLANT_KINDS } from '../../src/content/zoneMap.ts';
import { loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { standardProblems, ZONE_GROUND } from '../../src/tools/art/lint.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import type { ZoneMarkup } from '../../src/tools/levels/zones.ts';

const NEW = [
  'ZONE_SK_GEO',
  'ZONE_SK_CLIFFS',
  'ZONE_SK_ROOK',
  'ZONE_SK_BOG',
  'ZONE_SK_NAUST',
  'ZONE_SK_SKERRY',
  'ZONE_SK_SEALCAVE_DEEP',
  'ZONE_SK_CAIRN_IN',
] as const;

const palette = loadPalette();
const sheetList = loadSheets(palette);
const sheets = new Map(sheetList.map((s) => [s.name, s]));
const { content } = loadContentFromDisk();
const land = landContext(content, loadBalanceJson());

function mapOf(zone: string): ZoneMap {
  const map = land.maps.get(zone);
  if (map === undefined) throw new Error(`no map for ${zone}`);
  return map;
}

describe('the whole island against the Book 7 standard (section 14)', () => {
  for (const zone of NEW) {
    describe(zone, () => {
      const map = mapOf(zone);

      it("meets art lint's standard checks", () => {
        expect(standardProblems(sheetList, [map])).toEqual([]);
      });

      it('is drawn from the ground and plant sheets art lint holds it to, every frame present', () => {
        const ground = groundSheetOf(map);
        expect(ground).toBe(ZONE_GROUND[zone]);
        const tiles = sheets.get(ground);
        expect(tiles).toBeDefined();
        const missing: string[] = [];
        for (let j = 0; j <= map.height; j++)
          for (let i = 0; i <= map.width; i++) {
            const state = tileState(visualCorners(map.rows, i, j), phaseOf(i, j));
            if (!tiles?.frames.has(`${state}/-/0`)) missing.push(state);
          }
        expect(missing.slice(0, 5)).toEqual([]);
        const plants = sheets.get(plantSheetOf(map));
        for (const [k, , , v] of map.plants)
          expect(
            plants?.frames.has(`${PLANT_KINDS[k] ?? ''}${v}/-/3`),
            `${PLANT_KINDS[k]}${v}`,
          ).toBe(true);
        for (const p of map.props)
          expect(sheets.get(p.sheet)?.frames.has(p.frame), `${p.sheet} ${p.frame}`).toBe(true);
        for (const f of map.decalFrames) {
          const [sheet = '', frame = ''] = f.split(' ');
          expect(sheets.get(sheet)?.frames.has(frame), f).toBe(true);
        }
      });

      it('has things that move: plants in the wind, water, wildlife or fx that loop', () => {
        const water = map.rows.join('').match(/[~\-_wo=]/g)?.length ?? 0;
        // A haze or light fx covers two tiles by two.
        const fx = map.props.filter((p) => p.sheet === 'fx_island').length * 4;
        expect(map.plants.length + water + fx).toBeGreaterThan(map.width * map.height * 0.6);
        expect(map.life.length + fx).toBeGreaterThan(0);
      });

      it('keeps its markup inside it', () => {
        const m = map as unknown as ZoneMarkup;
        const inside = (x: number, y: number): boolean =>
          x >= 0 && y >= 0 && x < map.width && y < map.height;
        for (const c of m.traverse?.climbs ?? [])
          expect(inside(c.x, c.head) && inside(c.x, c.foot), c.id).toBe(true);
        for (const j of m.traverse?.jumps ?? [])
          expect(inside(j.from.x, j.from.y) && inside(j.to.x, j.to.y), j.id).toBe(true);
        for (const c of m.traverse?.crawls ?? [])
          for (const [x, y] of c.tiles) expect(inside(x, y), c.id).toBe(true);
        for (const p of m.traverse?.pushes ?? [])
          for (const [x, y] of p.line) expect(inside(x, y), p.id).toBe(true);
        for (const a of m.areas ?? []) expect(inside(a.rect.x, a.rect.y), a.id).toBe(true);
        for (const v of m.viewPoints ?? []) expect(inside(v.at.x, v.at.y)).toBe(true);
        for (const p of m.portals ?? []) {
          expect(inside(p.exit.x, p.exit.y), p.id).toBe(true);
          expect(land.maps.has(p.to), p.id).toBe(true);
        }
      });
    });
  }
});

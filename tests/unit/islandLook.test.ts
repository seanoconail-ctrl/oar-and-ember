/**
 * Stage 14's water and seasons on screen (Book 7 sections 13 and 14, Book 9 sections 01 and 03;
 * decisions S14-90 to S14-99): every stream sample's flow runs down its channel to the sea, fast
 * at a narrow and still in a pool, with foam at rocks and narrows and a waterfall's lip, sheet and
 * churned pool; the seasons recolour only along the palette's ramps; and every island scene's
 * frame differs from season to season (the frames themselves, drawn by the reference renderer,
 * where the season's colours reach; the browser test measures the WebGL frames and the tides).
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { SEASONS } from '../../src/content/balance.ts';
import { bakeElevation } from '../../src/content/terrain/elevation.ts';
import { bakeFlow, flowAt, POOL_SPEED } from '../../src/content/terrain/flow.ts';
import type { ZoneMap } from '../../src/content/zoneMap.ts';
import { renderSceneCpu } from '../../src/render/cpuRenderer.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import {
  flowOptions,
  inBloom,
  islandFrame,
  landLook,
  SEASON_ART,
  seasonalLife,
  seasonFog,
  seasonless,
  seasonRecolour,
  seasonSteps,
  zoneFlow,
} from '../../src/scenes/islandLook.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPalette, loadPeopleLook, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadZoneMaps } from '../../src/tools/art/lint.ts';
import { loadRenderStyle } from '../../src/tools/art/render-check.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const palette = loadPalette();
const style = loadRenderStyle();
const sheetList = loadSheets(palette);
const sheets = new Map(sheetList.map((s) => [s.name, s]));
const anims: SheetAnims = new Map(sheetList.map((s) => [s.name, s.anims]));
const maps = loadZoneMaps().filter((m) => m.zone.startsWith('ZONE_SK_'));
const balance = loadBalanceJson();
const { content } = loadContentFromDisk();
/** A day in each season (the calendar's 30-day seasons): mid-season, outside the bloom. */
const DAY: Readonly<Record<(typeof SEASONS)[number], number>> = {
  Spring: 10,
  Summer: 40,
  Autumn: 80,
  Winter: 100,
};

/** A small plan: a stream down from a spring pool, past a rock, over a fall, to the sea. */
function plan(): ZoneMap {
  const rows: string[] = [];
  for (let y = 0; y < 30; y++) {
    let r = '';
    for (let x = 0; x < 24; x++) {
      const pool = Math.hypot(x - 12, y - 4) < 3.2;
      const run = y > 6 && y < 26 && (x === 12 || x === 13);
      const rock = x === 14 && y === 12;
      r += y >= 26 ? '~' : pool || run ? 'w' : rock ? 'r' : ',';
    }
    rows.push(r);
  }
  return {
    zone: 'ZONE_SK_ROOK',
    tile: 24,
    width: 24,
    height: 30,
    rows,
    spawns: {},
    props: [],
    life: [],
    decalFrames: [],
    decals: [],
    plants: [],
  };
}

describe('the streams’ flow (Book 9 section 01; S14-90 to S14-93)', () => {
  it('runs every running sample downhill to the sea, fastest at a narrow, still in the pool', () => {
    const m = plan();
    const e = bakeElevation(m.rows);
    const f = bakeFlow(m.rows, e, {});
    const run = flowAt(f, 12.9 * 24, 18 * 24);
    expect(run).not.toBeNull();
    expect(run!.dy).toBeGreaterThan(0.8);
    expect(run!.speed).toBeGreaterThan(POOL_SPEED);
    const pool = flowAt(f, 12.5 * 24, 4.5 * 24);
    expect(pool?.speed ?? 0).toBeLessThan(POOL_SPEED);
    // Foam beside the rock in the water.
    const k = (x: number, y: number) =>
      Math.floor((y * 24) / 4) * f.width + Math.floor((x * 24) / 4);
    expect(f.foam[k(13.8, 12.5)] ?? 0).toBeGreaterThan(0.3);
    expect(f.foam[k(12.2, 20.5)] ?? 0).toBeLessThan(f.foam[k(13.8, 12.5)] ?? 0);
  });

  it('builds a waterfall’s lip, sheet and churned pool where the plan puts one, snapped to the stream', () => {
    const m = plan();
    const e = bakeElevation(m.rows);
    const f = bakeFlow(m.rows, e, { falls: [{ x: 11, y: 15, width: 2, drop: 2 }] });
    expect(f.falls).toHaveLength(1);
    const fall = f.falls[0]!;
    expect(fall.x / 24).toBeGreaterThan(12);
    expect(fall.x / 24).toBeLessThan(14);
    expect(fall.footY).toBeGreaterThan(fall.lipY);
    const lip = Math.floor(fall.lipY / 4) * f.width + Math.floor(fall.x / 4);
    expect(f.fall[lip]).toBe(2);
    expect(f.fall[lip + f.width * 3]).toBe(1);
    // The sheet is flagged as running water for the shader only, never for the simulation.
    expect(f.elevationRgba[(lip + f.width * 3) * 4 + 1]).toBe(255);
    const below = Math.floor((fall.footY + 6) / 4) * f.width + Math.floor(fall.x / 4);
    expect(f.foam[below] ?? 0).toBeGreaterThan(0.5);
    // No stream near: no fall is drawn.
    expect(bakeFlow(m.rows, e, { falls: [{ x: 2, y: 2, width: 2, drop: 2 }] }).falls).toHaveLength(
      0,
    );
  });

  it('leaves the zone by its named edge when it meets no sea', () => {
    const m = plan();
    const rows = m.rows.map((r, y) => (y < 26 ? r : `${','.repeat(12)}ww${','.repeat(10)}`));
    const e = bakeElevation(rows);
    const down = flowAt(bakeFlow(rows, e, { mouth: 's' }), 12.9 * 24, 18 * 24);
    expect(down!.dy).toBeGreaterThan(0.8);
  });

  it('runs Kelda’s stream in the machair south to the strand, and the strand’s to the sea', () => {
    for (const zone of ['ZONE_SK_MACHAIR', 'ZONE_SK_STRAND']) {
      const map = maps.find((x) => x.zone === zone);
      if (map === undefined) throw new Error(zone);
      const f = zoneFlow(map, bakeElevation(map.rows));
      let south = 0;
      let n = 0;
      for (let k = 0; k < f.speed.length; k++)
        if ((f.speed[k] ?? 0) > POOL_SPEED) {
          south += f.dy[k] ?? 0;
          n++;
        }
      expect(n, zone).toBeGreaterThan(100);
      expect(south / n, zone).toBeGreaterThan(0.6);
    }
  });

  it('puts Book 9’s falls on Rook Hill’s stream by its block, and the Kelda’s mouth to the south', () => {
    const rook = { ...plan(), origin: { x: 112, y: 24 } };
    const o = flowOptions(rook);
    expect(o.mouth).toBe('s');
    expect(o.falls?.[0]?.x).toBe(20 * 8 + 4 - 112);
    expect(o.falls?.[0]?.y).toBe(14 * 8 + 4 - 24);
  });
});

/** The world pixel at the middle of the view that holds the most grass (the season shows on it). */
function landiest(map: ZoneMap): { x: number; y: number } {
  let best = { n: -1, x: 0, y: 0 };
  for (let y = 7; y < map.height - 7; y += 2)
    for (let x = 13; x < map.width - 13; x += 2) {
      let n = 0;
      for (let v = -7; v <= 7; v++)
        for (let u = -13; u <= 13; u++) if (map.rows[y + v]?.[x + u] === ',') n++;
      if (n > best.n) best = { n, x, y };
    }
  return { x: best.x * 24, y: best.y * 24 };
}

describe('the seasons on the land (Book 7 sections 13 and 14; S14-94 to S14-99)', () => {
  it('recolours only from palette step to palette step', () => {
    for (const step of seasonSteps()) {
      const [ramp = '', n = ''] = step.split(' ');
      expect(palette.ramps.get(ramp)?.[Number(n)], step).toBeDefined();
    }
    const names = sheetList.map((s) => s.name);
    expect(seasonRecolour(palette, DAY.Spring, names)).toBeUndefined();
    for (const s of ['Summer', 'Autumn', 'Winter'] as const) {
      const r = seasonRecolour(palette, DAY[s], names);
      expect(r, s).toBeDefined();
      expect(r!.sheets.has('tile_strand')).toBe(true);
      expect(r!.sheets.has('plant_strand')).toBe(true);
      expect(r!.sheets.has('actor_gull')).toBe(false);
      for (let i = 0; i < palette.entries.length; i++)
        expect(palette.entries[r!.index[i] ?? 0], `${s} ${i}`).toBeDefined();
    }
  });

  it('blooms the heather in late summer, snows the high ground and freezes the pools in winter, shrinks Rook Hill’s stream in summer', () => {
    expect(inBloom(DAY.Summer)).toBe(false);
    expect(inBloom(31 + 20)).toBe(true);
    expect(inBloom(61 + 5)).toBe(true);
    expect(inBloom(DAY.Autumn)).toBe(false);
    expect(landLook('ZONE_SK_ROOK', DAY.Winter, false).snow).toBeGreaterThan(
      landLook('ZONE_SK_STRAND', DAY.Winter, false).snow,
    );
    expect(landLook('ZONE_SK_ROOK', DAY.Summer, false).snow).toBe(0);
    expect(landLook('ZONE_SK_BOG', DAY.Winter, false).freeze).toBe(true);
    expect(landLook('ZONE_SK_MACHAIR', DAY.Winter, false).freeze).toBe(false);
    expect(landLook('ZONE_SK_ROOK', DAY.Summer, false).shrink).toBe(true);
    expect(landLook('ZONE_SK_MACHAIR', DAY.Summer, false).shrink).toBe(false);
    expect(landLook('ZONE_SK_STRAND', DAY.Spring, true).calm).toBe(true);
    // A scene the art data does not name still changes: the default's snow.
    expect(landLook('ZONE_SK_NEW', DAY.Winter, false).snow).toBe(SEASON_ART.default.snow);
    expect(seasonFog('ZONE_SK_SEALCAVE_DEEP', DAY.Winter)).toBeGreaterThan(0);
  });

  it('keeps fewer gulls in winter and no crabs, the same ones each time', () => {
    const strand = maps.find((m) => m.zone === 'ZONE_SK_STRAND')!;
    const winter = seasonalLife(strand.zone, strand.life, DAY.Winter);
    const spring = seasonalLife(strand.zone, strand.life, DAY.Spring);
    expect(spring.length).toBe(strand.life.length);
    expect(winter.filter((l) => l.kind === 'crab')).toHaveLength(0);
    const gulls = (l: readonly { kind: string }[]) => l.filter((x) => x.kind === 'gull').length;
    expect(gulls(winter)).toBeLessThan(gulls(spring));
    expect(seasonalLife(strand.zone, strand.life, DAY.Winter)).toBe(winter);
  });

  it('draws every island scene differently in each season (the reference renderer)', () => {
    const b = parseTimeBalance(balance);
    const world = newCampaign('seasons', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    const base = world.onFoot!;
    const names = sheetList.map((s) => s.name);
    expect(maps.length).toBeGreaterThanOrEqual(7);
    for (const map of maps) {
      if (seasonless(map.zone) !== null) continue;
      const onFoot = {
        ...base,
        zone: map.zone,
        actors: {},
        items: [],
        projectiles: [],
        player: { ...base.player, ...landiest(map) },
      };
      const frames = SEASONS.map((season) => {
        const island = islandFrame({ effects: null }, map, DAY[season], false, palette, names);
        const scene = zoneScene({
          map,
          onFoot,
          tick: 0,
          tideOpen: false,
          phase: 'day',
          look: loadPeopleLook('A'),
          anims,
          highlight: null,
          hidePeople: true,
          life: island.life,
        });
        return renderSceneCpu(
          island.recolour === undefined ? scene : { ...scene, recolour: island.recolour },
          sheets,
          palette,
          style,
        );
      });
      for (let a = 0; a < frames.length; a++)
        for (let c = a + 1; c < frames.length; c++) {
          let changed = 0;
          const fa = frames[a]!;
          const fc = frames[c]!;
          for (let i = 0; i < fa.length; i += 4)
            if (fa[i] !== fc[i] || fa[i + 1] !== fc[i + 1] || fa[i + 2] !== fc[i + 2]) changed++;
          // At least 2% of the frame changes between any two seasons.
          expect(
            changed / (fa.length / 4),
            `${map.zone} ${SEASONS[a]}-${SEASONS[c]}`,
          ).toBeGreaterThan(0.02);
        }
    }
  });
});

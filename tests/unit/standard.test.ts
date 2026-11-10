/**
 * The Book 7 terrain art standard (section 14), checked on the committed art and zones: ground
 * shadows for every character and prop, organic transitions, tile variants, grass decoration
 * density, and the frame-building budget. The moving-pixel check with the camera still runs in
 * the browser (tests/browser/standard.spec.ts), because it needs the WebGL effects.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { bakeElevation } from '../../src/render/elevation.ts';
import { buildDrawList } from '../../src/render/scene.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { ZoneVisuals } from '../../src/scenes/zoneVisuals.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadZoneMaps, standardProblems, ZONE_GROUND } from '../../src/tools/art/lint.ts';
import { MOTION_THRESHOLD, continuousMotion } from '../../src/tools/art/motion.ts';
import {
  MAX_STRAIGHT_RUN,
  MIN_GRASS_BLOCK,
  MIN_GRASS_PLANTS,
  MIN_VARIANTS,
  VARIANTS_FROM_TILES,
  grassDensity,
  longestStraightRun,
  needsShadow,
  variantCounts,
  zoneTiles,
} from '../../src/tools/art/standard.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const sheetList = loadSheets(loadPalette());
const sheets = new Map(sheetList.map((s) => [s.name, s]));
const anims: SheetAnims = new Map(sheetList.map((s) => [s.name, s.anims]));
const shadows = new Map(sheetList.map((s) => [s.name, s.shadow]));
const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const zones = loadZoneMaps();

describe('the Book 7 terrain art standard (section 14)', () => {
  it('passes art lint’s standard checks on every sheet and zone', () => {
    expect(standardProblems(sheetList, zones)).toEqual([]);
  });

  it('gives every actor and prop sheet a ground shadow', () => {
    const grounded = sheetList.filter(needsShadow);
    expect(grounded.length).toBeGreaterThan(10);
    for (const s of grounded) expect(s.shadow, s.name).not.toBeNull();
  });

  it('casts a ground shadow under every character, creature and prop the strand draws', () => {
    const world = newCampaign('standard', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    const map = land.maps.get('ZONE_SK_STRAND');
    const onFoot = world.onFoot;
    if (map === undefined || onFoot === null) throw new Error('no strand');
    const visuals = new ZoneVisuals(map, bakeElevation(map.rows), false);
    let checked = 0;
    // Look from several places, so props, wildlife and people all come into view.
    for (const [x, y] of [
      [onFoot.player.x, onFoot.player.y],
      [60 * 24, 34 * 24],
      [40 * 24, 36 * 24],
      [26 * 24, 48 * 24],
      [48 * 24, 12 * 24],
    ] as const) {
      onFoot.player.x = x;
      onFoot.player.y = y;
      const frame = {
        dt: 1 / 60,
        tick: 0,
        onFoot,
        tide: { minutesToLowWater: 200, minutesSinceLowWater: 200, tidalGroundOpen: false },
        sky: { minuteOfDay: 900, lightFrom: 390, darkFrom: 1200 },
        anims,
        steererSheet: 'actor_p_steerer_a',
      };
      for (let i = 0; i < 3; i++) visuals.update(frame);
      const scene = zoneScene({
        map,
        onFoot,
        tick: 0,
        tideOpen: false,
        phase: 'day',
        look: { steerer: 'actor_p_steerer_a', people: { C_HILD: 'actor_c_hild' } },
        anims,
        shadows,
        highlight: null,
        visual: visuals.view(frame),
      });
      const casters = scene.effects?.shadows ?? [];
      for (const s of scene.sprites) {
        if (!/^(actor|prop)_/.test(s.sheet) || s.frame.startsWith('carried/')) continue;
        const has = casters.some(
          (c) => c.sheet === s.sheet && c.frame === s.frame && c.x === s.x && c.y === s.y,
        );
        expect(has, `${s.sheet} ${s.frame}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it(`keeps every terrain boundary organic: no straight run over ${MAX_STRAIGHT_RUN} px`, () => {
    for (const map of zones) {
      let longest = 0;
      for (const [, { corners, phase }] of zoneTiles(map.rows)) {
        if (corners.every((c) => c === corners[0])) continue;
        longest = Math.max(longest, longestStraightRun(corners, phase));
      }
      expect(longest, map.zone).toBeLessThanOrEqual(MAX_STRAIGHT_RUN);
    }
  });

  it(`gives every terrain that covers ground at least ${MIN_VARIANTS} plain tile variants`, () => {
    for (const map of zones) {
      const tiles = sheets.get(ZONE_GROUND[map.zone] ?? '');
      if (tiles === undefined) throw new Error(`no ground sheet for ${map.zone}`);
      for (const [layer, { variants, tiles: n }] of variantCounts(map, tiles)) {
        if (n >= VARIANTS_FROM_TILES)
          expect(variants, `${map.zone} ${layer}`).toBeGreaterThanOrEqual(MIN_VARIANTS);
      }
    }
  });

  it(`decorates grass densely: ${MIN_GRASS_PLANTS} plants a tile, no bare patch`, () => {
    for (const map of zones) {
      const d = grassDensity(map);
      expect(d.perTile, map.zone).toBeGreaterThanOrEqual(MIN_GRASS_PLANTS);
      expect(d.barestBlock, map.zone).toBeGreaterThanOrEqual(MIN_GRASS_BLOCK);
    }
  });

  it('measures motion as the mockup did (a still frame has none; a moving cell counts)', () => {
    const still = new Uint8Array(640 * 360 * 4);
    const moving = Array.from({ length: 9 }, (_, f) => {
      const img = new Uint8Array(640 * 360 * 4);
      // One cell of 20 x 20 flickers every frame.
      for (let y = 0; y < 20; y++)
        for (let x = 0; x < 20; x++) img[(y * 640 + x) * 4] = f % 2 === 0 ? 0 : 200;
      return img;
    });
    expect(continuousMotion([still, still, still], 640, 360).share).toBe(0);
    expect(continuousMotion(moving, 640, 360).share).toBeCloseTo(1 / 576, 6);
    expect(MOTION_THRESHOLD).toBeGreaterThanOrEqual(0.7);
  });

  it('builds a strand frame within the Book 2 budget (scene and draw list under 4 ms)', () => {
    const world = newCampaign('budget', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'B',
    });
    const map = land.maps.get('ZONE_SK_STRAND');
    const onFoot = world.onFoot;
    if (map === undefined || onFoot === null) throw new Error('no strand');
    const visuals = new ZoneVisuals(map, bakeElevation(map.rows), false);
    // The busiest view: the machair, thick with plants.
    onFoot.player.x = 70 * 24;
    onFoot.player.y = 5 * 24;
    const frame = (tick: number) => ({
      dt: 1 / 60,
      tick,
      onFoot,
      tide: { minutesToLowWater: 200, minutesSinceLowWater: 200, tidalGroundOpen: false },
      sky: { minuteOfDay: 900, lightFrom: 390, darkFrom: 1200 },
      anims,
      steererSheet: 'actor_p_steerer_b',
    });
    const run = (n: number): number => {
      const t0 = performance.now();
      for (let tick = 0; tick < n; tick++) {
        const f = frame(tick);
        visuals.update(f);
        const scene = zoneScene({
          map,
          onFoot,
          tick,
          tideOpen: false,
          phase: 'day',
          look: { steerer: 'actor_p_steerer_b', people: { C_HILD: 'actor_c_hild' } },
          anims,
          shadows,
          highlight: null,
          visual: visuals.view(f),
        });
        buildDrawList(scene, sheets, 0.5);
      }
      return (performance.now() - t0) / n;
    };
    run(30); // warm up
    const ms = run(120);
    expect(ms).toBeLessThan(4);
  });
});

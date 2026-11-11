/**
 * Stage 6 rework, check 5: water depth bands (Book 2 section 10; Book 10 section 02 "Water depth
 * bands" and "Water effects"; Book 7 section 07, people in water). The band from the depth, the
 * speed factor, deep water as the edge of the walkable ground, the sprite masked below the
 * waterline by the band's amount, ripples, splashes and dripping after leaving the water, and
 * Hild in the knee or waist band in the opening.
 */
import { describe, expect, it } from 'vitest';
import {
  bandForDepth,
  parsePeopleBasics,
  parseTimeBalance,
  parseWaterBalance,
} from '../../src/content/balance.ts';
import type { DepthBand } from '../../src/content/balance.ts';
import { renderSceneCpu } from '../../src/render/cpuRenderer.ts';
import { buildDrawList, parseRenderStyle, streakRow } from '../../src/render/scene.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { visualTuning, ZoneVisuals } from '../../src/scenes/zoneVisuals.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { speedAt } from '../../src/sim/land/onFoot.ts';
import { bandAt, stillWaterLevel } from '../../src/sim/land/water.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadPalette, loadPeopleLook, loadSheets, readRepo } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const water = parseWaterBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const palette = loadPalette();
const sheetList = loadSheets(palette);
const sheets = new Map(sheetList.map((s) => [s.name, s]));
const anims: SheetAnims = new Map(sheetList.map((s) => [s.name, s.anims]));
const map = land.maps.get('ZONE_SK_STRAND');
const elevation = land.elevations.get('ZONE_SK_STRAND');
if (map === undefined || elevation === undefined) throw new Error('no strand');
const strand = map;
const ground = elevation;
const OPENING = { day: 1, minuteOfDay: b.dayStart };
const openingTide = tideAt(OPENING, b);
const level = stillWaterLevel(openingTide);
const band = (name: DepthBand) => water.bands.find((x) => x.band === name);

function campaign(seed = 'water') {
  return newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
}

/** A point of the strand in each band at the opening tide, west of the western outcrop. */
function spot(name: DepthBand): { x: number; y: number } {
  for (let y = 33 * 24; y < 40 * 24; y += 2)
    for (let x = 26 * 24; x < 34 * 24; x += 2)
      if (bandAt(water, ground, x, y, level)?.band === name) return { x, y };
  throw new Error(`no ${name} water on the strand`);
}

describe('the band from the depth (Book 10 section 02)', () => {
  it('reads every band, its depth, mask and speed from balance.json', () => {
    expect(water.bands.map((x) => [x.band, x.upTo, x.maskPx, x.speedFactor])).toEqual([
      ['WET', 0.012, 0, 1],
      ['ANKLE', 0.05, 3, 0.9],
      ['KNEE', 0.14, 12, 0.7],
      ['WAIST', 0.3, 22, 0.5],
      ['DEEP', Infinity, null, null],
    ]);
    expect(water.streamBand).toBe('ANKLE');
    expect(water.waistCarryFactor).toBe(0.6);
    expect([water.dripAfterKneeSeconds, water.dripAfterWaistSeconds]).toEqual([4, 8]);
    expect(readRepo('docs/10_balance_sheet.md')).toContain('| Knee | 0.14 | 12 | 0.7 |');
  });

  it('puts each depth in its band, dry ground in none', () => {
    expect(bandForDepth(water, -0.2)).toBeNull();
    expect(bandForDepth(water, 0)).toBeNull();
    expect(bandForDepth(water, 0.005)?.band).toBe('WET');
    expect(bandForDepth(water, 0.012)?.band).toBe('ANKLE');
    expect(bandForDepth(water, 0.049)?.band).toBe('ANKLE');
    expect(bandForDepth(water, 0.1)?.band).toBe('KNEE');
    expect(bandForDepth(water, 0.14)?.band).toBe('WAIST');
    expect(bandForDepth(water, 0.29)?.band).toBe('WAIST');
    expect(bandForDepth(water, 0.3)?.band).toBe('DEEP');
  });

  it('takes the level from the calendar, never the drawn swash: the same every time', () => {
    expect(stillWaterLevel(openingTide)).toBe(level);
    const a = bandAt(water, elevation, 31.5 * 24, 35.6 * 24, level);
    expect(bandAt(water, elevation, 31.5 * 24, 35.6 * 24, level)).toEqual(a);
  });
});

describe('moving through water (Book 10 section 02)', () => {
  it('slows by the band’s speed factor, from the wading speed', () => {
    const world = campaign();
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no strand');
    for (const name of ['WET', 'ANKLE', 'KNEE', 'WAIST'] as const) {
      const at = spot(name);
      onFoot.player.x = at.x;
      onFoot.player.y = at.y;
      onFoot.player.gait = 'walk';
      const base = name === 'WET' ? land.movement.walk : land.movement.wade;
      expect(speedAt(onFoot, strand, land, level), name).toBeCloseTo(
        base * (band(name)?.speedFactor ?? 0),
        6,
      );
    }
    // Carrying waist deep is harder still: carry speed x0.6 on top of the band.
    const at = spot('WAIST');
    onFoot.player.x = at.x;
    onFoot.player.y = at.y;
    onFoot.player.gait = 'carry';
    expect(speedAt(onFoot, strand, land, level)).toBeCloseTo(land.movement.carry * 0.5 * 0.6, 6);
  });

  it('never walks into deep water (no swimming on the strand)', () => {
    const world = campaign();
    const sim = createSimulation(b, world, land);
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no strand');
    const at = spot('WAIST');
    onFoot.player.x = at.x;
    onFoot.player.y = at.y;
    sim.submit({ type: 'MOVE', x: 0, y: 1, run: false, sneak: false });
    for (let i = 0; i < 60 * 10; i++) {
      sim.step();
      expect(bandAt(water, elevation, onFoot.player.x, onFoot.player.y, level)?.band).not.toBe(
        'DEEP',
      );
    }
    expect(onFoot.player.moving).toBe(false);
  });
});

describe('people in water (Book 7 section 07)', () => {
  const frame = (onFoot: NonNullable<ReturnType<typeof campaign>['onFoot']>, tick: number) => ({
    dt: 1 / 60,
    tick,
    onFoot,
    tide: openingTide,
    sky: { minuteOfDay: 900, lightFrom: 390, darkFrom: 1200 },
    anims,
    steererSheet: 'actor_p_steerer_a',
  });

  it('masks a person in each band at the band’s waterline, with ripple rings round them', () => {
    for (const name of ['WET', 'ANKLE', 'KNEE', 'WAIST'] as const) {
      const world = campaign();
      const onFoot = world.onFoot;
      if (onFoot === null) throw new Error('no strand');
      const at = spot(name);
      onFoot.player.x = at.x;
      onFoot.player.y = at.y;
      const visuals = new ZoneVisuals(strand, elevation, false, visualTuning(balance, palette));
      for (let i = 0; i < 150; i++) visuals.update(frame(onFoot, i));
      const view = visuals.view(frame(onFoot, 150));
      const mask = band(name)?.maskPx ?? 0;
      expect(view.water['P_STEERER']?.wade?.mask ?? 0, name).toBe(mask);
      // Rings round the steerer's feet (Hild, nearby, rings in her own water).
      const ripples = view.marks.filter(
        (m) => m.frame.startsWith('ripple/') && Math.hypot(m.x - at.x, m.y - at.y) < 4,
      );
      if (name === 'WET') expect(ripples.length).toBe(0);
      else expect(ripples.length, name).toBeGreaterThan(0);
      // Every layer of the steerer is cut at the same waterline.
      const scene = zoneScene({
        map: strand,
        onFoot,
        tick: 150,
        tideOpen: false,
        phase: 'day',
        look: loadPeopleLook('A'),
        anims,
        highlight: null,
        visual: view,
      });
      const steerer = scene.sprites.filter((s) => s.sheet.endsWith('_a') && s.layer === 'actor');
      expect(steerer.length).toBe(4);
      for (const s of steerer) expect(s.wade?.mask ?? 0, `${name} ${s.sheet}`).toBe(mask);
    }
  });

  it('never hides a standing person entirely: deep water draws them at the waist', () => {
    const world = campaign();
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no strand');
    const at = spot('DEEP');
    onFoot.player.x = at.x;
    onFoot.player.y = at.y;
    const visuals = new ZoneVisuals(strand, elevation, false, visualTuning(balance, palette));
    for (let i = 0; i < 5; i++) visuals.update(frame(onFoot, i));
    expect(visuals.view(frame(onFoot, 5)).water['P_STEERER']?.wade?.mask).toBe(
      band('WAIST')?.maskPx,
    );
  });

  it('draws only the rows above the cut; below it, the water’s colour with the body faint', () => {
    const style = parseRenderStyle(JSON.parse(readRepo('assets/art/render.json')) as unknown);
    const water12 = { mask: 12, colour: [40, 90, 100] as const };
    const scene = (wade: typeof water12 | undefined) => ({
      background: 'D',
      phase: 'day' as const,
      pools: [],
      sprites: [
        {
          sheet: 'actor_p_steerer_a',
          frame: 'idle/s/0',
          x: 100,
          y: 100,
          layer: 'actor' as const,
          ...(wade === undefined ? {} : { wade }),
        },
      ],
    });
    const dry = renderSceneCpu(scene(undefined), sheets, palette, style, 200, 120);
    const wet = renderSceneCpu(scene(water12), sheets, palette, style, 200, 120);
    const [item] = buildDrawList(scene(water12), sheets, 0.5);
    expect(item?.cutY).toBe(100 - 12 + 1);
    const img = sheets.get('actor_p_steerer_a')?.frames.get('idle/s/0');
    if (img === undefined || item === undefined) throw new Error('missing');
    let above = 0;
    let water = 0;
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 32; x++) {
        if (img.pixels[y * 32 + x] === 255) continue;
        const sx = item.x + x;
        const sy = item.y + y;
        const i = (sy * 200 + sx) * 4;
        const got = [wet[i], wet[i + 1], wet[i + 2]];
        if (sy < (item.cutY ?? 0) - 1) {
          expect(got).toEqual([dry[i], dry[i + 1], dry[i + 2]]);
          above++;
        } else if (sy > (item.cutY ?? 0) + 1 && !streakRow(sy - (item.cutY ?? 0), 0)) {
          expect(got).toEqual([40, 90, 100]);
          water++;
        }
      }
    expect(above).toBeGreaterThan(200);
    expect(water).toBeGreaterThan(20);
  });

  it('splashes on entering knee water, and drips and darkens for the Book 10 time after', () => {
    const world = campaign();
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no strand');
    const dry = spot('WET');
    const knee = spot('KNEE');
    onFoot.player.x = dry.x;
    onFoot.player.y = dry.y;
    const visuals = new ZoneVisuals(strand, elevation, false, visualTuning(balance, palette));
    let tick = 0;
    for (let i = 0; i < 10; i++) visuals.update(frame(onFoot, tick++));
    onFoot.player.x = knee.x;
    onFoot.player.y = knee.y;
    visuals.update(frame(onFoot, tick++));
    expect(visuals.view(frame(onFoot, tick)).marks.some((m) => m.frame.startsWith('splash/'))).toBe(
      true,
    );
    onFoot.player.x = dry.x;
    onFoot.player.y = dry.y;
    visuals.update(frame(onFoot, tick++));
    expect(visuals.view(frame(onFoot, tick)).water['P_STEERER']?.dark).toBe(1);
    // Still dripping a little before the knee time is up, dry after it.
    for (let i = 0; i < 60 * water.dripAfterKneeSeconds - 30; i++)
      visuals.update(frame(onFoot, tick++));
    const late = visuals.view(frame(onFoot, tick));
    expect(late.water['P_STEERER']?.dark).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) visuals.update(frame(onFoot, tick++));
    expect(visuals.view(frame(onFoot, tick)).water['P_STEERER']?.dark).toBe(0);
  });
});

describe('Hild in the opening (Book 1 section 15; Book 9)', () => {
  it('stands knee to waist deep in the shallows, calling, at the opening’s tide', () => {
    const world = campaign();
    const hild = world.onFoot?.actors['C_HILD'];
    if (hild === undefined) throw new Error('no Hild');
    expect(hild.pose).toBe('call');
    const at = bandAt(water, elevation, hild.x, hild.y, level)?.band;
    expect(['KNEE', 'WAIST']).toContain(at);
  });

  /** Runs the simulation from `minuteOfDay` for 20 game minutes, checking Hild's band each tick. */
  const watch = (minuteOfDay: number): { bands: Set<string>; moved: number } => {
    const world = campaign();
    world.calendar = { day: 1, minuteOfDay };
    const sim = createSimulation(b, world, land);
    const hild = world.onFoot?.actors['C_HILD'];
    if (hild === undefined) throw new Error('no Hild');
    // Later in the day the water has gone out from her spawn: she stands at the knee line then.
    const now = stillWaterLevel(tideAt(world.calendar, b));
    const was = bandAt(water, ground, hild.x, hild.y, now)?.band;
    if (was !== 'KNEE' && was !== 'WAIST') {
      let y = hild.y;
      while (bandAt(water, ground, hild.x, y, now)?.band !== 'KNEE' && y < hild.y + 240) y++;
      hild.y = y + 2;
    }
    const from = { x: hild.x, y: hild.y };
    const bands = new Set<string>();
    const start = world.calendar.minuteOfDay;
    while (world.calendar.minuteOfDay < start + 20) {
      sim.step();
      const lvl = stillWaterLevel(tideAt(world.calendar, b));
      bands.add(bandAt(water, ground, hild.x, hild.y, lvl)?.band ?? 'DRY');
    }
    return { bands, moved: Math.hypot(hild.x - from.x, hild.y - from.y) };
  };

  it('keeps knee to waist deep over the opening’s first 20 game minutes', () => {
    const { bands } = watch(OPENING.minuteOfDay);
    expect([...bands].every((x) => x === 'KNEE' || x === 'WAIST'), [...bands].join()).toBe(true);
  });

  it('keeps her footing as the tide falls: steps seaward to stay knee to waist deep', () => {
    // Mid-ebb, when the level drops fastest.
    const { bands, moved } = watch(15 * 60);
    expect([...bands].every((x) => x === 'KNEE' || x === 'WAIST'), [...bands].join()).toBe(true);
    expect(moved).toBeGreaterThan(0);
  });
});

/**
 * Starting weapons, standing missiles, arrows and projectiles (the user's instructions B to E;
 * Book 10 section 21, "Starting weapons", "Missiles" and "Arrows"; decisions DD-6 to DD-9).
 */
import { describe, expect, it } from 'vitest';
import {
  parseArrowBalance,
  parseMissileBalance,
  parsePeopleBasics,
  parseStartingWeapons,
  parseTimeBalance,
} from '../../src/content/balance.ts';
import type { ZoneMap } from '../../src/content/zoneMap.ts';
import { seedStream } from '../../src/core/rng.ts';
import { DEFAULT_BINDINGS, rebind } from '../../src/input/actions.ts';
import { InputMapper } from '../../src/input/inputState.ts';
import { peopleLook, steererOwns, withOwned } from '../../src/scenes/people.ts';
import { Session } from '../../src/scenes/session.ts';
import { helpLines, tipText } from '../../src/scenes/tips.ts';
import { flightFrame } from '../../src/scenes/zoneScene.ts';
import { orderShot } from '../../src/sim/land/archer.ts';
import { landContext } from '../../src/sim/land/context.ts';
import {
  expireStuck,
  flightAt,
  flightTicks,
  launch,
  shieldStops,
  spreadDegrees,
  stepProjectiles,
} from '../../src/sim/land/missiles.ts';
import type { MissileContext, MissileEvent } from '../../src/sim/land/missiles.ts';
import { placeOnFoot } from '../../src/sim/land/onFoot.ts';
import type { Aim, OnFootActor, OnFootState } from '../../src/sim/land/onFoot.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadLayerDefs } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const missiles = parseMissileBalance(balance);
const arrows = parseArrowBalance(balance);
const starting = parseStartingWeapons(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const strandMap = land.maps.get('ZONE_SK_STRAND');
if (strandMap === undefined) throw new Error('no strand');
const strand = strandMap;
const TILE = 24;
const strings = content.strings;
const t = (key: string, vars: Record<string, string> = {}): string => {
  const text = strings.get(key)?.text;
  if (text === undefined) throw new Error(`no string ${key}`);
  return text.replace(/\{([a-z_]+)\}/g, (_, v: string) => vars[v] ?? `{${v}}`);
};
const has = (key: string): boolean => strings.has(key);

function campaign(seed = 'missiles') {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('not on foot');
  return { world, sim, events, onFoot };
}

/** Armed: the bow in slot 0 with Book 10's starting arrows, the seax in slot 1. */
function armed(seed = 'missiles') {
  const c = campaign(seed);
  c.world.player.hotbar.slots[0] = 'ITEM_BOW';
  c.world.player.hotbar.slots[1] = 'ITEM_SEAX';
  c.world.player.inventory['ITEM_ARROW'] = starting.startingArrows;
  return c;
}

/** A small test field: open shingle, a rock in column 10, the sea from column 16. */
function field(): ZoneMap {
  const rows = Array.from({ length: 12 }, () => '..........r.....~~~~');
  return {
    zone: 'ZONE_SK_STRAND',
    tile: TILE,
    width: 20,
    height: 12,
    rows,
    spawns: { P_STEERER: { x: 2.5, y: 6.5, facing: 'e' } },
    props: [],
    life: [],
    decalFrames: [],
    decals: [],
    plants: [],
  };
}

const ctx: MissileContext = {
  rules: land.rules,
  missiles,
  arrows,
  water: land.water,
  elevations: new Map(),
};

/** Flies every missile in `onFoot` to rest; returns what each struck. */
function fly(onFoot: OnFootState, map: ZoneMap, rng = seedStream('fly', 'combat')): MissileEvent[] {
  const out: MissileEvent[] = [];
  for (let i = 0; i < 600 && onFoot.projectiles.length > 0; i++)
    stepProjectiles(onFoot, rng, map, ctx, 0, 0, (e) => out.push(e));
  return out;
}

const east = (dist: number | null, since = 0): Aim => ({ x: 1, y: 0, since, dist });

describe('starting weapons (Book 10 section 21, "Starting weapons")', () => {
  it('wakes with nothing in hand; the seax lies in the debris and the bow waits for the rescue', () => {
    const { world, onFoot } = campaign();
    expect(world.player.hotbar.slots.every((s) => s === null)).toBe(true);
    expect(world.player.inventory).toEqual({});
    const seax = onFoot.items.find((i) => i.item === 'ITEM_SEAX');
    const bow = onFoot.items.find((i) => i.item === 'ITEM_BOW');
    expect(seax).toMatchObject({ glint: true });
    expect(seax?.after).toBeUndefined();
    expect(bow).toMatchObject({ arrows: starting.startingArrows, after: 'ch1.hild_safe' });
    // The seax a few tiles from where the steerer wakes; the bow at the east end of the strand.
    const p = onFoot.player;
    const d = Math.hypot((seax?.x ?? 0) * TILE - p.x, (seax?.y ?? 0) * TILE - p.y) / TILE;
    expect(d).toBeLessThan(5);
    expect(bow?.x ?? 0).toBeGreaterThan(strand.width * 0.9);
  });

  it('a scripted player finds the seax within 5 minutes and the bow within 15', () => {
    const { sim, events } = campaign('found-by');
    const bot = new OpeningBot(sim, strand, b, land);
    bot.pickUp('wreck_seax');
    const seaxAt = bot.ticks;
    bot.rescue('C_HILD');
    // Hild names the bow once she is safe; it cannot be taken before.
    expect(sim.state.onFoot?.items.find((i) => i.key === 'stern_bow')).toBeDefined();
    bot.waitFor(() => sim.state.facts['ch1.bow_named'] === true);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'PERSON_SPOKE', lineKey: 'c_hild.bark.bow.01' }),
    );
    bot.pickUp('stern_bow');
    const bowAt = bot.ticks;
    console.log(`seax after ${(seaxAt / 60).toFixed(1)} s, bow after ${(bowAt / 60).toFixed(1)} s`);
    expect(seaxAt).toBeLessThan(starting.seaxFoundByMinutes * 60 * 60);
    expect(bowAt).toBeLessThan(starting.bowFoundByMinutes * 60 * 60);
    expect(sim.state.player.hotbar.slots.slice(0, 2)).toEqual(['ITEM_SEAX', 'ITEM_BOW']);
    expect(sim.state.player.inventory['ITEM_ARROW']).toBe(starting.startingArrows);
  });

  it('the bow cannot be picked up before Hild is safe', () => {
    const { sim, events, onFoot } = campaign();
    const bow = onFoot.items.find((i) => i.key === 'stern_bow');
    if (bow === undefined) throw new Error('no bow');
    onFoot.player.x = bow.x * TILE;
    onFoot.player.y = bow.y * TILE + 4;
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(sim.state.player.hotbar.slots).not.toContain('ITEM_BOW');
    expect(events.some((e) => e.type === 'COMMAND_REFUSED')).toBe(true);
  });

  it('draws the steerer’s bow layer only once the bow is owned', () => {
    const files = new Map(loadLayerDefs().map((f) => [f.name, f]));
    const look = peopleLook(files, 'A').steerer;
    const { world } = campaign();
    const bare = withOwned(look, (item) => steererOwns(world.player, item));
    expect(
      Object.values(bare.layers)
        .flat()
        .some((s) => s.startsWith('layer_weapon_bow')),
    ).toBe(false);
    world.player.hotbar.slots[3] = 'ITEM_BOW';
    const armedLook = withOwned(look, (item) => steererOwns(world.player, item));
    expect(armedLook.layers['s']).toContain('layer_weapon_bow_a');
  });
});

describe('pickup tooltips (Book 10 section 21, pickupTooltip)', () => {
  it('is due once per item kind, and the help page lists every one seen', () => {
    const { sim, events, onFoot } = campaign();
    const seax = onFoot.items.find((i) => i.key === 'wreck_seax');
    if (seax === undefined) throw new Error('no seax');
    onFoot.player.x = seax.x * TILE;
    onFoot.player.y = seax.y * TILE + 4;
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(events.filter((e) => e.type === 'ITEM_PICKED_UP')).toEqual([
      { type: 'ITEM_PICKED_UP', item: 'ITEM_SEAX', count: 1, first: true },
    ]);
    expect(sim.state.player.tipsSeen).toEqual(['ITEM_SEAX']);
    // A second seax picked up: no tooltip again.
    onFoot.items.push({ ...seax, key: 'another_seax' });
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(events.filter((e) => e.type === 'ITEM_PICKED_UP').map((e) => e.first)).toEqual([
      true,
      false,
    ]);
    const lines = helpLines(
      sim.state.player.tipsSeen,
      content.onFoot?.items ?? {},
      () => ({ bindings: DEFAULT_BINDINGS, device: 'mouse', slot: 0, arrows: 0 }),
      t,
      has,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^Seax: Left-click strikes/);
  });

  it('names the controls for the input in use, as bound (remapping shows the new key)', () => {
    const ctx0 = { bindings: DEFAULT_BINDINGS, slot: 1, arrows: 6 };
    const mouse = tipText('ui.tip.bow', { ...ctx0, device: 'mouse' }, t, has);
    const keys = tipText('ui.tip.bow', { ...ctx0, device: 'key' }, t, has);
    const pad = tipText('ui.tip.bow', { ...ctx0, device: 'pad' }, t, has);
    expect(mouse).toContain('Hold Left-click');
    expect(mouse).toContain('Right-click or Escape');
    expect(mouse).toMatch(/^2 takes the bow/);
    expect(keys).toContain('Hold F');
    expect(keys).toContain('W A S D turn the aim');
    expect(keys).toContain('Escape lowers it');
    expect(pad).toContain('Hold RT');
    expect(pad).toContain('B lowers it');
    const remapped = rebind(DEFAULT_BINDINGS, 'useItem', { device: 'key', code: 'KeyG' }).bindings;
    expect(tipText('ui.tip.bow', { ...ctx0, bindings: remapped, device: 'key' }, t, has)).toContain(
      'Hold G',
    );
    expect(tipText('ui.tip.arrows', { ...ctx0, device: 'mouse' }, t, has)).toMatch(
      /^Arrows: 6 in the quiver/,
    );
  });
});

describe('standing to shoot (Book 10 section 21, drawPlantsFeet and minDraw)', () => {
  it('ignores movement while drawn, turns to the aim, and walks again after the loose', () => {
    const { sim, onFoot } = armed();
    const p = onFoot.player;
    sim.submit({ type: 'AIM', dir: 32, dist: 4 });
    sim.submit({ type: 'MOVE', x: 1, y: 0, run: true, sneak: false });
    const start = { x: p.x, y: p.y };
    for (let i = 0; i < 40; i++) sim.step();
    expect({ x: p.x, y: p.y }).toEqual(start);
    expect(p.moving).toBe(false);
    expect(p.facing).toBe('w');
    sim.submit({ type: 'AIM', dir: null });
    for (let i = 0; i < 10; i++) sim.step();
    expect(p.x).toBeGreaterThan(start.x);
  });

  it('cancels without spending an arrow, and a loose before minDraw is a cancel', () => {
    const { sim, events, world, onFoot } = armed();
    sim.submit({ type: 'AIM', dir: 0, dist: 3 });
    for (let i = 0; i < 20; i++) sim.step();
    sim.submit({ type: 'CANCEL_AIM' });
    sim.step();
    expect(onFoot.player.aim).toBeNull();
    sim.submit({ type: 'AIM', dir: 0, dist: 3 });
    for (let i = 0; i < missiles.minDrawTicks - 2; i++) sim.step();
    sim.submit({ type: 'AIM', dir: null });
    sim.step();
    expect(events.filter((e) => e.type === 'DRAW_CANCELLED').map((e) => e.reason)).toEqual([
      'CANCELLED',
      'TOO_SOON',
    ]);
    expect(world.player.inventory['ITEM_ARROW']).toBe(starting.startingArrows);
    expect(onFoot.projectiles).toEqual([]);
    expect(events.some((e) => e.type === 'BOW_LOOSED')).toBe(false);
  });

  it('the input lowers a drawn bow with right-click, Escape or pad B, and never opens the menu', () => {
    const { sim, onFoot } = armed();
    const input = new InputMapper(DEFAULT_BINDINGS);
    const session = new Session(
      sim,
      input,
      { awareHostiles: () => 0 },
      { map: strand, controls: land.controls, rules: land.rules },
    );
    const p = onFoot.player;
    const pointing = { device: 'mouse' as const, pointer: { x: p.x + 80, y: p.y } };
    for (const cancel of ['mouse', 'escape'] as const) {
      input.mouseDown(0);
      for (let i = 0; i < 20; i++) session.frame(1000 / 60, undefined, pointing);
      expect(p.aim).not.toBeNull();
      if (cancel === 'mouse') input.mouseDown(2);
      else input.keyDown('Escape');
      session.frame(1000 / 60, undefined, pointing);
      input.mouseUp(2);
      input.keyUp('Escape');
      session.frame(1000 / 60, undefined, pointing);
      expect(p.aim).toBeNull();
      expect(session.menus.open).toBeNull();
      // Still holding the button: it does not draw again until let go.
      for (let i = 0; i < 5; i++) session.frame(1000 / 60, undefined, pointing);
      expect(p.aim).toBeNull();
      input.mouseUp(0);
      session.frame(1000 / 60, undefined, pointing);
    }
    expect(sim.state.player.inventory['ITEM_ARROW']).toBe(starting.startingArrows);
  });

  it('with no arrows refuses the draw: no shot, and a reason', () => {
    const { sim, events, world, onFoot } = armed();
    world.player.inventory['ITEM_ARROW'] = 0;
    sim.submit({ type: 'AIM', dir: 0, dist: 3 });
    for (let i = 0; i < 40; i++) sim.step();
    sim.submit({ type: 'AIM', dir: null });
    sim.step();
    expect(events.filter((e) => e.type === 'COMMAND_REFUSED')).toMatchObject([
      { command: 'AIM', reason: 'NO_ARROWS', detail: 'ITEM_BOW' },
    ]);
    expect(onFoot.player.aim).toBeNull();
    expect(onFoot.projectiles).toEqual([]);
  });

  it('a full draw spends one arrow and looses a projectile', () => {
    const { sim, events, world, onFoot } = armed();
    sim.submit({ type: 'AIM', dir: 0, dist: 3 });
    for (let i = 0; i < missiles.bow.drawTicks; i++) sim.step();
    sim.submit({ type: 'AIM', dir: null });
    sim.step();
    expect(world.player.inventory['ITEM_ARROW']).toBe(starting.startingArrows - 1);
    expect(onFoot.projectiles).toHaveLength(1);
    expect(events.find((e) => e.type === 'BOW_LOOSED')).toMatchObject({
      drawTicks: missiles.bow.drawTicks,
    });
  });

  it('an NPC archer stops, draws for the draw time, looses, then moves; never moves drawn', () => {
    const { sim, events, onFoot } = campaign('archer');
    // A test actor on the open shingle, walking east, ordered to shoot west and then walk north.
    const x0 = 80 * TILE;
    const y0 = 34.5 * TILE;
    const archer: OnFootActor = {
      x: x0,
      y: y0,
      facing: 'e',
      pose: 'idle',
      intent: { x: 1, y: 0, run: false, sneak: false },
    };
    onFoot.actors['E_TEST_ARCHER'] = archer;
    for (let i = 0; i < 10; i++) sim.step();
    expect(archer.x).toBeGreaterThan(x0);
    orderShot(
      archer,
      { x: archer.x - 5 * TILE, y: archer.y },
      { x: 0, y: -1, run: false, sneak: false },
    );
    const log: { phase: string; moved: boolean; aim: boolean }[] = [];
    let last = { x: archer.x, y: archer.y };
    for (let i = 0; i < missiles.bow.drawTicks + 10; i++) {
      // Something keeps trying to walk the archer east while it shoots: it must not move.
      if (archer.archer?.phase === 'drawing')
        archer.intent = { x: 1, y: 0, run: false, sneak: false };
      sim.step();
      log.push({
        phase: archer.archer?.phase ?? '',
        moved: archer.x !== last.x || archer.y !== last.y,
        aim: archer.aim != null,
      });
      last = { x: archer.x, y: archer.y };
    }
    const drawing = log.filter((l) => l.phase === 'drawing');
    expect(drawing.length).toBeGreaterThanOrEqual(missiles.bow.drawTicks - 1);
    expect(drawing.every((l) => !l.moved && l.aim)).toBe(true);
    expect(archer.facing).toBe('n');
    expect(events.find((e) => e.type === 'MISSILE_LOOSED')).toMatchObject({
      shooter: 'E_TEST_ARCHER',
    });
    // After the loose it walks on (north).
    expect(archer.y).toBeLessThan(y0);
  });
});

describe('projectiles (Book 10 section 21, "Missiles")', () => {
  it('fly along the line each tick, on an arc 0 at both ends with its apex half way', () => {
    const map = field();
    const onFoot = placeOnFoot(map, []);
    const from = { x: 2.5 * TILE, y: 3.5 * TILE };
    const rng = seedStream('line', 'combat');
    const p = launch(onFoot, rng, ctx, TILE, 'P_STEERER', from, east(6), 'arrow', 30);
    const expected = flightTicks('arrow', 6, missiles);
    expect(Math.abs(p.ticks - expected)).toBeLessThanOrEqual(1);
    expect(p.ticks).toBe(Math.round((6 * TILE) / ((missiles.arrowSpeed * TILE) / 60)));
    // The apex is arcApex at full range, in proportion for this shot.
    expect(p.apex).toBeCloseTo(missiles.arcApexTiles * TILE * (6 / missiles.bow.reachTiles));
    const zs: number[] = [];
    let landed: MissileEvent | null = null;
    for (let i = 1; i <= p.ticks; i++) {
      stepProjectiles(onFoot, rng, map, ctx, 0, 0, (e) => (landed = e));
      if (onFoot.projectiles.length === 0) break;
      const now = flightAt(p, i / p.ticks);
      expect(p.x).toBeCloseTo(now.x);
      expect(p.y).toBeCloseTo(now.y);
      // On the straight line from the launch along its direction.
      expect((p.x - from.x) * p.uy - (p.y - from.y) * p.ux).toBeCloseTo(0);
      zs.push(p.z);
    }
    expect(flightAt(p, 0).z).toBe(0);
    expect(flightAt(p, 1).z).toBe(0);
    expect(flightAt(p, 0.5).z).toBeCloseTo(p.apex);
    expect(Math.max(...zs)).toBeLessThanOrEqual(p.apex + 1e-9);
    expect(zs.indexOf(Math.max(...zs))).toBeGreaterThan(p.ticks / 2 - 2);
    expect(zs.indexOf(Math.max(...zs))).toBeLessThan(p.ticks / 2 + 1);
    // It lands where it was aimed (within its spread) and sticks in the ground.
    expect(landed).toMatchObject({ type: 'MISSILE_STRUCK', strike: 'ground' });
    expect(onFoot.stuck).toHaveLength(1);
    expect(onFoot.stuck[0]).toMatchObject({ in: 'ground', h: 0 });
    expect(
      Math.hypot((onFoot.stuck[0]?.x ?? 0) - from.x, (onFoot.stuck[0]?.y ?? 0) - from.y),
    ).toBeCloseTo(6 * TILE, 0);
  });

  it('with no aim point flies on to the weapon’s full range and falls', () => {
    const map = field();
    const onFoot = placeOnFoot(map, []);
    const p = launch(
      onFoot,
      seedStream('far', 'combat'),
      ctx,
      TILE,
      'P_STEERER',
      { x: 1.5 * TILE, y: 2.5 * TILE },
      { x: 0, y: 1, since: 0, dist: null },
      'arrow',
      30,
    );
    expect(p.length).toBeCloseTo(missiles.bow.reachTiles * TILE);
    expect(p.apex).toBeCloseTo(missiles.arcApexTiles * TILE);
    // A thrown spear is slower and shorter.
    const s = launch(
      onFoot,
      seedStream('far', 'combat'),
      ctx,
      TILE,
      'P_STEERER',
      { x: 30, y: 30 },
      { x: 0, y: 1, since: 0, dist: null },
      'spear',
      18,
    );
    expect(s.length).toBeCloseTo(missiles.spear.reachTiles * TILE);
    expect(s.ticks).toBe(flightTicks('spear', missiles.spear.reachTiles, missiles));
  });

  it('spreads deterministically for a seed, within the draw’s bounds', () => {
    const angle = (seed: string, draw: number): number => {
      const onFoot = placeOnFoot(field(), []);
      const p = launch(
        onFoot,
        seedStream(seed, 'combat'),
        ctx,
        TILE,
        'P_STEERER',
        { x: 0, y: 0 },
        east(5),
        'arrow',
        draw,
      );
      return (Math.atan2(p.uy, p.ux) * 180) / Math.PI;
    };
    expect(angle('a', 30)).toBe(angle('a', 30));
    expect(spreadDegrees('arrow', missiles.minDrawTicks, missiles)).toBe(missiles.spreadQuickDraw);
    expect(spreadDegrees('arrow', missiles.bow.drawTicks, missiles)).toBe(
      missiles.spreadFullDraw.bow,
    );
    expect(spreadDegrees('arrow', 300, missiles)).toBe(missiles.spreadFullDraw.bow);
    expect(spreadDegrees('spear', missiles.spear.drawTicks, missiles)).toBe(
      missiles.spreadFullDraw.spear,
    );
    let widest = { full: 0, quick: 0 };
    for (let i = 0; i < 400; i++) {
      const full = Math.abs(angle(`s${i}`, missiles.bow.drawTicks));
      const quick = Math.abs(angle(`s${i}`, missiles.minDrawTicks));
      expect(full).toBeLessThanOrEqual(missiles.spreadFullDraw.bow + 0.02);
      expect(quick).toBeLessThanOrEqual(missiles.spreadQuickDraw + 0.02);
      widest = { full: Math.max(widest.full, full), quick: Math.max(widest.quick, quick) };
    }
    // The spread is used: draws reach most of the way to its edge.
    expect(widest.full).toBeGreaterThan(missiles.spreadFullDraw.bow * 0.8);
    expect(widest.quick).toBeGreaterThan(missiles.spreadQuickDraw * 0.8);
  });

  it('is stopped by stone in the terrain and by the wreck’s hull', () => {
    const map = field();
    const onFoot = placeOnFoot(map, []);
    launch(
      onFoot,
      seedStream('rock', 'combat'),
      ctx,
      TILE,
      'P_STEERER',
      { x: 5.5 * TILE, y: 3.5 * TILE },
      east(8),
      'arrow',
      30,
    );
    const [hit] = fly(onFoot, map);
    expect(hit).toMatchObject({ strike: 'stone' });
    expect(hit?.x ?? 0).toBeLessThan(10 * TILE);
    const hull: ZoneMap = {
      ...field(),
      rows: Array.from({ length: 12 }, () => '....................'),
      props: [{ sheet: 'prop_wreck_t1', frame: 'wrecked/-/0', x: 9, y: 4 }],
    };
    const o2 = placeOnFoot(hull, []);
    launch(
      o2,
      seedStream('hull', 'combat'),
      ctx,
      TILE,
      'P_STEERER',
      { x: 2.5 * TILE, y: 3.6 * TILE },
      east(10),
      'arrow',
      30,
    );
    const [wood] = fly(o2, hull);
    expect(wood).toMatchObject({ strike: 'wood' });
    expect(o2.stuck[0]).toMatchObject({ in: 'wood' });
    expect(o2.stuck[0]?.h ?? 0).toBeGreaterThan(0);
    // Low cover stops a missile only near the ground: a log is flown over mid-arc.
    const low: ZoneMap = {
      ...hull,
      props: [{ sheet: 'prop_debris', frame: 'log_long/-/0', x: 6, y: 4 }],
    };
    const o3 = placeOnFoot(low, []);
    launch(
      o3,
      seedStream('low', 'combat'),
      ctx,
      TILE,
      'P_STEERER',
      { x: 2.5 * TILE, y: 3.6 * TILE },
      east(7),
      'arrow',
      30,
    );
    const [over] = fly(o3, low);
    expect(over).toMatchObject({ strike: 'ground' });
  });

  it('sticks in a body; a raised shield stops it from the front, never from behind', () => {
    const shot = (facing: 'e' | 'w', blocking: boolean) => {
      const map: ZoneMap = {
        ...field(),
        rows: Array.from({ length: 12 }, () => '....................'),
      };
      const onFoot = placeOnFoot(map, []);
      onFoot.actors['E_TEST_SHIELD'] = {
        x: 8.5 * TILE,
        y: 4 * TILE,
        facing,
        pose: 'idle',
        blocking,
      };
      launch(
        onFoot,
        seedStream('shield', 'combat'),
        ctx,
        TILE,
        'P_STEERER',
        { x: 2.5 * TILE, y: 4 * TILE },
        east(10),
        'arrow',
        30,
      );
      const [hit] = fly(onFoot, map);
      return { hit, stuck: onFoot.stuck[0] };
    };
    // The arrow flies east: a shield facing west (towards the archer) meets it.
    expect(shot('w', true).hit).toMatchObject({ strike: 'shield', target: 'E_TEST_SHIELD' });
    expect(shot('w', true).stuck).toMatchObject({ in: 'shield', target: 'E_TEST_SHIELD' });
    expect(shot('e', true).hit).toMatchObject({ strike: 'body', target: 'E_TEST_SHIELD' });
    expect(shot('w', false).hit).toMatchObject({ strike: 'body' });
    expect(shieldStops('w', 1, 0, missiles.shieldArcDegrees)).toBe(true);
    expect(shieldStops('n', 1, 0, missiles.shieldArcDegrees)).toBe(false);
    expect(shieldStops('w', Math.cos(0.9), Math.sin(0.9), missiles.shieldArcDegrees)).toBe(true);
    expect(shieldStops('w', Math.cos(1.2), Math.sin(1.2), missiles.shieldArcDegrees)).toBe(false);
  });

  it('is lost in water', () => {
    const map = field();
    const onFoot = placeOnFoot(map, []);
    launch(
      onFoot,
      seedStream('sea', 'combat'),
      ctx,
      TILE,
      'P_STEERER',
      { x: 12.5 * TILE, y: 3.5 * TILE },
      east(6),
      'arrow',
      30,
    );
    const [hit] = fly(onFoot, map);
    expect(hit).toMatchObject({ strike: 'water', broken: true });
    expect(onFoot.stuck).toEqual([]);
  });

  it('recovers and breaks in Book 10’s shares, drawn on the combat stream', () => {
    const share = (strike: 'ground' | 'stone', n: number): number => {
      let kept = 0;
      for (let i = 0; i < n; i++) {
        const map = field();
        const onFoot = placeOnFoot(map, []);
        const from =
          strike === 'stone' ? { x: 7.5 * TILE, y: 3.5 * TILE } : { x: 1.5 * TILE, y: 3.5 * TILE };
        const rng = seedStream(`recover-${i}`, 'combat');
        launch(onFoot, rng, ctx, TILE, 'P_STEERER', from, east(5), 'arrow', 30);
        const [hit] = fly(onFoot, map, rng);
        expect(hit?.strike).toBe(strike);
        if (hit?.broken === false) kept++;
      }
      return kept / n;
    };
    const ground = share('ground', 600);
    const stone = share('stone', 600);
    console.log(
      `recovered: ground ${(ground * 100).toFixed(1)}%, stone ${(stone * 100).toFixed(1)}%`,
    );
    expect(Math.abs(ground - arrows.recover.ground)).toBeLessThan(0.06);
    expect(Math.abs(stone - arrows.recover.stone)).toBeLessThan(0.06);
  });

  it('keeps at most Book 10’s stuck missiles, oldest first, and the ground ones for a day', () => {
    const map: ZoneMap = {
      ...field(),
      rows: Array.from({ length: 12 }, () => '....................'),
    };
    const onFoot = placeOnFoot(map, []);
    const rng = seedStream('cap', 'combat');
    for (let i = 0; i < missiles.stuckMax + 5; i++) {
      launch(
        onFoot,
        rng,
        ctx,
        TILE,
        'P_STEERER',
        { x: 2.5 * TILE, y: 3.5 * TILE },
        east(4),
        'arrow',
        30,
      );
      fly(onFoot, map, rng);
    }
    expect(onFoot.stuck).toHaveLength(missiles.stuckMax);
    expect(onFoot.stuck[0]?.n).toBe(6);
    expireStuck(onFoot, ctx, missiles.stuckGroundDays * 1440 - 1);
    expect(onFoot.stuck).toHaveLength(missiles.stuckMax);
    expireStuck(onFoot, ctx, missiles.stuckGroundDays * 1440);
    expect(onFoot.stuck).toEqual([]);
  });

  it('an unbroken arrow pulled free returns to the quiver', () => {
    const { sim, onFoot, world } = armed('pull');
    world.player.inventory['ITEM_ARROW'] = 2;
    onFoot.stuck.push({
      n: 99,
      kind: 'arrow',
      x: onFoot.player.x + 10,
      y: onFoot.player.y,
      h: 0,
      dir: 0,
      in: 'ground',
      broken: false,
      at: 0,
    });
    onFoot.stuck.push({
      n: 98,
      kind: 'arrow',
      x: onFoot.player.x + 8,
      y: onFoot.player.y,
      h: 0,
      dir: 0,
      in: 'ground',
      broken: true,
      at: 0,
    });
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(world.player.inventory['ITEM_ARROW']).toBe(3);
    expect(onFoot.stuck.map((s) => s.n)).toEqual([98]);
    // The broken one cannot be picked up.
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(world.player.inventory['ITEM_ARROW']).toBe(3);
  });

  it('is drawn rotated along its flight, the arc’s rise and fall included', () => {
    const onFoot = placeOnFoot(field(), []);
    const p = launch(
      onFoot,
      seedStream('frame', 'combat'),
      ctx,
      TILE,
      'P_STEERER',
      { x: 0, y: 0 },
      { x: 1, y: 0, since: 0, dist: 8 },
      'arrow',
      300,
    );
    const release = land.rules.releaseHeightPx;
    // Early in the flight the hand's height falls away fastest: the arrow points a little down;
    // near the end it comes down onto its mark.
    p.t = 1;
    const early = flightFrame(p, release);
    p.t = p.ticks - 1;
    const late = flightFrame(p, release);
    expect([0, 1]).toContain(early.dir);
    expect([1, 2]).toContain(late.dir);
    expect(early.height).toBeGreaterThan(late.height);
  });
});

/**
 * Stage 6: the player controller and the opening (Book 3 Stage 6).
 *   Check 1: control within five seconds of the naming screen (here: from the first tick).
 *   Check 2: movement, interaction and carrying are taught by the rescue, without a control list.
 *   Check 3 is in steererWords.test.ts.
 * Also the carry rules, input latency, Book 10 speeds, tide-dependent ground and reachability.
 */
import { describe, expect, it } from 'vitest';
import {
  parseMovementBalance,
  parsePeopleBasics,
  parseTimeBalance,
} from '../../src/content/balance.ts';
import { DEFAULT_BINDINGS } from '../../src/input/actions.ts';
import { InputMapper } from '../../src/input/inputState.ts';
import { Session } from '../../src/scenes/session.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { disabledActions, interactionNow } from '../../src/sim/land/onFoot.ts';
import { bandAt, stillWaterLevel } from '../../src/sim/land/water.ts';
import { aboveTideLine, reachable, terrainAt, tileOf } from '../../src/sim/land/zoneMap.ts';
import { FACT_HILD_FOUND, FACT_HILD_SAFE } from '../../src/sim/narrative/opening.ts';
import { record, replay } from '../../src/sim/replay.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { staleZoneFiles } from '../../src/tools/levels/generate-zones.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const basics = parsePeopleBasics(balance);
const movement = parseMovementBalance(balance);
const { content, issues } = loadContentFromDisk();
const land = landContext(content, balance);
const strand = land.maps.get('ZONE_SK_STRAND');
if (strand === undefined) throw new Error('no Wreck Strand map');
const map = strand;

function start(seed = 'opening') {
  const world = newCampaign(seed, b, basics, content, { name: 'Ash', bodyModel: 'A' });
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  return { world, sim, events };
}

const LOW_WATER = { day: 1, minuteOfDay: 18 * 60 };

describe('Wreck Strand from Book 9', () => {
  it('loads clean, and the generated map is in step with its plan and the island grid', () => {
    expect(issues).toEqual([]);
    expect(staleZoneFiles()).toEqual([]);
    expect([map.width, map.height, map.tile]).toEqual([96, 64, 24]);
  });

  it('opens on the flood tide, so the flats are under water and the foreshore is wet', () => {
    expect(tideAt({ day: 1, minuteOfDay: b.dayStart }, b)).toMatchObject({
      phase: 'FLOOD',
      tidalGroundOpen: false,
    });
    expect(tideAt(LOW_WATER, b).tidalGroundOpen).toBe(true);
  });

  it('passes the reachability flood fill (Book 2 section 10) at the opening tide', () => {
    const { world } = start();
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no on-foot state');
    const from = tileOf(map, onFoot.player.x, onFoot.player.y);
    const open = reachable(map, from, false);
    const hild = onFoot.actors['C_HILD'];
    if (hild === undefined) throw new Error('Hild did not spawn');
    const at = tileOf(map, hild.x, hild.y);
    expect(open.has(`${at.tx},${at.ty}`)).toBe(true);
    // She lies below the tide line, and dry ground above it is in reach.
    expect(aboveTideLine(terrainAt(map, at.tx, at.ty))).toBe(false);
    expect(
      [...open].some((k) => {
        const [x = 0, y = 0] = k.split(',').map(Number);
        return aboveTideLine(terrainAt(map, x, y));
      }),
    ).toBe(true);
  });

  it('reaches the wreck on its skerry only at low tide (Book 9 section 03)', () => {
    const { world } = start();
    const p = world.onFoot?.player;
    if (p === undefined) throw new Error('no player');
    const from = tileOf(map, p.x, p.y);
    const wreck = map.props.find((x) => x.sheet === 'prop_wreck_t1');
    if (wreck === undefined) throw new Error('no wreck');
    // The skerry: the rock the wreck lies on, and every rock tile joined to it.
    const skerry = new Set<string>();
    const queue: [number, number][] = [[Math.floor(wreck.x), Math.floor(wreck.y)]];
    for (const [x, y] of queue) {
      const key = `${x},${y}`;
      if (skerry.has(key) || terrainAt(map, x, y) !== 'rock') continue;
      skerry.add(key);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    expect(skerry.size).toBeGreaterThan(20);
    const near = (open: Set<string>): boolean =>
      [...open].some((k) => {
        const [x = 0, y = 0] = k.split(',').map(Number);
        return [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx = 0, dy = 0]) => skerry.has(`${x + dx},${y + dy}`));
      });
    expect(near(reachable(map, from, false))).toBe(false);
    expect(near(reachable(map, from, true))).toBe(true);
  });
});

describe('check 1: control at once', () => {
  it('places the named steerer on the strand, and the first tick obeys a move', () => {
    const { sim } = start();
    expect(sim.state.player).toMatchObject({ name: 'Ash', bodyModel: 'A' });
    const before = sim.state.onFoot?.player.x ?? 0;
    sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
    sim.step();
    expect(sim.state.tick).toBe(1);
    expect(sim.state.onFoot?.player.x).toBeGreaterThan(before);
  });

  it('has no added input latency: a key held before a frame moves the steerer in that frame', () => {
    const { sim } = start();
    const input = new InputMapper(DEFAULT_BINDINGS);
    const session = new Session(sim, input, { awareHostiles: () => 0 });
    const x0 = sim.state.onFoot?.player.x ?? 0;
    input.keyDown('KeyD');
    session.frame(1000 / 60);
    expect(sim.state.onFoot?.player.x).toBeGreaterThan(x0);
    input.keyUp('KeyD');
    session.frame(1000 / 60);
    const stopped = sim.state.onFoot?.player.x;
    session.frame(1000 / 60);
    expect(sim.state.onFoot?.player.x).toBe(stopped);
  });
});

describe('Book 10 speeds and the carry rules', () => {
  /** Tiles moved in one second of walking east from an open spot on the shingle. */
  function measure(run: boolean, sneak: boolean, carrying: boolean): number {
    const { sim } = start();
    const onFoot = sim.state.onFoot;
    if (onFoot === null) throw new Error('no on-foot state');
    // An open stretch of upper shingle, well clear of everything.
    onFoot.player.x = 70 * 24;
    onFoot.player.y = 28 * 24;
    if (carrying) {
      const hild = onFoot.actors['C_HILD'];
      if (hild === undefined) throw new Error('no Hild');
      hild.pose = 'carried';
      onFoot.carrying = 'C_HILD';
    }
    sim.submit({ type: 'MOVE', x: 1, y: 0, run, sneak });
    // Design addendum 2.5: speed builds to full over Book 10's ticks; measured once at full.
    for (let i = 0; i < 30; i++) sim.step();
    const x0 = onFoot.player.x;
    for (let i = 0; i < 60; i++) sim.step();
    return (onFoot.player.x - x0) / 24;
  }

  it('walks, runs and sneaks at the Book 10 speeds', () => {
    expect(measure(false, false, false)).toBeCloseTo(movement.walk, 5);
    expect(measure(true, false, false)).toBeCloseTo(movement.run, 5);
    expect(measure(false, true, false)).toBeCloseTo(movement.sneak, 5);
  });

  it('carries at carry speed whatever is held, with attacks disabled', () => {
    expect(measure(false, false, true)).toBeCloseTo(movement.carry, 5);
    expect(measure(true, false, true)).toBeCloseTo(movement.carry, 5);
    expect(measure(false, true, true)).toBeCloseTo(movement.carry, 5);
    const { sim } = start();
    const onFoot = sim.state.onFoot;
    if (onFoot === null) throw new Error('no on-foot state');
    expect(disabledActions(onFoot).size).toBe(0);
    onFoot.carrying = 'C_HILD';
    expect(disabledActions(onFoot).get('useItem')).toBe('CARRYING');
    expect(disabledActions(onFoot).get('shove')).toBe('CARRYING');
    const input = new InputMapper(DEFAULT_BINDINGS);
    const session = new Session(sim, input, { awareHostiles: () => 0 });
    input.mouseDown(0);
    expect(session.frame(1000 / 60).refusedActions).toEqual([
      { action: 'useItem', reason: 'CARRYING' },
    ]);
  });

  it('stops at deep water, and at the flats until low tide', () => {
    const { sim } = start();
    const onFoot = sim.state.onFoot;
    if (onFoot === null) throw new Error('no on-foot state');
    sim.submit({ type: 'MOVE', x: 0, y: 1, run: true, sneak: false });
    for (let i = 0; i < 60 * 20; i++) sim.step();
    const { tx, ty } = tileOf(map, onFoot.player.x, onFoot.player.y);
    expect(terrainAt(map, tx, ty)).toBe('foreshore');
    // At high water the steerer wades out until the water is deep, and stops at its edge.
    const level = stillWaterLevel(tideAt(sim.state.calendar, b));
    const elevation = land.elevations.get(map.zone);
    if (elevation === undefined) throw new Error('no height field');
    const p = onFoot.player;
    expect(bandAt(land.water, elevation, p.x, p.y, level)?.band).not.toBe('DEEP');
    expect(bandAt(land.water, elevation, p.x, p.y + 2, level)?.band).toBe('DEEP');
    // At low water the sea is out: on down the foreshore to the open flats and beyond.
    sim.state.calendar = { ...LOW_WATER };
    for (let i = 0; i < 60 * 3; i++) sim.step();
    // (The footprint lies just above the foot point, so the tile is read a pixel up.)
    const now = tileOf(map, onFoot.player.x, onFoot.player.y - 1);
    expect(now.ty).toBeGreaterThan(ty + 1);
    expect(terrainAt(map, now.tx, now.ty)).toBe('flats');
  });
});

describe('check 2: the rescue teaches by doing', () => {
  it('Hild calls within seconds, from her direction, and keeps calling until found', () => {
    const { sim, events } = start();
    const calls: { lineKey: string; tick: number }[] = [];
    sim.events.onAny((e) => {
      if (e.type === 'PERSON_CALLED') calls.push({ lineKey: e.lineKey, tick: sim.state.tick });
    });
    for (let i = 0; i < 60 * 17; i++) sim.step();
    expect(calls.length).toBe(3);
    expect(events.find((e) => e.type === 'PERSON_CALLED')).toMatchObject({
      person: 'C_HILD',
      direction: 'w',
    });
    // Three different lines, the first within Book 10's hildCallBy of waking (15 s; DE-30).
    expect(new Set(calls.map((c) => c.lineKey)).size).toBe(3);
    expect(calls.map((c) => c.tick)).toEqual([240, 600, 960]);
    expect(calls[0]?.tick).toBeLessThanOrEqual(15 * 60);
  });

  it('is played through by doing: walk to the voice, lift, the tide refuses, carry up, set down', () => {
    const { sim, events } = start();
    const bot = new OpeningBot(sim, map, b, land);
    // Design addendum 2.4: the seax on the way, the net cut, then the carry.
    bot.pickUp('wreck_seax');
    bot.rescue('C_HILD');
    const what = (e: SimEvent): string =>
      e.type === 'WRECK'
        ? `WRECK:${e.what}`
        : e.type === 'ITEM_PICKED_UP'
          ? `PICKED:${e.item}`
          : e.type;
    const types = events.map(what);
    // She calls until she is reached (how many times depends on the walking pace).
    expect(types.filter((t) => t === 'PERSON_CALLED').length).toBeGreaterThanOrEqual(3);
    // Then, in order: the seax, her reached (the chest placed), the cut, the lift, the tide's
    // refusal, set down above it, the beat, and Stage 8's joining.
    const order = [
      'PICKED:ITEM_SEAX',
      'WRECK:CHEST_PLACED',
      'WORK_STARTED',
      'WRECK:NET_CUT',
      'PERSON_LIFTED',
      'COMMAND_REFUSED',
      'PERSON_SET_DOWN',
      'BEAT_COMPLETED',
      'RESIDENT_JOINED',
    ];
    let at = 0;
    for (const t of types) if (t === order[at]) at++;
    expect(order.slice(at)).toEqual([]);
    expect(events.find((e) => e.type === 'COMMAND_REFUSED')).toMatchObject({
      reason: 'BELOW_TIDE_LINE',
      detail: 'C_HILD',
    });
    const state = sim.state;
    expect(state.facts[FACT_HILD_FOUND]).toBe(true);
    expect(state.facts[FACT_HILD_SAFE]).toBe(true);
    expect(state.oneShots['BEAT_1_WAKE']).toBe(1);
    expect(state.household.residents).toEqual(['C_HILD']);
    expect(state.people['C_HILD']?.status).toBe('wounded');
    const hild = state.onFoot?.actors['C_HILD'];
    expect(hild?.pose).toBe('sit');
    const where = tileOf(map, hild?.x ?? 0, hild?.y ?? 0);
    expect(aboveTideLine(terrainAt(map, where.tx, where.ty))).toBe(true);
    // Under a minute at walking pace, from waking to safe.
    expect(bot.ticks).toBeLessThan(60 * 60);
  });

  it('offers exactly the next thing to do: lift beside her, set down only above the tide line', () => {
    const { sim } = start();
    const onFoot = sim.state.onFoot;
    if (onFoot === null) throw new Error('no on-foot state');
    expect(interactionNow(onFoot, map, land.rules, false)).toBeNull();
    const hild = onFoot.actors['C_HILD'];
    if (hild === undefined) throw new Error('no Hild');
    onFoot.player.x = hild.x + 30;
    onFoot.player.y = hild.y;
    expect(interactionNow(onFoot, map, land.rules, false)).toEqual({
      kind: 'LIFT',
      target: 'C_HILD',
    });
    // In the net, with no blade: she says what she needs, and stays where she is.
    const said: string[] = [];
    sim.events.onAny((e) => {
      if (e.type === 'PERSON_SPOKE') said.push(e.lineKey);
    });
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(onFoot.carrying).toBeNull();
    expect(said).toContain('c_hild.net.no_blade');
    // With the seax, a hold-to-cut frees her (Book 10 cutHold), then she is lifted.
    sim.state.player.hotbar.slots[0] = 'ITEM_SEAX';
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(onFoot.player.work?.task).toBe('TASK_CUT_NET');
    for (let i = 0; i < 95; i++) sim.step();
    expect(sim.state.facts['ch1.net_free']).toBe(true);
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(onFoot.carrying).toBe('C_HILD');
    onFoot.player.facing = 's';
    expect(interactionNow(onFoot, map, land.rules, false)).toMatchObject({
      kind: 'SET_DOWN',
      refusal: 'BELOW_TIDE_LINE',
    });
  });

  it('refuses Interact with nothing in reach, with the reason', () => {
    const { sim, events } = start();
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'COMMAND_REFUSED', reason: 'NOTHING_IN_REACH' }),
    );
  });

  it('replays the whole rescue to identical state hashes', () => {
    const { world, sim } = start('replay');
    const startState = JSON.parse(JSON.stringify(world)) as typeof world;
    const inputs: { tick: number; command: Parameters<typeof sim.submit>[0] }[] = [];
    const submit = sim.submit.bind(sim);
    sim.submit = (command) => {
      inputs.push({ tick: sim.state.tick, command });
      submit(command);
    };
    const bot = new OpeningBot(sim, map, b, land);
    bot.pickUp('wreck_seax');
    bot.rescue('C_HILD');
    const recording = record(b, startState, inputs, bot.ticks, 60, land);
    expect(recording.final.facts[FACT_HILD_SAFE]).toBe(true);
    expect(replay(b, recording, land)).toEqual({ ok: true, mismatches: [] });
  });
});

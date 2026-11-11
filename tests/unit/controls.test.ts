/**
 * Stage 6 rework, check 8: the mouse-first controls (Book 2 section 21; Book 10 section 21). The
 * hotbar by number keys and the wheel, the target tile per device, left-click to use and
 * right-click to interact within reach, a click beyond reach refused without touching the
 * simulation, the bow drawn towards the cursor, and the rescue finished with the mouse.
 */
import { describe, expect, it } from 'vitest';
import {
  parseControlsBalance,
  parsePeopleBasics,
  parseStartingWeapons,
  parseTimeBalance,
} from '../../src/content/balance.ts';
import { ACTIONS, DEFAULT_BINDINGS, sameBinding, SLOT_ACTIONS } from '../../src/input/actions.ts';
import { InputMapper } from '../../src/input/inputState.ts';
import { aimDirection, targetTile } from '../../src/input/targeting.ts';
import { Session } from '../../src/scenes/session.ts';
import type { TargetInput } from '../../src/scenes/session.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { tileOf } from '../../src/sim/land/zoneMap.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const controls = parseControlsBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const map = land.maps.get('ZONE_SK_STRAND');
if (map === undefined) throw new Error('no strand');
const strand = map;
const FRAME = 1000 / 60;

/** A new campaign; armed, with the bow (and its starting arrows) and the seax already found. */
function play(seed = 'controls', armed = false) {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  if (armed) {
    world.player.hotbar.slots[0] = 'ITEM_BOW';
    world.player.hotbar.slots[1] = 'ITEM_SEAX';
    world.player.hotbar.slots[2] = 'ITEM_LINE';
    world.player.inventory['ITEM_ARROW'] = parseStartingWeapons(balance).startingArrows;
  }
  const sim = createSimulation(b, world, land);
  const input = new InputMapper(DEFAULT_BINDINGS);
  const session = new Session(
    sim,
    input,
    { awareHostiles: () => 0 },
    { map: strand, controls, rules: land.rules },
  );
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no strand');
  return { world, sim, input, session, events, onFoot };
}

/** The pointer over the middle of a tile. */
const over = (tx: number, ty: number): TargetInput => ({
  device: 'mouse',
  pointer: { x: (tx + 0.5) * 24, y: (ty + 0.5) * 24 },
});

describe('the bindings (Book 2 section 21, Book 10 section 21)', () => {
  it('puts the twelve slots on 1 to 9, 0, minus and equals, and the wheel through them', () => {
    expect(SLOT_ACTIONS.map((a) => DEFAULT_BINDINGS[a][0])).toEqual(
      ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9']
        .concat(['Digit0', 'Minus', 'Equal'])
        .map((code) => ({ device: 'key', code })),
    );
    expect(SLOT_ACTIONS).toHaveLength(controls.hotbarSlots);
    expect(DEFAULT_BINDINGS.slotNext).toContainEqual({ device: 'wheel', dir: 1 });
    expect(DEFAULT_BINDINGS.slotPrev).toContainEqual({ device: 'wheel', dir: -1 });
    // The quick commands moved off the number keys, to F1 to F6.
    expect(
      (['quick1', 'quick2', 'quick3', 'quick4', 'quick5', 'quick6'] as const).map(
        (a) => DEFAULT_BINDINGS[a][0],
      ),
    ).toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'F6'].map((code) => ({ device: 'key', code })));
    expect(DEFAULT_BINDINGS.useItem).toContainEqual({ device: 'mouse', button: 0 });
    expect(DEFAULT_BINDINGS.interact).toContainEqual({ device: 'mouse', button: 2 });
  });

  it('never gives one input to two actions', () => {
    const all = ACTIONS.flatMap((a) => DEFAULT_BINDINGS[a].map((binding) => ({ a, binding })));
    for (const x of all)
      for (const y of all)
        if (x.a !== y.a) expect(sameBinding(x.binding, y.binding), `${x.a} ${y.a}`).toBe(false);
  });

  it('presses the wheel’s action once a notch', () => {
    const input = new InputMapper(DEFAULT_BINDINGS);
    input.wheel(1);
    expect(input.sample().pressed.has('slotNext')).toBe(true);
    expect(input.sample().pressed.has('slotNext')).toBe(false);
    input.wheel(-1);
    expect(input.sample().pressed.has('slotPrev')).toBe(true);
  });
});

describe('the target tile (Book 2 section 21)', () => {
  const base = {
    steerer: { x: 10.5 * 24, y: 10.7 * 24, facing: 'e' as const },
    pointer: { x: 14.2 * 24, y: 8.1 * 24 },
    stick: { x: 0, y: 0 },
    tileSize: 24,
    reach: controls.toolReach,
    deadZone: controls.gamepadDeadZone,
  };
  it('is the tile under the cursor, the tile ahead on the keyboard, the stick’s way on a pad', () => {
    expect(targetTile({ ...base, device: 'mouse' })).toEqual({ tx: 14, ty: 8 });
    expect(targetTile({ ...base, device: 'key' })).toEqual({ tx: 11, ty: 10 });
    expect(targetTile({ ...base, device: 'pad' })).toEqual({ tx: 11, ty: 10 });
    expect(targetTile({ ...base, device: 'pad', stick: { x: 0, y: -1 } })).toEqual({
      tx: 10,
      ty: 9,
    });
    expect(targetTile({ ...base, device: 'pad', stick: { x: -0.7, y: 0.7 } })).toEqual({
      tx: 9,
      ty: 11,
    });
    // Inside the dead zone the stick counts as released.
    expect(targetTile({ ...base, device: 'pad', stick: { x: 0.1, y: 0.1 } })).toEqual({
      tx: 11,
      ty: 10,
    });
  });

  it('quantises the aim to a fixed set of directions', () => {
    expect(aimDirection(1, 0, 64)).toBe(0);
    expect(aimDirection(0, 1, 64)).toBe(16);
    expect(aimDirection(-1, 0, 64)).toBe(32);
    expect(aimDirection(0, -1, 64)).toBe(48);
  });
});

describe('the hotbar', () => {
  it('starts empty-handed: no bow, no blade, no arrows (Book 10 startingHotbar: Empty)', () => {
    const { world } = play();
    expect(parseStartingWeapons(balance).startingHotbarEmpty).toBe(true);
    expect(world.player.hotbar.slots).toHaveLength(controls.hotbarSlots);
    expect(world.player.hotbar.slots.every((s) => s === null)).toBe(true);
    expect(world.player.hotbar.selected).toBe(0);
    expect(world.player.inventory).toEqual({});
    expect(world.player.tipsSeen).toEqual([]);
  });

  it('is chosen by the number keys and the wheel, through the simulation', () => {
    const { world, input, session } = play();
    input.keyDown('Digit2');
    session.frame(FRAME);
    input.keyUp('Digit2');
    expect(world.player.hotbar.selected).toBe(1);
    input.keyDown('Equal');
    session.frame(FRAME);
    input.keyUp('Equal');
    expect(world.player.hotbar.selected).toBe(11);
    input.wheel(1);
    session.frame(FRAME);
    expect(world.player.hotbar.selected).toBe(0);
    input.wheel(-1);
    session.frame(FRAME);
    expect(world.player.hotbar.selected).toBe(11);
  });
});

describe('use and interact at a tile', () => {
  it('refuses a click beyond reach visibly and never moves the simulation', () => {
    const { sim, input, session, onFoot } = play('controls', true);
    const own = tileOf(strand, onFoot.player.x, onFoot.player.y);
    const far = over(own.tx - 6, own.ty - 2);
    session.frame(FRAME, undefined, far);
    const hash = (): string => stateHash({ ...sim.state, tick: 0, clock: { ...sim.state.clock } });
    const before = { hash: hash(), x: onFoot.player.x, sent: session.tileCommands };
    input.mouseDown(2);
    const right = session.frame(0, undefined, far);
    input.mouseUp(2);
    expect(right.target?.refused).toBe('TOO_FAR');
    expect(right.target?.inReach).toBe(false);
    // A tool in hand (the fishing line; Stage 9 made the seax a blade swung at the cursor).
    input.keyDown('Digit3');
    session.frame(0, undefined, far);
    input.keyUp('Digit3');
    input.mouseDown(0);
    const left = session.frame(0, undefined, far);
    input.mouseUp(0);
    expect(left.target?.refused).toBe('TOO_FAR');
    expect(session.tileCommands).toBe(before.sent);
    expect(onFoot.player.x).toBe(before.x);
    // Only the slot choice changed; nothing else in the world.
    sim.state.player.hotbar.selected = 0;
    expect(hash()).toBe(before.hash);
  });

  it('swings a blade towards a click beyond reach, never refusing it (Stage 9, decision S9-22)', () => {
    const { sim, input, session, onFoot } = play('controls', true);
    const own = tileOf(strand, onFoot.player.x, onFoot.player.y);
    const far = over(own.tx - 6, own.ty);
    input.keyDown('Digit2');
    session.frame(FRAME, undefined, far);
    input.keyUp('Digit2');
    input.mouseDown(0);
    const left = session.frame(FRAME, undefined, far);
    expect(left.target?.refused).toBeNull();
    expect(onFoot.player.fight?.state).toBe('chargeL0');
    expect(onFoot.player.fight?.facing).toBe('w');
    input.mouseUp(0);
    session.frame(FRAME, undefined, far);
    expect(session.tileCommands).toBe(0);
    expect(sim.state.player.hotbar.selected).toBe(1);
  });

  it('refuses out-of-reach commands in the simulation too, changing nothing', () => {
    const { sim, events, onFoot } = play('controls', true);
    const own = tileOf(strand, onFoot.player.x, onFoot.player.y);
    /** The world without the clock, which moves on each tick whatever happens. */
    const world = (): string =>
      JSON.stringify({ ...sim.state, tick: 0, clock: null, calendar: null });
    const before = world();
    sim.submit({ type: 'INTERACT_AT', tile: { tx: own.tx - 5, ty: own.ty } });
    sim.submit({ type: 'USE_AT', slot: 1, tile: { tx: own.tx + 4, ty: own.ty } });
    sim.step();
    expect(events.filter((e) => e.type === 'COMMAND_REFUSED')).toMatchObject([
      { command: 'INTERACT_AT', reason: 'OUT_OF_REACH' },
      { command: 'USE_AT', reason: 'OUT_OF_REACH' },
    ]);
    expect(world()).toBe(before);
  });

  it('finishes the rescue with the mouse: right-click Hild, carry her up, right-click dry shingle', () => {
    const { world, input, session, events, onFoot } = play();
    const hild = onFoot.actors['C_HILD'];
    if (hild === undefined) throw new Error('no Hild');
    // Stand on the dry sand just above her, as a player wading out would.
    onFoot.player.x = hild.x;
    onFoot.player.y = hild.y - 24;
    const at = tileOf(strand, hild.x, hild.y);
    input.mouseDown(2);
    // The click lands on her body: the tile above her feet.
    session.frame(FRAME, undefined, over(at.tx, at.ty - 1));
    input.mouseUp(2);
    session.frame(FRAME, undefined, over(at.tx, at.ty - 1));
    expect(onFoot.carrying).toBe('C_HILD');
    // Up the beach to dry shingle, then set her down on the tile above.
    input.keyDown('KeyW');
    for (let i = 0; i < 60 * 6 && onFoot.player.y > 33 * 24 + 10; i++)
      session.frame(FRAME, undefined, { device: 'key', pointer: null });
    input.keyUp('KeyW');
    session.frame(FRAME);
    const me = tileOf(strand, onFoot.player.x, onFoot.player.y);
    input.mouseDown(2);
    session.frame(FRAME, undefined, over(me.tx, me.ty - 1));
    input.mouseUp(2);
    session.frame(FRAME, undefined, over(me.tx, me.ty - 1));
    expect(onFoot.carrying).toBeNull();
    expect(hild.pose).toBe('sit');
    expect(world.household.residents).toContain('C_HILD');
    expect(events.some((e) => e.type === 'BEAT_COMPLETED')).toBe(true);
  });
});

describe('the bow (Book 2 section 21: aim; combat itself is Stage 9)', () => {
  it('draws towards the cursor, turning to the nearest facing, and looses on release', () => {
    const { input, session, events, onFoot } = play('controls', true);
    const p = onFoot.player;
    const west = { device: 'mouse' as const, pointer: { x: p.x - 100, y: p.y - 30 } };
    input.mouseDown(0);
    for (let i = 0; i < 20; i++) session.frame(FRAME, undefined, west);
    expect(p.aim).not.toBeNull();
    expect(p.facing).toBe('w');
    const north = { device: 'mouse' as const, pointer: { x: p.x + 5, y: p.y - 140 } };
    for (let i = 0; i < 5; i++) session.frame(FRAME, undefined, north);
    expect(p.facing).toBe('n');
    input.mouseUp(0);
    session.frame(FRAME, undefined, north);
    expect(p.aim).toBeNull();
    expect(events.map((e) => e.type)).toContain('BOW_DRAWN');
    expect(events.find((e) => e.type === 'BOW_LOOSED')).toMatchObject({ item: 'ITEM_BOW' });
  });
});

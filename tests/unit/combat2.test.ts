/**
 * Combat v2 (design addendum 2.4 section 1; decisions DE-1 to DE-15): one test for every acceptance
 * item of the rework. The mechanics are tested at the fighter (src/sim/combat/fighter.ts) and in
 * the simulation on Wreck Strand; the scavengers at dusk are the game's own content.
 */
import { describe, expect, it } from 'vitest';
import { plainFighters } from './plainFoes.ts';
import { carefulMemory, carefulTick } from '../../src/tools/play/carefulFighter.ts';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import {
  MELEE_WEAPONS,
  parseAiBalance,
  parseCombatBalance,
} from '../../src/content/combatBalance.ts';
import { saveFor } from '../../src/persist/checkpoints.ts';
import { barAlpha } from '../../src/scenes/bars.ts';
import {
  backstabFrames,
  blowOf,
  damageOf,
  hitstopFor,
  newFighter,
  poiseHit,
  poiseMax,
  pressAttack,
  pressDodge,
  pressParry,
  releaseAttack,
  resolveBlow,
  riposteFrames,
  setBlock,
  stepFighter,
  wrapAngle,
} from '../../src/sim/combat/fighter.ts';
import type { Fighter, StaminaPool } from '../../src/sim/combat/fighter.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { footstepNoise } from '../../src/sim/land/fight.ts';
import type { FightWorld } from '../../src/sim/land/fight.ts';
import { sweptBox } from '../../src/sim/land/missiles.ts';
import { switchZone } from '../../src/sim/land/zoneLinks.ts';
import { AIM_DIRECTIONS, createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { zoneScene } from '../../src/scenes/zoneScene.ts';
import type { SheetAnims } from '../../src/scenes/zoneScene.ts';
import { visualTuning, ZoneVisuals } from '../../src/scenes/zoneVisuals.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { loadPalette, loadPeopleLook, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const cb = parseCombatBalance(balance);
const ai = parseAiBalance(balance);
const { content } = loadContentFromDisk();
const TILE = 24;
const pool = (current = 100): StaminaPool => ({ current, spentTick: 0 });

/** Runs a fighter's own clock from `from` to `to` (exclusive). */
function run(f: Fighter, from: number, to: number, p = pool()): void {
  for (let t = from; t < to; t++) stepFighter(f, t, cb, p);
}

/** A light swing by `weapon` begun at tick 0 (charged to `level` and released). */
function swing(weapon: Parameters<typeof newFighter>[0], level: 0 | 1 | 2 = 0): Fighter {
  const a = newFighter(weapon, { facing: 'w' });
  pressAttack(a, 0, cb, 'w', pool());
  const at = level === 0 ? 1 : level === 1 ? cb.charge.level1At : cb.charge.level2At;
  run(a, 0, at + 1);
  releaseAttack(a, at, cb, pool());
  return a;
}
const fromEast = { x: 1, y: 0 };

// ------------------------------------------------------------------------------- fixtures

interface Fight {
  readonly world: WorldState;
  readonly sim: Simulation;
  readonly events: SimEvent[];
}

/**
 * A fight on Wreck Strand's open shingle: one scavenger (Svart, spear) set where the test wants
 * him, the steerer with the seax (or what is asked) at (x, y) tiles. The encounter is a test's own,
 * so its people stand as placed.
 */
function strand(
  seed: string,
  opts: {
    at?: [number, number];
    foe?: [number, number];
    facing?: 's' | 'n' | 'e' | 'w';
    warns?: boolean;
    hand?: string | null;
    time?: string;
    members?: { person: string; x: number; y: number; facing: 's' | 'n' | 'e' | 'w' }[];
    speed?: number;
  } = {},
): Fight {
  const [fx, fy] = opts.foe ?? [72, 34.5];
  const fixture = {
    ...content,
    searches: null,
    combat:
      content.combat === null
        ? null
        : {
            ...content.combat,
            fighters: plainFighters(content.combat.fighters),
            // A club for the tests (no club is in Chapter 1's content).
            weapons: {
              ...content.combat.weapons,
              ITEM_CLUB: { row: 'Club or hammer' as const, layer: 'club' },
            },
            encounters: [
              {
                id: 'SCN_SK_WRECKERS',
                zone: 'ZONE_SK_STRAND',
                takesCaptives: false,
                checkpoint: 'test',
                ...(opts.warns === true ? { warns: true } : {}),
                members: opts.members ?? [
                  { person: 'E_WRECKER_SVART', x: fx, y: fy, facing: opts.facing ?? 'w' },
                ],
              },
            ],
          },
  };
  const land0 = landContext(fixture, balance);
  const land =
    opts.speed === undefined
      ? land0
      : { ...land0, missiles: { ...land0.missiles, arrowSpeed: opts.speed } };
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(`camp=broch&time=${opts.time ?? '10:00'}`));
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  const [x, y] = opts.at ?? [fx + 6, fy];
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: x * TILE, y: y * TILE });
  const hand = opts.hand === undefined ? 'ITEM_SEAX' : opts.hand;
  world.player.hotbar.slots[0] = hand;
  world.player.hotbar.slots[1] = 'ITEM_BOW';
  world.player.inventory['ITEM_ARROW'] = 30;
  world.player.hotbar.selected = 0;
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  return { world, sim, events };
}

/** The game's own scavengers at dusk on the first day (Book 6 section 18), the steerer at (x, y). */
function dusk(seed: string, at: [number, number], hand: string | null = null): Fight {
  const land = landContext(content, balance);
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams('camp=broch&time=18:35'));
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: at[0] * TILE, y: at[1] * TILE });
  world.player.hotbar.slots[0] = hand;
  world.player.hotbar.selected = 0;
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  return { world, sim, events };
}

const actor = (f: Fight, id: string) => {
  const a = f.world.onFoot?.actors[id];
  if (a === undefined) throw new Error(`no ${id}`);
  return a;
};
const fa = (f: Fight, id: string) => {
  const x = actor(f, id).fight;
  if (x === undefined) throw new Error(`${id} is not fighting`);
  return x;
};
const player = (f: Fight) => {
  const p = f.world.onFoot?.player;
  if (p === undefined) throw new Error('no steerer');
  return p;
};
/** Stops someone choosing or defending (a target that stands for a test). */
const freeze = (f: Fight, id: string): void => {
  const x = fa(f, id);
  x.ai.next = Number.MAX_SAFE_INTEGER;
  x.ai.react = null;
  x.able = false;
};
const alert = (f: Fight, id: string): void => {
  const x = fa(f, id);
  const p = player(f);
  x.ai.awareness = { level: ai.awareness.alertAt, state: 'ALERT', heard: f.world.tick };
  x.ai.aware = true;
  x.ai.memory = { x: p.x, y: p.y, tick: f.world.tick, seen: true };
  x.ai.target = 'P_STEERER';
};
const steps = (f: Fight, n: number, each?: () => void): void => {
  for (let i = 0; i < n; i++) {
    each?.();
    f.sim.step();
  }
};
const move = (f: Fight, x: number, y: number, run = false): void => {
  f.sim.submit({ type: 'MOVE', x, y, run, sneak: false });
};

/** Draws the bow at a direction (one of AIM_DIRECTIONS) and distance, holds it full, looses. */
function shoot(f: Fight, dir: number, dist: number | null, beforeLoose?: () => void): void {
  f.sim.submit({ type: 'SELECT_SLOT', slot: 1 });
  f.sim.step();
  f.sim.submit({ type: 'AIM', dir, dist });
  steps(f, landContext(content, balance).missiles.bow.drawTicks);
  beforeLoose?.();
  f.sim.submit({ type: 'AIM', dir: null });
  steps(f, 1);
}
const struck = (f: Fight) =>
  f.events.filter(
    (e): e is Extract<SimEvent, { type: 'MISSILE_STRUCK' }> => e.type === 'MISSILE_STRUCK',
  );

// ------------------------------------------------------------------------------ the arrow fix

describe('the arrow fix (decision DE-10; Book 10 sweptHits)', () => {
  it('sweeps the whole path: a box is found however far the missile went in one tick', () => {
    // A body at the origin (12 x 6 box), a missile crossing it in one 500 px step.
    expect(sweptBox(-250, -2, 250, -2, 6, 6, 0.5)).toBeCloseTo((250 - 6) / 500);
    // Sampled every 2 px it would be found too; at 500 px a step (no sweep) it would be missed.
    expect(sweptBox(-250, -20, 250, -20, 6, 6, 0.5)).toBeNull();
    // A body moving across the path is met: relative motion counts.
    expect(sweptBox(-100, 20, 100, -30, 6, 6, 0.5)).not.toBeNull();
  });

  const STATES = [
    'idle',
    'alert',
    'attacking',
    'blocking',
    'dodging',
    'staggered',
    'downed',
    'fleeing',
    // Design addendum 2.5's states: arrows still hit in every one of them.
    'parryWindup',
    'parrying',
    'blockRaise',
    'dodgeRecovery',
    'guardBroken',
    'exhausted',
    'hopping',
    'winding',
  ] as const;
  for (const speed of [16, 64, 400, 3000])
    it(`hits in every combat state at ${speed} tiles a second (fast ones would tunnel)`, () => {
      const hits: string[] = [];
      for (const state of STATES) {
        // One who runs is shot from nearer, so the arrow catches up within its range.
        const f = strand(`arrow-${state}-${speed}`, {
          foe: [72, 34.5],
          at: [state === 'fleeing' ? 76 : 78, 34.5],
          facing: 'n',
          speed,
        });
        const svart = actor(f, 'E_WRECKER_SVART');
        const s = fa(f, 'E_WRECKER_SVART');
        freeze(f, 'E_WRECKER_SVART');
        if (state !== 'idle') alert(f, 'E_WRECKER_SVART');
        const far = 1e9;
        if (state === 'attacking') {
          pressAttack(s.f, f.world.tick, cb, 'n', s.stamina);
          releaseAttack(s.f, f.world.tick + 1, cb, s.stamina);
          s.f.activeAt = far;
          s.f.activeEnd = far;
          s.f.recoveryEnd = far;
        }
        if (state === 'blocking') {
          // Raised to the north: the arrow from the east meets the body, not the board.
          s.f.shield = true;
          setBlock(s.f, true, f.world.tick);
        }
        if (state === 'dodging') {
          pressDodge(s.f, f.world.tick, cb, { x: 0, y: 1 }, s.stamina);
          s.f.since = f.world.tick + 30 - cb.dodge.invulnFrom; // in its invulnerable ticks
          s.f.recoveryEnd = far;
          s.f.dodge = { x: 0, y: 0 };
        }
        if (state === 'staggered') {
          s.f.state = 'stagger';
          s.f.recoveryEnd = far;
        }
        if (state === 'downed') {
          s.f.state = 'downed';
          svart.pose = 'down';
        }
        if (state === 'parryWindup' || state === 'parrying') {
          // Facing north: the arrow from the east meets the body (missiles cannot be parried).
          s.f.state = state === 'parryWindup' ? 'parryWindup' : 'parry';
          s.f.recoveryEnd = far;
        }
        if (state === 'blockRaise' || state === 'dodgeRecovery' || state === 'guardBroken') {
          s.f.state = state;
          s.f.recoveryEnd = far;
        }
        if (state === 'exhausted') {
          s.stamina.current = 0;
          s.stamina.spentTick = far;
          s.f.exhausted = true;
        }
        if (state === 'hopping') s.ai.hop = { since: far, x: 0, y: 0 };
        if (state === 'winding') {
          // A long enemy wind-up, its telegraph drawn back (a heavy's hold).
          pressAttack(s.f, f.world.tick, cb, 'n', s.stamina);
          s.f.since = far;
        }
        // Due west (direction 32), at the feet (a full-range shot for one who runs as it flies).
        shoot(f, AIM_DIRECTIONS / 2, state === 'fleeing' ? null : 6, () => {
          if (state !== 'fleeing') return;
          s.ai.mode = 'FLEE';
          s.ai.next = 0;
        });
        steps(f, 120);
        const hit = struck(f).find((e) => e.target === 'E_WRECKER_SVART');
        if (hit !== undefined) hits.push(state);
        else console.log(`missed ${state} at ${speed}`, JSON.stringify(struck(f)));
      }
      expect(hits).toEqual([...STATES]);
    });

  it('hits before, during and after a fight, and hits the dead (it sticks in the body)', () => {
    const f = strand('arrow-dead', { foe: [72, 34.5], at: [78, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    const s = fa(f, 'E_WRECKER_SVART');
    s.vitality = 1;
    shoot(f, AIM_DIRECTIONS / 2, 6);
    steps(f, 60);
    expect(f.events.some((e) => e.type === 'PERSON_KILLED')).toBe(true);
    shoot(f, AIM_DIRECTIONS / 2, 6);
    steps(f, 60);
    expect(struck(f).filter((e) => e.target === 'E_WRECKER_SVART').length).toBe(2);
  });

  it('a raised shield stops an arrow from the front: it sticks in the board with a thunk', () => {
    const f = strand('arrow-shield', { foe: [72, 34.5], at: [78, 34.5], facing: 'e' });
    freeze(f, 'E_WRECKER_SVART');
    alert(f, 'E_WRECKER_SVART');
    const s = fa(f, 'E_WRECKER_SVART');
    s.f.shield = true;
    setBlock(s.f, true, f.world.tick);
    const before = s.vitality;
    const stamina = s.stamina.current;
    shoot(f, AIM_DIRECTIONS / 2, 6);
    steps(f, 60);
    expect(struck(f)[0]).toMatchObject({ strike: 'shield', target: 'E_WRECKER_SVART' });
    expect(s.vitality).toBe(before);
    expect(stamina - s.stamina.current).toBeCloseTo(
      cb.block.costFactor * cb.arrow.vsShield + cb.block.costFlat,
    );
    expect(f.world.onFoot?.stuck.some((x) => x.in === 'shield')).toBe(true);
    // The thunk: a BLOW on the shield (Book 11's shield wood).
    expect(f.events).toContainEqual(
      expect.objectContaining({
        type: 'BLOW',
        outcome: 'BLOCKED',
        material: 'SHIELD',
        kind: 'missile',
      }),
    );
  });

  it('the unaware cannot dodge and take double; the aware sometimes sidestep, with a tell', () => {
    let sidesteps = 0;
    let shots = 0;
    for (let n = 0; n < 40; n++) {
      const f = strand(`dodge-${n}`, { foe: [72, 34.5], at: [79, 34.5], facing: 'e' });
      freeze(f, 'E_WRECKER_SVART');
      alert(f, 'E_WRECKER_SVART');
      // No shield (a shield-bearer raises it at a drawn bow instead, tested above).
      fa(f, 'E_WRECKER_SVART').f.shield = false;
      shoot(f, AIM_DIRECTIONS / 2, 7);
      steps(f, 60);
      shots++;
      const side = f.events.find((e) => e.type === 'SIDESTEP');
      if (side !== undefined) {
        sidesteps++;
        // The missile it read passed it: nothing struck him.
        expect(struck(f).some((e) => e.target === 'E_WRECKER_SVART')).toBe(false);
        expect(fa(f, 'E_WRECKER_SVART').f.state === 'sidestep' || f.world.tick > 0).toBe(true);
      }
    }
    // Book 10 awareDodge: 25%, seeded (the combat stream).
    expect(sidesteps / shots).toBeGreaterThan(0.1);
    expect(sidesteps / shots).toBeLessThan(0.45);
    // The unaware: never a sidestep, and double damage.
    for (let n = 0; n < 10; n++) {
      const f = strand(`unaware-${n}`, { foe: [72, 34.5], at: [79, 34.5], facing: 'e' });
      freeze(f, 'E_WRECKER_SVART');
      const before = fa(f, 'E_WRECKER_SVART').vitality;
      shoot(f, AIM_DIRECTIONS / 2, 7);
      steps(f, 60);
      expect(f.events.some((e) => e.type === 'SIDESTEP')).toBe(false);
      expect(before - fa(f, 'E_WRECKER_SVART').vitality).toBeCloseTo(
        Math.min(before, cb.arrow.damage * ai.sneakAttacks.unawareMissile),
      );
    }
  });
});

// ------------------------------------------------------------------------- stance and lock-on

describe('the stance and lock-on (decisions DE-2 and DE-3)', () => {
  it('faces the cursor with a weapon drawn, turning at Book 10’s rate', () => {
    const f = strand('stance', { foe: [62, 34.5], at: [78, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    // The cursor due north: direction 48 of 64.
    f.sim.submit({ type: 'FACE', dir: (AIM_DIRECTIONS * 3) / 4 });
    const st = player(f).stance;
    const start = st?.facing ?? 0;
    f.sim.step();
    const turned = Math.abs(wrapAngle((st?.facing ?? 0) - start)) * (180 / Math.PI);
    expect(turned).toBeCloseTo(cb.stance.turnDegreesPerTick, 5);
    steps(f, 30);
    expect(st?.facing).toBeCloseTo(-Math.PI / 2);
    expect(player(f).facing).toBe('n');
  });

  it('locks on to the enemy in front, faces it while backing off at Book 10’s speeds', () => {
    const f = strand('lock', { foe: [72, 34.5], at: [75, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    f.sim.submit({ type: 'LOCK_ON', down: true });
    f.sim.submit({ type: 'LOCK_ON', down: false });
    f.sim.step();
    const st = player(f).stance;
    expect(st?.lockOn).toBe('E_WRECKER_SVART');
    expect(f.events).toContainEqual({ type: 'LOCK_ON', target: 'E_WRECKER_SVART' });
    steps(f, 20);
    // Backing away (east, the target west): still facing it, at backOff of the walk.
    const x0 = player(f).x;
    move(f, 1, 0);
    steps(f, 60);
    const walked = (player(f).x - x0) / TILE;
    expect(Math.abs(Math.cos(st?.facing ?? 0) + 1)).toBeLessThan(0.05);
    // At backOff of the walk, less the ramp up to it (Book 10 "Movement and acceleration").
    const ramp = (up: number): number => (60 - up / 2) / 60;
    expect(walked).toBeCloseTo(2.0 * cb.stance.backOff * ramp(cb.accel.modes.backOff.up), 1);
    // Strafing (north): 0.85 of the walk, easing out of the backing off as it builds.
    const y0 = player(f).y;
    move(f, 0, -1);
    steps(f, 60);
    expect((y0 - player(f).y) / TILE).toBeCloseTo(
      2.0 * cb.stance.strafe * ramp(cb.accel.modes.strafe.up),
      1,
    );
    // Running breaks the facing: the body turns to the way of travel.
    move(f, 1, 0, true);
    steps(f, 30);
    expect(Math.cos(st?.facing ?? Math.PI)).toBeGreaterThan(0.95);
    // A hold lets go.
    move(f, 0, 0);
    f.sim.submit({ type: 'LOCK_ON', down: true });
    steps(f, cb.stance.lockReleaseHoldTicks + 1);
    expect(st?.lockOn).toBeNull();
  });

  it('switches clockwise to the next enemy within range on another press', () => {
    const f = strand('switch', {
      at: [72, 34.5],
      members: [
        { person: 'E_WRECKER_SVART', x: 68, y: 34.5, facing: 'e' },
        { person: 'E_WRECKER_CONN', x: 72, y: 30.5, facing: 's' },
      ],
    });
    freeze(f, 'E_WRECKER_SVART');
    freeze(f, 'E_WRECKER_CONN');
    f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
    steps(f, 20);
    f.sim.submit({ type: 'LOCK_ON', down: true });
    f.sim.submit({ type: 'LOCK_ON', down: false });
    f.sim.step();
    expect(player(f).stance?.lockOn).toBe('E_WRECKER_SVART');
    // West to north is clockwise on screen (y runs south).
    f.sim.submit({ type: 'LOCK_ON', down: true });
    f.sim.step();
    f.sim.submit({ type: 'LOCK_ON', down: false });
    f.sim.step();
    expect(player(f).stance?.lockOn).toBe('E_WRECKER_CONN');
  });

  it('commits attacks: no turning and no dodge from the first wind-up tick (design addendum 2.5)', () => {
    // No cancels at all (Book 10 noCancels): not even the first tick of a light becomes a dodge.
    const f = newFighter('Seax', { facing: 'e' });
    pressAttack(f, 0, cb, 'e', pool());
    expect(pressDodge(f, 1, cb, null, pool())).toBe('REFUSED');
    const sim = strand('commit', { foe: [62, 34.5], at: [78, 34.5] });
    freeze(sim, 'E_WRECKER_SVART');
    sim.sim.submit({ type: 'FACE', dir: 0 });
    steps(sim, 20);
    sim.sim.submit({ type: 'MELEE', facing: 'e' });
    sim.sim.step();
    sim.sim.submit({ type: 'MELEE_RELEASE' });
    sim.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 4 });
    steps(sim, 20);
    const st = player(sim).stance;
    // The facing is fixed at the press (Book 10 "Commitment", facing): it does not turn at all.
    expect(Math.abs(st?.facing ?? 1)).toBeLessThan(1e-9);
    // A swing that met no one recovers longer (missRecovery).
    expect(sim.events.some((e) => e.type === 'MISSED')).toBe(true);
  });
});

// --------------------------------------------------------------------------- reach and spacing

describe('reach, spacing and the weapons (decision DE-4)', () => {
  it('every weapon meets a body at its reach (and its planted step) and not beyond', () => {
    for (const name of MELEE_WEAPONS) {
      // A light's fixed step forward over its active ticks carries the blade on (Book 10 step).
      const step = (cb.weapons[name].moves.light1?.step ?? 0) * TILE;
      const reach = (cb.weapons[name].reachTiles + cb.bodyRadiusTiles) * TILE + step;
      for (const [d, expected] of [
        [reach - 1, true],
        [reach + 1, false],
      ] as const) {
        const f = strand(`reach-${name}-${d}`, { foe: [72, 34.5], at: [72, 34.5] });
        freeze(f, 'E_WRECKER_SVART');
        const svart = actor(f, 'E_WRECKER_SVART');
        const p = player(f);
        p.x = svart.x + d;
        p.y = svart.y;
        f.world.player.hotbar.slots[0] =
          name === 'Club or hammer'
            ? 'ITEM_CLUB'
            : (Object.entries(content.combat?.weapons ?? {}).find(([, w]) => w.row === name)?.[0] ??
              'ITEM_SEAX');
        // Weapons without an item in Chapter 1 are given to the steerer's fighter directly.
        f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
        steps(f, 20);
        f.sim.submit({ type: 'MELEE', facing: 'w' });
        f.sim.step();
        f.sim.submit({ type: 'MELEE_RELEASE' });
        steps(f, 60);
        const met = f.events.some((e) => e.type === 'BLOW' && e.defender === 'E_WRECKER_SVART');
        expect(met, `${name} at ${d.toFixed(1)} px`).toBe(expected);
      }
    }
  });

  it('enemies hold off just outside the steerer’s reach, further from a spear, closer to a seax', () => {
    const hold = (hand: string, seed: string): number => {
      const f = strand(seed, { foe: [70, 34.5], at: [74, 34.5], hand });
      alert(f, 'E_WRECKER_SVART');
      // Keep him from the token: he waits his turn, holding off.
      const s = fa(f, 'E_WRECKER_SVART');
      let sum = 0;
      let n = 0;
      steps(f, 600, () => {
        s.ai.nextAttack = f.world.tick + 1000;
        f.world.player.vitality = 100;
        const p = player(f);
        const a = actor(f, 'E_WRECKER_SVART');
        if (f.world.tick > 200) {
          sum += Math.hypot(a.x - p.x, a.y - p.y) / TILE;
          n++;
        }
      });
      return sum / n;
    };
    const seax = hold('ITEM_SEAX', 'space-seax');
    const spear = hold('ITEM_SPEAR', 'space-spear');
    console.log(`held off a seax at ${seax.toFixed(2)} tiles, a spear at ${spear.toFixed(2)}`);
    expect(spear).toBeGreaterThan(seax);
    expect(spear).toBeGreaterThan(cb.weapons.Spear.reachTiles + cb.bodyRadiusTiles);
  });

  it('weapon rules: the axe hook, the spear past the edge and inside, the Dane axe, mail by type', () => {
    // Axe hook: a hand axe heavy on a raised shield opens the guard and doubles the next block.
    const hook = swing('Hand axe', 1);
    const d = newFighter('Seax', { shield: true, facing: 'e' });
    setBlock(d, true, 0);
    expect(resolveBlow(hook, d, blowOf(hook, cb), fromEast, hook.activeAt, cb, 8, pool())).toBe(
      'HOOKED',
    );
    expect(d.state).toBe('guardBroken');
    expect(d.recoveryEnd - hook.activeAt).toBe(cb.rules.axeHookTicks);
    // Dane axe: every heavy breaks a guard; at level 2 it splits the shield.
    const split = swing('Dane axe', 2);
    const d2 = newFighter('Seax', { shield: true, facing: 'e' });
    setBlock(d2, true, 0);
    expect(resolveBlow(split, d2, blowOf(split, cb), fromEast, split.activeAt, cb, 8, pool())).toBe(
      'GUARD_BROKEN',
    );
    expect(d2.shield).toBe(false);
    // Seax: its level-2 charge does not break a guard.
    expect(blowOf(swing('Seax', 2), cb).guardBreak).toBe(false);
    // Shields break after Book 10's number of guard breaks.
    const d3 = newFighter('Seax', { shield: true, facing: 'e' });
    for (let k = 0; k < cb.rules.shieldBreaksAfter; k++) {
      setBlock(d3, true, 0);
      d3.state = 'block';
      const l2 = swing('Hand axe', 2);
      resolveBlow(l2, d3, blowOf(l2, cb), fromEast, l2.activeAt, cb, 8, pool());
    }
    expect(d3.shield).toBe(false);
    // Mail by type: cuts -40%, thrusts -25%, blows -10%.
    expect(damageOf({ damage: 100, type: 'CUT' }, 'MAIL', cb)).toBe(100 * (1 - cb.armour.mailCut));
    expect(damageOf({ damage: 100, type: 'THRUST' }, 'MAIL', cb)).toBe(
      100 * (1 - cb.armour.mailThrust),
    );
    expect(damageOf({ damage: 100, type: 'BLOW' }, 'MAIL', cb)).toBe(
      100 * (1 - cb.armour.mailBlow),
    );
    expect(cb.weapons['Club or hammer'].type).toBe('BLOW');
    // The spear's thrust: inside its reach it winds up longer (and does less, in the zone).
    const inside = newFighter('Spear');
    pressAttack(inside, 0, cb, 'e', pool(), { inside: true });
    releaseAttack(inside, 1, cb, pool());
    expect(inside.activeAt).toBe(
      (cb.weapons.Spear.moves.light1?.windup ?? 0) + cb.rules.spearInsideWindup,
    );
  });

  it('the spear lands part of a thrust past a single shield’s edge, and pushes back', () => {
    const f = strand('edge', { foe: [72, 34.5], at: [74, 34.5], facing: 'e', hand: 'ITEM_SPEAR' });
    freeze(f, 'E_WRECKER_SVART');
    const s = fa(f, 'E_WRECKER_SVART');
    s.f.shield = true;
    setBlock(s.f, true, f.world.tick);
    const before = s.vitality;
    const x0 = actor(f, 'E_WRECKER_SVART').x;
    f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
    steps(f, 20);
    f.sim.submit({ type: 'MELEE', facing: 'w' });
    f.sim.step();
    f.sim.submit({ type: 'MELEE_RELEASE' });
    let xAt: number | null = null;
    for (let i = 0; i < 40 && xAt === null; i++) {
      f.sim.step();
      if (f.events.some((e) => e.type === 'BLOW')) xAt = actor(f, 'E_WRECKER_SVART').x;
    }
    expect(f.events).toContainEqual(expect.objectContaining({ type: 'BLOW', outcome: 'BLOCKED' }));
    expect(before - s.vitality).toBeCloseTo(cb.weapons.Spear.damage * cb.rules.spearEdge, 1);
    // Blocked, he is not pushed back; a thrust that lands pushes (Book 10 spearKeep).
    expect(xAt).toBe(x0);
    const g = strand('keep', { foe: [72, 34.5], at: [74, 34.5], facing: 'n', hand: 'ITEM_SPEAR' });
    freeze(g, 'E_WRECKER_SVART');
    alert(g, 'E_WRECKER_SVART');
    const gx = actor(g, 'E_WRECKER_SVART').x;
    g.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
    steps(g, 20);
    g.sim.submit({ type: 'MELEE', facing: 'w' });
    g.sim.step();
    g.sim.submit({ type: 'MELEE_RELEASE' });
    let pushed: number | null = null;
    for (let i = 0; i < 40 && pushed === null; i++) {
      freeze(g, 'E_WRECKER_SVART');
      g.sim.step();
      if (g.events.some((e) => e.type === 'BLOW')) pushed = actor(g, 'E_WRECKER_SVART').x;
    }
    expect(gx - (pushed ?? gx)).toBeCloseTo(cb.rules.spearKeepTiles * TILE, 1);
  });

  it('lunges: running at the faced direction, a tell then ground covered, at a cost', () => {
    const f = newFighter('Spear');
    const p = pool(100);
    expect(pressAttack(f, 0, cb, 'e', p, { lunge: true })).toBe('STARTED');
    expect(f.state).toBe('lunge');
    expect(f.lunge).toEqual({ tiles: cb.lunge.tiles.Spear, from: cb.lunge.tellTicks });
    // Its strides over the lunge's own wind-up (Book 10 "Frame data", Lunge), after the tell.
    expect(f.activeAt).toBe(cb.lunge.tellTicks + (cb.weapons.Spear.moves.lunge?.windup ?? 0));
    expect(100 - p.current).toBe(cb.weapons.Spear.stamina + cb.lunge.staminaExtra);
    expect(100 - p.current).toBe(cb.weapons.Spear.moves.lunge?.stamina);
    // The seax and bare hands do not lunge.
    const s = newFighter('Seax');
    pressAttack(s, 0, cb, 'e', pool(), { lunge: true });
    expect(s.state).toBe('chargeL0');
  });
});

// ----------------------------------------------------------------- parry, poise and hitstop

describe('parry, riposte, poise and hitstop (decisions DE-5 and DE-7)', () => {
  it('a parry opens the attacker for Book 10’s time; the riposte is heavy, distinct and big', () => {
    const a = swing('Spear');
    const d = newFighter('Seax', { facing: 'e' });
    const at = a.activeAt - cb.parry.windup - 2;
    pressParry(d, at, cb, pool());
    for (let t = at; t <= a.activeAt; t++) stepFighter(d, t, cb, pool());
    const out = resolveBlow(a, d, blowOf(a, cb), fromEast, a.activeAt, cb, cb.parry.window, pool());
    expect(out).toBe('PARRIED');
    expect(a.state).toBe('parried');
    expect(a.recoveryEnd - a.activeAt).toBe(cb.parry.open);
    expect(hitstopFor(blowOf(a, cb), 'PARRIED', cb)).toBe(cb.parry.hitstop);
    // The parrier settles (Book 10 parrySettle), then the riposte: its ticks by weapon, x3 damage,
    // unblockable, ignoring poise.
    expect(d.state).toBe('parryRecovery');
    expect(d.recoveryEnd - a.activeAt).toBe(cb.parry.settle);
    expect(pressAttack(d, a.activeAt + 1, cb, 'e', pool())).toBe('REFUSED');
    for (let t = a.activeAt + 1; t <= a.activeAt + cb.parry.settle; t++)
      stepFighter(d, t, cb, pool());
    pressAttack(d, a.activeAt + cb.parry.settle + 1, cb, 'e', pool());
    expect(d.state).toBe('riposte');
    const fr = riposteFrames(cb, 'Seax');
    expect(fr.windup + fr.active + fr.recovery).toBe(cb.parry.riposteTicks.Seax);
    const blow = blowOf(d, cb);
    expect(blow.damage).toBe(cb.weapons.Seax.damage * cb.parry.riposteDamage);
    expect(blow.unblockable).toBe(true);
    const sword = newFighter('Sword');
    sword.riposteUntil = 10;
    pressAttack(sword, 0, cb, 'e', pool());
    expect(blowOf(sword, cb).damage).toBe(cb.weapons.Sword.damage * cb.parry.riposteDamageSword);
    // A sword widens the parry window.
    const sw = newFighter('Sword');
    pressParry(sw, 0, cb, pool());
    expect(sw.activeEnd).toBe(cb.parry.windup + cb.parry.window + cb.parry.swordExtra);
  });

  it('in the zone: the parry’s spark and long hitstop, then the riposte’s', () => {
    const f = strand('parry-zone', { foe: [72, 34.5], at: [73.2, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    alert(f, 'E_WRECKER_SVART');
    const s = fa(f, 'E_WRECKER_SVART');
    f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
    steps(f, 20);
    // Svart thrusts east; the steerer parries in time.
    pressAttack(s.f, f.world.tick, cb, 'e', s.stamina);
    releaseAttack(s.f, f.world.tick + 1, cb, s.stamina);
    const pressAt = s.f.activeAt - cb.parry.windup - 3;
    while (f.world.tick < pressAt) f.sim.step();
    f.sim.submit({ type: 'PARRY' });
    steps(f, cb.parry.windup + 6);
    const parry = f.events.find((e) => e.type === 'BLOW' && e.outcome === 'PARRIED');
    expect(parry).toMatchObject({ hitstop: cb.parry.hitstop });
    expect(s.f.state).toBe('parried');
    // Both held: neither fighter's clock runs during the hitstop.
    const p = player(f);
    expect((p.fight?.hitstop ?? 0) + 6).toBeGreaterThanOrEqual(cb.parry.hitstop);
    steps(f, cb.parry.hitstop + cb.parry.settle);
    f.sim.submit({ type: 'MELEE', facing: 'w' });
    steps(f, 40);
    const rip = f.events.find(
      (e) => e.type === 'BLOW' && e.attacker === 'P_STEERER' && e.kind === 'riposte',
    );
    expect(rip).toMatchObject({ hitstop: cb.hit.hitstopRiposte, knockback: cb.hit.knockbackBig });
    expect(rip !== undefined && 'shake' in rip ? rip.shake : null).toEqual(cb.hit.shakeRiposte);
  });

  it('poise: hits wear it, broken it staggers (a big hit knocks down), and it refills', () => {
    const d = newFighter('Seax');
    const light = blowOf(swing('Seax'), cb);
    expect(poiseMax(d, cb)).toBe(cb.poise.ordinary);
    expect(poiseMax(newFighter('Seax', { heavy: true, armour: 'MAIL' }), cb)).toBe(
      cb.poise.heavy + cb.poise.mail,
    );
    expect(poiseHit(d, light, 0, cb)).toBe('FLINCH');
    expect(d.state).toBe('idle');
    expect(d.flinchUntil).toBe(cb.hit.flinchTicks);
    expect(poiseHit(d, light, 1, cb)).toBe('FLINCH');
    expect(poiseHit(d, light, 2, cb)).toBe('STAGGER');
    expect(d.recoveryEnd - 2).toBe(cb.poise.staggerTicks);
    expect(d.poiseLost).toBe(0);
    const big = newFighter('Seax');
    expect(poiseHit(big, blowOf(swing('Club or hammer', 2), cb), 0, cb)).toBe('KNOCKDOWN');
    run(big, 0, cb.poise.knockdownTicks + 1);
    expect(big.state).toBe('getUp');
    // Refills after Book 10's pause.
    const r = newFighter('Seax');
    poiseHit(r, light, 0, cb);
    run(r, 0, cb.poise.regenDelay - 1);
    expect(r.poiseLost).toBe(light.poise);
    run(r, cb.poise.regenDelay, cb.poise.regenDelay + 60);
    expect(r.poiseLost).toBe(0);
  });

  it('hitstop ticks by blow (Book 10), holding both fighters while others run', () => {
    expect(hitstopFor(blowOf(swing('Seax'), cb), 'HIT', cb)).toBe(cb.hit.hitstopCleanSeax);
    expect(hitstopFor(blowOf(swing('Hand axe'), cb), 'HIT', cb)).toBe(cb.hit.hitstopClean);
    expect(hitstopFor(blowOf(swing('Club or hammer'), cb), 'HIT', cb)).toBe(
      cb.hit.hitstopCleanHeavyWeapon,
    );
    expect(hitstopFor(blowOf(swing('Seax', 1), cb), 'HIT', cb)).toBe(cb.hit.hitstopHeavy);
    expect(hitstopFor(blowOf(swing('Seax'), cb), 'BLOCKED', cb)).toBe(cb.hit.hitstopBlock);
    // In the zone: the seax hit holds Svart and the steerer three ticks; Conn walks on.
    const f = strand('hitstop', {
      at: [73.1, 34.5],
      members: [
        { person: 'E_WRECKER_SVART', x: 72, y: 34.5, facing: 'e' },
        { person: 'E_WRECKER_CONN', x: 66, y: 34.5, facing: 'e' },
      ],
    });
    freeze(f, 'E_WRECKER_SVART');
    const conn = fa(f, 'E_WRECKER_CONN');
    conn.ai.next = Number.MAX_SAFE_INTEGER;
    conn.ai.goal = { x: 69 * TILE, y: 34.5 * TILE, run: false };
    f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
    steps(f, 20);
    f.sim.submit({ type: 'MELEE', facing: 'w' });
    f.sim.step();
    f.sim.submit({ type: 'MELEE_RELEASE' });
    let held: number | null = null;
    for (let i = 0; i < 30 && held === null; i++) {
      f.sim.step();
      const blow = f.events.find((e) => e.type === 'BLOW' && e.attacker === 'P_STEERER');
      if (blow !== undefined) held = f.world.tick;
    }
    expect(held).not.toBeNull();
    const s = fa(f, 'E_WRECKER_SVART');
    const p = player(f).fight;
    expect(s.f.hitstop).toBe(cb.hit.hitstopCleanSeax);
    expect(p?.hitstop).toBe(cb.hit.hitstopCleanSeax);
    const recovery = p?.recoveryEnd ?? 0;
    const cx = actor(f, 'E_WRECKER_CONN').x;
    steps(f, cb.hit.hitstopCleanSeax);
    // The steerer's strike was held: its recovery moved on by the hitstop.
    expect(p?.recoveryEnd).toBe(recovery + cb.hit.hitstopCleanSeax);
    expect(actor(f, 'E_WRECKER_CONN').x).not.toBe(cx);
  });
});

// -------------------------------------------------------------- health, stamina and healing

describe('health, stamina, healing and the bars (decision DE-8)', () => {
  it('the first scavengers fall to three clean seax hits, or one riposte', () => {
    const outlaw = ai.archetypes['Outlaw']?.vitality ?? 0;
    const archer = ai.archetypes['Archer']?.vitality ?? 0;
    const seax = cb.weapons.Seax.damage;
    expect(2 * seax).toBeLessThan(Math.min(outlaw, archer));
    expect(3 * seax).toBeGreaterThanOrEqual(Math.max(outlaw, archer));
    expect(seax * cb.parry.riposteDamage).toBeGreaterThanOrEqual(Math.max(outlaw, archer));
    // In the zone: three light seax blows kill Svart.
    const f = strand('three', { foe: [72, 34.5], at: [72.9, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    alert(f, 'E_WRECKER_SVART');
    f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
    steps(f, 20);
    const hold = (): void => {
      // He stands and takes it (no step out of reach, no blow back).
      freeze(f, 'E_WRECKER_SVART');
      const a = actor(f, 'E_WRECKER_SVART');
      a.x = 72 * TILE;
      a.y = 34.5 * TILE;
    };
    for (let k = 0; k < 3; k++) {
      f.sim.submit({ type: 'MELEE', facing: 'w' });
      hold();
      f.sim.step();
      f.sim.submit({ type: 'MELEE_RELEASE' });
      steps(f, 60, hold);
      const s = fa(f, 'E_WRECKER_SVART');
      if (s.dead === null) {
        s.f.state = 'idle';
        s.f.hitstop = 0;
      }
    }
    const hits = f.events.filter((e) => e.type === 'BLOW' && e.outcome === 'HIT').length;
    expect(hits).toBe(3);
    expect(f.events.some((e) => e.type === 'PERSON_KILLED')).toBe(true);
  });

  it('stamina waits before refilling; at nothing the fighter is exhausted (no dodge), silently', () => {
    const f = strand('exhausted', { foe: [62, 34.5], at: [78, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    f.world.player.stamina.current = 0;
    f.world.player.stamina.spentTick = f.world.tick;
    f.sim.step();
    expect(player(f).fight?.exhausted ?? true).toBe(true);
    f.sim.submit({ type: 'DODGE', x: 1, y: 0 });
    f.sim.step();
    // Refused with no word (design addendum 2.5: "Too spent" is cut); the body shows it.
    expect(player(f).fight?.state).toBe('idle');
    expect(f.events.some((e) => e.type === 'FIGHT_REFUSED')).toBe(false);
    expect(cb.stamina.regenDelay).toBe(48);
    expect(cb.exhausted.regenDelay).toBe(48);
  });

  it('binding a wound takes time, uses a binding, and a step cuts it short (the binding lost)', () => {
    const f = strand('heal', { foe: [52, 34.5], at: [78, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    f.world.player.vitality = 40;
    f.world.player.inventory['ITEM_BINDING'] = 2;
    f.sim.submit({ type: 'HEAL' });
    f.sim.step();
    expect(f.events).toContainEqual({ type: 'HEAL_STARTED', kind: 'BIND' });
    expect(f.world.player.inventory['ITEM_BINDING']).toBe(1);
    steps(f, cb.heal.bindTicks + 2);
    expect(f.world.player.vitality).toBe(40 + cb.heal.bindVitality);
    // Again: committed (design addendum 2.5), the keys do not walk it off; a hit cuts it short,
    // nothing restored, the binding gone.
    f.sim.submit({ type: 'HEAL' });
    f.sim.step();
    move(f, 1, 0);
    const x0 = player(f).x;
    steps(f, 30);
    expect(player(f).x).toBe(x0);
    move(f, 0, 0);
    const bf = player(f).fight;
    if (bf == null) throw new Error('no fighter');
    poiseHit(bf, { poise: 1, kind: 'light' }, f.world.tick, cb);
    f.sim.step();
    steps(f, cb.heal.bindTicks);
    expect(f.world.player.vitality).toBe(40 + cb.heal.bindVitality);
    expect(f.world.player.inventory['ITEM_BINDING'] ?? 0).toBe(0);
    // A ration: eating restores vitality and stamina; a hit cuts it short.
    f.world.player.inventory['ITEM_RATION'] = 1;
    f.world.player.vitality = 100;
    f.sim.submit({ type: 'HEAL' });
    f.sim.step();
    expect(f.events).toContainEqual({ type: 'HEAL_STARTED', kind: 'EAT' });
    const pf = player(f).fight;
    if (pf == null) throw new Error('no fighter');
    poiseHit(pf, { poise: 1, kind: 'light' }, f.world.tick, cb);
    expect(pf.state).toBe('idle');
    // Nothing carried: refused with the reason.
    f.sim.submit({ type: 'HEAL' });
    f.sim.step();
    expect(f.events).toContainEqual({ type: 'FIGHT_REFUSED', reason: 'NO_RATION' });
  });

  it('the bars fade 3 s after they are full outside a fight, over half a second', () => {
    const k = cb.bars;
    expect(barAlpha({ full: false, inFight: false, sinceChange: 9999 }, k)).toBe(1);
    expect(barAlpha({ full: true, inFight: true, sinceChange: 9999 }, k)).toBe(1);
    expect(barAlpha({ full: true, inFight: false, sinceChange: k.fadeAfterTicks - 1 }, k)).toBe(1);
    expect(
      barAlpha({ full: true, inFight: false, sinceChange: k.fadeAfterTicks + k.fadeTicks / 2 }, k),
    ).toBeCloseTo(0.5);
    expect(
      barAlpha({ full: true, inFight: false, sinceChange: k.fadeAfterTicks + k.fadeTicks }, k),
    ).toBe(0);
    expect(k.enemyBarTicks).toBe(240);
  });
});

// --------------------------------------------------------------- self-preservation and awareness

describe('enemies that want to live (decision DE-6)', () => {
  it('a wounded enemy backs off further, calls once for help, and the badly hurt fall back', () => {
    const distance = (vitality: number, seed: string): { d: number; called: number } => {
      const f = strand(seed, { foe: [70, 34.5], at: [73, 34.5] });
      alert(f, 'E_WRECKER_SVART');
      const s = fa(f, 'E_WRECKER_SVART');
      s.vitality = vitality;
      let sum = 0;
      let n = 0;
      steps(f, 600, () => {
        f.world.player.vitality = 100;
        s.ai.nextAttack = f.world.tick + 1000;
        if (f.world.tick > 200) {
          const p = player(f);
          sum += Math.hypot(
            actor(f, 'E_WRECKER_SVART').x - p.x,
            actor(f, 'E_WRECKER_SVART').y - p.y,
          );
          n++;
        }
      });
      return {
        d: sum / n / TILE,
        called: f.events.filter((e) => e.type === 'CALLED_FOR_HELP').length,
      };
    };
    const whole = distance(68, 'whole');
    const hurt = distance(30, 'hurt');
    console.log(`whole ${whole.d.toFixed(2)} tiles, wounded ${hurt.d.toFixed(2)} tiles`);
    expect(hurt.d).toBeGreaterThan(whole.d + 1);
    expect(hurt.called).toBe(1);
    expect(whole.called).toBe(0);
  });

  it('in a group one presses at a time while the others circle further out', () => {
    const f = strand('group', {
      at: [72, 34.5],
      members: [
        { person: 'E_WRECKER_SVART', x: 68, y: 34.5, facing: 'e' },
        { person: 'E_WRECKER_KETILL', x: 76, y: 34.5, facing: 'w' },
      ],
    });
    alert(f, 'E_WRECKER_SVART');
    alert(f, 'E_WRECKER_KETILL');
    let both = 0;
    let circled = 0;
    steps(f, 900, () => {
      f.world.player.vitality = 100;
      const modes = ['E_WRECKER_SVART', 'E_WRECKER_KETILL'].map((id) => fa(f, id).ai.mode);
      if (modes.includes('CIRCLE')) circled++;
      const attacking = ['E_WRECKER_SVART', 'E_WRECKER_KETILL'].filter((id) => {
        const s = fa(f, id).f;
        return (
          s.state.startsWith('charge') || s.state.startsWith('light') || s.state === 'heavyRelease'
        );
      });
      if (attacking.length > ai.habits.attackTokens) both++;
    });
    expect(both).toBe(0);
    expect(circled).toBeGreaterThan(0);
  });

  it('keeps off deep water and goes no further than its leash from home', () => {
    const f = strand('leash', { foe: [72, 34.5], at: [74, 34.5] });
    alert(f, 'E_WRECKER_SVART');
    const home = { ...fa(f, 'E_WRECKER_SVART').ai.home };
    // The steerer runs far east; he follows no further than Book 10's leash.
    let furthest = 0;
    steps(f, 1800, () => {
      move(f, 1, 0, true);
      f.world.player.vitality = 100;
      f.world.player.stamina.current = 100;
      const a = actor(f, 'E_WRECKER_SVART');
      furthest = Math.max(furthest, Math.hypot(a.x - home.x, a.y - home.y) / TILE);
    });
    expect(furthest).toBeLessThanOrEqual(ai.self.leashTiles + 1);
  });
});

describe('sneaking, perception and the backstab (decision DE-9)', () => {
  it('footsteps by the ground: shingle loud, sand quieter, grass soft; sneaking quietest', () => {
    const f = strand('noise', { foe: [52, 34.5], at: [78, 34.5] });
    const map = landContext(content, balance).maps.get('ZONE_SK_STRAND');
    if (map === undefined) throw new Error('no map');
    const fw = { ctx: { ai }, map, wet: () => false } as unknown as FightWorld;
    const shingle = footstepNoise(fw, 'walk', 78 * TILE, 34.5 * TILE);
    const grass = footstepNoise(fw, 'walk', 86 * TILE, 31 * TILE);
    const sneak = footstepNoise(fw, 'sneak', 86 * TILE, 31 * TILE);
    expect(shingle).toBeCloseTo(ai.noise.walk * ai.noise.shingle);
    expect(grass).toBeCloseTo(ai.noise.walk * ai.noise.grass);
    expect(sneak).toBeCloseTo(ai.noise.sneak * ai.noise.grass);
    expect(shingle).toBeGreaterThan(grass);
    expect(f.world.onFoot).not.toBeNull();
  });

  it('awareness goes unaware, suspicious ("Who’s there?"), alert, with its marks and barks', () => {
    const f = strand('aware', { foe: [72, 34.5], at: [79, 34.5], facing: 'w' });
    // Walking up behind him on shingle: heard, he turns to look, sees, and is alert.
    steps(f, 400, () => {
      move(f, -1, 0);
    });
    const states = f.events.flatMap((e) => (e.type === 'AWARENESS' ? [e.state] : []));
    expect(states.slice(0, 2)).toEqual(['SUSPICIOUS', 'ALERT']);
    expect(f.events).toContainEqual(
      expect.objectContaining({ type: 'PERSON_SPOKE', bark: 'suspicious' }),
    );
    // A sneaker far off in the open is not noticed; sneaking is a toggle.
    const g = strand('sneaky', { foe: [72, 34.5], at: [79, 34.5], facing: 'w' });
    g.sim.submit({ type: 'SNEAK' });
    steps(g, 200, () => {
      move(g, -1, 0);
    });
    expect(player(g).stance?.sneaking).toBe(true);
    expect(player(g).gait).toBe('sneak');
    expect(g.events.some((e) => e.type === 'AWARENESS' && e.state === 'ALERT')).toBe(false);
  });

  it('a backstab on the unaware: a heavy distinct strike that kills a weak foe outright', () => {
    const f = strand('backstab', { foe: [72, 34.5], at: [73, 34.5], facing: 'w' });
    freeze(f, 'E_WRECKER_SVART');
    f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
    steps(f, 20);
    f.sim.submit({ type: 'MELEE', facing: 'w' });
    f.sim.step();
    expect(player(f).fight?.state).toBe('backstab');
    expect(f.events).toContainEqual(
      expect.objectContaining({ type: 'ATTACK_STARTED', kind: 'backstab' }),
    );
    steps(f, ai.sneakAttacks.ticksSeax + 10);
    expect(f.events).toContainEqual(
      expect.objectContaining({ type: 'PERSON_KILLED', person: 'E_WRECKER_SVART' }),
    );
    const fr = backstabFrames(cb, 'Seax');
    expect(fr.windup + fr.active + fr.recovery).toBe(ai.sneakAttacks.ticksSeax);
    expect(ai.sneakAttacks.killAtOrBelow).toBeGreaterThanOrEqual(
      ai.archetypes['Outlaw']?.vitality ?? 999,
    );
  });
});

// --------------------------------------------------------------- warnings and checkpoints

describe('warnings before a fight, and checkpoint autosaves (decisions DE-11 and DE-12)', () => {
  it('warns at 8, 5 and 3 tiles; any nearer starts the fight', () => {
    const f = dusk('warn-in', [78, 35.2]);
    const conn = actor(f, 'E_WRECKER_CONN');
    // Walk up from the west slowly enough for every warning (Book 10 warnGap), stopping between.
    const walkTo = (x: number): void => {
      steps(f, 900, () => {
        move(f, player(f).x < x * TILE ? 1 : 0, 0);
      });
      move(f, 0, 0);
      steps(f, ai.warnings.gapTicks + 10);
    };
    walkTo(conn.x / TILE - 7.5);
    walkTo(conn.x / TILE - 4.5);
    // Stopping takes a step (Book 10 "Movement and acceleration"): aim a little short.
    walkTo(conn.x / TILE - 2.85);
    const warned = f.events.flatMap((e) => (e.type === 'WARNED' ? [e.stage] : []));
    expect(warned).toEqual([1, 2, 3]);
    expect(f.events.some((e) => e.type === 'FIGHT_STARTED')).toBe(false);
    steps(f, 60, () => {
      move(f, 1, 0);
    });
    expect(f.events.some((e) => e.type === 'FIGHT_STARTED')).toBe(true);
  });

  it('walking away avoids it; taking a weapon in hand gets one more warning, then the fight', () => {
    const f = dusk('warn-away', [78, 35.2]);
    steps(f, 300, () => {
      move(f, player(f).x < 83 * TILE ? 1 : 0, 0);
    });
    move(f, 0, 0);
    steps(f, 120);
    expect(f.events.some((e) => e.type === 'WARNED')).toBe(true);
    steps(f, 900, () => {
      move(f, -1, 0);
    });
    expect(f.events.some((e) => e.type === 'FIGHT_STARTED')).toBe(false);
    expect(f.world.onFoot?.battle?.warn ?? null).toBeNull();
    const g = dusk('warn-armed', [78, 35.2], 'ITEM_SEAX');
    g.world.player.hotbar.selected = 1;
    steps(g, 300, () => {
      move(g, player(g).x < 83 * TILE ? 1 : 0, 0);
    });
    move(g, 0, 0);
    steps(g, ai.warnings.gapTicks + 20);
    g.sim.submit({ type: 'SELECT_SLOT', slot: 0 });
    steps(g, ai.warnings.gapTicks * 2 + 20);
    expect(g.events.some((e) => e.type === 'FIGHT_STARTED')).toBe(true);
  });

  it('a checkpoint before each set-piece fight, on reaching camp and on waking', () => {
    expect(
      saveFor({ type: 'ENCOUNTER_STARTED', scene: 'SCN_SK_DUSK', checkpoint: 'dusk' }),
    ).toEqual({
      kind: 'checkpoint',
      label: 'dusk',
    });
    expect(saveFor({ type: 'CAMP_REACHED', day: 2 })).toEqual({ kind: 'autosave', reason: 'CAMP' });
    expect(saveFor({ type: 'WOKE', day: 2, at: '06:00', cause: 'slept' })).toEqual({
      kind: 'autosave',
      reason: 'WAKING',
    });
    // The camp reached once a day (outside a fight): the simulation says so.
    const f = strand('camp', { foe: [30, 34.5], at: [56, 34.5] });
    const onFoot = f.world.onFoot;
    if (onFoot === null) throw new Error('no zone');
    switchZone(onFoot, 'ZONE_SK_MACHAIR', { x: 35.5 * TILE, y: 31.6 * TILE });
    steps(f, 2);
    switchZone(onFoot, 'ZONE_SK_MACHAIR', { x: 35.5 * TILE, y: 31.6 * TILE });
    steps(f, 2);
    expect(f.events.filter((e) => e.type === 'CAMP_REACHED').length).toBe(1);
    // The dusk fight's checkpoint comes as it begins.
    const d = dusk('dusk-check', [80, 35.2]);
    expect(d.events).toContainEqual({
      type: 'ENCOUNTER_STARTED',
      scene: 'SCN_SK_DUSK',
      checkpoint: 'dusk',
    });
  });
});

// ------------------------------------------------------------------ the scavengers at dusk

describe('the scavengers at dusk (decisions DE-14 and DE-15; Book 6 section 18)', () => {
  it('Svart and Conn strip the stern from 18:30 on day 1, unaware; Svart’s shield on his back', () => {
    const f = dusk('dusk-there', [80, 35.2]);
    const svart = fa(f, 'E_WRECKER_SVART');
    expect(svart.f).toMatchObject({ weapon: 'Spear', shield: false });
    expect(fa(f, 'E_WRECKER_CONN').bow).toBe(true);
    expect(actor(f, 'E_WRECKER_SVART').pose).toBe('work');
    expect(f.world.onFoot?.actors['E_WRECKER_KETILL']).toBeUndefined();
  });

  it('draws Svart’s shield slung on his back while he has none in hand, in every state', () => {
    const f = dusk('dusk-slung', [91, 35.2]);
    const map = landContext(content, balance).maps.get('ZONE_SK_STRAND');
    const onFoot = f.world.onFoot;
    if (map === undefined || onFoot === null) throw new Error('no strand');
    const sheets = new Map(loadSheets(loadPalette()).map((x) => [x.name, x]));
    const anims: SheetAnims = new Map([...sheets.values()].map((x) => [x.name, x.anims]));
    const svartSheets = (): string[] =>
      zoneScene({
        map,
        onFoot,
        tick: f.world.tick,
        tideOpen: false,
        phase: 'day',
        look: loadPeopleLook('A'),
        anims,
        highlight: null,
      })
        .sprites.map((x) => x.sheet)
        .filter((x) => x.endsWith('_svart'));
    const sv = fa(f, 'E_WRECKER_SVART');
    // The slung layer has every frame the round one has (every state, all four facings).
    const back = sheets.get('layer_shield_back_svart');
    const round = sheets.get('layer_shield_round_svart');
    expect(back?.placeholder).toBe(false);
    expect([...(back?.frames.keys() ?? [])].sort()).toEqual(
      [...(round?.frames.keys() ?? [])].sort(),
    );
    // At work, and fighting: on his back, never on his arm.
    for (const state of ['idle', 'chargeL1', 'heavyRelease', 'parried'] as const) {
      sv.f.state = state;
      const drawn = svartSheets();
      expect(drawn).toContain('layer_shield_back_svart');
      expect(drawn).not.toContain('layer_shield_round_svart');
    }
    // Taken up (a shield in hand), it is drawn on the arm again.
    sv.f.shield = true;
    expect(svartSheets()).toContain('layer_shield_round_svart');
    expect(svartSheets()).not.toContain('layer_shield_back_svart');
    // Broken, it is not slung (a split shield is gone, not on his back).
    sv.f.shield = false;
    sv.f.shieldBreaks = 1;
    expect(svartSheets()).not.toContain('layer_shield_back_svart');
  });

  it('FIGHT: Svart’s slow heavy is parried; the riposte fells him; Conn runs', () => {
    // Ten seeded fights played by the careful scripted player (design addendum 2.5: it parries
    // predictively off each telegraph's flash, src/tools/play/carefulFighter.ts).
    let wins = 0;
    let parries = 0;
    const n = 10;
    for (let k = 1; k <= n; k++) {
      const f = dusk(`dusk-fight-${k}`, [92.6, 35.2], 'ITEM_SEAX');
      const onFoot = f.world.onFoot;
      if (onFoot === null) throw new Error('no zone');
      const svart = actor(f, 'E_WRECKER_SVART');
      const mem = carefulMemory();
      for (let i = 0; i < 60 * 60 && f.world.gameOver === null; i++) {
        const p = player(f);
        // Walk at him: past the warnings, the fight is on.
        if (onFoot.battle?.engaged !== true) move(f, Math.sign(svart.x - p.x), 0);
        else {
          const st = f.world.player.stamina;
          for (const c of carefulTick(onFoot, cb, f.world.tick, st.current, st.max, mem))
            f.sim.submit(c);
        }
        f.sim.step();
        const sv = onFoot.actors['E_WRECKER_SVART']?.fight;
        if (sv?.dead !== null) break;
      }
      steps(f, 600);
      const rip = f.events.find((e) => e.type === 'BLOW' && e.kind === 'riposte');
      const parried = f.events.some((e) => e.type === 'BLOW' && e.outcome === 'PARRIED');
      if (parried) parries++;
      if (parried && rip !== undefined && f.world.facts['ch1.dusk.E_WRECKER_SVART'] === 'DEAD') {
        wins++;
        // Conn runs when Svart falls or he is hit; a careful player sometimes fells him first.
        expect(['FLED', 'HELD', 'LEFT', 'DEAD']).toContain(
          f.world.facts['ch1.dusk.E_WRECKER_CONN'],
        );
        expect(f.world.facts['ch1.dusk']).toBe('FOUGHT');
        expect(f.events).toContainEqual(
          expect.objectContaining({ type: 'DUSK_RESOLVED', outcome: 'FOUGHT' }),
        );
      }
    }
    console.log(`dusk: the careful player won ${wins} of ${n} (parried in ${parries})`);
    expect(wins).toBeGreaterThanOrEqual(6);
  });

  it('WALK AWAY: they finish at dark and go to the fold; no fight', () => {
    const f = dusk('dusk-away', [72, 35.2]);
    for (let i = 0; i < 60 * 60 * 3 && f.world.facts['ch1.dusk'] === undefined; i++) f.sim.step();
    expect(f.world.facts['ch1.dusk']).toBe('DARK');
    expect(f.events.some((e) => e.type === 'FIGHT_STARTED')).toBe(false);
    expect(f.world.people['E_WRECKER_SVART']?.status).not.toBe('dead');
  });

  it('BARGAIN: salt fish from the camp’s stores; they take it and go', () => {
    const f = dusk('dusk-food', [80, 35.2]);
    const stores = Object.values(f.world.homes)[0]?.stores ?? {};
    const fish = stores['RES_SALTED_FISH'] ?? 0;
    // Close enough to be warned, then up to Svart, open-handed, to offer it.
    steps(f, 300, () => {
      move(f, player(f).x < 84 * TILE ? 1 : 0, 0);
    });
    move(f, 0, 0);
    steps(f, 30);
    const svart = actor(f, 'E_WRECKER_CONN');
    const p = player(f);
    p.x = svart.x + 1.2 * TILE;
    p.y = svart.y;
    f.sim.submit({ type: 'INTERACT' });
    steps(f, 2);
    expect(f.world.facts['ch1.dusk']).toBe('FOOD');
    expect(stores['RES_SALTED_FISH']).toBe(fish - ai.dusk.foodRd);
    expect(f.events.some((e) => e.type === 'FIGHT_STARTED')).toBe(false);
  });

  it('SNEAK: through the dune grass unseen to Conn’s back, and a backstab', () => {
    // Book 9 section 03: the tongue of dune grass on the bank (tiles 84 to 90 by 29 to 33).
    const f = dusk('dusk-sneak', [85, 30.5], 'ITEM_SEAX');
    f.sim.submit({ type: 'SNEAK' });
    const conn = actor(f, 'E_WRECKER_CONN');
    const to = { x: 89.6 * TILE, y: 33.97 * TILE };
    for (let i = 0; i < 60 * 30; i++) {
      const p = player(f);
      const dx = to.x - p.x;
      const dy = to.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) break;
      move(f, Math.min(1, d / 2) * (dx / d), Math.min(1, d / 2) * (dy / d));
      f.sim.step();
    }
    move(f, 0, 0);
    expect(player(f).gait).toBe('sneak');
    for (const id of ['E_WRECKER_CONN', 'E_WRECKER_SVART'])
      expect(fa(f, id).ai.awareness.state, id).not.toBe('ALERT');
    expect(fa(f, 'E_WRECKER_CONN').ai.awareness.state).toBe('UNAWARE');
    const p = player(f);
    const bearing = Math.atan2(conn.y - p.y, conn.x - p.x);
    f.sim.submit({ type: 'FACE', dir: Math.round((bearing / (2 * Math.PI)) * AIM_DIRECTIONS) });
    steps(f, 12);
    f.sim.submit({ type: 'MELEE', facing: 's' });
    steps(f, 60);
    expect(f.events).toContainEqual(
      expect.objectContaining({ type: 'BLOW', kind: 'backstab', defender: 'E_WRECKER_CONN' }),
    );
    expect(f.world.people['E_WRECKER_CONN']?.status).toBe('dead');
  });

  it('replays the dusk fight to the same state from a seed', () => {
    const play = (): string => {
      const f = dusk('dusk-replay', [84, 35.2], 'ITEM_SEAX');
      steps(f, 900, () => {
        move(f, 1, 0);
      });
      return stateHash(f.world);
    };
    expect(play()).toBe(play());
  });
});

// ------------------------------------------------------------------- lock-on camera

describe('the camera centres between the steerer and the locked target (Book 10 lockOnCamera)', () => {
  const palette = loadPalette();
  const anims: SheetAnims = new Map(loadSheets(palette).map((x) => [x.name, x.anims]));
  const land = landContext(content, balance);
  const strand = land.maps.get('ZONE_SK_STRAND');
  const ground = land.elevations.get('ZONE_SK_STRAND');
  const controls = parseControlsForCamera();

  /** Frames of the drawn look-ahead with the target `tiles` east of the steerer. */
  function leads(tiles: number, frames = 150): number[] {
    if (strand === undefined || ground === undefined) throw new Error('no strand');
    const world = newCampaign('lock-camera', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no zone');
    const visuals = new ZoneVisuals(strand, ground, false, visualTuning(balance, palette));
    const tide = tideAt(world.calendar, b);
    const out: number[] = [];
    for (let tick = 0; tick < frames; tick++) {
      visuals.update({
        dt: 1 / 60,
        tick,
        onFoot,
        tide,
        sky: { minuteOfDay: 900, lightFrom: 390, darkFrom: 1200 },
        anims,
        steererSheet: 'actor_p_steerer_a',
        lead:
          tick < 10
            ? { kind: 'travel' }
            : {
                kind: 'target',
                x: onFoot.player.x + tiles * TILE,
                y: onFoot.player.y,
                share: cb.stance.lockCameraShare,
              },
      });
      out.push(visuals.lead.x);
    }
    return out;
  }

  it('settles half-way to a near target', () => {
    const xs = leads(4);
    // Within the camera's snap (a whole pixel, held until the smoothed offset is past halfway).
    expect(Math.abs((xs.at(-1) ?? 0) - 4 * TILE * cb.stance.lockCameraShare)).toBeLessThanOrEqual(
      1,
    );
  });

  it('caps the look-ahead at lookAheadAiming for a far target', () => {
    const xs = leads(14);
    expect(Math.abs((xs.at(-1) ?? 0) - controls.lookAheadAiming * TILE)).toBeLessThanOrEqual(1);
  });

  it("keeps PT-0's smoothing: the lock swings the view round, never jumping", () => {
    const xs = leads(8);
    for (let i = 11; i < xs.length; i++)
      expect(Math.abs((xs[i] ?? 0) - (xs[i - 1] ?? 0))).toBeLessThanOrEqual(6);
    expect(xs[12]).toBeLessThan(xs.at(-1) ?? 0);
  });
});

/** The camera's tuning (Book 10 section 21), as the scene reads it. */
function parseControlsForCamera(): { lookAheadAiming: number } {
  return visualTuning(balance, loadPalette()).controls;
}

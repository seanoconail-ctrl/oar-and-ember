/**
 * Design addendum 2.5 section 1 (decisions DF-1 to DF-10, DF-21, DF-81): committed combat. Every
 * action has three strict phases and nothing cancels; a missed attack is punished; movement eases
 * up and down; exhaustion at an empty bar; the predictive parry; the slower block and its guard
 * break; the costly dodge; telegraphs by weight; the AI's state machine deciding at intervals and
 * waiting for openings; archers standing to shoot and hopping away once; locked-on attacks going
 * at the enemy. Every number is Book 10's (content/balance.json).
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import {
  MELEE_WEAPONS,
  parseAiBalance,
  parseCombatBalance,
} from '../../src/content/combatBalance.ts';
import type { MeleeWeaponName } from '../../src/content/combatBalance.ts';
import {
  blowOf,
  holdFor,
  locked,
  newFighter,
  phaseOf,
  pressAttack,
  pressDodge,
  pressParry,
  pressShove,
  punishable,
  releaseAttack,
  resolveBlow,
  setBlock,
  startHeal,
  stepFighter,
  windupFor,
} from '../../src/sim/combat/fighter.ts';
import type { Fighter, StaminaPool } from '../../src/sim/combat/fighter.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { switchZone } from '../../src/sim/land/zoneLinks.ts';
import { AIM_DIRECTIONS, createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { fightAnim, rampFrame } from '../../src/scenes/zoneScene.ts';
import type { Anim } from '../../src/render/sheet.ts';
import { COMBAT2_SOUNDS } from '../../src/audio/synth/combat2.ts';
import { easeVelocity } from '../../src/sim/land/onFoot.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { repoFile } from './books.ts';

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

/** Every press a fighter could make, each on a fresh copy; returns which changed the fighter. */
function tryEverything(f: Fighter, tick: number): string[] {
  const changed: string[] = [];
  const presses: [string, (g: Fighter, p: StaminaPool) => unknown][] = [
    ['attack', (g, p) => pressAttack(g, tick, cb, 'n', p)],
    ['parry', (g, p) => pressParry(g, tick, cb, p)],
    ['dodge', (g, p) => pressDodge(g, tick, cb, { x: 0, y: 1 }, p)],
    ['block', (g) => setBlock(g, true, tick, cb)],
    ['shove', (g, p) => pressShove(g, tick, cb, 'n', p)],
    ['heal', (g) => startHeal(g, tick, 60, { kind: 'BIND', x: 0, y: 0 })],
  ];
  for (const [name, press] of presses) {
    const g = structuredClone(f);
    const before = JSON.stringify({ ...g, guard: false, queued: false });
    press(g, pool());
    // A light pressed in its chain window is queued for after the recovery: not a cancel.
    if (JSON.stringify({ ...g, guard: false, queued: false }) !== before) changed.push(name);
  }
  return changed;
}

/** Plays one fighter's action through its phases, trying every press on every tick. */
function commitsThrough(
  start: (f: Fighter) => void,
  opts: { floors?: boolean; shield?: boolean; weapon?: MeleeWeaponName } = {},
): {
  phases: Set<string>;
  broken: string[];
} {
  const f = newFighter(opts.weapon ?? 'Hand axe', {
    facing: 'e',
    ...(opts.floors === true ? { floors: true } : {}),
    ...(opts.shield === true ? { shield: true } : {}),
  });
  start(f);
  const phases = new Set<string>();
  const broken: string[] = [];
  const p = pool();
  for (let t = 1; t < 400 && f.state !== 'idle' && f.state !== 'block'; t++) {
    const ph = phaseOf(f, t);
    if (ph !== null) phases.add(ph);
    expect(locked(f), `${f.state} at ${t}`).toBe(true);
    for (const what of tryEverything(f, t)) broken.push(`${f.state}@${t}:${what}`);
    stepFighter(f, t, cb, p);
  }
  return { phases, broken };
}

describe('commitment: three phases, no cancels (Book 10 "Commitment"; DF-1)', () => {
  const actions: [string, (f: Fighter) => void][] = [
    [
      'light',
      (f) => {
        pressAttack(f, 0, cb, 'e', pool());
        releaseAttack(f, 1, cb, pool());
      },
    ],
    [
      'heavy',
      (f) => {
        pressAttack(f, 0, cb, 'e', pool());
        run(f, 0, cb.charge.level1At + 1);
      },
    ],
    [
      'charged',
      (f) => {
        pressAttack(f, 0, cb, 'e', pool());
        run(f, 0, cb.charge.level2At + 1);
      },
    ],
    [
      'lunge',
      (f) => {
        pressAttack(f, 0, cb, 'e', pool(), { lunge: true });
      },
    ],
    [
      'riposte',
      (f) => {
        f.riposteUntil = 100;
        pressAttack(f, 0, cb, 'e', pool());
      },
    ],
    [
      'backstab',
      (f) => {
        pressAttack(f, 0, cb, 'e', pool(), { backstab: 'E_X' });
      },
    ],
    [
      'shove',
      (f) => {
        pressShove(f, 0, cb, 'e', pool());
      },
    ],
    [
      'parry',
      (f) => {
        pressParry(f, 0, cb, pool());
      },
    ],
    [
      'dodge',
      (f) => {
        pressDodge(f, 0, cb, null, pool());
      },
    ],
    [
      'heal',
      (f) => {
        startHeal(f, 0, cb.heal.bindTicks, { kind: 'BIND', x: 0, y: 0 });
      },
    ],
  ];
  for (const who of ['the steerer', 'an enemy (the AI)'] as const)
    for (const [name, start] of actions)
      it(`${who}: a ${name} plays wind-up, active and recovery, and no press changes it`, () => {
        const { phases, broken } = commitsThrough(
          (f) => {
            start(f);
            // A held charge can only be released (it swings): the heavy and charged swing here.
            if (name === 'heavy' || name === 'charged')
              releaseAttack(
                f,
                f.since + 1 + (name === 'heavy' ? cb.charge.level1At : cb.charge.level2At),
                cb,
                pool(),
              );
          },
          { floors: who !== 'the steerer' },
        );
        if (name !== 'heal') expect([...phases].sort()).toEqual(['ACTIVE', 'RECOVERY', 'WINDUP']);
        expect(broken).toEqual([]);
      });

  it('a block raise and lower commit; the held guard is live and walks', () => {
    const { phases, broken } = commitsThrough(
      (f) => {
        setBlock(f, true, 0, cb);
      },
      { shield: true },
    );
    expect(phases.has('WINDUP')).toBe(true);
    expect(broken).toEqual([]);
    const f = newFighter('Seax', { shield: true });
    setBlock(f, true, 0, cb);
    expect(f.state).toBe('blockRaise');
    run(f, 0, cb.block.raise + 1);
    expect(f.state).toBe('block');
    expect(locked(f)).toBe(false);
    setBlock(f, false, cb.block.raise + 1, cb);
    expect(f.state).toBe('blockLower');
    expect(f.recoveryEnd - (cb.block.raise + 1)).toBe(cb.block.lower);
  });

  it('in the zone: during an attack the keys neither move nor turn the steerer, and a dodge is refused', () => {
    const f = strand('commit-zone', { foe: [60, 34.5], at: [78, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    f.sim.submit({ type: 'FACE', dir: 0 });
    steps(f, 20);
    f.sim.submit({ type: 'MELEE', facing: 'e' });
    f.sim.step();
    f.sim.submit({ type: 'MELEE_RELEASE' });
    const p = player(f);
    const at = { x: p.x, y: p.y, facing: p.stance?.facing };
    move(f, 0, 1);
    f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 4 });
    f.sim.submit({ type: 'DODGE', x: 0, y: 1 });
    f.sim.submit({ type: 'PARRY' });
    let moved = 0;
    const sf = p.fight;
    if (sf == null) throw new Error('no fighter');
    for (let i = 0; i < 60 && sf.state !== 'idle'; i++) {
      f.sim.step();
      // The only ground an attack covers is its fixed step, forward over its active ticks.
      if (Math.abs(p.y - at.y) > 1e-9) moved++;
      expect(p.stance?.facing).toBe(at.facing);
      expect(['dodge', 'parryWindup', 'parry']).not.toContain(sf.state);
    }
    expect(moved).toBe(0);
    const step = cb.weapons.Seax.moves.light1?.step ?? 0;
    expect(p.x - at.x).toBeCloseTo(step * TILE, 5);
  });
});

describe('a missed attack is punished (Book 10 missRecovery, punish; DF-1)', () => {
  it('a whiff adds its move’s miss recovery for every weapon', () => {
    for (const name of MELEE_WEAPONS) {
      const f = newFighter(name);
      pressAttack(f, 0, cb, 'e', pool());
      releaseAttack(f, 1, cb, pool());
      const m = cb.weapons[name].moves.light1;
      if (m === undefined) throw new Error(name);
      const plain = f.recoveryEnd;
      run(f, 1, f.activeEnd + 1);
      expect(f.missed, name).toBe(true);
      expect(f.recoveryEnd - plain, name).toBe(m.miss);
      expect(punishable(f, f.activeEnd + 1), name).toBe(true);
    }
  });

  it('in the zone: an attack landed in the miss recovery is a punish (heavier hitstop and poise)', () => {
    const f = strand('punish', { foe: [72, 34.5], at: [72.9, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    alert(f, 'E_WRECKER_SVART');
    const s = fa(f, 'E_WRECKER_SVART');
    // Svart whiffs, facing away from the steerer.
    pressAttack(s.f, f.world.tick, cb, 'w', s.stamina);
    releaseAttack(s.f, f.world.tick + 1, cb, s.stamina);
    f.sim.submit({ type: 'FACE', dir: AIM_DIRECTIONS / 2 });
    while (!s.f.missed) f.sim.step();
    f.sim.submit({ type: 'MELEE', facing: 'w' });
    f.sim.step();
    f.sim.submit({ type: 'MELEE_RELEASE' });
    steps(f, 20);
    const blow = f.events.find(
      (e) => e.type === 'BLOW' && e.attacker === 'P_STEERER' && e.defender === 'E_WRECKER_SVART',
    );
    expect(blow).toMatchObject({
      outcome: 'HIT',
      punish: true,
      hitstop: cb.commitment.punishHitstop,
    });
    expect(cb.commitment).toEqual({ punishHitstop: 7, punishPoise: 1.5 });
  });
});

describe('exhausted at an empty bar (Book 10 "Exhausted"; DF-3)', () => {
  it('no attack, parry, dodge, block or shove at zero', () => {
    const f = newFighter('Seax', { shield: true });
    const p = pool(0);
    stepFighter(f, 0, cb, p);
    expect(f.exhausted).toBe(true);
    expect(pressAttack(f, 1, cb, 'e', p)).toBe('EXHAUSTED');
    expect(pressParry(f, 1, cb, p)).toBe('EXHAUSTED');
    expect(pressDodge(f, 1, cb, null, p)).toBe('EXHAUSTED');
    expect(setBlock(f, true, 1, cb)).toBe('EXHAUSTED');
    expect(pressShove(f, 1, cb, 'e', p)).toBe('EXHAUSTED');
    expect(f.state).toBe('idle');
    // Back at the threshold (30% of the maximum) and only then.
    p.current = cb.exhausted.until * 100 - 0.5;
    stepFighter(f, 2, cb, p);
    expect(f.exhausted).toBe(true);
    p.current = cb.exhausted.until * 100;
    stepFighter(f, 3, cb, p);
    expect(f.exhausted).toBe(false);
    expect(cb.exhausted).toMatchObject({
      until: 0.3,
      exhaustedRegenDelay: 60,
      exhaustedRegenPerSecond: 20,
    });
  });

  it('in the zone: half speed, its pause and slower refill, and back at the threshold', () => {
    const f = strand('tired', { foe: [52, 34.5], at: [70, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    const st = f.world.player.stamina;
    // Fresh: walking speed once at full.
    move(f, 1, 0);
    steps(f, 30);
    let x0 = player(f).x;
    steps(f, 60);
    const fresh = player(f).x - x0;
    move(f, 0, 0);
    steps(f, 30);
    st.current = 0;
    st.spentTick = f.world.tick;
    f.sim.step();
    const zeroAt = f.world.tick;
    expect(player(f).fight?.exhausted).toBe(true);
    move(f, -1, 0);
    steps(f, 30);
    x0 = player(f).x;
    steps(f, 20);
    const tired = x0 - player(f).x;
    expect(tired / 20).toBeCloseTo((fresh / 60) * cb.exhausted.speed, 2);
    move(f, 0, 0);
    // No refill for the exhausted pause, then 20 a second, until 30% of the bar.
    expect(st.current).toBe(0);
    while (player(f).fight?.exhausted === true && f.world.tick - zeroAt < 600) f.sim.step();
    const took = f.world.tick - zeroAt;
    const expected =
      cb.exhausted.exhaustedRegenDelay +
      (cb.exhausted.until * st.max * 60) / cb.exhausted.exhaustedRegenPerSecond;
    expect(Math.abs(took - expected)).toBeLessThanOrEqual(3);
  });
});

describe('the predictive parry (Book 10 "Parry"; DF-4)', () => {
  const enemyLight = (): Fighter => {
    const a = newFighter('Seax', { facing: 'w', floors: true });
    pressAttack(a, 0, cb, 'w', pool());
    releaseAttack(a, 1, cb, pool());
    return a;
  };
  it('started in the attacker’s wind-up with its live ticks over the blow, it parries', () => {
    const a = enemyLight();
    expect(a.activeAt).toBe(cb.telegraphs.floor.LIGHT);
    const results: string[] = [];
    for (let press = 0; press < a.activeAt; press++) {
      const d = newFighter('Seax', { facing: 'e' });
      const p = pool();
      pressParry(d, press, cb, p);
      run(d, press, a.activeAt + 1, p);
      const att = structuredClone(a);
      results.push(
        resolveBlow(att, d, blowOf(att, cb), { x: 1, y: 0 }, a.activeAt, cb, cb.parry.window, p),
      );
      const lead = a.activeAt - press;
      const live = lead >= cb.parry.windup && lead < cb.parry.windup + cb.parry.window;
      expect(results.at(-1), `pressed ${lead} ticks before`).toBe(live ? 'PARRIED' : 'HIT');
      if (live) expect(att.state).toBe('parried');
    }
    // The press falls 15 to 22 ticks after the flash (Book 10 parryTiming).
    const first =
      a.activeAt - cb.parry.windup - cb.parry.window + 1 - (a.activeAt - cb.telegraphs.flashLead);
    expect(first).toBe(15);
  });

  it('too early it recovers open; too late its wind-up is hit: both leave the parrier open', () => {
    const early = newFighter('Seax');
    pressParry(early, 0, cb, pool());
    run(early, 0, cb.parry.windup + cb.parry.window + 1);
    expect(early.state).toBe('parryRecovery');
    expect(punishable(early, cb.parry.windup + cb.parry.window + 1)).toBe(true);
    const late = newFighter('Seax', { facing: 'e' });
    pressParry(late, 0, cb, pool());
    const a = enemyLight();
    expect(
      resolveBlow(a, late, blowOf(a, cb), { x: 1, y: 0 }, 2, cb, cb.parry.window, pool()),
    ).toBe('HIT');
  });
});

describe('blocking (Book 10 "Block"; DF-5)', () => {
  it('a hit that empties the bar breaks the guard with the large stagger, then exhausted', () => {
    const d = newFighter('Seax', { shield: true, facing: 'e' });
    setBlock(d, true, 0, cb);
    run(d, 0, cb.block.raise + 1);
    const p = pool(5);
    const a = newFighter('Hand axe', { facing: 'w' });
    pressAttack(a, 0, cb, 'w', pool());
    releaseAttack(a, 1, cb, pool());
    expect(resolveBlow(a, d, blowOf(a, cb), { x: 1, y: 0 }, 30, cb, 8, p)).toBe('GUARD_BROKEN');
    expect(d.recoveryEnd - 30).toBe(cb.block.breakEmpty);
    expect(d.exhausted).toBe(true);
    expect(p.current).toBe(0);
    // While raising, the guard is not live: the blow lands.
    const r = newFighter('Seax', { shield: true, facing: 'e' });
    setBlock(r, true, 0, cb);
    expect(resolveBlow(a, r, blowOf(a, cb), { x: 1, y: 0 }, 2, cb, 8, pool())).toBe('HIT');
  });

  it('in the zone: a raised shield halves the speed', () => {
    const f = strand('shield-speed', { foe: [52, 34.5], at: [66, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    f.world.player.hotbar.slots[2] = 'ITEM_SHIELD';
    const speed = (): number => {
      move(f, 1, 0);
      steps(f, 30);
      const x0 = player(f).x;
      steps(f, 30);
      move(f, 0, 0);
      steps(f, 20);
      return (player(f).x - x0) / 30;
    };
    const open = speed();
    f.sim.submit({ type: 'BLOCK', on: true });
    steps(f, cb.block.raise + 2);
    expect(player(f).fight?.state).toBe('block');
    const guarded = speed();
    expect(guarded / open).toBeCloseTo(cb.block.speed, 2);
  });
});

describe('the dodge (Book 10 "Dodge"; DF-6)', () => {
  it('invulnerable only on its middle ticks; a planted recovery follows; costly', () => {
    const live: number[] = [];
    for (let t = 0; t < cb.dodge.ticks; t++) {
      const d = newFighter('Seax', { facing: 'e' });
      const p = pool();
      pressDodge(d, 0, cb, null, p);
      expect(p.current).toBe(100 - cb.dodge.stamina);
      run(d, 0, t + 1);
      const a = swing('Seax');
      if (resolveBlow(a, d, blowOf(a, cb), { x: 1, y: 0 }, t, cb, 8, pool()) === 'DODGED')
        live.push(t);
      if (t >= cb.dodge.start + cb.dodge.dash) {
        expect(d.state).toBe('dodgeRecovery');
        expect(punishable(d, t)).toBe(true);
      }
    }
    expect(live).toEqual([8, 9, 10, 11, 12, 13]);
  });
});

describe('grounded movement (Book 10 "Movement and acceleration"; DF-2)', () => {
  it('speed builds over the ticks to full and dies over the ticks to stop; a reversal passes through a stop', () => {
    const full = 1;
    const walk = cb.accel.modes.walk;
    let v = { x: 0, y: 0 };
    let n = 0;
    while (v.x < full - 1e-9) {
      v = easeVelocity(v, { x: full, y: 0 }, full, walk);
      n++;
    }
    expect(n).toBe(walk.up);
    let m = 0;
    while (v.x > 1e-9) {
      v = easeVelocity(v, { x: 0, y: 0 }, full, walk);
      m++;
    }
    expect(m).toBe(walk.stop);
    v = { x: full, y: 0 };
    const xs: number[] = [];
    for (let i = 0; i < 20; i++) {
      v = easeVelocity(v, { x: -full, y: 0 }, full, walk);
      xs.push(v.x);
    }
    expect(xs.some((x) => Math.abs(x) < 1e-9)).toBe(true);
    expect(cb.accel).toMatchObject({ mail: 1.25, heavy: 1.25, both: 1.5, runFromWalk: 15 });
  });

  it('in the zone: the steerer starts and stops over Book 10’s ticks; an attack stops at once', () => {
    const f = strand('accel', { foe: [52, 34.5], at: [66, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    const vx = (): number => player(f).vel?.x ?? 0;
    // Facing the way walked (the stance's forward speed).
    f.sim.submit({ type: 'FACE', dir: 0 });
    steps(f, 20);
    move(f, 1, 0);
    f.sim.step();
    expect(vx()).toBeGreaterThan(0);
    const full = (2.0 * TILE) / 60;
    expect(vx()).toBeLessThan(full);
    steps(f, cb.accel.modes.walk.up);
    expect(vx()).toBeCloseTo(full, 6);
    move(f, 0, 0);
    f.sim.step();
    expect(vx()).toBeGreaterThan(0);
    steps(f, cb.accel.modes.walk.stop);
    expect(vx()).toBe(0);
    move(f, 1, 0);
    steps(f, 20);
    expect(vx()).toBeGreaterThan(0);
    f.sim.submit({ type: 'MELEE', facing: 'e' });
    f.sim.step();
    expect(vx()).toBe(0);
  });
});

describe('the AI state machine (Book 10 "AI states", "AI decisions"; DF-7)', () => {
  it('changes state only on its decision ticks, holds each its least time, and does not jitter', () => {
    const f = strand('decide', { foe: [72, 34.5], at: [78, 34.5] });
    alert(f, 'E_WRECKER_SVART');
    const s = fa(f, 'E_WRECKER_SVART');
    s.ai.mode = 'FIGHT';
    const changes: { tick: number; state: string; held: number; from: string }[] = [];
    let last = s.ai.mind.state;
    let since = f.world.tick;
    let reversals = 0;
    let lastDir = s.ai.mind.dir;
    steps(f, 60 * 20, () => {
      f.world.player.vitality = 100;
      if (s.ai.mind.state !== last) {
        changes.push({
          tick: f.world.tick,
          state: s.ai.mind.state,
          held: f.world.tick - since,
          from: last,
        });
        last = s.ai.mind.state;
        since = f.world.tick;
      }
      if (s.ai.mind.dir !== lastDir) {
        reversals++;
        lastDir = s.ai.mind.dir;
      }
    });
    expect(changes.length).toBeGreaterThan(2);
    const offset = (changes[0]?.tick ?? 0) % ai.states.decisionInterval;
    for (const c of changes) {
      // Retreat after an attack follows its recovery's end (Book 10 "AI states", Retreat).
      if (c.from === 'ATTACK') continue;
      expect((c.tick - offset) % ai.states.decisionInterval, JSON.stringify(c)).toBe(0);
    }
    expect(reversals).toBeLessThanOrEqual(Math.ceil((60 * 20) / ai.states.turnAround));
    expect(ai.states).toMatchObject({ decisionInterval: 15, attackCooldown: 45, turnAround: 90 });
  });

  it('a melee enemy circles outside its range and waits; it steps in on an opening', () => {
    const f = strand('opening', { foe: [72, 34.5], at: [75, 34.5] });
    alert(f, 'E_WRECKER_SVART');
    const s = fa(f, 'E_WRECKER_SVART');
    s.ai.mode = 'FIGHT';
    // Patient beyond the test: it attacks only on an opening.
    let waited = false;
    for (let i = 0; i < 60 * 6 && !waited; i++) {
      f.world.player.vitality = 100;
      if (s.ai.mind.state === 'WAIT_FOR_OPENING') {
        s.ai.mind.patienceUntil = Number.MAX_SAFE_INTEGER;
        waited = true;
      }
      f.sim.step();
    }
    expect(waited).toBe(true);
    const sv = actor(f, 'E_WRECKER_SVART');
    const d = Math.hypot(sv.x - player(f).x, sv.y - player(f).y) / TILE;
    const reach = cb.weapons.Spear.reachTiles + cb.bodyRadiusTiles;
    expect(d).toBeGreaterThan(reach * ai.habits.closeIn);
    // It holds there while the steerer does nothing.
    steps(f, 120, () => {
      f.world.player.vitality = 100;
    });
    expect(
      f.events.filter((e) => e.type === 'ATTACK_STARTED' && e.who === 'E_WRECKER_SVART'),
    ).toEqual([]);
    // The steerer blown (exhausted): an opening it can take before it ends. It steps in.
    f.world.player.stamina.current = 0;
    f.world.player.stamina.spentTick = f.world.tick;
    steps(f, 90, () => {
      f.world.player.vitality = 100;
    });
    expect(f.events.some((e) => e.type === 'ATTACK_STARTED' && e.who === 'E_WRECKER_SVART')).toBe(
      true,
    );
  });

  it('a whiff is an opening as long as its recovery and miss recovery last, read from the drawn pose', () => {
    const f = strand('whiff-open', { foe: [72, 34.5], at: [76, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    f.world.player.hotbar.slots[0] = 'ITEM_CLUB';
    f.sim.submit({ type: 'FACE', dir: 0 });
    steps(f, 20);
    f.sim.submit({ type: 'MELEE', facing: 'e' });
    f.sim.step();
    f.sim.submit({ type: 'MELEE_RELEASE' });
    const pf = player(f).fight;
    if (pf == null) throw new Error('no fighter');
    while (!pf.missed) f.sim.step();
    const m = cb.weapons['Club or hammer'].moves.light1;
    expect(pf.recoveryEnd - pf.activeEnd).toBe((m?.recovery ?? 0) + (m?.miss ?? 0));
    expect(punishable(pf, f.world.tick + 1)).toBe(true);
  });

  it('never swarms: with the token taken, the others circle further out', () => {
    expect(ai.habits.attackTokens).toBe(1);
  });
});

describe('archers (Book 10 "Archers"; DF-8)', () => {
  it('stand completely still to settle, draw and recover, and hop away once when crowded', () => {
    const f = strand('archer25', {
      at: [78, 34.5],
      members: [{ person: 'E_WRECKER_CONN', x: 72, y: 34.5, facing: 'e' }],
    });
    alert(f, 'E_WRECKER_CONN');
    const c = fa(f, 'E_WRECKER_CONN');
    c.ai.mode = 'FIGHT';
    const conn = actor(f, 'E_WRECKER_CONN');
    let movedShooting = 0;
    let last = { x: conn.x, y: conn.y };
    let loosed = 0;
    for (let i = 0; i < 60 * 8 && loosed < 2; i++) {
      f.world.player.vitality = 100;
      f.sim.step();
      const shooting = conn.archer !== undefined && conn.archer.phase !== 'moving';
      if (shooting && (conn.x !== last.x || conn.y !== last.y)) movedShooting++;
      last = { x: conn.x, y: conn.y };
      loosed = f.events.filter(
        (e) => e.type === 'MISSILE_LOOSED' && e.shooter === 'E_WRECKER_CONN',
      ).length;
    }
    expect(loosed).toBeGreaterThanOrEqual(1);
    expect(movedShooting).toBe(0);
    // Crowded: the steerer walks in to within tooClose. One hop back, then the sidearm if still near.
    const p = player(f);
    p.x = conn.x + 2 * TILE;
    p.y = conn.y;
    steps(f, 60 * 3, () => {
      f.world.player.vitality = 100;
      move(f, Math.sign(conn.x - p.x), 0);
    });
    const hops = f.events.filter((e) => e.type === 'ARCHER_HOP' && e.who === 'E_WRECKER_CONN');
    expect(hops.length).toBe(1);
    expect(f.events.some((e) => e.type === 'SIDEARM_DRAWN' && e.who === 'E_WRECKER_CONN')).toBe(
      true,
    );
    expect(ai.archers).toMatchObject({
      tooClose: 3,
      dashTiles: 2,
      dashTicks: 18,
      settle: 6,
      recover: 20,
    });
  });
});

describe('telegraphs (Book 10 "Telegraphs", "Enemy attacks"; DF-9, DF-10)', () => {
  it('an enemy’s wind-up meets its floor and hold; the rows of "Enemy attacks" follow', () => {
    const book = repoFile('docs/10_balance_sheet.md');
    const at = book.indexOf('### Enemy attacks');
    const rows = book
      .slice(at)
      .split('\n')
      .filter((l) => l.startsWith('| ') && !l.startsWith('| Attack'));
    const want: Record<string, string> = {};
    for (const r of rows) {
      const c = r.split('|').map((x) => x.trim());
      if (c[1] !== undefined && c[3] !== undefined) want[c[1]] = c[3];
      if (r.startsWith('| Each-uisce')) break;
    }
    const names: [string, MeleeWeaponName][] = [
      ['Seax', 'Seax'],
      ['Hand axe', 'Hand axe'],
      ['Spear', 'Spear'],
      ['Sword', 'Sword'],
      ['Dane axe', 'Dane axe'],
      ['Club or hammer', 'Club or hammer'],
    ];
    const enemy = { heavy: false, floors: true };
    for (const [label, w] of names) {
      const light = cb.weapons[w].moves.light1;
      if (light === undefined) throw new Error(label);
      expect(String(windupFor(enemy, cb, light)), `${label} light`).toBe(want[`${label} light`]);
      const heavy = cb.weapons[w].moves.heavy;
      if (heavy !== undefined && want[`${label} heavy`] !== undefined) {
        const hold = holdFor(cb, heavy, 1);
        const text = `${hold + heavy.windup} (hold ${hold}, swing ${heavy.windup})`;
        expect(
          want[`${label} heavy`]?.startsWith(String(hold + heavy.windup)),
          `${label} heavy ${text}`,
        ).toBe(true);
      }
    }
    const charged = cb.weapons.Spear.moves.charged;
    if (charged === undefined) throw new Error('no spear charged heavy');
    expect(holdFor(cb, charged, 2) + charged.windup).toBe(65);
  });

  it('in the zone: an enemy’s flash comes 28 ticks before its blow, with its weight', () => {
    const flashes: number[] = [];
    const blows: number[] = [];
    // The flash events and the blows they tell, by tick (the simulation's own record).
    const ticks: { type: string; tick: number }[] = [];
    const g = strand('flash-ticks', { foe: [72, 34.5], at: [73.4, 34.5] });
    alert(g, 'E_WRECKER_SVART');
    fa(g, 'E_WRECKER_SVART').ai.mode = 'FIGHT';
    g.sim.events.onAny((e) => {
      if (e.type === 'TELEGRAPH' && e.who === 'E_WRECKER_SVART' && e.flash)
        ticks.push({ type: 'flash', tick: g.world.tick });
      if (e.type === 'BLOW' && e.attacker === 'E_WRECKER_SVART')
        ticks.push({ type: 'blow', tick: g.world.tick });
    });
    steps(g, 60 * 12, () => {
      g.world.player.vitality = 100;
    });
    for (const t of ticks) (t.type === 'flash' ? flashes : blows).push(t.tick);
    expect(flashes.length).toBeGreaterThan(0);
    // Every blow that landed had its flash 28 ticks before (hitstop holds the clock, so allow it).
    for (const blow of blows) {
      const flash = flashes.filter((x) => x <= blow).at(-1);
      expect(flash, `blow at ${blow}`).toBeDefined();
      expect(blow - (flash ?? 0)).toBeGreaterThanOrEqual(cb.telegraphs.flashLead);
    }
    expect(cb.telegraphs).toMatchObject({
      flashLead: 28,
      floor: { LIGHT: 28, HEAVY: 36, CHARGED: 48 },
      drawBack: { LIGHT: 3, HEAVY: 5, CHARGED: 7 },
    });
  });
});

describe('locked on, attacks go at the enemy (the user’s decision DF-81)', () => {
  it('with the cursor pointed elsewhere, a light, a shove and a bow go towards the locked enemy', () => {
    const f = strand('lock-aim', { foe: [72, 34.5], at: [73.2, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    f.sim.submit({ type: 'LOCK_ON', down: true });
    f.sim.submit({ type: 'LOCK_ON', down: false });
    f.sim.step();
    expect(player(f).stance?.lockOn).toBe('E_WRECKER_SVART');
    // The cursor due east, away from him (he is to the west).
    f.sim.submit({ type: 'FACE', dir: 0 });
    f.sim.submit({ type: 'MELEE', facing: 'e' });
    f.sim.step();
    const sf = player(f).fight;
    const sv = actor(f, 'E_WRECKER_SVART');
    const bearing = Math.atan2(sv.y - player(f).y, sv.x - player(f).x);
    expect(Math.cos((sf?.angle ?? 0) - bearing)).toBeGreaterThan(0.999);
    f.sim.submit({ type: 'MELEE_RELEASE' });
    steps(f, 40);
    expect(f.events.some((e) => e.type === 'BLOW' && e.defender === 'E_WRECKER_SVART')).toBe(true);
    // The bow, aimed east, looses west at him.
    f.sim.submit({ type: 'SELECT_SLOT', slot: 1 });
    f.sim.step();
    f.sim.submit({ type: 'LOCK_ON', down: true });
    f.sim.submit({ type: 'LOCK_ON', down: false });
    f.sim.step();
    f.sim.submit({ type: 'AIM', dir: 0, dist: 3 });
    f.sim.step();
    const aim = player(f).aim;
    const b2 = Math.atan2(sv.y - player(f).y, sv.x - player(f).x);
    expect(Math.cos(Math.atan2(aim?.y ?? 0, aim?.x ?? 1) - b2)).toBeGreaterThan(0.999);
  });
});

describe('the fold met during the dusk (DF-21)', () => {
  it('the dusk’s two are not at the fold until dark; then they join its band', () => {
    const land = landContext(content, balance);
    const world = newCampaign('fold-dusk', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    campHooks(world, content, land, new URLSearchParams('camp=broch&time=19:58'));
    world.facts['ch1.at_broch'] = true;
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('no zone');
    switchZone(onFoot, 'ZONE_SK_CAIRN', { x: 10 * TILE, y: 30 * TILE });
    const sim = createSimulation(b, world, land);
    sim.step();
    expect(
      Object.keys(onFoot.actors)
        .filter((id) => id.startsWith('E_WRECKER_'))
        .sort(),
    ).toEqual(['E_WRECKER_KETILL']);
    for (let i = 0; i < 60 * 60 && world.facts['ch1.dusk'] === undefined; i++) sim.step();
    expect(world.facts['ch1.dusk']).toBe('DARK');
    expect(
      Object.keys(onFoot.actors)
        .filter((id) => id.startsWith('E_WRECKER_'))
        .sort(),
    ).toEqual(['E_WRECKER_CONN', 'E_WRECKER_KETILL', 'E_WRECKER_SVART']);
    expect(onFoot.battle?.groups['SCN_SK_WRECKERS']?.members.sort()).toEqual([
      'E_WRECKER_CONN',
      'E_WRECKER_KETILL',
      'E_WRECKER_SVART',
    ]);
  });
});

describe('heal on the gamepad’s command ring (DF-21)', () => {
  it('the ring let go at its centre heals; at a segment it gives that order', async () => {
    const { CommandRing } = await import('../../src/input/commandRing.ts');
    const ring = new CommandRing();
    const frame = (held: boolean) => ({
      held: new Set(held ? ['commandRing'] : []),
      pressed: new Set<string>(),
      released: new Set<string>(),
      move: { x: 0, y: 0 },
      stick: { x: 0, y: 0 },
      byMouse: new Set<string>(),
    });
    ring.update(frame(true) as never, { x: 0, y: 0 });
    expect(ring.update(frame(false) as never, { x: 0, y: 0 })).toEqual([]);
    expect(ring.takeHeal()).toBe(true);
    expect(ring.takeHeal()).toBe(false);
    ring.update(frame(true) as never, { x: 0, y: -1 });
    expect(ring.update(frame(false) as never, { x: 0, y: -1 })).toEqual(['FOLLOW']);
    expect(ring.takeHeal()).toBe(false);
  });
});

// ------------------------------------------------------------- finishing 2.5 (DF-83, DF-84)

describe('the sounds of commitment (Book 11 section 07, "Commitment and stamina"; DF-83)', () => {
  it('a parry’s wind-up, a shield raised, a dodge landing and a whiff each send their sound', () => {
    const f = strand('commit-sounds', { foe: [52, 34.5], at: [66, 34.5] });
    freeze(f, 'E_WRECKER_SVART');
    f.world.player.hotbar.slots[2] = 'ITEM_SHIELD';
    const commit = (what: string) =>
      f.events.filter((e) => e.type === 'COMMIT_SOUND' && e.who === 'P_STEERER' && e.what === what);
    // The parry's rasp on the tick its wind-up begins.
    f.sim.submit({ type: 'PARRY' });
    f.sim.step();
    expect(player(f).fight?.state).toBe('parryWindup');
    expect(commit('PARRY_WINDUP')).toHaveLength(1);
    steps(f, 60);
    // The shield's creak as it is raised (once, not every tick it is held).
    f.sim.submit({ type: 'BLOCK', on: true });
    f.sim.step();
    expect(player(f).fight?.state).toBe('blockRaise');
    steps(f, 30);
    expect(commit('BLOCK_RAISE')).toHaveLength(1);
    f.sim.submit({ type: 'BLOCK', on: false });
    steps(f, 60);
    // The dodge's landing as its dash ends in the planted recovery.
    f.sim.submit({ type: 'DODGE', x: 0, y: 1 });
    let landed = -1;
    for (let i = 0; i < 60 && landed < 0; i++) {
      f.sim.step();
      if (player(f).fight?.state === 'dodgeRecovery') landed = f.world.tick - 1;
    }
    expect(landed).toBeGreaterThan(0);
    expect(commit('DODGE_LAND')).toHaveLength(1);
    steps(f, 60);
    // A whiff: the overbalanced scuff (MISSED) at the end of its active ticks.
    f.sim.submit({ type: 'MELEE', facing: 'e' });
    f.sim.step();
    f.sim.submit({ type: 'MELEE_RELEASE' });
    steps(f, 40);
    expect(f.events.filter((e) => e.type === 'MISSED' && e.who === 'P_STEERER')).toHaveLength(1);
  });

  it('each is a generated cue with its drawn twin and no caption (DF-80)', () => {
    const audio = JSON.parse(repoFile('content/audio.json')) as {
      cues: { id: string; drawn?: string; captionKey?: string }[];
      events: Record<string, string>;
    };
    const want = {
      PARRY_WINDUP: 'SFX_PARRY_RASP',
      BLOCK_RAISE: 'SFX_BLOCK_CREAK',
      DODGE_LAND: 'SFX_DODGE_LAND',
      WHIFF: 'SFX_WHIFF_SCUFF',
    };
    for (const [event, cue] of Object.entries(want)) {
      expect(audio.events[event]).toBe(cue);
      const c = audio.cues.find((x) => x.id === cue);
      expect(c?.drawn, cue).toBeTruthy();
      expect(c?.captionKey, cue).toBeUndefined();
      expect(COMBAT2_SOUNDS.some((d) => d.id === cue)).toBe(true);
    }
  });
});

describe('the frames that finish 2.5 (Book 7 section 01; DF-83)', () => {
  const own: Record<string, Anim> = Object.fromEntries(
    (
      [
        ['light1', 3],
        ['windup_l', 2],
        ['overbalance', 2],
        ['block', 2],
        ['block_walk', 6],
        ['block_backoff', 6],
        ['block_strafe', 6],
        ['walkstart', 2],
        ['walkstop', 2],
      ] as const
    ).map(([k, n]) => [k, { frames: n, ticks: 6, loop: false }]),
  );

  it('a whiff shows the overbalance’s two frames in its miss recovery, then the follow-through', () => {
    const f = swing('Seax');
    for (let t = 2; !f.missed && t < 200; t++) stepFighter(f, t, cb, pool());
    expect(f.missed).toBe(true);
    const seen: string[] = [];
    for (let k = f.activeEnd; k < f.recoveryEnd; k++) {
      const a = fightAnim(f, k, false, own);
      const key = `${a?.state}:${a?.frame}`;
      if (seen.at(-1) !== key) seen.push(key);
    }
    expect(seen).toEqual(['overbalance:0', 'overbalance:1', 'light1:2']);
    // A blow that met someone recovers without the overbalance.
    const g = swing('Seax');
    g.hit = true;
    for (let k = 2; k < 200 && g.state !== 'idle'; k++) {
      if (k >= g.activeEnd) expect(fightAnim(g, k, false, own)?.state).not.toBe('overbalance');
      stepFighter(g, k, cb, pool());
    }
  });

  it('a raised shield walked is the block walk: forward, backing off or strafing', () => {
    const f = newFighter('Spear', { facing: 'e', shield: true });
    f.state = 'block';
    expect(fightAnim(f, 10, false, own)?.state).toBe('block');
    expect(fightAnim(f, 10, true, own)?.state).toBe('block_walk');
    expect(fightAnim(f, 10, true, own, { gait: 'backoff' })?.state).toBe('block_backoff');
    expect(fightAnim(f, 10, true, own, { gait: 'strafe' })?.state).toBe('block_strafe');
  });

  it('speed builds through the walk start’s two frames and dies through the stop’s', () => {
    const full = 1;
    expect(rampFrame(0.2, full, true, own)).toEqual({ state: 'walkstart', frame: 0 });
    expect(rampFrame(0.6, full, true, own)).toEqual({ state: 'walkstart', frame: 1 });
    expect(rampFrame(0.9, full, true, own)).toBeNull();
    expect(rampFrame(0.7, full, false, own)).toEqual({ state: 'walkstop', frame: 0 });
    expect(rampFrame(0.3, full, false, own)).toEqual({ state: 'walkstop', frame: 1 });
    expect(rampFrame(0, full, false, own)).toBeNull();
    // A fighter walking up to speed in the zone is drawn with them.
    const f = newFighter('Spear', { facing: 'e' });
    const ramp = rampFrame(0.2, full, true, own);
    expect(fightAnim(f, 10, true, own, { ramp })).toEqual({ state: 'walkstart', frame: 0 });
  });
});

describe('an enemy’s second light (Book 10 "Telegraphs", enemyStrings; DF-84)', () => {
  /** Svart fights as `arch`; the strike states he plays, in order, and his flashes by tick. */
  function strings(arch: string, seed: string) {
    const f = strand(seed, { foe: [72, 34.5], at: [73.4, 34.5] });
    alert(f, 'E_WRECKER_SVART');
    const s = fa(f, 'E_WRECKER_SVART');
    s.ai.mode = 'FIGHT';
    s.arch = arch;
    const strikes: { state: string; since: number }[] = [];
    const flashes: number[] = [];
    let prev = '';
    f.sim.events.onAny((e) => {
      if (e.type === 'TELEGRAPH' && e.who === 'E_WRECKER_SVART' && e.flash)
        flashes.push(f.world.tick);
    });
    steps(f, 60 * 25, () => {
      f.world.player.vitality = 100;
      f.world.player.stamina.current = 100;
      const st = s.f.state;
      if ((st === 'light1' || st === 'light2' || st === 'light3') && st !== prev)
        strikes.push({ state: st, since: f.world.tick - 1 });
      prev = st;
    });
    return { strikes, flashes };
  }

  it('a warrior, raider or huscarl follows a light that met its target with a second, told again', () => {
    let seconds = 0;
    for (const [arch, seed] of [
      ['Warrior', 'strings-w'],
      ['Raider (Crowwick)', 'strings-r'],
      ['Huscarl (Orm)', 'strings-h'],
    ] as const) {
      const { strikes, flashes } = strings(arch, seed);
      expect(
        strikes.some((x) => x.state === 'light3'),
        arch,
      ).toBe(false);
      for (const [i, x] of strikes.entries()) {
        if (x.state !== 'light2') continue;
        seconds++;
        expect(strikes[i - 1]?.state).toBe('light1');
        // Its own flash, after its own wind-up began.
        expect(flashes.some((t) => t >= x.since)).toBe(true);
      }
    }
    expect(seconds).toBeGreaterThan(0);
  });

  it('an outlaw (the scavengers) never strings two', () => {
    const { strikes } = strings('Outlaw', 'strings-o');
    expect(strikes.length).toBeGreaterThan(0);
    expect(strikes.every((x) => x.state === 'light1')).toBe(true);
  });
});

/**
 * Stage 9 (Book 3, combat v1): the acceptance checks in the simulation.
 * 1. Frame data matches Book 10, and every attack's tell comes at least 6 ticks before its active
 *    frames.
 * 2. A parry inside the window staggers the attacker; a full charge breaks a block but not a parry.
 * 3. Nobody moves while drawing (the steerer, crew and enemies); missiles fly, hit, are blocked,
 *    stick, break and are recovered as Book 10 section 21 says, and replay identically from a seed.
 * 4. The steerer's death is game over and the latest autosave reloads; a downed ally never dies on
 *    a timer.
 * And the rest of the deliverable: dodge, shove, stamina, poise, morale and surrender, the
 * finisher, perception, crew orders, berserk, the cruel enemy's warning, gore's rolls.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import {
  MELEE_WEAPONS,
  parseAiBalance,
  parseCombatBalance,
} from '../../src/content/combatBalance.ts';
import { MemoryStore, SaveManager } from '../../src/persist/manager.ts';
import { hears, lightAt, sees, sightRange, stepNoise } from '../../src/sim/ai/perception.ts';
import {
  blowOf,
  charging,
  frameData,
  newFighter,
  pressAttack,
  pressDodge,
  pressParry,
  pressShove,
  releaseAttack,
  resolveBlow,
  setBlock,
  poiseHit,
  stepFighter,
  strikePhase,
  striking,
} from '../../src/sim/combat/fighter.ts';
import type { Fighter, StaminaPool } from '../../src/sim/combat/fighter.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { orderShot } from '../../src/sim/land/archer.ts';
import { crewFight, hurt, inAttack } from '../../src/sim/land/fight.ts';
import type { FightWorld } from '../../src/sim/land/fight.ts';
import { findActor, switchZone } from '../../src/sim/land/zoneLinks.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { campContext } from '../../src/sim/home/camp.ts';
import { CampBot } from '../../src/tools/play/campBot.ts';
import { repoFile } from './books.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const cb = parseCombatBalance(balance);
const ai = parseAiBalance(balance);
const { content } = loadContentFromDisk();
/**
 * Stage 9's fight on Wreck Strand, kept as this file's fixture: the mechanics are tested on the
 * open shingle where they were measured, with the scavengers where Stage 9 put them (decision
 * S9-11). Stage 10 moved them to the sheepfold (decision S10-5): the first test below checks the
 * real content puts them there; tests/scenario/searches.test.ts plays the fold.
 */
const stage9 = {
  ...content,
  searches: null,
  combat:
    content.combat === null
      ? null
      : {
          ...content.combat,
          encounters: [
            {
              id: 'SCN_SK_WRECKERS',
              zone: 'ZONE_SK_STRAND',
              after: 'ch1.at_broch',
              takesCaptives: false,
              checkpoint: 'wreckers',
              members: [
                {
                  person: 'E_WRECKER_KETILL',
                  x: 25.5,
                  y: 34.7,
                  facing: 'w' as const,
                  task: 'TASK_GATHER_DRIFTWOOD',
                },
                {
                  person: 'E_WRECKER_SVART',
                  x: 23.4,
                  y: 35.8,
                  facing: 's' as const,
                  task: 'TASK_GATHER_DRIFTWOOD',
                },
                { person: 'E_WRECKER_CONN', x: 30.6, y: 34.6, facing: 'w' as const },
              ],
            },
          ],
        },
};
const land = landContext(stage9, balance);
/** The game's own content: the scavengers at the sheepfold (Stage 10). */
const landNow = landContext(content, balance);
const TILE = 24;

const pool = (current = 100): StaminaPool => ({ current, spentTick: 0 });

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('missing');
  return value;
}

/** Runs a fighter's own clock from `from` to `to` (exclusive). */
function run(f: Fighter, from: number, to: number, p = pool()): void {
  for (let t = from; t < to; t++) stepFighter(f, t, cb, p);
}

/** Book 10 section 06's weapon movesets (combat v2), read straight from the book. */
function bookWeapons(): Record<string, string[]> {
  const book = repoFile('docs/10_balance_sheet.md');
  const at = book.indexOf('### Weapon movesets');
  const rows = book.slice(at).split('\n').slice(4, 14);
  return Object.fromEntries(
    rows.map((r) => {
      const cells = r
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c !== '');
      return [cells[0] ?? '', cells.slice(1)];
    }),
  );
}

describe('frame data (Book 10 section 06; Book 3 Stage 9 check 1)', () => {
  it('matches Book 10 for every melee weapon', () => {
    const book = bookWeapons();
    for (const name of MELEE_WEAPONS) {
      const w = cb.weapons[name];
      const [reach, , combo, windup, active, recovery, chain, damage, , vsShield, , stamina] =
        book[name] ?? [];
      expect([w.reachTiles, w.combo, w.windup, w.active, w.recovery, w.chainWindow]).toEqual(
        [reach, combo, windup, active, recovery, chain].map(Number),
      );
      expect([w.damage, w.vsShield, w.stamina]).toEqual([damage, vsShield, stamina].map(Number));
    }
    expect(cb.charge).toMatchObject({ level1At: 18, level2At: 45, maxHold: 90 });
    expect(cb.parry).toMatchObject({ startup: 2, window: 8, recoveryOnMiss: 18, open: 60 });
    expect(cb.dodge).toMatchObject({ ticks: 20, invulnFrom: 4, invulnTo: 13, tiles: 1.5 });
  });

  it('gives every attack a tell at least 6 ticks before its active frames', () => {
    const leads: string[] = [];
    for (const name of MELEE_WEAPONS)
      for (const heavyBuild of [false, true]) {
        // Light: pressed and let go at once; its windup counts from the press (the tell).
        const light = newFighter(name, { heavy: heavyBuild });
        pressAttack(light, 0, cb, 'e', pool());
        releaseAttack(light, 1, cb, pool());
        expect(light.state).toBe('light1');
        leads.push(`${name} light ${light.activeAt}`);
        expect(light.activeAt - 0).toBeGreaterThanOrEqual(6);
        expect(light.activeAt - 0).toBe(frameData(cb, name, 'light', heavyBuild).windup);
        // Heavies: the level's own tell (glint at level 1, flash and sound at level 2) at least six
        // ticks before the swing's active frames, however soon after it the button is let go.
        for (const level of [1, 2] as const) {
          const h = newFighter(name, { heavy: heavyBuild });
          pressAttack(h, 0, cb, 'e', pool());
          const at = level === 1 ? cb.charge.level1At : cb.charge.level2At;
          let told = -1;
          for (let t = 0; t <= at; t++)
            for (const e of stepFighter(h, t, cb, pool()))
              if (e.type === 'CHARGE_LEVEL' && e.level === level) told = t;
          expect(told).toBe(at);
          releaseAttack(h, at, cb, pool());
          expect(h.state).toBe('heavyRelease');
          expect(h.level).toBe(level);
          expect(h.activeAt - told).toBeGreaterThanOrEqual(6);
          leads.push(`${name} heavy L${level} ${h.activeAt - told}`);
        }
        // A riposte (after a parry) swings with the light windup from its press.
        const r = newFighter(name, { heavy: heavyBuild });
        r.riposteUntil = 100;
        pressAttack(r, 0, cb, 'e', pool());
        expect(r.state).toBe('riposte');
        expect(r.activeAt).toBeGreaterThanOrEqual(6);
      }
    expect(leads.length).toBeGreaterThan(0);
  });

  it('chains light attacks up to the combo, each after its recovery (none is skipped)', () => {
    const f = newFighter('Hand axe');
    const p = pool();
    pressAttack(f, 0, cb, 'e', p);
    releaseAttack(f, 1, cb, p);
    const w = cb.weapons['Hand axe'];
    const seen: string[] = [];
    let t = 1;
    for (; t < 400 && seen.length < 4; t++) {
      for (const e of stepFighter(f, t, cb, p))
        if (e.type === 'STATE_ENDED') seen.push(`${e.state}@${t}`);
      // Press in the chain window of each strike's recovery.
      if (strikePhase(f, t) === 'recovery' && t === f.recoveryEnd - w.chainWindow + 1)
        expect(pressAttack(f, t, cb, 'e', p)).toBe(f.combo < w.combo ? 'QUEUED' : 'REFUSED');
    }
    expect(seen.map((s) => s.split('@')[0])).toEqual(['light1', 'light2', 'light3']);
    // Each strike ran its full recovery: windup, active, recovery between ends (and a swing that
    // met no one recovers longer: combat v2's missRecovery).
    const ends = seen.map((s) => Number(s.split('@')[1]));
    expect((ends[1] ?? 0) - (ends[0] ?? 0)).toBe(
      w.windup + w.active + w.recovery + cb.stance.missRecovery,
    );
    // A press outside the window is refused.
    const g = newFighter('Hand axe');
    pressAttack(g, 0, cb, 'e', p);
    releaseAttack(g, 1, cb, p);
    expect(pressAttack(g, g.activeEnd + 1, cb, 'e', p)).toBe('REFUSED');
  });

  it('locks the facing from windup to recovery end, and spends each kind’s stamina', () => {
    const f = newFighter('Seax');
    const p = pool(100);
    pressAttack(f, 0, cb, 'e', p);
    expect(f.facing).toBe('e');
    releaseAttack(f, 1, cb, p);
    expect(p.current).toBe(100 - cb.weapons.Seax.stamina);
    // Too little stamina: refused.
    expect(pressAttack(newFighter('Seax'), 0, cb, 'e', pool(1))).toBe('NO_STAMINA');
    const h = newFighter('Hand axe');
    const hp = pool(100);
    pressAttack(h, 0, cb, 'w', hp);
    run(h, 0, cb.charge.level2At + 1, hp);
    releaseAttack(h, cb.charge.level2At + 1, cb, hp);
    expect(hp.current).toBeCloseTo(100 - cb.weapons['Hand axe'].stamina * cb.charge.staminaL2);
    // Held past the maximum, it lets go by itself.
    const m = newFighter('Seax');
    pressAttack(m, 0, cb, 'e', pool());
    run(m, 0, cb.charge.maxHold + 1);
    expect(m.state).toBe('heavyRelease');
  });
});

describe('parry, block, dodge and shove (Book 10 section 06; Stage 9 check 2)', () => {
  const swing = (weapon: 'Seax' | 'Hand axe' | 'Spear', level: 0 | 1 | 2): Fighter => {
    const a = newFighter(weapon);
    pressAttack(a, 0, cb, 'e', pool());
    const at = level === 0 ? 1 : level === 1 ? cb.charge.level1At : cb.charge.level2At;
    run(a, 0, at + 1);
    releaseAttack(a, at, cb, pool());
    return a;
  };
  const fromEast = { x: 1, y: 0 };

  it('a parry inside its window opens the attacker, refunds its cost and opens a riposte', () => {
    for (let k = 0; k < cb.parry.window; k++) {
      const a = swing('Seax', 0);
      const d = newFighter('Seax', { facing: 'e' });
      const p = pool(50);
      // Pressed so the active tick falls k ticks into the window.
      const pressAt = a.activeAt - cb.parry.startup - k;
      pressParry(d, pressAt, cb, p);
      expect(p.current).toBe(50 - cb.parry.cost);
      const out = resolveBlow(a, d, blowOf(a, cb), fromEast, a.activeAt, cb, cb.parry.window, p);
      expect(out).toBe('PARRIED');
      expect(a.state).toBe('parried');
      expect(a.recoveryEnd - a.activeAt).toBe(cb.parry.open);
      expect(p.current).toBe(50);
      expect(d.riposteUntil).toBe(a.activeAt + cb.parry.open);
    }
    // Outside the window: the blow lands, and the parry's recovery follows.
    const a = swing('Seax', 0);
    const d = newFighter('Seax', { facing: 'e' });
    const p = pool(50);
    pressParry(d, a.activeAt - cb.parry.startup - cb.parry.window, cb, p);
    expect(resolveBlow(a, d, blowOf(a, cb), fromEast, a.activeAt, cb, cb.parry.window, p)).toBe(
      'HIT',
    );
    const late = newFighter('Seax');
    pressParry(late, 0, cb, pool());
    run(late, 0, cb.parry.startup + cb.parry.window + 1);
    expect(late.state).toBe('parryRecovery');
    expect(late.recoveryEnd - (cb.parry.startup + cb.parry.window)).toBe(cb.parry.recoveryOnMiss);
  });

  it('a full charge breaks a block but not a parry', () => {
    const full = swing('Hand axe', 2);
    expect(blowOf(full, cb).guardBreak).toBe(true);
    const blocker = newFighter('Seax', { shield: true, facing: 'e' });
    setBlock(blocker, true, 0);
    const p = pool(100);
    expect(
      resolveBlow(full, blocker, blowOf(full, cb), fromEast, full.activeAt, cb, cb.parry.window, p),
    ).toBe('GUARD_BROKEN');
    expect(blocker.state).toBe('guardBroken');
    expect(blocker.recoveryEnd - full.activeAt).toBe(cb.block.guardBreak);
    // The same blow parried in the window: parried, the attacker staggered.
    const full2 = swing('Hand axe', 2);
    const parrier = newFighter('Seax', { shield: true, facing: 'e' });
    pressParry(parrier, full2.activeAt - cb.parry.startup - 2, cb, pool());
    expect(
      resolveBlow(
        full2,
        parrier,
        blowOf(full2, cb),
        fromEast,
        full2.activeAt,
        cb,
        cb.parry.window,
        pool(),
      ),
    ).toBe('PARRIED');
    expect(full2.state).toBe('parried');
    // A level-1 charge (a spear's: an axe's hooks the shield) is blocked: Guard's cost, the stun.
    const half = swing('Spear', 1);
    const b2 = newFighter('Seax', { shield: true, facing: 'e' });
    setBlock(b2, true, 0);
    const p2 = pool(100);
    expect(
      resolveBlow(half, b2, blowOf(half, cb), fromEast, half.activeAt, cb, cb.parry.window, p2),
    ).toBe('BLOCKED');
    expect(p2.current).toBeCloseTo(
      100 -
        (cb.block.costFactor * cb.weapons.Spear.vsShield * cb.charge.level1.vsShield +
          cb.block.costFlat),
    );
    expect(b2.state).toBe('blockStun');
  });

  it('blocks only from the front, breaks the guard when the bar empties, and needs a shield', () => {
    const a = swing('Hand axe', 0);
    const d = newFighter('Seax', { shield: true, facing: 'w' });
    setBlock(d, true, 0);
    expect(resolveBlow(a, d, blowOf(a, cb), fromEast, a.activeAt, cb, 8, pool())).toBe('HIT');
    const e = newFighter('Seax', { shield: true, facing: 'e' });
    setBlock(e, true, 0);
    const low = pool(1);
    expect(resolveBlow(a, e, blowOf(a, cb), fromEast, a.activeAt, cb, 8, low)).toBe('GUARD_BROKEN');
    expect(e.state).toBe('guardBroken');
    expect(setBlock(newFighter('Seax'), true, 0)).toBe('NO_SHIELD');
  });

  it('dodges with invulnerable ticks 4 to 13, a committed move of Book 10’s length', () => {
    for (let t = 0; t < cb.dodge.ticks; t++) {
      const d = newFighter('Seax', { facing: 'e' });
      pressDodge(d, 0, cb, null, pool());
      const a = swing('Seax', 0);
      const out = resolveBlow(a, d, blowOf(a, cb), fromEast, t, cb, 8, pool());
      expect(out).toBe(t >= cb.dodge.invulnFrom && t <= cb.dodge.invulnTo ? 'DODGED' : 'HIT');
    }
    const d = newFighter('Seax', { facing: 'e' });
    const p = pool(100);
    pressDodge(d, 0, cb, null, p);
    expect(d.dodge).toEqual({ x: -1, y: 0 });
    expect(p.current).toBe(100 - cb.dodge.stamina);
  });

  it('shoves with its stamina and timing, staggering the one shoved', () => {
    const f = newFighter(null);
    const p = pool(100);
    expect(pressShove(f, 0, cb, 'e', p)).toBe('STARTED');
    expect(p.current).toBe(100 - cb.shove.stamina);
    expect(f.activeAt).toBe(cb.shove.windup);
    expect(f.activeAt).toBeGreaterThanOrEqual(6);
    expect(f.recoveryEnd).toBe(cb.shove.windup + cb.shove.active + cb.shove.recovery);
  });

  it('gives the heavy build more poise against light blows, and slower, heavier blows', () => {
    // Combat v2 (decision DE-5): three light seax blows break ordinary poise, not a heavy's.
    const light = blowOf(swing('Seax', 0), cb);
    const heavy = newFighter('Hand axe', { heavy: true });
    const ordinary = newFighter('Hand axe');
    for (let k = 0; k < 2; k++) {
      expect(poiseHit(heavy, light, 10 + k, cb)).toBe('FLINCH');
      expect(poiseHit(ordinary, light, 10 + k, cb)).toBe('FLINCH');
    }
    expect(poiseHit(heavy, light, 12, cb)).toBe('FLINCH');
    expect(poiseHit(ordinary, light, 12, cb)).toBe('STAGGER');
    // A big enough blow staggers even the heavy build.
    const big = newFighter('Dane axe');
    pressAttack(big, 0, cb, 'e', pool());
    run(big, 0, cb.charge.level2At + 1);
    releaseAttack(big, cb.charge.level2At, cb, pool());
    expect(poiseHit(heavy, blowOf(big, cb), 13, cb)).toBe('KNOCKDOWN');
    const h = newFighter('Hand axe', { heavy: true });
    pressAttack(h, 0, cb, 'e', pool());
    releaseAttack(h, 1, cb, pool());
    expect(h.activeAt).toBe(cb.weapons['Hand axe'].windup + cb.heavy.windupExtra);
    expect(blowOf(h, cb).damage).toBeCloseTo(cb.weapons['Hand axe'].damage * cb.heavy.damage);
  });
});

describe('perception basics (Book 10 section 07)', () => {
  const open = (): boolean => false;
  it('sees in a cone by the light, and hears by gait and surface', () => {
    const me = { x: 0, y: 0, facing: 'e' as const };
    const day = sightRange(ai, 'day', false);
    expect(day).toBe(15);
    expect(sightRange(ai, 'night', false)).toBe(5);
    expect(sightRange(ai, 'night', true)).toBe(15);
    expect(sees(ai, me, { x: 14 * TILE, y: 0 }, day, TILE, open)).toBe(true);
    expect(sees(ai, me, { x: 16 * TILE, y: 0 }, day, TILE, open)).toBe(false);
    expect(sees(ai, me, { x: -5 * TILE, y: 0 }, day, TILE, open)).toBe(false);
    expect(sees(ai, me, { x: 5 * TILE, y: 0 }, day, TILE, () => true)).toBe(false);
    expect(stepNoise(ai, 'run', 'shingle')).toBeCloseTo(7.5);
    expect(stepNoise(ai, 'sneak', 'sand')).toBeCloseTo(0.35);
    expect(hears({ x: 0, y: 0 }, { x: 7 * TILE, y: 0 }, 7.5, TILE)).toBe(true);
    const dusk = ai.sight.duskMinutes;
    expect(dusk).toBe(60);
    expect(lightAt(12 * 60, 390, 1200, dusk)).toBe('day');
    expect(lightAt(1230, 390, 1200, dusk)).toBe('dusk');
    expect(lightAt(60, 390, 1200, dusk)).toBe('night');
  });
});

// ------------------------------------------------------------------------------- a fight

interface Fight {
  readonly world: WorldState;
  readonly sim: Simulation;
  readonly events: SimEvent[];
}

/**
 * A fight on Wreck Strand: the camp set up (Hild has led to the broch), the steerer at (x, y) on
 * the strand with the seax in hand; the wreck-scavengers come with the first tick.
 */
function strandFight(seed: string, at = '36,34.2', extra = ''): Fight {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(`camp=broch&time=10:00&at=1,1${extra}`));
  const onFoot = world.onFoot;
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (onFoot === null || strand === undefined) throw new Error('no strand');
  const [x, y] = at.split(',').map(Number);
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: (x ?? 0) * TILE, y: (y ?? 0) * TILE });
  onFoot.player.facing = 'w';
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
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

/** Holds the movement keys towards a point until within `stop` pixels. */
function walkTo(f: Fight, x: number, y: number, run = false, stop = 6, max = 2000): void {
  for (let i = 0; i < max; i++) {
    const p = f.world.onFoot?.player;
    if (p === undefined) return;
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.hypot(dx, dy) < stop) break;
    const l = Math.hypot(dx, dy);
    f.sim.submit({ type: 'MOVE', x: dx / l, y: dy / l, run, sneak: false });
    f.sim.step();
  }
  f.sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
  f.sim.step();
}

/** Strikes at whoever is nearest, light blows, until they are dead or `max` ticks pass. */
function fightOn(f: Fight, max = 6000, stop: () => boolean = () => false): void {
  const onFoot = f.world.onFoot;
  if (onFoot === null) return;
  for (let i = 0; i < max && !stop() && f.world.gameOver === null; i++) {
    const p = onFoot.player;
    let best: { x: number; y: number; d: number } | null = null;
    for (const a of Object.values(onFoot.actors)) {
      if (a.fight?.side !== 'ENEMY' || a.fight.dead !== null || a.fight.f.state === 'surrendered')
        continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (best === null || d < best.d) best = { x: a.x, y: a.y, d };
    }
    if (best === null) break;
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
    if (best.d > 20) {
      f.sim.submit({ type: 'MOVE', x: dx / best.d, y: dy / best.d, run: false, sneak: false });
    } else {
      f.sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
      if (i % 14 === 0) f.sim.submit({ type: 'MELEE', facing });
      if (i % 14 === 1) f.sim.submit({ type: 'MELEE_RELEASE' });
    }
    // Keep the steerer standing: vitality topped up so the fight runs its course (combat v2's
    // heavies hit for more than half of it, decision DE-8).
    f.world.player.vitality = 100;
    f.world.player.stamina.current = Math.max(f.world.player.stamina.current, 60);
    f.sim.step();
  }
}

describe('the wreck-scavengers (Book 4 Chapter 1 beat 3; decisions S9-11, S10-5)', () => {
  it('are at the sheepfold under the cairn since Stage 10, watching Bran, unaware; Bran fights beside', () => {
    const world = newCampaign('fold', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    campHooks(world, content, landNow, new URLSearchParams('camp=broch&time=10:00'));
    const onFoot = must(world.onFoot);
    const sim = createSimulation(b, world, landNow);
    const events: SimEvent[] = [];
    sim.events.onAny((e) => events.push(e));
    sim.step();
    switchZone(onFoot, 'ZONE_SK_CAIRN', { x: 3 * TILE, y: 36 * TILE });
    sim.step();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'ENCOUNTER_STARTED', scene: 'SCN_SK_WRECKERS' }),
    );
    const enc = content.combat?.encounters.find((e) => e.id === 'SCN_SK_WRECKERS');
    expect(enc?.zone).toBe('ZONE_SK_CAIRN');
    expect(enc?.allies).toEqual(['C_BRAN']);
    expect(
      Object.keys(onFoot.actors)
        .filter((id) => id.startsWith('E_'))
        .sort(),
    ).toEqual(['E_WRECKER_CONN', 'E_WRECKER_KETILL', 'E_WRECKER_SVART']);
    expect(onFoot.actors['C_BRAN']?.pose).toBe('idle');
    for (let i = 0; i < 120; i++) sim.step();
    expect(Object.values(onFoot.actors).every((a) => a.fight?.ai.aware !== true)).toBe(true);
  });

  it('are on Wreck Strand by the wreck once Hild has led to the broch, unaware, at work (the Stage 9 fixture)', () => {
    const f = strandFight('wreckers');
    expect(f.events).toContainEqual(
      expect.objectContaining({ type: 'ENCOUNTER_STARTED', scene: 'SCN_SK_WRECKERS' }),
    );
    const ids = Object.keys(f.world.onFoot?.actors ?? {}).filter((id) => id.startsWith('E_'));
    expect(ids.sort()).toEqual(['E_WRECKER_CONN', 'E_WRECKER_KETILL', 'E_WRECKER_SVART']);
    const ketill = actor(f, 'E_WRECKER_KETILL').fight;
    expect(ketill).toMatchObject({
      vitality: ai.archetypes['Outlaw']?.vitality,
      leader: true,
      f: { weapon: 'Hand axe', shield: true, heavy: true },
    });
    expect(actor(f, 'E_WRECKER_CONN').fight).toMatchObject({
      vitality: ai.archetypes['Archer']?.vitality,
      bow: true,
      arrows: ai.habits.archerArrows,
    });
    expect(actor(f, 'E_WRECKER_KETILL').pose).toBe('work');
    for (let i = 0; i < 120; i++) f.sim.step();
    expect(
      Object.values(f.world.onFoot?.actors ?? {}).every((a) => a.fight?.ai.aware !== true),
    ).toBe(true);
  });

  it('notice a steerer running up behind them, shout, and come to fight', () => {
    const f = strandFight('notice', '36.5,34.2');
    walkTo(f, 33 * TILE, 34.7 * TILE, true, 6, 600);
    for (let i = 0; i < 60; i++) f.sim.step();
    expect(f.events.some((e) => e.type === 'ENEMY_AWARE')).toBe(true);
    expect(f.events.some((e) => e.type === 'FIGHT_STARTED')).toBe(true);
    expect(
      f.events.some(
        (e) =>
          e.type === 'PERSON_SPOKE' && e.lineKey.startsWith('e_wrecker_') && e.bark === 'alarm',
      ),
    ).toBe(true);
    expect(actor(f, 'E_WRECKER_KETILL').fight?.ai.aware).toBe(true);
  });

  it('two or more close on one from different sides (Book 2 section 13, flank)', () => {
    const f = strandFight('flank', '36.5,34.2');
    walkTo(f, 33 * TILE, 34.7 * TILE, true, 6, 600);
    // The steerer stands and takes it (made hardy, so the test sees them come round).
    f.world.player.vitality = 10_000;
    const p = f.world.onFoot?.player;
    if (p === undefined) throw new Error('no player');
    const sideOf = (id: string): number => {
      const a = actor(f, id);
      return Math.atan2(a.y - p.y, a.x - p.x);
    };
    let apart = 0;
    for (let i = 0; i < 900 && apart < Math.PI / 3; i++) {
      f.sim.step();
      const k = actor(f, 'E_WRECKER_KETILL');
      const s = actor(f, 'E_WRECKER_SVART');
      const near = (a: typeof k): boolean => Math.hypot(a.x - p.x, a.y - p.y) < 2.5 * TILE;
      if (!near(k) || !near(s)) continue;
      const d = Math.abs(sideOf('E_WRECKER_KETILL') - sideOf('E_WRECKER_SVART'));
      apart = Math.min(d, 2 * Math.PI - d);
    }
    expect(apart).toBeGreaterThanOrEqual(Math.PI / 3);
  });

  it('a sneaking steerer behind them is not heard until close', () => {
    const f = strandFight('sneak', '36.5,34.2');
    for (let i = 0; i < 400; i++) {
      f.sim.submit({ type: 'MOVE', x: -1, y: 0, run: false, sneak: true });
      f.sim.step();
      if ((f.world.onFoot?.player.x ?? 0) < 34 * TILE) break;
    }
    expect(f.events.some((e) => e.type === 'ENEMY_AWARE')).toBe(false);
  });
});

/** The wreckers still in the fight (not dead, downed, surrendered or fled). */
const foesOf = (f: Fight) =>
  Object.entries(f.world.onFoot?.actors ?? {})
    .filter(
      ([, a]) =>
        a.fight?.side === 'ENEMY' &&
        a.fight.dead === null &&
        a.fight.f.state !== 'surrendered' &&
        a.fight.f.state !== 'downed' &&
        a.fight.ai.mode !== 'FLEE',
    )
    .map(([id, a]) => ({ id, a }));

/**
 * A steerer who defends, as a careful player would (S9-29): faces whoever is coming, parries a
 * strike just before its active frames, ripostes the one staggered, dodges an arrow about to land,
 * and strikes only into a foe's recovery or stagger, never into a guard.
 */
function defend(f: Fight): void {
  const onFoot = f.world.onFoot;
  if (onFoot === null) return;
  const p = onFoot.player;
  const pf = p.fight;
  const t = f.world.tick + 1;
  const facingTo = (a: { x: number; y: number }): 's' | 'n' | 'e' | 'w' => {
    const dx = a.x - p.x;
    const dy = a.y - p.y;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  };
  const ranked = foesOf(f)
    .map((o) => ({ ...o, d: Math.hypot(o.a.x - p.x, o.a.y - p.y) }))
    .sort((x, y) => x.d - y.d);
  const ready = pf == null || pf.state === 'idle';
  const stamina = f.world.player.stamina.current;
  const still = { type: 'MOVE', x: 0, y: 0, run: false, sneak: false } as const;
  const arrow = onFoot.projectiles.find(
    (q) =>
      q.shooter !== 'P_STEERER' && Math.hypot(q.x - p.x, q.y - p.y) < (q.length / q.ticks) * 10,
  );
  const coming = ranked.find(
    ({ a, d }) =>
      a.fight?.ai.target === 'P_STEERER' &&
      d < 60 &&
      (charging(a.fight.f) || (striking(a.fight.f) && t < a.fight.f.activeAt)),
  );
  if (pf?.state === 'chargeL0' && f.world.tick - pf.since > 2)
    f.sim.submit({ type: 'MELEE_RELEASE' });
  if (arrow !== undefined && stamina >= cb.dodge.stamina && ready) {
    f.sim.submit({ type: 'DODGE', x: -arrow.uy, y: arrow.ux });
    return;
  }
  if (coming !== undefined) {
    const cf = coming.a.fight?.f;
    const want = facingTo(coming.a);
    if (p.facing !== want && ready) {
      const [x, y] = ({ e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] } as const)[want];
      f.sim.submit({ type: 'MOVE', x, y, run: false, sneak: false });
    } else f.sim.submit(still);
    if (cf !== undefined && striking(cf) && cf.activeAt - t === cb.parry.startup + 2)
      f.sim.submit({ type: 'PARRY' });
    return;
  }
  f.sim.submit(still);
  // Combat v2: a parried foe reels open ('parried'); one whose poise broke staggers.
  const staggered = ranked.find(
    ({ a, d }) => (a.fight?.f.state === 'parried' || a.fight?.f.state === 'stagger') && d < 40,
  );
  const punish = ranked.find(
    ({ a, d }) =>
      d < 34 &&
      a.fight !== undefined &&
      (['stagger', 'parried', 'parryRecovery', 'blockStun', 'guardBroken'].includes(
        a.fight.f.state,
      ) ||
        (striking(a.fight.f) && t >= a.fight.f.activeEnd)),
  );
  if (
    pf != null &&
    pf.riposteUntil > t &&
    staggered !== undefined &&
    !charging(pf) &&
    !striking(pf)
  )
    f.sim.submit({ type: 'MELEE', facing: facingTo(staggered.a) });
  else if (punish !== undefined && stamina >= 30 && ready)
    f.sim.submit({ type: 'MELEE', facing: facingTo(punish.a) });
}

describe('a fight against several, one blow at a time (Book 10 attackTokens; decision S9-29)', () => {
  it('an undefended steerer facing all three lives at least 4 s; never more than the tokens attack at once', () => {
    for (const seed of ['token-a', 'token-b', 'token-c']) {
      const f = strandFight(seed, '31.5,34.6');
      const onFoot = f.world.onFoot;
      if (onFoot === null) throw new Error('no zone');
      // Run in among them for a second, then stand and take it.
      for (let i = 0; i < 50; i++) {
        f.sim.submit({ type: 'MOVE', x: -1, y: 0, run: true, sneak: false });
        f.sim.step();
      }
      f.sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
      let first: number | null = null;
      for (let i = 0; i < 60 * 60 && f.world.gameOver === null; i++) {
        f.sim.step();
        first ??= f.events.some((e) => e.type === 'BLOW' && e.defender === 'P_STEERER')
          ? f.world.tick
          : null;
        const attacking = Object.values(onFoot.actors).filter(
          (a) =>
            a.fight?.side === 'ENEMY' &&
            a.fight.ai.target === 'P_STEERER' &&
            inAttack(a, f.world.tick),
        ).length;
        expect(attacking, `${seed} at ${f.world.tick}`).toBeLessThanOrEqual(ai.habits.attackTokens);
      }
      expect(first, seed).not.toBeNull();
      expect(f.world.gameOver, seed).not.toBeNull();
      const seconds = ((f.world.gameOver?.tick ?? 0) - (first ?? 0)) / 60;
      // Combat v2 (decision DE-8): enemies hit hard, so the undefended fall in three or four
      // blows; one at a time still, so not in the first moments (combat v1 measured about 10 s).
      console.log(`undefended ${seed}: ${seconds.toFixed(1)} s`);
      expect(seconds, seed).toBeGreaterThanOrEqual(4);
      // More than one of them strikes: the token passes round.
      const hitters = new Set(
        f.events.flatMap((e) =>
          e.type === 'BLOW' && e.defender === 'P_STEERER' ? [e.attacker] : [],
        ),
      );
      expect(hitters.size, seed).toBeGreaterThan(1);
    }
  });

  it('a steerer who parries, ripostes and dodges can beat all three', () => {
    // Ten seeded fights played by a careful scripted player (no help, no option). A script is a
    // poorer player than a person (it never retreats, uses the ground or picks its moment), yet it
    // wins some: 4 of these 10 when written (combat v1), 8 with combat v2's parry and riposte.
    let won = 0;
    let parried = 0;
    for (let n = 1; n <= 10; n++) {
      const f = strandFight(`defend-${n}`, '31.5,34.6');
      for (let i = 0; i < 50; i++) {
        f.sim.submit({ type: 'MOVE', x: -1, y: 0, run: true, sneak: false });
        f.sim.step();
      }
      for (let i = 0; i < 60 * 120 && f.world.gameOver === null && foesOf(f).length > 0; i++) {
        defend(f);
        f.sim.step();
      }
      if (f.world.gameOver === null && foesOf(f).length === 0) won++;
      parried += f.events.filter((e) => e.type === 'BLOW' && e.outcome === 'PARRIED').length;
    }
    console.log(`careful: won ${won} of 10, ${parried} parries`);
    expect(won).toBeGreaterThanOrEqual(3);
    // Combat v2 (decision DE-5): a parry opens a riposte that ends most fights at once, so a
    // win takes fewer parries than combat v1's long trades did; still at least one a win.
    expect(parried).toBeGreaterThanOrEqual(won);
  });
});

describe('a fight to its end (Stage 9: blows, morale, surrender, deeds, gore)', () => {
  it('kills, staggers, breaks their morale; the coward surrenders and kneels', () => {
    const f = strandFight('melee', '34,34.7');
    fightOn(f, 9000);
    const killed = f.events.filter((e) => e.type === 'PERSON_KILLED');
    expect(killed.length).toBeGreaterThanOrEqual(1);
    expect(f.events.some((e) => e.type === 'BLOW' && e.outcome === 'HIT')).toBe(true);
    // Every killing by the household is its deed (a stray arrow of their own is not).
    expect(
      f.world.ledger.filter((d) => d.tag === 'KILLING' || d.tag === 'SURRENDERED_KILLED').length,
    ).toBe(killed.filter((e) => 'by' in e && e.by === 'P_STEERER').length);
    const ended = f.events.some((e) => e.type === 'FIGHT_ENDED');
    const surrendered = f.events.filter((e) => e.type === 'PERSON_SURRENDERED');
    const fled = f.events.filter((e) => e.type === 'PERSON_FLED');
    console.log(
      `fight: ${killed.length} killed, ${surrendered.length} surrendered, ${fled.length} fled, ended ${ended}, steerer ${f.world.player.vitality}`,
    );
    expect(ended).toBe(true);
    expect(killed.length + surrendered.length + fled.length).toBe(3);
  });

  it('replays identically from a seed, missiles included', () => {
    const play = (seed: string): { hash: string; log: string } => {
      const f = strandFight(seed, '34,34.7');
      fightOn(f, 3000);
      const log = f.events
        .filter(
          (e) => e.type === 'MISSILE_LOOSED' || e.type === 'MISSILE_STRUCK' || e.type === 'BLOW',
        )
        .map((e) => JSON.stringify(e))
        .join('\n');
      return { hash: stateHash(f.world), log };
    };
    const a = play('replay');
    const again = play('replay');
    expect(again).toEqual(a);
    expect(a.log).toContain('MISSILE_LOOSED');
    expect(play('another').hash).not.toBe(a.hash);
  });

  it('a held finisher kills the surrendered: a deed of killing the surrendered', () => {
    const f = strandFight('finisher', '34,34.7');
    const conn = actor(f, 'E_WRECKER_CONN');
    const fa = conn.fight;
    if (fa === undefined) throw new Error('no fight');
    fa.f.state = 'surrendered';
    fa.ai.mode = 'SURRENDER';
    const p = f.world.onFoot?.player;
    if (p === undefined) throw new Error('no player');
    p.x = conn.x + 14;
    p.y = conn.y;
    p.facing = 'w';
    f.sim.submit({ type: 'MELEE', facing: 'w' });
    f.sim.step();
    f.sim.submit({ type: 'MELEE_RELEASE' });
    for (let i = 0; i < 60; i++) f.sim.step();
    f.sim.submit({ type: 'FINISHER', on: true });
    for (let i = 0; i <= cb.finisherHold + 2; i++) f.sim.step();
    expect(conn.fight?.dead).not.toBeNull();
    expect(f.world.ledger.map((d) => d.tag)).toContain('SURRENDERED_KILLED');
  });

  it('rolls for dismemberment on the gore stream only for a heavy cutting blow that kills', () => {
    const f = strandFight('gore', '34,34.7');
    const fw = fightWorldOf(f);
    let pieces = 0;
    for (let i = 0; i < 40; i++) {
      const id = `E_WRECKER_SVART`;
      const a = actor(f, id);
      if (a.fight === undefined) throw new Error('no fight');
      a.fight.dead = null;
      a.fight.vitality = 1;
      a.fight.f.state = 'idle';
      hurt(fw, id, 10, 'P_STEERER', { heavyKill: true, weapon: 'Hand axe', dx: 1, dy: 0 });
      if (actor(f, id).fight?.dead?.piece != null) pieces++;
    }
    expect(pieces).toBeGreaterThan(40 * cb.dismemberChance - 10);
    expect(pieces).toBeLessThan(40 * cb.dismemberChance + 10);
    // A seax never takes a limb; nor does a light axe blow.
    const a = actor(f, 'E_WRECKER_KETILL');
    if (a.fight === undefined) throw new Error('no fight');
    a.fight.vitality = 1;
    hurt(fw, 'E_WRECKER_KETILL', 10, 'P_STEERER', {
      heavyKill: true,
      weapon: 'Seax',
      dx: 1,
      dy: 0,
    });
    expect(actor(f, 'E_WRECKER_KETILL').fight?.dead?.piece).toBeNull();
  });
});

/** Brings Hild (wherever her day has her) to (x, y) on the strand, standing. */
function takeHild(f: Fight, x: number, y: number): void {
  const onFoot = must(f.world.onFoot);
  const found = findActor(onFoot, 'C_HILD');
  if (found === null) throw new Error('no Hild');
  if (found.zone !== onFoot.zone) {
    const rest = onFoot.elsewhere?.[found.zone];
    if (rest !== undefined) Reflect.deleteProperty(rest.actors, 'C_HILD');
  }
  onFoot.actors['C_HILD'] = { ...found.actor, x, y, pose: 'idle' };
  delete onFoot.actors['C_HILD'].walk;
  delete onFoot.actors['C_HILD'].task;
}

/** The fight's view of a strand fight, for calling the fight's own functions directly. */
function fightWorldOf(f: Fight): FightWorld {
  const map = land.maps.get('ZONE_SK_STRAND');
  const ctx = land.fight;
  if (map === undefined || ctx == null) throw new Error('no fight content');
  return {
    world: f.world,
    ctx,
    land,
    map,
    tidalGroundOpen: false,
    emit: (e) => f.events.push(e),
    deed: () => undefined,
    options: {
      secondWind: f.world.options.secondWind,
      ransMercy: f.world.options.ransMercy,
      parryWindow: cb.parry.window,
    },
  };
}

describe('missiles in a fight (Book 10 section 21; Stage 9 check 3)', () => {
  it('no one moves while drawing: the enemy archer stops, draws for the draw time and looses', () => {
    const f = strandFight('archer', '39,34.2');
    const conn = actor(f, 'E_WRECKER_CONN');
    // Make them aware: the steerer runs up (heard by its footfalls, combat v2), then stands.
    walkTo(f, 34.5 * TILE, 34.2 * TILE, true, 6, 200);
    let drawingTicks = 0;
    let movedWhileDrawn = 0;
    let loosed = 0;
    let last = { x: conn.x, y: conn.y };
    for (let i = 0; i < 1200; i++) {
      f.sim.step();
      const drawing = conn.aim != null;
      if (drawing) {
        drawingTicks++;
        if (conn.x !== last.x || conn.y !== last.y) movedWhileDrawn++;
      }
      last = { x: conn.x, y: conn.y };
      loosed = f.events.filter(
        (e) => e.type === 'MISSILE_LOOSED' && e.shooter === 'E_WRECKER_CONN',
      ).length;
      if (loosed >= 2) break;
      f.world.player.vitality = 100;
    }
    expect(loosed).toBeGreaterThanOrEqual(1);
    expect(drawingTicks).toBeGreaterThanOrEqual(land.missiles.bow.drawTicks);
    expect(movedWhileDrawn).toBe(0);
    expect(conn.fight?.arrows).toBe(ai.habits.archerArrows - loosed);
  });

  it('no one moves while holding a spear to throw (a crew member ordered to throw)', () => {
    const f = strandFight('spear', '36,34.2');
    const onFoot = f.world.onFoot;
    if (onFoot === null) throw new Error('no zone');
    onFoot.actors['C_ODDI'] = { x: 35 * TILE, y: 33.2 * TILE, facing: 'w', pose: 'idle' };
    const oddi = actor(f, 'C_ODDI');
    orderShot(
      oddi,
      { x: 29 * TILE, y: 33.2 * TILE },
      { x: 0, y: 0, run: false, sneak: false },
      'spear',
    );
    const at = { x: oddi.x, y: oddi.y };
    let held = 0;
    for (let i = 0; i < 60; i++) {
      oddi.intent = { x: 0, y: 1, run: true, sneak: false };
      f.sim.step();
      if (oddi.aim != null) {
        held++;
        expect({ x: oddi.x, y: oddi.y }).toEqual(at);
      }
    }
    expect(held).toBeGreaterThanOrEqual(land.missiles.spear.drawTicks - 1);
    expect(f.events).toContainEqual(
      expect.objectContaining({ type: 'MISSILE_LOOSED', kind: 'spear', shooter: 'C_ODDI' }),
    );
  });

  it('an arrow in a body hurts by Book 10’s damage; in a shield it costs the block', () => {
    const f = strandFight('arrow-body', '36,34.2');
    const svart = actor(f, 'E_WRECKER_SVART');
    const before = svart.fight?.vitality ?? 0;
    // Aware of the steerer: an unaware target takes double (combat v2, tested in combat2.test.ts).
    if (svart.fight !== undefined)
      svart.fight.ai.awareness = { level: ai.awareness.alertAt, state: 'ALERT', heard: 0 };
    // A target that stands where it is for the shot: the three make no decisions (heard, they
    // would close on the steerer from three sides, off the arrow's line).
    for (const id of ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN']) {
      const ai = actor(f, id).fight?.ai;
      if (ai !== undefined) ai.next = Number.MAX_SAFE_INTEGER;
    }
    f.world.player.hotbar.slots[1] = 'ITEM_BOW';
    f.world.player.inventory['ITEM_ARROW'] = 6;
    f.sim.submit({ type: 'SELECT_SLOT', slot: 1 });
    const p = f.world.onFoot?.player;
    if (p === undefined) throw new Error('no player');
    p.x = svart.x + 5 * TILE;
    p.y = svart.y;
    f.sim.step();
    const dist = 5;
    f.sim.submit({ type: 'AIM', dir: 32, dist });
    for (let i = 0; i < land.missiles.bow.drawTicks; i++) f.sim.step();
    f.sim.submit({ type: 'AIM', dir: null });
    for (let i = 0; i < 60; i++) f.sim.step();
    const struck = f.events.find((e) => e.type === 'MISSILE_STRUCK');
    expect(struck).toMatchObject({ strike: 'body', target: 'E_WRECKER_SVART' });
    expect(before - (svart.fight?.vitality ?? 0)).toBeCloseTo(cb.arrow.damage);
    // In the body: it stays with the person and is drawn with them.
    expect(f.world.onFoot?.stuck.some((s) => s.target === 'E_WRECKER_SVART')).toBe(true);
  });

  it('arrows in the dead can be pulled free after the fight; on leaving the zone they are gone', () => {
    const f = strandFight('pull', '36,34.2');
    const onFoot = f.world.onFoot;
    if (onFoot === null) throw new Error('no zone');
    const ketill = actor(f, 'E_WRECKER_KETILL');
    const fw = fightWorldOf(f);
    for (const id of ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN'])
      hurt(fw, id, 999, 'P_STEERER', { heavyKill: false, weapon: 'Seax', dx: 1, dy: 0 });
    onFoot.stuck.push(
      {
        n: 90,
        kind: 'arrow',
        x: 2,
        y: -2,
        h: 20,
        dir: 8,
        in: 'body',
        target: 'E_WRECKER_KETILL',
        broken: false,
        at: 0,
      },
      { n: 91, kind: 'arrow', x: 0, y: 0, h: 0, dir: 0, in: 'ground', broken: false, at: 0 },
      { n: 92, kind: 'arrow', x: 30, y: 30, h: 8, dir: 0, in: 'wood', broken: false, at: 0 },
    );
    const p = onFoot.player;
    p.x = ketill.x + 6;
    p.y = ketill.y;
    f.world.player.inventory['ITEM_ARROW'] = 1;
    f.sim.submit({ type: 'INTERACT' });
    f.sim.step();
    expect(f.world.player.inventory['ITEM_ARROW']).toBe(2);
    expect(onFoot.stuck.map((s) => s.n)).not.toContain(90);
    switchZone(onFoot, 'ZONE_SK_MACHAIR', { x: 30 * TILE, y: 30 * TILE });
    const left = onFoot.elsewhere?.['ZONE_SK_STRAND']?.stuck ?? [];
    expect(left.map((s) => s.n)).toEqual([91]);
  });
});

describe('the steerer’s death (Book 2 section 12; Stage 9 check 4)', () => {
  it('ends the game, and game over reloads the latest autosave', () => {
    const f = strandFight('death', '36,34.2');
    const saves = new SaveManager(new MemoryStore(), 'test');
    expect(saves.autosave(f.world, 'WAKING').ok).toBe(true);
    const saved = stateHash(f.world);
    hurt(fightWorldOf(f), 'P_STEERER', 999, 'E_WRECKER_KETILL', {
      heavyKill: false,
      weapon: 'Hand axe',
      dx: 1,
      dy: 0,
    });
    expect(f.world.gameOver).not.toBeNull();
    expect(f.events.map((e) => e.type)).toContain('STEERER_DIED');
    // Nothing moves after.
    const tick = f.world.tick;
    const x = f.world.onFoot?.player.x;
    f.sim.submit({ type: 'MOVE', x: 1, y: 0, run: true, sneak: false });
    for (let i = 0; i < 30; i++) f.sim.step();
    expect(f.world.onFoot?.player.x).toBe(x);
    expect(f.world.tick).toBe(tick + 30);
    const latest = saves.latestRestorePoint();
    expect(latest?.kind).toBe('autosave');
    const { state } = saves.load(latest?.slot ?? '', {
      context: { balance, people: JSON.parse(repoFile('content/people.json')) as unknown },
    });
    expect(stateHash(state)).toBe(saved);
    expect(state.gameOver).toBeNull();
  });

  it('Second wind: downed for Book 10’s time; an ally beside lifts once a scene, else death', () => {
    const f = strandFight('second-wind', '36,34.2', '&secondwind=1');
    const onFoot = f.world.onFoot;
    if (onFoot === null) throw new Error('no zone');
    // A fight on (an enemy aware), and Oddi beside the steerer.
    must(actor(f, 'E_WRECKER_KETILL').fight).ai.aware = true;
    must(onFoot.battle).engaged = true;
    onFoot.actors['C_ODDI'] = {
      x: onFoot.player.x - 50,
      y: onFoot.player.y - 20,
      facing: 'w',
      pose: 'idle',
    };
    f.world.household.residents.push('C_ODDI');
    must(f.world.people['C_ODDI']).status = 'alive';
    crewFight(f.world, must(land.fight), 'C_ODDI');
    hurt(fightWorldOf(f), 'P_STEERER', 999, 'E_WRECKER_KETILL', {
      heavyKill: false,
      weapon: 'Hand axe',
      dx: 1,
      dy: 0,
    });
    expect(f.world.gameOver).toBeNull();
    expect(onFoot.player.fight?.state).toBe('downed');
    let lifted = false;
    for (let i = 0; i < cb.secondWind.ticks && !lifted; i++) {
      f.sim.step();
      lifted = f.events.some((e) => e.type === 'STEERER_LIFTED');
    }
    expect(lifted).toBe(true);
    expect(f.world.player.vitality).toBe(cb.secondWind.liftTo);
    // Once a scene: the next fall is death.
    hurt(fightWorldOf(f), 'P_STEERER', 999, 'E_WRECKER_KETILL', {
      heavyKill: false,
      weapon: 'Hand axe',
      dx: 1,
      dy: 0,
    });
    expect(f.world.gameOver).not.toBeNull();
    // With no ally near, the window runs out: death.
    const g = strandFight('second-wind-alone', '36,34.2', '&secondwind=1');
    must(must(g.world.onFoot).battle).engaged = true;
    hurt(fightWorldOf(g), 'P_STEERER', 999, 'E_WRECKER_KETILL', {
      heavyKill: false,
      weapon: 'Hand axe',
      dx: 1,
      dy: 0,
    });
    for (let i = 0; i < cb.secondWind.ticks + 2; i++) g.sim.step();
    expect(g.world.gameOver).not.toBeNull();
  });
});

describe('downed, not dead (Book 2 section 12; Stage 9 check 4)', () => {
  /** Hild on the strand, downed by an arrow, the scavengers gone. */
  function hildDowned(seed: string, extra = ''): Fight {
    const f = strandFight(seed, '36,34.2', extra);
    takeHild(f, 35 * TILE, 33.2 * TILE);
    crewFight(f.world, must(land.fight), 'C_HILD');
    hurt(fightWorldOf(f), 'C_HILD', 999, 'E_WRECKER_CONN', {
      heavyKill: false,
      weapon: null,
      dx: 1,
      dy: 0,
      missile: true,
    });
    return f;
  }

  it('a downed ally never dies on a timer', () => {
    const f = hildDowned('downed');
    expect(f.events).toContainEqual({ type: 'PERSON_DOWNED', person: 'C_HILD' });
    expect(f.world.people['C_HILD']?.status).toBe('downed');
    // Two game hours with the scavengers about but leaving her be.
    for (let i = 0; i < 2 * b.secondsPerHour * 60; i++) f.sim.step();
    expect(f.world.people['C_HILD']?.status).toBe('downed');
    expect(actor(f, 'C_HILD').pose).toBe('down');
    // Nobody struck her while she lay there.
    expect(f.events.some((e) => e.type === 'BLOW' && e.defender === 'C_HILD')).toBe(false);
  });

  it('carried to the camp she lives, with a serious wound; carried at carry speed', () => {
    const f = hildDowned('carried');
    const onFoot = must(f.world.onFoot);
    for (const id of ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN'])
      Reflect.deleteProperty(onFoot.actors, id);
    const hild = actor(f, 'C_HILD');
    onFoot.player.x = hild.x + 8;
    onFoot.player.y = hild.y;
    f.sim.submit({ type: 'INTERACT' });
    f.sim.step();
    expect(onFoot.carrying).toBe('C_HILD');
    expect(onFoot.player.gait).toBe('carry');
    // To the cut and up to the camp.
    const safe = content.combat?.safePlaces[0];
    if (safe === undefined) throw new Error('no safe place');
    const bot = new CampBot(f.sim, b, land, must(campContext(content)));
    bot.goToZone('ZONE_SK_MACHAIR');
    expect(f.world.onFoot?.carrying).toBe('C_HILD');
    bot.goToSite('fire');
    expect(
      Math.hypot(onFoot.player.x - safe.x * TILE, onFoot.player.y - safe.y * TILE),
    ).toBeLessThan(safe.r * TILE);
    f.sim.submit({ type: 'INTERACT' });
    f.sim.step();
    expect(f.events.some((e) => e.type === 'PERSON_BROUGHT_HOME' && e.person === 'C_HILD')).toBe(
      true,
    );
    expect(f.world.people['C_HILD']?.status).toBe('wounded');
    expect(f.world.people['C_HILD']?.wounds.at(-1)?.severity).toBe('SERIOUS');
  });

  it('left behind with killers holding the ground she is killed; Rán’s mercy makes it a grave wound', () => {
    for (const mercy of [false, true]) {
      const f = hildDowned(`left-${mercy}`, mercy ? '&ransmercy=1' : '');
      new CampBot(f.sim, b, land, must(campContext(content))).goToZone('ZONE_SK_MACHAIR');
      expect(f.world.onFoot?.zone).toBe('ZONE_SK_MACHAIR');
      const left = f.events.find((e) => e.type === 'LEFT_BEHIND');
      expect(left).toMatchObject({ person: 'C_HILD', fate: mercy ? 'GRAVE' : 'KILLED' });
      expect(f.world.people['C_HILD']?.status).toBe(mercy ? 'downed' : 'dead');
    }
  });

  it('enemies leave the downed be; a named cruel enemy finishes only after a visible warning', () => {
    const f = hildDowned('cruel');
    const ketill = actor(f, 'E_WRECKER_KETILL');
    const hild = actor(f, 'C_HILD');
    ketill.x = hild.x + 16;
    ketill.y = hild.y;
    must(ketill.fight).finishesDowned = true;
    must(ketill.fight).finishing = { target: 'C_HILD', since: f.world.tick };
    let warnedFor = 0;
    for (
      let i = 0;
      i < cb.finishWarningTicks + 5 && f.world.people['C_HILD']?.status !== 'dead';
      i++
    ) {
      f.sim.step();
      warnedFor++;
    }
    expect(f.world.people['C_HILD']?.status).toBe('dead');
    expect(warnedFor).toBeGreaterThanOrEqual(cb.finishWarningTicks);
    // Interrupted (staggered) during the warning, the finishing ends.
    const g = hildDowned('cruel-stopped');
    const k2 = actor(g, 'E_WRECKER_KETILL');
    must(k2.fight).finishing = { target: 'C_HILD', since: g.world.tick };
    g.sim.step();
    must(k2.fight).f.state = 'stagger';
    must(k2.fight).f.recoveryEnd = g.world.tick + 30;
    for (let i = 0; i < cb.finishWarningTicks + 5; i++) g.sim.step();
    expect(g.world.people['C_HILD']?.status).toBe('downed');
  });
});

describe('crew orders on the quick keys (Book 2 section 12)', () => {
  it('are acknowledged aloud; a seriously wounded resident cannot attack or carry', () => {
    const f = strandFight('orders', '36,34.2');
    const onFoot = must(f.world.onFoot);
    takeHild(f, 34.5 * TILE, 33.2 * TILE);
    f.sim.submit({ type: 'CREW_ORDER', order: 'FOLLOW' });
    f.sim.step();
    expect(f.events).toContainEqual({ type: 'CREW_ORDER_ACK', person: 'C_HILD', order: 'FOLLOW' });
    expect(f.events).toContainEqual(
      expect.objectContaining({
        type: 'PERSON_SPOKE',
        person: 'C_HILD',
        lineKey: 'c_hild.bark.order.follow.01',
      }),
    );
    f.sim.submit({ type: 'CREW_ORDER', order: 'ATTACK' });
    f.sim.step();
    expect(f.events).toContainEqual(
      expect.objectContaining({
        type: 'CREW_ORDER_REFUSED',
        person: 'C_HILD',
        reason: 'CANNOT_FIGHT',
      }),
    );
    // Following: she walks after the steerer.
    for (let i = 0; i < 240; i++) {
      f.sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
      f.sim.step();
    }
    const h = actor(f, 'C_HILD');
    expect(Math.hypot(h.x - onFoot.player.x, h.y - onFoot.player.y)).toBeLessThan(
      (ai.habits.crewFollow + 1.5) * TILE,
    );
  });

  it('an able, armed resident ordered to attack fights the steerer’s target', () => {
    const f = strandFight('bran', '30,33.8');
    const onFoot = must(f.world.onFoot);
    f.world.household.residents.push('C_BRAN');
    must(f.world.people['C_BRAN']).status = 'alive';
    onFoot.actors['C_BRAN'] = { x: 31 * TILE, y: 33.8 * TILE, facing: 'w', pose: 'idle' };
    must(actor(f, 'E_WRECKER_CONN').fight).ai.aware = true;
    f.sim.submit({ type: 'CREW_ORDER', order: 'ATTACK' });
    for (let i = 0; i < 1500; i++) {
      f.world.player.vitality = 100;
      f.sim.step();
      if (f.events.some((e) => e.type === 'BLOW' && e.attacker === 'C_BRAN')) break;
    }
    expect(f.events.some((e) => e.type === 'BLOW' && e.attacker === 'C_BRAN')).toBe(true);
    expect(actor(f, 'C_BRAN').fight?.f).toMatchObject({ weapon: 'Hand axe', heavy: true });
  });
});

describe('berserk (Book 10 section 08, Traits)', () => {
  it('a berserker hurt may go berserk for Book 10’s time, ignoring orders', () => {
    let went = 0;
    for (let i = 0; i < 60; i++) {
      const f = strandFight(`berserk-${i}`, '36,34.2');
      const onFoot = must(f.world.onFoot);
      onFoot.actors['C_KARI'] = { x: 35 * TILE, y: 33.2 * TILE, facing: 'w', pose: 'idle' };
      f.world.household.residents.push('C_KARI');
      const fa = must(crewFight(f.world, must(land.fight), 'C_KARI'));
      hurt(fightWorldOf(f), 'C_KARI', 5, 'E_WRECKER_KETILL', {
        heavyKill: false,
        weapon: 'Hand axe',
        dx: 1,
        dy: 0,
      });
      if (fa.berserkUntil > f.world.tick) {
        went++;
        expect(fa.berserkUntil - f.world.tick).toBe(cb.berserk.ticks);
      }
    }
    expect(went).toBeGreaterThan(60 * cb.berserk.onWounded - 12);
    expect(went).toBeLessThan(60 * cb.berserk.onWounded + 12);
    // And deals x1.3.
    const k = newFighter('Hand axe');
    pressAttack(k, 0, cb, 'e', pool());
    releaseAttack(k, 1, cb, pool());
    expect(blowOf(k, cb, { berserk: true }).damage).toBeCloseTo(
      cb.weapons['Hand axe'].damage * cb.berserk.damage,
    );
  });
});

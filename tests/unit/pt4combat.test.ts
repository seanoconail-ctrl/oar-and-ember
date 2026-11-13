/**
 * The user's fourth playtest, combat and AI (requests 16 to 21; decisions DH-70 to DH-99): the
 * steerer's collapse before the death screen, a spared foe running off out of sight, guards that go
 * back to their post without pacing at a limit, pursuers that keep together, target choice by
 * threat, Svart's quicker pace, and every liftable person's carried frames. The hitboxes against the
 * drawn frames are tests/unit/hitboxes.test.ts; lifting Bran at the fold, tests/scenario/liftBran.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parsePt3Balance } from '../../src/content/pt3Balance.ts';
import { parsePt4Balance } from '../../src/content/pt4Balance.ts';
import { enterTimed } from '../../src/sim/combat/fighter.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { finishOffer, hurt } from '../../src/sim/land/fight.ts';
import type { FightWorld } from '../../src/sim/land/fight.ts';
import { outOfSight } from '../../src/sim/land/pursuit.ts';
import { switchZone } from '../../src/sim/land/zoneLinks.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { fightAnim } from '../../src/scenes/zoneScene.ts';
import { newFighter } from '../../src/sim/combat/fighter.ts';
import { loadLayerDefs, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { plainFighters } from './plainFoes.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const pt3 = parsePt3Balance(balance);
const pt4 = parsePt4Balance(balance);
const { content } = loadContentFromDisk();
const TILE = 24;
const STEERER = 'P_STEERER';
const SVART = 'E_WRECKER_SVART';
const KETILL = 'E_WRECKER_KETILL';
const CONN = 'E_WRECKER_CONN';
const BRAN = 'C_BRAN';

interface Fight {
  world: WorldState;
  sim: Simulation;
  events: SimEvent[];
  land: ReturnType<typeof landContext>;
}

interface Member {
  person: string;
  x: number;
  y: number;
  facing: 's' | 'n' | 'e' | 'w';
}

/** An encounter on Wreck Strand's open shingle: the members placed, a post or none. */
function strand(
  seed: string,
  members: Member[],
  opts: { post?: { x: number; y: number }; at?: [number, number]; bal?: unknown } = {},
): Fight {
  const combat = content.combat;
  if (combat === null) throw new Error('no combat content');
  const fixture = {
    ...content,
    searches: null,
    combat: {
      ...combat,
      fighters: plainFighters(combat.fighters),
      encounters: [
        {
          id: 'SCN_SK_WRECKERS',
          zone: 'ZONE_SK_STRAND',
          takesCaptives: false,
          checkpoint: 'test',
          ...(opts.post === undefined ? {} : { post: opts.post }),
          members,
        },
      ],
    },
  };
  const land = landContext(fixture, opts.bal ?? balance);
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams('camp=broch&time=10:00'));
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  const [x, y] = opts.at ?? [80, 34.5];
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: x * TILE, y: y * TILE });
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
  world.player.hotbar.selected = 0;
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  return { world, sim, events, land };
}

/** The real sheepfold under the cairn: the band at its gate, Bran inside (Stage 10). */
function fold(seed: string): Fight {
  const land = landContext(content, balance);
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams('camp=broch&time=10:00'));
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
  world.player.hotbar.selected = 0;
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  switchZone(onFoot, 'ZONE_SK_CAIRN', { x: 22 * TILE, y: 36 * TILE });
  sim.step();
  return { world, sim, events, land };
}

const actor = (f: Fight, id: string) => {
  const a = f.world.onFoot?.actors[id];
  if (a?.fight === undefined) throw new Error(`no ${id}`);
  return { a, fa: a.fight };
};
const player = (f: Fight) => {
  const p = f.world.onFoot?.player;
  if (p === undefined) throw new Error('no steerer');
  return p;
};
function steps(f: Fight, n: number, each?: () => void): void {
  for (let i = 0; i < n; i++) {
    each?.();
    f.sim.step();
  }
}
/** Alert to the steerer at once, the first-sight pause over (the fight under way). */
function alert(f: Fight, ...ids: string[]): void {
  const p = player(f);
  for (const id of ids) {
    const { fa } = actor(f, id);
    fa.ai.awareness = { level: 100, state: 'ALERT', heard: f.world.tick };
    fa.ai.aware = true;
    fa.ai.memory = { x: p.x, y: p.y, tick: f.world.tick, seen: true };
    fa.ai.target = STEERER;
  }
  steps(f, 2);
  const battle = f.world.onFoot?.battle;
  if (battle?.sight != null) battle.sight.until = -1;
}
function fightWorldOf(f: Fight, zone = 'ZONE_SK_STRAND'): FightWorld {
  const map = f.land.maps.get(zone);
  const ctx = f.land.fight;
  if (map === undefined || ctx == null) throw new Error('no fight content');
  return {
    world: f.world,
    ctx,
    land: f.land,
    map,
    tidalGroundOpen: false,
    emit: (e) => f.events.push(e),
    deed: () => undefined,
    options: { secondWind: false, ransMercy: false, parryWindow: 0 },
  };
}
/** The number of times a series turns from rising to falling or back (by more than `noise`). */
function turns(series: number[], noise: number): number {
  let n = 0;
  let dir = 0;
  let anchor = series[0] ?? 0;
  for (const v of series) {
    const d = v - anchor;
    if (Math.abs(d) < noise) continue;
    const s = Math.sign(d);
    if (dir !== 0 && s !== dir) n++;
    dir = s;
    anchor = v;
  }
  return n;
}

// ---------------------------------------------------------------------------- 19: target choice

describe('target choice by threat (request 19; DH-74)', () => {
  it('at the fold, striking one wrecker turns the other two on the steerer, not on Bran beside them', () => {
    for (const seed of ['threat-1', 'threat-2', 'threat-3']) {
      const f = fold(seed);
      alert(f, SVART, KETILL, CONN);
      steps(f, 10);
      const onFoot = f.world.onFoot;
      if (onFoot === null) throw new Error('no zone');
      expect(onFoot.battle?.engaged).toBe(true);
      // Bran out beside Svart and Ketill (1.5 tiles); the steerer 3.5 tiles off, by Conn.
      const svart = actor(f, SVART);
      const ketill = actor(f, KETILL);
      const conn = actor(f, CONN);
      const bran = onFoot.actors[BRAN];
      if (bran === undefined) throw new Error('no Bran');
      svart.a.x = 30 * TILE;
      svart.a.y = 35 * TILE;
      ketill.a.x = 30 * TILE;
      ketill.a.y = 37 * TILE;
      bran.x = 31.5 * TILE;
      bran.y = 36 * TILE;
      conn.a.x = 26 * TILE;
      conn.a.y = 36 * TILE;
      const p = player(f);
      p.x = 25 * TILE;
      p.y = 36 * TILE;
      // Both on Bran, the nearer (as before the playtest: the nearest seen).
      for (const w of [svart, ketill]) {
        w.fa.ai.target = BRAN;
        w.fa.ai.next = f.world.tick;
      }
      steps(f, 30, () => {
        f.world.player.vitality = 100;
      });
      // Without a blow, they keep their foe (threatKeep): nothing weighs enough to switch.
      expect([svart.fa.ai.target, ketill.fa.ai.target]).toEqual([BRAN, BRAN]);
      // The steerer strikes Conn.
      hurt(fightWorldOf(f, 'ZONE_SK_CAIRN'), CONN, 20, STEERER, {
        heavyKill: false,
        weapon: 'Seax',
        dx: 1,
        dy: 0,
      });
      steps(f, 20, () => {
        f.world.player.vitality = 100;
      });
      expect(svart.fa.ai.target, seed).toBe(STEERER);
      expect(ketill.fa.ai.target, seed).toBe(STEERER);
    }
  });

  it('a foe that strikes one of the band (even a blow turned) is weighed: the striker over a nearer foe', () => {
    const f = strand('threat-struck', [
      { person: SVART, x: 72, y: 34.5, facing: 'e' },
      { person: KETILL, x: 72, y: 36.5, facing: 'e' },
    ]);
    alert(f, SVART, KETILL);
    const onFoot = f.world.onFoot;
    if (onFoot === null) throw new Error('no zone');
    // Oddi as a household fighter right by them, the steerer further.
    f.world.household.residents.push('C_ODDI');
    const oddi = { x: 73.4 * TILE, y: 35.5 * TILE, facing: 'w' as const, pose: 'idle' as const };
    onFoot.actors['C_ODDI'] = oddi;
    const person = f.world.people['C_ODDI'];
    if (person !== undefined) person.status = 'alive';
    steps(f, 2);
    const p = player(f);
    p.x = 76 * TILE;
    p.y = 35.5 * TILE;
    const ketill = actor(f, KETILL);
    ketill.fa.ai.target = 'C_ODDI';
    steps(f, 12);
    hurt(fightWorldOf(f), SVART, 15, STEERER, { heavyKill: false, weapon: 'Seax', dx: -1, dy: 0 });
    steps(f, 12);
    expect(ketill.fa.ai.target).toBe(STEERER);
  });
});

// ------------------------------------------------------------- 18: guarding, pursuit, cohesion

describe('guards go back to their post without pacing; pursuers keep together (request 18; DH-72, DH-73)', () => {
  it('a guard runs back when its foe is beyond guardRadius of the post, and stands there without walking back and forth', () => {
    const post = { x: 70, y: 34.5 };
    const f = strand('guard-1', [{ person: SVART, x: 70, y: 34.5, facing: 'e' }], {
      post,
      at: [74, 34.5],
    });
    alert(f, SVART);
    const svart = actor(f, SVART);
    const p = player(f);
    // The steerer backs off to between guardResume and guardRadius, then past it, then stands just
    // outside guardRadius: the guard follows, then goes back, then holds its post.
    const towards = (tiles: number) => {
      p.x = (post.x + tiles) * TILE;
      p.y = post.y * TILE;
    };
    towards(4);
    steps(f, 120, () => {
      f.world.player.vitality = 100;
    });
    towards(pt4.guard.radiusTiles + 1.5);
    steps(f, 60 * 4, () => {
      f.world.player.vitality = 100;
    });
    expect(f.events.some((e) => e.type === 'GUARD_RETURNS' && e.person === SVART)).toBe(true);
    // Now the steerer stands at the limit's very edge for 20 s, a little either side of it.
    const dist: number[] = [];
    let k = 0;
    steps(f, 60 * 20, () => {
      f.world.player.vitality = 100;
      k++;
      towards(pt4.guard.radiusTiles + (Math.floor(k / 90) % 2 === 0 ? 0.2 : -0.2));
      dist.push(Math.hypot(svart.a.x - post.x * TILE, svart.a.y - post.y * TILE) / TILE);
    });
    // At its post the whole time, never walking out and back.
    expect(Math.max(...dist.slice(60))).toBeLessThanOrEqual(pt4.guard.homeTiles + 0.5);
    expect(turns(dist, 0.25)).toBeLessThanOrEqual(1);
    // The foe comes within guardResume: out it comes.
    towards(pt4.guard.resumeTiles - 1);
    steps(f, 60 * 2, () => {
      f.world.player.vitality = 100;
    });
    expect(svart.fa.ai.back).toBeUndefined();
    expect(['FIGHT', 'CIRCLE', 'HOLD_OFF', 'RETREAT']).toContain(svart.fa.ai.mode);
  });

  it('the same at the fold: the band breaks off and holds its gate; it never paces at the limit', () => {
    const f = fold('guard-fold');
    // Bran out of it: he would come out to fight them at their gate, and they would rightly answer.
    Reflect.deleteProperty(f.world.onFoot?.actors ?? {}, BRAN);
    alert(f, SVART, KETILL, CONN);
    const p = player(f);
    const enc = content.combat?.encounters.find((e) => e.id === 'SCN_SK_WRECKERS');
    const post = enc?.post;
    if (post === undefined) throw new Error('the fold has no post');
    p.x = (post.x - pt4.guard.radiusTiles - 3) * TILE;
    p.y = post.y * TILE;
    const series: Record<string, number[]> = { [SVART]: [], [KETILL]: [] };
    steps(f, 60 * 15, () => {
      f.world.player.vitality = 100;
      for (const id of [SVART, KETILL]) {
        const { a } = actor(f, id);
        series[id]?.push(a.x / TILE);
      }
    });
    for (const id of [SVART, KETILL]) {
      const s = series[id] ?? [];
      expect(turns(s.slice(60 * 3), 0.3), id).toBeLessThanOrEqual(1);
      const { a } = actor(f, id);
      expect(Math.hypot(a.x / TILE - post.x, a.y / TILE - post.y), id).toBeLessThanOrEqual(
        pt4.guard.homeTiles + 1,
      );
    }
  });

  it('a pursuer at its leash goes home and comes out again only within pursuitResume: no pacing', () => {
    // On the strand's dry shingle (its flats close with the tide).
    const f = strand('leash', [{ person: SVART, x: 66, y: 34.5, facing: 'e' }], { at: [70, 34.5] });
    alert(f, SVART);
    const svart = actor(f, SVART);
    const p = player(f);
    // The steerer far past the leash and standing: he follows to it, goes home and stays.
    const xs: number[] = [];
    let k = 0;
    steps(f, 60 * 30, () => {
      f.world.player.vitality = 100;
      k++;
      p.x = Math.min(66 + 26, 70 + k / 30) * TILE;
      p.y = 34.5 * TILE;
      xs.push(svart.a.x / TILE);
    });
    expect(f.events.some((e) => e.type === 'GUARD_RETURNS' && e.person === SVART)).toBe(true);
    expect(turns(xs.slice(60 * 8), 0.3)).toBeLessThanOrEqual(1);
    expect(Math.abs(svart.a.x / TILE - 66)).toBeLessThan(pt4.guard.homeTiles + 1);
  });

  it('pursuers keep together: the one ahead walks, then waits for its friend', () => {
    // Svart near the steerer, Ketill 8 tiles behind: Svart may not run on more than cohesionWait
    // ahead of him, and waits for him first.
    const f = strand(
      'cohesion',
      [
        { person: SVART, x: 72, y: 34.5, facing: 'e' },
        { person: KETILL, x: 64, y: 34.5, facing: 'e' },
      ],
      { at: [78, 34.5] },
    );
    alert(f, SVART, KETILL);
    const svart = actor(f, SVART);
    const ketill = actor(f, KETILL);
    const p = player(f);
    let worst = 0;
    let k = 0;
    let waited = false;
    steps(f, 60 * 12, () => {
      f.world.player.vitality = 100;
      k++;
      // The steerer keeps going east at a walk, out of reach, in both their sight.
      p.x = Math.min(94, 78 + k / 40) * TILE;
      p.y = 34.5 * TILE;
      // While both are after the steerer (neither gone back home at its leash).
      if (svart.fa.ai.back === undefined && ketill.fa.ai.back === undefined)
        worst = Math.max(worst, Math.hypot(svart.a.x - ketill.a.x, svart.a.y - ketill.a.y) / TILE);
      if (svart.fa.ai.waiting === true) waited = true;
    });
    expect(waited).toBe(true);
    // The gap never grew past where it started (8 tiles), and closes.
    expect(worst).toBeLessThanOrEqual(8.5);
    // At the end: together, or (Ketill at his leash first) the band broken off together.
    const gap = Math.hypot(svart.a.x - ketill.a.x, svart.a.y - ketill.a.y) / TILE;
    if (ketill.fa.ai.back !== undefined) expect(svart.fa.ai.back).toBeDefined();
    else expect(gap).toBeLessThanOrEqual(pt4.guard.waitTiles + 1);
  });
});

// ---------------------------------------------------------------------------- 17: running off

describe('a spared foe runs off out of sight, then is gone; SPARED stays recorded (request 17; DH-75)', () => {
  for (const how of ['REELING', 'DOWNED', 'BEGGING'] as const) {
    it(`let go ${how.toLowerCase()}: runs a planned way, never taken out while it could be seen, and its record stays`, () => {
      const f = strand(`run-off-${how}`, [{ person: SVART, x: 72, y: 34.5, facing: 'e' }], {
        at: [74, 34.5],
      });
      alert(f, SVART);
      const { a, fa } = actor(f, SVART);
      fa.vitality = Math.floor(fa.maxVitality * pt3.finishing.beatenBelow);
      if (how === 'REELING') enterTimed(fa.f, 'reel', f.world.tick, pt3.finishing.reelTicks);
      else {
        fa.f.state = how === 'DOWNED' ? 'downed' : 'surrendered';
        fa.f.since = f.world.tick;
        if (how === 'BEGGING') fa.ai.mode = 'SURRENDER';
      }
      const p = player(f);
      p.x = a.x + 0.9 * TILE;
      p.y = a.y;
      p.facing = 'w';
      if (p.stance !== undefined) {
        p.stance.facing = Math.PI;
        p.stance.want = Math.PI;
      }
      steps(f, 1);
      const ctx = f.land.fight;
      if (ctx == null) throw new Error('no fight');
      expect(finishOffer(f.world, ctx, TILE)?.foe).toBe(SVART);
      f.sim.submit({ type: 'SPARE' });
      const start = Math.hypot(a.x - p.x, a.y - p.y);
      const fw = fightWorldOf(f);
      let last = { x: a.x, y: a.y };
      let closest = Infinity;
      let ticks = 0;
      while (f.world.onFoot?.actors[SVART] !== undefined && ticks < 60 * 60) {
        last = { x: a.x, y: a.y };
        closest = Math.min(closest, Math.hypot(a.x - p.x, a.y - p.y));
        f.sim.step();
        ticks++;
      }
      // Gone within the minute, and only once out of the steerer's sight (or at the zone's edge).
      expect(f.world.onFoot?.actors[SVART]).toBeUndefined();
      const map = f.land.maps.get('ZONE_SK_STRAND');
      if (map === undefined) throw new Error('no map');
      const edge =
        last.x < 2 * TILE ||
        last.y < 2 * TILE ||
        last.x > (map.width - 2) * TILE ||
        last.y > (map.height - 2) * TILE;
      expect(outOfSight(fw, last.x, last.y) || edge).toBe(true);
      // It ran away: never nearer the steerer than where it began, less runOffKeep.
      expect(closest).toBeGreaterThanOrEqual(start - (pt4.runOff.keepTiles + 0.5) * TILE);
      // SPARED written, the record kept, the person missing (not dead).
      expect(f.world.ledger.some((d) => d.tag === 'SPARED' && d.victims.includes(SVART))).toBe(
        true,
      );
      expect((f.world.spared ?? []).some((r) => r.person === SVART)).toBe(true);
      expect(f.world.people[SVART]?.status).toBe('missing');
    });
  }
});

// --------------------------------------------------------------------------- 20: Svart's pace

describe('Svart (the spear) attacks a little more often (request 20; DH-77)', () => {
  it('his attacks come at least 10% (and at most 60%) more often than an outlaw’s old pace', () => {
    // The same fights with Book 10's old pace for a spear (the outlaw's patience, attackCooldown).
    const old = JSON.parse(JSON.stringify(balance)) as {
      tables: Record<string, Record<string, Record<string, string>[]>>;
    };
    const pace = old.tables['enemiesWildlifeAndPerception']?.['attackPace'] ?? [];
    for (const row of pace) {
      if (row['Key'] === 'spearPatience') row['Value'] = 'x1.0: (the old pace, for this test)';
      if (row['Key'] === 'spearCooldown') row['Value'] = '45 ticks (the old pace, for this test)';
    }
    const count = (bal: unknown, seed: string): number => {
      const f = strand(seed, [{ person: SVART, x: 72, y: 34.5, facing: 'e' }], {
        at: [75, 34.5],
        bal,
      });
      alert(f, SVART);
      let n = 0;
      const from = f.events.length;
      steps(f, 60 * 90, () => {
        f.world.player.vitality = 100;
      });
      for (const e of f.events.slice(from)) if (e.type === 'TELEGRAPH' && e.who === SVART) n++;
      return n;
    };
    let now = 0;
    let before = 0;
    for (const seed of ['pace-1', 'pace-2', 'pace-3', 'pace-4']) {
      now += count(balance, seed);
      before += count(old, seed);
    }
    console.log(
      `Svart's attacks in 6 minutes: ${String(now)} now, ${String(before)} at the old pace`,
    );
    expect(now / before).toBeGreaterThanOrEqual(1.1);
    expect(now / before).toBeLessThanOrEqual(1.6);
  });
});

// ----------------------------------------------------------------------- 16: the death collapse

describe('the steerer’s death: a collapse before the screen (request 16; DH-71)', () => {
  const sheets = loadSheets();
  const own = sheets.find((s) => s.name === 'actor_p_steerer_a')?.anims ?? {};
  it('the knees go, the fall by the way of the blow at its own pace, then still; game over at once', () => {
    const f = newFighter('Seax', { facing: 'e' });
    f.state = 'dead';
    f.since = 100;
    const c = {
      buckle: pt4.death.buckleTicks,
      frames: pt4.death.fallFrames,
      frameTicks: pt4.death.fallFrameTicks,
    };
    const at = (t: number) => fightAnim(f, 100 + t, false, own, { collapse: c, fall: 'fall_back' });
    expect(at(0)).toEqual({ state: 'stagger', frame: 1 });
    expect(at(c.buckle - 1)).toEqual({ state: 'stagger', frame: 1 });
    expect(at(c.buckle)).toEqual({ state: 'fall_back', frame: 0 });
    expect(at(c.buckle + c.frameTicks)).toEqual({ state: 'fall_back', frame: 1 });
    expect(at(c.buckle + c.frames * c.frameTicks)).toEqual({ state: 'dead', frame: 0 });
    // Every frame it asks for is drawn on both bodies.
    for (const name of ['actor_p_steerer_a', 'actor_p_steerer_b']) {
      const sh = sheets.find((s) => s.name === name);
      for (const st of ['stagger', 'fall_back', 'fall_fwd', 'fall_crumple', 'dead'])
        for (const facing of ['s', 'n', 'e', 'w'])
          expect(
            sh?.frames.has(`${st}/${facing}/${st === 'stagger' || st.startsWith('fall') ? 1 : 0}`),
            `${name} ${st} ${facing}`,
          ).toBe(true);
    }
    // The collapse lasts about Book 10's 1.8 s before the screen.
    const total = c.buckle + c.frames * c.frameTicks + Math.round(pt4.death.beatSeconds * 60);
    expect(total / 60).toBeGreaterThan(1.5);
    expect(total / 60).toBeLessThan(2.2);
  });

  it('a killing blow ends the game at that tick, with the way it came for the fall', () => {
    const f = strand('death', [{ person: SVART, x: 72, y: 34.5, facing: 'e' }], { at: [74, 34.5] });
    alert(f, SVART);
    f.world.player.vitality = 1;
    const tick = f.world.tick;
    hurt(fightWorldOf(f), STEERER, 10, SVART, { heavyKill: false, weapon: 'Spear', dx: 1, dy: 0 });
    expect(f.world.gameOver).toMatchObject({ tick, cause: 'FIGHT', from: 0 });
    expect(f.events.some((e) => e.type === 'STEERER_DIED')).toBe(true);
    expect(player(f).fight?.state).toBe('dead');
    // The world goes on drawing (the tick runs) while nothing moves.
    const at = { x: player(f).x, y: player(f).y };
    f.sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
    steps(f, 30);
    expect(f.world.tick).toBe(tick + 30);
    expect({ x: player(f).x, y: player(f).y }).toEqual(at);
  });
});

// -------------------------------------------------------------- 21: the carried frames, for all

describe('everyone who can be lifted has the carried pose drawn (request 21; DH-70)', () => {
  it('the household, the searches’ people and the fold’s ally: carried and lying frames on every layer, every facing', () => {
    const sheets = new Map(loadSheets().map((s) => [s.name, s]));
    const layers = new Map(loadLayerDefs().map((l) => [l.name, l.layers]));
    // Who can be downed and lifted in Chapter 1: Hild, Oddi, Runa, Bran (the fold's ally, downed
    // there), and Thorkel's body.
    for (const who of ['hild', 'oddi', 'runa', 'bran', 'thorkel']) {
      const def = layers.get(who);
      expect(def, who).toBeDefined();
      for (const facing of ['s', 'n', 'e', 'w'])
        for (const name of def?.[facing] ?? []) {
          const sh = sheets.get(name);
          expect(sh, name).toBeDefined();
          const n = sh?.anims['carried']?.frames ?? 0;
          expect(n, `${name} carried`).toBeGreaterThan(0);
          for (let i = 0; i < n; i++)
            expect(
              sh?.frames.has(`carried/${facing}/${String(i)}`),
              `${name} carried/${facing}/${String(i)}`,
            ).toBe(true);
        }
    }
  });
});

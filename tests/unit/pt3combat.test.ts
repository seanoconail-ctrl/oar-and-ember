/**
 * The user's third playtest, the combat part (decisions DG-2 to DG-11, DG-25, DG-26; Book 2 section
 * 23's tests, the ones the user asked for marked "asked"):
 * - asked: spared enemies are recorded (the deed, the fate stored, across save and load), with the
 *   fates' odds over 2,000 seeded spares;
 * - finishers: offered only to the beaten, with Book 10's frame data, deeds and hitstop;
 * - asked: the two teaching foes are beatable only their intended way;
 * - asked: every tutorial enemy speaks before attacking;
 * - combat prompts in fights 1 to 3 and never after; the heal prompt stops after 3 heals; the sneak
 *   hint; the fold's talk stops on awareness.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseCombatBalance } from '../../src/content/combatBalance.ts';
import { parsePeopleBalance } from '../../src/content/peopleBalance.ts';
import { parsePt3Balance } from '../../src/content/pt3Balance.ts';
import type { FinisherWeapon } from '../../src/content/pt3Balance.ts';
import { readSave, writeSave } from '../../src/persist/save.ts';
import { enterTimed } from '../../src/sim/combat/fighter.ts';
import { landContext } from '../../src/sim/land/context.ts';
import {
  addSpared,
  drawSightLine,
  finishOffer,
  missileStruck,
  sparedDay,
  sparedOdds,
} from '../../src/sim/land/fight.ts';
import type { FightWorld } from '../../src/sim/land/fight.ts';
import { switchZone } from '../../src/sim/land/zoneLinks.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Command, SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { emptyWorld, freshTeaching, newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { FoldTalk } from '../../src/scenes/foldTalk.ts';
import { CombatPrompts } from '../../src/ui/combatPrompts.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { carefulMemory, carefulTick } from '../../src/tools/play/carefulFighter.ts';
import { book } from './books.ts';
import { plainFighters } from './plainFoes.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const cb = parseCombatBalance(balance);
const pt3 = parsePt3Balance(balance);
const { content } = loadContentFromDisk();
const TILE = 24;
const STEERER = 'P_STEERER';
const SVART = 'E_WRECKER_SVART';
const KETILL = 'E_WRECKER_KETILL';
const CONN = 'E_WRECKER_CONN';

interface Fight {
  world: WorldState;
  sim: Simulation;
  events: SimEvent[];
  land: ReturnType<typeof landContext>;
}

/**
 * A fight on Wreck Strand's open shingle with the given scavengers, the steerer `away` tiles east
 * of the first, the seax in hand, the bow and a shield carried. `plain`: as ordinary outlaws.
 */
function fight(
  seed: string,
  members: string[],
  opts: { plain?: boolean; away?: number; hand?: string | null; time?: string } = {},
): Fight {
  const combat = content.combat;
  if (combat === null) throw new Error('no combat content');
  const fixture = {
    ...content,
    searches: null,
    combat: {
      ...combat,
      fighters: opts.plain === true ? plainFighters(combat.fighters) : combat.fighters,
      weapons: { ...combat.weapons, ITEM_CLUB: { row: 'Club or hammer' as const, layer: 'club' } },
      encounters: [
        {
          id: 'SCN_SK_WRECKERS',
          zone: 'ZONE_SK_STRAND',
          takesCaptives: false,
          checkpoint: 'test',
          members: members.map((person, i) => ({
            person,
            x: 72 - i * 2.5,
            y: 34.5 + (i % 2) * 1.5,
            facing: 'e' as const,
          })),
        },
      ],
    },
  };
  const land = landContext(fixture, balance);
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(`camp=broch&time=${opts.time ?? '10:00'}`));
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: (72 + (opts.away ?? 6)) * TILE, y: 34.5 * TILE });
  world.player.hotbar.slots[0] = opts.hand === undefined ? 'ITEM_SEAX' : opts.hand;
  world.player.hotbar.slots[1] = 'ITEM_BOW';
  world.player.hotbar.slots[2] = 'ITEM_SHIELD';
  world.player.inventory['ITEM_ARROW'] = 30;
  world.player.hotbar.selected = 0;
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  return { world, sim, events, land };
}

const actor = (f: Fight, id: string) => {
  const a = f.world.onFoot?.actors[id];
  if (a?.fight === undefined) throw new Error(`no ${id}`);
  return { a, fa: a.fight };
};

/** Puts the steerer `tiles` from a foe, facing it, at rest. */
function beside(f: Fight, id: string, tiles = 0.9): void {
  const { a } = actor(f, id);
  const p = f.world.onFoot?.player;
  if (p === undefined) throw new Error('no steerer');
  p.x = a.x + tiles * TILE;
  p.y = a.y;
  p.facing = 'w';
  p.stance ??= {
    facing: Math.PI,
    lockOn: null,
    sneaking: false,
    want: null,
    lockHeld: null,
    lostSince: null,
    speed: 1,
  };
  p.stance.facing = Math.PI;
  p.stance.want = Math.PI;
}

function steps(f: Fight, n: number, each?: () => void): void {
  for (let i = 0; i < n; i++) {
    each?.();
    f.sim.step();
  }
}

/** A foe made beaten as `how` (Book 10 "Finishing a beaten foe"). */
function beat(f: Fight, id: string, how: 'REELING' | 'DOWNED' | 'BEGGING'): void {
  const { fa } = actor(f, id);
  fa.vitality = Math.floor(fa.maxVitality * pt3.finishing.beatenBelow);
  fa.ai.aware = true;
  if (how === 'REELING') enterTimed(fa.f, 'reel', f.world.tick, pt3.finishing.reelTicks);
  else {
    fa.f.state = how === 'DOWNED' ? 'downed' : 'surrendered';
    fa.f.since = f.world.tick;
    if (how === 'BEGGING') fa.ai.mode = 'SURRENDER';
  }
}

function fightWorldOf(f: Fight): FightWorld {
  const map = f.land.maps.get('ZONE_SK_STRAND');
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
    options: { secondWind: false, ransMercy: false, parryWindow: cb.parry.window },
  };
}

/** The rows of a Book 10 table, read from the book itself. */
function bookTable(heading: string): string[][] {
  const text = book(10);
  const at = text.indexOf(`### ${heading}\n`);
  if (at < 0) throw new Error(`no ${heading}`);
  const lines = text.slice(at).split('\n').slice(1);
  const rows: string[][] = [];
  let inTable = false;
  for (const l of lines) {
    if (l.startsWith('|')) {
      inTable = true;
      rows.push(
        l
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim()),
      );
    } else if (inTable) break;
  }
  return rows.slice(2);
}

// ---------------------------------------------------------------------------- the spared (asked)

describe('spared enemies are recorded (asked; decisions DG-4 to DG-6)', () => {
  for (const how of ['REELING', 'DOWNED', 'BEGGING'] as const) {
    it(`letting go a ${how.toLowerCase()} foe writes SPARED, a record with its fate, drops the weapon, and the foe leaves without rejoining`, () => {
      const f = fight(`spare-${how}`, [SVART], { plain: true });
      steps(f, 2);
      beat(f, SVART, how);
      beside(f, SVART);
      steps(f, 1);
      expect(finishOffer(f.world, f.land.fight ?? never(), TILE)).toMatchObject({
        foe: SVART,
        state: how,
        variant: how === 'DOWNED' ? 'LYING' : 'STANDING',
      });
      const before = f.events.length;
      f.sim.submit({ type: 'SPARE' });
      steps(f, 1);
      const deed = f.world.ledger.at(-1);
      expect(deed).toMatchObject({ tag: 'SPARED', victims: [SVART], context: { how } });
      const rec = f.world.spared?.at(-1);
      expect(rec).toMatchObject({ person: SVART, deed: deed?.id, how, paid: false, island: true });
      expect(['FAVOUR', 'AMBUSH', 'GONE']).toContain(rec?.fate);
      expect(rec?.precursorDay).toBe((rec?.due ?? 0) - pt3.spared.precursorDays);
      expect(rec?.begged).toBe(how === 'BEGGING');
      // The weapon lies where it fell, as loot.
      expect(f.world.onFoot?.items.some((i) => i.item === 'ITEM_SPEAR')).toBe(true);
      const after = f.events.slice(before);
      expect(after).toContainEqual({ type: 'STEERER_SHOUTED', foe: SVART });
      steps(f, pt3.finishing.spareReplyTicks + 2);
      const reply = f.events.findIndex((e) => e.type === 'SPARED_REPLY' && e.person === SVART);
      expect(reply).toBeGreaterThan(before);
      // Gone from the zone in time, never striking again.
      steps(f, 60 * 20);
      expect(f.world.onFoot?.actors[SVART]).toBeUndefined();
      expect(
        f.events
          .slice(before)
          .some((e) => (e.type === 'ATTACK_STARTED' || e.type === 'TELEGRAPH') && e.who === SVART),
      ).toBe(false);
    });
  }

  it('the fates’ shares over 2,000 seeded spares match Book 10’s odds within 3 points, under each condition', () => {
    const ctx = landContext(content, balance).fight;
    if (ctx == null) throw new Error('no fight');
    const sp = pt3.spared;
    // The odds as Book 10 states them (base, begged, kin killed, shamed and robbed, all).
    expect(
      sparedOdds(sp, { begged: false, kinKilled: false, shamed: false, robbed: false }),
    ).toEqual({
      favour: 35,
      ambush: 25,
      gone: 40,
    });
    expect(
      sparedOdds(sp, { begged: true, kinKilled: false, shamed: false, robbed: false }),
    ).toEqual({
      favour: 45,
      ambush: 20,
      gone: 35,
    });
    expect(
      sparedOdds(sp, { begged: false, kinKilled: true, shamed: false, robbed: false }),
    ).toEqual({
      favour: 20,
      ambush: 45,
      gone: 35,
    });
    const conditions = [
      { begged: false, kinKilled: false, shamed: false, robbed: false },
      { begged: true, kinKilled: false, shamed: false, robbed: false },
      { begged: false, kinKilled: true, shamed: true, robbed: true },
      { begged: true, kinKilled: true, shamed: true, robbed: true },
    ];
    for (const c of conditions) {
      const odds = sparedOdds(sp, c);
      expect(odds.favour).toBeGreaterThanOrEqual(sp.favourRange[0]);
      expect(odds.favour).toBeLessThanOrEqual(sp.favourRange[1]);
      expect(odds.ambush).toBeGreaterThanOrEqual(sp.ambushRange[0]);
      expect(odds.ambush).toBeLessThanOrEqual(sp.ambushRange[1]);
      expect(odds.gone).toBeGreaterThanOrEqual(sp.goneAtLeast);
      const n = 2000;
      const seen = { FAVOUR: 0, AMBUSH: 0, GONE: 0 };
      for (let i = 0; i < n; i++) {
        const w = emptyWorld(`spare-odds-${String(i)}`, b);
        const r = addSpared(w, ctx, { person: SVART, deed: 'D', how: 'BEGGING', ...c });
        seen[r.fate]++;
        expect(r.due - w.calendar.day).toBeGreaterThanOrEqual(sp.dueDays[0]);
        expect(r.due - w.calendar.day).toBeLessThanOrEqual(sp.dueDays[1]);
      }
      expect(Math.abs((seen.FAVOUR / n) * 100 - odds.favour)).toBeLessThan(3);
      expect(Math.abs((seen.AMBUSH / n) * 100 - odds.ambush)).toBeLessThan(3);
      expect(Math.abs((seen.GONE / n) * 100 - odds.gone)).toBeLessThan(3);
    }
  });

  it('the record and what was taught survive save and load; an older save migrates to version 13', () => {
    const f = fight('spare-save', [SVART], { plain: true });
    steps(f, 2);
    beat(f, SVART, 'BEGGING');
    beside(f, SVART);
    f.sim.submit({ type: 'SPARE' });
    steps(f, 3);
    const meta = {
      build: 'test',
      slot: 'test',
      sequence: 1,
      kind: 'manual' as const,
      savedAt: 'now',
    };
    const { state } = readSave(JSON.parse(JSON.stringify(writeSave(f.world, meta))));
    expect(state.spared).toEqual(f.world.spared);
    expect(state.player.teaching).toEqual(f.world.player.teaching);
    // A version 12 save: fights counted as three, nothing else taught, no one spared on record.
    const old = JSON.parse(JSON.stringify(f.world)) as Record<string, unknown>;
    const player = old['player'] as Record<string, unknown>;
    delete player['teaching'];
    delete old['spared'];
    old['version'] = 12;
    const v12 = writeSave(old as unknown as WorldState, meta);
    const migrated = readSave(v12, { context: { balance } });
    expect(migrated.migratedFrom).toBe(12);
    expect(migrated.state.player.teaching).toEqual(freshTeaching(3));
    expect(migrated.state.spared).toEqual([]);
  });

  it('SPARED is read by each culture’s row (Book 10 "Deed reactions by culture")', () => {
    const read = parsePeopleBalance(balance).cultures.get('SPARED');
    expect(read?.NORSE).toEqual({ factor: 0.8, direction: 'for' });
    expect(read?.GAELIC).toEqual({ factor: 1.2, direction: 'for' });
    expect(read?.CHURCH).toEqual({ factor: 1.5, direction: 'for' });
    expect(read?.KEEPERS).toEqual({ factor: 1, direction: 'for' });
    expect(read?.SALTVIK).toEqual({ factor: 1, direction: 'for' });
  });

  it('the scheduler: a Chapter 1 spare waits for the launch, is due no sooner than Book 10’s days after it, its precursor first', () => {
    const ctx = landContext(content, balance).fight;
    if (ctx == null) throw new Error('no fight');
    const w = newCampaign('sched', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    const r = addSpared(w, ctx, {
      person: SVART,
      deed: 'D',
      how: 'BEGGING',
      begged: true,
      kinKilled: false,
      shamed: false,
      robbed: false,
    });
    r.fate = 'AMBUSH';
    const out: string[] = [];
    const emit = (e: { type: string; precursor?: boolean }): void => {
      out.push(`${e.type}:${String(e.precursor)}:${String(w.calendar.day)}`);
    };
    for (let day = 1; day <= 60; day++) {
      w.calendar = { ...w.calendar, day };
      sparedDay(w, ctx, emit, null);
    }
    // Before the launch nothing comes due: it plays on the island first.
    expect(out).toEqual([]);
    const launch = 61;
    for (let day = launch; day <= launch + 60; day++) {
      w.calendar = { ...w.calendar, day };
      sparedDay(w, ctx, emit, launch);
    }
    expect(r.due).toBeGreaterThanOrEqual(launch + pt3.spared.afterLaunchDays);
    expect(out).toEqual([
      `SPARED_DUE:true:${String(r.due - pt3.spared.precursorDays)}`,
      `SPARED_DUE:false:${String(r.due)}`,
    ]);
  });
});

function never(): never {
  throw new Error('missing');
}

// ---------------------------------------------------------------------------------- finishers

describe('finishers (decisions DG-2 and DG-3)', () => {
  it('the choice is offered only to a beaten foe, within offerReach, in the strike arc', () => {
    const f = fight('offer', [SVART], { plain: true });
    const ctx = f.land.fight ?? never();
    steps(f, 2);
    beside(f, SVART);
    const { fa } = actor(f, SVART);
    expect(finishOffer(f.world, ctx, TILE)).toBeNull();
    // A stagger above the beaten share is an ordinary opening: no choice.
    fa.vitality = fa.maxVitality * 0.6;
    enterTimed(fa.f, 'stagger', f.world.tick, cb.poise.staggerTicks);
    expect(finishOffer(f.world, ctx, TILE)).toBeNull();
    beat(f, SVART, 'REELING');
    expect(finishOffer(f.world, ctx, TILE)?.foe).toBe(SVART);
    // Beyond the reach, or behind the steerer: none.
    beside(f, SVART, pt3.finishing.offerReachTiles + cb.bodyRadiusTiles + 0.2);
    expect(finishOffer(f.world, ctx, TILE)).toBeNull();
    beside(f, SVART);
    const st = f.world.onFoot?.player.stance;
    if (st != null) st.facing = 0;
    expect(finishOffer(f.world, ctx, TILE)).toBeNull();
  });

  it('a stagger at or below beatenBelow becomes the reel; above it, Poise’s stagger', () => {
    const f = fight('reel', [SVART], { plain: true });
    steps(f, 2);
    beside(f, SVART);
    const { fa } = actor(f, SVART);
    fa.ai.aware = true;
    fa.vitality = fa.maxVitality * pt3.finishing.beatenBelow + 20;
    fa.f.poiseLost = 1000;
    f.sim.submit({ type: 'MELEE', facing: 'w' });
    steps(f, 1);
    f.sim.submit({ type: 'MELEE_RELEASE' });
    let reel = -1;
    steps(f, 40, () => {
      if (fa.f.state === 'reel' && reel < 0) reel = f.world.tick;
    });
    expect(reel).toBeGreaterThan(0);
    expect(fa.f.recoveryEnd - fa.f.since).toBe(pt3.finishing.reelTicks);
    expect(f.events).toContainEqual({ type: 'FOE_BEATEN', person: SVART, how: 'REELING' });
  });

  const ROWS: [FinisherWeapon, string | null][] = [
    ['Seax', 'ITEM_SEAX'],
    ['Hand axe', 'ITEM_AXE'],
    ['Spear', 'ITEM_SPEAR'],
    ['Sword', 'ITEM_SWORD'],
    ['Dane axe', 'ITEM_DANE_AXE'],
    ['Club or hammer', 'ITEM_CLUB'],
    ['Unarmed', null],
  ];
  const book10 = bookTable('Finishers');
  for (const [row, item] of ROWS)
    for (const variant of ['STANDING', 'LYING'] as const)
      it(`${row}, ${variant.toLowerCase()}: Book 10’s wind-up, active, recovery, step and hitstop; the deed`, () => {
        const f = fight(`fin-${row}-${variant}`, [CONN], { plain: true, hand: item });
        steps(f, 2);
        beat(f, CONN, variant === 'LYING' ? 'DOWNED' : 'REELING');
        beside(f, CONN);
        const p = f.world.onFoot?.player ?? never();
        const sf = p.fight;
        const fr = pt3.finishers[row][variant];
        // Book 10's own row, read from the book.
        const label = row === 'Unarmed' ? "Unarmed (the foe's weapon)" : row;
        const bookRow = book10.find(
          (r) => r[0] === label && r[1] === (variant === 'LYING' ? 'Lying' : 'Standing'),
        );
        expect(bookRow?.slice(2, 7).map(Number)).toEqual([
          fr.windup,
          fr.active,
          fr.recovery,
          fr.hitstop,
          fr.step,
        ]);
        f.sim.submit({ type: 'FINISHER', on: true });
        let began = -1;
        steps(f, cb.finisherHold + 1, () => {
          if (began < 0 && f.world.onFoot?.player.fight?.state === 'finisher') began = f.world.tick;
        });
        const fin = f.world.onFoot?.player.fight ?? sf ?? never();
        expect(fin.state).toBe('finisher');
        expect(fin.activeAt - fin.since).toBe(fr.windup);
        expect(fin.activeEnd - fin.activeAt).toBe(fr.active);
        expect(fin.recoveryEnd - fin.activeEnd).toBe(fr.recovery);
        expect(fin.finish?.weapon).toBe(row);
        const x0 = p.x;
        steps(f, fr.windup + fr.active + 2 + fr.hitstop);
        const blow = f.events.find((e) => e.type === 'BLOW' && e.kind === 'finisher');
        expect(blow).toMatchObject({
          defender: CONN,
          hitstop: fr.hitstop,
          shake: { px: cb.hit.shakeRiposte.px, ticks: cb.hit.shakeRiposte.ticks },
        });
        expect(actor(f, CONN).fa.dead).not.toBeNull();
        expect(Math.abs(Math.abs(p.x - x0) - fr.step * TILE)).toBeLessThan(1.5);
        expect(f.world.ledger.at(-1)?.tag).toBe(
          variant === 'LYING' ? 'SURRENDERED_KILLED' : 'KILLING',
        );
      });

  it('a begging foe finished is SURRENDERED_KILLED; a hold let go early does nothing; a hit in the hold ends it', () => {
    const f = fight('fin-beg', [CONN], { plain: true });
    steps(f, 2);
    beat(f, CONN, 'BEGGING');
    beside(f, CONN);
    f.sim.submit({ type: 'FINISHER', on: true });
    steps(f, cb.finisherHold - 4);
    f.sim.submit({ type: 'FINISHER', on: false });
    steps(f, 30);
    expect(actor(f, CONN).fa.dead).toBeNull();
    expect(f.world.onFoot?.player.fight?.state).not.toBe('finisher');
    f.sim.submit({ type: 'FINISHER', on: true });
    steps(f, cb.finisherHold + pt3.finishers.Seax.STANDING.windup + 10);
    expect(actor(f, CONN).fa.dead).not.toBeNull();
    expect(f.world.ledger.at(-1)?.tag).toBe('SURRENDERED_KILLED');
  });
});

// ------------------------------------------------------------------- the teaching foes (asked)

type Script = (f: Fight, foe: string, n: number) => Command[];

const lock = (f: Fight): Command[] =>
  f.world.onFoot?.player.stance?.lockOn == null
    ? [
        { type: 'LOCK_ON', down: true },
        { type: 'LOCK_ON', down: false },
      ]
    : [];

/**
 * Keeps the steerer within `tiles` of the foe (set there when it has drifted further, at rest), so
 * a script keeps trying its way; true when the foe is not in the opening its lesson gives (the
 * scripted players never take it: they test every other way).
 */
function closeTo(f: Fight, foe: string, tiles: number, out: Command[]): boolean {
  const p = f.world.onFoot?.player ?? never();
  const { a, fa } = actor(f, foe);
  const d = Math.hypot(a.x - p.x, a.y - p.y);
  if (d > tiles * TILE && p.fight?.state === 'idle') {
    p.x = a.x + ((p.x - a.x) / d) * tiles * 0.9 * TILE;
    p.y = a.y + ((p.y - a.y) / d) * tiles * 0.9 * TILE;
  }
  out.push({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
  return !lessonOpen(f, fa.f);
}

/** The opening a teaching foe's lesson gives (Book 10 svartOpening, ketillOpening). */
function lessonOpen(
  f: Fight,
  k: { state: string; move: string | null; activeEnd: number },
): boolean {
  return k.state === 'parried' || (k.move === 'red' && f.world.tick >= k.activeEnd);
}

const SCRIPTS: Record<string, Script> = {
  'chip with lights': (f, foe, n) => {
    const out = lock(f);
    if (closeTo(f, foe, 1.1, out) && n % 2 === 0) out.push({ type: 'MELEE', facing: 'w' });
    else out.push({ type: 'MELEE_RELEASE' });
    return out;
  },
  'charge heavies': (f, foe, n) => {
    const out = lock(f);
    const sf = f.world.onFoot?.player.fight;
    if (closeTo(f, foe, 1.2, out)) {
      if (sf?.state === 'idle' && n % 3 === 0) out.push({ type: 'MELEE', facing: 'w' });
      if (sf?.state === 'chargeL2') out.push({ type: 'MELEE_RELEASE' });
    }
    return out;
  },
  'block and punish': (f, foe, n) => {
    const out = lock(f);
    const { fa } = actor(f, foe);
    const coming =
      fa.f.state.startsWith('charge') || ['light1', 'heavyRelease'].includes(fa.f.state);
    if (closeTo(f, foe, 1.1, out)) {
      out.push({ type: 'BLOCK', on: coming });
      if (!coming && n % 4 === 0) out.push({ type: 'MELEE', facing: 'w' });
      else out.push({ type: 'MELEE_RELEASE' });
    }
    return out;
  },
  shove: (f, foe, n) => {
    const out = lock(f);
    if (closeTo(f, foe, 0.9, out) && n % 20 === 0) out.push({ type: 'SHOVE' });
    return out;
  },
  'backstab from cover': (f, foe, n) => {
    const out: Command[] = [];
    const { a } = actor(f, foe);
    const p = f.world.onFoot?.player ?? never();
    // Behind the foe (it faces east at first): sneak up to its back, then strike again and again.
    if (n === 0) {
      p.x = a.x - 3 * TILE;
      p.y = a.y;
      out.push({ type: 'SNEAK' });
    }
    if (closeTo(f, foe, 0.9, out) && n % 2 === 0) out.push({ type: 'MELEE', facing: 'e' });
    else out.push({ type: 'MELEE_RELEASE' });
    return out;
  },
  'loose arrows': (f, foe, n) => {
    const out: Command[] = [{ type: 'SELECT_SLOT', slot: 1 }];
    const p = f.world.onFoot?.player ?? never();
    const { a } = actor(f, foe);
    const dir = Math.round((Math.atan2(a.y - p.y, a.x - p.x) / (2 * Math.PI)) * 64);
    const { fa } = actor(f, foe);
    out.push({ type: 'AIM', dir: n % 50 < 40 || lessonOpen(f, fa.f) ? dir : null });
    return out;
  },
};

/** Thrown spears at the foe, as missiles striking its body (none is thrown by the steerer yet). */
function spears(f: Fight, foe: string, n: number): void {
  const { a, fa } = actor(f, foe);
  if (n % 90 !== 0 || lessonOpen(f, fa.f)) return;
  const p = f.world.onFoot?.player ?? never();
  missileStruck(fightWorldOf(f), {
    kind: 'spear',
    strike: 'body',
    target: foe,
    shooter: STEERER,
    x: a.x,
    y: a.y,
    n: 9000 + n,
  });
  expect(p.fight?.state).not.toBe('dead');
}

describe('the two teaching foes are beatable only their intended way (asked; decision DG-9)', () => {
  for (const foe of [SVART, KETILL])
    for (const [name, script] of [...Object.entries(SCRIPTS), ['throw spears', null] as const])
      it(`${foe === SVART ? 'Svart' : 'Ketill'}: "${name}" for 5 minutes leaves him at full vitality`, () => {
        const f = fight(`teach-${foe}-${name}`, [foe], { away: 4 });
        const { fa } = actor(f, foe);
        const max = fa.maxVitality;

        for (let n = 0; n < 60 * 300; n++) {
          f.world.player.vitality = 10_000;
          if (script === null) spears(f, foe, n);
          else for (const c of script(f, foe, n)) f.sim.submit(c);
          f.sim.step();
          if (fa.dead !== null) break;
        }
        expect(fa.dead).toBeNull();
        expect(fa.vitality).toBe(max);
        expect(f.events.filter((e) => e.type === 'GUARD_TURNED').length).toBeGreaterThan(0);
      });

  it('a player that parries beats Svart, on 10 seeds', () => {
    let won = 0;
    for (let n = 1; n <= 10; n++) {
      const f = fight(`svart-parry-${String(n)}`, [SVART], { away: 4 });
      const mem = carefulMemory('FINISH');
      const { fa } = actor(f, SVART);
      for (let i = 0; i < 60 * 120 && f.world.gameOver === null; i++) {
        const st = f.world.player.stamina;
        for (const c of carefulTick(
          f.world.onFoot ?? never(),
          cb,
          f.world.tick,
          st.current,
          st.max,
          mem,
        ))
          f.sim.submit(c);
        f.sim.step();
        if (fa.dead !== null) break;
      }
      if (fa.dead !== null && f.world.gameOver === null) won++;
      expect(f.events.some((e) => e.type === 'LESSON_DONE' && e.lesson === 'PARRY')).toBe(true);
    }
    expect(won).toBe(10);
  });

  it('a player that dodges the red blow and strikes in its recovery beats Ketill, on 10 seeds', () => {
    let won = 0;
    for (let n = 1; n <= 10; n++) {
      const f = fight(`ketill-dodge-${String(n)}`, [KETILL], { away: 4 });
      const mem = carefulMemory('FINISH');
      const { fa } = actor(f, KETILL);
      for (let i = 0; i < 60 * 180 && f.world.gameOver === null; i++) {
        const st = f.world.player.stamina;
        for (const c of carefulTick(
          f.world.onFoot ?? never(),
          cb,
          f.world.tick,
          st.current,
          st.max,
          mem,
        ))
          f.sim.submit(c);
        f.sim.step();
        if (fa.dead !== null) break;
      }
      if (fa.dead !== null && f.world.gameOver === null) won++;
      expect(f.events.some((e) => e.type === 'LESSON_DONE' && e.lesson === 'RED')).toBe(true);
    }
    expect(won).toBe(10);
  });

  it('the red blow breaks a raised guard and beats a parry; its telegraph is red at the flash lead, its first wind-up tick sends ATTACK_STARTED red', () => {
    const f = fight('red-rules', [KETILL], { away: 2 });
    const { fa } = actor(f, KETILL);
    const red = pt3.teaching.red;
    let start = -1;
    let flash = -1;
    f.sim.events.onAny((e) => {
      if (e.type === 'ATTACK_STARTED' && e.who === KETILL && e.kind === 'red' && start < 0)
        start = f.world.tick;
      if (e.type === 'TELEGRAPH' && e.who === KETILL && e.red === true && flash < 0)
        flash = f.world.tick;
    });
    // Shield up, facing him, until the red blow lands.
    f.sim.submit({ type: 'SELECT_SLOT', slot: 2 });
    let blow: SimEvent | undefined;
    for (let i = 0; i < 60 * 30 && blow === undefined; i++) {
      f.world.player.vitality = 10_000;
      f.sim.submit({ type: 'BLOCK', on: true });
      f.sim.step();
      if (start >= 0 && fa.f.move === 'red') {
        expect(fa.f.activeAt - fa.f.since).toBe(red.windup);
        expect(fa.f.activeEnd - fa.f.activeAt).toBe(red.active);
      }
      blow = f.events.find((e) => e.type === 'BLOW' && e.attacker === KETILL);
    }
    expect(blow).toMatchObject({ outcome: 'GUARD_BROKEN' });
    expect(start).toBeGreaterThan(0);
    expect(flash - start).toBe(red.windup - cb.telegraphs.flashLead);
    // A parry pressed so its live ticks meet the blow: beaten, the blow lands as a punish.
    const g = fight('red-parry', [KETILL], { away: 2 });
    const k = actor(g, KETILL).fa;
    let hit: SimEvent | undefined;
    for (let i = 0; i < 60 * 30 && hit === undefined; i++) {
      g.world.player.vitality = 10_000;
      const lead = cb.parry.windup + Math.floor(cb.parry.window / 2);
      if (k.f.move === 'red' && k.f.activeAt - g.world.tick === lead)
        g.sim.submit({ type: 'PARRY' });
      g.sim.step();
      hit = g.events.find((e) => e.type === 'BLOW' && e.attacker === KETILL);
    }
    expect(hit).toMatchObject({ outcome: 'HIT', punish: true });
  });
});

// --------------------------------------------------------------- first sight (asked; DG-8)

describe('every tutorial enemy speaks before attacking (asked; decision DG-8)', () => {
  /** The first-sight line, and every enemy's first wind-up, in one encounter. */
  function order(f: Fight, ticks: number, each?: (n: number) => void): void {
    let sight = -1;
    const firstAttack = new Map<string, number>();
    for (let n = 0; n < ticks; n++) {
      each?.(n);
      f.sim.step();
      for (const e of f.events.splice(0)) {
        if (e.type === 'FIRST_SIGHT' && sight < 0) sight = f.world.tick;
        if ((e.type === 'ATTACK_STARTED' || e.type === 'TELEGRAPH') && e.who.startsWith('E_'))
          if (!firstAttack.has(e.who)) firstAttack.set(e.who, f.world.tick);
        if (
          e.type === 'MISSILE_LOOSED' &&
          e.shooter.startsWith('E_') &&
          !firstAttack.has(e.shooter)
        )
          firstAttack.set(e.shooter, f.world.tick);
      }
    }
    expect(sight, 'a first-sight line').toBeGreaterThan(0);
    for (const [who, t] of firstAttack)
      expect(t, `${who} attacked before the line`).toBeGreaterThan(sight);
  }

  /** The game's own scavengers at dusk on day 1, the steerer coming from a side. */
  function duskFrom(seed: string, from: [number, number]): Fight {
    const land = landContext(content, balance);
    const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    campHooks(world, content, land, new URLSearchParams('camp=broch&time=18:35'));
    const onFoot = world.onFoot ?? never();
    switchZone(onFoot, 'ZONE_SK_STRAND', { x: from[0] * TILE, y: from[1] * TILE });
    world.player.hotbar.slots[0] = 'ITEM_SEAX';
    world.player.hotbar.selected = 0;
    const sim = createSimulation(b, world, land);
    const events: SimEvent[] = [];
    sim.events.onAny((e) => events.push(e));
    sim.step();
    return { world, sim, events, land };
  }

  const toward = (f: Fight, x: number, y: number, run: boolean, sneak: boolean): Command => {
    const p = f.world.onFoot?.player ?? never();
    const d = Math.hypot(x - p.x, y - p.y) || 1;
    return { type: 'MOVE', x: (x - p.x) / d, y: (y - p.y) / d, run, sneak };
  };

  for (const [name, from, run, sneak] of [
    ['walking from the west', [78, 34.5], false, false],
    ['running from the west', [76, 35], true, false],
    ['walking down the bank (north)', [90, 28], false, false],
    ['sneaking through the dune grass', [86, 30], false, true],
    ['from the east', [100, 35], false, false],
  ] as const)
    it(`at the dusk, ${name}`, () => {
      const f = duskFrom(`sight-dusk-${name}`, [from[0], from[1]]);
      const stern = { x: 92 * TILE, y: 35 * TILE };
      if (sneak) f.sim.submit({ type: 'SNEAK' });
      order(f, 60 * 40, () => {
        f.world.player.vitality = 10_000;
        f.sim.submit(toward(f, stern.x, stern.y, run, sneak));
      });
    });

  for (const [name, members] of [
    ['the fold’s band', [KETILL, SVART, CONN]],
    ['Seal Cave’s band', [KETILL, SVART]],
    ['one alone', [CONN]],
  ] as const)
    for (const side of ['east', 'west'] as const)
      it(`${name}, met from the ${side}`, () => {
        const f = fight(`sight-${name}-${side}`, [...members], { away: side === 'east' ? 9 : -12 });
        const { a } = actor(f, members[0]);
        order(f, 60 * 30, () => {
          f.world.player.vitality = 10_000;
          f.sim.submit(toward(f, a.x, a.y, false, false));
        });
      });

  it('a warning when alone or outnumbered, a taunt in a group; no line follows itself or comes again before its pool is used through', () => {
    const one = fight('kind-one', [CONN], { plain: true, away: 9 });
    const three = fight('kind-three', [KETILL, SVART, CONN], { plain: true, away: 9 });
    for (const f of [one, three])
      steps(f, 60 * 12, () => {
        f.sim.submit({ type: 'MOVE', x: -1, y: 0, run: false, sneak: false });
      });
    expect(one.events.find((e) => e.type === 'FIRST_SIGHT')).toMatchObject({ kind: 'WARNING' });
    expect(three.events.find((e) => e.type === 'FIRST_SIGHT')).toMatchObject({ kind: 'TAUNT' });
    // The pools' rule, drawn many times (a property over the `ai` stream).
    const ctx = landContext(content, balance).fight ?? never();
    for (const who of [SVART, KETILL, CONN, 'E_GENERIC_OUTLAW'])
      for (const kind of ['WARNING', 'TAUNT'] as const) {
        const w = newCampaign(`pool-${who}-${kind}`, b, parsePeopleBasics(balance), content, {
          name: 'Ash',
          bodyModel: 'A',
        });
        const lines: string[] = [];
        for (let i = 0; i < 60; i++) {
          const l = drawSightLine(w, ctx, who, kind);
          if (l !== null) lines.push(l);
        }
        if (who === 'E_GENERIC_OUTLAW') {
          expect(lines).toEqual([]);
          continue;
        }
        const size = new Set(lines).size;
        expect(size).toBeGreaterThanOrEqual(4);
        for (let i = 1; i < lines.length; i++) expect(lines[i]).not.toBe(lines[i - 1]);
        for (let i = 0; i + size <= lines.length; i += size)
          expect(new Set(lines.slice(i, i + size)).size).toBe(size);
      }
  });
});

// ------------------------------------------------- prompts, the heal prompt, the sneak hint

describe('combat prompts (decisions DG-7, DG-11 and DG-25)', () => {
  const now = { t: 0 };
  const frame = (
    p: CombatPrompts,
    t: ReturnType<typeof freshTeaching>,
    more: Partial<Parameters<CombatPrompts['frame']>[0]> = {},
  ) =>
    p.frame({
      now: now.t,
      teaching: t,
      option: 'FIRST',
      inFight: true,
      offered: false,
      shield: false,
      sneaking: false,
      healing: false,
      quiet: false,
      covered: false,
      ...more,
    });

  it('show in fights 1 to 3, and never after; each retires after its uses', () => {
    const p = new CombatPrompts(pt3.prompts);
    const t = freshTeaching();
    for (let fightN = 1; fightN <= 5; fightN++) {
      t.fights = fightN;
      now.t += 30;
      p.event({ type: 'FIGHT_COUNTED' }, now.t, t, 'FIRST');
      now.t += 1;
      frame(p, t);
      now.t += 0.6;
      const ids = frame(p, t).map((l) => l.id);
      if (fightN <= pt3.prompts.fights) expect(ids).toEqual(['LOCK_ON', 'STRIKE']);
      else expect(ids).toEqual([]);
      p.event({ type: 'FIGHT_ENDED' }, now.t, t, 'FIRST');
    }
    // Retired: the lock-on used three times in fights is not shown again.
    t.fights = 1;
    t.retired.push('LOCK_ON');
    now.t += 30;
    p.event({ type: 'FIGHT_COUNTED' }, now.t, t, 'FIRST');
    now.t += 1;
    frame(p, t);
    now.t += 0.6;
    expect(frame(p, t).map((l) => l.id)).toEqual(['STRIKE']);
    // Covered by a fighter: faded away; never more than two lines.
    now.t += 1;
    expect(frame(p, t, { covered: true }).every((l) => l.alpha < 1)).toBe(true);
    expect(frame(p, t, { offered: true }).length).toBeLessThanOrEqual(pt3.prompts.maxLines);
  });

  it('the simulation counts the steerer’s fights and the uses in fights', () => {
    const f = fight('count', [CONN], { plain: true, away: 3 });
    steps(f, 60 * 6, () => {
      f.world.player.vitality = 10_000;
    });
    // Locked on, let go (a long hold), locked on again: each lock in the fight is a use.
    for (let i = 0; i < 2; i++) {
      f.sim.submit({ type: 'LOCK_ON', down: true });
      steps(f, 1);
      f.sim.submit({ type: 'LOCK_ON', down: false });
      steps(f, 1);
      f.sim.submit({ type: 'LOCK_ON', down: true });
      steps(f, cb.stance.lockReleaseHoldTicks + 2);
      f.sim.submit({ type: 'LOCK_ON', down: false });
      steps(f, 1);
    }
    expect(f.world.player.teaching?.fights).toBe(1);
    expect(f.events.filter((e) => e.type === 'FIGHT_COUNTED')).toHaveLength(1);
    expect(f.world.player.teaching?.uses.LOCK_ON ?? 0).toBeGreaterThan(0);
  });

  it('the heal prompt shows on a hit below the threshold with a binding carried, and stops after 3 heals', () => {
    const p = new CombatPrompts(pt3.prompts);
    const t = freshTeaching();
    for (let heals = 0; heals <= 4; heals++) {
      t.heals = heals;
      now.t += 30;
      p.event({ type: 'HIT_TAKEN', below: true, wound: false, carries: true }, now.t, t, 'FIRST');
      now.t += 1;
      frame(p, t, { inFight: false });
      now.t += 0.6;
      const shown = frame(p, t, { inFight: false }).some((l) => l.id === 'HEAL');
      expect(shown, `after ${String(heals)} heals`).toBe(heals < pt3.prompts.healUntil);
    }
    // Not without a binding or ration, nor above the threshold.
    t.heals = 0;
    now.t += 30;
    p.event({ type: 'HIT_TAKEN', below: true, wound: false, carries: false }, now.t, t, 'FIRST');
    now.t += 1;
    expect(frame(p, t).some((l) => l.id === 'HEAL')).toBe(false);
  });

  it('the simulation counts heals finished, and the sneak hint shows on the dusk approach, at most its times, gone once sneaked', () => {
    const f = fight('sneak', [SVART, CONN], { plain: true, away: 14 });
    for (const a of Object.values(f.world.onFoot?.actors ?? {}))
      if (a.fight !== undefined) a.fight.f.angle = Math.PI;
    steps(f, 30, () => {
      f.sim.submit({ type: 'MOVE', x: -1, y: 0, run: false, sneak: false });
    });
    expect(f.events.filter((e) => e.type === 'SNEAK_HINT')).toHaveLength(1);
    expect(f.world.player.teaching?.sneakShown).toBe(1);
    // Sneaking its tiles retires it for good.
    f.sim.submit({ type: 'SNEAK' });
    steps(f, 200, () => {
      f.sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: true });
    });
    expect(f.world.player.teaching?.retired).toContain('SNEAK');
    // At most sneakHintTimes in the campaign.
    const t = f.world.player.teaching ?? never();
    expect(t.sneakShown).toBeLessThanOrEqual(pt3.prompts.sneakTimes);
    // Heals finished are counted.
    f.world.player.vitality = 40;
    f.world.player.inventory['ITEM_BINDING'] = 2;
    f.sim.submit({ type: 'HEAL' });
    steps(f, cb.heal.bindTicks + 5);
    expect(f.world.player.teaching?.heals).toBe(1);
  });
});

// --------------------------------------------------------------------------- the fold's talk

describe('the talk at the fold (decision DG-26)', () => {
  const talk = content.combat?.talk;
  if (talk === undefined) throw new Error('no talk');
  const everyone = new Set([KETILL, SVART, CONN, 'C_BRAN']);
  const view = (t: number, more: Partial<Parameters<FoldTalk['update']>[0]> = {}) => ({
    now: t,
    waiting: true,
    aware: false,
    present: (p: string) => everyone.has(p),
    tiles: () => 8,
    hold: () => 2.5,
    ...more,
  });

  it('plays while all are unaware, never the same exchange twice in a row, leaving out the absent', () => {
    const ft = new FoldTalk(talk.exchanges, pt3.fold, 'fold');
    const heard: string[] = [];
    let last = '';
    for (let t = 0; t < 600; t += 0.1) {
      const l = ft.update(view(t, { present: (p) => p !== CONN && everyone.has(p) }));
      if (l !== null) heard.push(l.key);
      const ex = ft.lastExchange;
      if (ex !== null && ex !== last) {
        expect(ex).not.toBe(last);
        last = ex;
      }
    }
    expect(heard.length).toBeGreaterThan(20);
    // Conn absent: neither his lines nor the exchanges that need him.
    expect(heard.some((k) => k.startsWith('e_wrecker_conn.') || k.includes('.fold.posts.'))).toBe(
      false,
    );
    // Overheard within its range as speech, beyond as a murmur, beyond that nothing.
    const near = new FoldTalk(talk.exchanges, pt3.fold, 'near');
    expect(near.update(view(0, { tiles: () => pt3.fold.overhearTiles - 1 }))?.murmur).toBe(false);
    const far = new FoldTalk(talk.exchanges, pt3.fold, 'far');
    expect(far.update(view(0, { tiles: () => pt3.fold.overhearTiles + 1 }))?.murmur).toBe(true);
    const gone = new FoldTalk(talk.exchanges, pt3.fold, 'gone');
    expect(gone.update(view(0, { tiles: () => pt3.fold.murmurTiles + 1 }))).toBeNull();
  });

  it('stops for good the moment any of them notices the steerer, until the next arrival', () => {
    const ft = new FoldTalk(talk.exchanges, pt3.fold, 'stop');
    expect(ft.update(view(0))).not.toBeNull();
    expect(ft.update(view(1, { aware: true }))).toBeNull();
    for (let t = 2; t < 60; t += 0.5) expect(ft.update(view(t))).toBeNull();
    expect(ft.stopped).toBe(true);
    // Leaving and coming back: a new order starts.
    ft.update(view(61, { waiting: false }));
    expect(ft.update(view(62))).not.toBeNull();
  });

  it('in the game: the fold’s band talks while unaware, and stops at the first suspicion (the simulation’s awareness)', () => {
    const f = fight('fold-real', [KETILL, SVART, CONN], { plain: true, away: 30 });
    const ft = new FoldTalk(talk.exchanges, pt3.fold, 'real');
    const said: number[] = [];
    let noticed = -1;
    for (let n = 0; n < 60 * 60; n++) {
      if (n > 60 * 20) f.sim.submit({ type: 'MOVE', x: -1, y: 0, run: true, sneak: false });
      f.sim.step();
      const actors = f.world.onFoot?.actors ?? {};
      const aware = Object.values(actors).some(
        (a) => a.fight?.side === 'ENEMY' && a.fight.ai.awareness.state !== 'UNAWARE',
      );
      if (aware && noticed < 0) noticed = n;
      const line = ft.update(
        view(n / 60, { aware, waiting: f.world.onFoot?.battle?.engaged !== true }),
      );
      if (line !== null) said.push(n);
    }
    expect(said.length).toBeGreaterThan(0);
    expect(noticed).toBeGreaterThan(0);
    expect(said.every((n) => n < noticed)).toBe(true);
  });
});

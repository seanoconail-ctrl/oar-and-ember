/**
 * The user's fourth playtest's people (requests 9 to 14; decisions DH-40 to DH-65; Book 10 section
 * 08, "Own hours", "Binding a wound", "Talk among the household", "Nudges and advice", "Boat
 * work"): the bound sit still, Runa refuses and comes round, the household talks among itself by
 * trait, tie and event and never back to back, nudges and advice name the real aims, everyone
 * keeps their own hours through the steerer's sleep, boat workers never share a spot, and the
 * boat's drawing follows the work.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseCompanyBalance } from '../../src/content/companyBalance.ts';
import { TIE_KINDS, TRAITS } from '../../src/content/registry.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { boatDrawing, boatLayers } from '../../src/scenes/repairsScene.ts';
import { homeOf } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { findActor } from '../../src/sim/land/zoneLinks.ts';
import {
  adviceLines,
  boatNeed,
  chooseExchange,
  companyState,
  companyTick,
  exchangeFits,
  openAims,
  ownHours,
  particularity,
  watcherOf,
} from '../../src/sim/people/company.ts';
import type { CompanyContext, CompanyView } from '../../src/sim/people/company.ts';
import type { PeopleContext } from '../../src/sim/people/context.ts';
import { tilesFromSteerer } from '../../src/sim/people/day.ts';
import { activityOf, jobSpot } from '../../src/sim/people/schedule.ts';
import { ADVICE_TOPIC, BOAT_TOPIC, talkOptions, topicsFor } from '../../src/sim/people/talk.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const cb = parseCompanyBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const T = 60;
const TILE = 24;

function need<X>(x: X | null | undefined, what: string): X {
  if (x === null || x === undefined) throw new Error(`no ${what}`);
  return x;
}
const camp = need(land.camp, 'camp');
const people: PeopleContext = need(land.people, 'people');
const cc: CompanyContext = need(people.company, 'company');
const company = need(content.company, 'company.json');
const guidance = need(content.guidance, 'guidance.json');

/** A campaign at the broch at an hour (the camp hooks the browser tests use). */
function atBroch(
  seed: string,
  params: Record<string, string> = {},
): { sim: Simulation; events: SimEvent[]; world: WorldState } {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams({ camp: 'broch', ...params }));
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  return { sim, events, world: sim.state };
}

/** Records every speech line with its tick. */
function listen(sim: Simulation): { who: string; key: string; at: number }[] {
  const out: { who: string; key: string; at: number }[] = [];
  sim.events.on('PERSON_SPOKE', (e) => {
    out.push({ who: e.person, key: e.lineKey, at: sim.state.tick });
  });
  return out;
}

function stepFor(sim: Simulation, ticks: number, each?: () => void): void {
  for (let i = 0; i < ticks; i++) {
    sim.step();
    each?.();
  }
}

/** Puts the steerer at a resident's side. */
function beside(world: WorldState, id: string, dx = 30): void {
  const onFoot = need(world.onFoot, 'on foot');
  const f = need(findActor(onFoot, id), id);
  onFoot.player.x = f.actor.x + dx;
  onFoot.player.y = f.actor.y;
}

describe('content (DH-40 onwards)', () => {
  it('the trait and tie names of company.json are the registry’s', () => {
    for (const r of company.care.refusers) expect(TRAITS).toContain(r.trait);
    for (const e of company.exchanges) {
      if (e.tie !== undefined) expect(TIE_KINDS).toContain(e.tie);
      for (const t of e.traits ?? []) expect(TRAITS).toContain(t.trait);
    }
  });

  it('every aim named by the guidance is an aim of the chapter, and Hild has a line for each she can see', () => {
    const aims = new Set((content.opening?.aims ?? []).map((a) => a.id));
    for (const aim of Object.keys(guidance.nudges)) expect(aims.has(aim)).toBe(true);
    // Hild is home from her setting down to the launch: every aim after the tower's has her line.
    const after = (content.opening?.aims ?? []).map((a) => a.id);
    for (const aim of after.slice(after.indexOf('see_tower')))
      if (aim !== 'bring_oddi') expect(guidance.nudges[aim]?.['C_HILD'], aim).toBeDefined();
  });

  it('boat workers’ spots: six round the boat, three seated, never one on the steerer’s work spot', () => {
    const job = need(content.household?.jobs['SHIPWRIGHT'], 'shipwright');
    expect(job.spots).toHaveLength(6);
    expect(job.hurtSpots).toHaveLength(3);
    const work = need(content.repairs, 'repairs').boat.work;
    const all = [...(job.spots ?? []), ...(job.hurtSpots ?? [])];
    for (const s of all)
      expect(Math.hypot(s.x - work.x, s.y - work.y)).toBeGreaterThanOrEqual(cb.boat.spotClearTiles);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const c = all[j];
        if (a === undefined || c === undefined) continue;
        expect(Math.hypot(a.x - c.x, a.y - c.y), `${i} and ${j}`).toBeGreaterThanOrEqual(1);
      }
    // They differ: both sides, stem and stern, standing and kneeling.
    expect(new Set((job.spots ?? []).map((s) => s.facing)).size).toBeGreaterThanOrEqual(3);
    expect((job.spots ?? []).some((s) => s.pose === 'kneel')).toBe(true);
  });
});

describe('request 9: bound still, and the one who refuses (DH-40 to DH-43)', () => {
  it('a wounded resident stands still, sitting and facing the steerer, while bound', () => {
    const { sim, world } = atBroch('bound', { time: '09:00', fire: 'lit', day: '2' });
    const onFoot = need(world.onFoot, 'on foot');
    beside(world, 'C_HILD', 20);
    sim.submit({ type: 'TALK', person: 'C_HILD' });
    sim.step();
    expect(world.talk?.with).toBe('C_HILD');
    const opts = talkOptions(world, people).map((o) => o.key);
    sim.submit({ type: 'TALK_CHOOSE', index: opts.indexOf('ui.talk.topic.wound') });
    sim.step();
    const choices = talkOptions(world, people).map((o) => o.key);
    sim.submit({ type: 'TALK_CHOOSE', index: choices.indexOf('p_steerer.talk.tend') });
    sim.step();
    expect(onFoot.player.work?.task).toBe('TASK_CARE');
    const hild = need(onFoot.actors['C_HILD'], 'Hild');
    const at = { x: hild.x, y: hild.y };
    // Through the binding, at an hour when her work would take her to the rocks.
    let ticks = 0;
    const binding = (): boolean => onFoot.player.work != null;
    while (binding()) {
      expect(activityOf(world, camp, people, 'C_HILD').kind).toBe('TENDED');
      sim.step();
      ticks++;
      // Still being bound after this tick: sitting, unmoved.
      if (binding()) {
        expect(hild.pose).toBe('sit');
        expect(Math.hypot(hild.x - at.x, hild.y - at.y)).toBeLessThan(0.01);
      }
    }
    expect(ticks).toBeGreaterThan(T);
    expect(world.people['C_HILD']?.wounds[0]?.tendedDay).toBe(2);
    // Bound, she goes back to her day.
    stepFor(sim, T * 5);
    expect(activityOf(world, camp, people, 'C_HILD').kind).not.toBe('TENDED');
  });

  /** Runa, wounded at the camp, talked to about her wound; returns the options after "Let me". */
  function offerRuna(sim: Simulation, world: WorldState): string[] {
    beside(world, 'C_RUNA', 20);
    sim.submit({ type: 'TALK', person: 'C_RUNA' });
    sim.step();
    expect(world.talk?.with).toBe('C_RUNA');
    const opts = talkOptions(world, people).map((o) => o.key);
    sim.submit({ type: 'TALK_CHOOSE', index: opts.indexOf('ui.talk.topic.wound') });
    sim.step();
    const choices = talkOptions(world, people).map((o) => o.key);
    sim.submit({ type: 'TALK_CHOOSE', index: choices.indexOf('p_steerer.talk.tend') });
    sim.step();
    return talkOptions(world, people).map((o) => o.key);
  }

  function woundedRuna(seed: string, day = '3') {
    const run = atBroch(seed, { time: '18:30', fire: 'lit', day, crew: '1', tended: '1' });
    const runa = need(run.world.people['C_RUNA'], 'Runa');
    runa.wounds = [{ day: 2, severity: 'SERIOUS', where: 'ankle' }];
    return run;
  }

  it('Runa (Superstitious) refuses another’s hand the first time, and is not bound', () => {
    const { sim, world, events } = woundedRuna('refuse');
    const options = offerRuna(sim, world);
    expect(world.onFoot?.player.work ?? null).toBeNull();
    expect(world.talk?.node).toBe('c_runa_wound_refused');
    expect(
      events.some((e) => e.type === 'PERSON_SPOKE' && e.lineKey === 'c_runa.care.refuse'),
    ).toBe(true);
    expect(options).toEqual([
      'p_steerer.talk.care.hold_end',
      'p_steerer.talk.care.boat_needs',
      'p_steerer.talk.care.suit',
    ]);
    // "The boat needs you whole" does not move her.
    sim.submit({ type: 'TALK_CHOOSE', index: 1 });
    sim.step();
    expect(events.some((e) => e.type === 'PERSON_SPOKE' && e.lineKey === 'c_runa.care.still')).toBe(
      true,
    );
    expect(world.onFoot?.player.work ?? null).toBeNull();
    expect(world.people['C_RUNA']?.wounds[0]?.tendedDay).toBeUndefined();
  });

  it('persuaded on her own terms (holding the end while she binds it), she is bound at once', () => {
    const { sim, world, events } = woundedRuna('persuade');
    offerRuna(sim, world);
    sim.submit({ type: 'TALK_CHOOSE', index: 0 });
    sim.step();
    expect(
      events.some((e) => e.type === 'PERSON_SPOKE' && e.lineKey === 'c_runa.care.persuaded'),
    ).toBe(true);
    expect(world.onFoot?.player.work?.task).toBe('TASK_CARE');
    while (world.onFoot?.player.work != null) sim.step();
    expect(world.people['C_RUNA']?.wounds[0]?.tendedDay).toBe(3);
  });

  it('asked again the same day she still refuses; asked on a later day she lets it be bound', () => {
    const { sim, world, events } = woundedRuna('later');
    offerRuna(sim, world);
    sim.submit({ type: 'TALK_END' });
    sim.step();
    expect(offerRuna(sim, world)[0]).toBe('p_steerer.talk.care.hold_end');
    sim.submit({ type: 'TALK_END' });
    sim.step();
    // The next day (careLater: 1 day).
    world.calendar = { ...world.calendar, day: world.calendar.day + cb.care.laterDays };
    offerRuna(sim, world);
    expect(events.some((e) => e.type === 'PERSON_SPOKE' && e.lineKey === 'c_runa.care.later')).toBe(
      true,
    );
    expect(world.onFoot?.player.work?.task).toBe('TASK_CARE');
  });

  it('nobody else refuses: Hild, Oddi and Bran are bound when asked', () => {
    for (const id of ['C_ODDI', 'C_BRAN']) {
      const { sim, world } = atBroch(`ok-${id}`, {
        time: '18:30',
        fire: 'lit',
        day: '3',
        crew: '1',
      });
      need(world.people[id], id).wounds = [{ day: 2, severity: 'SERIOUS', where: 'leg' }];
      beside(world, id, 20);
      sim.submit({ type: 'TALK', person: id });
      sim.step();
      const opts = talkOptions(world, people).map((o) => o.key);
      sim.submit({ type: 'TALK_CHOOSE', index: opts.indexOf('ui.talk.topic.wound') });
      sim.step();
      const choices = talkOptions(world, people).map((o) => o.key);
      sim.submit({ type: 'TALK_CHOOSE', index: choices.indexOf('p_steerer.talk.tend') });
      sim.step();
      expect(world.onFoot?.player.work?.target, id).toBe(id);
    }
  });
});

describe('request 13: their own hours, through the steerer’s sleep (DH-44 to DH-47)', () => {
  it('hours by trait and like: Bran and Runa rise early, Hild stays late at the fire', () => {
    const world = atBroch('hours', { time: '12:00', crew: '1' }).world;
    const bed = 22 * 60;
    const day = b.dayStart;
    const of = (id: string) => ownHours(world, cc, need(world.people[id], id), bed, day);
    expect(of('C_BRAN')).toMatchObject({ early: true, rise: day - cb.hours.earlyRiseMinutes });
    expect(of('C_RUNA')).toMatchObject({ early: true });
    expect(of('C_HILD')).toMatchObject({ late: true, early: false });
    expect(of('C_ODDI')).toMatchObject({ late: false, early: false });
  });

  it('one keeps the night watch by turns, while two or more are at home', () => {
    const world = atBroch('watch', { time: '12:00', crew: '1' }).world;
    for (const id of world.household.residents) need(world.people[id], id).life.joinedDay = 1;
    const seen = new Set<string>();
    for (let night = 1; night <= 8; night++) {
      const w = watcherOf(world, cc, night, world.household.residents);
      expect(w).not.toBeNull();
      seen.add(w ?? '');
    }
    expect(seen.size).toBe(4);
    expect(watcherOf(world, cc, 1, ['C_HILD'])).toBeNull();
  });

  it('when the steerer lies down at dusk the household does not: each keeps their own day', () => {
    const { sim, world } = atBroch('dusk', { time: '18:40', fire: 'lit', day: '3', crew: '1' });
    for (const id of world.household.residents) need(world.people[id], id).life.joinedDay = 2;
    const bedSite = need(
      camp.def.sites.find((s) => s.key === 'bed_s0'),
      'bed',
    );
    const onFoot = need(world.onFoot, 'on foot');
    onFoot.player.x = bedSite.x * TILE;
    onFoot.player.y = (bedSite.y + 0.5) * TILE;
    sim.submit({ type: 'SLEEP' });
    sim.step();
    expect(onFoot.player.sleep).not.toBeNull();
    // Lying down, the others are still at their evening.
    for (const id of world.household.residents)
      expect(activityOf(world, camp, people, id).kind, id).not.toBe('SLEEP');
    // The night passes; the day before they all slept at the same minute, now by their own hours.
    const bedAt = new Map<string, number>();
    sim.events.on('ACTIVITY_CHANGED', (e) => {
      if (e.activity === 'SLEEP' && !bedAt.has(e.person))
        bedAt.set(e.person, world.calendar.minuteOfDay);
    });
    const day = world.calendar.day;
    for (let i = 0; i < T * 20 && world.calendar.day === day; i++) sim.step();
    const watch = watcherOf(world, cc, day, world.household.residents);
    expect(bedAt.get('C_HILD')).toBe(23 * 60);
    expect(bedAt.get('C_ODDI') ?? bedAt.get('C_BRAN')).toBeDefined();
    expect(watch).not.toBeNull();
    expect(bedAt.get(watch ?? '')).toBe(cb.hours.watchUntil);
    // Waking at 06:00: the early risers are already at work or their dawn habit, the watch is
    // still abed, and everyone is where their day has them (not where they stood at dusk).
    expect(world.calendar.minuteOfDay).toBe(b.dayStart);
    sim.step();
    const kind = (id: string) => activityOf(world, camp, people, id).kind;
    expect(kind(watch ?? '')).toBe('SLEEP');
    for (const id of ['C_BRAN', 'C_RUNA'].filter((x) => x !== watch))
      expect(['WORK', 'TENDENCY', 'DARK'], id).toContain(kind(id));
    for (const id of world.household.residents) {
      const act = activityOf(world, camp, people, id);
      const f = need(findActor(onFoot, id), id);
      if (act.place === null) continue;
      expect(f.zone, id).toBe(act.place.zone);
      expect(Math.hypot(f.actor.x - act.place.x, f.actor.y - act.place.y), id).toBeLessThan(TILE);
    }
  });

  it('the night’s watch keeps the fire in from the woodpile', () => {
    const { sim, world } = atBroch('fire', { time: '22:10', fire: 'lit', day: '3', crew: '1' });
    for (const id of world.household.residents) need(world.people[id], id).life.joinedDay = 2;
    const home = need(homeOf(world, camp), 'home');
    home.stores['RES_DRIFTWOOD'] = 6;
    home.fire.fuel = 0.2;
    stepFor(sim, T * 50);
    expect(home.fire.lit).toBe(true);
    expect(home.stores['RES_DRIFTWOOD'] ?? 0).toBeLessThan(6);
  });
});

/** The view companyTick reads, for pure checks of exchanges. */
function view(world: WorldState): CompanyView {
  return {
    residents: [...world.household.residents].sort(),
    activity: (id) => activityOf(world, camp, people, id).kind,
    fromSteerer: (id) => tilesFromSteerer(world, id, TILE),
    earshotTiles: people.b.talk.earshotTiles,
    sameSpeakerSeconds: people.b.talk.sameSpeakerSeconds,
    ticksPerSecond: T,
    say: () => undefined,
  };
}

describe('request 10: talk among the household (DH-48 to DH-52)', () => {
  /** Everyone at home sitting together by the fire in the evening, the steerer by them. */
  function evening(seed: string) {
    const run = atBroch(seed, { time: '18:30', fire: 'lit', day: '3', crew: '1', tended: '1' });
    for (const id of run.world.household.residents) {
      const p = need(run.world.people[id], id);
      p.life.joinedDay = 2;
      p.wounds = [];
    }
    stepFor(run.sim, T * 20);
    return run;
  }

  it('chooses by trait, tie and event: the most particular that fits', () => {
    const { world } = evening('choose');
    const v = view(world);
    const fit = company.exchanges.filter((e) => exchangeFits(world, cc, e, v, TILE));
    expect(fit.length).toBeGreaterThan(2);
    const best = Math.max(...fit.map((e) => particularity(cc, e)));
    const chosen = chooseExchange(world, cc, v, TILE);
    expect(chosen).not.toBeNull();
    expect(particularity(cc, need(chosen, 'exchange'))).toBe(best);
    // A tie: Hild and Oddi are friends (Book 5); Bran is Oddi's mentor.
    const share = need(
      company.exchanges.find((e) => e.id === 'oddi_share'),
      'oddi_share',
    );
    world.facts['ch1.chest_opened'] = true;
    expect(exchangeFits(world, cc, share, v, TILE)).toBe(true);
    need(world.people['C_HILD'], 'Hild').ties = [];
    need(world.people['C_ODDI'], 'Oddi').ties = need(world.people['C_ODDI'], 'Oddi').ties.filter(
      (t) => t.to !== 'C_HILD',
    );
    expect(exchangeFits(world, cc, share, v, TILE)).toBe(false);
    // A trait: Runa's superstition.
    const whistle = need(
      company.exchanges.find((e) => e.id === 'whistle'),
      'whistle',
    );
    const runa = need(world.people['C_RUNA'], 'Runa');
    const before = runa.traits;
    runa.traits = runa.traits.filter((t) => t.trait !== 'SUPERSTITIOUS');
    expect(exchangeFits(world, cc, whistle, v, TILE)).toBe(false);
    runa.traits = before;
    // An event: the fold held (search.bran) for Hild and Bran's.
    const fold = need(
      company.exchanges.find((e) => e.id === 'held_fold'),
      'held_fold',
    );
    const was = world.facts['search.bran'];
    delete world.facts['search.bran'];
    expect(exchangeFits(world, cc, fold, v, TILE)).toBe(false);
    world.facts['search.bran'] = was ?? 'SNEAK';
  });

  it('plays as speech lines in turn, never back to back, with Book 10’s gaps; barks wait', () => {
    const { sim, world } = evening('play');
    const lines = listen(sim);
    const onFoot = need(world.onFoot, 'on foot');
    const hold = (): void => {
      const f = findActor(onFoot, 'C_BRAN');
      if (f !== null) {
        onFoot.player.x = f.actor.x + 40;
        onFoot.player.y = f.actor.y + 10;
      }
    };
    // About 25 real minutes of the evening (held at the fire hour by the day length).
    world.clock.dayLengthPercent = 25;
    stepFor(sim, T * 60 * 12, hold);
    const chat = lines.filter((l) => l.key.includes('.chat.'));
    expect(chat.length).toBeGreaterThan(4);
    // Group into exchanges: lines within a gap belong together.
    const gap = cb.exchange.lineGapSeconds * T;
    const groups: (typeof chat)[] = [];
    for (const l of chat) {
      const last = groups[groups.length - 1];
      const prev = last?.[last.length - 1];
      if (last !== undefined && prev !== undefined && l.at - prev.at <= gap + 1) last.push(l);
      else groups.push([l]);
    }
    for (const g of groups) {
      const id = need(g[0], 'line').key.split('.')[2];
      const def = need(
        company.exchanges.find((e) => e.id === id),
        `exchange ${id}`,
      );
      expect(g.map((l) => l.key)).toEqual(def.lines.map((l) => l.key));
      for (let i = 1; i < g.length; i++) expect((g[i]?.at ?? 0) - (g[i - 1]?.at ?? 0)).toBe(gap);
    }
    // Never back to back: at least exchangeEvery between one's end and the next's start.
    for (let i = 1; i < groups.length; i++) {
      const end = need(groups[i - 1], 'group').at(-1)?.at ?? 0;
      const start = need(groups[i], 'group')[0]?.at ?? 0;
      expect(start - end).toBeGreaterThanOrEqual(cb.exchange.everySeconds[0] * T);
    }
    // No other speech line inside an exchange.
    for (const g of groups) {
      const from = need(g[0], 'line').at;
      const to = g.at(-1)?.at ?? from;
      expect(lines.filter((l) => l.at > from && l.at < to && !l.key.includes('.chat.'))).toEqual(
        [],
      );
    }
    // The same exchange not twice within exchangeRepeat.
    const ids = groups.map((g) => need(g[0], 'line').key.split('.')[2]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never in a fight, nor out of the steerer’s hearing', () => {
    const { sim, world } = evening('quiet');
    const lines = listen(sim);
    const onFoot = need(world.onFoot, 'on foot');
    // Far off at the broch's edge: out of earshot.
    onFoot.player.x = 4 * TILE;
    onFoot.player.y = 6 * TILE;
    companyState(world, cc.b).nextExchange = world.tick;
    stepFor(sim, T * 200);
    expect(lines.filter((l) => l.key.includes('.chat.'))).toEqual([]);
    // In earshot, but an enemy aware of the steerer (a fight): the household's tick says nothing.
    beside(world, 'C_BRAN', 40);
    let said = 0;
    const v = {
      ...view(world),
      say: () => {
        said++;
      },
    };
    onFoot.actors['E_TEST'] = {
      x: onFoot.player.x + 200,
      y: onFoot.player.y,
      facing: 'w',
      pose: 'idle',
      fight: { side: 'ENEMY', ai: { aware: true }, dead: null },
    } as never;
    for (let i = 0; i < T * 200; i++) {
      world.tick++;
      companyTick(world, cc, v, TILE);
    }
    expect(said).toBe(0);
    // Without the enemy, the same tick speaks.
    Reflect.deleteProperty(onFoot.actors, 'E_TEST');
    for (let i = 0; i < T * 200 && said === 0; i++) {
      world.tick++;
      companyTick(world, cc, v, TILE);
    }
    expect(said).toBeGreaterThan(0);
  });
});

describe('requests 11 and 12: nudges and advice name the real aims (DH-53 to DH-58)', () => {
  it('whoever is near nudges towards the current aim in their own voice, spaced and capped', () => {
    // Day 2 morning: Oddi still to find; Bran and Runa home (the next person to find is Oddi).
    const { sim, world } = atBroch('nudge', { time: '08:00', fire: 'lit', day: '2', crew: '1' });
    for (const id of ['C_ODDI']) {
      world.household.residents = world.household.residents.filter((r) => r !== id);
      need(world.people[id], id).status = 'missing';
      delete world.facts['search.oddi'];
      delete world.facts['search.oddi_found'];
    }
    world.facts['ch1.phase'] = 'PLAY';
    // The first day's aims behind them: the chest home, the dusk over.
    need(homeOf(world, camp), 'home').placed = ['ITEM_THORKEL_CHEST'];
    world.facts['ch1.dusk_over'] = true;
    world.facts['ch1.hild_tended'] = true;
    sim.step();
    expect(world.aims?.current).toBe('find_oddi');
    const lines = listen(sim);
    const onFoot = need(world.onFoot, 'on foot');
    const follow = (): void => {
      const f = findActor(onFoot, 'C_BRAN');
      if (f !== null && f.zone === onFoot.zone) {
        onFoot.player.x = f.actor.x + 30;
        onFoot.player.y = f.actor.y;
      }
    };
    world.clock.dayLengthPercent = 25;
    stepFor(sim, T * 60 * 8, follow);
    expect(world.aims?.current).toBe(openAims(world, cc)[0]?.id);
    const nudges = lines.filter((l) => l.key.includes('.nudge.'));
    expect(nudges.length).toBeGreaterThan(0);
    for (const n of nudges) {
      const [who, , aim] = n.key.split('.');
      expect(n.who.toLowerCase()).toBe(who);
      // The current aim, or the next open one.
      expect(openAims(world, cc).map((a) => a.id)).toContain(aim);
      expect(guidance.nudges[aim ?? '']?.[n.who]).toContain(n.key);
    }
    expect(nudges[0]?.key).toMatch(/\.nudge\.find_oddi$/);
    for (let i = 1; i < nudges.length; i++)
      expect((nudges[i]?.at ?? 0) - (nudges[i - 1]?.at ?? 0)).toBeGreaterThanOrEqual(
        cb.nudge.everySeconds * T,
      );
    const onAim = nudges.filter((n) => n.key.endsWith('.find_oddi'));
    expect(onAim.length).toBeLessThanOrEqual(cb.nudge.maxPerAim);
  });

  it('"Ask for advice": Hild names the next aim and the one after, in her words', () => {
    const { sim, world } = atBroch('advice', { time: '08:00', fire: 'lit', day: '2', crew: '1' });
    world.facts['ch1.phase'] = 'PLAY';
    sim.step();
    beside(world, 'C_HILD', 20);
    expect(topicsFor(world, people, 'C_HILD').map((t) => t.id)).toContain(ADVICE_TOPIC);
    const lines = listen(sim);
    sim.submit({ type: 'TALK', person: 'C_HILD' });
    sim.step();
    const opts = talkOptions(world, people).map((o) => o.key);
    expect(opts).toContain('ui.talk.topic.advice');
    sim.submit({ type: 'TALK_CHOOSE', index: opts.indexOf('ui.talk.topic.advice') });
    stepFor(sim, T * 10);
    const want = adviceLines(world, cc, 'C_HILD');
    expect(want[0]).toBe('c_hild.advice.intro');
    const aims = openAims(world, cc)
      .map((a) => guidance.nudges[a.id]?.['C_HILD']?.[0])
      .filter((k) => k !== undefined)
      .slice(0, cb.nudge.adviceAims);
    expect(want.slice(1)).toEqual(aims);
    expect(lines.map((l) => l.key)).toEqual(expect.arrayContaining(want));
    // Untrusted, Bran gives no advice; trusted (Loyal), he does.
    expect(topicsFor(world, people, 'C_BRAN').map((t) => t.id)).not.toContain(ADVICE_TOPIC);
    need(world.people['C_BRAN'], 'Bran').friendship = cb.nudge.adviceTrust;
    expect(topicsFor(world, people, 'C_BRAN').map((t) => t.id)).toContain(ADVICE_TOPIC);
  });
});

describe('request 14: boat work (DH-59 to DH-64)', () => {
  it('everyone at the boat has a spot of their own, the hurt seated apart', () => {
    const { world } = atBroch('spots', { time: '10:00', day: '4', crew: '1', lay: 'boards' });
    for (const id of world.household.residents) {
      const p = need(world.people[id], id);
      p.job = { kind: 'SHIPWRIGHT', since: 4, byOrder: true };
      p.wounds =
        id === 'C_RUNA' || id === 'C_ODDI' ? [{ day: 2, severity: 'SERIOUS', where: 'x' }] : [];
    }
    const spots = world.household.residents.map((id) => {
      const s = need(jobSpot(world, camp, people, id, 'SHIPWRIGHT'), id);
      return `${s.x},${s.y}`;
    });
    expect(new Set(spots).size).toBe(world.household.residents.length);
    for (const id of world.household.residents) {
      const act = activityOf(world, camp, people, id);
      expect(act.kind, id).toBe('WORK');
      const hurt = id === 'C_RUNA' || id === 'C_ODDI';
      expect(act.place?.pose, id).toMatch(hurt ? /^sit$/ : /^(work|kneel)$/);
    }
  });

  it('asked about the boat, its workers say what it needs next', () => {
    const { sim, world } = atBroch('boat', { time: '10:00', day: '4', crew: '1' });
    world.facts['repair.open'] = true;
    const ship = need(world.ships['flagship'], 'ship');
    const needs: string[] = [];
    const record = (): void => {
      needs.push(boatNeed(world) ?? '');
    };
    record();
    ship.repairs.HULL = { stage: 'MATERIALS', progress: 10 };
    record();
    ship.repairs.HULL = { stage: 'DONE', progress: 0 };
    record();
    ship.repairs.RIGGING = { stage: 'MATERIALS', progress: 0 };
    record();
    ship.repairs.RIGGING = { stage: 'DONE', progress: 0 };
    world.facts['repair.carving'] = 'C_RUNA';
    record();
    ship.repairs.STEERING_OAR = { stage: 'MATERIALS', progress: 0 };
    record();
    ship.repairs.STEERING_OAR = { stage: 'DONE', progress: 0 };
    record();
    expect(needs).toEqual([
      'BOARDS',
      'HULL_WORK',
      'RIGGING_FETCH',
      'RIGGING_WORK',
      'OAR_CARVING',
      'OAR_SHIP',
      'READY',
    ]);
    // Runa (the boat's hand) is asked: her line for what it needs now.
    ship.repairs.RIGGING = { stage: 'LACKING', progress: 0 };
    sim.step();
    beside(world, 'C_RUNA', 20);
    const lines = listen(sim);
    sim.submit({ type: 'TALK', person: 'C_RUNA' });
    sim.step();
    expect(topicsFor(world, people, 'C_RUNA').map((t) => t.id)).toContain(BOAT_TOPIC);
    const opts = talkOptions(world, people).map((o) => o.key);
    sim.submit({ type: 'TALK_CHOOSE', index: opts.indexOf('ui.talk.topic.boat') });
    sim.step();
    expect(lines.at(-1)?.key).toBe(company.boat.lines['RIGGING_FETCH']?.['C_RUNA']);
    // Hild, at her nets, is not the boat's: no such topic.
    expect(topicsFor(world, people, 'C_HILD').map((t) => t.id)).not.toContain(BOAT_TOPIC);
  });

  it('the boat’s drawing changes gradually with the work done', () => {
    const { world } = atBroch('drawn', { time: '10:00', day: '4', crew: '1' });
    const ship = need(world.ships['flagship'], 'ship');
    const drawing = boatDrawing(balance);
    const hull = (progress: number, stage: 'LACKING' | 'MATERIALS' | 'DONE' = 'MATERIALS') => {
      ship.repairs.HULL = { stage, progress };
      return boatLayers(world, null, drawing)[0]?.frame.split('/')[0];
    };
    const L = drawing.hullLabour;
    expect([
      hull(0, 'LACKING'),
      hull(0),
      hull(0.3 * L),
      hull(0.55 * L),
      hull(0.8 * L),
      hull(0, 'DONE'),
    ]).toEqual([
      'hull_wrecked',
      'hull_wrecked',
      'hull_trim',
      'hull_boards',
      'hull_rivets',
      'hull_patched',
    ]);
    const rig = (progress: number, stage: 'MATERIALS' | 'DONE' = 'MATERIALS') => {
      ship.repairs.RIGGING = { stage, progress };
      return boatLayers(world, null, drawing)
        .map((l) => `${l.sheet}:${l.frame.split('/')[0]}`)
        .filter((x) => x.includes('rig'));
    };
    const R = drawing.riggingLabour;
    expect(rig(0)).toEqual([]);
    expect(rig(0.2 * R)).toEqual(['ship_t1_rigwork:lying']);
    expect(rig(0.6 * R)).toEqual(['ship_t1_rigwork:stepped']);
    expect(rig(0, 'DONE')).toEqual(['ship_t1_parts:rig']);
  });

  it('worked by the household, the hull passes through every drawn stage in order', () => {
    const { sim, world } = atBroch('worked', { time: '06:40', day: '4', crew: '1', lay: 'boards' });
    for (const id of world.household.residents) {
      const p = need(world.people[id], id);
      p.job = { kind: 'SHIPWRIGHT', since: 4, byOrder: true };
      p.wounds = [];
      p.life.joinedDay = 2;
    }
    const drawing = boatDrawing(balance);
    const seen: string[] = [];
    const ship = need(world.ships['flagship'], 'ship');
    for (let i = 0; i < T * 60 * 30 && ship.repairs.HULL.stage !== 'DONE'; i++) {
      sim.step();
      const f = boatLayers(world, null, drawing)[0]?.frame.split('/')[0] ?? '';
      if (seen.at(-1) !== f) seen.push(f);
      // Never two at one spot.
      if (i % T === 0) {
        const at = world.household.residents
          .map((id) => findActor(need(world.onFoot, 'on foot'), id))
          .filter((x) => x !== null && x.actor.pose !== 'idle' && x.actor.walk === undefined)
          .map(
            (x) =>
              `${x?.zone}:${Math.round((x?.actor.x ?? 0) / 6)},${Math.round((x?.actor.y ?? 0) / 6)}`,
          );
        expect(new Set(at).size).toBe(at.length);
      }
    }
    expect(seen).toEqual([
      'hull_wrecked',
      'hull_trim',
      'hull_boards',
      'hull_rivets',
      'hull_patched',
    ]);
  });
});

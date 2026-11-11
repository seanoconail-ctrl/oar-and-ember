/**
 * Stage 8 acceptance checks in the simulation (Book 3 Stage 8; Book 2 section 06; Book 5 sections
 * 01, 02 and 17; Book 8 sections 08, 09 and 11; Book 10 section 08):
 *
 * 1. Hild starts useful work immediately after her rescue and is always visibly doing something.
 * 2. Talking to a wounded resident offers a topic about the wound.
 * 3. Friendship and fear deltas by deed, happiness inputs, the work multiplier, the loyalty, leaving
 *    and devotion thresholds, and band transitions with the two-day spacing.
 *
 * And the rest of the stage: schedules and reason codes, jobs and delegation, barks and their
 * spacing, conversation, and Oddi's food-theft scene in a seeded world that contains him.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parsePeopleBalance } from '../../src/content/peopleBalance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { campContext, FACT_AT_BROCH, homeOf } from '../../src/sim/home/camp.ts';
import type { CampContext } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { placeActor } from '../../src/sim/land/zoneLinks.ts';
import { peopleContext } from '../../src/sim/people/context.ts';
import type { PeopleContext } from '../../src/sim/people/context.ts';
import { checkFeelings, moodFactors } from '../../src/sim/people/day.ts';
import {
  bandOf,
  driftHappiness,
  effectsOf,
  fearDelta,
  friendshipDelta,
  happinessTarget,
  happinessWork,
  workMultiplier,
} from '../../src/sim/people/measures.ts';
import { activityOf } from '../../src/sim/people/schedule.ts';
import { sceneFact } from '../../src/sim/people/scenes.ts';
import { talkOptions, topicsFor } from '../../src/sim/people/talk.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Simulation, SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { Person, WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { CampBot } from '../../src/tools/play/campBot.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const pb = parsePeopleBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull: CampContext | null = campContext(content);
const peopleOrNull: PeopleContext | null = peopleContext(content);
if (campOrNull === null || peopleOrNull === null) throw new Error('no camp or people content');
const camp: CampContext = campOrNull;
const people: PeopleContext = peopleOrNull;
const TILE = 24;

function person(world: WorldState, id: string): Person {
  const p = world.people[id];
  if (p === undefined) throw new Error(id);
  return p;
}

/** A campaign started at the broch (the camp hooks the browser tests use), at an hour. */
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

/** Runs the simulation for `minutes` game minutes. */
function run(sim: Simulation, minutes: number): void {
  const ticks = Math.round((minutes * b.secondsPerHour * 60) / 60);
  for (let i = 0; i < ticks; i++) sim.step();
}

/** Steps until the clock reads `hhmm` (minutes after midnight), today or tomorrow. */
function until(sim: Simulation, minuteOfDay: number): void {
  for (let i = 0; i < 60 * 60 * 40 && sim.state.calendar.minuteOfDay !== minuteOfDay; i++)
    sim.step();
}

/** Adds Oddi to the household at the camp, as Stage 10's search will (a seeded world). */
function withOddi(world: WorldState): void {
  const oddi = person(world, 'C_ODDI');
  oddi.status = 'alive';
  world.household.residents.push('C_ODDI');
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  placeActor(onFoot, 'C_ODDI', camp.def.zone, {
    x: 36.8 * TILE,
    y: 31.0 * TILE,
    facing: 'w',
    pose: 'sit',
  });
}

describe('Stage 8 check 3: friendship and fear deltas by deed (Book 10 section 08)', () => {
  const hild = () => newCampaign('d', b, parsePeopleBasics(balance), content).people['C_HILD'];

  it('weighs a deed by value, witness and culture: Hild sees her own rescue', () => {
    const h = hild();
    if (h === undefined) throw new Error('no Hild');
    // RESCUE: Kin +1 a point (Kin 3) and Glory 0 (Glory 2); Norse read it plainly.
    expect(friendshipDelta(pb, h, { tag: 'RESCUE' })).toBe(3);
    expect(friendshipDelta(pb, h, { tag: 'RESCUE' }, 'told')).toBeCloseTo(1.8, 6);
    expect(friendshipDelta(pb, h, { tag: 'RESCUE' }, 'rumour')).toBeCloseTo(0.9, 6);
    // KILLING: Glory +2 a point, read plainly by the Norse: 4.
    expect(friendshipDelta(pb, h, { tag: 'KILLING' })).toBe(4);
  });

  it('reads a deed by culture: a Gael counts a killing against the household', () => {
    const gael = { values: { GLORY: 2 }, traits: [], codes: ['GAELIC'] } as unknown as Person;
    expect(friendshipDelta(pb, gael, { tag: 'KILLING' })).toBeCloseTo(-4 * 1.5, 6);
    // Two codes take the stronger reading (Áine: Gaelic and Norse).
    const both = { ...gael, codes: ['NORSE', 'GAELIC'] } as unknown as Person;
    expect(friendshipDelta(pb, both, { tag: 'KILLING' })).toBeCloseTo(-6, 6);
    // Hostages are ordinary dealing everywhere (x0).
    const gain = { values: { GAIN: 3 }, traits: [], codes: ['NORSE'] } as unknown as Person;
    expect(friendshipDelta(pb, gain, { tag: 'HOSTAGE_TAKEN' })).toBe(0);
  });

  it('keeps the drengr rule, clamps to Book 10, and weighs traits', () => {
    const kari = { values: { GLORY: 3 }, traits: [], codes: ['NORSE'] } as unknown as Person;
    // CIVILIAN_KILLED: Glory valence 0 for Glory 3 without Mercy (decision DD-2): nothing.
    expect(friendshipDelta(pb, kari, { tag: 'CIVILIAN_KILLED' })).toBeCloseTo(0, 6);
    const bran = person(newCampaign('d', b, parsePeopleBasics(balance), content), 'C_BRAN');
    // Mercy 3 x -4, Word 2 x -1 = -14, read against by both his codes (Norse x1.0, Church x2.0:
    // the stronger), Gentle x1.5: past the clamp.
    expect(friendshipDelta(pb, bran, { tag: 'CIVILIAN_KILLED' })).toBe(-pb.weighing.clamp);
    // Sacrilege at a church against his own faith: Pious x2 on Faith's -3 (Faith counts only for
    // his own faith; Bran has no Faith value, so Mercy's -1 x 3 carries it).
    const pious = {
      values: { FAITH: 2 },
      traits: [{ trait: 'PIOUS', known: true, faith: 'CHRIST' }],
      codes: ['NORSE'],
      faithTarget: 'CHRIST',
    } as unknown as Person;
    const plain = { ...pious, traits: [] } as unknown as Person;
    const at = { tag: 'SACRILEGE', at: 'church', faith: 'CHRIST' } as const;
    expect(friendshipDelta(pb, pious, at)).toBeCloseTo(2 * friendshipDelta(pb, plain, at), 6);
  });

  it('gives fear by the Fear deltas table, times the witness', () => {
    expect(fearDelta(pb, 'KILLING')).toBe(2);
    expect(fearDelta(pb, 'CIVILIAN_KILLED')).toBe(8);
    expect(fearDelta(pb, 'SURRENDERED_KILLED')).toBe(10);
    expect(fearDelta(pb, 'PUNISHED')).toBe(6);
    expect(fearDelta(pb, 'PUNISH_WATCHED')).toBe(3);
    expect(fearDelta(pb, 'THREAT')).toBe(8);
    expect(fearDelta(pb, 'HARMED')).toBe(15);
    expect(fearDelta(pb, 'KILLING', 'told')).toBeCloseTo(1.2, 6);
  });

  it('records the rescue as a deed Hild saw, and her friendship moves by it', () => {
    const world = newCampaign('rescue', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    const sim = createSimulation(b, world, land);
    const strand = land.maps.get('ZONE_SK_STRAND');
    if (strand === undefined) throw new Error('no strand');
    new OpeningBot(sim, strand, b, land).rescue('C_HILD');
    const rescue = sim.state.ledger.find((d) => d.tag === 'RESCUE');
    expect(rescue).toMatchObject({ doer: 'HOUSEHOLD', victims: ['C_HILD'] });
    const h = person(sim.state, 'C_HILD');
    // A tie to the steerer (cousin): 20, and +3 for the rescue.
    expect(h.friendship).toBe(pb.measures.friendshipStartTie + 3);
    expect(h.memories.some((m) => m.kind === 'DEED' && m.about === 'RESCUE')).toBe(true);
  });
});

describe('Stage 8 check 3: happiness inputs and the work multiplier (Book 10 section 08)', () => {
  it('builds the day target from its inputs, each with its reason', () => {
    const { world } = atBroch('mood', { time: '15:00' });
    const h = person(world, 'C_HILD');
    const day = world.calendar.day;
    h.life.meals = { day, count: 1, hot: true, foods: ['RES_SALTED_FISH'] };
    h.life.night = { day, warm: false, bed: true };
    h.life.today = { day, treated: 5, likes: ['RES_SALTED_FISH'], dislikes: ['TOLD_TO_REST'] };
    h.life.lasting = [
      { cause: 'SUCCESS', amount: 10, fromDay: day, days: 3, fade: false, detail: 'shelter' },
    ];
    const f = moodFactors(world, people, h);
    const by = (cause: string) =>
      f.filter((x) => x.cause === cause).reduce((s, x) => s + x.amount, 0);
    expect(by('FOOD')).toBe(pb.inputs.fed);
    expect(by('WARMTH')).toBe(pb.inputs.coldNight);
    expect(by('REST')).toBe(pb.inputs.bed);
    expect(by('SAFETY')).toBe(pb.inputs.safe);
    expect(by('SUCCESS')).toBe(pb.inputs.success.amount);
    expect(by('TREATMENT')).toBe(5);
    expect(by('LIKE')).toBe(pb.likes.met);
    expect(by('DISLIKE')).toBe(pb.likes.dislikeMet);
    // Her father drowned on day 1: grief, fading over Book 10's seven days.
    expect(by('GRIEF')).toBeCloseTo(pb.inputs.grief.amount * (1 - (day - 1) / 7), 6);
    const sum = f.reduce((s, x) => s + x.amount, pb.measures.happinessBase);
    expect(happinessTarget(pb, f)).toBeCloseTo(Math.max(0, Math.min(100, sum)), 6);
  });

  it('is hungry without a meal by the afternoon, and drifts a tenth of the way an hour', () => {
    const { world } = atBroch('hungry', { time: '15:00' });
    const h = person(world, 'C_HILD');
    h.life.meals = { day: 0, count: 0, hot: false, foods: [] };
    expect(moodFactors(world, people, h).find((x) => x.cause === 'FOOD')?.amount).toBe(
      pb.inputs.hungry,
    );
    expect(driftHappiness(pb, 60, 20)).toBeCloseTo(56, 6);
    expect(driftHappiness(pb, 60, 100)).toBeCloseTo(64, 6);
  });

  it('scales work with happiness (0.8 to 1.2), fearful obedience and traits', () => {
    expect(happinessWork(pb, 0)).toBeCloseTo(0.8, 6);
    expect(happinessWork(pb, 50)).toBeCloseTo(1.0, 6);
    expect(happinessWork(pb, 100)).toBeCloseTo(1.2, 6);
    const base = { happiness: 50, friendship: 0, fear: 0, traits: [] } as unknown as Person;
    expect(workMultiplier(pb, base, true)).toBeCloseTo(1, 6);
    const fearful = { ...base, fear: 60, friendship: -1 };
    expect(workMultiplier(pb, fearful, true)).toBeCloseTo(0.85, 6);
    const diligent = { ...base, traits: [{ trait: 'DILIGENT', known: true }] } as unknown as Person;
    expect(workMultiplier(pb, diligent, false)).toBeCloseTo(1.1, 6);
    expect(workMultiplier(pb, diligent, true)).toBeCloseTo(1.0, 6);
    const lazy = { ...base, traits: [{ trait: 'LAZY', known: true }] } as unknown as Person;
    expect(workMultiplier(pb, lazy, false)).toBeCloseTo(0.85, 6);
    const seaSick = { ...base, traits: [{ trait: 'SEA_SICK', known: true }] } as unknown as Person;
    expect(workMultiplier(pb, seaSick, true)).toBeCloseTo(1.05, 6);
  });

  it('lands fish by the rate, the skill, a serious wound and her happiness', () => {
    const { sim, events, world } = atBroch('fish-rate', { time: '08:00', tended: '1', day: '2' });
    person(world, 'C_HILD').happiness = 100;
    run(sim, 60);
    const happy = events.filter((e) => e.type === 'FISH_LANDED' && e.by === 'C_HILD').length;
    expect(person(world, 'C_HILD').life.activity).toBe('WORK');
    expect(happy).toBeGreaterThanOrEqual(0);
    // Her catch: Book 10's spring rate a worker-day, half for the serious wound, x1.2 at 100.
    const catchAt = (h: number): number => {
      const w = campContext(content)?.work;
      if (w === undefined) return 0;
      return (w.fishShore.Spring / w.workerDayMinutes) * w.seriousWorkFactor * happinessWork(pb, h);
    };
    expect(catchAt(100) / catchAt(0)).toBeCloseTo(1.5, 6);
  });
});

describe('Stage 8 check 3: loyalty, leaving and devotion thresholds (Book 10 section 08)', () => {
  const at = (friendship: number, fear: number) => effectsOf(pb, { friendship, fear });

  it('marks the loyal at friendship 40', () => {
    expect(at(39, 0).loyal).toBe(false);
    expect(at(40, 0).loyal).toBe(true);
  });

  it('starts leaving at friendship -40 or less with fear below 30', () => {
    expect(at(-39, 0).leaves).toBe(false);
    expect(at(-40, 0).leaves).toBe(true);
    expect(at(-40, 29).leaves).toBe(true);
    expect(at(-40, 30).leaves).toBe(false);
  });

  it('marks fearful obedience at fear 60 with friendship below 0', () => {
    expect(at(-1, 60).fearfulObedience).toBe(true);
    expect(at(0, 60).fearfulObedience).toBe(false);
    expect(at(-1, 59).fearfulObedience).toBe(false);
  });

  it('marks fierce devotion at fear 60 with friendship 40', () => {
    expect(at(40, 60).devotion).toBe(true);
    expect(at(39, 60).devotion).toBe(false);
    expect(at(40, 59).devotion).toBe(false);
  });

  it('names the bands from Devoted down to Estranged', () => {
    expect(bandOf(pb, 70)).toBe('Devoted');
    expect(bandOf(pb, 69)).toBe('Loyal');
    expect(bandOf(pb, 40)).toBe('Loyal');
    expect(bandOf(pb, 10)).toBe('Content');
    expect(bandOf(pb, -10)).toBe('Uneasy');
    expect(bandOf(pb, -40)).toBe('Resentful');
    expect(bandOf(pb, -41)).toBe('Estranged');
  });
});

describe('Stage 8 check 3: band transitions and the warning flow, two days apart', () => {
  function flow(seed: string) {
    const { world } = atBroch(seed, { time: '12:00' });
    const h = person(world, 'C_HILD');
    const said: string[] = [];
    const steps: number[] = [];
    const emit = (e: { type: string; step?: number }) => {
      if (e.type === 'WARNING_STEP') steps.push(world.calendar.day * 10 + (e.step ?? 0));
    };
    const day = (d: number) => {
      world.calendar = { ...world.calendar, day: d };
      checkFeelings(world, people, h, emit);
      said.push(...h.life.owed.splice(0));
    };
    return { world, h, said, steps, day };
  }

  it('takes a step for each band crossed, in order, never two within two days', () => {
    const { h, said, steps, day } = flow('warn');
    day(1);
    h.friendship = -45; // Content to Estranged: three bands down at once
    day(1);
    day(2);
    day(3);
    day(4);
    day(5);
    // Remark on day 1, complaint on day 3, refusal on day 5: one step every two days.
    expect(steps).toEqual([11, 32, 53]);
    const lines = people.talk?.people['C_HILD']?.warnings.FRIENDSHIP ?? [];
    expect(said).toEqual(lines.slice(0, 3));
    // The refusal is of her work: she will not fish while it holds.
    expect(h.life.refuses).toEqual(['FISHER']);
    // Leaving's effect (friendship -40 or less, fear below 30) brings the request to leave, on time.
    day(6);
    day(7);
    expect(steps.at(-1)).toBe(74);
    expect(h.life.wantsToLeave).toBe(true);
    expect(said.at(-1)).toBe(lines[3]);
  });

  it('starts again when friendship comes back up, with praise as it rises', () => {
    const { h, said, steps, day } = flow('rise');
    day(1);
    h.friendship = -20;
    day(1);
    expect(steps).toEqual([11]);
    h.friendship = 45; // up to Loyal: praise, then an offer of help
    day(2);
    expect(h.life.warning.friendship.step).toBe(0);
    expect(h.life.refuses).toEqual([]);
    const rising = people.talk?.people['C_HILD']?.warnings.RISING ?? [];
    expect(said.slice(-2)).toEqual(rising.slice(0, 2));
  });

  it('starts the happiness steps after a whole day low, and speaks fear and devotion', () => {
    const { world, h, steps } = flow('low');
    h.happiness = 10;
    const emit = (e: { type: string; step?: number }) => {
      if (e.type === 'WARNING_STEP') steps.push(e.step ?? 0);
    };
    checkFeelings(world, people, h, emit);
    expect(steps).toEqual([]);
    world.calendar = { ...world.calendar, day: world.calendar.day + 1 };
    checkFeelings(world, people, h, emit);
    expect(steps).toEqual([1]);
    expect(h.life.owed).toContain(people.talk?.people['C_HILD']?.warnings.HAPPINESS[0]);
    h.fear = 60;
    h.friendship = 50;
    checkFeelings(world, people, h, emit);
    expect(h.life.owed).toContain(people.talk?.people['C_HILD']?.warnings.FEAR);
    expect(h.life.owed).toContain(people.talk?.people['C_HILD']?.warnings.DEVOTION);
  });
});

describe('Stage 8 check 1: Hild starts useful work after her rescue and is always doing something', () => {
  it('leads to the broch, shows the camp, and goes straight to work, a wound or no', () => {
    const world = newCampaign('useful', b, parsePeopleBasics(balance), content, {
      name: 'Ash',
      bodyModel: 'A',
    });
    const sim = createSimulation(b, world, land);
    const events: SimEvent[] = [];
    sim.events.onAny((e) => events.push(e));
    const strand = land.maps.get('ZONE_SK_STRAND');
    if (strand === undefined) throw new Error('no strand');
    const opening = new OpeningBot(sim, strand, b, land);
    opening.rescue('C_HILD');
    opening.waitFor(() => sim.state.facts['ch1.lead_started'] === true, 60 * 60);
    const bot = new CampBot(sim, b, land, camp);
    bot.goToZone('ZONE_SK_MACHAIR');
    bot.goToSite('stores');
    const said = (key: string) =>
      events.findIndex((e) => e.type === 'PERSON_SPOKE' && e.lineKey === key);
    bot.waitFor(() => said('c_hild.bark.broch.03') >= 0, 60 * 300);
    const shown = sim.state.calendar;
    // Within a game minute of showing the camp she is at her work: fishing, at half pace.
    bot.waitFor(() => person(sim.state, 'C_HILD').life.activity === 'WORK', 60 * 3);
    expect(person(sim.state, 'C_HILD').life.activity).toBe('WORK');
    expect(sim.state.calendar.minuteOfDay - shown.minuteOfDay).toBeLessThanOrEqual(2);
    expect(person(sim.state, 'C_HILD').wounds[0]?.tendedDay).toBeUndefined();
    const act = activityOf(sim.state, camp, people, 'C_HILD');
    expect(act).toMatchObject({ kind: 'WORK', job: 'FISHER', half: true });
    // And she lands fish that morning.
    bot.waitFor(() => events.some((e) => e.type === 'FISH_LANDED' && e.by === 'C_HILD'), 60 * 600);
    expect(events.some((e) => e.type === 'FISH_LANDED' && e.by === 'C_HILD')).toBe(true);
  });

  it('is always visibly doing something through three days and nights', () => {
    const { sim, world } = atBroch('busy', { time: '06:00', fire: 'lit', wood: '30' });
    world.facts['ch1.arrived_said'] = true;
    const kinds = new Set<string>();
    const idleStill: string[] = [];
    for (let minute = 0; minute < 3 * 1440; minute++) {
      run(sim, 1);
      const act = activityOf(sim.state, camp, people, 'C_HILD');
      kinds.add(act.kind);
      const found = sim.state.onFoot?.actors['C_HILD'];
      // In view, she is walking somewhere or in her activity's pose: never standing idle.
      if (found?.pose === 'idle' && found.walk === undefined)
        idleStill.push(`${sim.state.calendar.day} ${sim.state.calendar.minuteOfDay} ${act.kind}`);
      // Keep the fire in, as a camp would, so the nights are warm.
      const h = homeOf(sim.state, camp);
      if (h !== undefined && h.fire.fuel < 0.3) h.fire.fuel += 1;
    }
    expect(idleStill.slice(0, 5)).toEqual([]);
    for (const k of ['WORK', 'MEAL', 'EVENING', 'TENDENCY', 'SLEEP']) expect(kinds).toContain(k);
    // Every activity is one the household's day knows, with its reason.
    for (const k of kinds)
      expect(['WORK', 'MEAL', 'EVENING', 'TENDENCY', 'SLEEP', 'DARK', 'SIT']).toContain(k);
  });

  it('gives a reason for everything: the dark, rest when told, a refusal, a grave wound', () => {
    const { world } = atBroch('reasons', { time: '05:00', tended: '1', day: '2' });
    const h = person(world, 'C_HILD');
    world.facts['ch1.arrived_said'] = true;
    world.player.awake = true;
    world.calendar = { ...world.calendar, minuteOfDay: 6 * 60 + 10 };
    expect(activityOf(world, camp, people, 'C_HILD').kind).toBe('DARK');
    world.calendar = { ...world.calendar, minuteOfDay: 10 * 60 };
    // Tended, the serious wound still halves her work until it heals (Book 10 section 08).
    expect(activityOf(world, camp, people, 'C_HILD')).toMatchObject({ kind: 'WORK', half: true });
    const wounds = h.wounds;
    h.wounds = [];
    expect(activityOf(world, camp, people, 'C_HILD')).toMatchObject({ kind: 'WORK', half: false });
    h.wounds = wounds;
    h.job = { kind: 'REST', since: world.calendar.day, byOrder: true };
    expect(activityOf(world, camp, people, 'C_HILD').kind).toBe('REST');
    h.job = { kind: 'FISHER', since: 1, byOrder: false };
    h.life.refuses = ['FISHER'];
    expect(activityOf(world, camp, people, 'C_HILD').kind).toBe('REFUSE');
    h.life.refuses = [];
    h.wounds = [{ day: 2, severity: 'GRAVE', where: 'side' }];
    expect(activityOf(world, camp, people, 'C_HILD').kind).toBe('BED');
    h.wounds = [];
    // At dusk she walks the shore, watching the water (her tendency, Book 5 section 17).
    world.calendar = { ...world.calendar, minuteOfDay: 19 * 60 + 15 };
    expect(activityOf(world, camp, people, 'C_HILD')).toMatchObject({
      kind: 'TENDENCY',
      place: { zone: 'ZONE_SK_STRAND', pose: 'watch' },
    });
  });
});

describe('Stage 8 check 2: talking to a wounded resident offers a topic about the wound', () => {
  it('offers the wound first, and its "let me see to it" tends it', () => {
    const { sim, world, events } = atBroch('talk-wound', { time: '18:30' });
    sim.submit({ type: 'TALK', person: 'C_HILD' });
    sim.step();
    expect(world.talk?.with).toBe('C_HILD');
    const options = talkOptions(world, people).map((o) => o.key);
    expect(options[0]).toBe('ui.talk.topic.wound');
    expect(options).toContain('ui.talk.leave');
    sim.submit({ type: 'TALK_CHOOSE', index: 0 });
    sim.step();
    expect(world.talk?.line?.key).toBe('c_hild.talk.wound.01');
    const choices = talkOptions(world, people).map((o) => o.key);
    expect(choices).toContain('p_steerer.talk.tend');
    sim.submit({ type: 'TALK_CHOOSE', index: choices.indexOf('p_steerer.talk.tend') });
    sim.step();
    expect(world.talk).toBeNull();
    expect(world.onFoot?.player.work?.task).toBe('TASK_CARE');
    for (let i = 0; i < 60 * 4; i++) sim.step();
    expect(person(world, 'C_HILD').wounds[0]?.tendedDay).toBe(world.calendar.day);
    expect(events.some((e) => e.type === 'WOUND_TENDED')).toBe(true);
    // Tended: friendship +4 (Book 10 "Friendship from care and time") and remembered.
    expect(person(world, 'C_HILD').memories.some((m) => m.about === 'TENDED')).toBe(true);
    // A tended wound has its own topic.
    expect(topicsFor(world, people, 'C_HILD').map((t) => t.id)).toContain('c_hild.wound.tended');
  });

  it('offers a wound topic for any wounded resident, Oddi among them', () => {
    const { world } = atBroch('oddi-wound', { time: '18:30' });
    withOddi(world);
    person(world, 'C_ODDI').wounds = [{ day: 1, severity: 'LIGHT', where: 'arm' }];
    const topics = topicsFor(world, people, 'C_ODDI');
    expect(topics[0]).toMatchObject({ memory: 'WOUND', state: 'UNTENDED' });
    expect(topics.map((t) => t.labelKey)).toContain('ui.talk.topic.wound');
  });

  it('greets by the hour and the voice, rests a topic two days, and is time spent', () => {
    const { sim, world } = atBroch('talk-more', { time: '20:00', tended: '1' });
    const h = person(world, 'C_HILD');
    const before = h.friendship;
    sim.submit({ type: 'TALK', person: 'C_HILD' });
    sim.step();
    expect(world.talk?.line?.key).toMatch(/^c_hild\.greet\./);
    expect(h.friendship).toBe(before + pb.care.time);
    const idx = talkOptions(world, people).findIndex((o) => o.key === 'ui.talk.topic.father');
    sim.submit({ type: 'TALK_CHOOSE', index: idx });
    sim.step();
    sim.submit({ type: 'TALK_CHOOSE', index: 0 });
    sim.step();
    expect(topicsFor(world, people, 'C_HILD').map((t) => t.id)).not.toContain('c_hild.father');
    sim.submit({ type: 'TALK_END' });
    sim.step();
    expect(world.talk).toBeNull();
    h.friendship = 60;
    h.fear = 0;
    sim.submit({ type: 'TALK', person: 'C_HILD' });
    sim.step();
    expect(world.talk?.line?.key).toBe('c_hild.greet.warm.01');
  });
});

describe('jobs and delegation, with reason codes (Book 1 section 10)', () => {
  it('gives a job, and refuses one with its reason', () => {
    const { sim, world, events } = atBroch('jobs', { time: '10:00', tended: '1', day: '2' });
    const refusals = () =>
      events.flatMap((e) => (e.type === 'JOB_REFUSED' ? [`${e.job}:${e.reason}`] : []));
    sim.submit({ type: 'ASSIGN_JOB', person: 'C_HILD', job: 'FISHER' });
    sim.step();
    expect(refusals()).toEqual(['FISHER:ALREADY']);
    sim.submit({ type: 'ASSIGN_JOB', person: 'C_HILD', job: 'BUILDER' });
    sim.step();
    expect(person(world, 'C_HILD').job).toMatchObject({ kind: 'BUILDER', byOrder: true });
    run(sim, 30);
    expect(activityOf(world, camp, people, 'C_HILD')).toMatchObject({
      kind: 'WORK',
      job: 'BUILDER',
    });
    expect(homeOf(world, camp)?.building?.progress ?? 0).toBeGreaterThan(0);
    // Told to rest: Hild dislikes it (Book 5 section 17).
    sim.submit({ type: 'ASSIGN_JOB', person: 'C_HILD', job: 'REST' });
    sim.step();
    expect(person(world, 'C_HILD').life.today.dislikes).toContain('TOLD_TO_REST');
    const home = homeOf(world, camp);
    if (home !== undefined) home.stage = 'S1';
    sim.submit({ type: 'ASSIGN_JOB', person: 'C_HILD', job: 'BUILDER' });
    sim.step();
    person(world, 'C_HILD').wounds = [{ day: 2, severity: 'GRAVE', where: 'side' }];
    sim.submit({ type: 'ASSIGN_JOB', person: 'C_HILD', job: 'FISHER' });
    sim.step();
    person(world, 'C_HILD').wounds = [];
    person(world, 'C_HILD').life.refuses = ['CAMP'];
    sim.submit({ type: 'ASSIGN_JOB', person: 'C_HILD', job: 'CAMP' });
    sim.step();
    expect(refusals()).toEqual([
      'FISHER:ALREADY',
      'BUILDER:NO_SUCH_JOB',
      'FISHER:BED_BOUND',
      'CAMP:REFUSES',
    ]);
  });

  it('keeps the camp: the fire fed from the woodpile before it burns low', () => {
    const { sim, world } = atBroch('keeper', { time: '07:00', fire: 'lit', wood: '6', day: '2' });
    world.facts['ch1.arrived_said'] = true;
    person(world, 'C_HILD').job = { kind: 'CAMP', since: 2, byOrder: true };
    const h = homeOf(world, camp);
    if (h === undefined) throw new Error('no home');
    h.fire.fuel = 0.1;
    run(sim, 30);
    expect(h.fire.lit).toBe(true);
    expect(h.stores['RES_DRIFTWOOD']).toBeLessThan(6);
  });
});

describe('barks (Book 8 section 08)', () => {
  function listen(sim: Simulation) {
    const barks: { who: string; key: string; tick: number; category: string }[] = [];
    sim.events.onAny((e) => {
      if (e.type === 'PERSON_SPOKE' && e.bark !== undefined)
        barks.push({ who: e.person, key: e.lineKey, tick: sim.state.tick, category: e.bark });
    });
    return barks;
  }

  it('speak in earshot, by priority, never the same line within Book 8s spacing', () => {
    const { sim, world } = atBroch('barks', { time: '07:00', fire: 'lit', day: '2' });
    world.facts['ch1.arrived_said'] = true;
    const barks = listen(sim);
    for (let i = 0; i < 60 * 60 * 40; i++) {
      sim.step();
      const onFoot = sim.state.onFoot;
      const hild = onFoot?.actors['C_HILD'];
      // Keep beside her wherever she goes, so she is in earshot.
      if (onFoot != null && hild !== undefined && hild.walk === undefined) {
        onFoot.player.x = hild.x + 30;
        onFoot.player.y = hild.y;
      }
    }
    expect(barks.length).toBeGreaterThan(5);
    const tps = 60;
    for (let i = 0; i < barks.length; i++)
      for (let j = i + 1; j < barks.length; j++) {
        const a = barks[i];
        const c = barks[j];
        if (a === undefined || a.key !== c?.key) continue;
        expect(c.tick - a.tick).toBeGreaterThanOrEqual(pb.talk.sameSpeakerSeconds * tps);
      }
    // Between one bark and the next from her: Book 10's 75 to 150 real seconds.
    for (let i = 1; i < barks.length; i++) {
      const gap = (barks[i]?.tick ?? 0) - (barks[i - 1]?.tick ?? 0);
      expect(gap).toBeGreaterThanOrEqual(pb.talk.barkEverySeconds[0] * tps);
    }
    // Wounded, her wound comes before the everyday (Book 8 section 08 priority).
    expect(barks.some((x) => x.category === 'WOUND')).toBe(true);
  });

  it('stay quiet out of earshot', () => {
    const { sim, world } = atBroch('quiet', { time: '07:00', day: '2', at: '80,10' });
    world.facts['ch1.arrived_said'] = true;
    const barks = listen(sim);
    for (let i = 0; i < 60 * 60 * 10; i++) sim.step();
    expect(barks).toEqual([]);
  });
});

describe("Oddi's food-theft scene (Book 5 section 02), in a seeded world with Oddi", () => {
  function seeded(seed: string) {
    const { sim, world, events } = atBroch(seed, { time: '20:30', fire: 'lit', tended: '1' });
    world.facts['ch1.arrived_said'] = true;
    withOddi(world);
    sim.step();
    return { sim, world, events };
  }

  /** The first night, slept; then the evening of the second, by the fire. */
  function toSecondEvening(sim: Simulation, world: WorldState): void {
    const bed = camp.def.sites.find((s) => s.key === 'bed_s0');
    const onFoot = world.onFoot;
    if (bed === undefined || onFoot === null) throw new Error('no bed');
    onFoot.player.x = bed.x * TILE;
    onFoot.player.y = (bed.y + 0.5) * TILE;
    sim.submit({ type: 'SLEEP' });
    for (let i = 0; i < 60 * 10 && world.calendar.day === 1; i++) sim.step();
    until(sim, 20 * 60 + 20);
    const fire = camp.def.sites.find((s) => s.key === 'fire');
    if (fire !== undefined) {
      onFoot.player.x = fire.x * TILE;
      onFoot.player.y = (fire.y + 1.2) * TILE;
    }
  }

  it('takes from the stores the first night, unseen, and is found on the second', () => {
    const { sim, world, events } = seeded('theft');
    const before = homeOf(world, camp)?.stores['RES_SALTED_FISH'] ?? 0;
    toSecondEvening(sim, world);
    const oddi = person(world, 'C_ODDI');
    expect(oddi.life.stash).toBe(pb.talk.lightFingeredTakeRd);
    expect(oddi.traits.find((t) => t.trait === 'LIGHT_FINGERED')?.known).toBe(false);
    // Not on the first evening: the scene had not fired before this second one.
    expect(events.some((e) => e.type === 'DISPUTE_RAISED')).toBe(false);
    for (let i = 0; i < 60 * 30 && world.talk === null; i++) sim.step();
    expect(world.talk).toMatchObject({ kind: 'SCENE', with: 'C_ODDI', finder: 'C_HILD' });
    expect(events.find((e) => e.type === 'DISPUTE_RAISED')).toMatchObject({
      scene: 'BEAT_1_ODDI_THEFT',
      parties: ['C_ODDI', 'C_HILD'],
    });
    // Hild finds it, Oddi answers, Hild again; then the steerer judges.
    for (let i = 0; i < 60 * 10 && world.talk?.queue.length !== 0; i++) sim.step();
    const lines = events.flatMap((e) => (e.type === 'PERSON_SPOKE' ? [e.lineKey] : []));
    expect(lines.slice(-3)).toEqual([
      'c_hild.scene.theft.found',
      'c_oddi.scene.theft.excuse',
      'c_hild.scene.theft.witness',
    ]);
    expect(talkOptions(world, people).length).toBe(5);
    expect(before).toBeGreaterThan(0);
  });

  it.each([
    ['p_steerer.scene.theft.fair', 'FAIR', 'JUDGED'],
    ['p_steerer.scene.theft.punish', 'PUNISHED', 'JUDGED'],
    ['p_steerer.scene.theft.shame', 'SHAMED', 'JUDGED'],
    ['p_steerer.scene.theft.side', 'EXCUSED', 'JUDGED'],
    ['p_steerer.scene.theft.ignore', 'IGNORED', 'IGNORED'],
  ])('judged "%s": the outcome remembered, its effects by Book 10', (key, outcome, status) => {
    const { sim, world, events } = seeded(`judge-${outcome}`);
    toSecondEvening(sim, world);
    for (let i = 0; i < 60 * 30 && world.talk === null; i++) sim.step();
    for (let i = 0; i < 60 * 10 && world.talk?.queue.length !== 0; i++) sim.step();
    const oddi = person(world, 'C_ODDI');
    const hild = person(world, 'C_HILD');
    const o0 = { f: oddi.friendship, fear: oddi.fear };
    const h0 = { f: hild.friendship, fear: hild.fear };
    const stores0 = homeOf(world, camp)?.stores['RES_SALTED_FISH'] ?? 0;
    const i = talkOptions(world, people).findIndex((o) => o.key === key);
    sim.submit({ type: 'TALK_CHOOSE', index: i });
    sim.step();
    expect(world.facts[sceneFact('BEAT_1_ODDI_THEFT')]).toBe(outcome);
    expect(world.oneShots['BEAT_1_ODDI_THEFT']).toBe(world.calendar.day);
    expect(world.disputes.at(-1)).toMatchObject({ kind: 'THEFT', status });
    expect(oddi.traits.find((t) => t.trait === 'LIGHT_FINGERED')?.known).toBe(true);
    expect(world.ledger.at(-1)).toMatchObject({ tag: 'THEFT', doer: 'C_ODDI' });
    expect(oddi.memories.at(-1)).toMatchObject({ about: 'THEFT_FOUND', detail: outcome });
    const j = pb.judgements;
    const stores = homeOf(world, camp)?.stores['RES_SALTED_FISH'] ?? 0;
    switch (outcome) {
      case 'FAIR':
        expect(oddi.friendship - o0.f).toBe(j.COMPROMISE?.favoured.friendship);
        expect(hild.friendship - h0.f).toBe(j.COMPROMISE?.other.friendship);
        expect(oddi.life.today.likes).toContain('TRUSTED');
        expect(stores - stores0).toBe(pb.talk.lightFingeredTakeRd);
        break;
      case 'PUNISHED':
      case 'SHAMED':
        expect(oddi.fear - o0.fear).toBe(j.PUNISH?.other.fear);
        expect(oddi.friendship - o0.f).toBe(j.PUNISH?.other.friendship);
        expect(hild.fear - h0.fear).toBe(j.PUNISH?.watching.fear);
        expect(oddi.life.today.treated).toBe(
          outcome === 'SHAMED' ? pb.replies.Shamed.happiness : pb.replies.Punished.happiness,
        );
        break;
      case 'EXCUSED':
        expect(oddi.friendship - o0.f).toBe(j.TAKE_SIDE?.favoured.friendship);
        // Hild a grudge-holder: a slight costs her half again (Book 10 "Traits").
        expect(hild.friendship - h0.f).toBeCloseTo((j.TAKE_SIDE?.other.friendship ?? 0) * 1.5, 6);
        expect(oddi.life.stash).toBeGreaterThan(0);
        break;
      case 'IGNORED':
        expect(oddi.life.today.treated).toBe(j.IGNORE?.favoured.happiness);
        expect(hild.life.today.treated).toBe(j.IGNORE?.other.happiness);
        expect(oddi.life.stash).toBeGreaterThan(0);
        break;
    }
    // The outcome spoken at the fire, then the scene closes; it never fires again.
    for (let k = 0; k < 60 * 15 && world.talk !== null; k++) sim.step();
    expect(world.talk).toBeNull();
    expect(events.some((e) => e.type === 'JUDGEMENT_GIVEN')).toBe(true);
    oddi.life.stash = 1;
    run(sim, 60);
    expect(events.filter((e) => e.type === 'DISPUTE_RAISED')).toHaveLength(1);
  });

  it('takes nothing while watched, and fires only for the light-fingered', () => {
    const { sim, world } = seeded('watched');
    // The steerer stays up in the camp past Oddi's bedtime: watched, nothing taken.
    until(sim, 22 * 60 + 30);
    expect(person(world, 'C_ODDI').life.stash).toBe(0);
    const other = seeded('honest');
    const honest = person(other.world, 'C_ODDI');
    honest.traits = honest.traits.filter((t) => t.trait !== 'LIGHT_FINGERED');
    toSecondEvening(other.sim, other.world);
    run(other.sim, 120);
    expect(other.events.some((e) => e.type === 'DISPUTE_RAISED')).toBe(false);
  });
});

describe('the people in the content (Book 5 section 17)', () => {
  const residents = [...content.people.values()].filter((p) => p.kind === 'RESIDENT');

  it('gives all seventeen residents two to four traits, likes, dislikes, a tendency and codes', () => {
    expect(residents).toHaveLength(17);
    for (const p of residents) {
      expect(p.traits?.length ?? 0, p.id).toBeGreaterThanOrEqual(2);
      expect(p.traits?.length ?? 0, p.id).toBeLessThanOrEqual(4);
      expect(p.likes?.length ?? 0, p.id).toBeGreaterThanOrEqual(3);
      expect(p.dislikes?.length ?? 0, p.id).toBeGreaterThanOrEqual(2);
      expect(p.tendency, p.id).toBeDefined();
      expect(p.codes?.length ?? 0, p.id).toBeGreaterThanOrEqual(1);
      expect(p.codeStance, p.id).toBeDefined();
    }
  });

  it('gives each of the Chapter 1 crew their full voice: greetings, wounds, warnings, jobs', () => {
    for (const id of ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA']) {
      const s = content.talk?.people[id];
      expect(s, id).toBeDefined();
      const watches = new Set(s?.greetings.map((g) => g.watch).filter((w) => w !== undefined));
      expect([...watches].sort(), id).toEqual(['DAY', 'EVENING', 'MORNING', 'NIGHT']);
      const voices = new Set(s?.greetings.map((g) => g.voice).filter((v) => v !== undefined));
      expect([...voices].sort(), id).toEqual(['AFRAID', 'COLD', 'DEVOTED', 'WARM']);
      expect(s?.warnings.FRIENDSHIP, id).toHaveLength(4);
      expect(s?.warnings.HAPPINESS, id).toHaveLength(4);
      expect(s?.warnings.RISING, id).toHaveLength(3);
      const topics = content.talk?.topics.filter((t) => t.speaker === id) ?? [];
      expect(
        topics.some((t) => t.memory === 'WOUND' && t.state === 'UNTENDED'),
        id,
      ).toBe(true);
      expect(
        topics.some((t) => t.memory === 'WOUND' && t.state === 'TENDED'),
        id,
      ).toBe(true);
      expect(
        topics.some((t) => t.memory === 'JOB'),
        id,
      ).toBe(true);
    }
  });

  it('starts friendship at 20 for kin of the steerer, 0 otherwise', () => {
    const world = newCampaign('start', b, parsePeopleBasics(balance), content);
    expect(person(world, 'C_HILD').friendship).toBe(20);
    expect(person(world, 'C_GUDRUN').friendship).toBe(20);
    expect(person(world, 'C_ODDI').friendship).toBe(0);
    for (const p of Object.values(world.people)) {
      expect(p.happiness).toBe(60);
      expect(p.fear).toBe(0);
    }
  });

  it('shows a hidden trait on its day, drawn on the people stream (5 to 20 days)', () => {
    const { world } = atBroch('traits', { time: '12:00' });
    const grudge = person(world, 'C_HILD').traits.find((t) => t.trait === 'GRUDGE_HOLDER');
    expect(grudge?.known).toBe(false);
    expect(grudge?.discoverDay).toBeGreaterThanOrEqual(1 + pb.traits.discoverDays[0]);
    expect(grudge?.discoverDay).toBeLessThanOrEqual(1 + pb.traits.discoverDays[1]);
    const again = atBroch('traits', { time: '12:00' }).world;
    expect(
      person(again, 'C_HILD').traits.find((t) => t.trait === 'GRUDGE_HOLDER')?.discoverDay,
    ).toBe(grudge?.discoverDay);
  });

  it('keeps people in the opening out of the household day until the broch', () => {
    const world = newCampaign('open', b, parsePeopleBasics(balance), content);
    expect(world.facts[FACT_AT_BROCH]).toBeUndefined();
    expect(person(world, 'C_HILD').life.joinedDay).toBeNull();
  });
});

describe('A resident gathering driftwood (decision S8-29, Book 10 driftwoodSearchesPerWorkerDay)', () => {
  it('brings in about a day of searches: the per-search loads times the searches in a worker-day', () => {
    const { sim, world } = atBroch('driftwood', { time: '05:00', tended: '1', day: '2' });
    world.facts['ch1.arrived_said'] = true;
    const h = person(world, 'C_HILD');
    h.wounds = [];
    h.job = { kind: 'DRIFTWOOD', since: world.calendar.day, byOrder: true };
    const home = homeOf(world, camp);
    if (home === undefined) throw new Error('no home');
    const before = home.stores['RES_DRIFTWOOD'] ?? 0;
    world.calendar = { ...world.calendar, minuteOfDay: 10 * 60 };
    expect(activityOf(world, camp, people, 'C_HILD')).toMatchObject({
      kind: 'WORK',
      job: 'DRIFTWOOD',
    });
    world.calendar = { ...world.calendar, minuteOfDay: 5 * 60 };
    run(sim, 1440);
    const gained = (home.stores['RES_DRIFTWOOD'] ?? 0) - before;
    const w = camp.work;
    const day = w.driftwoodPerSearch.Spring * w.driftwoodSearchesPerWorkerDay;
    expect(w.driftwoodSearchesPerWorkerDay).toBe(2);
    // Skill, mood and the hours of light move it, but it is a day's searching: not 24 loads.
    expect(gained).toBeGreaterThan(day * 0.25);
    expect(gained).toBeLessThan(day * 2);
  });
});

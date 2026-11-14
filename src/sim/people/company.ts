/**
 * The household's own life (the user's fourth playtest, requests 9 to 14; decisions DH-40 to
 * DH-64; Book 2 section 06; Book 10 section 08):
 *
 * - **Own hours** (request 13): each resident sleeps by their own hours, not the steerer's. The
 *   early risers (Diligent, Pious) are up before the household's day; those who love the fire stay
 *   by it after its bedtime; one keeps the night watch by turns and sleeps on in the morning. The
 *   steerer's sleep still passes the night at once, and everyone's day runs through it.
 * - **Binding a wound** (request 9): the one being bound sits still; a Superstitious resident
 *   refuses another's hand on their wound, and comes round on their own terms or a day later.
 * - **Talk among the household** (request 10): short exchanges between residents near each
 *   other, chosen by their traits, ties and what has happened, heard as speech lines, never in a
 *   fight, never back to back.
 * - **Nudges and advice** (requests 11 and 12): whoever is near says what to do next in their own
 *   voice; an advisor answers "Ask for advice" with the next aim or two. By aim, for any chapter.
 * - **The boat** (request 14): what the boat needs next, as its workers would say it.
 *
 * The state is `world.company` (created when first needed). Deterministic: the only draws are on
 * the `people` stream.
 */
import { parseCompanyBalance } from '../../content/companyBalance.ts';
import type { CompanyBalance } from '../../content/companyBalance.ts';
import type {
  BoatNeed,
  CompanyDef,
  ExchangeDef,
  GuidanceDef,
} from '../../content/companySchema.ts';
import type { Content, OpeningDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { nextInt, pick } from '../../core/rng.ts';
import { holds, hintQuiet } from '../narrative/aims.ts';
import { findActor } from '../land/zoneLinks.ts';
import { REPAIRS } from '../ship/ship.ts';
import { boatOf, FACT_CARVING, FACT_OAR } from '../ship/work.ts';
import type { ActivityKind, Person, WorldState } from '../world.ts';

export type AimDef = OpeningDef['aims'][number];

export interface CompanyContext {
  readonly def: CompanyDef;
  readonly guidance: GuidanceDef | null;
  readonly b: CompanyBalance;
  readonly aims: readonly AimDef[];
}

export function companyContext(
  content: Pick<Content, 'company' | 'guidance' | 'opening' | 'balance'>,
): CompanyContext | null {
  const def = content.company;
  if (def == null) return null;
  return {
    def,
    guidance: content.guidance ?? null,
    b: parseCompanyBalance(content.balance),
    aims: content.opening?.aims ?? [],
  };
}

/** The state of the household's own life (Book 2 section 06; no save version of its own). */
export interface CompanyState {
  /** The tick of the last speech line anyone said (exchangeQuiet, nudgeQuiet). */
  lastSpeech: number;
  /** The tick the next exchange may start. */
  nextExchange: number;
  /** The exchange under way: its id, speakers, the next line and when it is due. */
  exchange: { id: string; speakers: Id[]; line: number; at: number } | null;
  /** Each exchange's id, with the tick it was last heard. */
  heard: Record<string, number>;
  /** The aim nudged about, the tick it became current, the nudges given, and the last one. */
  nudge: { aim: string | null; opened: number; given: number; last: number };
  /** A refused binding: the day it was refused and the wound's day; persuaded once taken up. */
  care: Record<Id, { day: number; wound: number; persuaded: boolean }>;
}

/** A tick long before any campaign began (saves keep finite numbers only). */
const NEVER = -1e9;

export function companyState(world: WorldState, b?: CompanyBalance, tps = 60): CompanyState {
  world.company ??= {
    lastSpeech: NEVER,
    nextExchange: world.tick + Math.round((b?.exchange.firstSeconds ?? 0) * tps),
    exchange: null,
    heard: {},
    nudge: { aim: null, opened: world.tick, given: 0, last: NEVER },
    care: {},
  };
  return world.company;
}

/** A speech line was said (any speaker): the quiet before an exchange or a nudge counts from it. */
export function spoke(world: WorldState): void {
  if (world.company !== undefined) world.company.lastSpeech = world.tick;
}

// ------------------------------------------------------------------------------- own hours

/** A resident's hours today, in minutes of the day (bed may be after midnight, before rise). */
export interface OwnHours {
  /** Minute of the day they go to bed, and the minute they rise. */
  readonly bed: number;
  readonly rise: number;
  readonly early: boolean;
  readonly late: boolean;
  /** Keeping tonight's watch (awake by the fire from the household's bedtime until bed). */
  readonly watch: boolean;
}

/**
 * The night a minute belongs to, by the evening it began on. The game's day turns at the
 * household's day (06:00), so the small hours are still the evening's day; the morning after,
 * until noon, is the night before's (the watch sleeping on).
 */
export function nightOf(day: number, minute: number, dayStart = 6 * 60): number {
  return minute >= dayStart && minute < 12 * 60 ? day - 1 : day;
}

/**
 * Who keeps the night watch on a night (Book 10 nightWatch): one by turns, in order of their
 * names, while enough are at home; never one bed-bound. Null without a watch.
 */
export function watcherOf(
  world: WorldState,
  cc: CompanyContext,
  night: number,
  residents: readonly Id[],
): Id | null {
  const able = [...residents].sort().filter((id) => {
    const p = world.people[id];
    return (
      p !== undefined &&
      p.life.joinedDay !== null &&
      p.life.joinedDay <= night &&
      !p.wounds.some((w) => w.severity === 'GRAVE')
    );
  });
  if (able.length < cc.b.hours.watchFrom) return null;
  return able[((night % able.length) + able.length) % able.length] ?? null;
}

/** A resident's own hours (Book 10 "Own hours"; Book 5 section 17). */
export function ownHours(
  world: WorldState,
  cc: CompanyContext | null,
  p: Person,
  householdBed: number,
  householdDay: number,
): OwnHours {
  if (cc === null)
    return { bed: householdBed, rise: householdDay, early: false, late: false, watch: false };
  const h = cc.def.hours;
  const has = (t: readonly string[]): boolean => p.traits.some((x) => t.includes(x.trait));
  const early = has(h.early);
  const late = has(h.late.traits) || p.likes.some((l) => h.late.likes.includes(l.ref));
  const night = nightOf(world.calendar.day, world.calendar.minuteOfDay, householdDay);
  const watch = watcherOf(world, cc, night, world.household.residents) === p.id;
  const b = cc.b.hours;
  const wrap = (m: number): number => ((m % 1440) + 1440) % 1440;
  if (watch)
    return {
      bed: b.watchUntil,
      rise: wrap(householdDay + b.watchSleepInMinutes),
      early,
      late,
      watch: true,
    };
  return {
    bed: wrap(householdBed + (late ? b.lateFireMinutes : 0)),
    rise: wrap(householdDay - (early ? b.earlyRiseMinutes : 0)),
    early,
    late,
    watch: false,
  };
}

/** Whether a minute of the day falls within [from, to), the span wrapping past midnight. */
export function inSpan(minute: number, from: number, to: number): boolean {
  return from <= to ? minute >= from && minute < to : minute >= from || minute < to;
}

// ------------------------------------------------------------------------------ the aims

/** The aims open and not done now, in order (the first is the journal's current aim). */
export function openAims(world: WorldState, cc: CompanyContext): AimDef[] {
  if (world.facts['ch1.phase'] === undefined) return [];
  return cc.aims.filter(
    (a) => a.opensWhen.every((c) => holds(world, c)) && !a.doneWhen.every((c) => holds(world, c)),
  );
}

/** A speaker's line for an aim (their nudge, and their advice). */
export function aimLine(
  cc: CompanyContext,
  aim: string,
  who: Id,
  world?: WorldState,
): string | null {
  // A later stage of the aim whose conditions hold speaks in its place (DH-164).
  const stage =
    world === undefined
      ? undefined
      : cc.guidance?.stages?.[aim]?.find((s) => s.when.every((c) => holds(world, c)));
  if (stage !== undefined) return stage.nudges[who]?.[0] ?? null;
  return cc.guidance?.nudges[aim]?.[who]?.[0] ?? null;
}

/** Whether someone answers "Ask for advice" (Book 10 adviceTrust): Hild always; the trusted. */
export function isAdvisor(cc: CompanyContext, p: Person): boolean {
  const g = cc.guidance;
  if (g?.advice[p.id] === undefined) return false;
  return g.advisors.always.includes(p.id) || p.friendship >= cc.b.nudge.adviceTrust;
}

/** The advisor's answer: their opening line, then the next aim or two in their words. */
export function adviceLines(world: WorldState, cc: CompanyContext, who: Id): string[] {
  const a = cc.guidance?.advice[who];
  if (a === undefined) return [];
  const lines: string[] = [];
  for (const aim of openAims(world, cc)) {
    if (lines.length >= cc.b.nudge.adviceAims) break;
    const line = aimLine(cc, aim.id, who, world);
    if (line !== null && !lines.includes(line)) lines.push(line);
  }
  return lines.length === 0 ? [a.none] : [a.intro, ...lines];
}

// ------------------------------------------------------------------------------ the boat

/** What the boat needs next (Book 10 "Boat work"): work on what is laid by it, else what to fetch. */
export function boatNeed(world: WorldState): BoatNeed | null {
  const ship = boatOf(world);
  if (ship === null || world.facts['repair.open'] !== true) return null;
  if (world.facts['ch1.launched'] === true) return null;
  const r = ship.repairs;
  const laid = REPAIRS.find((k) => r[k].stage === 'MATERIALS');
  if (laid !== undefined)
    return laid === 'HULL' ? 'HULL_WORK' : laid === 'RIGGING' ? 'RIGGING_WORK' : 'OAR_SHIP';
  const carving =
    world.facts[FACT_CARVING] !== undefined &&
    r.STEERING_OAR.stage === 'LACKING' &&
    world.facts[FACT_OAR] === undefined;
  if (r.HULL.stage === 'LACKING') return 'BOARDS';
  if (r.RIGGING.stage === 'LACKING') return 'RIGGING_FETCH';
  if (r.STEERING_OAR.stage === 'LACKING') return carving ? 'OAR_CARVING' : 'OAR_FETCH';
  if (ship.fitting !== null) return 'FIT';
  return 'READY';
}

/** The line a boat worker says about what the boat needs next, or null. */
export function boatLine(world: WorldState, cc: CompanyContext, who: Id): string | null {
  const need = boatNeed(world);
  return need === null ? null : (cc.def.boat.lines[need]?.[who] ?? null);
}

/**
 * The drawn stage of a repair under way (Book 10 hullStages, riggingStages): 0 as found, then one
 * step for each share of its labour passed; done is the last.
 */
export function drawnStage(progress: number, labour: number, steps: readonly number[]): number {
  if (labour <= 0) return 0;
  const share = progress / labour;
  return steps.filter((s) => share >= s).length;
}

// ------------------------------------------------------------------------------ bindings

/** The refuser written for this person, if their trait makes them refuse (Book 10 careRefusal). */
export function refuserOf(
  cc: CompanyContext,
  p: Person,
): CompanyDef['care']['refusers'][number] | null {
  const r = cc.def.care.refusers.find((x) => x.person === p.id);
  if (r === undefined || !p.traits.some((t) => t.trait === r.trait)) return null;
  return r;
}

/**
 * Whether a binding offered now is refused (Book 10 careRefusal and careLater): the first time it
 * is offered for a wound, and again that day; taken up once persuaded, or asked on a later day.
 * Returns 'REFUSE', 'LATER' (the refusal given up: their own line, then the binding), or null.
 */
export function careAnswer(
  world: WorldState,
  cc: CompanyContext,
  p: Person,
): 'REFUSE' | 'LATER' | null {
  if (refuserOf(cc, p) === null) return null;
  const wound = p.wounds.find((w) => w.tendedDay === undefined);
  if (wound === undefined) return null;
  const cs = companyState(world, cc.b);
  const rec = cs.care[p.id];
  const day = world.calendar.day;
  if (rec?.wound !== wound.day) {
    cs.care[p.id] = { day, wound: wound.day, persuaded: false };
    return 'REFUSE';
  }
  if (rec.persuaded) return null;
  if (day - rec.day >= cc.b.care.laterDays) return 'LATER';
  return 'REFUSE';
}

/** The refuser came round on their own terms (holding the end): no refusal for this wound. */
export function carePersuaded(world: WorldState, cc: CompanyContext, p: Person): void {
  const wound = p.wounds.find((w) => w.tendedDay === undefined);
  if (wound === undefined) return;
  companyState(world, cc.b).care[p.id] = {
    day: world.calendar.day,
    wound: wound.day,
    persuaded: true,
  };
}

// ------------------------------------------------------------------- exchanges and nudges

/** Activities a resident can take part in an exchange from, or be nudged by. */
const AWAKE: ReadonlySet<ActivityKind> = new Set([
  'MEAL',
  'WORK',
  'EVENING',
  'TENDENCY',
  'SIT',
  'REST',
  'REFUSE',
  'DARK',
  'WATCH',
]);

/** What the household's ticks need to know of everyone else (from sim/people/day.ts). */
export interface CompanyView {
  readonly residents: readonly Id[];
  readonly activity: (id: Id) => ActivityKind;
  /** Tiles from the steerer (Infinity out of view). */
  readonly fromSteerer: (id: Id) => number;
  /** Book 10 barkEarshot, barkSameSpeaker, in tiles and real seconds. */
  readonly earshotTiles: number;
  readonly sameSpeakerSeconds: number;
  readonly ticksPerSecond: number;
  /** Says a line in a person's voice (a PERSON_SPOKE, recorded as a bark is). */
  readonly say: (person: Id, key: string, via: 'EXCHANGE' | 'NUDGE') => void;
}

function tilesBetween(world: WorldState, a: Id, b: Id, tile: number): number {
  const onFoot = world.onFoot;
  if (onFoot === null) return Infinity;
  const x = findActor(onFoot, a);
  const y = findActor(onFoot, b);
  if (x === null || x.zone !== y?.zone) return Infinity;
  return Math.hypot(x.actor.x - y.actor.x, x.actor.y - y.actor.y) / tile;
}

/** How particular an exchange is (Book 10 exchangeChoice): events and memories, ties, traits. */
export function particularity(cc: CompanyContext, e: ExchangeDef): number {
  const w = cc.b.exchange.weights;
  return (
    (e.when !== undefined || e.memory !== undefined ? w.event : 0) +
    (e.tie !== undefined ? w.tie : 0) +
    ((e.traits?.length ?? 0) > 0 ? w.trait : 0) +
    (e.activity !== undefined ? w.activity : 0)
  );
}

/** Whether an exchange fits now: its speakers at home, awake, together, heard, and its terms. */
export function exchangeFits(
  world: WorldState,
  cc: CompanyContext,
  e: ExchangeDef,
  view: CompanyView,
  tile: number,
): boolean {
  const people = e.speakers.map((id) => world.people[id]);
  if (people.some((p) => p === undefined || p.life.joinedDay === null)) return false;
  if (!e.speakers.every((id) => view.residents.includes(id))) return false;
  const allowed = e.activity === undefined ? null : new Set<string>(e.activity);
  for (const id of e.speakers) {
    const act = view.activity(id);
    if (!AWAKE.has(act) || (allowed !== null && !allowed.has(act))) return false;
  }
  const [first] = e.speakers;
  if (first === undefined) return false;
  if (e.speakers.some((id) => tilesBetween(world, first, id, tile) > cc.b.exchange.nearTiles))
    return false;
  if (!e.speakers.some((id) => view.fromSteerer(id) <= view.earshotTiles)) return false;
  if (e.tie !== undefined) {
    const [a, b] = people;
    const tied = (x: Person | undefined, y: Person | undefined): boolean =>
      x !== undefined && y !== undefined && x.ties.some((t) => t.to === y.id && t.kind === e.tie);
    if (!tied(a, b) && !tied(b, a)) return false;
  }
  for (const t of e.traits ?? [])
    if (people[t.by]?.traits.some((x) => x.trait === t.trait) !== true) return false;
  if (e.memory !== undefined) {
    const m = e.memory;
    if (people[m.by]?.memories.some((x) => x.kind === m.kind && x.about === m.about) !== true)
      return false;
  }
  return (e.when ?? []).every((c) => holds(world, c));
}

/** The exchange to start now, or null: the least lately heard, then the most particular. */
export function chooseExchange(
  world: WorldState,
  cc: CompanyContext,
  view: CompanyView,
  tile: number,
): ExchangeDef | null {
  const cs = companyState(world, cc.b, view.ticksPerSecond);
  const repeat = cc.b.exchange.repeatSeconds * view.ticksPerSecond;
  // Each speaker's activity and distance, read once for all the exchanges (they only read the
  // world, which nothing changes meanwhile): with none fitting, this runs every tick (DH-161).
  const acts = new Map<Id, ActivityKind>();
  const away = new Map<Id, number>();
  const once: CompanyView = {
    ...view,
    activity: (id) => {
      let a = acts.get(id);
      if (a === undefined) acts.set(id, (a = view.activity(id)));
      return a;
    },
    fromSteerer: (id) => {
      let d = away.get(id);
      if (d === undefined) away.set(id, (d = view.fromSteerer(id)));
      return d;
    },
  };
  const fit = cc.def.exchanges.filter((e) => {
    const last = cs.heard[e.id];
    if (last !== undefined && world.tick - last < repeat) return false;
    return exchangeFits(world, cc, e, once, tile);
  });
  if (fit.length === 0) return null;
  const heardAt = (e: ExchangeDef): number => cs.heard[e.id] ?? NEVER;
  const oldest = Math.min(...fit.map(heardAt));
  const fresh = fit.filter((e) => heardAt(e) === oldest);
  const best = Math.max(...fresh.map((e) => particularity(cc, e)));
  return pick(
    world.rng.people,
    fresh.filter((e) => particularity(cc, e) === best),
  );
}

/**
 * One tick of the household's talk among themselves and its nudges (after the barks). Never in a
 * fight, a scene, a talk, a story beat, or while the steerer sleeps (the hints' quiet).
 */
export function companyTick(
  world: WorldState,
  cc: CompanyContext,
  view: CompanyView,
  tile: number,
): void {
  const tps = view.ticksPerSecond;
  const cs = companyState(world, cc.b, tps);
  const quiet = hintQuiet(world);
  const ex = cs.exchange;
  if (ex !== null) {
    const def = cc.def.exchanges.find((e) => e.id === ex.id);
    const gone =
      def === undefined ||
      quiet ||
      ex.speakers.some((id) => !AWAKE.has(view.activity(id))) ||
      !ex.speakers.some((id) => view.fromSteerer(id) <= view.earshotTiles);
    if (gone) {
      endExchange(world, cc, cs, tps);
      return;
    }
    if (world.tick < ex.at) return;
    const line = def.lines[ex.line];
    const who = line === undefined ? undefined : ex.speakers[line.by];
    if (line === undefined || who === undefined) {
      endExchange(world, cc, cs, tps);
      return;
    }
    view.say(who, line.key, 'EXCHANGE');
    ex.line++;
    ex.at = world.tick + Math.round(cc.b.exchange.lineGapSeconds * tps);
    if (ex.line >= def.lines.length) endExchange(world, cc, cs, tps);
    return;
  }
  if (quiet || world.talk !== null) return;
  if (nudgeTick(world, cc, cs, view)) return;
  if (world.tick < cs.nextExchange) return;
  if (world.tick - cs.lastSpeech < cc.b.exchange.quietSeconds * tps) return;
  const e = chooseExchange(world, cc, view, tile);
  if (e === null) return;
  cs.exchange = { id: e.id, speakers: [...e.speakers], line: 0, at: world.tick };
  cs.heard[e.id] = world.tick;
}

function endExchange(world: WorldState, cc: CompanyContext, cs: CompanyState, tps: number): void {
  cs.exchange = null;
  const [lo, hi] = cc.b.exchange.everySeconds;
  cs.nextExchange = world.tick + nextInt(world.rng.people, lo, hi) * tps;
}

/** Whether an exchange is being spoken (barks wait for it: Book 10 exchangeQuiet). */
export function exchangeUnderWay(world: WorldState): boolean {
  return world.company?.exchange != null;
}

/**
 * A nudge, when one is due (Book 10 "Nudges and advice"): the nearest resident in earshot with a
 * line for the current aim says it; with none, for the next open aim. Returns true if one spoke.
 */
function nudgeTick(
  world: WorldState,
  cc: CompanyContext,
  cs: CompanyState,
  view: CompanyView,
): boolean {
  const tps = view.ticksPerSecond;
  const n = cc.b.nudge;
  const current = world.aims?.current ?? null;
  // A later stage of the aim (DH-164) counts as an aim of its own: its nudges start afresh.
  const stage =
    current === null
      ? -1
      : (cc.guidance?.stages?.[current]?.findIndex((s) => s.when.every((c) => holds(world, c))) ??
        -1);
  const key = current === null || stage < 0 ? current : `${current}#${String(stage)}`;
  if (cs.nudge.aim !== key)
    cs.nudge = { aim: key, opened: world.tick, given: 0, last: cs.nudge.last };
  if (current === null || cs.nudge.given >= n.maxPerAim) return false;
  if (world.tick - cs.nudge.opened < n.firstSeconds * tps) return false;
  if (world.tick - cs.nudge.last < n.everySeconds * tps) return false;
  if (world.tick - cs.lastSpeech < n.quietSeconds * tps) return false;
  if (world.tick - (world.aims?.since ?? 0) < n.afterProgressSeconds * tps) return false;
  const aims = openAims(world, cc);
  const order = [...aims.filter((a) => a.id === current), ...aims.filter((a) => a.id !== current)];
  const same = view.sameSpeakerSeconds * tps;
  for (const aim of order) {
    let best: { id: Id; d: number; key: string } | null = null;
    for (const id of view.residents) {
      const key = aimLine(cc, aim.id, id, world);
      if (key === null || !AWAKE.has(view.activity(id))) continue;
      const d = view.fromSteerer(id);
      if (d > view.earshotTiles) continue;
      const said = world.barks.bySpeaker[id]?.[key];
      if (said !== undefined && world.tick - said < same) continue;
      if (best === null || d < best.d) best = { id, d, key };
    }
    if (best === null) continue;
    view.say(best.id, best.key, 'NUDGE');
    cs.nudge.given++;
    cs.nudge.last = world.tick;
    return true;
  }
  return false;
}

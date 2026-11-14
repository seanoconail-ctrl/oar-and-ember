/**
 * Plotting a course (Book 2 section 09; decision S13-4): the quickest course by known routes from
 * where the boat lies to a place, timed leg by leg with today's weather and tomorrow's forecast,
 * the tide's waits at the Cailleach's Cauldron and winter closure, or a refusal in words. Pure:
 * it reads the world and changes nothing.
 */
import type { Id } from '../../core/ids.ts';
import { isDaylight, isSlack, minutesToSlack, seasonOf } from '../calendar/calendar.ts';
import type { WorldState } from '../world.ts';
import { deriveStats, FLAGSHIP } from '../ship/ship.ts';
import type { ShipStats } from '../ship/ship.ts';
import { otherEnd } from './context.ts';
import type { SeaContext, SeaEdge } from './context.ts';
import { calendarAt, minuteOf } from './state.ts';
import { bearingOf, effectiveSpeed, legMinutes, pointOfSail } from './travel.ts';
import { expectedOn, inWinterClosure } from './weather.ts';
import type { LegPlan, PlotResult, SeaPlan, SeaRefusal } from './types.ts';

export const WATCH_MINUTES = (ctx: Pick<SeaContext, 'time'>): number => ctx.time.watchHours * 60;

/** Whether a route is known: marked known in content, or sailed (`knowledge.routes`). */
export function routeKnown(world: WorldState, edge: SeaEdge): boolean {
  return edge.known || world.knowledge.routes?.[edge.id] === 'KNOWN';
}

/** Whether winter closes an edge on a day: `todayCalm` is the day's (or its forecast's) calm. */
export function closedOn(world: WorldState, edge: SeaEdge, day: number, calm: boolean): boolean {
  if (edge.winter === 'OPEN' || !inWinterClosure(world.sea, day)) return false;
  return edge.winter === 'CLOSED' || !calm;
}

/** Whether passing through `node` from `arrivedBy` onto `next` is a tide gate (the Cauldron). */
export function gateAt(
  ctx: SeaContext,
  node: Id,
  arrivedBy: Id | null,
  next: Id,
): SeaEdge['tideGate'] | null {
  if (arrivedBy === null || arrivedBy === next) return null;
  for (const id of [arrivedBy, next]) {
    const g = ctx.edges.get(id)?.tideGate;
    if (g !== undefined && g.at === node) return g;
  }
  return null;
}

/** The ship's statistics with `crew` aboard (the steerer and residents), or null with no ship. */
export function shipStats(world: WorldState, ctx: SeaContext, crew: number): ShipStats | null {
  const ship = world.ships[FLAGSHIP];
  return ship === undefined ? null : deriveStats(ship, ctx.ship, crew);
}

/** Who sails from home by default: the residents, alive and free. */
export function homeCrew(world: WorldState): Id[] {
  return world.household.residents.filter((id) => {
    const p = world.people[id];
    return p !== undefined && p.status !== 'dead' && p.status !== 'captive';
  });
}

/** The leg along `edge` from `from`, setting out at campaign minute `at`. */
export function planLeg(
  world: WorldState,
  ctx: SeaContext,
  stats: Pick<ShipStats, 'sailSpeed' | 'oarSpeed' | 'closeHauled'>,
  edge: SeaEdge,
  from: Id,
  at: number,
  wait: number,
): LegPlan {
  const to = otherEnd(edge, from);
  const a = ctx.nodes.get(from);
  const z = ctx.nodes.get(to);
  const bearing = a === undefined || z === undefined ? 'N' : bearingOf(a.pos, z.pos);
  const today = world.calendar.day;
  const day = Math.floor((at + wait) / 1440) + 1;
  const w = expectedOn(world.sea, today, day);
  const pos = w === null ? 'CALM' : pointOfSail(bearing, w.windFrom, w.strength);
  const { speed, rowing } = effectiveSpeed(stats, pos, ctx.b);
  return {
    edge: edge.id,
    from,
    to,
    bearing,
    pointOfSail: pos,
    speed,
    rowing,
    minutes: legMinutes(edge.baseWatches, speed, ctx.b, WATCH_MINUTES(ctx)),
    exposure: edge.exposure,
    waitMinutes: wait,
    startsAt: at + wait,
  };
}

interface Label {
  readonly node: Id;
  readonly arrivedBy: Id | null;
  readonly t: number;
  readonly legs: readonly LegPlan[];
}

/**
 * The quickest course by `usable` edges (time-dependent: a leg's speed is the weather of the day
 * it sets out, and passing the Cauldron waits for slack). Null if none reaches `to`.
 */
function search(
  world: WorldState,
  ctx: SeaContext,
  stats: Pick<ShipStats, 'sailSpeed' | 'oarSpeed' | 'closeHauled'>,
  from: Id,
  arrivedBy: Id | null,
  to: Id,
  start: number,
  usable: (edge: SeaEdge, setsOutAt: number) => boolean,
  ignoreSpeed: boolean,
): readonly LegPlan[] | null {
  const best = new Map<string, number>();
  const open: Label[] = [{ node: from, arrivedBy, t: start, legs: [] }];
  const key = (n: Id, e: Id | null): string => `${n}|${e ?? ''}`;
  best.set(key(from, arrivedBy), start);
  while (open.length > 0) {
    open.sort((p, q) => p.t - q.t || p.legs.length - q.legs.length);
    const cur = open.shift();
    if (cur === undefined) break;
    if (cur.node === to && cur.legs.length > 0) return cur.legs;
    if ((best.get(key(cur.node, cur.arrivedBy)) ?? Infinity) < cur.t) continue;
    // A place on the way is passed (only the course's end is landed at); never a loop back.
    for (const edge of ctx.byNode.get(cur.node) ?? []) {
      const next = otherEnd(edge, cur.node);
      if (next === from || cur.legs.some((l) => l.from === next)) continue;
      const gate = gateAt(ctx, cur.node, cur.arrivedBy, edge.id);
      const wait =
        gate === null || gate === undefined
          ? 0
          : minutesToSlack(calendarAt(cur.t, ctx.time), ctx.time, ctx.b.slackWindowMinutes);
      if (!usable(edge, cur.t + wait)) continue;
      const leg = planLeg(world, ctx, stats, edge, cur.node, cur.t, wait);
      const minutes = ignoreSpeed && !Number.isFinite(leg.minutes) ? 1 : leg.minutes;
      if (!Number.isFinite(minutes)) continue;
      const t = cur.t + wait + minutes;
      const k = key(next, edge.id);
      if ((best.get(k) ?? Infinity) <= t) continue;
      best.set(k, t);
      open.push({ node: next, arrivedBy: edge.id, t, legs: [...cur.legs, leg] });
    }
  }
  return null;
}

function refuse(ctx: SeaContext, reason: SeaRefusal, vars: Record<string, string | number> = {}): PlotResult {
  return { ok: false, reason, textKey: ctx.words[reason], vars };
}

/** Where the boat lies now: at its voyage's node, or at home. */
export function boatAt(world: WorldState, ctx: SeaContext): Id {
  return world.sea.voyage?.at ?? ctx.home;
}

/**
 * Plots the quickest known course from where the boat lies to `to`. `crew` is the residents who
 * would sail (the voyage's aboard when at sea; by default the household).
 */
export function plotCourse(
  world: WorldState,
  ctx: SeaContext,
  to: Id,
  crew: readonly Id[] = world.sea.voyage?.aboard ?? homeCrew(world),
): PlotResult {
  const voyage = world.sea.voyage;
  if (voyage !== null && voyage.status !== 'ANCHORED') return refuse(ctx, 'AT_SEA');
  const node = ctx.nodes.get(to);
  if (node === undefined || node.kind !== 'PLACE' || world.knowledge.places[to] === undefined)
    return refuse(ctx, 'UNKNOWN_PLACE');
  const from = boatAt(world, ctx);
  if (to === from) return refuse(ctx, 'HERE');
  if ((ctx.byNode.get(to) ?? []).length === 0) return refuse(ctx, 'INLAND');
  const stats = shipStats(world, ctx, crew.length + 1);
  if (stats === null || !stats.seaworthy || world.facts[ctx.launchedFact] !== true)
    return refuse(ctx, 'NOT_READY');
  const start = minuteOf(world.calendar, ctx.time);
  const arrivedBy = voyage?.arrivedBy ?? null;
  const known = (e: SeaEdge): boolean => routeKnown(world, e);
  if (search(world, ctx, stats, from, arrivedBy, to, start, known, true) === null)
    return refuse(ctx, 'NO_KNOWN_ROUTE');
  const today = world.calendar.day;
  const open = (e: SeaEdge, at: number): boolean => {
    if (!known(e)) return false;
    const day = Math.floor(at / 1440) + 1;
    const w = expectedOn(world.sea, today, day);
    return !closedOn(world, e, day, w?.calm === true && day <= today + 1);
  };
  if (search(world, ctx, stats, from, arrivedBy, to, start, open, true) === null)
    return refuse(ctx, 'WINTER');
  const legs = search(world, ctx, stats, from, arrivedBy, to, start, open, false);
  if (legs === null) return refuse(ctx, 'NO_WAY');
  const last = legs[legs.length - 1];
  const minutes = last === undefined ? 0 : last.startsAt + last.minutes - start;
  const watch = WATCH_MINUTES(ctx);
  // The fixed night (Book 2 section 16): a voyage whose earliest return falls after dusk on the
  // night is refused once the household is warned.
  const back = to === ctx.home ? 0 : minutes;
  for (const g of Object.values(world.gates)) {
    if (g.fixedDay === undefined || g.warnedDay === undefined || g.status === 'PASSED') continue;
    const dusk = ctx.time.daylight[seasonOf(g.fixedDay)].darkFrom;
    const duskAt = minuteOf({ day: g.fixedDay, minuteOfDay: dusk }, ctx.time);
    if (start + minutes + back > duskAt) return refuse(ctx, 'FIXED_NIGHT');
  }
  const landing = ctx.landings.get(to);
  const gate =
    landing?.gate === undefined || world.gates[landing.gate]?.status === 'PASSED'
      ? null
      : landing.gate;
  const plan: SeaPlan = {
    from,
    to,
    legs,
    minutes,
    watches: minutes / watch,
    storesRd: ((crew.length + 1) * ctx.b.storesPerPersonPerWatch * minutes) / watch,
    plottedAt: start,
    gate,
  };
  return { ok: true, plan };
}

/** Whether it is slack water now (the Cauldron's gate), by Book 10's slackWindow. */
export function slackNow(world: WorldState, ctx: SeaContext): boolean {
  return isSlack(world.calendar, ctx.time, ctx.b.slackWindowMinutes);
}

/** Whether it is light now (for the screen's night visibility). */
export function lightNow(world: WorldState, ctx: SeaContext): boolean {
  return isDaylight(world.calendar, ctx.time);
}

/**
 * The voyage (Book 2 section 09; Stage 13): setting out, per-watch resolution, holds, the sea
 * map's choice, encounters, arrival, discovery, stores and coming home. Everything is decided by
 * the world state and its streams (`weather`, `encounters`), so the same seed and commands give
 * the same voyage.
 *
 * A step (`resolveWatch`) lasts at most one watch and stops at a node, an encounter or a hold's
 * end. The time is passed by the caller's `advance` hook, which runs the home's low-detail away
 * step (decision S13-13); the step itself is cheap (Book 2 section 22: under 2 ms).
 */
import type { Id } from '../../core/ids.ts';
import { seasonOf } from '../calendar/calendar.ts';
import { setFact } from '../ledger/ledger.ts';
import type { WorldState } from '../world.ts';
import { FLAGSHIP } from '../ship/ship.ts';
import { otherEnd } from './context.ts';
import type { SeaContext, SeaEdge } from './context.ts';
import { governorVoyage, offerLeg, onceKey } from './encounters.ts';
import {
  closedOn,
  gateAt,
  homeCrew,
  plotCourse,
  planLeg,
  shipStats,
  WATCH_MINUTES,
} from './plot.ts';
import { calendarAt, minuteOf } from './state.ts';
import { minutesToSlack } from '../calendar/calendar.ts';
import {
  ensureWeather,
  forecastTomorrow,
  isStormDay,
  visibilityNow,
  weatherOn,
  weatherToday,
} from './weather.ts';
import type {
  ActiveLeg,
  HandoffResult,
  SeaEvent,
  SeaOption,
  SeaRefusal,
  VoyageState,
} from './types.ts';

/** The stores a ship carries and eats, by RES_ id, in the order they are loaded and eaten. */
export const SEA_STORES = ['RES_SALTED_FISH', 'RES_GRAIN'] as const;

/** What a voyage asks of the simulation. */
export interface VoyageHooks {
  /** Pass game minutes (the home's away step runs through them). */
  readonly advance: (minutes: number) => void;
  readonly emit: (e: SeaEvent) => void;
  /** A story gate started by setting out (the Carrick raid): its events and checkpoint. */
  readonly gateStarted?: (gate: Id, checkpoint: string | null) => void;
  /** Back home: the home's scene is back; set the crew down by the boat. */
  readonly home?: (aboard: readonly Id[]) => void;
}

/** The household's forecast accuracy: Book 10's, or the flagship's weather-vane. */
export function forecastAccuracy(world: WorldState, ctx: SeaContext): number {
  const crew = world.sea.voyage === null ? 1 : world.sea.voyage.aboard.length + 1;
  return shipStats(world, ctx, crew)?.forecast ?? ctx.b.forecastAccuracy;
}

/** Draws the weather up to tomorrow (the day's start draws it; any sea command makes sure). */
export function seaWeather(world: WorldState, ctx: SeaContext): void {
  ensureWeather(world, ctx.b, forecastAccuracy(world, ctx));
}

function refusal(ctx: SeaContext, hooks: VoyageHooks, reason: SeaRefusal): SeaRefusal {
  hooks.emit({ type: 'SEA_REFUSED', reason, textKey: ctx.words[reason], vars: {} });
  return reason;
}

function storesTotal(stores: Readonly<Record<string, number>>): number {
  return SEA_STORES.reduce((s, k) => s + (stores[k] ?? 0), 0);
}

/** The voyage's stores in ration-days. */
export function storesRd(v: Pick<VoyageState, 'stores'>): number {
  return storesTotal(v.stores);
}

/** The ration-days a ship takes aboard for `mouths`: its hull's days and its fittings' days. */
export function storesCapacity(world: WorldState, ctx: SeaContext, mouths: number): number {
  const ship = world.ships[FLAGSHIP];
  const row = ship === undefined ? undefined : ctx.ship.hulls.get(ship.hull)?.balanceRow;
  const days =
    (row === undefined ? 0 : (ctx.b.storesDays.get(row) ?? 0)) +
    (shipStats(world, ctx, mouths)?.storesDays ?? 0);
  const perDay = ctx.b.storesPerPersonPerWatch * (1440 / WATCH_MINUTES(ctx));
  return days * mouths * perDay;
}

/** Every leg's weather filter for encounters. */
function whenNow(world: WorldState, ctx: SeaContext) {
  const deeds = new Set(world.ledger.map((d) => d.tag));
  const chapter =
    Object.entries(world.chapters).find(([, c]) => c.status === 'ACTIVE')?.[0] ?? null;
  return {
    season: seasonOf(world.calendar.day),
    chapter,
    strength: weatherToday(world)?.strength ?? 0,
    visibility: visibilityNow(world, ctx.time),
    facts: world.facts,
    deeds,
    once: world.sea.once,
  };
}

/**
 * Sets sail on the plotted course. From home: the crew goes aboard (by default the household),
 * the stores are loaded from the home's salt fish and grain, the home's on-foot scene is kept and
 * the steerer leaves it, and a course to a landing with a gate starts the gate. From an anchorage:
 * the voyage goes on by the new course.
 */
export function depart(
  world: WorldState,
  ctx: SeaContext,
  hooks: VoyageHooks,
  crew?: readonly Id[],
): SeaRefusal | null {
  seaWeather(world, ctx);
  const sea = world.sea;
  const voyage = sea.voyage;
  if (voyage !== null && voyage.status !== 'ANCHORED') return refusal(ctx, hooks, 'AT_SEA');
  if (sea.plan === null) return refusal(ctx, hooks, 'NO_PLAN');
  // The course is plotted again now, so it is never stale.
  const aboard = voyage?.aboard ?? [...(crew ?? homeCrew(world))];
  const plot = plotCourse(world, ctx, sea.plan.to, aboard);
  if (!plot.ok) {
    hooks.emit({
      type: 'SEA_REFUSED',
      reason: plot.reason,
      textKey: plot.textKey,
      vars: plot.vars,
    });
    return plot.reason;
  }
  const plan = plot.plan;
  const ship = world.ships[FLAGSHIP];
  if (ship === undefined) return refusal(ctx, hooks, 'NOT_READY');
  governorVoyage(sea.governor, ctx.b);
  let v: VoyageState;
  if (voyage === null) {
    for (const id of aboard)
      if (!world.household.residents.includes(id)) return refusal(ctx, hooks, 'NO_CREW');
    // The stores: Book 10's days for everyone aboard, from the home's salt fish, then its grain.
    const mouths = aboard.length + 1;
    let want = storesCapacity(world, ctx, mouths);
    const stores: Record<string, number> = {};
    const home = world.homes[ctx.home];
    for (const k of SEA_STORES) {
      const have = home?.stores[k] ?? 0;
      const take = Math.min(have, want);
      if (take > 0 && home !== undefined) {
        home.stores[k] = have - take;
        stores[k] = take;
        want -= take;
      }
    }
    sea.stash = world.onFoot;
    world.onFoot = null;
    ship.aboard = [...aboard];
    v = {
      id: sea.governor.voyages,
      from: plan.from,
      to: plan.to,
      at: plan.from,
      arrivedBy: null,
      route: plan.legs.map((l) => l.edge),
      leg: null,
      status: 'SAILING',
      hold: null,
      choice: null,
      pressed: [],
      handoff: null,
      aboard: [...aboard],
      stores,
      shortWatches: 0,
      shortRd: 0,
      minutes: 0,
      legs: 0,
      met: [],
      gate: null,
    };
    sea.voyage = v;
  } else {
    v = voyage;
    v.to = plan.to;
    v.route = plan.legs.map((l) => l.edge);
    v.status = 'SAILING';
    v.pressed = [];
  }
  sea.plan = null;
  if (plan.gate !== null) {
    const g = (world.gates[plan.gate] ??= { status: 'OPEN', pressureSteps: 0, retriesUsed: 0 });
    if (g.status === 'CLOSED' || g.status === 'OPEN') {
      g.status = 'STARTED';
      g.startedDay = world.calendar.day;
      v.gate = plan.gate;
      hooks.gateStarted?.(plan.gate, ctx.landings.get(plan.to)?.checkpoint ?? null);
    }
  }
  hooks.emit({
    type: 'SEA_DEPARTED',
    voyage: v.id,
    from: plan.from,
    to: plan.to,
    autosave: 'DEPARTURE',
  });
  return null;
}

/** Passes `minutes` at sea: the time, the stores, storm damage and wear. */
function sail(
  world: WorldState,
  ctx: SeaContext,
  hooks: VoyageHooks,
  v: VoyageState,
  minutes: number,
  leg: ActiveLeg | null,
): boolean {
  if (minutes <= 0) return false;
  const watch = WATCH_MINUTES(ctx);
  const share = minutes / watch;
  const day = world.calendar.day;
  const storm = isStormDay(world.sea, ctx.b, day);
  const strength = weatherOn(world.sea, day)?.strength ?? 0;
  hooks.advance(minutes);
  v.minutes += minutes;
  // Stores: everyone aboard eats Book 10's ration per watch; never below zero, a shortage said.
  const need = (v.aboard.length + 1) * ctx.b.storesPerPersonPerWatch * share;
  let left = need;
  for (const k of SEA_STORES) {
    const have = v.stores[k] ?? 0;
    const take = Math.min(have, left);
    if (take > 0) {
      v.stores[k] = have - take;
      left -= take;
    }
  }
  if (left > 1e-9) {
    v.shortWatches++;
    v.shortRd += left;
    hooks.emit({ type: 'SEA_STORES_SHORT', textKey: ctx.words.STORES_SHORT, shortRd: left });
  } else world.player.condition.lastMealAt = minuteOf(world.calendar, ctx.time);
  const ship = world.ships[FLAGSHIP];
  if (ship !== undefined) {
    ship.wear += ctx.b.wearPerWatch * share;
    if (storm && leg !== null) {
      const stats = shipStats(world, ctx, v.aboard.length + 1);
      const sea = stats?.seaworthiness ?? 1;
      const fitted = 1 + (stats?.stormDamagePercent ?? 0) / 100;
      const fierce = leg.ransReach ? ctx.b.fiercerStorms : 1;
      const damage =
        ((ctx.b.stormDamagePerStrength * strength * leg.exposure) / sea) * fitted * fierce * share;
      // Stage 13 does not sink a ship (decision S13-18): integrity stops at 1.
      ship.integrity = Math.max(1, ship.integrity - damage);
      hooks.emit({ type: 'SEA_STORM_DAMAGE', textKey: ctx.words.STORM, integrity: ship.integrity });
    }
  }
  return storm;
}

function knowRoute(
  world: WorldState,
  hooks: VoyageHooks,
  edge: Id,
  known: 'RUMOURED' | 'KNOWN',
): void {
  const routes = world.knowledge.routes;
  if (routes[edge] === 'KNOWN' || routes[edge] === known) return;
  routes[edge] = known;
  hooks.emit({ type: 'SEA_ROUTE_KNOWN', edge, known });
}

/** Arrived at a node: discovery, then the course's end, a tide gate to pass, or the next leg. */
function arrive(
  world: WorldState,
  ctx: SeaContext,
  hooks: VoyageHooks,
  v: VoyageState,
  edge: SeaEdge,
  node: Id,
): void {
  knowRoute(world, hooks, edge.id, 'KNOWN');
  v.at = node;
  v.arrivedBy = edge.id;
  v.leg = null;
  v.legs++;
  v.route = v.route.slice(1);
  const isPlace = ctx.nodes.get(node)?.kind === 'PLACE';
  if (isPlace) {
    world.knowledge.places[node] = 'KNOWN';
    // Experience: the routes on from a place are heard of there, and where they lead.
    for (const e of ctx.byNode.get(node) ?? []) {
      if (!e.known && world.knowledge.routes[e.id] === undefined)
        knowRoute(world, hooks, e.id, 'RUMOURED');
      const far = otherEnd(e, node);
      if (ctx.nodes.get(far)?.kind === 'PLACE') world.knowledge.places[far] ??= 'RUMOURED';
    }
  }
  const end = v.route.length === 0;
  const landing = end ? ctx.landings.get(node) : undefined;
  hooks.emit({
    type: 'SEA_ARRIVED',
    node,
    place: isPlace,
    textKey: !end
      ? null
      : node === ctx.home
        ? ctx.words.HOME
        : (landing?.textKey ?? ctx.words.ARRIVED),
  });
  if (end) {
    if (node === ctx.home) {
      comeHome(world, ctx, hooks, v);
      return;
    }
    if (landing !== undefined) {
      v.status = 'HANDOFF';
      v.handoff = {
        kind: 'ON_FOOT',
        scenarioId: landing.scenario,
        placeId: node,
        edgeId: edge.id,
        landing: true,
        stubUntilStage: landing.stubUntilStage ?? null,
      };
      hooks.emit({ type: 'SEA_HANDOFF', handoff: v.handoff });
      return;
    }
    v.status = 'ANCHORED';
    return;
  }
  holdForTide(world, ctx, hooks, v);
}

/** At a hazard to pass through with a tide gate: hold off until slack water. */
function holdForTide(world: WorldState, ctx: SeaContext, hooks: VoyageHooks, v: VoyageState): void {
  const next = v.route[0];
  if (next === undefined) return;
  const gate = gateAt(ctx, v.at, v.arrivedBy, next);
  if (gate === null || gate === undefined) return;
  const wait = minutesToSlack(world.calendar, ctx.time, ctx.b.slackWindowMinutes);
  if (wait <= 0) return;
  const until = minuteOf(world.calendar, ctx.time) + wait;
  v.status = 'HELD';
  v.hold = { reason: 'TIDE', until, textKey: ctx.words.HOLD_TIDE };
  hooks.emit({ type: 'SEA_HELD', reason: 'TIDE', textKey: ctx.words.HOLD_TIDE, until });
}

/** Home: the stores come back, the home's scene is back, the crew is set down. */
function comeHome(world: WorldState, ctx: SeaContext, hooks: VoyageHooks, v: VoyageState): void {
  const home = world.homes[ctx.home];
  const back = storesTotal(v.stores);
  if (home !== undefined)
    for (const k of SEA_STORES) home.stores[k] = (home.stores[k] ?? 0) + (v.stores[k] ?? 0);
  const ship = world.ships[FLAGSHIP];
  if (ship !== undefined) ship.aboard = [];
  world.onFoot = world.sea.stash;
  world.sea.stash = null;
  world.sea.voyage = null;
  hooks.home?.(v.aboard);
  hooks.emit({ type: 'SEA_HOME', textKey: ctx.words.HOME, storesBack: back });
}

/** Whether the rising-weather choice is due before `edge` (decision S13-10). */
function rising(world: WorldState, ctx: SeaContext, edge: SeaEdge, v: VoyageState): boolean {
  if (edge.exposure < ctx.b.choiceExposure || v.pressed.includes(edge.id)) return false;
  const now = weatherToday(world)?.strength ?? 0;
  const tomorrow = forecastTomorrow(world)?.strength ?? 0;
  return Math.max(now, tomorrow) >= ctx.b.risingStrength;
}

/** The campaign minute of the next `minuteOfDay` after now. */
function nextClock(world: WorldState, ctx: SeaContext, minuteOfDay: number): number {
  const now = minuteOf(world.calendar, ctx.time);
  const into = (minuteOfDay - ctx.time.dayStart + 1440) % 1440;
  const dayStart = now - (now % 1440);
  const at = dayStart + into;
  return at > now ? at : at + 1440;
}

/** Starts the next leg of the course, or holds, or asks the choice. Returns whether it started. */
function startLeg(world: WorldState, ctx: SeaContext, hooks: VoyageHooks, v: VoyageState): boolean {
  const id = v.route[0];
  const edge = id === undefined ? undefined : ctx.edges.get(id);
  if (edge === undefined) return false;
  const today = weatherToday(world);
  if (closedOn(world, edge, world.calendar.day, today?.calm === true)) {
    v.status = 'HELD';
    v.hold = { reason: 'WINTER', until: null, textKey: ctx.words.HOLD_WINTER };
    hooks.emit({ type: 'SEA_HELD', reason: 'WINTER', textKey: ctx.words.HOLD_WINTER, until: null });
    return false;
  }
  if (rising(world, ctx, edge, v)) {
    v.status = 'CHOICE';
    v.choice = {
      kind: 'WEATHER_RISING',
      edge: edge.id,
      textKey: ctx.words.CHOICE_RISING,
      options: [
        { option: 'PRESS_ON', textKey: ctx.words.PRESS_ON },
        { option: 'SHELTER', textKey: ctx.words.SHELTER },
      ],
    };
    hooks.emit({ type: 'SEA_CHOICE', choice: v.choice });
    return false;
  }
  const stats = shipStats(world, ctx, v.aboard.length + 1);
  if (stats === null) return false;
  const now = minuteOf(world.calendar, ctx.time);
  const plan = planLeg(world, ctx, stats, edge, v.at, now, 0);
  if (!Number.isFinite(plan.minutes)) return false;
  const encounter = offerLeg(
    world.sea.governor,
    world.rng.encounters,
    ctx.b,
    edge,
    ctx.tables.get(edge.encounterTable) ?? [],
    whenNow(world, ctx),
  );
  v.leg = {
    edge: edge.id,
    from: v.at,
    to: otherEnd(edge, v.at),
    bearing: plan.bearing,
    pointOfSail: plan.pointOfSail,
    speed: plan.speed,
    rowing: plan.rowing,
    exposure: edge.exposure,
    minutes: plan.minutes,
    done: 0,
    encounter,
    encounterAt: encounter === null ? null : Math.floor(plan.minutes / 2),
    fired: false,
    ransReach: edge.hazards.includes('HAZ_RANSREACH'),
  };
  hooks.emit({
    type: 'SEA_LEG_STARTED',
    edge: edge.id,
    pointOfSail: plan.pointOfSail,
    speed: plan.speed,
    minutes: plan.minutes,
  });
  return true;
}

/**
 * Resolves one watch at sea (Book 2 section 09): at most one watch, stopping at a node, an
 * encounter or a hold's end. Refused while the voyage waits on a choice or a handoff.
 */
export function resolveWatch(
  world: WorldState,
  ctx: SeaContext,
  hooks: VoyageHooks,
): SeaRefusal | null {
  const v = world.sea.voyage;
  if (v === null) return refusal(ctx, hooks, 'NOT_AT_SEA');
  seaWeather(world, ctx);
  if (v.status === 'CHOICE' || v.status === 'HANDOFF') return refusal(ctx, hooks, 'BUSY');
  if (v.status === 'ANCHORED') return refusal(ctx, hooks, 'NO_PLAN');
  const watch = WATCH_MINUTES(ctx);
  const now = minuteOf(world.calendar, ctx.time);
  if (v.status === 'HELD' && v.hold !== null) {
    const hold = v.hold;
    // Winter: tested again as the hold's watch begins; open now, the leg starts.
    if (hold.reason === 'WINTER') {
      const edge = ctx.edges.get(v.route[0] ?? '');
      const calm = weatherToday(world)?.calm === true;
      if (edge !== undefined && !closedOn(world, edge, world.calendar.day, calm)) {
        v.status = 'SAILING';
        v.hold = null;
      } else {
        const dawn = nextClock(world, ctx, ctx.time.dayStart);
        const wait = Math.min(watch, dawn - now);
        sail(world, ctx, hooks, v, wait, null);
        hooks.emit({ type: 'SEA_WATCH', minutes: wait, edge: null, done: 0, of: 0, storm: false });
        return null;
      }
    } else {
      const until = hold.until ?? now;
      const wait = Math.min(watch, Math.max(0, until - now));
      const storm = sail(world, ctx, hooks, v, wait, null);
      hooks.emit({ type: 'SEA_WATCH', minutes: wait, edge: null, done: 0, of: 0, storm });
      if (minuteOf(world.calendar, ctx.time) >= until) {
        v.status = 'SAILING';
        v.hold = null;
      }
      return null;
    }
  }
  if (v.leg === null && !startLeg(world, ctx, hooks, v)) {
    // Held, asked, or unable to move: a boat that cannot move drifts a watch.
    if (v.status === 'SAILING') {
      sail(world, ctx, hooks, v, watch, null);
      hooks.emit({ type: 'SEA_WATCH', minutes: watch, edge: null, done: 0, of: 0, storm: false });
      return refusal(ctx, hooks, 'NO_WAY');
    }
    return null;
  }
  const leg = v.leg;
  if (leg === null) return null;
  const toEvent =
    leg.encounter !== null && !leg.fired && leg.encounterAt !== null
      ? leg.encounterAt - leg.done
      : Infinity;
  const step = Math.max(0, Math.min(watch, leg.minutes - leg.done, toEvent));
  const storm = sail(world, ctx, hooks, v, step, leg);
  leg.done += step;
  hooks.emit({
    type: 'SEA_WATCH',
    minutes: step,
    edge: leg.edge,
    done: leg.done,
    of: leg.minutes,
    storm,
  });
  if (
    leg.encounter !== null &&
    !leg.fired &&
    leg.encounterAt !== null &&
    leg.done >= leg.encounterAt
  ) {
    leg.fired = true;
    const enc = leg.encounter;
    const key = onceKey(enc.table, enc.key);
    v.met.push(key);
    const entry = ctx.tables.get(enc.table)?.find((e) => e.key === enc.key);
    if (entry?.oneShot === true) world.sea.once[key] = world.calendar.day;
    hooks.emit({ type: 'SEA_ENCOUNTER', encounter: enc, edge: leg.edge });
    if (enc.scene !== null) {
      v.status = 'HANDOFF';
      v.handoff = {
        kind: enc.scene.kind,
        scenarioId: enc.scene.scenario,
        placeId: null,
        edgeId: leg.edge,
        landing: false,
        stubUntilStage: null,
      };
      hooks.emit({ type: 'SEA_HANDOFF', handoff: v.handoff });
      return null;
    }
  }
  if (leg.done >= leg.minutes) {
    const edge = ctx.edges.get(leg.edge);
    if (edge !== undefined) arrive(world, ctx, hooks, v, edge, leg.to);
  }
  return null;
}

/** The sea map's choice answered: press on (the leg starts at the next watch), or shelter. */
export function choose(
  world: WorldState,
  ctx: SeaContext,
  hooks: VoyageHooks,
  option: SeaOption,
): SeaRefusal | null {
  const v = world.sea.voyage;
  if (v === null) return refusal(ctx, hooks, 'NOT_AT_SEA');
  if (v.status !== 'CHOICE' || v.choice === null) return refusal(ctx, hooks, 'BUSY');
  const edge = v.choice.edge;
  v.choice = null;
  hooks.emit({ type: 'SEA_CHOSEN', option });
  if (option === 'PRESS_ON') {
    v.pressed.push(edge);
    v.status = 'SAILING';
    return null;
  }
  const until = nextClock(world, ctx, ctx.b.shelterUntil);
  v.status = 'HELD';
  v.hold = { reason: 'SHELTER', until, textKey: ctx.words.HOLD_SHELTER };
  hooks.emit({ type: 'SEA_HELD', reason: 'SHELTER', textKey: ctx.words.HOLD_SHELTER, until });
  return null;
}

/** Turn for home from a node (a place, an anchorage, a hold or the choice). */
export function turnBack(
  world: WorldState,
  ctx: SeaContext,
  hooks: VoyageHooks,
): SeaRefusal | null {
  const v = world.sea.voyage;
  if (v === null) return refusal(ctx, hooks, 'NOT_AT_SEA');
  if (v.leg !== null || v.status === 'HANDOFF') return refusal(ctx, hooks, 'BUSY');
  if (v.at === ctx.home) {
    comeHome(world, ctx, hooks, v);
    return null;
  }
  // Plotted from where the boat lies, as if anchored there.
  const status = v.status;
  v.status = 'ANCHORED';
  const plot = plotCourse(world, ctx, ctx.home, v.aboard);
  if (!plot.ok) {
    v.status = status;
    hooks.emit({
      type: 'SEA_REFUSED',
      reason: plot.reason,
      textKey: plot.textKey,
      vars: plot.vars,
    });
    return plot.reason;
  }
  v.to = ctx.home;
  v.route = plot.plan.legs.map((l) => l.edge);
  v.status = 'SAILING';
  v.hold = null;
  v.choice = null;
  return null;
}

/** The scene handed back: its facts, who came aboard or left, the stores, and on or home. */
export function returnFromHandoff(
  world: WorldState,
  ctx: SeaContext,
  hooks: VoyageHooks,
  result: HandoffResult,
): SeaRefusal | null {
  const v = world.sea.voyage;
  if (v === null) return refusal(ctx, hooks, 'NOT_AT_SEA');
  if (v.status !== 'HANDOFF' || v.handoff === null) return refusal(ctx, hooks, 'BUSY');
  const landing = v.handoff.landing;
  for (const [k, value] of Object.entries(result.facts)) setFact(world, k, value);
  v.aboard = v.aboard.filter((id) => !result.aboardChanges.leave.includes(id));
  for (const id of result.aboardChanges.join) if (!v.aboard.includes(id)) v.aboard.push(id);
  const ship = world.ships[FLAGSHIP];
  if (ship !== undefined) ship.aboard = [...v.aboard];
  // The stores change by the scene's ration-days: added as salt fish, taken in eating order.
  if (result.storesDelta > 0)
    v.stores['RES_SALTED_FISH'] = (v.stores['RES_SALTED_FISH'] ?? 0) + result.storesDelta;
  else {
    let take = -result.storesDelta;
    for (const k of SEA_STORES) {
      const have = v.stores[k] ?? 0;
      const t = Math.min(have, take);
      v.stores[k] = have - t;
      take -= t;
    }
  }
  v.handoff = null;
  hooks.emit({ type: 'SEA_HANDOFF_RETURNED', outcome: result.outcome });
  if (result.outcome === 'TURN_BACK') {
    if (v.leg !== null) {
      // Turned back mid-leg: back over what was sailed of it, then home from where it began.
      const leg = v.leg;
      v.leg = {
        ...leg,
        from: leg.to,
        to: leg.from,
        minutes: leg.done,
        done: 0,
        encounter: null,
        encounterAt: null,
      };
      v.to = ctx.home;
      v.route = [leg.edge];
      if (leg.from !== ctx.home) {
        const [at, by] = [v.at, v.arrivedBy];
        v.at = leg.from;
        v.arrivedBy = leg.edge;
        v.status = 'ANCHORED';
        const plot = plotCourse(world, ctx, ctx.home, v.aboard);
        [v.at, v.arrivedBy] = [at, by];
        if (plot.ok) v.route = [leg.edge, ...plot.plan.legs.map((l) => l.edge)];
      }
      v.status = 'SAILING';
      return null;
    }
    v.status = 'ANCHORED';
    return turnBack(world, ctx, hooks);
  }
  v.status = landing || (v.leg === null && v.route.length === 0) ? 'ANCHORED' : 'SAILING';
  return null;
}

/** Calendar of a campaign minute (re-exported for the screen). */
export { calendarAt };

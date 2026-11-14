/**
 * Stage 14, work package C: what the island's puzzles, collectibles, resource nodes and side aims
 * read of the world (Book 2 section 10: puzzles are state machines over world conditions: tide,
 * time, season, objects and words). Pure and deterministic: every condition reads the world and
 * the calendar, never a random stream and never the screen.
 */
import type { Season, TimeBalance } from '../../content/balance.ts';
import { SEASONS } from '../../content/balance.ts';
import type { FindsDef } from '../../content/findsSchema.ts';
import type { IslandBalance } from '../../content/islandBalance.ts';
import type {
  CollectibleDef,
  IslandCondition,
  IslandDef,
  PuzzlesDef,
} from '../../content/islandSchema.ts';
import { marksOf } from '../../content/traverseMarks.ts';
import type { Id } from '../../core/ids.ts';
import {
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  seasonDay,
  seasonOf,
  tideAt,
  watchOf,
  yearOf,
} from '../calendar/calendar.ts';
import { weatherToday } from '../sea/weather.ts';
import type { WorldState } from '../world.ts';
import type { ZoneMap } from './zoneMap.ts';

/** Everything the island's systems read, built once from content and balance.json. */
export interface IslandContext {
  readonly b: TimeBalance;
  readonly ib: IslandBalance;
  readonly puzzles: PuzzlesDef;
  readonly island: IslandDef;
  readonly collectibles: readonly CollectibleDef[];
  readonly finds: FindsDef | null;
  readonly maps: ReadonlyMap<Id, ZoneMap>;
  /** The island's region (RegionState) the scenes belong to. */
  readonly region: Id;
  /** Book 10 barkEarshot, in tiles: who hears a side aim given or a hint. */
  readonly earshotTiles: number;
  /** Book 10 stuckFirst and stuckSecond, in game minutes in the side aim's scene. */
  readonly stuck: { readonly firstMinutes: number; readonly secondMinutes: number };
}

/** The island's region state (created if absent, as the driftwood's is). */
export function regionOf(world: WorldState, ctx: Pick<IslandContext, 'region'>) {
  return (world.regions[ctx.region] ??= {
    discoveredZones: [],
    resourceNodes: {},
    puzzles: {},
  });
}

const truthy = (v: unknown): boolean => v !== undefined && v !== false && v !== null && v !== '';

/** Day of the year, 1 to 120. */
export const dayOfYear = (day: number): number => ((day - 1) % DAYS_PER_YEAR) + 1;

/**
 * Which spring tides a day falls in (Book 10 springTideDays: the days of each season run in
 * groups, 1 to 3 and 16 to 18): "<year>:<season>:<group>", or null on any other day.
 */
export function springTidesOf(day: number, b: TimeBalance): string | null {
  const sd = seasonDay(day);
  const days = [...b.tide.springTideDays].sort((x, y) => x - y);
  if (!days.includes(sd)) return null;
  let group = 0;
  for (let i = 1; i < days.length && (days[i] ?? 0) <= sd; i++)
    if ((days[i] ?? 0) !== (days[i - 1] ?? 0) + 1) group++;
  const season = Math.floor(((day - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
  return `${yearOf(day)}:${season}:${group}`;
}

/** The deep passage now (Book 9 section 16; Book 10 "Deep passage"). */
export type PassageState = 'OPEN' | 'FLOODING' | 'CLOSED';

export interface PassageWater {
  readonly state: PassageState;
  /** The lowest point (`v`): waist deep while open, deep from the window's close. */
  readonly lowest: 'WAIST' | 'DEEP';
  /** The knee-deep pool (`k`): knee, then waist, then deep as the window closes. */
  readonly pool: 'KNEE' | 'WAIST' | 'DEEP';
  /** The banks and floor: dry while open and for floorCloses after the window's close. */
  readonly floorOpen: boolean;
  /** Game minutes since the window closed (negative while it is open; null on other days). */
  readonly sinceClose: number | null;
}

/**
 * The deep passage's water by the tide (decision S14-9): open only on a spring-tide day inside the
 * tidal ground window; at the window's close the lowest point goes deep first, the pool rises to
 * waist at poolWaistAfter and deep at poolDeepAfter, and the banks and floor close last, at
 * floorClosesAfter. Before the window opens and once the floor has closed, it is under the sea.
 */
export function passageWater(
  cal: WorldState['calendar'],
  b: TimeBalance,
  ib: Pick<IslandBalance, 'passage'>,
): PassageWater {
  const tide = tideAt(cal, b);
  const half = b.tide.tidalGroundWindowMinutes / 2;
  const closed: PassageWater = {
    state: 'CLOSED',
    lowest: 'DEEP',
    pool: 'DEEP',
    floorOpen: false,
    sinceClose: null,
  };
  if (!tide.springTide) return closed;
  if (tide.tidalGroundOpen)
    return {
      state: 'OPEN',
      lowest: 'WAIST',
      pool: 'KNEE',
      floorOpen: true,
      sinceClose: tide.minutesSinceLowWater - half,
    };
  const since = tide.minutesSinceLowWater - half;
  const p = ib.passage;
  if (since < 0 || since >= p.floorClosesAfter) return { ...closed, sinceClose: since };
  return {
    state: 'FLOODING',
    lowest: 'DEEP',
    pool: since >= p.poolDeepAfter ? 'DEEP' : since >= p.poolWaistAfter ? 'WAIST' : 'KNEE',
    floorOpen: true,
    sinceClose: since,
  };
}

/** Whether this morning is a festival morning within alignmentWindow of first light. */
export function festivalDawn(world: WorldState, ctx: Pick<IslandContext, 'b' | 'ib'>): boolean {
  const cal = world.calendar;
  // Year 1's festival mornings (Book 10 "Grey Men alignment"); Imbolc joins them from Year 2,
  // with the first winter's stage (flagged, decision S14-76).
  if (!ctx.ib.alignment.mornings.includes(dayOfYear(cal.day))) return false;
  const first = ctx.b.daylight[seasonOf(cal.day)].lightFrom;
  return cal.minuteOfDay >= first && cal.minuteOfDay < first + ctx.ib.alignment.windowMinutes;
}

/** Where a heavy object lies now, and its line's start (src/sim/land/traverse.ts keeps it). */
export function pushedMoved(
  world: WorldState,
  maps: ReadonlyMap<Id, ZoneMap>,
  zone: Id,
  id: string,
): boolean {
  const map = maps.get(zone);
  const mark = map === undefined ? undefined : marksOf(map).pushes.find((m) => m.id === id);
  const start = mark?.line[mark.start];
  for (const r of Object.values(world.regions)) {
    const at = r.pushed?.[`${zone}/${id}`];
    if (at === undefined) continue;
    return at.x !== start?.[0] || at.y !== start[1];
  }
  return false;
}

/** The island's collectibles found, in the order found. */
export function collectedList(
  world: WorldState,
  ctx: Pick<IslandContext, 'region'>,
): readonly string[] {
  return world.regions[ctx.region]?.collected ?? [];
}

/** How many loads a node has given since its count was last reset (a peat bank's season). */
export function nodeTaken(
  world: WorldState,
  ctx: Pick<IslandContext, 'region'>,
  key: string,
): number {
  return world.regions[ctx.region]?.resourceNodes[key]?.taken ?? 0;
}

/** Someone near a point of a scene: the steerer, or (ANYONE) the steerer or a person there. */
function someoneNear(
  world: WorldState,
  maps: ReadonlyMap<Id, ZoneMap>,
  n: { readonly zone: string; readonly x: number; readonly y: number; readonly r: number },
  anyone: boolean,
): boolean {
  const onFoot = world.onFoot;
  if (onFoot?.zone !== n.zone) return false;
  const t = maps.get(n.zone)?.tile ?? 24;
  const close = (x: number, y: number): boolean => Math.hypot(x / t - n.x, y / t - n.y) <= n.r;
  if (close(onFoot.player.x, onFoot.player.y)) return true;
  if (!anyone) return false;
  return Object.values(onFoot.actors).some((a) => a.pose !== 'dead' && close(a.x, a.y));
}

/** Whose turn it is on the Skerry this spring tides (Book 10 namesPerSpring), or null. */
export function drownedDue(world: WorldState, ctx: IslandContext): string | null {
  const period = springTidesOf(world.calendar.day, ctx.b);
  if (period === null) return null;
  const met = Number(world.facts['skerry.drowned.count'] ?? 0);
  const inPeriod =
    world.facts['skerry.drowned.period'] === period
      ? Number(world.facts['skerry.drowned.inPeriod'] ?? 0)
      : 0;
  if (inPeriod >= ctx.ib.skerry.namesPerSpring) return null;
  const next = ctx.puzzles.drowned.order[met];
  if (next === undefined) return null;
  // Donngal's turn waits until the wreck on Sgeir Dhubh has been met (Book 9 section 03).
  if (!next.requires.every((c) => holds(world, ctx, c))) return null;
  return next.key;
}

/** Whether a condition holds now. */
export function holds(world: WorldState, ctx: IslandContext, c: IslandCondition): boolean {
  if ('fact' in c) {
    const v = world.facts[c.fact];
    return c.is === undefined ? truthy(v) : v === c.is;
  }
  if ('not' in c) return !holds(world, ctx, c.not);
  if ('any' in c) return c.any.some((x) => holds(world, ctx, x));
  if ('tide' in c) {
    const tide = tideAt(world.calendar, ctx.b);
    if (c.tide === 'HIGH') return !tide.tidalGroundOpen;
    if (c.tide === 'LOW') return tide.tidalGroundOpen;
    return tide.tidalGroundOpen && tide.springTide;
  }
  if ('season' in c) return c.season.includes(seasonOf(world.calendar.day));
  if ('days' in c) {
    const d = dayOfYear(world.calendar.day);
    return d >= c.days[0] && d <= c.days[1];
  }
  if ('springDay' in c) return springTidesOf(world.calendar.day, ctx.b) !== null;
  if ('watch' in c) return watchOf(world.calendar, ctx.b) === c.watch;
  if ('puzzle' in c) return c.in.includes(puzzleState(world, ctx, c.puzzle));
  if ('pushed' in c) return pushedMoved(world, ctx.maps, c.pushed.zone, c.pushed.id) === c.moved;
  if ('collected' in c) return collectedList(world, ctx).includes(c.collected);
  if ('near' in c) return someoneNear(world, ctx.maps, c.near, c.who === 'ANYONE');
  if ('zone' in c) return world.onFoot?.zone === c.zone;
  if ('weather' in c) return weatherToday(world)?.visibility === 'FOG';
  if ('festivalDawn' in c) return festivalDawn(world, ctx);
  if ('atDoor' in c) {
    const d = ctx.puzzles.alignment.door;
    return someoneNear(world, ctx.maps, { ...d, r: ctx.ib.alignment.doorWaitTiles }, true);
  }
  if ('offeringShows' in c) {
    const s = ctx.ib.secrets;
    const bank = ctx.island.nodes.find((n) => n.kind === 'peat' && /^bog_peat_east$/.test(n.key));
    return (
      seasonOf(world.calendar.day) === s.offeringSeason &&
      bank !== undefined &&
      nodeTaken(world, ctx, bank.key) >= s.offeringLoads
    );
  }
  if ('passage' in c) return passageWater(world.calendar, ctx.b, ctx.ib).state === c.passage;
  if ('drowned' in c) return drownedDue(world, ctx) === c.drowned;
  if ('deed' in c) return world.ledger.some((d) => d.tag === c.deed);
  if ('discovered' in c)
    return world.regions[ctx.region]?.discoveredZones.includes(c.discovered) === true;
  return false;
}

/** A puzzle's state now (its first state until it has moved). */
export function puzzleState(
  world: WorldState,
  ctx: Pick<IslandContext, 'region' | 'puzzles'>,
  id: string,
): string {
  const saved = world.regions[ctx.region]?.puzzles[id];
  if (saved !== undefined) return saved;
  return ctx.puzzles.puzzles.find((p) => p.id === id)?.states[0] ?? '';
}

/** The seasons a day window touches (for the density walker's "in every season"). */
export function seasonsOfDays(days: readonly [number, number]): Season[] {
  return SEASONS.filter(
    (_, i) => days[0] <= (i + 1) * DAYS_PER_SEASON && days[1] > i * DAYS_PER_SEASON,
  );
}

/**
 * The first camp at home and the task system v0 (Book 2 sections 03 and 07; Book 4 Chapter 1
 * beat 2; Book 10 sections 03, 06, 08 and 09; Stage 7).
 *
 * - **Sites** in the zones (content/camp.json): the fire, the beds, the sail to be raised, the
 *   salvaged stores, and the pieces of driftwood lying on Wreck Strand. What interacting with one
 *   does depends on the camp: lay and light the fire with driftwood, feed it, cook a hot meal,
 *   sleep, eat a cold meal, raise the sail shelter, pick up a piece of driftwood; a wounded person
 *   can be tended.
 * - **A hands-on action** plants the feet while its work loop plays for Book 10's actionSeconds.
 *   A menial task is a plain action: no ring, no press (decision PT-1). Only a timed task (Book 10
 *   timedTasks: fishing from the shore) takes one press of use near the mark, which earns up to
 *   playerTimingBonus; missing it never ruins the catch. At its end the work counts at the
 *   steerer's skill, the clock advances by the task's Book 10 game minutes (run minute by minute
 *   through the home step) and only its small stamina is spent.
 * - **Driftwood is found, not worked** (Book 10 section 03, "Driftwood finds"; decisions PT-2 to
 *   PT-4): a piece lies at each DRIFTWOOD site until picked up (a short stoop, one gather loop), and
 *   its load goes into the store at once. A spot picked bare is a resource node of the camp's
 *   region; each dawn the sea refills the season's number of bare spots.
 * - **The home step**, once a game minute: the fire burns its fuel, a resident at work adds work by
 *   the minute, and the steerer's condition is recomputed (warmth by the fire, hunger, hard work).
 * - **The day's start**, on waking: driftwood washes up, fresh fish spoil and the day's ration is
 *   served, except that
 *   before tutorialComplete nothing spoils and the household never goes short (Book 10 section 03,
 *   tutorialGuard); wounds mend from the day they were tended; the morning report is written.
 */
import { parseTimeBalance, SEASONS } from '../../content/balance.ts';
import type { TimeBalance } from '../../content/balance.ts';
import {
  parseDriftwoodBalance,
  parseStaminaBalance,
  parseTaskBalance,
  parseWorkBalance,
} from '../../content/homeBalance.ts';
import type {
  ActionBalance,
  DriftwoodBalance,
  StaminaBalance,
  TaskCost,
  WorkBalance,
} from '../../content/homeBalance.ts';
import type { CampDef, CampSite, Content, TaskDef } from '../../content/registry.ts';
import { cyrb53 } from '../../core/hash.ts';
import type { Id } from '../../core/ids.ts';
import { clockText, minutesIntoDay, seasonOf, tideAt } from '../calendar/calendar.ts';
import { TICKS_PER_SECOND } from '../land/onFoot.ts';
import type { OnFootActor, Work } from '../land/onFoot.ts';
import { tileOf } from '../land/zoneMap.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import type { HomeState, MorningReport, ReportLine, WorldState } from '../world.ts';
import { ateSinceWaking, clearReasons, hasReason, setReason, spendOnTask } from './stamina.ts';

/** The fact set when Chapter 1 ends at the launch (Book 10 section 03, tutorialGuard). */
export const FACT_TUTORIAL_COMPLETE = 'tutorialComplete';
/** Beat 2's facts: Hild has led the steerer to the broch; the fire was first lit; her leg tended. */
export const FACT_AT_BROCH = 'ch1.at_broch';
export const FACT_FIRE_LIT = 'ch1.fire_lit';
export const FACT_HILD_TENDED = 'ch1.hild_tended';
/** Hild has shown the steerer the camp at the broch (beat 2's arrival line). */
export const FACT_ARRIVED_SAID = 'ch1.arrived_said';
/**
 * The user's third playtest (decisions DG-12 and DG-23): the shelter's stage, FOLDED (the sail and
 * three oars lying at its place), FRAME (the oars stood and lashed), SAIL (the lean-to, slept under
 * from the first night) and FINISHED (the S1 broch shelter, from the second day). Absent in a world
 * from before design addendum 2.4, where the lean-to is drawn up from the start.
 */
export const FACT_SHELTER = 'ch1.shelter';
export type ShelterStage = 'FOLDED' | 'FRAME' | 'SAIL' | 'FINISHED';
const SHELTER_STAGES: readonly ShelterStage[] = ['FOLDED', 'FRAME', 'SAIL', 'FINISHED'];

/** The shelter's stage, or null in a world from before the rework's opening (drawn up). */
export function shelterStage(world: WorldState): ShelterStage | null {
  const v = world.facts[FACT_SHELTER];
  return typeof v === 'string' && (SHELTER_STAGES as readonly string[]).includes(v)
    ? (v as ShelterStage)
    : null;
}

/** Whether the lean-to (or the finished shelter) is up: the household sleeps under it. */
export function leanToUp(world: WorldState): boolean {
  const s = shelterStage(world);
  return s === null || s === 'SAIL' || s === 'FINISHED';
}

/**
 * Whether the shelter's finishing is open (Book 10 section 03, shelterFinish): the lean-to up and
 * the camp still at S0, from 06:00 on day 2 and not before (`from`; DG-12). In an older world the
 * work towards the S1 roof was open as soon as the lean-to stood, as before.
 */
export function shelterFinishOpen(
  world: WorldState,
  from: { readonly day: number; readonly minute: number } | null,
  dayStart: number,
): boolean {
  const s = shelterStage(world);
  if (s === null) return true;
  if (s !== 'SAIL') return false;
  if (from === null) return true;
  // Minutes since the campaign's first dawn, now and at the opening (a day begins at dayStart).
  const since = (day: number, minute: number): number =>
    (day - 1) * 1440 + ((minute - dayStart + 1440) % 1440);
  return since(world.calendar.day, world.calendar.minuteOfDay) >= since(from.day, from.minute);
}

/** Everything the camp reads: its content and Book 10's numbers. */
export interface CampContext {
  readonly def: CampDef;
  readonly tasks: ReadonlyMap<Id, { readonly def: TaskDef; readonly cost: TaskCost }>;
  readonly action: ActionBalance;
  readonly work: WorkBalance;
  readonly stamina: StaminaBalance;
  readonly time: TimeBalance;
  /** Worker-days to raise the sail shelter (Book 10 section 09, Buildings). */
  readonly shelterWorkerDays: number;
  /** When the shelter's finishing opens (Book 10 section 03, shelterFinish; null: no opening). */
  readonly shelterFinishFrom: { readonly day: number; readonly minute: number } | null;
  /**
   * The ship's stores lashed on the broken mast, in ration-days (Book 10 section 03, mastStores; 0
   * without the row): counted towards the next day's food until they are brought up (DG-90).
   */
  readonly mastStoresRd: number;
  /**
   * The morning porridge (Book 10 section 22, "Reasons for the first raid", grainShare; decision
   * DH-131): rations a mouth eats from the grain each day while any is left (0 without the row).
   */
  readonly grainShare: number;
  /** Ticks of a hands-on action, and of lying down before the night passes. */
  readonly actionTicks: number;
  readonly sleepTicks: number;
  /** The tasks that keep a timed press (Book 10 timedTasks; decision PT-1). */
  readonly timed: ReadonlySet<Id>;
  /** Driftwood found on the strand (Book 10 section 03, "Driftwood finds"), and the stoop's ticks. */
  readonly driftwood: DriftwoodBalance;
  readonly stoopTicks: number;
}

/** The camp task a piece of driftwood is picked up with (decision PT-2). */
export const TASK_PICK_UP_DRIFTWOOD = 'TASK_GATHER_DRIFTWOOD';

/** A Buildings row's worker-days (Book 10 section 09). */
export function buildingWorkerDays(balance: unknown, row: string): number {
  const tables = (balance as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  const list = tables?.['buildingsToolsAndCrafting']?.['buildings'];
  const found = Array.isArray(list)
    ? (list as Record<string, string>[]).find((r) => r['Building'] === row)
    : undefined;
  const text = found?.['Worker-days'] ?? '';
  if (!/^\d+(\.\d+)?$/.test(text))
    throw new Error(`balance.json: buildings "${row}" Worker-days is "${text}"`);
  return Number(text);
}

/** Book 10 section 03 shelterFinish's opening ("opened at HH:MM on day N"), if the row is there. */
function finishFrom(balance: unknown): { day: number; minute: number } | null {
  const tables = (balance as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  const list = tables?.['foodFuelAndSeasons']?.['workAndTheWreckCamp'];
  const row = Array.isArray(list)
    ? (list as Record<string, string>[]).find((r) => r['Key'] === 'shelterFinish')
    : undefined;
  if (row === undefined) return null;
  const m = /opened at (\d{2}):(\d{2}) on day (\d+) and not before$/.exec(row['Value'] ?? '');
  if (m === null) throw new Error(`balance.json: shelterFinish is "${row['Value'] ?? ''}"`);
  return { day: Number(m[3]), minute: Number(m[1]) * 60 + Number(m[2]) };
}

/** Book 10 section 03 mastStores ("N rd of salt fish ..."), or 0 if the row is not there. */
function mastStoresFrom(balance: unknown): number {
  const tables = (balance as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  const list = tables?.['foodFuelAndSeasons']?.['workAndTheWreckCamp'];
  const row = Array.isArray(list)
    ? (list as Record<string, string>[]).find((r) => r['Key'] === 'mastStores')
    : undefined;
  if (row === undefined) return 0;
  const m = /^(\d+(?:\.\d+)?) rd of salt fish/.exec(row['Value'] ?? '');
  if (m === null) throw new Error(`balance.json: mastStores is "${row['Value'] ?? ''}"`);
  return Number(m[1]);
}

/** Book 10 grainShare (decision DH-131); 0 in a balance without the first raid's table. */
function grainShareFrom(balance: unknown): number {
  const tables = (balance as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  const list = tables?.['storyGates']?.['reasonsForTheFirstRaid'];
  const row = Array.isArray(list)
    ? (list as Record<string, string>[]).find((r) => r['Key'] === 'grainShare')
    : undefined;
  if (row === undefined) return 0;
  const m = /^(\d+(?:\.\d+)?) rd a mouth a day/.exec(row['Value'] ?? '');
  if (m === null) throw new Error(`balance.json: grainShare is "${row['Value'] ?? ''}"`);
  return Number(m[1]);
}

/**
 * The food the household reckons on for tomorrow, in ration-days: the stores, and the ship's stores
 * still lashed on the mast or lying in the shallows, which it can see and means to bring up
 * (Book 10 section 03, shelterFinish; DG-90).
 */
export function foodReckoned(world: WorldState, ctx: CampContext, home: HomeState): number {
  const brought = world.facts['ch1.mast_stores'] === 'CAMP';
  const onMast = world.facts['ch1.shelter'] !== undefined && !brought ? ctx.mastStoresRd : 0;
  return foodRd(home) + onMast;
}

export function campContext(content: Pick<Content, 'camp' | 'balance'>): CampContext | null {
  const def = content.camp;
  if (def === null) return null;
  const taskBalance = parseTaskBalance(content.balance);
  const tasks = new Map<Id, { def: TaskDef; cost: TaskCost }>();
  for (const [id, t] of Object.entries(def.tasks)) {
    const cost = taskBalance.costs.get(t.balanceRow);
    if (cost === undefined) throw new Error(`Book 10 has no task row "${t.balanceRow}"`);
    tasks.set(id, { def: t, cost });
  }
  const driftwood = parseDriftwoodBalance(content.balance);
  return {
    def,
    tasks,
    timed: new Set(
      [...tasks]
        .filter(([, t]) => taskBalance.action.timed.has(t.def.balanceRow))
        .map(([id]) => id),
    ),
    driftwood,
    stoopTicks: Math.round(driftwood.stoopSeconds * TICKS_PER_SECOND),
    action: taskBalance.action,
    work: parseWorkBalance(content.balance),
    stamina: parseStaminaBalance(content.balance),
    time: parseTimeBalance(content.balance),
    shelterWorkerDays: buildingWorkerDays(content.balance, def.shelter.balanceRow),
    shelterFinishFrom: finishFrom(content.balance),
    mastStoresRd: mastStoresFrom(content.balance),
    grainShare: grainShareFrom(content.balance),
    actionTicks: Math.round(taskBalance.action.actionSeconds * TICKS_PER_SECOND),
    sleepTicks: Math.round(def.sleepSeconds * TICKS_PER_SECOND),
  };
}

/** Game minutes since the campaign began (day 1, 06:00 is 0). */
export function campaignMinute(world: WorldState, b: TimeBalance): number {
  return (world.calendar.day - 1) * 1440 + minutesIntoDay(world.calendar, b);
}

/** The home this camp belongs to. */
export function homeOf(world: WorldState, ctx: CampContext): HomeState | undefined {
  return world.homes[ctx.def.home];
}

/** A new campaign's camp: the wreck's salvaged stores, no fuel, no fire (Book 10 section 03). */
export function setupCamp(world: WorldState, ctx: CampContext): void {
  const home = world.homes[ctx.def.home];
  if (home === undefined) return;
  home.stores = { RES_SALTED_FISH: ctx.work.wreckStoresRd, RES_DRIFTWOOD: ctx.work.campFuelLoads };
  home.fresh = [];
  home.fire = { lit: false, fuel: 0 };
  home.building = null;
  home.catch = 0;
  home.rationDay = world.calendar.day;
  home.shortDays = 0;
}

/** Whether a task keeps the timed press and its ring (Book 10 timedTasks; decision PT-1). */
export function isTimed(ctx: CampContext, task: Id): boolean {
  return ctx.timed.has(task);
}

/** How long a hands-on action plays, in ticks: a pick-up's stoop, or Book 10's actionSeconds. */
export function workTicks(ctx: CampContext, task: Id): number {
  return task === TASK_PICK_UP_DRIFTWOOD ? ctx.stoopTicks : ctx.actionTicks;
}

/** The resource nodes that keep the spots picked bare (decision PT-4). */
function driftwoodNodes(world: WorldState, ctx: CampContext): Record<Id, { nextDay: number }> {
  const region = (world.regions[ctx.def.region] ??= {
    discoveredZones: [],
    resourceNodes: {},
    puzzles: {},
  });
  return region.resourceNodes;
}

/** Whether a piece of driftwood lies at a DRIFTWOOD site now. */
export function driftwoodLies(
  world: WorldState,
  ctx: Pick<CampContext, 'def'>,
  key: string,
): boolean {
  return world.regions[ctx.def.region]?.resourceNodes[key] === undefined;
}

/** The pieces of driftwood lying in a zone, to draw (tiles, at the foot) and pick up. */
export function driftwoodPieces(
  world: WorldState,
  ctx: Pick<CampContext, 'def'>,
  zone: Id,
): { readonly key: string; readonly x: number; readonly y: number; readonly frame: string }[] {
  return ctx.def.sites
    .filter((s) => s.kind === 'DRIFTWOOD' && s.zone === zone && driftwoodLies(world, ctx, s.key))
    .map((s) => ({ key: s.key, x: s.x, y: s.y, frame: s.frame ?? 'log/-/0' }));
}

/**
 * Dawn on the strand (Book 10 "Driftwood finds"): the sea leaves the season's pieces (twice that
 * after a storm) at spots picked bare before today, never more than there are. Which spots is a
 * hash of the campaign seed, the day and the spot, so no random stream is drawn. Returns how
 * many pieces washed up.
 */
export function washUpDriftwood(world: WorldState, ctx: CampContext, storm = false): number {
  const nodes = driftwoodNodes(world, ctx);
  const day = world.calendar.day;
  const want = ctx.driftwood.perDawn[seasonOf(day)] * (storm ? ctx.driftwood.afterStorm : 1);
  const bare = Object.entries(nodes)
    .filter(([, n]) => n.nextDay <= day)
    .map(([key]) => key)
    .sort(
      (a, b) =>
        cyrb53(`${world.seed}/driftwood/${day}/${a}`) -
          cyrb53(`${world.seed}/driftwood/${day}/${b}`) || (a < b ? -1 : 1),
    );
  const washed = new Set(bare.slice(0, Math.max(0, Math.floor(want))));
  const region = world.regions[ctx.def.region];
  if (region !== undefined && washed.size > 0)
    region.resourceNodes = Object.fromEntries(
      Object.entries(nodes).filter(([key]) => !washed.has(key)),
    );
  return washed.size;
}

/** The output multiplier for a skill level, relative to Book 10's "at skill 2" rates. */
export function skillRatio(work: WorkBalance, level: number): number {
  const at = (l: number): number => work.output.base + work.output.perLevel * l;
  return at(level) / at(2);
}

/** Food in the stores, in ration-days. */
export function foodRd(home: HomeState): number {
  // Grain is food (Book 10 section 03; decision DH-131): the meal-sack counts in every runway.
  return (
    (home.stores['RES_SALTED_FISH'] ?? 0) +
    (home.stores['RES_GRAIN'] ?? 0) +
    home.fresh.reduce((s, f) => s + f.rd, 0)
  );
}

export type SiteUse =
  | { readonly kind: 'TASK'; readonly task: Id; readonly site: string; readonly target?: Id }
  | { readonly kind: 'FEED_FIRE'; readonly site: string }
  | { readonly kind: 'SLEEP'; readonly site: string }
  | { readonly kind: 'EAT'; readonly site: string }
  | { readonly kind: 'TALK'; readonly site: string; readonly target: Id }
  /** Stage 10: a search's words (site: the talk's id; target: who or what is spoken to). */
  | { readonly kind: 'SEARCH'; readonly site: string; readonly target: Id }
  /** Stage 11: a repair's own act (site: take_oar, taking the steering oar from the skiff). */
  | { readonly kind: 'REPAIR'; readonly site: string; readonly target: Id }
  /**
   * Design addendum 2.4's opening (src/sim/narrative/wreck.ts): take Thorkel's key, open his
   * chest, raise the sail between the oars.
   */
  | { readonly kind: 'OPENING'; readonly site: string; readonly target: Id }
  /** The user's fourth playtest (DH-115): a small find off the path, looked at or taken. */
  | {
      readonly kind: 'FIND';
      readonly site: string;
      readonly take: boolean;
      readonly nameKey: string;
    }
  | {
      readonly kind: 'REFUSE';
      readonly site: string;
      readonly reason: 'NO_DRIFTWOOD' | 'NO_FOOD' | 'TOO_EARLY_TO_SLEEP';
      /** Too early to sleep: the hour a bed ends the day from (Book 10 sleepAfter; DH-101). */
      readonly after?: string;
    };

/** The sites of a zone that exist at the camp's stage. */
export function activeSites(world: WorldState, ctx: CampContext, zone: Id): CampSite[] {
  const stage = homeOf(world, ctx)?.stage ?? 'S0';
  return ctx.def.sites.filter(
    (s) => s.zone === zone && (s.stages === undefined || (s.stages as string[]).includes(stage)),
  );
}

/** Whether a bed ends the day now (Book 2 section 03: after 18:00). */
export function sleepAllowed(world: WorldState, b: TimeBalance): boolean {
  const from = (b.sleepAfter - b.dayStart + 1440) % 1440;
  return minutesIntoDay(world.calendar, b) >= from;
}

/** What interacting with a site does now, or why it cannot. */
export function siteUse(world: WorldState, ctx: CampContext, site: CampSite): SiteUse | null {
  const home = homeOf(world, ctx);
  if (home === undefined) return null;
  const wood = home.stores['RES_DRIFTWOOD'] ?? 0;
  switch (site.kind) {
    case 'DRIFTWOOD':
      // A piece lying there is picked up; a spot picked bare offers nothing (decision PT-2).
      return driftwoodLies(world, ctx, site.key)
        ? { kind: 'TASK', task: TASK_PICK_UP_DRIFTWOOD, site: site.key }
        : null;
    case 'FIRE':
      if (!home.fire.lit)
        return wood >= ctx.work.fireLightLoads
          ? { kind: 'TASK', task: 'TASK_LIGHT_FIRE', site: site.key }
          : { kind: 'REFUSE', site: site.key, reason: 'NO_DRIFTWOOD' };
      // A lit fire cooks a hot meal while there is food; with the steerer fed, it takes wood.
      if (!ateSinceWaking(world) && foodRd(home) > 0)
        return { kind: 'TASK', task: 'TASK_COOK', site: site.key };
      if (wood >= 1) return { kind: 'FEED_FIRE', site: site.key };
      if (foodRd(home) > 0) return { kind: 'TASK', task: 'TASK_COOK', site: site.key };
      return { kind: 'REFUSE', site: site.key, reason: 'NO_DRIFTWOOD' };
    case 'BED':
      return sleepAllowed(world, ctx.time)
        ? { kind: 'SLEEP', site: site.key }
        : {
            kind: 'REFUSE',
            site: site.key,
            reason: 'TOO_EARLY_TO_SLEEP',
            after: clockText(ctx.time.sleepAfter),
          };
    case 'BUILD':
      // The frame and the sail are the opening's own actions (src/sim/narrative/wreck.ts); the
      // finishing is building work from 06:00 on the second day (DG-12), towards the S1 roof.
      return home.stage === 'S0' &&
        shelterFinishOpen(world, ctx.shelterFinishFrom, ctx.time.dayStart)
        ? { kind: 'TASK', task: 'TASK_BUILD', site: site.key }
        : null;
    case 'STORES':
      if (ateSinceWaking(world)) return null;
      return foodRd(home) > 0
        ? { kind: 'EAT', site: site.key }
        : { kind: 'REFUSE', site: site.key, reason: 'NO_FOOD' };
  }
}

/**
 * A resident can be talked to (Stage 8, Book 8 section 09); a wound is tended through the talk
 * (its topic's "Let me see to it"). Asleep, they cannot.
 */
export function personUse(world: WorldState, id: Id): SiteUse | null {
  const person = world.people[id];
  if (person === undefined || !world.household.residents.includes(id)) return null;
  if (world.talk !== null) return null;
  return { kind: 'TALK', site: `person:${id}`, target: id };
}

/** A use with where it is, for choosing the nearest. */
export interface PlacedUse {
  readonly use: SiteUse;
  readonly x: number;
  readonly y: number;
  /** Its own reach in pixels (Stage 10: words over a wall), instead of the interaction radius. */
  readonly reach?: number;
  /**
   * The ground it covers, in pixels (the user's fourth playtest, DH-100: the steerer's bed, 2 x 1
   * tiles): its distance is to the nearest point of this, so standing anywhere on it is on it.
   */
  readonly area?: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
  /**
   * Offered before anything else in reach (the user's fourth playtest, DH-10): the shelter's frame
   * and sail at their marked spot, which lies on the lean-to's own bed.
   */
  readonly first?: boolean;
}

/** How far `at` is from a use: from its area if it has one (0 standing on it), else its point. */
export function useDistance(u: PlacedUse, at: { readonly x: number; readonly y: number }): number {
  const a = u.area;
  if (a === undefined) return Math.hypot(u.x - at.x, u.y - at.y);
  const dx = Math.max(a.x0 - at.x, 0, at.x - a.x1);
  const dy = Math.max(a.y0 - at.y, 0, at.y - a.y1);
  return Math.hypot(dx, dy);
}

/** Every camp use in a zone now: its sites, and the people who can be tended. */
export function campUses(
  world: WorldState,
  ctx: CampContext,
  map: ZoneMap,
  actors: Readonly<Record<Id, OnFootActor>>,
): PlacedUse[] {
  const out: PlacedUse[] = [];
  // The camp's work begins once Hild has led the steerer to the broch (Book 4 Chapter 1 beat 2;
  // decision S7-26): the opening on the strand offers only its own prompts.
  if (world.facts[FACT_AT_BROCH] !== true) return out;
  for (const site of activeSites(world, ctx, map.zone)) {
    const use = siteUse(world, ctx, site);
    if (use === null) continue;
    const T = map.tile;
    const a = site.area;
    out.push({
      use,
      x: site.x * T,
      y: site.y * T,
      ...(a === undefined
        ? {}
        : { area: { x0: a.x0 * T, y0: a.y0 * T, x1: a.x1 * T, y1: a.y1 * T } }),
    });
  }
  for (const [id, actor] of Object.entries(actors).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (actor.pose === 'carried' || actor.pose === 'down' || actor.pose === 'call') continue;
    if (actor.pose === 'sleep') continue;
    const use = personUse(world, id);
    if (use !== null) out.push({ use, x: actor.x, y: actor.y });
  }
  return out;
}

/**
 * The nearest camp use within `reach` pixels of `at`: something that can be done before a reason
 * why something cannot (too early to sleep), so a refusal never hides a task beside it. A bed the
 * steerer stands on comes before anything else when it can be slept in (the user's fourth
 * playtest, DH-100: whatever lies beside it, the bed under the feet is the one wanted).
 */
export function campUseNear(
  uses: readonly PlacedUse[],
  at: { readonly x: number; readonly y: number },
  reach: number,
): (PlacedUse & { readonly d: number }) | null {
  let best: (PlacedUse & { d: number }) | null = null;
  const rank = (u: PlacedUse & { d: number }): number =>
    u.use.kind === 'SLEEP' && u.area !== undefined && u.d <= 0
      ? -2
      : u.first === true
        ? -1
        : u.use.kind === 'REFUSE'
          ? 1
          : 0;
  for (const u0 of uses) {
    const d = useDistance(u0, at);
    const u = { ...u0, d };
    if (d > (u.reach ?? reach)) continue;
    if (best === null || rank(u) < rank(best) || (rank(u) === rank(best) && d < best.d)) best = u;
  }
  return best;
}

/** The camp use on a tile (or on the tile below it: a click on a tall thing counts). */
export function campUseAt(
  uses: readonly PlacedUse[],
  map: ZoneMap,
  tile: { readonly tx: number; readonly ty: number },
): PlacedUse | null {
  // Something that can be done before a reason why something cannot (as campUseNear); a bed
  // clicked anywhere on it, when it can be slept in, before anything else there (DH-100).
  let refusal: PlacedUse | null = null;
  let found: PlacedUse | null = null;
  for (const u of uses) {
    const t = tileOf(map, u.x, u.y - 0.001);
    const a = u.area;
    const onArea =
      a !== undefined &&
      (tile.tx + 1) * map.tile > a.x0 &&
      tile.tx * map.tile < a.x1 &&
      (tile.ty + 1) * map.tile > a.y0 &&
      tile.ty * map.tile < a.y1;
    if (onArea && u.use.kind === 'SLEEP') return u;
    if (onArea || (t.tx === tile.tx && (t.ty === tile.ty || t.ty === tile.ty + 1))) {
      if (u.use.kind !== 'REFUSE') found ??= u;
      else refusal ??= u;
    }
  }
  return found ?? refusal;
}

export type CampEvent =
  | {
      readonly type: 'WORK_STARTED';
      readonly task: Id;
      readonly site: string;
      readonly ticks: number;
      /** The tick the timing ring closes on its mark; null for a plain action (no ring). */
      readonly markTick: number | null;
    }
  | { readonly type: 'WORK_PRESSED'; readonly task: Id; readonly quality: number }
  | {
      readonly type: 'WORK_DONE';
      readonly task: Id;
      readonly site: string;
      readonly minutes: number;
      readonly stamina: number;
      readonly bonus: number;
      readonly output: number;
    }
  | { readonly type: 'WORK_CANCELLED'; readonly task: Id }
  | { readonly type: 'FIRE_LIT' }
  | { readonly type: 'FIRE_FED'; readonly fuel: number }
  | { readonly type: 'FIRE_OUT' }
  | { readonly type: 'FISH_LANDED'; readonly count: number; readonly by: Id }
  | { readonly type: 'MEAL_EATEN'; readonly hot: boolean }
  | { readonly type: 'WOUND_TENDED'; readonly person: Id }
  | { readonly type: 'BUILDING_RAISED'; readonly building: Id; readonly share: number }
  | { readonly type: 'CAMP_STAGE'; readonly stage: HomeState['stage'] }
  | { readonly type: 'REASON_ADDED'; readonly reason: string }
  | { readonly type: 'REASON_LIFTED'; readonly reason: string };

/**
 * How good a timing press was, 0 to 1 (Book 10 section 09, "Hands-on action"). Only a timed
 * task's press counts (finishWork asks isTimed first).
 */
export function timingQuality(work: Work, action: ActionBalance): number {
  if (work.press === null) return 0;
  const t = (work.press - work.since) / TICKS_PER_SECOND;
  const off = Math.abs(t - action.markSeconds);
  if (off <= action.windowSeconds) return 1;
  return Math.max(0, 1 - (off - action.windowSeconds) / action.windowSeconds);
}

/** The tick the mark falls on in a work begun at `since`. */
export function markTick(since: number, action: ActionBalance): number {
  return since + Math.round(action.markSeconds * TICKS_PER_SECOND);
}

/**
 * Finishes a hands-on action: its output at the steerer's skill and timing, its game time run
 * through the home step (`advance`), and its small stamina.
 */
export function finishWork(
  world: WorldState,
  ctx: CampContext,
  work: Work,
  tick: number,
  emit: (e: CampEvent) => void,
  advance: (minutes: number) => void,
  say: (lineKey: string) => void,
  /** Stage 11: a "Repair the ship" action's site and its worker-minutes (the boat, the wreck). */
  repair?: (site: string, workerMinutes: number) => void,
): void {
  const home = homeOf(world, ctx);
  const task = ctx.tasks.get(work.task);
  if (home === undefined || task === undefined) return;
  const season = seasonOf(world.calendar.day);
  const level = world.player.skills[task.def.skill] ?? 0;
  // A plain action has no press to count (decision PT-1): only a timed task earns the bonus.
  const quality = isTimed(ctx, work.task) ? timingQuality(work, ctx.action) : 0;
  const bonus = quality * ctx.work.timingBonus;
  const k = skillRatio(ctx.work, level) * (1 + bonus);
  let output = 0;
  switch (work.task) {
    case TASK_PICK_UP_DRIFTWOOD: {
      // A piece found, not worked: its load at once, whatever the skill (decision PT-2).
      if (!driftwoodLies(world, ctx, work.site)) break;
      output = ctx.driftwood.loadsPerPiece;
      home.stores['RES_DRIFTWOOD'] = (home.stores['RES_DRIFTWOOD'] ?? 0) + output;
      driftwoodNodes(world, ctx)[work.site] = { nextDay: world.calendar.day + 1 };
      break;
    }
    case 'TASK_FISH_SHORE': {
      output = (ctx.work.fishShore[season] / ctx.work.workerDayMinutes) * task.cost.gameMinutes * k;
      landFish(world, ctx, home, output, 'P_STEERER', emit, say);
      break;
    }
    case 'TASK_CARE': {
      const person = work.target === undefined ? undefined : world.people[work.target];
      for (const w of person?.wounds ?? []) w.tendedDay ??= world.calendar.day;
      if (work.target !== undefined) emit({ type: 'WOUND_TENDED', person: work.target });
      if (work.target === 'C_HILD' && world.facts[FACT_HILD_TENDED] !== true) {
        world.facts[FACT_HILD_TENDED] = true;
        const line = ctx.def.lines['tended'];
        if (line !== undefined) say(line);
      }
      output = 1;
      break;
    }
    case 'TASK_LIGHT_FIRE': {
      const wood = home.stores['RES_DRIFTWOOD'] ?? 0;
      const laid = Math.min(wood, ctx.work.fireLightLoads);
      home.stores['RES_DRIFTWOOD'] = wood - laid;
      home.fire = { lit: true, fuel: home.fire.fuel + laid };
      output = laid;
      emit({ type: 'FIRE_LIT' });
      if (world.facts[FACT_FIRE_LIT] !== true) {
        world.facts[FACT_FIRE_LIT] = true;
        const line = ctx.def.lines['fireLit'];
        if (line !== undefined) say(line);
      }
      break;
    }
    case 'TASK_COOK': {
      eat(world, ctx, true, emit);
      output = 1;
      const line = ctx.def.lines['meal'];
      if (line !== undefined && world.household.residents.includes('C_HILD')) say(line);
      break;
    }
    case 'TASK_BUILD': {
      output = task.cost.gameMinutes * k;
      addShelterWork(ctx, home, output, emit, say, true);
      break;
    }
    case 'TASK_REPAIR_SHIP': {
      output = task.cost.gameMinutes * k;
      repair?.(work.site, output);
      break;
    }
  }
  const minutes = task.cost.gameMinutes;
  spendOnTask(world.player.stamina, task.cost.stamina, tick);
  world.player.condition.workedMinutes += minutes;
  emit({
    type: 'WORK_DONE',
    task: work.task,
    site: work.site,
    minutes,
    stamina: task.cost.stamina,
    bonus,
    output,
  });
  advance(minutes);
}

/**
 * Adds worker-minutes to the sail shelter going up; once Book 10's worker-days are done the camp is
 * at S1. `report` says each share (the steerer's own work does; a resident's does not, each minute).
 */
export function addShelterWork(
  ctx: CampContext,
  home: HomeState,
  workerMinutes: number,
  emit: (e: CampEvent) => void,
  say: (lineKey: string) => void,
  report = false,
): void {
  if (home.stage !== 'S0') return;
  const building = home.building ?? { id: ctx.def.shelter.building, progress: 0 };
  building.progress += workerMinutes;
  const need = ctx.shelterWorkerDays * ctx.work.workerDayMinutes;
  if (building.progress >= need) {
    home.building = null;
    home.stage = 'S1';
    if (!home.buildings.includes(building.id)) home.buildings.push(building.id);
    emit({ type: 'BUILDING_RAISED', building: building.id, share: 1 });
    emit({ type: 'CAMP_STAGE', stage: 'S1' });
    const line = ctx.def.lines['shelter'];
    if (line !== undefined) say(line);
  } else {
    home.building = building;
    if (report)
      emit({ type: 'BUILDING_RAISED', building: building.id, share: building.progress / need });
  }
}

/** Adds fish to a catch in progress; whole fish go to the stores, fresh, by today. */
export function landFish(
  world: WorldState,
  ctx: CampContext,
  home: HomeState,
  share: number,
  by: Id,
  emit: (e: CampEvent) => void,
  say: (lineKey: string) => void,
): void {
  home.catch += share;
  const whole = Math.floor(home.catch + 1e-9);
  if (whole <= 0) return;
  home.catch -= whole;
  const rd = whole * ctx.work.freshFish.rd;
  const today = home.fresh.find((f) => f.day === world.calendar.day);
  if (today !== undefined) today.rd += rd;
  else home.fresh.push({ rd, day: world.calendar.day });
  emit({ type: 'FISH_LANDED', count: whole, by });
  if (world.facts['ch1.first_fish'] !== true) {
    world.facts['ch1.first_fish'] = true;
    const line = ctx.def.lines['firstFish'];
    if (by === 'P_STEERER' && line !== undefined) say(line);
  }
}

/** A meal: a hot one lifts Hungry and Cold, a cold one Hungry (Book 10 section 06). */
export function eat(
  world: WorldState,
  ctx: CampContext,
  hot: boolean,
  emit: (e: CampEvent) => void,
): void {
  const now = campaignMinute(world, ctx.time);
  const c = world.player.condition;
  const st = world.player.stamina;
  c.lastMealAt = now;
  const lifted: string[] = [];
  if (hasReason(st, 'STARVING')) {
    c.mealsWhileStarving++;
    // Two meals end starving (Book 10).
    if (c.mealsWhileStarving >= 2) {
      lifted.push(...clearReasons(st, ctx.stamina, ['STARVING']));
      c.mealsWhileStarving = 0;
    }
  }
  lifted.push(...clearReasons(st, ctx.stamina, hot ? ['HUNGRY', 'COLD'] : ['HUNGRY']));
  if (hot) c.warmMinutes = 0;
  emit({ type: 'MEAL_EATEN', hot });
  for (const r of lifted) emit({ type: 'REASON_LIFTED', reason: r });
}

/** Feeds the fire one load from the stack. */
export function feedFire(world: WorldState, ctx: CampContext, emit: (e: CampEvent) => void): void {
  const home = homeOf(world, ctx);
  if (home === undefined) return;
  const wood = home.stores['RES_DRIFTWOOD'] ?? 0;
  if (wood < 1) return;
  home.stores['RES_DRIFTWOOD'] = wood - 1;
  home.fire.fuel += 1;
  emit({ type: 'FIRE_FED', fuel: home.fire.fuel });
}

/** Where the steerer is, for warmth: the zone and the feet in pixels. */
export interface SteererAt {
  readonly zone: Id;
  readonly x: number;
  readonly y: number;
  readonly tile: number;
}

/** Whether the steerer is within a lit fire's warmth (Book 10 warmFire: within 3 tiles). */
export function byTheFire(world: WorldState, ctx: CampContext, at: SteererAt | null): boolean {
  const home = homeOf(world, ctx);
  if (home === undefined || !home.fire.lit || at === null) return false;
  const fire = ctx.def.sites.find((s) => s.kind === 'FIRE');
  if (fire?.zone !== at.zone) return false;
  return (
    Math.hypot(fire.x * at.tile - at.x, fire.y * at.tile - at.y) <=
    ctx.stamina.warmFire.tiles * at.tile
  );
}

/**
 * One game minute at home: the fire burns and the steerer's condition is brought up to date
 * (warmth, hunger, hard work, wounds). Residents' work is the household's day (src/sim/people).
 */
export function homeMinute(
  world: WorldState,
  ctx: CampContext,
  at: SteererAt | null,
  emit: (e: CampEvent) => void,
): void {
  if (homeOf(world, ctx) === undefined) return;
  fireMinute(world, ctx, emit);
  conditionMinute(world, ctx, at, emit);
}

/** One game minute of the home's fire: it burns the season's fuel and goes out when it is spent. */
export function fireMinute(
  world: WorldState,
  ctx: CampContext,
  emit: (e: CampEvent) => void,
): void {
  const home = homeOf(world, ctx);
  if (home === undefined) return;
  const season = seasonOf(world.calendar.day);
  if (home.fire.lit) {
    home.fire.fuel = Math.max(0, home.fire.fuel - ctx.work.fuelPerDay[season] / 1440);
    if (home.fire.fuel <= 1e-9) {
      home.fire = { lit: false, fuel: 0 };
      emit({ type: 'FIRE_OUT' });
    }
  }
}

/** The steerer's condition, recomputed once a game minute (Book 2 section 24). */
export function conditionMinute(
  world: WorldState,
  ctx: CampContext,
  at: SteererAt | null,
  emit: (e: CampEvent) => void,
): void {
  const st = world.player.stamina;
  const sb = ctx.stamina;
  const c = world.player.condition;
  const now = campaignMinute(world, ctx.time);
  const add = (reason: Parameters<typeof setReason>[2], cause?: string): void => {
    if (hasReason(st, reason)) return;
    setReason(st, sb, reason, now, cause);
    emit({ type: 'REASON_ADDED', reason });
  };
  const lift = (reasons: Parameters<typeof clearReasons>[2]): void => {
    for (const r of clearReasons(st, sb, reasons)) emit({ type: 'REASON_LIFTED', reason: r });
  };
  // Warm: an hour within a lit fire's reach lifts Cold.
  if (hasReason(st, 'COLD')) {
    if (byTheFire(world, ctx, at)) c.warmMinutes++;
    if (c.warmMinutes >= sb.warmFire.minutes) {
      lift(['COLD']);
      c.warmMinutes = 0;
    }
  } else c.warmMinutes = 0;
  if (world.player.awake) {
    // Hungry by 14:00 without a meal since waking; starving after a whole day without food,
    // but never before tutorialComplete (the tutorial guard).
    const into = minutesIntoDay(world.calendar, ctx.time);
    const hungryFrom = (sb.hungryAt - ctx.time.dayStart + 1440) % 1440;
    const guard = world.facts[FACT_TUTORIAL_COMPLETE] !== true;
    const lastMeal = c.lastMealAt ?? -Infinity;
    if (!guard && now - lastMeal >= 1440 && now >= 1440) {
      if (!hasReason(st, 'STARVING')) {
        lift(['HUNGRY']);
        add('STARVING');
        c.mealsWhileStarving = 0;
      }
    } else if (!ateSinceWaking(world) && into >= hungryFrom && !hasReason(st, 'STARVING'))
      add('HUNGRY');
    if (c.workedMinutes > sb.hardWorkMinutes) add('HARD_WORK');
  }
  // The steerer's own wounds (none until Stage 9's combat).
  const light = world.player.wounds.some((w) => w.severity === 'LIGHT');
  const bad = world.player.wounds.some((w) => w.severity !== 'LIGHT');
  if (bad) add('BADLY_WOUNDED');
  else lift(['BADLY_WOUNDED']);
  if (light) add('WOUNDED');
  else lift(['WOUNDED']);
}

/**
 * The start of a day, on waking: spoilage and the day's ration (never before tutorialComplete:
 * the tutorial guard), wounds mending from the day they were tended, and the report.
 */
export function startDay(
  world: WorldState,
  ctx: CampContext,
  /**
   * Stage 13: `storm`, yesterday was a storm (twice the driftwood, Book 10 afterStorm; decision
   * S13-15); `mouths`, the mouths fed from the home's stores (the steerer and the crew at sea eat
   * from the ship's, decision S13-13). By default, the steerer and every resident.
   */
  opts: { readonly storm?: boolean; readonly mouths?: number } = {},
): void {
  const home = homeOf(world, ctx);
  const day = world.calendar.day;
  const guard = world.facts[FACT_TUTORIAL_COMPLETE] !== true;
  if (home !== undefined && home.rationDay < day) {
    // The sea leaves driftwood at spots picked bare (Book 10 "Driftwood finds"), twice the
    // season's pieces at the dawn after a storm.
    washUpDriftwood(world, ctx, opts.storm === true);
    // Spoilage: fresh fish keeps Book 10's days; none spoils before tutorialComplete.
    if (!guard) home.fresh = home.fresh.filter((f) => day - f.day < ctx.work.freshFish.keepsDays);
    // The day's ration for every mouth: the oldest fresh fish first, then the salt fish.
    const mouths = opts.mouths ?? 1 + world.household.residents.length;
    let need = mouths * ctx.work.foodPerPersonPerDay;
    // The morning porridge first, from the grain while any is left (decision DH-131).
    const grain = home.stores['RES_GRAIN'] ?? 0;
    const porridge = Math.min(grain, mouths * ctx.grainShare, need);
    if (porridge > 0) {
      home.stores['RES_GRAIN'] = grain - porridge;
      need -= porridge;
    }
    home.fresh.sort((a, b) => a.day - b.day);
    for (const lot of home.fresh) {
      const take = Math.min(lot.rd, need);
      lot.rd -= take;
      need -= take;
    }
    home.fresh = home.fresh.filter((f) => f.rd > 1e-9);
    const salted = home.stores['RES_SALTED_FISH'] ?? 0;
    const take = Math.min(salted, need);
    home.stores['RES_SALTED_FISH'] = salted - take;
    need -= take;
    // Short: before tutorialComplete the household scrapes by; after, the shortfall counts.
    if (need > 1e-9 && !guard) home.shortDays++;
    home.rationDay = day;
  }
  // Wounds mend from the day they were tended (Book 10 section 08).
  for (const person of Object.values(world.people)) {
    const left = person.wounds.filter(
      (w) => w.tendedDay === undefined || day - w.tendedDay < ctx.work.woundDays[w.severity],
    );
    if (left.length !== person.wounds.length) {
      person.wounds = left;
      if (left.length === 0 && person.status === 'wounded') person.status = 'alive';
    }
  }
}

/** How the night went, for the report. */
export interface NightRecord {
  readonly slept: number;
  readonly cold: boolean;
  readonly collapsed: boolean;
}

/** The morning report v0 in sentences (Book 1 section 03; Book 7 section 10: plain sentences). */
export function morningReport(
  world: WorldState,
  ctx: CampContext,
  night: NightRecord,
  nameOf: (id: Id) => string,
  plans: readonly ReportLine[] = [],
): MorningReport {
  const lines: ReportLine[] = [];
  const line = (key: string, vars: Record<string, string | number> = {}): void => {
    lines.push({ key, vars });
  };
  const home = homeOf(world, ctx);
  if (night.collapsed) line('report.collapsed.night');
  else
    line(night.slept < ctx.stamina.shortSleepMinutes ? 'report.slept.short' : 'report.slept.well');
  if (night.cold) line('report.slept.cold');
  if (home !== undefined) {
    const mouths = 1 + world.household.residents.length;
    const rd = foodRd(home);
    const days = Math.floor(rd / (mouths * ctx.work.foodPerPersonPerDay) + 1e-9);
    if (rd <= 1e-9) line('report.food.none');
    else if (days <= 1) line('report.food.one');
    else line('report.food.days', { days, rd: Math.round(rd) });
    const fish = Math.round(home.fresh.reduce((s, f) => s + f.rd, 0));
    if (fish > 0) line('report.food.fresh', { fish });
    if (world.facts[FACT_TUTORIAL_COMPLETE] !== true && rd < mouths) line('report.guard.tutorial');
    const season = seasonOf(world.calendar.day);
    if (home.fire.lit)
      line('report.fire.lit', {
        hours: Math.max(1, Math.round((home.fire.fuel / ctx.work.fuelPerDay[season]) * 24)),
      });
    else if (world.facts[FACT_FIRE_LIT] === true) line('report.fire.out');
    else line('report.fire.none');
    const wood = Math.floor(home.stores['RES_DRIFTWOOD'] ?? 0);
    if (wood === 1) line('report.wood.one');
    else if (wood > 1) line('report.wood.stack', { loads: wood });
    // Where more lies (decision PT-7): the pieces on the strand once the camp's work is open.
    const pieces = ctx.def.sites.filter(
      (s) => s.kind === 'DRIFTWOOD' && driftwoodLies(world, ctx, s.key),
    ).length;
    if (world.facts[FACT_AT_BROCH] === true && pieces > 0)
      line(pieces === 1 ? 'report.wood.strand_one' : 'report.wood.strand', { pieces });
    if (home.stage === 'S0' && world.facts[FACT_AT_BROCH] === true) {
      if (home.building === null) line('report.shelter.none');
      else {
        const share = home.building.progress / (ctx.shelterWorkerDays * ctx.work.workerDayMinutes);
        line('report.shelter.started', {
          part:
            share < 0.34
              ? 'report.part.begun'
              : share < 0.67
                ? 'report.part.half'
                : 'report.part.most',
        });
      }
    } else if (home.stage === 'S1') line('report.shelter.done');
  }
  for (const id of world.household.residents) {
    const person = world.people[id];
    if (person === undefined) continue;
    const name = nameOf(id);
    const wound = person.wounds[0];
    if (wound === undefined) continue;
    if (wound.tendedDay === undefined) line('report.wound.untended', { name });
    else
      line('report.wound.tended', {
        name,
        days: Math.max(
          1,
          ctx.work.woundDays[wound.severity] - (world.calendar.day - wound.tendedDay),
        ),
      });
  }
  // The household's plans for the day, and how they are (src/sim/people/day.ts).
  lines.push(...plans);
  // Stage 10: the Hag's Seat's consequence, reported once (the omen's saved state, Book 4
  // section 07's fourth part; src/sim/narrative/searches.ts).
  const cailleach = world.powers['POWER_CAILLEACH'] as
    { stone: string; offering: string | null; passedBy: boolean } | undefined;
  if (cailleach !== undefined && world.facts['search.reported_cailleach'] !== true) {
    if (cailleach.stone === 'DRY') {
      line('report.search.cailleach');
      world.facts['search.reported_cailleach'] = true;
    } else if (cailleach.passedBy) {
      line('report.search.cailleach_unanswered');
      world.facts['search.reported_cailleach'] = true;
    }
  }
  const tide = tideAt(world.calendar, ctx.time);
  const low = (world.calendar.minuteOfDay + tide.minutesToLowWater) % 1440;
  line('report.tide.low', { time: clockText(low) });
  line('report.threats.none');
  return { day: world.calendar.day, lines };
}

/** The seasons, for report wording. */
export const SEASON_KEYS = SEASONS.map((s) => `ui.season.${s.toLowerCase()}`);

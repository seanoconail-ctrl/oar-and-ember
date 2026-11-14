/**
 * Skarvholm's resource nodes (Stage 14, decision S14-15; Book 10 section 03, "Island resource
 * nodes"; Book 2 section 10, `ResourceNode`): watercress, heather, hares, bog cotton, kelp, seals,
 * eggs, peat and fish from the rocks. Each lies at its place in `content/island.json` and its kind
 * names Book 10's row, which gives everything else.
 *
 * - **Exists** only in its seasons (or its day window) and at its tide: kelp and the seals at low
 *   water only, the fishing rocks in winter on a calm day only. Out of them it is not drawn, not
 *   offered and not counted by the density walker.
 * - **Taken**, it shows as taken (its `_taken` frame) and comes again after its respawn days, never
 *   out of season (decision S14-72); the kelp comes again at the dawn after a storm too. The seals
 *   are limited to perSeason in their days, a peat bank to perSeason loads until its reset season,
 *   and a fishing rock to its season's catches a day.
 * - **Gathering** goes into the home's stores the way driftwood does (decision S14-73): fresh food
 *   into `fresh` with its own keeping days, bundles, loads and hides into `stores`; the minutes pass
 *   and the stamina is spent as Book 10 gives, with the tool it needs in hand or carried.
 *
 * The state is `RegionState.resourceNodes` (by node key, beside the driftwood spots). Pure and
 * deterministic: no random stream is drawn.
 */
import type { NodeBalance, NodeKind } from '../../content/islandBalance.ts';
import type { NodeDef } from '../../content/islandSchema.ts';
import type { Id } from '../../core/ids.ts';
import { DAYS_PER_SEASON, seasonOf, tideAt } from '../calendar/calendar.ts';
import { spendOnTask } from '../home/stamina.ts';
import { weatherToday } from '../sea/weather.ts';
import type { WorldState } from '../world.ts';
import { dayOfYear, regionOf } from './islandConditions.ts';
import type { IslandContext } from './islandConditions.ts';

export interface NodeEvent {
  readonly type: 'NODE_GATHERED';
  readonly key: string;
  readonly kind: NodeKind;
  readonly freshRd: number;
  readonly stores: Readonly<Record<string, number>>;
  readonly minutes: number;
  readonly x: number;
  readonly y: number;
}

/** A node's Book 10 row. */
export function nodeBalance(ctx: Pick<IslandContext, 'ib'>, n: NodeDef): NodeBalance {
  const nb = ctx.ib.nodes.get(n.kind);
  if (nb === undefined) throw new Error(`no Book 10 row for resource node kind ${n.kind}`);
  return nb;
}

/** The first day of the season (or day window) a day falls in, for a limited node's count. */
function countSince(nb: NodeBalance, day: number): number {
  const seasonStart = day - ((day - 1) % DAYS_PER_SEASON);
  if (nb.resetSeason !== null) {
    // A peat bank is cut back until its reset season comes round again.
    let d = seasonStart;
    while (seasonOf(d) !== nb.resetSeason && d > 1) d -= DAYS_PER_SEASON;
    return d;
  }
  if (nb.days !== undefined) return day - (dayOfYear(day) - nb.days[0]);
  if (nb.perDay !== null) return day;
  return seasonStart;
}

/** Whether the node is there at all now: its season or days, its tide, a calm winter day. */
export function nodeExists(world: WorldState, ctx: IslandContext, n: NodeDef): boolean {
  const nb = nodeBalance(ctx, n);
  const day = world.calendar.day;
  const season = seasonOf(day);
  if (!nb.seasons.includes(season)) return false;
  if (nb.days !== undefined) {
    const d = dayOfYear(day);
    if (d < nb.days[0] || d > nb.days[1]) return false;
  }
  if (nb.winterCalmOnly && season === 'Winter' && weatherToday(world)?.calm !== true) return false;
  if (nb.tide === 'LOW' && !tideAt(world.calendar, ctx.b).tidalGroundOpen) return false;
  return true;
}

/** Whether it can be gathered now: there, not waiting to come again, and within its limits. */
export function nodeAvailable(world: WorldState, ctx: IslandContext, n: NodeDef): boolean {
  if (!nodeExists(world, ctx, n)) return false;
  const nb = nodeBalance(ctx, n);
  const s = world.regions[ctx.region]?.resourceNodes[n.key];
  if (s === undefined) return true;
  const day = world.calendar.day;
  const since = countSince(nb, day);
  const taken = s.since === since ? (s.taken ?? 0) : 0;
  if (nb.perSeason !== null && taken >= nb.perSeason) return false;
  if (nb.perDay !== null && taken >= nb.perDay[seasonOf(day)]) return false;
  return s.nextDay <= day;
}

/** The nodes of a scene as drawn now (tiles, at the foot): present, taken, or not there. */
export function nodeProps(
  world: WorldState,
  ctx: IslandContext,
  zone: Id,
): { key: string; frame: string; x: number; y: number }[] {
  const out: { key: string; frame: string; x: number; y: number }[] = [];
  for (const n of ctx.island.nodes) {
    if (n.scene !== zone || !nodeExists(world, ctx, n)) continue;
    const frame = nodeAvailable(world, ctx, n) ? n.frame : `${n.frame}_taken`;
    out.push({ key: n.key, frame: `${frame}/-/0`, x: n.x, y: n.y });
  }
  return out;
}

/** Whether the steerer has a tool the node needs, in a slot or carried (none needed: true). */
export function hasTool(world: WorldState, nb: NodeBalance): boolean {
  if (nb.tools.length === 0) return true;
  const p = world.player;
  return nb.tools.some((t) => p.hotbar.slots.includes(t) || (p.inventory[t] ?? 0) > 0);
}

export interface GatherHooks {
  /** Passes game minutes through the home step, as a task's minutes do. */
  readonly advance: (minutes: number) => void;
}

/**
 * Gathers from a node: its yield into the home's stores, its minutes passed and its stamina spent;
 * the node is then taken until its respawn (and counted against its limits). Returns false, doing
 * nothing, if it cannot be gathered now or the tool it needs is not to hand.
 */
export function gatherNode(
  world: WorldState,
  ctx: IslandContext,
  key: string,
  hooks: GatherHooks,
  emit: (e: NodeEvent) => void,
): boolean {
  const n = ctx.island.nodes.find((x) => x.key === key);
  if (n === undefined || !nodeAvailable(world, ctx, n)) return false;
  const nb = nodeBalance(ctx, n);
  if (!hasTool(world, nb)) return false;
  const home = world.homes['ISLE_SKARV'];
  if (home === undefined) return false;
  const day = world.calendar.day;
  const region = regionOf(world, ctx);
  const prev = region.resourceNodes[n.key];
  const since = countSince(nb, day);
  const taken = (prev?.since === since ? (prev.taken ?? 0) : 0) + 1;
  // A node with no respawn (the seals, a peat bank, a rock) waits only for its limits.
  const nextDay = nb.respawnDays > 0 ? day + nb.respawnDays : day;
  region.resourceNodes[n.key] = { nextDay, taken, since };
  if (nb.yield.freshRd > 0) home.fresh.push({ rd: nb.yield.freshRd, day, keeps: nb.yield.keepsDays });
  for (const [res, amount] of Object.entries(nb.yield.stores))
    home.stores[res] = (home.stores[res] ?? 0) + amount;
  if (n.kind === 'seals') world.facts['sealsKilled'] = Number(world.facts['sealsKilled'] ?? 0) + 1;
  if (n.kind === 'peat') world.facts['bog.peat.cut'] = true;
  spendOnTask(world.player.stamina, nb.stamina, world.tick);
  emit({
    type: 'NODE_GATHERED',
    key: n.key,
    kind: n.kind,
    freshRd: nb.yield.freshRd,
    stores: nb.yield.stores,
    minutes: nb.minutes,
    x: n.x,
    y: n.y,
  });
  hooks.advance(nb.minutes);
  return true;
}

/**
 * The dawn after a storm (Book 10 kelp: "and again at the dawn after a storm"): every taken node
 * that comes again after storms is ready again.
 */
export function stormDawnNodes(world: WorldState, ctx: IslandContext): void {
  const region = world.regions[ctx.region];
  if (region === undefined) return;
  for (const n of ctx.island.nodes) {
    if (!nodeBalance(ctx, n).afterStorm) continue;
    const s = region.resourceNodes[n.key];
    if (s !== undefined && s.nextDay > world.calendar.day)
      region.resourceNodes[n.key] = { ...s, nextDay: world.calendar.day };
  }
}

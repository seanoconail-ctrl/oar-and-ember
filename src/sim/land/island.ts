/**
 * Stage 14, work package C: the island's collectibles, puzzles, resource nodes, discovery and side
 * aims joined into what the simulation calls (src/sim/simulation.ts): the context built once, the
 * uses Interact offers in the scene in view (one list with the camp's, decision DH-10), what each
 * does, and the tick's step. See collectibles.ts, puzzles.ts, resources.ts, discovery.ts and
 * src/sim/narrative/sideAims.ts for the rules. Pure and deterministic.
 *
 * A use's site names what it is: `col:<key>` a collectible, `puz:<key>` a puzzle place,
 * `node:<key>` a resource node, `drowned:thorkel` Thorkel among the drowned.
 */
import type { TimeBalance } from '../../content/balance.ts';
import { parseTimeBalance } from '../../content/balance.ts';
import { hasIslandBalance, parseIslandBalance } from '../../content/islandBalance.ts';
import { parseOpeningBalance } from '../../content/openingBalance.ts';
import { parsePeopleBalance } from '../../content/peopleBalance.ts';
import type { Content } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { DAYS_PER_YEAR } from '../calendar/calendar.ts';
import type { PlacedUse } from '../home/camp.ts';
import type { FindEvent } from '../narrative/finds.ts';
import { sideAimsMinute } from '../narrative/sideAims.ts';
import type { SideAimEvent, SideAimHooks, SideAimSpeech } from '../narrative/sideAims.ts';
import type { WorldState } from '../world.ts';
import { collect, collectibleHere, collectibleProps, syncFinds } from './collectibles.ts';
import { stepDiscovery } from './discovery.ts';
import type { DiscoveryEvent } from './discovery.ts';
import type { IslandContext } from './islandConditions.ts';
import {
  puzzleProps,
  puzzleUsesIn,
  speakThorkel,
  stepFoggyFeast,
  stepPassage,
  stepPuzzles,
  thorkelHere,
  usePuzzle,
} from './puzzles.ts';
import type { PuzzleEvent } from './puzzles.ts';
import { gatherNode, hasTool, nodeAvailable, nodeBalance, nodeProps } from './resources.ts';
import type { NodeEvent } from './resources.ts';
import type { ZoneMap } from './zoneMap.ts';

export type { IslandContext } from './islandConditions.ts';

export type IslandEvent =
  PuzzleEvent | DiscoveryEvent | NodeEvent | FindEvent | SideAimEvent | SideAimSpeech;

/** The island's context, or null where content or balance.json lacks Stage 14's parts. */
export function islandContext(
  content: Pick<Content, 'zoneMaps'> &
    Partial<Pick<Content, 'puzzles' | 'island' | 'finds' | 'opening'>>,
  balance: unknown,
): IslandContext | null {
  if (content.puzzles == null || content.island == null || !hasIslandBalance(balance)) return null;
  const b: TimeBalance = parseTimeBalance(balance);
  // Book 10's stuck help is in real seconds; the side aims count game minutes in their scene.
  const minutes = (s: number): number => Math.ceil((s * 60) / b.secondsPerHour);
  const g = content.opening == null ? null : parseOpeningBalance(balance).guidance;
  return {
    b,
    ib: parseIslandBalance(balance),
    puzzles: content.puzzles,
    island: content.island,
    collectibles: content.finds?.collectibles ?? [],
    finds: content.finds ?? null,
    maps: content.zoneMaps,
    region: 'REG_SK',
    earshotTiles: parsePeopleBalance(balance).talk.earshotTiles,
    stuck: {
      firstMinutes: g === null ? DAYS_PER_YEAR * 1440 : minutes(g.stuckFirstSeconds),
      secondMinutes: g === null ? DAYS_PER_YEAR * 1440 : minutes(g.stuckSecondSeconds),
    },
  };
}

/** Everything Interact can do with the island's things in the scene in view. */
export function islandUses(world: WorldState, ctx: IslandContext, map: ZoneMap): PlacedUse[] {
  if (world.onFoot?.carrying !== null || world.talk !== null) return [];
  const t = map.tile;
  const out: PlacedUse[] = [];
  for (const c of ctx.collectibles) {
    if (c.scene !== map.zone || !collectibleHere(world, ctx, c)) continue;
    // The drowned: only the one whose turn it is answers (all five share the skerry's place).
    if (c.use === 'TALK' && out.some((u) => u.use.kind === 'FIND' && u.use.verb === 'TALK'))
      continue;
    out.push({
      use: {
        kind: 'FIND',
        site: `col:${c.key}`,
        take: c.use === 'TAKE',
        nameKey: c.nameKey,
        ...(c.use === 'TALK' ? { verb: 'TALK' as const } : {}),
      },
      x: c.pos.x * t,
      y: c.pos.y * t,
    });
  }
  for (const u of puzzleUsesIn(world, ctx, map.zone))
    out.push({
      use: { kind: 'FIND', site: `puz:${u.key}`, take: u.verb === 'TAKE', nameKey: u.nameKey },
      x: u.x * t,
      y: u.y * t,
    });
  const d = ctx.puzzles.drowned;
  if (map.zone === d.scene && thorkelHere(world, ctx))
    out.push({
      use: {
        kind: 'FIND',
        site: 'drowned:thorkel',
        take: false,
        nameKey: d.thorkel.nameKey,
        verb: 'TALK',
      },
      x: d.thorkel.x * t,
      y: d.thorkel.y * t,
    });
  for (const n of ctx.island.nodes) {
    if (n.scene !== map.zone || !nodeAvailable(world, ctx, n)) continue;
    // A node whose tool is not to hand offers nothing (no prompt for what the key cannot do).
    if (!hasTool(world, nodeBalance(ctx, n))) continue;
    out.push({
      use: {
        kind: 'FIND',
        site: `node:${n.key}`,
        take: true,
        nameKey: `island.node.name.${n.kind.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`,
        verb: 'GATHER',
      },
      x: n.x * t,
      y: n.y * t,
    });
  }
  return out;
}

/** Whether a use's site is one of the island's. */
export const isIslandSite = (site: string): boolean => /^(col|puz|node|drowned):/.test(site);

export interface IslandUseHooks {
  /** Passes game minutes through the home step (a node's gathering). */
  readonly advance: (minutes: number) => void;
}

/** What an island use does. Returns false if nothing could be done now. */
export function useIsland(
  world: WorldState,
  ctx: IslandContext,
  site: string,
  hooks: IslandUseHooks,
  emit: (e: IslandEvent) => void,
): boolean {
  const [kind, key = ''] = site.split(/:(.*)/s);
  switch (kind) {
    case 'col':
      return collect(world, ctx, key, emit, emit);
    case 'puz':
      return usePuzzle(world, ctx, key, emit);
    case 'drowned':
      return key === 'thorkel' && speakThorkel(world, ctx, emit);
    case 'node': {
      const done = gatherNode(world, ctx, key, hooks, emit);
      const n = ctx.island.nodes.find((x) => x.key === key);
      if (done && n !== undefined)
        emit({
          type: 'FIND_MADE',
          key: `node:${key}`,
          sound: `GATHER_${n.kind.replace(/[A-Z]/g, (m) => `_${m}`).toUpperCase()}`,
          captionKey: `caption.find.node.${n.kind.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`,
          first: true,
          food: nodeBalance(ctx, n).yield.freshRd,
          silver: 0,
          collectible: 0,
          x: n.x,
          y: n.y,
        });
      return done;
    }
    default:
      return false;
  }
}

/** What the step needs of the simulation round it. */
export interface IslandStepHooks {
  /** The nearest of these residents in earshot of the steerer, or null. */
  readonly nearestResident: (ids: readonly Id[]) => Id | null;
  readonly sideAims: SideAimHooks;
}

/** One tick: Chapter 1 finds counted, discovery, puzzles, the passage, the feast and side aims. */
export function stepIsland(
  world: WorldState,
  ctx: IslandContext,
  hooks: IslandStepHooks,
  emit: (e: IslandEvent) => void,
): void {
  if (world.onFoot === null) return;
  const minute = world.calendar.day * 1440 + world.calendar.minuteOfDay;
  syncFinds(world, ctx);
  stepDiscovery(world, ctx, emit);
  stepPuzzles(world, ctx, emit);
  stepPassage(world, ctx, emit);
  stepFoggyFeast(world, ctx, hooks.nearestResident, emit);
  // The side aims count game minutes: once a minute, as the calendar turns.
  if (world.facts['island.minute'] !== minute) {
    world.facts['island.minute'] = minute;
    sideAimsMinute(world, ctx, hooks.sideAims, emit);
  }
}

/** Everything of the island's drawn in a scene now (tiles, at the foot). */
export function islandProps(
  world: WorldState,
  ctx: IslandContext,
  zone: Id,
): { sheet: string; frame: string; x: number; y: number }[] {
  return [
    ...collectibleProps(world, ctx, zone),
    ...puzzleProps(world, ctx, zone).map((p) => ({ sheet: 'prop_collectibles', ...p })),
    ...nodeProps(world, ctx, zone).map((p) => ({
      sheet: 'prop_island_nodes',
      frame: p.frame,
      x: p.x,
      y: p.y,
    })),
  ];
}

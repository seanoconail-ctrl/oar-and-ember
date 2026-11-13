/**
 * "Nothing that way" (Book 2 section 10, "Doors, edges and things with a home"; Book 10 section 25,
 * "World feedback"; decision DE-25). Walking into an edge or impassable ground stops the steerer
 * cleanly: pressed more than Book 10's edgeStopAngle into it, they stop at it, with no sliding
 * along an invisible wall; pressed at a shallower angle, they move along it at that angle's share
 * of the speed (the part of the step along the edge), so a walk beside a shore is never caught.
 * After edgeCaptionAfter of pressing, the edge's information caption shows, by what the ground is:
 * deep water DEEP ("The water's too deep"), a bank face or rock STEEP ("Too steep to climb"), the
 * end of a zone with no link and anything else NOTHING ("Nothing that way"), at most once in
 * edgeCaptionCooldown. Pure and deterministic.
 */
import type { Id } from '../../core/ids.ts';
import { setFact } from '../ledger/ledger.ts';
import type { WorldState } from '../world.ts';
import { compass, footprintClear, TICKS_PER_SECOND } from './onFoot.ts';
import type { LandContext } from './onFoot.ts';
import { entryPoint, linkOf } from './zoneLinks.ts';
import type { Edge } from './zoneLinks.ts';
import { solidAt, terrainAt, tileOf } from './zoneMap.ts';
import type { ZoneMap } from './zoneMap.ts';

/** Book 2 section 10: which caption an edge gives. */
export type EdgeKindName = 'NOTHING' | 'DEEP' | 'STEEP';
export interface EdgeKind {
  readonly kind: EdgeKindName;
}

/** What a blocked step pressed against (the steerer's step, from stepMovement). */
export interface EdgePress {
  /** The way the steerer pressed (unit vector). */
  readonly x: number;
  readonly y: number;
  /** Where the step would have gone that was refused. */
  readonly at: { readonly x: number; readonly y: number };
  /** The map's own edge was pressed against (a zone boundary). */
  readonly boundary: Edge | null;
  /** The water there is too deep (the depth rule refused it). */
  readonly deep: boolean;
}

/**
 * One step against the ground's edges. `clear` says whether the feet may stand at a point.
 * Returns where the feet end, and what was pressed against when the wanted step was refused.
 */
export function edgeStep(
  x: number,
  y: number,
  dx: number,
  dy: number,
  clear: (x: number, y: number) => boolean,
  stopDegrees: number,
): { x: number; y: number; blocked: boolean } {
  if (dx === 0 && dy === 0) return { x, y, blocked: false };
  if (clear(x + dx, y + dy)) return { x: x + dx, y: y + dy, blocked: false };
  const canX = dx !== 0 && clear(x + dx, y);
  const canY = dy !== 0 && clear(x, y + dy);
  // The angle into the edge: the share of the step that presses into it against the share along.
  const tan = Math.tan((stopDegrees * Math.PI) / 180);
  const alongX = (): boolean => Math.abs(dy) <= Math.abs(dx) * tan + 1e-9;
  const alongY = (): boolean => Math.abs(dx) <= Math.abs(dy) * tan + 1e-9;
  if (canX && !canY) return alongX() ? { x: x + dx, y, blocked: true } : { x, y, blocked: true };
  if (canY && !canX) return alongY() ? { x, y: y + dy, blocked: true } : { x, y, blocked: true };
  if (canX && canY) {
    // A corner: along the larger share, which is never more than the stop angle into the corner.
    return Math.abs(dx) >= Math.abs(dy)
      ? { x: x + dx, y, blocked: true }
      : { x, y: y + dy, blocked: true };
  }
  return { x, y, blocked: true };
}

/**
 * What a refused step pressed against: the way it went, where it would have gone, the map's own
 * edge if the footprint would have left the zone, and whether deep water refused it.
 */
export function edgePressAt(
  map: ZoneMap,
  rules: { readonly footprint: { readonly w: number; readonly h: number } },
  p: { readonly x: number; readonly y: number },
  dx: number,
  dy: number,
  depthOk: (x: number, y: number) => boolean,
): EdgePress {
  const len = Math.hypot(dx, dy) || 1;
  const at = { x: p.x + dx, y: p.y + dy };
  const f = rules.footprint;
  const W = map.width * map.tile;
  const H = map.height * map.tile;
  const boundary: Edge | null =
    dy < 0 && at.y - f.h < 0
      ? 'n'
      : dy > 0 && at.y >= H
        ? 's'
        : dx < 0 && at.x - f.w / 2 < 0
          ? 'w'
          : dx > 0 && at.x + f.w / 2 >= W
            ? 'e'
            : null;
  return { x: dx / len, y: dy / len, at, boundary, deep: !depthOk(at.x, at.y) };
}

/** The kind of edge pressed against: deep water, a bank or rock, or nothing beyond. */
export function edgeKindAt(
  map: ZoneMap,
  press: EdgePress,
  maps?: ReadonlyMap<Id, ZoneMap>,
  tidalGroundOpen = false,
): EdgeKindName | 'LINK' {
  if (press.boundary !== null) {
    const to = linkOf(map, press.boundary, press.at, maps);
    return to !== null ? 'LINK' : 'NOTHING';
  }
  if (press.deep) return 'DEEP';
  // What lies just ahead of the feet, a little past the refused step.
  const ahead = { x: press.at.x + press.x * 6, y: press.at.y + press.y * 6 };
  const { tx, ty } = tileOf(map, ahead.x, ahead.y);
  if (solidAt(map, tx, ty)) return 'NOTHING';
  const t = terrainAt(map, tx, ty);
  if (t === 'rock' || t === 'bank') return 'STEEP';
  if (t === 'sea' || (t === 'flats' && !tidalGroundOpen) || t === 'stream') return 'DEEP';
  return 'NOTHING';
}

export const EDGE_CAPTIONS: Readonly<Record<EdgeKindName, string>> = {
  NOTHING: 'caption.edge.nothing',
  DEEP: 'caption.edge.deep',
  STEEP: 'caption.edge.steep',
};

export interface EdgeEvent {
  readonly type: 'EDGE_CAPTION';
  readonly kind: EdgeKindName;
  readonly key: string;
  /** "Nothing that way" with a real, open way named (the user's fourth playtest, DH-36). */
  readonly way?: OpenWay;
}

/** The nearest open way into the next zone: where it leads and which way it lies. */
export interface OpenWay {
  readonly to: Id;
  readonly direction: ReturnType<typeof compass>;
}

/**
 * The nearest open crossing into a next zone from where the steerer stands (Book 10 edgeWay): a
 * point along a linked edge, a tile apart, where the edge really leads on (its neighbour lies
 * beyond), the ground there can be stood on, and the next zone's ground can be entered at the tide
 * now. Null when there is none.
 */
export function openWayFrom(
  map: ZoneMap,
  maps: ReadonlyMap<Id, ZoneMap>,
  p: { readonly x: number; readonly y: number },
  rules: LandContext['rules'],
  tidalGroundOpen: boolean,
): OpenWay | null {
  const T = map.tile;
  const W = map.width * T;
  const H = map.height * T;
  const f = rules.footprint;
  let best: { to: Id; at: { x: number; y: number }; d: number } | null = null;
  for (const link of map.links ?? []) {
    const to = maps.get(link.to);
    if (to === undefined) continue;
    const along = link.edge === 'n' || link.edge === 's' ? map.width : map.height;
    for (let k = 0; k < along; k++) {
      const at =
        link.edge === 'n'
          ? { x: (k + 0.5) * T, y: f.h + 2 }
          : link.edge === 's'
            ? { x: (k + 0.5) * T, y: H - 2 }
            : link.edge === 'w'
              ? { x: f.w / 2 + 2, y: (k + 0.6) * T }
              : { x: W - f.w / 2 - 2, y: (k + 0.6) * T };
      if (linkOf(map, link.edge, at, maps) !== link.to) continue;
      if (!footprintClear(map, rules, at.x, at.y, tidalGroundOpen)) continue;
      const out =
        link.edge === 'n'
          ? { x: at.x, y: -T * 0.5 }
          : link.edge === 's'
            ? { x: at.x, y: H + T * 0.5 }
            : link.edge === 'w'
              ? { x: -T * 0.5, y: at.y }
              : { x: W + T * 0.5, y: at.y };
      if (entryPoint(map, to, out.x, out.y, { rules }, tidalGroundOpen) === null) continue;
      const d = Math.hypot(at.x - p.x, at.y - p.y);
      if (best === null || d < best.d) best = { to: link.to, at, d };
    }
  }
  return best === null ? null : { to: best.to, direction: compass(p, best.at) };
}

const FACT_SINCE = 'edge.since';
const FACT_SAID = 'edge.said';

/**
 * The caption's timing, each tick: pressing against an edge for edgeCaptionAfter shows its
 * caption, at most once in edgeCaptionCooldown. `kind` is null when nothing is pressed against
 * (or only a link, which leads on).
 */
export function stepEdges(
  world: WorldState,
  kind: EdgeKindName | null,
  timing: { readonly afterSeconds: number; readonly cooldownSeconds: number },
  emit: (e: EdgeEvent) => void,
  /** The open way to name with "Nothing that way" (DH-36), asked only when it is said. */
  wayNow?: () => OpenWay | null,
): void {
  const since = world.facts[FACT_SINCE];
  if (kind === null) {
    if (since !== undefined && since !== -1) setFact(world, FACT_SINCE, -1);
    return;
  }
  if (typeof since !== 'number' || since < 0) {
    setFact(world, FACT_SINCE, world.tick);
    return;
  }
  if (world.tick - since < Math.round(timing.afterSeconds * TICKS_PER_SECOND)) return;
  const said = world.facts[FACT_SAID];
  if (typeof said === 'number' && world.tick - said < timing.cooldownSeconds * TICKS_PER_SECOND)
    return;
  setFact(world, FACT_SAID, world.tick);
  const way = kind === 'NOTHING' ? (wayNow?.() ?? null) : null;
  emit({ type: 'EDGE_CAPTION', kind, key: EDGE_CAPTIONS[kind], ...(way === null ? {} : { way }) });
}

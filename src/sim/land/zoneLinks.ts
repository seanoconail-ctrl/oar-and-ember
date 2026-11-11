/**
 * Walking from one zone into the next (Book 2 section 10: home and island are scenes joined by
 * links on foot). A zone map's `links` name the edges that lead on, and zones line up by their
 * `origin` on the island, so a point crossing an edge keeps its island position. The zone left
 * behind keeps its people, items and stuck missiles (`onFoot.elsewhere`) for when it is walked
 * back into. Pure and deterministic.
 */
import type { Id } from '../../core/ids.ts';
import { footprintClear } from './onFoot.ts';
import type { LandContext, OnFootActor, OnFootState, ZoneRest } from './onFoot.ts';
import type { ZoneMap } from './zoneMap.ts';

export type Edge = 'n' | 's' | 'e' | 'w';

/** How close to an edge (pixels from the footprint's edge to the map's) counts as at it. */
export const EDGE_MARGIN = 1.5;

/** The edge a point at the feet is pressing against, given the way it wants to go. */
export function edgeAt(
  map: ZoneMap,
  x: number,
  y: number,
  footprint: { readonly w: number; readonly h: number },
  want: { readonly x: number; readonly y: number },
): Edge | null {
  const W = map.width * map.tile;
  const H = map.height * map.tile;
  if (want.y < 0 && y - footprint.h <= EDGE_MARGIN) return 'n';
  if (want.y > 0 && y >= H - EDGE_MARGIN) return 's';
  if (want.x < 0 && x - footprint.w / 2 <= EDGE_MARGIN) return 'w';
  if (want.x > 0 && x + footprint.w / 2 >= W - EDGE_MARGIN) return 'e';
  return null;
}

/** The zone an edge leads to, if any. */
export function linkOf(map: ZoneMap, edge: Edge): Id | null {
  return map.links?.find((l) => l.edge === edge)?.to ?? null;
}

/** A point in one zone's pixels as the same island point in another's. */
export function translate(
  from: ZoneMap,
  to: ZoneMap,
  x: number,
  y: number,
): { x: number; y: number } {
  const fo = from.origin ?? { x: 0, y: 0 };
  const tt = to.origin ?? { x: 0, y: 0 };
  return { x: x + (fo.x - tt.x) * from.tile, y: y + (fo.y - tt.y) * from.tile };
}

/** Pulls a translated point just inside the zone's edges, so the footprint fits. */
export function inside(
  map: ZoneMap,
  p: { x: number; y: number },
  footprint: { readonly w: number; readonly h: number },
): { x: number; y: number } {
  const W = map.width * map.tile;
  const H = map.height * map.tile;
  const m = EDGE_MARGIN + 1;
  return {
    x: Math.min(W - footprint.w / 2 - m, Math.max(footprint.w / 2 + m, p.x)),
    y: Math.min(H - m, Math.max(footprint.h + m, p.y)),
  };
}

/** Where the steerer would enter `to` from `from` at (x, y), or null if that ground is closed. */
export function entryPoint(
  from: ZoneMap,
  to: ZoneMap,
  x: number,
  y: number,
  ctx: Pick<LandContext, 'rules'>,
  tidalGroundOpen: boolean,
): { x: number; y: number } | null {
  const p = inside(to, translate(from, to, x, y), ctx.rules.footprint);
  return footprintClear(to, ctx.rules, p.x, p.y, tidalGroundOpen) ? p : null;
}

/** The rest of a zone not in view: who is there, what lies there, what is stuck there. */
export function restOf(onFoot: OnFootState, zone: Id): ZoneRest {
  onFoot.elsewhere ??= {};
  let rest = onFoot.elsewhere[zone];
  if (rest === undefined) {
    rest = { actors: {}, items: [], stuck: [] };
    onFoot.elsewhere[zone] = rest;
  }
  return rest;
}

/**
 * Moves the scene into zone `to` with the steerer at `at`: the zone left keeps its people (but
 * not anyone carried), items and stuck missiles; the zone entered brings back its own. Missiles
 * in flight are dropped.
 */
export function switchZone(onFoot: OnFootState, to: Id, at: { x: number; y: number }): void {
  const from = onFoot.zone;
  if (from === to) return;
  const left = restOf(onFoot, from);
  const carried = onFoot.carrying === null ? undefined : onFoot.actors[onFoot.carrying];
  const staying: Record<Id, OnFootActor> = {};
  for (const [id, a] of Object.entries(onFoot.actors)) if (id !== onFoot.carrying) staying[id] = a;
  left.actors = staying;
  left.items = onFoot.items;
  left.stuck = onFoot.stuck;
  const entered = restOf(onFoot, to);
  onFoot.zone = to;
  onFoot.actors = entered.actors;
  onFoot.items = entered.items;
  onFoot.stuck = entered.stuck;
  onFoot.elsewhere = without(onFoot.elsewhere ?? {}, to);
  onFoot.projectiles = [];
  onFoot.player.x = at.x;
  onFoot.player.y = at.y;
  if (carried !== undefined && onFoot.carrying !== null) {
    carried.x = at.x;
    carried.y = at.y;
    onFoot.actors[onFoot.carrying] = carried;
  }
}

/** The zone an actor is in, and the record that holds them (null if nowhere). */
export function findActor(
  onFoot: OnFootState,
  id: Id,
): { zone: Id; actor: OnFootActor; visible: boolean } | null {
  const here = onFoot.actors[id];
  if (here !== undefined) return { zone: onFoot.zone, actor: here, visible: true };
  for (const [zone, rest] of Object.entries(onFoot.elsewhere ?? {}).sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    const a = rest.actors[id];
    if (a !== undefined) return { zone, actor: a, visible: false };
  }
  return null;
}

/** Moves an actor into a zone (out of whichever holds them now). */
export function placeActor(onFoot: OnFootState, id: Id, zone: Id, actor: OnFootActor): void {
  onFoot.actors = without(onFoot.actors, id);
  for (const rest of Object.values(onFoot.elsewhere ?? {})) rest.actors = without(rest.actors, id);
  if (zone === onFoot.zone) onFoot.actors[id] = actor;
  else restOf(onFoot, zone).actors[id] = actor;
}

/** A record without one key (kept in key order, so the state hashes the same however built). */
function without<T>(record: Record<Id, T>, key: Id): Record<Id, T> {
  if (!(key in record)) return record;
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

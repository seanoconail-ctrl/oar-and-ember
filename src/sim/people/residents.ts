/**
 * Where residents are and where they are going (Stage 7, v0 of Stage 8's schedules): each
 * resident has a place they want to be (`ResidentPlace`): a spot in a zone and a pose. In the
 * zone in view they walk there over the tiles at walking pace, crossing into a neighbouring zone
 * at its edge; out of view they are simply there, so time skipped (a task's minutes, a night)
 * never leaves anyone stranded. Deterministic: people are stepped in ID order.
 */
import type { Id } from '../../core/ids.ts';
import { planWalk, walkAlong } from '../land/path.ts';
import type { LandContext, OnFootActor, OnFootState, Pose } from '../land/onFoot.ts';
import { findActor, inside, placeActor, translate } from '../land/zoneLinks.ts';
import type { Edge } from '../land/zoneLinks.ts';
import type { Facing, ZoneMap } from '../land/zoneMap.ts';

export interface ResidentPlace {
  readonly zone: Id;
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  /** The pose once there; walking in between. */
  readonly pose: Pose;
  /** The task worked there (pose 'work'). */
  readonly task?: Id;
}

/** The edge of `from` that leads to `to`. */
function edgeTo(map: ZoneMap, to: Id): Edge | null {
  return map.links?.find((l) => l.to === to)?.edge ?? null;
}

/**
 * The next zone on the shortest chain of links from `from` to `to` (decision DE-88): a resident
 * finds their way through the zones between, not only across a shared edge. Null with no way.
 */
function nextZone(maps: ReadonlyMap<Id, ZoneMap>, from: Id, to: Id): Id | null {
  if (from === to) return to;
  const came = new Map<Id, Id>([[from, from]]);
  const queue: Id[] = [from];
  for (const z of queue) {
    if (z === to) break;
    for (const l of maps.get(z)?.links ?? [])
      if (!came.has(l.to)) {
        came.set(l.to, z);
        queue.push(l.to);
      }
  }
  if (!came.has(to)) return null;
  let at = to;
  while (came.get(at) !== from) at = came.get(at) ?? from;
  return at;
}

/** A point just inside an edge, in line with (x, y). */
function atEdge(map: ZoneMap, edge: Edge, x: number, y: number): { x: number; y: number } {
  const W = map.width * map.tile;
  const H = map.height * map.tile;
  switch (edge) {
    case 'n':
      return { x, y: 6 };
    case 's':
      return { x, y: H - 3 };
    case 'w':
      return { x: 8, y };
    case 'e':
      return { x: W - 8, y };
  }
}

/** Puts an actor in their place's pose, facing its way. */
function settle(actor: OnFootActor, place: ResidentPlace): void {
  actor.pose = place.pose;
  actor.facing = place.facing;
  delete actor.walk;
  delete actor.moving;
  if (place.task !== undefined) actor.task = place.task;
  else delete actor.task;
}

/**
 * Puts a resident at their place at once, in its pose (time skipped: the user's fourth playtest,
 * DH-47). Someone lying hurt, carried, calling or dead is left where they are.
 */
export function putResident(onFoot: OnFootState, id: Id, place: ResidentPlace): void {
  const found = findActor(onFoot, id);
  if (found === null) return;
  const { actor } = found;
  if (['carried', 'down', 'call', 'dead'].includes(actor.pose)) return;
  actor.x = place.x;
  actor.y = place.y;
  settle(actor, place);
  placeActor(onFoot, id, place.zone, actor);
}

/**
 * One tick for a resident who wants to be at `place`. `hold` keeps them standing where they are
 * (Hild waiting for the steerer to catch up while she leads).
 */
export function stepResident(
  onFoot: OnFootState,
  id: Id,
  place: ResidentPlace,
  maps: ReadonlyMap<Id, ZoneMap>,
  land: Pick<LandContext, 'rules' | 'movement'>,
  tidalGroundOpen: boolean,
  hold = false,
  /** Tiles a second (Stage 10: a limp, a carry); the walking speed when not given. */
  speed?: number,
): void {
  const found = findActor(onFoot, id);
  if (found === null) return;
  const { zone, actor, visible } = found;
  if (
    actor.pose === 'carried' ||
    actor.pose === 'down' ||
    actor.pose === 'call' ||
    actor.pose === 'dead'
  )
    return;
  const map = maps.get(zone);
  const target = maps.get(place.zone);
  if (map === undefined || target === undefined) return;
  const there = zone === place.zone && Math.hypot(actor.x - place.x, actor.y - place.y) < 1;
  if (there) {
    if (actor.pose !== place.pose || actor.task !== place.task || actor.walk !== undefined)
      settle(actor, place);
    return;
  }
  if (!visible) {
    if (place.zone !== onFoot.zone) {
      // Out of view, and going somewhere out of view: they are there.
      actor.x = place.x;
      actor.y = place.y;
      settle(actor, place);
      placeActor(onFoot, id, place.zone, actor);
      return;
    }
    // Coming into view: from the edge on the way between their zone and this one, in line.
    const via = nextZone(maps, place.zone, zone);
    const edge = via === null ? null : edgeTo(target, via);
    const t = inside(target, translate(map, target, actor.x, actor.y), land.rules.footprint);
    const entry = edge === null ? { x: place.x, y: place.y } : atEdge(target, edge, t.x, t.y);
    actor.x = entry.x;
    actor.y = entry.y;
    delete actor.walk;
    placeActor(onFoot, id, place.zone, actor);
    return;
  }
  if (hold) {
    delete actor.moving;
    delete actor.walk;
    actor.pose = 'idle';
    return;
  }
  // In view: walk there, or to the edge that leads on towards there.
  const hop = nextZone(maps, zone, place.zone);
  const hopMap = hop === null ? undefined : maps.get(hop);
  const goal =
    zone === place.zone
      ? { x: place.x, y: place.y }
      : ((): { x: number; y: number } | null => {
          const edge = hop === null ? null : edgeTo(map, hop);
          if (edge === null) return null;
          // Make for the edge in line with the place on the island.
          const along = translate(target, map, place.x, place.y);
          return atEdge(
            map,
            edge,
            Math.min(map.width * map.tile - 12, Math.max(12, along.x)),
            along.y,
          );
        })();
  if (goal === null) return;
  if (actor.walk === undefined || Math.hypot(actor.walk.x - goal.x, actor.walk.y - goal.y) > 1) {
    const walk = planWalk(actor, map, goal.x, goal.y, tidalGroundOpen);
    if (walk === null) {
      // No way over the ground: they go round, out of sight.
      actor.x = place.x;
      actor.y = place.y;
      settle(actor, place);
      placeActor(onFoot, id, place.zone, actor);
      return;
    }
    actor.walk = walk;
    actor.pose = 'idle';
    delete actor.task;
  }
  const arrived = walkAlong(
    actor,
    actor.walk,
    map,
    land,
    speed ?? land.movement.walk,
    tidalGroundOpen,
  );
  if (!arrived) return;
  if (zone === place.zone) {
    settle(actor, place);
    return;
  }
  // At the edge: on into the next zone (now out of view, they are placed next tick).
  if (hop === null || hopMap === undefined) return;
  const next = inside(hopMap, translate(map, hopMap, actor.x, actor.y), land.rules.footprint);
  actor.x = next.x;
  actor.y = next.y;
  delete actor.walk;
  placeActor(onFoot, id, hop, actor);
}

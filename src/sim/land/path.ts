/**
 * Walking for people other than the steerer (Stage 7: Hild leading to the broch and going to her
 * work): a breadth-first path over the zone's open tiles, and a step along it at walking pace.
 * Deterministic: tiles in a fixed neighbour order, positions in logical pixels.
 */
import { footprintClear, TICKS_PER_SECOND } from './onFoot.ts';
import type { LandContext, OnFootActor } from './onFoot.ts';
import { blocksMovement, terrainAt, tileOf } from './zoneMap.ts';
import type { ZoneMap } from './zoneMap.ts';

export interface TileXY {
  readonly tx: number;
  readonly ty: number;
}

/** The tiles from `from` to `to` (both included) over open ground, or null if there is no way. */
export function tilePath(
  map: ZoneMap,
  from: TileXY,
  to: TileXY,
  tidalGroundOpen: boolean,
): TileXY[] | null {
  const key = (t: TileXY): number => t.ty * map.width + t.tx;
  const goal = key(to);
  const came = new Map<number, number>([[key(from), -1]]);
  const queue: TileXY[] = [from];
  for (const t of queue) {
    if (key(t) === goal) {
      const out: TileXY[] = [];
      for (let k = goal; k >= 0; k = came.get(k) ?? -1)
        out.unshift({ tx: k % map.width, ty: Math.floor(k / map.width) });
      return out;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { tx: t.tx + dx, ty: t.ty + dy };
      if (n.tx < 0 || n.ty < 0 || n.tx >= map.width || n.ty >= map.height) continue;
      if (came.has(key(n)) || blocksMovement(terrainAt(map, n.tx, n.ty), tidalGroundOpen)) continue;
      came.set(key(n), key(t));
      queue.push(n);
    }
  }
  return null;
}

/** Where a walker is heading: a point in pixels and the tiles of the way there. */
export interface WalkGoal {
  readonly x: number;
  readonly y: number;
  readonly path: readonly TileXY[];
  /** The next path step to make for. */
  next: number;
}

/** Plans a walk from where the actor stands to (x, y) pixels; null when there is no way. */
export function planWalk(
  actor: { readonly x: number; readonly y: number },
  map: ZoneMap,
  x: number,
  y: number,
  tidalGroundOpen: boolean,
): WalkGoal | null {
  const path = tilePath(map, tileOf(map, actor.x, actor.y), tileOf(map, x, y), tidalGroundOpen);
  return path === null ? null : { x, y, path, next: 1 };
}

/**
 * One tick along a planned walk at `speed` tiles a second: towards the centre of each tile of the
 * path in turn, then to the goal point. Returns true on arrival.
 */
export function walkAlong(
  actor: OnFootActor,
  goal: WalkGoal,
  map: ZoneMap,
  ctx: Pick<LandContext, 'rules'>,
  speed: number,
  tidalGroundOpen: boolean,
): boolean {
  const per = (speed * map.tile) / TICKS_PER_SECOND;
  const target = (): { x: number; y: number } => {
    const step = goal.path[goal.next];
    if (step === undefined || goal.next >= goal.path.length - 1) return { x: goal.x, y: goal.y };
    return { x: (step.tx + 0.5) * map.tile, y: (step.ty + 0.6) * map.tile };
  };
  let t = target();
  let dx = t.x - actor.x;
  let dy = t.y - actor.y;
  let d = Math.hypot(dx, dy);
  while (d < per && goal.next < goal.path.length - 1) {
    goal.next++;
    t = target();
    dx = t.x - actor.x;
    dy = t.y - actor.y;
    d = Math.hypot(dx, dy);
  }
  if (d < per) {
    actor.x = t.x;
    actor.y = t.y;
    delete actor.moving;
    return true;
  }
  const mx = (dx / d) * per;
  const my = (dy / d) * per;
  const before = { x: actor.x, y: actor.y };
  if (footprintClear(map, ctx.rules, actor.x + mx, actor.y, tidalGroundOpen)) actor.x += mx;
  if (footprintClear(map, ctx.rules, actor.x, actor.y + my, tidalGroundOpen)) actor.y += my;
  if (actor.x === before.x && actor.y === before.y) {
    // Stuck on a corner: step straight onto the path tile's centre line.
    actor.x += mx;
    actor.y += my;
  }
  actor.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  actor.moving = true;
  return false;
}

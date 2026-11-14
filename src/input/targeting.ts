/**
 * The target tile (Book 2 section 21; Book 10 section 21): the tile the next use or interaction
 * works, chosen per device. Mouse: the tile under the cursor. Gamepad: the right stick sets a tile
 * within reach in its direction; released (inside the dead zone), the tile in front of the
 * steerer. Keyboard only: the tile in front of the steerer's facing. Pure: positions in world
 * pixels, tiles as whole tile coordinates. The simulation never sees any of this, only commands.
 */

export type Device = 'mouse' | 'key' | 'pad';
export type FacingName = 's' | 'n' | 'e' | 'w';

export interface Tile {
  readonly tx: number;
  readonly ty: number;
}

const AHEAD: Readonly<Record<FacingName, readonly [number, number]>> = {
  s: [0, 1],
  n: [0, -1],
  e: [1, 0],
  w: [-1, 0],
};

export interface TargetQuery {
  readonly device: Device;
  readonly steerer: { readonly x: number; readonly y: number; readonly facing: FacingName };
  /** The pointer in world pixels (mouse), or null. */
  readonly pointer: { readonly x: number; readonly y: number } | null;
  /** The right stick, -1 to 1 each axis. */
  readonly stick: { readonly x: number; readonly y: number };
  readonly tileSize: number;
  /** Reach in tiles for this use (toolReach, interactReach or castReach). */
  readonly reach: number;
  /** The right stick's dead zone (gamepadDeadZone). */
  readonly deadZone: number;
}

export function tileAt(x: number, y: number, tileSize: number): Tile {
  return { tx: Math.floor(x / tileSize), ty: Math.floor(y / tileSize) };
}

/** Centre-to-centre distance from the steerer's tile, in tiles (the simulation's own rule). */
export function tileDistance(from: Tile, to: Tile): number {
  return Math.hypot(to.tx - from.tx, to.ty - from.ty);
}

export function targetTile(q: TargetQuery): Tile {
  const own = tileAt(q.steerer.x, q.steerer.y, q.tileSize);
  if (q.device === 'mouse' && q.pointer !== null)
    return tileAt(q.pointer.x, q.pointer.y, q.tileSize);
  const d = Math.hypot(q.stick.x, q.stick.y);
  if (q.device === 'pad' && d > q.deadZone) {
    const ux = q.stick.x / d;
    const uy = q.stick.y / d;
    // The furthest tile in the stick's direction that is still within reach, at least one away.
    for (let r = Math.max(1, q.reach * Math.min(1, d)); r >= 1; r -= 0.5) {
      const t = { tx: own.tx + Math.round(ux * r), ty: own.ty + Math.round(uy * r) };
      if ((t.tx !== own.tx || t.ty !== own.ty) && tileDistance(own, t) <= q.reach + 1e-9) return t;
    }
  }
  const [ax, ay] = AHEAD[q.steerer.facing];
  return { tx: own.tx + ax, ty: own.ty + ay };
}

export function inReach(steerer: { x: number; y: number }, tile: Tile, q: TargetQuery): boolean {
  return tileDistance(tileAt(steerer.x, steerer.y, q.tileSize), tile) <= q.reach + 1e-9;
}

/** The aim direction (0 east, clockwise, of `steps`) from a vector; y runs south. */
export function aimDirection(x: number, y: number, steps: number): number {
  const a = Math.atan2(y, x);
  return ((Math.round(a / ((2 * Math.PI) / steps)) % steps) + steps) % steps;
}

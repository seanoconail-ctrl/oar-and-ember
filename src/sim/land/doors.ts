/**
 * Doors (Book 2 section 10, "Doors, edges and things with a home"; Book 10 section 25, "Doors";
 * Book 9 section 04; decision DE-26). Every door and hide flap is a `DoorDef` in its zone's content
 * and a `DoorState` in `onFoot.doors` for the zone in view. Walked into, interacted with or clicked,
 * a door opens over Book 10's openTicks (a flap's own); it closes closeAfter seconds after its
 * doorway is clear, over closeTicks. Anyone walking through opens it (residents and enemies too).
 * Closed (not fully open) it blocks movement, sight and missiles like a solid tile; open, nothing.
 * A barred door opens only from its bar's side (barring comes with the defences, Stage 19).
 *
 * Doors are simulation state; the renderer draws them from it (Book 7 section 06). Pure and
 * deterministic.
 */
import type { Id } from '../../core/ids.ts';
import type { FactValue } from '../world.ts';
import type { DoorDef, Facing, ZoneMap } from './zoneMap.ts';

export type { DoorDef };

const TICKS = 60;

/** Book 2 section 10, DoorState. */
export interface DoorState {
  readonly id: string;
  /** 0 closed .. 1 open. */
  open: number;
  moving: -1 | 0 | 1;
  /** The tick it is to start closing (its doorway clear). */
  closeAt?: number;
  barred: boolean;
}

/** Book 10 section 25's door timings (src/content/openingBalance.ts). */
export interface DoorTimings {
  readonly openTicks: number;
  readonly openTicksFlap: number;
  readonly closeAfterSeconds: number;
  readonly closeTicks: number;
  readonly closeTicksFlap: number;
}

export interface DoorEvent {
  readonly type: 'DOOR';
  readonly id: string;
  readonly kind: DoorDef['kind'];
  readonly what: 'OPENING' | 'CLOSING' | 'SHUT';
  readonly x: number;
  readonly y: number;
}

/** Where a door is in pixels, and its doorway's rectangle (the part that blocks while closed). */
export function doorRect(
  d: DoorDef,
  tile: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const cx = d.pos.x * tile;
  const cy = d.pos.y * tile;
  const half = (d.width * tile) / 2;
  const depth = tile * 0.45;
  return d.facing === 'n' || d.facing === 's'
    ? { x0: cx - half, y0: cy - depth, x1: cx + half, y1: cy + 1 }
    : { x0: cx - depth / 2, y0: cy - half, x1: cx + depth / 2, y1: cy + half };
}

/** The doors of a zone that exist now (by the camp's stage and their facts). */
export function doorsHere(
  map: ZoneMap,
  stage: string | null,
  facts: Readonly<Record<string, FactValue>>,
): DoorDef[] {
  return (map.doors ?? []).filter(
    (d) =>
      (d.stages === undefined || (stage !== null && d.stages.includes(stage))) &&
      (d.fact === undefined || facts[d.fact] === true),
  );
}

/** Keeps `onFoot.doors` to the zone in view's doors: a door new to the list starts closed. */
export function syncDoors(onFoot: { doors?: DoorState[] }, defs: readonly DoorDef[]): DoorState[] {
  const was = onFoot.doors ?? [];
  const next = defs.map(
    (d) =>
      was.find((s) => s.id === d.id) ?? { id: d.id, open: 0, moving: 0 as const, barred: false },
  );
  if (next.length !== was.length || next.some((s, i) => s !== was[i])) onFoot.doors = next;
  return onFoot.doors ?? next;
}

/** Whether a door is shut enough to block (anything but fully open). */
export function doorClosed(s: DoorState | undefined): boolean {
  return s === undefined || s.open < 1;
}

/** Whether a footprint at (x, y) would stand in a closed door's doorway. */
export function doorBlocks(
  onFoot: { readonly doors?: readonly DoorState[] },
  map: ZoneMap,
  x: number,
  y: number,
  footprint: { readonly w: number; readonly h: number },
): boolean {
  const states = onFoot.doors ?? [];
  if (states.length === 0) return false;
  const left = x - footprint.w / 2;
  const right = x + footprint.w / 2;
  const top = y - footprint.h;
  for (const d of map.doors ?? []) {
    const s = states.find((t) => t.id === d.id);
    if (s === undefined || !doorClosed(s)) continue;
    const r = doorRect(d, map.tile);
    if (right > r.x0 && left < r.x1 && y > r.y0 && top < r.y1) return true;
  }
  return false;
}

/** Whether a point (sight, a missile's path) is in a closed door's doorway. */
export function doorBlocksPoint(
  onFoot: { readonly doors?: readonly DoorState[] },
  map: ZoneMap,
  x: number,
  y: number,
): boolean {
  for (const d of map.doors ?? []) {
    const s = onFoot.doors?.find((t) => t.id === d.id);
    if (s === undefined || !doorClosed(s)) continue;
    const r = doorRect(d, map.tile);
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 - map.tile && y <= r.y1) return true;
  }
  return false;
}

/** Opens a door (walked into, interacted with, clicked), unless barred against this side. */
export function openDoor(
  s: DoorState,
  d: DoorDef,
  from: { readonly x: number; readonly y: number },
  tile: number,
  emit: (e: DoorEvent) => void,
): boolean {
  if (s.barred && d.barSide !== undefined) {
    const cx = d.pos.x * tile;
    const cy = d.pos.y * tile;
    const side: Facing =
      d.facing === 'n' || d.facing === 's' ? (from.y > cy ? 's' : 'n') : from.x > cx ? 'e' : 'w';
    if (side !== d.barSide) return false;
  }
  delete s.closeAt;
  if (s.open >= 1 || s.moving === 1) return true;
  s.moving = 1;
  emit({
    type: 'DOOR',
    id: d.id,
    kind: d.kind,
    what: 'OPENING',
    x: d.pos.x * tile,
    y: d.pos.y * tile,
  });
  return true;
}

/** Someone near a door's doorway and walking at it (or through it). */
function wants(
  who: { readonly x: number; readonly y: number },
  dir: { readonly x: number; readonly y: number } | null,
  d: DoorDef,
  tile: number,
  reach: number,
): boolean {
  const cx = d.pos.x * tile;
  const cy = d.pos.y * tile - tile * 0.2;
  const dx = cx - who.x;
  const dy = cy - who.y;
  const dist = Math.hypot(dx, dy);
  if (dist > reach * tile) return false;
  if (dist < tile * 0.6) return true;
  if (dir === null || (dir.x === 0 && dir.y === 0)) return false;
  return dx * dir.x + dy * dir.y > 0;
}

/** Whether anyone stands in or by the doorway. */
function doorwayClear(
  d: DoorDef,
  tile: number,
  people: readonly { readonly x: number; readonly y: number }[],
): boolean {
  const r = doorRect(d, tile);
  const m = tile * 0.5;
  return !people.some(
    (p) => p.x > r.x0 - m && p.x < r.x1 + m && p.y > r.y0 - m && p.y - 2 < r.y1 + m * 1.6,
  );
}

/**
 * One tick of the zone's doors: whoever walks at one opens it; a door whose doorway has been clear
 * for closeAfter starts to close; doors swing at their kind's pace.
 */
export function stepDoors(
  onFoot: {
    doors?: DoorState[];
    readonly player: {
      readonly x: number;
      readonly y: number;
      readonly intent: { readonly x: number; readonly y: number };
    };
    readonly actors: Readonly<
      Record<
        Id,
        {
          readonly x: number;
          readonly y: number;
          readonly moving?: boolean;
          readonly intent?: { readonly x: number; readonly y: number };
          readonly walk?: { readonly x: number; readonly y: number };
        }
      >
    >;
  },
  map: ZoneMap,
  defs: readonly DoorDef[],
  tick: number,
  t: DoorTimings,
  emit: (e: DoorEvent) => void,
): void {
  const states = syncDoors(onFoot, defs);
  if (states.length === 0) return;
  const tile = map.tile;
  const people: { x: number; y: number }[] = [onFoot.player];
  for (const a of Object.values(onFoot.actors)) people.push(a);
  for (const d of defs) {
    const s = states.find((x) => x.id === d.id);
    if (s === undefined) continue;
    const flap = d.kind === 'FLAP';
    // Walking at it opens it: the steerer pressing towards it, anyone else walking near it.
    const p = onFoot.player;
    let opener: { x: number; y: number } | null = wants(p, p.intent, d, tile, 1.0) ? p : null;
    if (opener === null)
      for (const a of Object.values(onFoot.actors)) {
        if (a.moving !== true) continue;
        const dir =
          a.walk === undefined ? (a.intent ?? null) : { x: a.walk.x - a.x, y: a.walk.y - a.y };
        if (wants(a, dir, d, tile, 1.6)) {
          opener = a;
          break;
        }
      }
    if (opener !== null && s.moving !== 1 && s.open < 1) openDoor(s, d, opener, tile, emit);
    if (opener !== null) delete s.closeAt;
    // Swinging.
    if (s.moving === 1) {
      s.open = Math.min(1, s.open + 1 / (flap ? t.openTicksFlap : t.openTicks));
      if (s.open >= 1) s.moving = 0;
    } else if (s.moving === -1) {
      if (opener !== null) {
        s.moving = 1;
        emit({
          type: 'DOOR',
          id: d.id,
          kind: d.kind,
          what: 'OPENING',
          x: d.pos.x * tile,
          y: d.pos.y * tile,
        });
      } else {
        s.open = Math.max(0, s.open - 1 / (flap ? t.closeTicksFlap : t.closeTicks));
        if (s.open <= 0) {
          s.open = 0;
          s.moving = 0;
          emit({
            type: 'DOOR',
            id: d.id,
            kind: d.kind,
            what: 'SHUT',
            x: d.pos.x * tile,
            y: d.pos.y * tile,
          });
        }
      }
    }
    // Open and clear: it closes behind after a moment.
    if (s.open >= 1 && s.moving === 0) {
      if (!doorwayClear(d, tile, people)) delete s.closeAt;
      else if (s.closeAt === undefined) s.closeAt = tick + Math.round(t.closeAfterSeconds * TICKS);
      else if (tick >= s.closeAt) {
        delete s.closeAt;
        s.moving = -1;
        emit({
          type: 'DOOR',
          id: d.id,
          kind: d.kind,
          what: 'CLOSING',
          x: d.pos.x * tile,
          y: d.pos.y * tile,
        });
      }
    }
    // Round the opening to whole ticks' steps, so every engine stores the same number.
    s.open = Math.round(s.open * 4096) / 4096;
  }
}

/** The door at a tile (a click on it, or the tile above: it is tall). */
export function doorAt(
  defs: readonly DoorDef[],
  tile: number,
  at: { readonly tx: number; readonly ty: number },
): DoorDef | null {
  for (const d of defs) {
    const r = doorRect(d, tile);
    const tx0 = Math.floor(r.x0 / tile);
    const tx1 = Math.floor((r.x1 - 0.01) / tile);
    const ty = Math.floor((d.pos.y * tile - 1) / tile);
    if (at.tx >= tx0 && at.tx <= tx1 && (at.ty === ty || at.ty === ty - 1)) return d;
  }
  return null;
}

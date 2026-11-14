/**
 * Stage 14, work package C's test helpers: walking a scene of Skarvholm under a tide, with the
 * movement verbs its plan marks (Book 2 section 10, "Movement verbs"; src/content/traverseMarks.ts):
 * a climb's column, a crawl's tiles, a jump's take-off to its landing, swimming water. Used by the
 * collectible placement test, the density walker and the puzzle scenarios. Not shipped.
 */
import { marksOf } from '../../src/content/traverseMarks.ts';
import { tileBlocks } from '../../src/sim/land/zoneMap.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';

export interface Tide {
  /** The tidal ground window (low water). */
  readonly low: boolean;
  /** A spring-tide day inside the window (the causeway, the caves' floors). */
  readonly spring: boolean;
}

export const HIGH: Tide = { low: false, spring: false };
export const LOW: Tide = { low: true, spring: false };
export const SPRING_LOW: Tide = { low: true, spring: true };

export type Tile = { readonly tx: number; readonly ty: number };
const key = (x: number, y: number): number => y * 4096 + x;

/** Extra edges and open tiles the plan's marks give (a verb's way). */
function verbGraph(map: ZoneMap, verbs: boolean): { open: Set<number>; edges: Map<number, number[]> } {
  const open = new Set<number>();
  const edges = new Map<number, number[]>();
  if (!verbs) return { open, edges };
  const link = (a: number, b: number): void => {
    (edges.get(a) ?? edges.set(a, []).get(a) ?? []).push(b);
    (edges.get(b) ?? edges.set(b, []).get(b) ?? []).push(a);
  };
  const m = marksOf(map);
  for (const c of m.climbs) for (let y = c.head; y <= c.foot; y++) open.add(key(c.x, y));
  for (const c of m.crawls) for (const [x, y] of c.tiles) open.add(key(x, y));
  for (const j of m.jumps) link(key(j.from.x, j.from.y), key(j.to.x, j.to.y));
  for (const s of m.swims)
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) open.add(key(x, y));
  return { open, edges };
}

/** Whether a tile can be stood on under the tide (no verb). */
export const standable = (map: ZoneMap, t: Tile, tide: Tide): boolean =>
  t.tx >= 0 && t.ty >= 0 && t.tx < map.width && t.ty < map.height && !tileBlocks(map, t.tx, t.ty, tide.low, tide.spring);

/** Every tile reached from `from` on foot under the tide, with the marked verbs if `verbs`. */
export function reach(map: ZoneMap, from: readonly Tile[], tide: Tide, verbs = true): Set<number> {
  const g = verbGraph(map, verbs);
  const seen = new Set<number>();
  const queue: number[] = [];
  for (const f of from) {
    const k = key(f.tx, f.ty);
    if (standable(map, f, tide) || g.open.has(k)) {
      seen.add(k);
      queue.push(k);
    }
  }
  while (queue.length > 0) {
    const k = queue.pop() ?? 0;
    const x = k % 4096;
    const y = Math.floor(k / 4096);
    const next = [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1), ...(g.edges.get(k) ?? [])];
    for (const n of next) {
      if (seen.has(n)) continue;
      const t = { tx: n % 4096, ty: Math.floor(n / 4096) };
      if (t.tx < 0 || t.ty < 0 || t.tx >= map.width || t.ty >= map.height) continue;
      if (!standable(map, t, tide) && !g.open.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}

export const has = (set: Set<number>, t: Tile): boolean => set.has(key(t.tx, t.ty));

/** The tiles where a scene is entered: the first open tile of each linked edge, and its spawn. */
export function entries(map: ZoneMap, tide: Tide = HIGH): Tile[] {
  const out: Tile[] = [];
  for (const l of map.links ?? []) {
    const n = l.edge === 'n' || l.edge === 's' ? map.width : map.height;
    for (let k = 0; k < n; k++) {
      const t =
        l.edge === 'n'
          ? { tx: k, ty: 0 }
          : l.edge === 's'
            ? { tx: k, ty: map.height - 1 }
            : l.edge === 'w'
              ? { tx: 0, ty: k }
              : { tx: map.width - 1, ty: k };
      if (standable(map, t, tide)) {
        out.push(t);
        break;
      }
    }
  }
  const sp = map.spawns['P_STEERER'];
  if (sp !== undefined) out.push({ tx: Math.floor(sp.x), ty: Math.floor(sp.y) });
  return out;
}

/** A shortest walking path between two tiles (breadth first, four ways), or null. */
export function shortest(map: ZoneMap, a: Tile, b: Tile, tide: Tide = HIGH): Tile[] | null {
  const prev = new Map<number, number>();
  const start = key(a.tx, a.ty);
  const goal = key(b.tx, b.ty);
  prev.set(start, -1);
  let head = 0;
  const queue = [start];
  while (head < queue.length) {
    const k = queue[head++] ?? 0;
    if (k === goal) break;
    const x = k % 4096;
    const y = Math.floor(k / 4096);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const t = { tx: x + dx, ty: y + dy };
      const n = key(t.tx, t.ty);
      if (prev.has(n) || !standable(map, t, tide)) continue;
      prev.set(n, k);
      queue.push(n);
    }
  }
  if (!prev.has(goal)) return null;
  const out: Tile[] = [];
  for (let k = goal; k !== -1; k = prev.get(k) ?? -1) out.push({ tx: k % 4096, ty: Math.floor(k / 4096) });
  return out.reverse();
}

/** Every tile on the shortest ways between a scene's entries (the obvious paths). */
export function obviousPaths(map: ZoneMap, tide: Tide = HIGH): Tile[] {
  const ends = entries(map, tide);
  const out: Tile[] = [];
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i];
      const b = ends[j];
      if (a === undefined || b === undefined) continue;
      out.push(...(shortest(map, a, b, tide) ?? []));
    }
  return out;
}

/** The nearest distance from a point (tiles) to any tile of a path (its tile's centre). */
export function distanceTo(path: readonly Tile[], x: number, y: number): number {
  let d = Infinity;
  for (const t of path) d = Math.min(d, Math.hypot(t.tx + 0.5 - x, t.ty + 0.5 - y));
  return d;
}

/** Whether a point (tiles, at the foot) can be reached within `radius` tiles under the tide. */
export function reachable(map: ZoneMap, x: number, y: number, radius: number, tide: Tide, verbs = true): boolean {
  const seen = reach(map, entries(map, tide), tide, verbs);
  for (let ty = Math.floor(y - radius - 1); ty <= y + radius + 1; ty++)
    for (let tx = Math.floor(x - radius - 1); tx <= x + radius + 1; tx++)
      if (Math.hypot(tx + 0.5 - x, ty + 0.7 - y) <= radius && has(seen, { tx, ty })) return true;
  return false;
}

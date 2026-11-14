/**
 * The running water of a zone (Book 9 section 01, "Streams, foam and waterfalls"; Book 7 section
 * 14, "Water"; Stage 14, decisions S14-90 to S14-93). Visual and audible only: the simulation's
 * depth bands are unchanged.
 *
 * Every stream sample (the height field's cells, ELEVATION_CELL pixels square) carries:
 *   - a flow direction, downhill to the sea: the way down the stream's own channel to its mouth,
 *     where the stream meets the sea, the flats or the foreshore, or else leaves the zone by its
 *     edge (the zone's `mouth` edge if it names one; streams on Skarvholm run south off Rook Hill);
 *   - a speed: fastest where the channel narrows, slow in a pool, still in water with no way out
 *     (a bog pool);
 *   - foam: where the channel narrows, at rocks in or beside the water, below a fall;
 *   - waterfalls: the lip, the falling sheet and the churned pool at the foot, where the zone
 *     plan (or Book 9's block, snapped to the stream) puts one.
 *
 * `rgba` packs it for the water shader (LINEAR): R, G the direction (x, y) * 127 + 128; B the
 * speed 0..255; A the foam 0..153 (0 to 0.6), the lip about 204 (0.8), the sheet 255 (1).
 * `elevationRgba` is the height field's bytes with the sheet flagged as running water (G), so the
 * shader draws it over the bank; the simulation's `stream` array is left as it was.
 */
import { ELEVATION_CELL } from './elevation.ts';
import type { Elevation } from './elevation.ts';
import { TILE } from './autotile.ts';

/** A waterfall in zone tiles: its lip's centre, the sheet's width across and its drop. */
export interface FallDef {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly drop: number;
}

export interface FlowOptions {
  /** The edge the stream leaves by when it meets no sea in the zone. */
  readonly mouth?: 'n' | 's' | 'e' | 'w';
  readonly falls?: readonly FallDef[];
}

/** A fall as baked: in world pixels, with the pool at its foot. */
export interface Fall {
  readonly x: number;
  readonly lipY: number;
  readonly footY: number;
  readonly halfWidth: number;
}

export interface Flow {
  readonly width: number;
  readonly height: number;
  /** Unit direction per sample (0, 0 where still or dry). */
  readonly dx: Float32Array;
  readonly dy: Float32Array;
  /** Speed 0 (still) to 1 (a narrow's race). */
  readonly speed: Float32Array;
  /** Foam 0..1. */
  readonly foam: Float32Array;
  /** 1 on a fall's sheet, 2 on its lip. */
  readonly fall: Uint8Array;
  readonly falls: readonly Fall[];
  readonly rgba: Uint8Array;
  readonly elevationRgba: Uint8Array;
}

/** Below this speed water is a pool: it shrinks to it in a dry summer, and freezes in winter. */
export const POOL_SPEED = 0.3;

const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

const cache = new WeakMap<Elevation, Map<string, Flow>>();

/** Two-pass chamfer distance (in samples) from every cell to the nearest cell where `from` holds. */
function chamfer(w: number, h: number, from: (k: number) => boolean): Float32Array {
  const d = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) d[k] = from(k) ? 0 : 1e6;
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : (d[y * w + x] ?? 0);
  const r = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (d[k] === 0) continue;
      d[k] = Math.min(
        d[k] ?? 0,
        at(x - 1, y) + 1,
        at(x, y - 1) + 1,
        at(x - 1, y - 1) + r,
        at(x + 1, y - 1) + r,
      );
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x;
      if (d[k] === 0) continue;
      d[k] = Math.min(
        d[k] ?? 0,
        at(x + 1, y) + 1,
        at(x, y + 1) + 1,
        at(x + 1, y + 1) + r,
        at(x - 1, y + 1) + r,
      );
    }
  return d;
}

/** Bakes a zone's flow from its rows and height field (cached per height field and options). */
export function bakeFlow(
  rows: readonly string[],
  elev: Elevation,
  options: FlowOptions = {},
): Flow {
  const key = JSON.stringify(options);
  const hit = cache.get(elev)?.get(key);
  if (hit !== undefined) return hit;
  const { width: w, height: h } = elev;
  const n = w * h;
  const per = TILE / ELEVATION_CELL;
  // Each tile's kind once: 1 the sea, the flats or the foreshore; 2 rock.
  const tw = rows[0]?.length ?? 0;
  const th = rows.length;
  const kind = new Uint8Array(tw * th);
  rows.forEach((row, y) => {
    for (let x = 0; x < tw; x++) {
      const c = row[x];
      kind[y * tw + x] = c === '~' || c === '-' || c === '_' ? 1 : c === 'r' ? 2 : 0;
    }
  });
  const tileAt = (i: number, j: number): number => {
    const x = Math.floor(i / per);
    const y = Math.floor(j / per);
    return x < 0 || y < 0 || x >= tw || y >= th ? 0 : (kind[y * tw + x] ?? 0);
  };
  const wet = (i: number): boolean => elev.stream[i] === 1;

  const cells: number[] = [];
  for (let k = 0; k < n; k++) if (wet(k)) cells.push(k);
  // The mouth: stream samples touching the sea, the flats or the foreshore.
  const dist = new Float32Array(n).fill(Infinity);
  const queue: number[] = [];
  for (const k of cells) {
    const i = k % w;
    const j = (k - i) / w;
    for (const [dx, dy] of NEIGHBOURS)
      if (tileAt(i + dx, j + dy) === 1) {
        dist[k] = 0;
        queue.push(k);
        break;
      }
  }
  if (queue.length === 0) {
    // Else the edge it leaves by: the named mouth, then south, east, west and north.
    const edges: Record<'n' | 's' | 'e' | 'w', number[]> = { n: [], s: [], e: [], w: [] };
    for (const k of cells) {
      const i = k % w;
      const j = (k - i) / w;
      if (j === h - 1) edges.s.push(k);
      if (j === 0) edges.n.push(k);
      if (i === w - 1) edges.e.push(k);
      if (i === 0) edges.w.push(k);
    }
    const order = [options.mouth, 's', 'e', 'w', 'n'] as const;
    const side = order.find((s) => s !== undefined && edges[s].length > 0);
    for (const k of side === undefined ? [] : edges[side]) {
      dist[k] = 0;
      queue.push(k);
    }
  }
  // The way down the channel: distance to the mouth through the water (a simple label-correcting
  // pass; streams are a few thousand samples).
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q] ?? 0;
    const i = k % w;
    const j = (k - i) / w;
    const d = dist[k] ?? 0;
    for (const [dx, dy, step] of NEIGHBOURS) {
      const x = i + dx;
      const y = j + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const m = y * w + x;
      if (!wet(m) || (dist[m] ?? 0) <= d + step) continue;
      dist[m] = d + step;
      queue.push(m);
    }
  }

  // Direction: down the distance's slope, then smoothed along the water.
  const dx = new Float32Array(n);
  const dy = new Float32Array(n);
  const at = (x: number, y: number, fallback: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h) return fallback;
    const v = dist[y * w + x] ?? Infinity;
    return Number.isFinite(v) ? v : fallback;
  };
  for (const k of cells) {
    const d = dist[k] ?? Infinity;
    if (!Number.isFinite(d)) continue;
    const i = k % w;
    const j = (k - i) / w;
    const gx = at(i + 1, j, d) - at(i - 1, j, d);
    const gy = at(i, j + 1, d) - at(i, j - 1, d);
    const len = Math.hypot(gx, gy);
    if (len > 0) {
      dx[k] = -gx / len;
      dy[k] = -gy / len;
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    const sx = Float32Array.from(dx);
    const sy = Float32Array.from(dy);
    for (const k of cells) {
      if (!Number.isFinite(dist[k] ?? Infinity)) continue;
      const i = k % w;
      const j = (k - i) / w;
      let ax = 0;
      let ay = 0;
      for (let v = -2; v <= 2; v++)
        for (let u = -2; u <= 2; u++) {
          const x = i + u;
          const y = j + v;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const m = y * w + x;
          if (!wet(m)) continue;
          ax += sx[m] ?? 0;
          ay += sy[m] ?? 0;
        }
      const len = Math.hypot(ax, ay);
      if (len > 0) {
        dx[k] = ax / len;
        dy[k] = ay / len;
      }
    }
  }

  // Width: the deepest distance into the water near each sample is its channel's half-width.
  const inside = chamfer(w, h, (k) => !wet(k));
  const speed = new Float32Array(n);
  const foam = new Float32Array(n);
  for (const k of cells) {
    if (!Number.isFinite(dist[k] ?? Infinity)) continue;
    const i = k % w;
    const j = (k - i) / w;
    let half = 0;
    for (let v = -5; v <= 5; v++)
      for (let u = -5; u <= 5; u++) {
        const x = i + u;
        const y = j + v;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        half = Math.max(half, inside[y * w + x] ?? 0);
      }
    // A channel a tile across races; one two tiles across runs; a pool six across lies still.
    const s = Math.max(0, Math.min(1, 1.6 - half / 6.3));
    speed[k] = s;
    // Foam at the narrows, and along the bank where the water runs fast.
    const edge = (inside[k] ?? 0) < 1.5 ? 1 : 0;
    foam[k] = Math.max(0, (s - 0.75) * 2.4) * (0.4 + 0.6 * edge);
  }
  // Foam at rocks: water within two cells of a rock tile.
  for (const k of cells) {
    if ((speed[k] ?? 0) <= 0) continue;
    const i = k % w;
    const j = (k - i) / w;
    let rock = Infinity;
    for (let v = -3; v <= 3; v++)
      for (let u = -3; u <= 3; u++)
        if (tileAt(i + u, j + v) === 2) rock = Math.min(rock, Math.hypot(u, v));
    if (rock < 3.5) foam[k] = Math.max(foam[k] ?? 0, 1 - rock / 3.5);
  }

  // Waterfalls: the lip across the stream, the sheet below it, the churned pool at the foot.
  const fall = new Uint8Array(n);
  const falls: Fall[] = [];
  for (const f of options.falls ?? []) {
    const cy = Math.round((f.y * TILE) / ELEVATION_CELL);
    let cx = Math.round((f.x * TILE) / ELEVATION_CELL);
    // Snap across to the stream near the lip (a plan's block is coarser than the stream).
    let best = Infinity;
    for (let v = -per * 2; v <= per * 2; v++)
      for (let u = -per * 4; u <= per * 4; u++) {
        const x = cx + u;
        const y = cy + v;
        if (x < 0 || y < 0 || x >= w || y >= h || !wet(y * w + x)) continue;
        const d = Math.hypot(u, v * 2);
        if (d < best) {
          best = d;
          cx = x;
        }
      }
    // No stream near: the plan has none there yet, so no fall is drawn.
    if (!Number.isFinite(best)) continue;
    const half = Math.max(1, Math.round((f.width * per) / 2));
    const drop = Math.max(1, Math.round(f.drop * per));
    for (let v = 0; v <= drop; v++)
      for (let u = -half; u <= half; u++) {
        const x = cx + u;
        const y = cy + v;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const k = y * w + x;
        fall[k] = v === 0 ? 2 : 1;
        dx[k] = 0;
        dy[k] = 1;
        speed[k] = 1;
      }
    // The pool at the foot: churned white, spreading.
    for (let v = 0; v < per * 2; v++)
      for (let u = -half - per; u <= half + per; u++) {
        const x = cx + u;
        const y = cy + drop + 1 + v;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const k = y * w + x;
        if (!wet(k)) continue;
        const r = Math.hypot(u / (half + per), v / (per * 2));
        foam[k] = Math.max(foam[k] ?? 0, Math.max(0, 1 - r));
      }
    falls.push({
      x: (cx + 0.5) * ELEVATION_CELL,
      lipY: cy * ELEVATION_CELL,
      footY: (cy + drop + 1) * ELEVATION_CELL,
      halfWidth: (half + 0.5) * ELEVATION_CELL,
    });
  }

  const rgba = new Uint8Array(n * 4);
  const elevationRgba = Uint8Array.from(elev.rgba);
  for (let k = 0; k < n; k++) {
    rgba[k * 4] = Math.round((dx[k] ?? 0) * 127 + 128);
    rgba[k * 4 + 1] = Math.round((dy[k] ?? 0) * 127 + 128);
    rgba[k * 4 + 2] = Math.round(Math.max(0, Math.min(1, speed[k] ?? 0)) * 255);
    const f = fall[k] ?? 0;
    rgba[k * 4 + 3] =
      f === 1 ? 255 : f === 2 ? 204 : Math.round(Math.max(0, Math.min(1, foam[k] ?? 0)) * 153);
    if (f !== 0) elevationRgba[k * 4 + 1] = 255;
  }
  const out: Flow = { width: w, height: h, dx, dy, speed, foam, fall, falls, rgba, elevationRgba };
  let byKey = cache.get(elev);
  if (byKey === undefined) {
    byKey = new Map();
    cache.set(elev, byKey);
  }
  byKey.set(key, out);
  return out;
}

/** The flow at world pixel (x, y): direction and speed, or null where no water runs. */
export function flowAt(
  flow: Flow,
  x: number,
  y: number,
): { dx: number; dy: number; speed: number } | null {
  const i = Math.floor(x / ELEVATION_CELL);
  const j = Math.floor(y / ELEVATION_CELL);
  if (i < 0 || j < 0 || i >= flow.width || j >= flow.height) return null;
  const k = j * flow.width + i;
  const s = flow.speed[k] ?? 0;
  const dx = flow.dx[k] ?? 0;
  const dy = flow.dy[k] ?? 0;
  if (s <= 0 && dx === 0 && dy === 0) return null;
  return { dx, dy, speed: s };
}

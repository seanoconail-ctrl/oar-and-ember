/**
 * The shore's height field for the water shader (Book 7 section 14, "Water"). Visual only: the
 * simulation's tide rule (the tidal ground opens and closes) is unchanged; this only decides how
 * far up the beach the water is drawn at each moment between those events.
 *
 * Heights follow the drawn ground (the dual-grid tiles), sampled every CELL pixels:
 *   sea        -1 .. 0      deeper away from the shore
 *   flats       0.02 .. 0.14 rising from the sea to the foreshore
 *   foreshore   0.15 .. 1    rising from the flats (or the sea) to the shingle
 *   dry land    above 1      never under water
 * The stream is flagged: it always shows running water, whatever the tide.
 */
import { LAYERS, terrainAtPixel, TILE, visualCorners } from './autotile.ts';

export const ELEVATION_CELL = 4;

export interface Elevation {
  /** Samples across and down; sample (i, j) covers world pixels (i*CELL.., j*CELL..). */
  readonly width: number;
  readonly height: number;
  /** Height per sample (see the module comment). */
  readonly height01: Float32Array;
  /** 1 where the stream runs. */
  readonly stream: Uint8Array;
  /**
   * RGBA bytes for the shaders: R height ((e + 1) / 3), G stream, B distance into the stream,
   * A the drawn terrain (its index in autotile LAYERS, times 16, plus 8).
   */
  readonly rgba: Uint8Array;
}

/** Two-pass chamfer distance (in samples) from every cell to the nearest cell where `from` holds. */
function distanceFrom(w: number, h: number, from: (i: number) => boolean): Float32Array {
  const d = new Float32Array(w * h);
  const far = 1e6;
  for (let i = 0; i < w * h; i++) d[i] = from(i) ? 0 : far;
  const a = 1;
  const b = Math.SQRT2;
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? far : (d[y * w + x] ?? far);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      d[i] = Math.min(
        d[i] ?? far,
        at(x - 1, y) + a,
        at(x, y - 1) + a,
        at(x - 1, y - 1) + b,
        at(x + 1, y - 1) + b,
      );
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      d[i] = Math.min(
        d[i] ?? far,
        at(x + 1, y) + a,
        at(x, y + 1) + a,
        at(x + 1, y + 1) + b,
        at(x - 1, y + 1) + b,
      );
    }
  }
  return d;
}

const cache = new WeakMap<readonly string[], Elevation>();

/** Bakes the height field for a zone's rows (cached per rows array). */
export function bakeElevation(rows: readonly string[]): Elevation {
  const hit = cache.get(rows);
  if (hit !== undefined) return hit;
  const tilesW = rows[0]?.length ?? 0;
  const tilesH = rows.length;
  const w = (tilesW * TILE) / ELEVATION_CELL;
  const h = (tilesH * TILE) / ELEVATION_CELL;
  const P = 5 * TILE;
  const code = new Array<string>(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // The drawn terrain at the sample's centre: visual tile (vi, vj) is offset half a tile.
      const px = i * ELEVATION_CELL + ELEVATION_CELL / 2;
      const py = j * ELEVATION_CELL + ELEVATION_CELL / 2;
      const vi = Math.floor((px + TILE / 2) / TILE);
      const vj = Math.floor((py + TILE / 2) / TILE);
      const lx = px + TILE / 2 - vi * TILE;
      const ly = py + TILE / 2 - vj * TILE;
      const wx = ((px % P) + P) % P;
      const wy = ((py % P) + P) % P;
      code[j * w + i] = terrainAtPixel(visualCorners(rows, vi, vj), lx, ly, wx, wy);
    }
  }
  const is = (cs: string) => (i: number) => cs.includes(code[i] ?? '');
  const dSea = distanceFrom(w, h, is('~'));
  const dNotSea = distanceFrom(w, h, (i) => code[i] !== '~' && code[i] !== 'w');
  const dLow = distanceFrom(w, h, is('~-'));
  const dForeshore = distanceFrom(w, h, is('_'));
  const dLand = distanceFrom(w, h, is('.b,:r'));
  const dDry = distanceFrom(w, h, (i) => code[i] !== 'w');
  const e = new Float32Array(w * h);
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = code[i];
    let v = 0;
    if (c === '~') v = -Math.min(1, (dNotSea[i] ?? 0) / 30);
    else if (c === '-') {
      const s = dSea[i] ?? 0;
      v = 0.02 + (0.12 * s) / Math.max(1, s + (dForeshore[i] ?? 0));
    } else if (c === '_') {
      const lo = dLow[i] ?? 0;
      v = 0.15 + (0.85 * lo) / Math.max(1, lo + (dLand[i] ?? 0));
    } else if (c === 'r') v = 1.4;
    else if (c !== 'w') v = 1.05 + Math.min(0.9, (dForeshore[i] ?? 0) / 40);
    e[i] = v;
    filled[i] = c === 'w' ? 0 : 1;
  }
  // The stream takes the height of the ground it runs through, filled in from its banks.
  for (let pass = 0; pass < 64; pass++) {
    let open = 0;
    const next = Float32Array.from(e);
    const nextFilled = Uint8Array.from(filled);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (filled[i] === 1) continue;
        let sum = 0;
        let n = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const k = yy * w + xx;
          if (filled[k] === 1) {
            sum += e[k] ?? 0;
            n++;
          }
        }
        if (n > 0) {
          next[i] = sum / n;
          nextFilled[i] = 1;
        } else open++;
      }
    }
    e.set(next);
    filled.set(nextFilled);
    if (open === 0) break;
  }
  const stream = new Uint8Array(w * h);
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = code[i] === 'w' ? 1 : 0;
    stream[i] = s;
    rgba[i * 4] = Math.max(0, Math.min(255, Math.round((((e[i] ?? 0) + 1) / 3) * 255)));
    rgba[i * 4 + 1] = s * 255;
    rgba[i * 4 + 2] = Math.min(255, Math.round((dDry[i] ?? 0) * 40));
    rgba[i * 4 + 3] = (LAYERS as readonly string[]).indexOf(code[i] ?? '~') * 16 + 8;
  }
  const out: Elevation = { width: w, height: h, height01: e, stream, rgba };
  cache.set(rows, out);
  return out;
}

/** The ground height under world pixel (x, y), interpolated. */
export function heightAt(elev: Elevation, x: number, y: number): number {
  const fx = x / ELEVATION_CELL - 0.5;
  const fy = y / ELEVATION_CELL - 0.5;
  const x0 = Math.max(0, Math.min(elev.width - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(elev.height - 1, Math.floor(fy)));
  const x1 = Math.min(elev.width - 1, x0 + 1);
  const y1 = Math.min(elev.height - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const v = (xx: number, yy: number): number => elev.height01[yy * elev.width + xx] ?? 0;
  const top = v(x0, y0) + (v(x1, y0) - v(x0, y0)) * tx;
  const bottom = v(x0, y1) + (v(x1, y1) - v(x0, y1)) * tx;
  return top + (bottom - top) * ty;
}

/** Whether the stream runs at world pixel (x, y). */
export function streamAt(elev: Elevation, x: number, y: number): boolean {
  const i = Math.floor(x / ELEVATION_CELL);
  const j = Math.floor(y / ELEVATION_CELL);
  if (i < 0 || j < 0 || i >= elev.width || j >= elev.height) return false;
  return elev.stream[j * elev.width + i] === 1;
}

/**
 * The tide's drawn height (0 at low water, 1 at high) from the calendar's minutes to and since
 * low water. Low water lasts the tidal-ground window; the water then climbs for six hours on a
 * smooth curve. While the simulation has the tidal ground closed the flats are always drawn
 * under water, so what is drawn never disagrees with where the player can walk.
 */
export function tideHeight(
  minutesToLow: number,
  minutesSinceLow: number,
  tidalGroundOpen: boolean,
): number {
  const dt = Math.min(minutesToLow, minutesSinceLow);
  const h = (1 - Math.cos((Math.PI * Math.min(dt, 360)) / 360)) / 2;
  return tidalGroundOpen ? Math.min(h, 0.012) : Math.max(h, 0.15);
}

/** The swash: how far above the still water level the last wave runs, 0..SWASH. */
export const SWASH = 0.07;
export const SWASH_PERIOD = 6.5;
export function swashAt(x: number, t: number): number {
  const s =
    0.5 +
    0.5 *
      Math.sin((t / SWASH_PERIOD) * 2 * Math.PI + x * 0.021 + 0.6 * Math.sin(x * 0.05 + t * 0.3));
  return SWASH * s * s;
}

/** How deep the water is at world pixel (x, y) under drawn tide height `h` (0 when dry). */
export function waterDepthAt(elev: Elevation, x: number, y: number, h: number, t: number): number {
  if (streamAt(elev, x, y)) return 0.05;
  return Math.max(0, h + swashAt(x, t) - heightAt(elev, x, y));
}

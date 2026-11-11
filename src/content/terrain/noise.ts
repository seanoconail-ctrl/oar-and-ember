/**
 * Deterministic value noise for art generators and visual-only effects (wind gusts, cloud
 * shadows). Never used by the simulation. Every field can tile with a period, so a pattern
 * painted into tiles joins up across tile edges and animated fields loop without a seam.
 */

/** A well-mixed hash of integers to 0..1. */
export function hash01(...values: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    h = Math.imul(h ^ (v | 0), 0x01000193);
    h ^= h >>> 15;
  }
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Value noise in 0..1 at (x, y) on a lattice of `cell` pixels. With `period` (a whole number of
 * cells, in pixels) it repeats exactly every `period` pixels in both directions.
 */
export function valueNoise(x: number, y: number, cell: number, seed: number, period = 0): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = smooth(x / cell - gx);
  const fy = smooth(y / cell - gy);
  const p = period > 0 ? Math.round(period / cell) : 0;
  const wrap = (v: number): number => (p > 0 ? ((v % p) + p) % p : v);
  const at = (i: number, j: number): number => hash01(wrap(i), wrap(j), seed);
  const a = at(gx, gy);
  const b = at(gx + 1, gy);
  const c = at(gx, gy + 1);
  const d = at(gx + 1, gy + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

/** Fractal value noise: `octaves` layers, each half the cell and half the weight. */
export function fbm(
  x: number,
  y: number,
  cell: number,
  seed: number,
  octaves = 3,
  period = 0,
): number {
  let sum = 0;
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const c = Math.max(2, cell / 2 ** o);
    sum += amp * valueNoise(x, y, c, seed + o * 97, period);
    total += amp;
    amp /= 2;
  }
  return sum / total;
}

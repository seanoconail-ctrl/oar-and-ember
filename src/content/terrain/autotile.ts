/**
 * Dual-grid autotiling (Book 7 section 14: no hard straight edges, proper transitions).
 *
 * Ground tiles are drawn half a tile offset from the world grid, so each visual tile's four
 * corners are four world tiles. Inside a visual tile every pixel takes the highest-priority
 * terrain whose coverage passes one half, where coverage is the corners blended across the tile
 * plus a little noise. The noise repeats every PERIOD tiles across the world, and along an edge
 * the blend depends only on that edge's two corners, so neighbouring tiles always meet without a
 * seam and the boundary wanders organically through the tile instead of following its edge.
 *
 * A visual tile is identified by its four corners and its place in the PERIOD x PERIOD pattern:
 * pure tiles (four equal corners) therefore come in up to PERIOD^2 variants.
 */
import { valueNoise } from './noise.ts';

export const TILE = 24;
/** The world pattern of boundary noise and texture repeats every PERIOD tiles. */
export const PERIOD = 5;

/** Visual priority, low to high: a terrain laps over every terrain before it. */
export const LAYERS = ['~', '-', '_', 'w', '.', 'b', ',', ':', 'r'] as const;
export type Layer = (typeof LAYERS)[number];

/** Short letters for frame names. */
export const LETTER: Readonly<Record<Layer, string>> = {
  '~': 's',
  '-': 'f',
  _: 'o',
  w: 'w',
  '.': 'h',
  b: 'b',
  ',': 'm',
  ':': 'e',
  r: 'r',
};

/** How far the boundary may wander from the blend, by the terrain lapping over (0..0.5). */
const ROUGHNESS: Readonly<Record<Layer, number>> = {
  '~': 0.3,
  '-': 0.3,
  _: 0.32,
  w: 0.2,
  '.': 0.32,
  b: 0.16,
  ',': 0.34,
  ':': 0.3,
  r: 0.38,
};

export function layerIndex(code: string): number {
  const i = (LAYERS as readonly string[]).indexOf(code);
  if (i < 0) throw new Error(`autotile: unknown terrain "${code}"`);
  return i;
}

/** The world tile terrains at a visual tile's corners: top-left, top-right, bottom-left, bottom-right. */
export function visualCorners(
  rows: readonly string[],
  i: number,
  j: number,
): [Layer, Layer, Layer, Layer] {
  const at = (x: number, y: number): Layer => {
    const yy = Math.max(0, Math.min(rows.length - 1, y));
    const row = rows[yy] ?? '';
    const xx = Math.max(0, Math.min(row.length - 1, x));
    return (row[xx] ?? '~') as Layer;
  };
  return [at(i - 1, j - 1), at(i, j - 1), at(i - 1, j), at(i, j)];
}

export function phaseOf(i: number, j: number): number {
  const m = (v: number): number => ((v % PERIOD) + PERIOD) % PERIOD;
  return m(j) * PERIOD + m(i);
}

/** The frame state of visual tile (i, j). */
export function tileState(corners: readonly Layer[], phase: number): string {
  return `g_${corners.map((c) => LETTER[c]).join('')}_${phase}`;
}

export interface PixelInfo {
  /** Index into LAYERS of the pixel's terrain. */
  readonly layer: number;
  /**
   * For each layer: its coverage plus noise, minus one half. Positive inside it; it changes by
   * about 1/20 a pixel, so (margin x 20) is roughly the distance to that layer's edge in pixels.
   */
  readonly margins: readonly number[];
  /** The terrain the pixel would show if its own layer were removed. */
  readonly under: number;
}

/**
 * One pixel of a visual tile. (lx, ly) is the pixel within the tile (0..23); (wx, wy) is its
 * place in the world pattern, used for the noise so neighbouring tiles join up.
 */
export function pixelInfo(
  corners: readonly Layer[],
  lx: number,
  ly: number,
  wx: number,
  wy: number,
): PixelInfo {
  const k = corners.map(layerIndex);
  const [tl = 0, tr = 0, bl = 0, br = 0] = k;
  const u = (lx + 0.5) / TILE;
  const v = (ly + 0.5) / TILE;
  const lo = Math.min(...k);
  const hi = Math.max(...k);
  const margins = LAYERS.map((layer, L) => {
    if (L <= lo) return 1;
    if (L > hi) return -1;
    const c = (q: number): number => (q >= L ? 1 : 0);
    const cov =
      c(tl) * (1 - u) * (1 - v) + c(tr) * u * (1 - v) + c(bl) * (1 - u) * v + c(br) * u * v;
    const n = valueNoise(wx, wy, 8, 300 + L, PERIOD * TILE) - 0.5;
    const n2 = valueNoise(wx, wy, 3, 400 + L, PERIOD * TILE) - 0.5;
    const n3 = valueNoise(wx, wy, 5, 500 + L, PERIOD * TILE) - 0.5;
    return cov + (n * 1.6 + n3 * 0.7 + n2 * 1.0) * ROUGHNESS[layer] - 0.5;
  });
  let layer = lo;
  for (let L = lo + 1; L <= hi; L++) if ((margins[L] ?? -1) > 0) layer = L;
  let under = lo;
  for (let L = lo + 1; L < layer; L++) if ((margins[L] ?? -1) > 0) under = L;
  return { layer, margins, under };
}

/** The terrain of one pixel of a visual tile (see pixelInfo). */
export function terrainAtPixel(
  corners: readonly Layer[],
  lx: number,
  ly: number,
  wx: number,
  wy: number,
): Layer {
  return LAYERS[pixelInfo(corners, lx, ly, wx, wy).layer] ?? '~';
}

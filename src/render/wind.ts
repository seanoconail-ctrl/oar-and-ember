/**
 * The one wind (Book 7 section 14, "Wind"). Visual only: it never touches the simulation. Every
 * moving thing that answers the wind reads it from here: grass and marram lean, cloaks flutter,
 * sand and smoke drift, and the water shader's gust darkening uses the same formula (GLSL copy in
 * glEffects.ts, kept equal by a unit test of `gustAt` against `GUST_GLSL`'s constants).
 *
 * A gust is a band of stronger wind travelling downwind across the ground; the bands are broken
 * up across the wind so they arrive as patches, not stripes.
 */

export interface Wind {
  /** Unit vector the wind blows towards, in screen axes (y down). */
  readonly dirX: number;
  readonly dirY: number;
  /** Steady strength 0..1. */
  readonly strength: number;
}

/** The prevailing wind on the strand: off the sea from the south-west. */
export const STRAND_WIND: Wind = { dirX: 0.8, dirY: -0.6, strength: 0.55 };

/** Speed of a gust band, logical pixels a second. */
export const GUST_SPEED = 46;
/** Spacing of gust bands downwind, pixels. */
export const GUST_SPACING = 190;

/**
 * The gust at world pixel (x, y) at time t seconds: 0 in a lull, 1 in the heart of a gust.
 * Smooth in space and time, so a plant eases into a gust and out of it.
 */
export function gustAt(wind: Wind, x: number, y: number, t: number): number {
  const along = x * wind.dirX + y * wind.dirY;
  const across = -x * wind.dirY + y * wind.dirX;
  const k = (2 * Math.PI) / GUST_SPACING;
  const a = Math.sin((along - t * GUST_SPEED) * k + 1.7 * Math.sin(across * 0.011 + t * 0.13));
  const b = Math.sin((along - t * GUST_SPEED * 0.8) * k * 0.53 + across * 0.019 + 2.1);
  const v = Math.max(0, a) * (0.55 + 0.45 * Math.max(0, b));
  return v * v * (3 - 2 * v);
}

/** A slow sway that never stops, out of step between plants (each has its own phase). */
/** The period of the plants' sway, seconds. */
export const SWAY_PERIOD = 3.6;
/** How far a plant sways in a lull, in pixels either way (full motion). */
export const SWAY_CALM = 1.4;

export function swayAt(t: number, phase: number, period = SWAY_PERIOD): number {
  return (
    Math.sin((t / period + phase) * 2 * Math.PI) * 0.7 +
    Math.sin((t / (period * 0.47) + phase * 3.1) * 2 * Math.PI) * 0.3
  );
}

/**
 * How far a plant leans, in pixels (-3..3 frames): the wind's steady push, the gust, the sway,
 * and a walker pushing through it. Reduced motion keeps the lean but calms the sway.
 */
export function plantLean(
  wind: Wind,
  x: number,
  y: number,
  t: number,
  phase: number,
  tall: boolean,
  walkers: readonly { readonly x: number; readonly y: number }[],
  reducedMotion: boolean,
  /** The gust here, if already known (a frame samples it on a grid). */
  gust?: number,
): number {
  const g = gust ?? gustAt(wind, x, y, t);
  const push = wind.dirX * wind.strength * (0.6 + (tall ? 2.6 : 1.9) * g);
  // Each plant sways on its own phase even in a lull, by more than a pixel either way, so a
  // field of grass keeps moving with the camera still (Book 7 section 14; decision S7-23).
  const sway = swayAt(t, phase) * (reducedMotion ? 0.35 : SWAY_CALM + 0.6 * g);
  let lean = push + sway;
  for (const w of walkers) {
    const dx = x - w.x;
    const dy = (y - w.y) * 1.6;
    const d = Math.hypot(dx, dy);
    if (d < 11) lean += Math.sign(Math.abs(dx) > 0.5 ? dx : 1) * ((11 - d) / 11) * 4.5;
  }
  return Math.max(-3, Math.min(3, Math.round(lean)));
}

/** The gust sampled every GRID pixels over a view, for many plants at once. */
export const GUST_GRID = 16;

/** The grid's size for a view: its columns and rows. */
export function gustGridSize(width: number, height: number): { cols: number; rows: number } {
  return { cols: Math.ceil(width / GUST_GRID) + 2, rows: Math.ceil(height / GUST_GRID) + 2 };
}

/**
 * Where a point falls on a gust grid at (x0, y0): its cell's index and the weights across and
 * down. They depend only on the grid's place, so a frame's many plants can keep them while the
 * view stays put (decision DH-161); `gustSampled` then gives exactly what `gustGrid`'s sampler does.
 */
export function gustCell(
  cols: number,
  rows: number,
  x0: number,
  y0: number,
  x: number,
  y: number,
): { cell: number; tx: number; ty: number } {
  const fx = Math.max(0, Math.min(cols - 1.001, (x - x0) / GUST_GRID));
  const fy = Math.max(0, Math.min(rows - 1.001, (y - y0) / GUST_GRID));
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  return { cell: j * cols + i, tx: fx - i, ty: fy - j };
}

/** The gust grid's values over a view at time t (row by row, `gustGridSize` across). */
export function gustValues(
  wind: Wind,
  x0: number,
  y0: number,
  width: number,
  height: number,
  t: number,
): Float32Array {
  const { cols, rows } = gustGridSize(width, height);
  const v = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      v[j * cols + i] = gustAt(wind, x0 + i * GUST_GRID, y0 + j * GUST_GRID, t);
  return v;
}

/** The gust at a cell and weights, from a grid's values (the sampler's own arithmetic). */
export function gustSampled(
  v: Float32Array,
  cols: number,
  cell: number,
  tx: number,
  ty: number,
): number {
  const a = v[cell] ?? 0;
  const b = v[cell + 1] ?? 0;
  const c = v[cell + cols] ?? 0;
  const d = v[cell + cols + 1] ?? 0;
  return a + (b - a) * tx + (c - a + (d - c - b + a) * tx) * ty;
}

export function gustGrid(
  wind: Wind,
  x0: number,
  y0: number,
  width: number,
  height: number,
  t: number,
): (x: number, y: number) => number {
  const { cols, rows } = gustGridSize(width, height);
  const v = gustValues(wind, x0, y0, width, height, t);
  return (x, y) => {
    const { cell, tx, ty } = gustCell(cols, rows, x0, y0, x, y);
    return gustSampled(v, cols, cell, tx, ty);
  };
}

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
export function swayAt(t: number, phase: number, period = 3.6): number {
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
): number {
  const g = gustAt(wind, x, y, t);
  const push = wind.dirX * wind.strength * (0.6 + (tall ? 2.6 : 1.9) * g);
  const sway = swayAt(t, phase) * (reducedMotion ? 0.35 : 0.8 + 0.6 * g);
  let lean = push + sway;
  for (const w of walkers) {
    const dx = x - w.x;
    const dy = (y - w.y) * 1.6;
    const d = Math.hypot(dx, dy);
    if (d < 11) lean += Math.sign(Math.abs(dx) > 0.5 ? dx : 1) * ((11 - d) / 11) * 4.5;
  }
  return Math.max(-3, Math.min(3, Math.round(lean)));
}

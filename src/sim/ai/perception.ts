/**
 * Perception basics (Book 2 section 13; Book 10 section 07, "Perception"): a sight cone whose
 * range follows the light (day, dusk, night outside light; full inside a light's pool), blocked by
 * solid ground; hearing by the noise of an action on its surface; memory of where a target was
 * last known, forgotten after Book 10's time. Pure: the caller says what blocks sight.
 *
 * May depend only on core and content (src/sim/ai/README.md).
 */
import type { AiBalance } from '../../content/combatBalance.ts';

export type Light = 'day' | 'dusk' | 'night';
export type Facing = 's' | 'n' | 'e' | 'w';

/** The minutes either side of first light and of dark that count as dusk (as the scenes draw). */
export const TWILIGHT_MINUTES = 60;

/** The light at a minute of the day, for daylight from `lightFrom` until `darkFrom`. */
export function lightAt(minuteOfDay: number, lightFrom: number, darkFrom: number): Light {
  const m = minuteOfDay;
  if (m >= lightFrom && m < darkFrom) return 'day';
  const near = (edge: number): boolean =>
    Math.min(Math.abs(m - edge), 1440 - Math.abs(m - edge)) <= TWILIGHT_MINUTES;
  return near(lightFrom) || near(darkFrom) ? 'dusk' : 'night';
}

/** How far a person sees, in tiles: by the light, the full day range inside a light's pool. */
export function sightRange(ai: AiBalance, light: Light, inLight: boolean, fog = false): number {
  const base =
    inLight || light === 'day' ? ai.sight.day : light === 'dusk' ? ai.sight.dusk : ai.sight.night;
  return base * (fog ? ai.sight.fogFactor : 1);
}

const AHEAD: Readonly<Record<Facing, readonly [number, number]>> = {
  s: [0, 1],
  n: [0, -1],
  e: [1, 0],
  w: [-1, 0],
};

/**
 * Whether an observer facing `facing` at `from` sees `to`: within range, inside the cone, and
 * with nothing solid between (sampled along the line every half tile).
 */
export function sees(
  ai: AiBalance,
  from: { readonly x: number; readonly y: number; readonly facing: Facing },
  to: { readonly x: number; readonly y: number },
  rangeTiles: number,
  tile: number,
  solid: (x: number, y: number) => boolean,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d > rangeTiles * tile) return false;
  if (d > tile * 0.5) {
    const [fx, fy] = AHEAD[from.facing];
    const cos = (fx * dx + fy * dy) / d;
    if (cos < Math.cos(((ai.sight.coneDegrees / 2) * Math.PI) / 180) - 1e-9) return false;
  }
  const steps = Math.ceil(d / (tile / 2));
  for (let k = 1; k < steps; k++) {
    const t = k / steps;
    // Eye height: the line runs a little above the feet, so a low bank between does not hide.
    if (solid(from.x + dx * t, from.y - tile * 0.5 + dy * t)) return false;
  }
  return true;
}

export type Gait = 'walk' | 'run' | 'sneak' | 'carry';
export type NoiseSurface = 'shingle' | 'sand' | 'other';

/** The noise of a moving person, in tiles (Book 10: by gait, times the surface). */
export function stepNoise(ai: AiBalance, gait: Gait, surface: NoiseSurface): number {
  const base = gait === 'run' ? ai.noise.run : gait === 'sneak' ? ai.noise.sneak : ai.noise.walk;
  const k = surface === 'shingle' ? ai.noise.shingle : surface === 'sand' ? ai.noise.sand : 1;
  return base * k;
}

/** Whether a noise of `radius` tiles at `at` is heard at `ear`. */
export function hears(
  at: { readonly x: number; readonly y: number },
  ear: { readonly x: number; readonly y: number },
  radiusTiles: number,
  tile: number,
): boolean {
  return Math.hypot(at.x - ear.x, at.y - ear.y) <= radiusTiles * tile;
}

/** Where a target was last known, and when (a tick); forgotten after Book 10's memory time. */
export interface Memory {
  readonly x: number;
  readonly y: number;
  readonly tick: number;
  /** Seen (true) or only heard. */
  readonly seen: boolean;
}

export function remembered(ai: AiBalance, m: Memory | null, tick: number): boolean {
  return m !== null && tick - m.tick < ai.memoryTicks;
}

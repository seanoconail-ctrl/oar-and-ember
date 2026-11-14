/**
 * Travel on a leg (Book 2 section 09; Book 10 section 02, "Sea travel"; decision S13-4): the leg's
 * bearing between chart positions rounded to eight points, its point of sail against the wind's
 * "from" point, the effective speed (the larger of the sail at its wind factor and rowing), and
 * its time in whole game minutes, `baseWatches x 3 / speed` watches of six game hours. Pure.
 */
import { POINTS } from '../../content/seaBalance.ts';
import type { Point8, SeaBalance } from '../../content/seaBalance.ts';
import type { PointOfSail, WindStrength } from './types.ts';

/** The bearing from `a` to `b` on the chart (y runs south), rounded to the nearest of 8 points. */
export function bearingOf(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
): Point8 {
  const deg = (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
  const i = ((Math.round(deg / 45) % 8) + 8) % 8;
  return POINTS[i] ?? 'N';
}

/** Points between two compass points, 0 to 4. */
export function pointsApart(p: Point8, q: Point8): number {
  const d = Math.abs(POINTS.indexOf(p) - POINTS.indexOf(q)) % 8;
  return Math.min(d, 8 - d);
}

/**
 * The point of sail heading `heading` with the wind from `windFrom`: 0 points off is against the
 * wind, 1 close-hauled, 2 beam, 3 broad reach, 4 running; strength 0 is a calm.
 */
export function pointOfSail(
  heading: Point8,
  windFrom: Point8,
  strength: WindStrength,
): PointOfSail {
  if (strength === 0) return 'CALM';
  const off = pointsApart(heading, windFrom);
  return (['AGAINST', 'CLOSE_HAULED', 'BEAM', 'BROAD_REACH', 'RUNNING'] as const)[off] ?? 'AGAINST';
}

/** The sail's factor at a point of sail (a fitting's close-hauled factor replaces Book 10's). */
export function windFactor(pos: PointOfSail, b: SeaBalance, closeHauled: number | null): number {
  switch (pos) {
    case 'RUNNING':
      return b.windFactor.running;
    case 'BROAD_REACH':
      return b.windFactor.broadReach;
    case 'BEAM':
      return b.windFactor.beam;
    case 'CLOSE_HAULED':
      return closeHauled ?? b.windFactor.closeHauled;
    case 'AGAINST':
    case 'CALM':
      return b.windFactor.against;
  }
}

/** What speed reads of the ship (ShipStats). */
export interface SpeedStats {
  readonly sailSpeed: number;
  /** deriveStats's oarSpeed: already counts the rowers present against the rowing crew. */
  readonly oarSpeed: number;
  readonly closeHauled: number | null;
}

/** The effective speed: the larger of the sail at its wind factor and rowing (Book 10). */
export function effectiveSpeed(
  stats: SpeedStats,
  pos: PointOfSail,
  b: SeaBalance,
): { readonly speed: number; readonly rowing: boolean } {
  const sail = stats.sailSpeed * windFactor(pos, b, stats.closeHauled);
  const row = stats.oarSpeed * b.rowingFactor;
  return row > sail ? { speed: row, rowing: true } : { speed: sail, rowing: false };
}

/**
 * A leg's time in whole game minutes: `baseWatches x referenceSpeed / speed` watches of
 * `watchMinutes`. A boat that cannot move takes forever (Infinity).
 */
export function legMinutes(
  baseWatches: number,
  speed: number,
  b: SeaBalance,
  watchMinutes: number,
): number {
  if (!(speed > 0)) return Number.POSITIVE_INFINITY;
  return Math.round(((baseWatches * b.referenceSpeed) / speed) * watchMinutes);
}

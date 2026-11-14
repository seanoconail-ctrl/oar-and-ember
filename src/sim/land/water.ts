/**
 * Water depth bands on foot (Book 2 section 10, Book 10 section 02 "Water depth bands"). The band
 * at a point is the still water level over the zone's baked ground height: the level comes from
 * the calendar's tide (never the drawn swash, so it is deterministic), and a stream crossing open
 * ground is the stream band unless the tide over it is deeper. Nothing is stored per frame.
 */
import { bandForDepth } from '../../content/balance.ts';
import type { DepthBand, DepthBandBalance, WaterBalance } from '../../content/balance.ts';
import { heightAt, streamAt, tideHeight } from '../../content/terrain/elevation.ts';
import type { Elevation } from '../../content/terrain/elevation.ts';

export interface TideView {
  readonly minutesToLowWater: number;
  readonly minutesSinceLowWater: number;
  readonly tidalGroundOpen: boolean;
}

/** The still water level of the tide (the height field's units: 0 low water, 1 high). */
export function stillWaterLevel(tide: TideView): number {
  return tideHeight(tide.minutesToLowWater, tide.minutesSinceLowWater, tide.tidalGroundOpen);
}

/**
 * Stage 14 (decision S14-110): the band a zone's plan sets at world pixel (x, y) where the height
 * field gives none (a pool in a cave, the deep passage's water by the tide: src/sim/land/zoneWater.ts),
 * or null where the height field decides.
 */
export type WadeAt = (x: number, y: number) => DepthBand | null;

/** The depth band at world pixel (x, y) under the still water `level`, or null when dry. */
export function bandAt(
  water: WaterBalance,
  elevation: Elevation,
  x: number,
  y: number,
  level: number,
  wade?: WadeAt,
): DepthBandBalance | null {
  const set = wade?.(x, y) ?? null;
  if (set !== null) return water.bands.find((b) => b.band === set) ?? null;
  const tidal = bandForDepth(water, level - heightAt(elevation, x, y));
  if (!streamAt(elevation, x, y)) return tidal;
  const stream = water.bands.find((b) => b.band === water.streamBand) ?? null;
  if (tidal === null) return stream;
  return water.bands.indexOf(tidal) > water.bands.indexOf(stream ?? tidal) ? tidal : stream;
}

/** Whether a band is deep water (swimming only where a scene allows it; none does yet). */
export function isDeep(band: DepthBandBalance | null): boolean {
  return band?.band === 'DEEP';
}

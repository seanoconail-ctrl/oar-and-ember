/**
 * Horizontal colour bands with ordered-dither blends between them, for sky and water gradients
 * (Book 7 section 11 allows ordered dithering only for fog, mist and sky and water gradients).
 */
import type { IndexedImage } from './indexedImage.ts';

export interface Band {
  /** Palette index of the band. */
  readonly index: number;
  /** First row of the next band; the last band runs to the bottom. */
  readonly toY?: number;
  /** Rows of dithered blend into the next band, centred on `toY`. */
  readonly blend?: number;
}

/** 4 x 4 Bayer matrix: thresholds 0..15. */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** Whether the next band shows at (x, y) for a blend `fraction` (0 none .. 1 all). */
export function ditherShowsNext(x: number, y: number, fraction: number): boolean {
  const threshold = BAYER4[y & 3]?.[x & 3] ?? 0;
  return threshold < Math.round(fraction * 16);
}

/** Paints `bands` over the whole of `target`, top to bottom. */
export function paintBands(target: IndexedImage, bands: readonly Band[]): void {
  if (bands.length === 0) throw new Error('A backdrop needs at least one band');
  for (let y = 0; y < target.height; y++) {
    // The band this row belongs to, and how far it has blended into the next one.
    let current = bands.length - 1;
    for (let i = 0; i < bands.length; i++) {
      const toY = bands[i]?.toY;
      if (toY === undefined || y < toY + Math.floor((bands[i]?.blend ?? 0) / 2)) {
        current = i;
        break;
      }
    }
    const band = bands[current];
    const next = bands[current + 1];
    if (band === undefined) continue;
    let fraction = 0;
    if (next !== undefined && band.toY !== undefined && (band.blend ?? 0) > 0) {
      const blend = band.blend ?? 0;
      const start = band.toY - Math.ceil(blend / 2);
      if (y >= start) fraction = (y - start + 0.5) / blend;
    }
    for (let x = 0; x < target.width; x++) {
      const showNext = next !== undefined && fraction > 0 && ditherShowsNext(x, y, fraction);
      target.pixels[y * target.width + x] = showNext ? next.index : band.index;
    }
  }
}

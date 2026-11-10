import type { Palette } from './palette.ts';

/** Marks a pixel with no palette entry (transparent in a sprite). */
export const NO_PIXEL = 255;

/** A palette-indexed image: one byte per pixel, row-major from the top-left. */
export interface IndexedImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

export function createIndexedImage(width: number, height: number, fill = NO_PIXEL): IndexedImage {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Image size must be positive whole pixels, got ${width} x ${height}`);
  }
  return { width, height, pixels: new Uint8Array(width * height).fill(fill) };
}

/**
 * Copies `source` onto `target` at a whole-pixel position, skipping NO_PIXEL and clipping at the
 * edges. `map` translates source values to palette indices (identity when omitted).
 */
export function blit(
  target: IndexedImage,
  source: IndexedImage,
  x: number,
  y: number,
  map?: (value: number) => number,
): void {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`Draw positions must be whole pixels, got (${x}, ${y})`);
  }
  for (let sy = 0; sy < source.height; sy++) {
    const ty = y + sy;
    if (ty < 0 || ty >= target.height) continue;
    for (let sx = 0; sx < source.width; sx++) {
      const tx = x + sx;
      if (tx < 0 || tx >= target.width) continue;
      const value = source.pixels[sy * source.width + sx] ?? NO_PIXEL;
      if (value === NO_PIXEL) continue;
      target.pixels[ty * target.width + tx] = map === undefined ? value : map(value);
    }
  }
}

/**
 * Expands an indexed image to RGBA bytes. NO_PIXEL becomes fully transparent; every other value
 * must be a palette index.
 */
export function toRgba(image: IndexedImage, palette: Palette): Uint8Array {
  const out = new Uint8Array(image.width * image.height * 4);
  for (let i = 0; i < image.pixels.length; i++) {
    const value = image.pixels[i] ?? NO_PIXEL;
    if (value === NO_PIXEL) continue;
    const entry = palette.entries[value];
    if (entry === undefined) throw new Error(`Pixel ${i} holds ${value}, not a palette index`);
    out[i * 4] = entry.rgb[0];
    out[i * 4 + 1] = entry.rgb[1];
    out[i * 4 + 2] = entry.rgb[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** The set of palette indices an image uses (NO_PIXEL excluded). */
export function usedIndices(image: IndexedImage): Set<number> {
  const used = new Set<number>();
  for (const value of image.pixels) if (value !== NO_PIXEL) used.add(value);
  return used;
}

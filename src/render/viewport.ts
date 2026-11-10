/**
 * The pixel contract (Book 1 section 17, Book 7 section 01): a 640 x 360 logical frame, scaled
 * to the screen by a whole number and letterboxed, never stretched.
 */

export const LOGICAL_WIDTH = 640;
export const LOGICAL_HEIGHT = 360;

export interface Viewport {
  /** Whole-number scale from logical to device pixels. */
  readonly scale: number;
  /** Left edge of the frame in device pixels (negative if a tiny window crops it). */
  readonly x: number;
  /** Top edge of the frame in device pixels. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Largest whole-number scale at which the logical frame fits the drawing surface, centred, with
 * the remainder letterboxed. Below 640 x 360 device pixels the scale stays at 1 and the frame is
 * cropped evenly on each side rather than shrunk.
 */
export function computeViewport(
  surfaceWidth: number,
  surfaceHeight: number,
  logicalWidth: number = LOGICAL_WIDTH,
  logicalHeight: number = LOGICAL_HEIGHT,
): Viewport {
  const w = Math.max(0, Math.floor(surfaceWidth));
  const h = Math.max(0, Math.floor(surfaceHeight));
  const scale = Math.max(1, Math.min(Math.floor(w / logicalWidth), Math.floor(h / logicalHeight)));
  const width = logicalWidth * scale;
  const height = logicalHeight * scale;
  return {
    scale,
    width,
    height,
    x: Math.floor((w - width) / 2),
    y: Math.floor((h - height) / 2),
  };
}

/**
 * Motion with the camera still (Book 7 section 14, "Motion"): the share of the screen that keeps
 * moving. The same measure as the approved mockup's (docs/art/mockup-src/measure.py): the frame
 * is cut into 20 x 20 pixel cells; a cell changes between two frames if at least 2% of its pixels
 * change by more than 24 (the sum over R, G and B); a cell has continuous motion if it changes
 * between at least a quarter of consecutive frame pairs, so a one-off change does not count.
 */

export const MOTION_CELL = 20;
const THRESH = 24;
const SHARE = 0.02;
const PAIRS = 0.25;

/**
 * The Book 7 threshold: with the camera still on a place, at least this share of cells must have
 * continuous motion. The approved Wreck Strand mockup has 89.2% with its cloud shadows frozen
 * (100% with them); the standard asks for at least 80% (nine tenths of the mockup), which leaves room for the solid things
 * the mockup also leaves still (wall, boulder crowns, the bank face) and nothing more.
 */
export const MOTION_THRESHOLD = 0.8;
/** With reduced motion the world still moves (water, wind, life), more gently. */
export const REDUCED_MOTION_THRESHOLD = 0.5;

export interface MotionResult {
  /** Share of cells with continuous motion, 0..1. */
  readonly share: number;
  readonly cellsX: number;
  readonly cellsY: number;
  /** One flag per cell, row by row. */
  readonly cells: readonly boolean[];
}

/** `frames` are RGBA images of `width` x `height`, in time order. */
export function continuousMotion(
  frames: readonly Uint8Array[],
  width: number,
  height: number,
): MotionResult {
  const cellsX = Math.floor(width / MOTION_CELL);
  const cellsY = Math.floor(height / MOTION_CELL);
  const counts = new Array<number>(cellsX * cellsY).fill(0);
  for (let f = 1; f < frames.length; f++) {
    const a = frames[f - 1];
    const b = frames[f];
    if (a === undefined || b === undefined) continue;
    for (let cy = 0; cy < cellsY; cy++) {
      for (let cx = 0; cx < cellsX; cx++) {
        let changed = 0;
        for (let y = cy * MOTION_CELL; y < (cy + 1) * MOTION_CELL; y++) {
          for (let x = cx * MOTION_CELL; x < (cx + 1) * MOTION_CELL; x++) {
            const i = (y * width + x) * 4;
            const d =
              Math.abs((a[i] ?? 0) - (b[i] ?? 0)) +
              Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0)) +
              Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0));
            if (d > THRESH) changed++;
          }
        }
        if (changed / (MOTION_CELL * MOTION_CELL) > SHARE) {
          const k = cy * cellsX + cx;
          counts[k] = (counts[k] ?? 0) + 1;
        }
      }
    }
  }
  const pairs = Math.max(1, frames.length - 1);
  const cells = counts.map((n) => n / pairs >= PAIRS);
  return { share: cells.filter(Boolean).length / cells.length, cellsX, cellsY, cells };
}

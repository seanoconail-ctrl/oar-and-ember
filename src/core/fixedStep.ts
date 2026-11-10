/**
 * The fixed simulation step (Book 2 section 03): 60 ticks per second, with render interpolation.
 * Pure: the caller passes elapsed wall-clock time in; the simulation itself never reads a clock.
 */

export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** A frame longer than this (a background tab, a debugger pause) is not caught up in full. */
export const MAX_FRAME_MS = 250;

export interface StepPlan {
  /** Simulation ticks to run this frame. */
  readonly steps: number;
  /** Unspent time carried to the next frame, in milliseconds. */
  readonly accumulator: number;
  /** How far between the last tick and the next the frame falls, 0 to 1, for interpolation. */
  readonly alpha: number;
}

export function planSteps(accumulator: number, elapsedMs: number): StepPlan {
  const elapsed = Math.min(Math.max(0, elapsedMs), MAX_FRAME_MS);
  let acc = accumulator + elapsed;
  const steps = Math.floor(acc / TICK_MS + 1e-9);
  acc = Math.max(0, acc - steps * TICK_MS);
  return { steps, accumulator: acc, alpha: Math.min(1, acc / TICK_MS) };
}

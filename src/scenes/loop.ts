/**
 * The browser frame loop: turns wall-clock frames into fixed 60 Hz simulation ticks and hands the
 * renderer an interpolation fraction (Book 2 section 03). Wall-clock time is read here, in
 * scenes/, and never inside sim/.
 */
import { planSteps } from '../core/fixedStep.ts';

export interface Loop {
  stop(): void;
}

export function startLoop(step: () => void, render: (alpha: number) => void): Loop {
  let accumulator = 0;
  let last = performance.now();
  let handle = 0;
  let running = true;
  const frame = (now: number): void => {
    if (!running) return;
    const plan = planSteps(accumulator, now - last);
    last = now;
    accumulator = plan.accumulator;
    for (let i = 0; i < plan.steps; i++) step();
    render(plan.alpha);
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      cancelAnimationFrame(handle);
    },
  };
}

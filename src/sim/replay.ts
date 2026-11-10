/**
 * Record and replay (Book 2 section 03): a recording is the starting state, every command with
 * the tick it arrived on, and state hashes at checkpoints. Replaying it must reproduce every hash.
 */
import type { TimeBalance } from '../content/balance.ts';
import { createSimulation, stateHash } from './simulation.ts';
import type { Command, SimState } from './simulation.ts';

export interface TimedCommand {
  readonly tick: number;
  readonly command: Command;
}

export interface Recording {
  /** A copy of the state the recording starts from (a new campaign or a save). */
  readonly start: SimState;
  readonly inputs: readonly TimedCommand[];
  readonly ticks: number;
  readonly checkpoints: readonly { readonly tick: number; readonly hash: string }[];
}

/** A deep copy through JSON, exactly as a save file would store it. */
export function snapshot(state: SimState): SimState {
  return JSON.parse(JSON.stringify(state)) as SimState;
}

/**
 * Runs `ticks` ticks from `start`, submitting each input on its tick, and records a hash every
 * `every` ticks and at the end.
 */
export function record(
  b: TimeBalance,
  start: SimState,
  inputs: readonly TimedCommand[],
  ticks: number,
  every: number,
): Recording & { readonly final: SimState } {
  const sorted = [...inputs].sort((x, y) => x.tick - y.tick);
  const sim = createSimulation(b, snapshot(start));
  const first = sim.state.tick;
  const checkpoints: { tick: number; hash: string }[] = [];
  let next = 0;
  for (let i = 0; i < ticks; i++) {
    while (next < sorted.length && (sorted[next]?.tick ?? Infinity) <= sim.state.tick) {
      const input = sorted[next];
      if (input !== undefined) sim.submit(input.command);
      next++;
    }
    sim.step();
    const ran = sim.state.tick - first;
    if (ran % every === 0 || ran === ticks)
      checkpoints.push({ tick: sim.state.tick, hash: stateHash(sim.state) });
  }
  return { start: snapshot(start), inputs: sorted, ticks, checkpoints, final: sim.state };
}

export interface ReplayResult {
  readonly ok: boolean;
  /** Checkpoints whose hash differed, with both hashes. */
  readonly mismatches: readonly { tick: number; expected: string; actual: string }[];
}

export function replay(b: TimeBalance, recording: Recording): ReplayResult {
  const every =
    recording.checkpoints.length > 1
      ? (recording.checkpoints[1]?.tick ?? 0) - (recording.checkpoints[0]?.tick ?? 0)
      : recording.ticks;
  const again = record(b, recording.start, recording.inputs, recording.ticks, Math.max(1, every));
  const mismatches = recording.checkpoints.flatMap((cp, i) => {
    const actual = again.checkpoints[i];
    return actual?.tick === cp.tick && actual.hash === cp.hash
      ? []
      : [{ tick: cp.tick, expected: cp.hash, actual: actual?.hash ?? 'missing' }];
  });
  return {
    ok: mismatches.length === 0 && again.checkpoints.length === recording.checkpoints.length,
    mismatches,
  };
}

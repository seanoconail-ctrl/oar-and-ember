/** Stage 2 acceptance check 1: replay reproduces identical state hashes. */
import { describe, expect, it } from 'vitest';
import { nextInt, seedStream } from '../../src/core/rng.ts';
import { record, replay, snapshot } from '../../src/sim/replay.ts';
import type { TimedCommand } from '../../src/sim/replay.ts';
import { initialState, stateHash } from '../../src/sim/simulation.ts';
import { loadTimeBalance } from '../../src/tools/content/loadBalance.ts';

const b = loadTimeBalance();
const TICKS_PER_DAY = 20 * 60 * b.secondsPerHour;

/** A stream of player commands over `ticks`, generated from a test seed. */
function scriptedInputs(seed: string, ticks: number): TimedCommand[] {
  const s = seedStream(seed, 'generation');
  const inputs: TimedCommand[] = [];
  for (let tick = nextInt(s, 0, 2000); tick < ticks; tick += nextInt(s, 500, 9000)) {
    const roll = nextInt(s, 0, 9);
    inputs.push({
      tick,
      command:
        roll < 7
          ? { type: 'SLEEP' }
          : {
              type: 'SET_DAY_LENGTH',
              multiplier: [0.5, 0.75, 1, 1.25, 1.5][nextInt(s, 0, 4)] ?? 1,
            },
    });
  }
  return inputs;
}

describe('record and replay', () => {
  const ticks = 4 * TICKS_PER_DAY;
  const start = initialState('replay-seed', b);
  const inputs = scriptedInputs('replay-script', ticks);
  const recording = record(b, start, inputs, ticks, 3000);

  it('records commands and checkpoint hashes over four on-foot days', () => {
    expect(inputs.length).toBeGreaterThan(20);
    expect(recording.checkpoints.length).toBe(Math.ceil(ticks / 3000));
    expect(new Set(recording.checkpoints.map((c) => c.hash)).size).toBe(
      recording.checkpoints.length,
    );
    expect(recording.final.calendar.day).toBeGreaterThan(2);
  });

  it('reproduces every hash when replayed', () => {
    expect(replay(b, recording)).toEqual({ ok: true, mismatches: [] });
  });

  it('reproduces the same hashes when resumed from a save part-way through', () => {
    const half = Math.floor(ticks / 2 / 3000) * 3000;
    const first = record(b, start, inputs, half, 3000);
    const saved = snapshot(first.final);
    const rest = record(
      b,
      saved,
      inputs.filter((i) => i.tick >= half),
      ticks - half,
      3000,
    );
    expect([...first.checkpoints, ...rest.checkpoints]).toEqual(recording.checkpoints);
    expect(stateHash(rest.final)).toBe(stateHash(recording.final));
  });

  it('notices a single changed input', () => {
    const changed = {
      ...recording,
      // One extra command that changes the state: a longer day from tick 10.
      inputs: [
        { tick: 10, command: { type: 'SET_DAY_LENGTH', multiplier: 1.5 } } as const,
        ...recording.inputs,
      ],
    };
    const result = replay(b, changed);
    expect(result.ok).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
  });

  it('gives a different history for a different campaign seed', () => {
    const other = record(b, initialState('another-seed', b), inputs, 3000, 3000);
    expect(other.checkpoints[0]?.hash).not.toBe(recording.checkpoints[0]?.hash);
  });
});

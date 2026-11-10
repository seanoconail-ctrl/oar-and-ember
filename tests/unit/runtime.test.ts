/** Stage 2: RNG streams, the fixed step, the event bus, hashing and the determinism lint rule. */
import { join } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events.ts';
import { MAX_FRAME_MS, planSteps, TICK_MS } from '../../src/core/fixedStep.ts';
import { hashValue, stableStringify } from '../../src/core/hash.ts';
import {
  chance,
  nextFloat,
  nextInt,
  nextU32,
  pick,
  RNG_STREAMS,
  seedAllStreams,
  seedStream,
} from '../../src/core/rng.ts';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';

describe('RNG streams', () => {
  it('has the eight streams of Book 2 section 03', () => {
    expect(RNG_STREAMS).toEqual([
      'weather',
      'encounters',
      'loot',
      'combat',
      'ai',
      'people',
      'generation',
      'gore',
    ]);
  });

  it('gives the same sequence for the same seed and stream', () => {
    const a = seedStream('skarv', 'weather');
    const b = seedStream('skarv', 'weather');
    expect(Array.from({ length: 50 }, () => nextU32(a))).toEqual(
      Array.from({ length: 50 }, () => nextU32(b)),
    );
  });

  it('gives different sequences for different streams and seeds', () => {
    const first = (s: ReturnType<typeof seedStream>) => Array.from({ length: 4 }, () => nextU32(s));
    expect(first(seedStream('skarv', 'weather'))).not.toEqual(first(seedStream('skarv', 'combat')));
    expect(first(seedStream('skarv', 'weather'))).not.toEqual(
      first(seedStream('skarw', 'weather')),
    );
  });

  it('keeps streams independent: drawing from one never moves another', () => {
    const streams = seedAllStreams('skarv');
    const weatherBefore = [...streams.weather];
    for (let i = 0; i < 100; i++) nextU32(streams.combat);
    expect(streams.weather).toEqual(weatherBefore);
  });

  it('resumes exactly from saved state', () => {
    const s = seedStream('skarv', 'loot');
    for (let i = 0; i < 10; i++) nextU32(s);
    const saved = JSON.parse(JSON.stringify(s)) as typeof s;
    expect(Array.from({ length: 20 }, () => nextU32(saved))).toEqual(
      Array.from({ length: 20 }, () => nextU32(s)),
    );
  });

  it('draws whole numbers in range, evenly enough, and floats in [0, 1)', () => {
    const s = seedStream('skarv', 'people');
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) {
      const v = nextInt(s, 1, 6);
      counts[v - 1] = (counts[v - 1] ?? 0) + 1;
    }
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(s);
      expect(f >= 0 && f < 1).toBe(true);
    }
    expect(chance(s, 0)).toBe(false);
    expect(chance(s, 1)).toBe(true);
    expect(['a', 'b']).toContain(pick(s, ['a', 'b']));
    expect(() => nextInt(s, 3, 2)).toThrow();
  });
});

describe('the fixed 60 Hz step', () => {
  it('turns a second of frames into 60 ticks, whatever the frame rate', () => {
    for (const fps of [30, 60, 75, 144]) {
      let acc = 0;
      let steps = 0;
      for (let i = 0; i < fps; i++) {
        const plan = planSteps(acc, 1000 / fps);
        acc = plan.accumulator;
        steps += plan.steps;
      }
      expect(steps).toBe(60);
    }
  });

  it('gives the renderer a fraction between ticks', () => {
    const plan = planSteps(0, TICK_MS * 1.5);
    expect(plan.steps).toBe(1);
    expect(plan.alpha).toBeCloseTo(0.5, 5);
  });

  it('does not try to catch up a long stall in full', () => {
    // 250 ms is exactly 15 ticks.
    expect(planSteps(0, 5000).steps).toBe(Math.round(MAX_FRAME_MS / TICK_MS));
    expect(planSteps(0, -10).steps).toBe(0);
  });
});

describe('the event bus', () => {
  it('delivers by type and to all-listeners, in order, and can unsubscribe', () => {
    type E = { type: 'a'; n: number } | { type: 'b' };
    const bus = new EventBus<E>();
    const seen: string[] = [];
    const off = bus.on('a', (e) => seen.push(`a${e.n}`));
    bus.onAny((e) => seen.push(`any:${e.type}`));
    bus.emit({ type: 'a', n: 1 });
    bus.emit({ type: 'b' });
    off();
    bus.emit({ type: 'a', n: 2 });
    expect(seen).toEqual(['a1', 'any:a', 'any:b', 'any:a']);
  });
});

describe('state hashing', () => {
  it('ignores key order and catches any change', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
    expect(hashValue({ a: 1, b: 2 })).toBe(hashValue({ b: 2, a: 1 }));
    expect(hashValue({ a: 1, b: 2 })).not.toBe(hashValue({ a: 1, b: 3 }));
    expect(() => hashValue({ a: Number.NaN })).toThrow();
  });
});

describe('the determinism lint rule (Stage 2 acceptance check 3)', () => {
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfig: [tseslint.configs.disableTypeChecked],
  });
  const lint = async (file: string, code: string) => {
    const [result] = await eslint.lintText(code, { filePath: join(REPO_ROOT, file) });
    return (result?.messages ?? [])
      .filter(
        (m) => m.ruleId === 'no-restricted-properties' || m.ruleId === 'no-restricted-globals',
      )
      .map((m) => m.message);
  };

  it.each([
    'export const roll = Math.random();',
    'export const now = Date.now();',
    'export const when = new Date();',
    'export const t = performance.now();',
    'setTimeout(() => undefined, 10);',
    'export const id = crypto.randomUUID();',
  ])('fails a deliberate violation in sim/: %s', async (code) => {
    expect((await lint('src/sim/calendar/probe.ts', code)).join('\n')).toMatch(/Book 2 section 03/);
    expect((await lint('src/core/probe.ts', code)).join('\n')).toMatch(/Book 2 section 03/);
  });

  it('allows wall-clock time where it belongs (the frame loop in scenes/)', async () => {
    expect(await lint('src/scenes/probe.ts', 'export const t = performance.now();')).toEqual([]);
  });
});

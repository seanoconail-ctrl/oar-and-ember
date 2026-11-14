/**
 * Named, seeded random streams (Book 2 section 03). Each stream is an independent sfc32 generator
 * whose four 32-bit words are its whole state, so it saves and reloads exactly. Streams are seeded
 * from the campaign seed and the stream's name, so drawing from one never disturbs another.
 */
import { cyrb53 } from './hash.ts';

export const RNG_STREAMS = [
  'weather',
  'encounters',
  'loot',
  'combat',
  'ai',
  'people',
  'generation',
  'gore',
] as const;

export type RngStream = (typeof RNG_STREAMS)[number];

/** The four state words of an sfc32 generator. */
export type RngState = [number, number, number, number];

/** Derives a stream's starting state from the campaign seed. */
export function seedStream(seed: string, stream: RngStream): RngState {
  const words: RngState = [
    cyrb53(`${seed}/${stream}`, 1) >>> 0,
    cyrb53(`${seed}/${stream}`, 2) >>> 0,
    cyrb53(`${seed}/${stream}`, 3) >>> 0,
    cyrb53(`${seed}/${stream}`, 4) >>> 0,
  ];
  // Warm up so similar seeds diverge immediately.
  for (let i = 0; i < 16; i++) nextU32(words);
  return words;
}

export function seedAllStreams(seed: string): Record<RngStream, RngState> {
  const out = {} as Record<RngStream, RngState>;
  for (const stream of RNG_STREAMS) out[stream] = seedStream(seed, stream);
  return out;
}

/** Advances `state` in place and returns the next 32-bit unsigned value. */
export function nextU32(state: RngState): number {
  let [a, b, c, d] = state;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  state[0] = a;
  state[1] = b;
  state[2] = c;
  state[3] = d;
  return t >>> 0;
}

/** A float in [0, 1). */
export function nextFloat(state: RngState): number {
  return nextU32(state) / 4294967296;
}

/** A whole number in [min, max], both included, without modulo bias. */
export function nextInt(state: RngState, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error(`nextInt needs whole numbers with min <= max, got ${min}..${max}`);
  }
  const span = max - min + 1;
  if (span > 4294967296) throw new Error('nextInt range is wider than 32 bits');
  const limit = 4294967296 - (4294967296 % span);
  let value = nextU32(state);
  while (value >= limit) value = nextU32(state);
  return min + (value % span);
}

/** True with probability `p`. */
export function chance(state: RngState, p: number): boolean {
  if (!(p >= 0 && p <= 1)) throw new Error(`chance needs 0 <= p <= 1, got ${p}`);
  return nextFloat(state) < p;
}

/** One element of a non-empty list. */
export function pick<T>(state: RngState, items: readonly T[]): T {
  const item = items[nextInt(state, 0, items.length - 1)];
  if (item === undefined) throw new Error('pick needs a non-empty list');
  return item;
}

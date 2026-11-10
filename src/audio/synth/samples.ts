/**
 * The instrument samples, generated in code (Book 11, generated audio: no recordings). Like the
 * SNES's sound chip, the game holds one short sample per instrument at 32 kHz and plays every
 * note by pitching it, with a loop over the sustained part. Generation is pure and
 * deterministic (a seeded hash, never Math.random), so the same build always sounds the same and
 * tests can inspect the samples.
 */

export const SAMPLE_RATE = 32000;

export interface Sample {
  readonly data: Float32Array;
  /** Frequency of the sample as recorded, Hz (the note it plays at playback rate 1). */
  readonly baseHz: number;
  /** Loop start and end in seconds, or null for a one-shot. */
  readonly loop: { readonly start: number; readonly end: number } | null;
}

/** A small, well-mixed deterministic random stream. */
export function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000003) / 1000003;
  };
}

function normalise(data: Float32Array, peak = 0.9): Float32Array {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < data.length; i++) data[i] = ((data[i] ?? 0) / max) * peak;
  return data;
}

/**
 * A plucked string (Karplus-Strong): a burst of noise circulating in a delay line one period
 * long, softened each pass. `bright` 0..1 shapes the pluck; `decay` per pass near 1 rings longer.
 */
function pluck(hz: number, seconds: number, bright: number, decay: number, seed: number): Sample {
  const n = Math.round(seconds * SAMPLE_RATE);
  const period = Math.max(2, Math.round(SAMPLE_RATE / hz - 0.5));
  const out = new Float32Array(n);
  const r = rng(seed);
  const line = new Float32Array(period);
  // The excitation: noise low-passed by brightness, with the pick position notch (a pluck near
  // the bridge is brighter).
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const x = r() * 2 - 1;
    prev = prev + (x - prev) * (0.25 + 0.7 * bright);
    line[i] = prev;
  }
  let idx = 0;
  let last = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx] ?? 0;
    const next = line[(idx + 1) % period] ?? 0;
    const v = decay * (cur * (0.5 + 0.08 * bright) + next * (0.5 - 0.08 * bright));
    line[idx] = v;
    // A little body resonance: one-pole smoothing mixed with the dry string.
    last = last + (cur - last) * 0.6;
    out[i] = cur * 0.7 + last * 0.3;
    idx = (idx + 1) % period;
  }
  // A soft attack edge (a few samples) so the pluck does not click.
  for (let i = 0; i < 24 && i < n; i++) out[i] = (out[i] ?? 0) * (i / 24);
  return { data: normalise(out), baseHz: SAMPLE_RATE / (period + 0.5), loop: null };
}

/**
 * A sustained, looped tone from harmonics with a formant shape: flutes, drones, the choir pad
 * and the horn. `loopSeconds` holds a whole number of cycles of every partial (the frequencies
 * are chosen so), so the loop is seamless. Breath is noise shaped to sit on the harmonics.
 */
function tone(opts: {
  hz: number;
  seconds: number;
  attack: number;
  loopSeconds: number;
  partials: (k: number) => number;
  voices?: readonly number[];
  breath?: number;
  chiff?: number;
  seed: number;
}): Sample {
  const n = Math.round(opts.seconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  const voices = opts.voices ?? [0];
  const r = rng(opts.seed);
  const phases = voices.map(() => r() * Math.PI * 2);
  const maxK = Math.floor(SAMPLE_RATE / 2 / (opts.hz * 1.05));
  for (let k = 1; k <= Math.min(maxK, 40); k++) {
    const a = opts.partials(k);
    if (a < 1e-4) continue;
    voices.forEach((det, v) => {
      // Detuned copies by whole cycles over the loop keep it seamless.
      const f = opts.hz * k + det / opts.loopSeconds;
      const w = (2 * Math.PI * f) / SAMPLE_RATE;
      const ph = (phases[v] ?? 0) * k;
      for (let i = 0; i < n; i++) out[i] = (out[i] ?? 0) + a * Math.sin(w * i + ph);
    });
  }
  // Breath: noise band-passed around the fundamental region, looping with the tone.
  if ((opts.breath ?? 0) > 0) {
    const loopN = Math.round(opts.loopSeconds * SAMPLE_RATE);
    const noise = new Float32Array(loopN);
    let lp = 0;
    let hp = 0;
    for (let i = 0; i < loopN; i++) {
      const x = r() * 2 - 1;
      lp += (x - lp) * 0.35;
      hp = lp - (hp + (lp - hp) * 0.02);
      noise[i] = hp;
    }
    // Crossfade the noise loop's ends so it repeats without a click.
    const fade = Math.min(800, loopN >> 2);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      noise[i] = (noise[i] ?? 0) * t + (noise[loopN - fade + i] ?? 0) * (1 - t);
    }
    for (let i = 0; i < n; i++)
      out[i] = (out[i] ?? 0) + (opts.breath ?? 0) * (noise[i % (loopN - fade)] ?? 0);
  }
  // Attack, and a breathy chiff at the start for flutes.
  const att = Math.round(opts.attack * SAMPLE_RATE);
  for (let i = 0; i < Math.min(att, n); i++) out[i] = (out[i] ?? 0) * (i / att);
  if ((opts.chiff ?? 0) > 0) {
    const len = Math.round(0.06 * SAMPLE_RATE);
    for (let i = 0; i < len && i < n; i++)
      out[i] = (out[i] ?? 0) + (opts.chiff ?? 0) * (r() * 2 - 1) * (1 - i / len) ** 2;
  }
  const start = opts.seconds - opts.loopSeconds;
  return {
    data: normalise(out, 0.8),
    baseHz: opts.hz,
    loop: { start, end: opts.seconds },
  };
}

/** A formant weight: peaks at the given centres (Hz) with widths. */
function formant(hz: number, peaks: readonly (readonly [number, number, number])[]) {
  return (k: number): number => {
    const f = hz * k;
    let a = 0;
    for (const [c, w, g] of peaks) a += g * Math.exp(-(((f - c) / w) ** 2));
    return a / Math.sqrt(k);
  };
}

/** A bell: inharmonic partials that each die away at their own rate. */
function bell(hz: number, seconds: number): Sample {
  const n = Math.round(seconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  const partials: readonly (readonly [number, number, number])[] = [
    [0.5, 0.35, 1.6],
    [1, 1, 1.2],
    [2.0, 0.55, 0.8],
    [2.76, 0.45, 0.55],
    [5.4, 0.25, 0.3],
    [8.93, 0.12, 0.18],
  ];
  for (const [ratio, amp, decay] of partials) {
    const w = (2 * Math.PI * hz * ratio) / SAMPLE_RATE;
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      out[i] = (out[i] ?? 0) + amp * Math.exp(-t / decay) * Math.sin(w * i);
    }
  }
  for (let i = 0; i < 40; i++) out[i] = (out[i] ?? 0) * (i / 40);
  return { data: normalise(out), baseHz: hz, loop: null };
}

/** A frame drum: a pitched membrane thump that falls in pitch, with a skin slap. */
function frameDrum(hz: number, seed: number): Sample {
  const seconds = 0.9;
  const n = Math.round(seconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  const r = rng(seed);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = hz * (1 + 0.9 * Math.exp(-t / 0.03));
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const body =
      Math.sin(phase) * Math.exp(-t / 0.22) + 0.35 * Math.sin(phase * 1.59) * Math.exp(-t / 0.1);
    const x = r() * 2 - 1;
    lp += (x - lp) * 0.2;
    const slap = lp * Math.exp(-t / 0.018) * 1.4;
    out[i] = body + slap;
  }
  return { data: normalise(out), baseHz: hz, loop: null };
}

/** A hand percussion click: a bright knock of noise and a short resonance (bones, rim). */
function knock(hz: number, seed: number): Sample {
  const n = Math.round(0.25 * SAMPLE_RATE);
  const out = new Float32Array(n);
  const r = rng(seed);
  let bp1 = 0;
  let bp2 = 0;
  const w = (2 * Math.PI * hz) / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const x = (r() * 2 - 1) * Math.exp(-t / 0.006);
    // A two-pole resonator at hz.
    const y = x + 2 * 0.985 * Math.cos(w) * bp1 - 0.985 * 0.985 * bp2;
    bp2 = bp1;
    bp1 = y;
    out[i] = y * Math.exp(-t / 0.05) + x * 0.6;
  }
  return { data: normalise(out), baseHz: hz, loop: null };
}

/** A herring gull's call: a falling "kee-ow" with a rough edge. */
function gull(seed: number): Sample {
  const seconds = 0.55;
  const n = Math.round(seconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  const r = rng(seed);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const u = t / seconds;
    const f = 1900 - 900 * u + 300 * Math.sin(u * Math.PI);
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7;
    const rough = 0.7 + 0.3 * Math.sin(2 * Math.PI * 38 * t);
    out[i] =
      env * rough * (Math.sin(phase) + 0.45 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase)) +
      env * 0.05 * (r() * 2 - 1);
  }
  return { data: normalise(out), baseHz: 1760, loop: null };
}

export type InstrumentName =
  | 'lyre'
  | 'harp'
  | 'flute'
  | 'whistle'
  | 'drone'
  | 'pad'
  | 'bells'
  | 'horn'
  | 'drum'
  | 'knock'
  | 'gull';

/** Every instrument's sample. */
export function makeSamples(): Record<InstrumentName, Sample> {
  return {
    // Plucked lyre: warm, a mid pluck that rings about two seconds.
    lyre: pluck(261.63, 2.2, 0.3, 0.9965, 11),
    // Bright harp: brighter pluck, longer ring.
    harp: pluck(523.25, 2.6, 0.85, 0.9982, 12),
    // Breathy flute (bone or wooden): soft harmonics, a lot of breath, a chiff.
    flute: tone({
      hz: 440,
      seconds: 1.4,
      attack: 0.06,
      loopSeconds: 1.0,
      partials: (k) => (k === 1 ? 1 : k === 2 ? 0.32 : k === 3 ? 0.12 : 0.05 / k),
      breath: 0.16,
      chiff: 0.35,
      seed: 13,
    }),
    // Tin whistle: purer and brighter, less breath.
    whistle: tone({
      hz: 880,
      seconds: 1.3,
      attack: 0.03,
      loopSeconds: 1.0,
      partials: (k) => (k === 1 ? 1 : k === 2 ? 0.18 : k === 3 ? 0.07 : 0),
      breath: 0.07,
      chiff: 0.25,
      seed: 14,
    }),
    // Low drone: a reedy fifth (root and fifth together), slowly beating.
    drone: tone({
      hz: 110,
      seconds: 3,
      attack: 0.3,
      loopSeconds: 2,
      partials: (k) => (k % 2 === 1 ? 0.9 : 0.55) / k ** 0.9 + (k % 3 === 0 ? 0.5 / k ** 0.8 : 0),
      voices: [0, 1],
      seed: 15,
    }),
    // A soft choir-like pad: an "ah" with three slightly detuned voices.
    pad: tone({
      hz: 220,
      seconds: 3,
      attack: 0.4,
      loopSeconds: 2,
      partials: formant(220, [
        [650, 260, 1],
        [1100, 300, 0.55],
        [2600, 500, 0.22],
      ]),
      voices: [0, 1, -1],
      breath: 0.03,
      seed: 16,
    }),
    bells: bell(523.25, 3.2),
    // A horn call: brassy harmonics, a slow-opening tone.
    horn: tone({
      hz: 220,
      seconds: 2,
      attack: 0.08,
      loopSeconds: 1,
      partials: formant(220, [
        [440, 400, 0.9],
        [1200, 700, 0.7],
        [2400, 600, 0.25],
      ]),
      voices: [0, 1],
      seed: 17,
    }),
    drum: frameDrum(73.42, 18),
    knock: knock(1400, 19),
    gull: gull(20),
  };
}

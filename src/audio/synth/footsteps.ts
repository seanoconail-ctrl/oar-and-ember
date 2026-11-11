/**
 * Footsteps, generated in code (Book 11 section 07, footsteps by surface; decision AU-10).
 *
 * Soft and natural rather than sharp: every step is low and dull, rises over a few milliseconds
 * (never a click), and is varied by a seeded random draw so no two steps sound the same. Each
 * surface has its own character: a soft thud on grass, a crunch of small stones on shingle, a
 * hush on sand, a duller squelch on wet sand, a splash in water and a dull knock on rock. Steps
 * sit well below the effects that matter (Book 11 section 09): FOOTSTEP_LEVEL scales them on the
 * effects bus, and the sound test checks they stay at least 10 dB under a light hit.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';

export const SURFACES = ['grass', 'shingle', 'sand', 'wet_sand', 'water', 'rock'] as const;
export type Surface = (typeof SURFACES)[number];
export type Gait = 'walk' | 'run' | 'sneak' | 'carry';

/** The level of a step on the effects bus, before gait (Book 11 section 09: below effects). */
export const FOOTSTEP_LEVEL = 0.16;

const GAIT: Readonly<Record<Gait, { level: number; pitch: number; length: number }>> = {
  walk: { level: 1, pitch: 1, length: 1 },
  run: { level: 1.3, pitch: 1.08, length: 0.8 },
  sneak: { level: 0.4, pitch: 0.95, length: 1.1 },
  carry: { level: 1.15, pitch: 0.88, length: 1.15 },
};

export function isSurface(s: string): s is Surface {
  return (SURFACES as readonly string[]).includes(s);
}

/**
 * One footstep at `at`, panned -1..1. `step` is a running count: the same count and surface
 * always make the same sound (deterministic), and each new count is different. Returns its
 * length in seconds.
 */
export function footstep(
  e: SynthEngine,
  at: number,
  surface: Surface,
  pan: number,
  step: number,
  gait: Gait = 'walk',
): number {
  const r = rng(1 + step * 7919 + SURFACES.indexOf(surface) * 104729);
  const vary = (spread: number): number => 1 + (r() * 2 - 1) * spread;
  const g = GAIT[gait];
  const level = FOOTSTEP_LEVEL * g.level * vary(0.18);
  const len = g.length * vary(0.15);
  const pitch = g.pitch * vary(0.12);

  // Every step goes through its own gentle low-pass, so nothing in it is bright or sharp.
  const p = e.ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(e.buses.effects);
  const dull = e.ctx.createBiquadFilter();
  dull.type = 'lowpass';
  dull.frequency.value = (surface === 'shingle' ? 2600 : surface === 'water' ? 2200 : 1500) * pitch;
  dull.Q.value = 0.5;
  const out = e.ctx.createGain();
  out.gain.value = level;
  out.connect(dull).connect(p);

  /** Filtered noise with a soft rise (never under 4 ms) and a smooth fall. */
  const breath = (
    start: number,
    type: BiquadFilterType,
    hz: number,
    q: number,
    rise: number,
    hold: number,
    fall: number,
    peak: number,
    sweepTo?: number,
  ): void => {
    const t = at + start;
    const src = e.noise(t);
    const f = e.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(hz * pitch, t);
    if (sweepTo !== undefined)
      f.frequency.exponentialRampToValueAtTime(sweepTo * pitch, t + rise + hold + fall);
    f.Q.value = q;
    const gn = e.ctx.createGain();
    envelope(gn.gain, t, [
      [0, 0],
      [Math.max(0.004, rise), peak],
      [Math.max(0.004, rise) + hold, peak * 0.7],
      [Math.max(0.004, rise) + hold + fall, 0],
    ]);
    src.connect(f).connect(gn).connect(out);
    src.stop(t + rise + hold + fall + 0.05);
  };

  /**
   * The body of the foot meeting the ground: a heel and then a softer roll onto the toe, a
   * low, soft sine thump each, with the gap and balance drawn afresh every step.
   */
  const toeGap = 0.025 + r() * 0.045;
  const toeShare = 0.25 + r() * 0.5;
  const thump = (start: number, hz: number, peak: number, fall: number): void => {
    // Mostly a soft, low rush of noise (different every time), with a little sine body.
    breath(start, 'lowpass', 210 * vary(0.2), 0.7, 0.006, 0.01, fall, peak * 0.9);
    single(start, hz * vary(0.15), peak * 0.45, fall);
    single(start + toeGap, hz * vary(0.2) * 1.15, peak * 0.45 * toeShare, fall * 0.8);
  };
  const single = (start: number, hz: number, peak: number, fall: number): void => {
    const t = at + start;
    const o = e.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz * pitch, t);
    o.frequency.exponentialRampToValueAtTime(hz * pitch * 0.7, t + fall);
    const gn = e.ctx.createGain();
    envelope(gn.gain, t, [
      [0, 0],
      [0.008, peak],
      [0.008 + fall, 0],
    ]);
    o.connect(gn).connect(out);
    o.start(t);
    o.stop(t + 0.008 + fall + 0.05);
  };

  switch (surface) {
    case 'grass': {
      // A soft thud, and the blades brushing.
      thump(0, 78 * vary(0.1), 0.9, 0.09 * len);
      breath(0, 'lowpass', 380, 0.7, 0.008, 0.02, 0.06 * len, 0.6);
      breath(0.01 * vary(0.5), 'bandpass', 1000 * vary(0.15), 0.8, 0.012, 0.03, 0.1 * len, 0.25);
      return 0.2 * len;
    }
    case 'shingle': {
      // A crunch: a light thud and a scatter of small stones shifting, each soft-edged.
      thump(0, 92 * vary(0.1), 0.5, 0.06 * len);
      breath(0, 'lowpass', 520, 0.7, 0.006, 0.015, 0.05 * len, 0.45);
      const grains = 6 + Math.floor(r() * 5);
      for (let i = 0; i < grains; i++) {
        const start = r() * 0.09 * len;
        breath(
          start,
          'bandpass',
          900 + r() * 900,
          1.6,
          0.004,
          0.004,
          0.018 + r() * 0.02,
          0.35 + r() * 0.4,
        );
      }
      return 0.18 * len;
    }
    case 'sand': {
      // A hush: soft, slow-rising, low.
      breath(0, 'lowpass', 820 * vary(0.15), 0.6, 0.02, 0.04, 0.13 * len, 0.75);
      thump(0, 70 * vary(0.1), 0.35, 0.07 * len);
      return 0.22 * len;
    }
    case 'wet_sand': {
      // Duller and heavier, with a small squelch falling in pitch.
      thump(0, 72 * vary(0.1), 0.6, 0.08 * len);
      breath(0, 'lowpass', 480 * vary(0.15), 0.7, 0.014, 0.03, 0.1 * len, 0.7);
      breath(0.02, 'bandpass', 700, 1.4, 0.01, 0.02, 0.08 * len, 0.25, 320);
      return 0.2 * len;
    }
    case 'water': {
      // A splash: water parting (a falling swish), a low plop, and a few drops.
      breath(0, 'bandpass', 1100 * vary(0.2), 0.9, 0.01, 0.04, 0.2 * len, 0.75, 400);
      thump(0.01, 150 * vary(0.12), 0.45, 0.08 * len);
      const drops = 2 + Math.floor(r() * 3);
      for (let i = 0; i < drops; i++) {
        const t = at + 0.06 + r() * 0.18 * len;
        const o = e.ctx.createOscillator();
        o.type = 'sine';
        const hz = (600 + r() * 500) * pitch;
        o.frequency.setValueAtTime(hz, t);
        o.frequency.exponentialRampToValueAtTime(hz * 1.6, t + 0.03);
        const gn = e.ctx.createGain();
        envelope(gn.gain, t, [
          [0, 0],
          [0.005, 0.08 + r() * 0.06],
          [0.035, 0],
        ]);
        o.connect(gn).connect(out);
        o.start(t);
        o.stop(t + 0.06);
      }
      return 0.32 * len;
    }
    case 'rock': {
      // A dull knock of a hide shoe on stone.
      thump(0, 110 * vary(0.1), 0.6, 0.05 * len);
      breath(0, 'lowpass', 900 * vary(0.15), 0.8, 0.005, 0.01, 0.045 * len, 0.55);
      return 0.12 * len;
    }
  }
}

/** Seconds between steps for a gait, for the sound test's walks (Book 10 section 02 speeds). */
export const STEP_INTERVAL: Readonly<Record<Gait, number>> = {
  walk: 0.5,
  run: 0.3,
  sneak: 0.62,
  carry: 0.56,
};

// ------------------------------------------------------------------ measurements

/** Measures of one rendered step, for the audio standard's checks. */
export interface StepMeasure {
  /** RMS over the step's window. */
  readonly rms: number;
  readonly peak: number;
  /** Spectral centroid in Hz (how bright it is). */
  readonly centroid: number;
  /** Milliseconds from start to 90% of the peak envelope (a click is under 1 ms). */
  readonly riseMs: number;
}

function fftMagnitudes(x: Float32Array): Float64Array {
  const n = x.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = (x[i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(a * k);
        const wi = Math.sin(a * k);
        const ur = re[i + k] ?? 0;
        const ui = im[i + k] ?? 0;
        const vr = (re[i + k + len / 2] ?? 0) * wr - (im[i + k + len / 2] ?? 0) * wi;
        const vi = (re[i + k + len / 2] ?? 0) * wi + (im[i + k + len / 2] ?? 0) * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
  }
  const mag = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i] ?? 0, im[i] ?? 0);
  return mag;
}

/** Measures a step in `samples` from `start` for `length` samples, at `rate` Hz. */
export function measureStep(
  samples: Float32Array,
  start: number,
  length: number,
  rate: number,
): StepMeasure {
  const win = samples.subarray(start, Math.min(samples.length, start + length));
  let sum = 0;
  let peak = 0;
  for (const v of win) {
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  // The envelope: peak absolute value in 0.5 ms blocks.
  const block = Math.max(1, Math.round(rate / 2000));
  const env: number[] = [];
  for (let i = 0; i < win.length; i += block) {
    let m = 0;
    for (let j = i; j < Math.min(win.length, i + block); j++)
      m = Math.max(m, Math.abs(win[j] ?? 0));
    env.push(m);
  }
  const top = Math.max(...env, 1e-9);
  const first = env.findIndex((v) => v > top * 0.05);
  const reach = env.findIndex((v) => v >= top * 0.9);
  const riseMs = Math.max(0, reach - Math.max(0, first)) * (block / rate) * 1000;
  let n = 1;
  while (n * 2 <= win.length && n < 8192) n *= 2;
  const mag = fftMagnitudes(win.subarray(0, n));
  let num = 0;
  let den = 0;
  for (let i = 0; i < mag.length; i++) {
    const hz = (i * rate) / n;
    num += hz * (mag[i] ?? 0);
    den += mag[i] ?? 0;
  }
  return {
    rms: Math.sqrt(sum / Math.max(1, win.length)),
    peak,
    centroid: num / (den || 1),
    riseMs,
  };
}

/** How alike two steps are: the peak normalised cross-correlation over small lags (1 = equal). */
export function likeness(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let best = 0;
  let ea = 0;
  let eb = 0;
  for (let i = 0; i < n; i++) {
    ea += (a[i] ?? 0) ** 2;
    eb += (b[i] ?? 0) ** 2;
  }
  const norm = Math.sqrt(ea * eb) || 1;
  for (let lag = -64; lag <= 64; lag += 4) {
    let s = 0;
    for (let i = Math.max(0, -lag); i < Math.min(n, n - lag); i++)
      s += (a[i] ?? 0) * (b[i + lag] ?? 0);
    best = Math.max(best, Math.abs(s) / norm);
  }
  return best;
}

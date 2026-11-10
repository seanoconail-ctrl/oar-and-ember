/**
 * Voice blips (Book 11 section 08, generated audio): dialogue and barks are text, and as each
 * line appears its speaker "speaks" it in short blips, one per syllable, in their own pitch,
 * timbre and rhythm. The vowels of the text pick each blip's colour, and the punctuation shapes
 * the line (a question rises, an exclamation lifts and quickens, a comma pauses). The steerer
 * has no voice blip (Book 8 section 03: the steerer is never voiced).
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';

export interface VoiceProfile {
  /** Speaking pitch, Hz. */
  readonly pitch: number;
  readonly wave: OscillatorType;
  /** Scales the vowel formants: a larger, deeper voice below 1. */
  readonly size: number;
  /** Syllable length and the gap after it, seconds. */
  readonly syllable: number;
  readonly gap: number;
  /** How much the pitch moves between syllables (0..1). */
  readonly lilt: number;
  /** Overall tilt of each phrase: positive rises, negative falls. */
  readonly tilt: number;
  readonly gain: number;
}

/** The first speakers (Book 5): each voice from who they are. */
export const VOICES: Readonly<Record<string, VoiceProfile>> = {
  // Hild: quick to help and to joke; a warm middle voice that lifts and dances.
  C_HILD: {
    pitch: 228,
    wave: 'triangle',
    size: 1.05,
    syllable: 0.07,
    gap: 0.03,
    lilt: 0.35,
    tilt: 0.05,
    gain: 1.4,
  },
  // Bran: in his forties, measured and grave; low, slow, steady.
  C_BRAN: {
    pitch: 112,
    wave: 'sawtooth',
    size: 0.82,
    syllable: 0.1,
    gap: 0.05,
    lilt: 0.12,
    tilt: -0.08,
    gain: 1.0,
  },
  // Runa: blunt and practical; clipped syllables, firm falls.
  C_RUNA: {
    pitch: 196,
    wave: 'square',
    size: 0.97,
    syllable: 0.058,
    gap: 0.035,
    lilt: 0.18,
    tilt: -0.14,
    gain: 0.8,
  },
  // Oddi: young and wiry; quick, higher, jittery.
  C_ODDI: {
    pitch: 258,
    wave: 'square',
    size: 1.12,
    syllable: 0.05,
    gap: 0.022,
    lilt: 0.55,
    tilt: 0.1,
    gain: 0.72,
  },
};

/** Formant pairs (Hz) for each vowel. */
const VOWELS: Readonly<Record<string, readonly [number, number]>> = {
  a: [780, 1250],
  e: [520, 1850],
  i: [330, 2300],
  o: [520, 900],
  u: [360, 820],
  y: [330, 2100],
};

/** The syllables of a line: one per vowel group, with what follows each word. */
export function syllables(text: string): { vowel: string; pause: number; end: string }[] {
  const out: { vowel: string; pause: number; end: string }[] = [];
  const words = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => /[a-z]/.test(w));
  for (const word of words) {
    let groups: string[] = word.match(/[aeiouy]+/g) ?? ['a'];
    // A silent final e ("here", "come") is not a syllable of its own.
    if (groups.length > 1 && /[^aeiouy]e[^a-z]*$/.test(word)) groups = groups.slice(0, -1);
    const punct = /[!?.,;:]+$/.exec(word)?.[0] ?? '';
    groups.forEach((g, i) => {
      const last = i === groups.length - 1;
      const pause = !last ? 0 : /[.!?]/.test(punct) ? 0.22 : /[,;:]/.test(punct) ? 0.12 : 0.04;
      out.push({ vowel: g[0] ?? 'a', pause, end: last ? punct : '' });
    });
  }
  return out;
}

/** Speaks `text` in blips from `at`; returns the length in seconds. */
export function speak(e: SynthEngine, at: number, speaker: string, text: string, pan = 0): number {
  const v = VOICES[speaker];
  if (v === undefined) return 0;
  const c = e.ctx;
  const out = c.createStereoPanner();
  out.pan.value = pan;
  out.connect(e.buses.voice);
  const r = rng(text.length * 31 + speaker.length);
  const syl = syllables(text);
  const exclaim = text.includes('!');
  const question = /\?\s*$/.test(text);
  let t = at;
  syl.forEach((s, i) => {
    const pos = syl.length <= 1 ? 0 : i / (syl.length - 1);
    let p = v.pitch * (1 + v.tilt * (pos - 0.5) * 2 + (r() - 0.5) * v.lilt * 0.5);
    if (exclaim) p *= 1.08;
    if (question && pos > 0.75) p *= 1 + (pos - 0.75) * 1.2;
    const len = v.syllable * (exclaim ? 0.9 : 1) * (0.8 + r() * 0.4);
    const o = c.createOscillator();
    o.type = v.wave;
    o.frequency.setValueAtTime(p, t);
    o.frequency.linearRampToValueAtTime(p * (1 - v.tilt * 0.15), t + len);
    const [f1, f2] = VOWELS[s.vowel] ?? VOWELS['a'] ?? [700, 1200];
    const g = c.createGain();
    envelope(g.gain, t, [
      [0, 0],
      [0.006, v.gain],
      [len * 0.7, v.gain * 0.8],
      [len, 0],
    ]);
    for (const [f, q, a] of [
      [f1 * v.size, 5, 1],
      [f2 * v.size, 7, 0.6],
    ] as const) {
      const b = c.createBiquadFilter();
      b.type = 'bandpass';
      b.frequency.value = f;
      b.Q.value = q;
      const bg = c.createGain();
      bg.gain.value = a;
      o.connect(b).connect(bg).connect(g);
    }
    g.connect(out);
    o.start(t);
    o.stop(t + len + 0.02);
    t += len + v.gap + s.pause;
  });
  return t - at;
}

/**
 * The synthesiser (Book 11 sections 02 and 10, generated audio). Runs on any BaseAudioContext:
 * the live AudioContext in play, an OfflineAudioContext for renders and tests.
 *
 * - Buses: master, music, ambience, effects, voice (blips) and tells, each with its own volume,
 *   and a mono switch on the master.
 * - Music plays through a pool of 8 voices, as the SNES did; a ninth note steals the voice
 *   closest to finishing. Effects, ambience and blips have their own budget (48 voices).
 * - One shared echo, SNES style: a delay with feedback through a low-pass, set per piece.
 * - A gentle low-pass on the music (about 7 kHz) gives the soft top of the SNES's
 *   interpolated samples.
 */
import type { Echo } from './notation.ts';
import { makeSample, rng, SAMPLE_RATE } from './samples.ts';
import type { InstrumentName, Sample } from './samples.ts';

export type Bus = 'master' | 'music' | 'ambience' | 'effects' | 'voice' | 'tells';
export const BUSES: readonly Bus[] = ['master', 'music', 'ambience', 'effects', 'voice', 'tells'];
export const MUSIC_VOICES = 8;

export interface InstrumentDef {
  readonly sample: InstrumentName;
  /** Seconds. */
  readonly attack: number;
  readonly release: number;
  /** Plucked and struck: rings this long past its written length before releasing. */
  readonly ring: number;
  /** Plays its whole sample whatever the written length (drums, calls). */
  readonly oneShot?: boolean;
  readonly gain: number;
}

export const INSTRUMENTS: Readonly<Record<string, InstrumentDef>> = {
  lyre: { sample: 'lyre', attack: 0.002, release: 0.18, ring: 0.3, gain: 0.55 },
  harp: { sample: 'harp', attack: 0.002, release: 0.3, ring: 0.5, gain: 0.45 },
  flute: { sample: 'flute', attack: 0.05, release: 0.12, ring: 0, gain: 0.42 },
  whistle: { sample: 'whistle', attack: 0.025, release: 0.08, ring: 0, gain: 0.36 },
  drone: { sample: 'drone', attack: 0.6, release: 1.2, ring: 0, gain: 0.3 },
  pad: { sample: 'pad', attack: 0.9, release: 1.4, ring: 0, gain: 0.26 },
  bells: { sample: 'bells', attack: 0.002, release: 0.8, ring: 2.2, gain: 0.3 },
  horn: { sample: 'horn', attack: 0.12, release: 0.4, ring: 0, gain: 0.34 },
  drum: { sample: 'drum', attack: 0.001, release: 0.12, ring: 0.25, gain: 0.7 },
  knock: { sample: 'knock', attack: 0.001, release: 0.05, ring: 0, oneShot: true, gain: 0.3 },
  gull: { sample: 'gull', attack: 0.01, release: 0.05, ring: 0, oneShot: true, gain: 0.18 },
};

/** Frequency of a MIDI note. */
export function hzOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

interface Voice {
  readonly end: number;
  readonly gain: GainNode;
  readonly source: AudioBufferSourceNode;
}

/**
 * The samples are generated once per page, each when first needed or ahead of time in the
 * background (warmSamples), and shared by every engine.
 */
const SAMPLES = new Map<InstrumentName, Sample>();
function sample(name: InstrumentName): Sample {
  let s = SAMPLES.get(name);
  if (s === undefined) {
    s = makeSample(name);
    SAMPLES.set(name, s);
  }
  return s;
}

/**
 * Makes the instruments' samples in the background (a worker), so turning sound on in play never
 * stalls the game: the drone and pad take about a tenth of a second each (decision AU-11).
 * Resolves when every sample is ready. Without workers, they are made between frames.
 */
let warming: Promise<void> | null = null;
export function warmSamples(names: readonly InstrumentName[]): Promise<void> {
  warming ??= new Promise<void>((resolve) => {
    const left = new Set(names.filter((n) => !SAMPLES.has(n)));
    const oneByOne = (): void => {
      const name = left.values().next().value;
      if (name === undefined) {
        resolve();
        return;
      }
      left.delete(name);
      sample(name);
      setTimeout(oneByOne, 30);
    };
    if (left.size === 0) {
      resolve();
      return;
    }
    if (typeof Worker === 'undefined') {
      setTimeout(oneByOne, 30);
      return;
    }
    try {
      const worker = new Worker(new URL('./sampleWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ name: InstrumentName; sample: Sample }>) => {
        if (!SAMPLES.has(e.data.name)) SAMPLES.set(e.data.name, e.data.sample);
        left.delete(e.data.name);
        if (left.size === 0) {
          worker.terminate();
          resolve();
        }
      };
      worker.onerror = () => {
        worker.terminate();
        setTimeout(oneByOne, 30);
      };
      worker.postMessage([...left]);
    } catch {
      setTimeout(oneByOne, 30);
    }
  });
  return warming;
}

/** Every instrument sample the synthesiser plays. */
export function allInstrumentSamples(): InstrumentName[] {
  return [...new Set(Object.values(INSTRUMENTS).map((i) => i.sample))];
}

export class SynthEngine {
  readonly ctx: BaseAudioContext;
  readonly buses: Record<Bus, GainNode>;
  /** Send into the shared echo. */
  readonly echoIn: GainNode;
  /** Ducks the music under stingers and voice blips (Book 11 section 09), apart from its slider. */
  readonly duck: GainNode;
  readonly #echoDelay: DelayNode;
  readonly #echoFeedback: GainNode;
  readonly #echoTone: BiquadFilterNode;
  readonly #echoOut: GainNode;
  readonly #buffers = new Map<string, AudioBuffer>();
  #voices: Voice[] = [];
  readonly #noise: AudioBuffer;
  readonly #pink: AudioBuffer;

  constructor(ctx: BaseAudioContext, destination: AudioNode = ctx.destination) {
    this.ctx = ctx;
    const gain = (): GainNode => ctx.createGain();
    this.buses = {
      master: gain(),
      music: gain(),
      ambience: gain(),
      effects: gain(),
      voice: gain(),
      tells: gain(),
    };
    this.buses.master.connect(destination);
    // The SNES's soft top end, on the music only.
    const musicTone = ctx.createBiquadFilter();
    musicTone.type = 'lowpass';
    musicTone.frequency.value = 7000;
    musicTone.Q.value = 0.5;
    this.duck = gain();
    this.buses.music.connect(this.duck).connect(musicTone).connect(this.buses.master);
    for (const bus of ['ambience', 'effects', 'voice', 'tells'] as const)
      this.buses[bus].connect(this.buses.master);
    // The shared echo.
    this.echoIn = gain();
    this.#echoDelay = ctx.createDelay(2);
    this.#echoFeedback = gain();
    this.#echoTone = ctx.createBiquadFilter();
    this.#echoTone.type = 'lowpass';
    this.#echoOut = gain();
    this.echoIn.connect(this.#echoDelay);
    this.#echoDelay.connect(this.#echoTone);
    this.#echoTone.connect(this.#echoFeedback).connect(this.#echoDelay);
    this.#echoTone.connect(this.#echoOut).connect(this.buses.master);
    this.setEcho({ delay: 0.3, feedback: 0.35, mix: 0.3, tone: 3200 });
    this.#noise = this.#noiseBuffer(2, 1, false);
    this.#pink = this.#noiseBuffer(4, 2, true);
  }

  setEcho(echo: Echo, at = this.ctx.currentTime): void {
    this.#echoDelay.delayTime.setValueAtTime(echo.delay, at);
    this.#echoFeedback.gain.setValueAtTime(Math.min(0.75, echo.feedback), at);
    this.#echoTone.frequency.setValueAtTime(echo.tone, at);
    this.#echoOut.gain.setValueAtTime(echo.mix, at);
  }

  setVolume(bus: Bus, level: number): void {
    this.buses[bus].gain.setTargetAtTime(Math.max(0, level), this.ctx.currentTime, 0.03);
  }

  /** Mono: the master sums to one channel (the destination plays it on both speakers). */
  setMono(mono: boolean): void {
    const m = this.buses.master;
    m.channelCount = mono ? 1 : 2;
    m.channelCountMode = 'explicit';
    m.channelInterpretation = 'speakers';
  }

  /** A stereo-free noise buffer; `pink` softens it towards wind and surf. Loops seamlessly. */
  #noiseBuffer(seconds: number, seed: number, pink: boolean): AudioBuffer {
    const n = Math.round(seconds * SAMPLE_RATE);
    const buffer = this.ctx.createBuffer(1, n, SAMPLE_RATE);
    const d = buffer.getChannelData(0);
    const r = rng(seed);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      if (pink) {
        b0 = 0.997 * b0 + w * 0.029591;
        b1 = 0.985 * b1 + w * 0.032534;
        b2 = 0.95 * b2 + w * 0.048056;
        d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2;
      } else d[i] = w * 0.8;
    }
    // Crossfade the ends so the loop has no seam.
    const fade = 2000;
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      d[i] = (d[i] ?? 0) * t + (d[n - fade + i] ?? 0) * (1 - t);
    }
    return buffer;
  }

  /** A looping noise source (white or pink), started at `at`. */
  noise(at: number, pink = false): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = pink ? this.#pink : this.#noise;
    src.loop = true;
    src.loopEnd = (pink ? this.#pink : this.#noise).duration - 2000 / SAMPLE_RATE;
    // Start each use at a different place in the loop, so layers never phase together.
    src.start(at, ((at * 7.13) % 1) * 1.5);
    return src;
  }

  buffer(name: InstrumentName): AudioBuffer {
    let b = this.#buffers.get(name);
    if (b === undefined) {
      const s = sample(name);
      b = this.ctx.createBuffer(1, s.data.length, SAMPLE_RATE);
      b.getChannelData(0).set(s.data);
      this.#buffers.set(name, b);
    }
    return b;
  }

  /** A raw sample source at a pitch (for effects and tells that use an instrument's sample). */
  sampleSource(name: InstrumentName, hz: number): AudioBufferSourceNode {
    const s = sample(name);
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer(name);
    src.playbackRate.value = hz / s.baseHz;
    return src;
  }

  /**
   * Plays one music note through the 8-voice pool: `seconds` is the written length. Returns the
   * time the voice falls silent.
   */
  playNote(
    instrument: string,
    midi: number,
    at: number,
    seconds: number,
    velocity: number,
    out: AudioNode,
    echoSend = 0,
  ): number {
    const def = INSTRUMENTS[instrument];
    if (def === undefined) throw new Error(`unknown instrument "${instrument}"`);
    const s = sample(def.sample);
    const rate = hzOf(midi) / s.baseHz;
    const sampleLen = s.data.length / SAMPLE_RATE / rate;
    const held =
      def.oneShot === true
        ? sampleLen
        : s.loop === null
          ? Math.min(sampleLen, seconds + def.ring)
          : seconds + def.ring;
    const end = at + held + def.release;
    // Voice stealing: at most 8 music voices sound at once.
    this.#voices = this.#voices.filter((v) => v.end > at);
    if (this.#voices.length >= MUSIC_VOICES) {
      this.#voices.sort((a, b) => a.end - b.end);
      const victim = this.#voices.shift();
      if (victim !== undefined) {
        victim.gain.gain.cancelScheduledValues(at);
        victim.gain.gain.setTargetAtTime(0, at, 0.008);
        victim.source.stop(at + 0.06);
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer(def.sample);
    src.playbackRate.value = rate;
    if (s.loop !== null) {
      src.loop = true;
      src.loopStart = s.loop.start;
      src.loopEnd = s.loop.end;
    }
    const g = this.ctx.createGain();
    const peak = def.gain * velocity;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + def.attack);
    g.gain.setValueAtTime(peak, at + Math.max(def.attack, held));
    g.gain.linearRampToValueAtTime(0, end);
    src.connect(g);
    g.connect(out);
    if (echoSend > 0) {
      const send = this.ctx.createGain();
      send.gain.value = echoSend;
      g.connect(send).connect(this.echoIn);
    }
    src.start(at);
    src.stop(end + 0.02);
    this.#voices.push({ end, gain: g, source: src });
    return end;
  }

  /** How many music voices are sounding at time `at` (for tests and the sound page). */
  voicesAt(at: number): number {
    return this.#voices.filter((v) => v.end > at).length;
  }
}

/** A gain envelope through points [time offset, level], starting at `at`. */
export function envelope(
  param: AudioParam,
  at: number,
  points: readonly (readonly [number, number])[],
): void {
  param.cancelScheduledValues(at);
  param.setValueAtTime(points[0]?.[1] ?? 0, at);
  for (const [t, v] of points.slice(1)) param.linearRampToValueAtTime(v, at + t);
}

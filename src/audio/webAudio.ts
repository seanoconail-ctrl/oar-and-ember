/**
 * The Web Audio engine (Book 11 section 10): one AudioContext, unlocked on the first input; buses
 * for master, music, ambience, effects, voice and supernatural tells, each with its own volume
 * (Book 11 section 09 sliders); at most 48 one-shot voices.
 *
 * TEMPORARY SOUND: until the music and effects are produced (Book 11 section 11), every cue is a
 * synthesized test tone made here. Each is flagged `temporary: true` in content/audio.json and
 * listed in the stage report. Nothing below is final audio.
 */
import type { CueDef } from '../content/registry.ts';
import { cyrb53 } from '../core/hash.ts';
import type { MusicAction } from './music.ts';
import type { AudioSink, Bus } from './router.ts';

export const MAX_VOICES = 48;

/** A pitch for a cue, from its ID, so each temporary cue sounds different but stays the same. */
function rootHz(id: string): number {
  const semitone = cyrb53(id) % 12;
  return 110 * 2 ** (semitone / 12);
}

interface MusicVoice {
  readonly cue: string;
  readonly stems: GainNode[];
  readonly nodes: AudioScheduledSourceNode[];
}

export class WebAudioEngine implements AudioSink {
  #ctx: AudioContext | null = null;
  readonly #buses = new Map<Bus, GainNode>();
  readonly #volumes = new Map<Bus, number>([
    ['master', 0.8],
    ['music', 0.6],
    ['ambience', 0.5],
    ['effects', 0.8],
    ['voice', 0.9],
    ['tells', 0.9],
  ]);
  #musicDuck: GainNode | null = null;
  readonly #music = new Map<string, MusicVoice>();
  #ambience: AudioScheduledSourceNode[] = [];
  #voices: AudioScheduledSourceNode[] = [];
  #noise: AudioBuffer | null = null;

  /** True once the browser has let sound start. */
  get unlocked(): boolean {
    return this.#ctx?.state === 'running';
  }

  /** The audio clock in seconds (0 before unlocking). */
  get now(): number {
    return this.#ctx?.currentTime ?? 0;
  }

  /** Call from a user gesture (click or key): browsers start audio only then. */
  unlock(): void {
    if (this.#ctx === null) {
      const ctx = new AudioContext();
      this.#ctx = ctx;
      const master = ctx.createGain();
      master.connect(ctx.destination);
      this.#buses.set('master', master);
      for (const bus of ['music', 'ambience', 'effects', 'voice', 'tells'] as const) {
        const gain = ctx.createGain();
        gain.connect(master);
        this.#buses.set(bus, gain);
      }
      this.#musicDuck = ctx.createGain();
      const music = this.#buses.get('music');
      if (music !== undefined) this.#musicDuck.connect(music);
      for (const [bus, level] of this.#volumes) this.setVolume(bus, level);
      const length = ctx.sampleRate;
      this.#noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.#noise.getChannelData(0);
      let seed = 1;
      for (let i = 0; i < length; i++) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 2147483647) * 2 - 1;
      }
    }
    void this.#ctx.resume();
  }

  setVolume(bus: Bus, level: number): void {
    this.#volumes.set(bus, level);
    const node = this.#buses.get(bus);
    if (node !== undefined && this.#ctx !== null)
      node.gain.setValueAtTime(level, this.#ctx.currentTime);
  }

  #osc(
    type: OscillatorType,
    hz: number,
    at: number,
    until: number,
    out: AudioNode,
    level: number,
  ): OscillatorNode | null {
    const ctx = this.#ctx;
    if (ctx === null) return null;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, at);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 0.02);
    env.gain.setValueAtTime(level, Math.max(at + 0.02, until - 0.05));
    env.gain.linearRampToValueAtTime(0, until);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(until + 0.01);
    return osc;
  }

  #noiseBurst(
    at: number,
    length: number,
    out: AudioNode,
    level: number,
    hz: number,
  ): AudioBufferSourceNode | null {
    const ctx = this.#ctx;
    if (ctx === null || this.#noise === null) return null;
    const src = ctx.createBufferSource();
    src.buffer = this.#noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = hz;
    const env = ctx.createGain();
    env.gain.setValueAtTime(level, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    src.connect(filter).connect(env).connect(out);
    src.start(at);
    src.stop(at + length + 0.02);
    return src;
  }

  music(action: MusicAction): void {
    const ctx = this.#ctx;
    if (ctx === null || this.#musicDuck === null) return;
    switch (action.type) {
      case 'start': {
        // A temporary drone and pulse, sustained for a long time; stopped on the next state change.
        const root = rootHz(action.cue);
        const stems = [0, 1, 2, 3, 4].map(() => {
          const g = ctx.createGain();
          g.gain.value = 0;
          if (this.#musicDuck !== null) g.connect(this.#musicDuck);
          return g;
        });
        const until = action.at + 600;
        const nodes: AudioScheduledSourceNode[] = [];
        const [bed, rhythm, melody, voice, danger] = stems;
        if (bed !== undefined) {
          for (const hz of [root, root * 1.5]) {
            const n = this.#osc('triangle', hz, action.at, until, bed, 0.12);
            if (n !== null) nodes.push(n);
          }
        }
        if (rhythm !== undefined) {
          const lfo = this.#osc('square', root / 4, action.at, until, rhythm, 0.05);
          if (lfo !== null) nodes.push(lfo);
        }
        if (melody !== undefined) {
          const n = this.#osc('sine', root * 2, action.at, until, melody, 0.06);
          if (n !== null) nodes.push(n);
        }
        if (voice !== undefined) {
          const n = this.#osc('sine', root * 3, action.at, until, voice, 0.03);
          if (n !== null) nodes.push(n);
        }
        if (danger !== undefined) {
          const n = this.#osc('sawtooth', root / 2, action.at, until, danger, 0.04);
          if (n !== null) nodes.push(n);
        }
        this.#music.set(action.cue, { cue: action.cue, stems, nodes });
        return;
      }
      case 'stop': {
        const voice = this.#music.get(action.cue);
        if (voice === undefined) return;
        for (const g of voice.stems) g.gain.linearRampToValueAtTime(0, action.at + 0.05);
        for (const n of voice.nodes) n.stop(action.at + 0.1);
        this.#music.delete(action.cue);
        return;
      }
      case 'gains': {
        const voice = this.#music.get(action.cue);
        if (voice === undefined) return;
        voice.stems.forEach((g, i) => {
          g.gain.setTargetAtTime(action.gains[i] ?? 0, Math.max(action.at, ctx.currentTime), 0.1);
        });
        return;
      }
      case 'duck': {
        const g = this.#musicDuck.gain;
        g.setTargetAtTime(action.level, action.from, 0.03);
        g.setTargetAtTime(1, action.until, 0.2);
        return;
      }
    }
  }

  oneShot(cue: CueDef, at: number, pan: number): void {
    const ctx = this.#ctx;
    if (ctx === null) return;
    const busName: Bus = cue.kind === 'stinger' ? 'music' : (cue.bus ?? 'effects');
    const bus = this.#buses.get(busName);
    if (bus === undefined) return;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(bus);
    const root = rootHz(cue.id);
    const start = Math.max(at, ctx.currentTime);
    const made: (AudioScheduledSourceNode | null)[] = [];
    if (cue.id === 'SFX_HORN' || cue.id === 'MUS_STINGER_HORN') {
      made.push(this.#osc('sawtooth', 98, start, start + 1.2, panner, 0.18));
    } else if (cue.kind === 'stinger') {
      made.push(this.#osc('sine', root * 2, start, start + 0.6, panner, 0.15));
      made.push(this.#osc('sine', root * 3, start + 0.15, start + 0.8, panner, 0.1));
    } else if (cue.id === 'SFX_PARRY') {
      made.push(this.#noiseBurst(start, 0.12, panner, 0.6, 3200));
    } else if (cue.id === 'SFX_TELL_RAN') {
      made.push(this.#osc('sine', 55, start, start + 1.5, panner, 0.2));
    } else {
      made.push(this.#osc('square', root * 2, start, start + 0.3, panner, 0.1));
    }
    for (const node of made) {
      if (node === null) continue;
      this.#voices.push(node);
      node.addEventListener('ended', () => {
        this.#voices = this.#voices.filter((v) => v !== node);
      });
    }
    while (this.#voices.length > MAX_VOICES) this.#voices.shift()?.stop();
  }

  ambience(cues: readonly CueDef[], at: number): void {
    const ctx = this.#ctx;
    const bus = this.#buses.get('ambience');
    if (ctx === null || bus === undefined || this.#noise === null) return;
    for (const n of this.#ambience) n.stop(Math.max(at, ctx.currentTime) + 0.5);
    this.#ambience = [];
    for (const cue of cues) {
      const src = ctx.createBufferSource();
      src.buffer = this.#noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = cue.id === 'AMB_HEARTH' ? 'highpass' : 'lowpass';
      filter.frequency.value =
        cue.id === 'AMB_HEARTH' ? 2500 : cue.id === 'AMB_SURF_SHINGLE' ? 600 : 900;
      const gain = ctx.createGain();
      gain.gain.value = 0.04;
      src.connect(filter).connect(gain).connect(bus);
      src.start(Math.max(at, ctx.currentTime));
      this.#ambience.push(src);
    }
  }
}

/** A sink that records what it is asked to play, for tests. */
export class RecordingSink implements AudioSink {
  readonly music: (action: MusicAction) => void;
  readonly calls: { kind: string; detail: unknown }[] = [];
  constructor() {
    this.music = (action) => this.calls.push({ kind: 'music', detail: action });
  }
  oneShot(cue: CueDef, at: number, pan: number): void {
    this.calls.push({ kind: 'oneShot', detail: { cue: cue.id, at, pan } });
  }
  ambience(cues: readonly CueDef[], at: number): void {
    this.calls.push({ kind: 'ambience', detail: { cues: cues.map((c) => c.id), at } });
  }
  setVolume(bus: Bus, level: number): void {
    this.calls.push({ kind: 'volume', detail: { bus, level } });
  }
}

/**
 * Every audio cue in the content table (content/audio.json) and its generated implementation
 * (Book 11 section 12; decision AU-11). The game's engine and the coverage test both read this,
 * so a cue cannot exist in the content without a sound, nor a sound without its caption.
 *
 * - Music cues name a piece of note data (`piece`) and the layers it starts with.
 * - Effects, tells and stingers are generated graphs (sfx.ts and the three below).
 * - Ambience cues name a generated ambience.
 */
import hearthJson from '../../../content/music/hearth.json';
import raidJson from '../../../content/music/raid.json';
import skarvholmJson from '../../../content/music/skarvholm.json';
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import type { Piece } from './notation.ts';
import { rng } from './samples.ts';
import { COMBAT, out, TELLS } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

export const PIECES: Readonly<Record<string, Piece>> = {
  hearth: hearthJson,
  skarvholm: skarvholmJson,
  raid: raidJson,
};

/** The horn and the two stingers, generated from the instruments' samples. */
export const CALLS: readonly SoundDef[] = [
  {
    id: 'SFX_HORN',
    captionKey: 'caption.sfx.horn',
    bus: 'tells',
    play: (e, at, pan) => {
      // A cow-horn call: two long notes a fifth apart, the second held and falling away.
      // A warning stands above the effects (Book 11 section 09): the horn is boosted on its bus.
      const boost = e.ctx.createGain();
      boost.gain.value = 2.2;
      boost.connect(out(e, 'tells', pan, 0.35));
      e.playNote('horn', 45, at, 0.6, 0.9, boost, 0);
      const end = e.playNote('horn', 52, at + 0.55, 1.1, 0.85, boost, 0);
      return end - at;
    },
  },
  {
    id: 'MUS_STINGER_HORN',
    captionKey: 'caption.stinger.horn',
    bus: 'music',
    play: (e, at, pan) => {
      // The alarm stinger: three short horn blasts over a struck drum.
      const to = out(e, 'music', pan, 0.25);
      e.playNote('drum', 38, at, 0.2, 0.9, to);
      e.playNote('horn', 52, at, 0.3, 0.8, to);
      e.playNote('horn', 52, at + 0.42, 0.3, 0.8, to);
      const end = e.playNote('horn', 57, at + 0.84, 0.9, 0.9, to);
      return end - at;
    },
  },
  {
    id: 'MUS_STINGER_DISCOVERY',
    captionKey: 'caption.stinger.discovery',
    bus: 'music',
    play: (e, at, pan) => {
      // Something found: a rising harp figure in D Dorian and a bell on the last note.
      const to = out(e, 'music', pan, 0.4);
      const notes = [62, 65, 69, 72];
      notes.forEach((m, i) => e.playNote('harp', m, at + i * 0.14, 0.4, 0.7, to));
      const end = e.playNote('bells', 74, at + notes.length * 0.14, 1.2, 0.5, to);
      return end - at;
    },
  },
];

/** Every generated one-shot by its cue ID. */
export const SOUNDS: ReadonlyMap<string, SoundDef> = new Map(
  [...COMBAT, ...TELLS, ...CALLS].map((d) => [d.id, d]),
);

/**
 * The hearth's ambience: a low, breathing bed of flame and the occasional crackle and pop of
 * peat and driftwood, scheduled ahead of the audio clock like the strand's.
 */
export class HearthAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(311);
  readonly #out: GainNode;
  readonly #sources: AudioScheduledSourceNode[] = [];
  #next = 0;
  #running = false;

  constructor(engine: SynthEngine) {
    this.#e = engine;
    this.#out = engine.ctx.createGain();
    this.#out.gain.value = 0.5;
    this.#out.connect(engine.buses.ambience);
  }

  start(at: number): void {
    this.#running = true;
    this.#next = at;
    const bed = this.#e.noise(at, true);
    const f = this.#e.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = this.#e.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.35, at + 1.5);
    bed.connect(f).connect(g).connect(this.#out);
    this.#sources.push(bed);
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.4);
    for (const s of this.#sources) s.stop(at + 2);
  }

  schedule(until: number): void {
    if (!this.#running) return;
    while (this.#next < until) {
      const t = this.#next;
      const src = this.#e.noise(t);
      const f = this.#e.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900 + this.#r() * 1800;
      f.Q.value = 1.2;
      const g = this.#e.ctx.createGain();
      const level = 0.15 + this.#r() * 0.35;
      envelope(g.gain, t, [
        [0, 0],
        [0.003, level],
        [0.02 + this.#r() * 0.03, 0],
      ]);
      src.connect(f).connect(g).connect(this.#out);
      src.stop(t + 0.08);
      this.#next += 0.08 + this.#r() ** 2 * 0.9;
    }
  }
}

/** Ambience implementations: the strand bed (wind, sea, gulls) or the hearth. */
export const AMBIENCES: Readonly<Record<string, 'strand' | 'heath' | 'hearth'>> = {
  AMB_SURF_SHINGLE: 'strand',
  // Inland heather: the same wind, with the sea far off (the strand bed at low water).
  AMB_WIND_HEATHER: 'heath',
  AMB_HEARTH: 'hearth',
};

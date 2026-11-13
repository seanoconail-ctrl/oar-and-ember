/**
 * The storm's sounds (design addendum 2.5 section 3; Book 11 section 07, "The storm of the cold
 * open"; decisions DF-16, DF-17 and DF-21), generated like every other sound (Book 11 section 12):
 *
 * - **Thunder** after every flash, never on it: a near strike a sharp crack splitting into a long
 *   roll, a far one only a low rumble (2.5 to 4 s).
 * - **A wave breaking** against the hull: a deep boom and a hiss of spray falling back across the
 *   deck, panned to the side it strikes. **Green water** over the side: a heavy rush and the
 *   draining wash through the scuppers.
 * - **The storm bed** (`AMB_COLD_STORM`): rain hissing on the sea and drumming on the deck and the
 *   sail, the torn sail flogging, and timber groaning and the mast creaking in time with the pitch
 *   and the roll, so the sound rocks with the picture. The wind itself is the strand's wind bed at
 *   full storm (ambience.ts), as before.
 * - **Rain on the sail cloth** (`AMB_RAIN_CLOTH`): a soft patter with drips from the edge, heard
 *   only under the sail.
 *
 * Everything is scheduled ahead of the audio clock with a seeded stream.
 */
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** A long roll of thunder: a crack (near only), then low noise rumbling in waves. */
function thunder(e: SynthEngine, at: number, pan: number, near: boolean): number {
  const to = out(e, 'effects', pan, 0.35);
  const r = rng(near ? 4441 : 4447);
  const length = near ? 4 : 2.8;
  if (near) {
    noiseHit(e, at, to, 'highpass', 1800, 0.7, [
      [0, 0],
      [0.006, 0.55],
      [0.08, 0.22],
      [0.35, 0],
    ]);
    noiseHit(e, at + 0.02, to, 'bandpass', 700, 0.8, [
      [0, 0],
      [0.02, 0.5],
      [0.4, 0.12],
      [0.9, 0],
    ]);
  }
  // The roll: swells of low noise, each a little later and lower.
  const swells = near ? 6 : 4;
  for (let k = 0; k < swells; k++) {
    const t = at + (near ? 0.15 : 0) + k * (length / swells) * (0.8 + r() * 0.4);
    const peak = (near ? 0.62 : 1.1) * (1 - k / (swells + 1));
    noiseHit(
      e,
      t,
      to,
      'lowpass',
      near ? 260 : 230,
      0.9,
      [
        [0, 0],
        [0.25 + r() * 0.2, peak],
        [0.9 + r() * 0.5, peak * 0.4],
        [1.6 + r() * 0.6, 0],
      ],
      near ? 120 : 80,
    );
  }
  return length + 0.6;
}

export const STORM_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_THUNDER_NEAR',
    captionKey: 'caption.cold.thunder',
    bus: 'effects',
    play: (e, at, pan) => thunder(e, at, pan, true),
  },
  {
    id: 'SFX_THUNDER_FAR',
    captionKey: 'caption.cold.thunder',
    bus: 'effects',
    play: (e, at, pan) => thunder(e, at, pan, false),
  },
  {
    id: 'SFX_WAVE_HULL',
    captionKey: 'caption.cold.wave',
    bus: 'effects',
    play: (e, at, pan) => {
      // The boom of the sea against the strakes, then the spray's hiss falling across the deck.
      const to = out(e, 'effects', pan, 0.2);
      tone(
        e,
        at,
        to,
        'sine',
        [
          [0, 70],
          [0.3, 44],
        ],
        [
          [0, 0],
          [0.02, 0.5],
          [0.5, 0],
        ],
      );
      noiseHit(e, at, to, 'lowpass', 520, 0.7, [
        [0, 0],
        [0.04, 0.45],
        [0.5, 0.15],
        [0.9, 0],
      ]);
      noiseHit(
        e,
        at + 0.18,
        to,
        'highpass',
        2600,
        0.6,
        [
          [0, 0],
          [0.1, 0.2],
          [0.6, 0.08],
          [1.2, 0],
        ],
        4200,
      );
      return 1.5;
    },
  },
  {
    id: 'SFX_GREEN_WATER',
    captionKey: 'caption.cold.green_water',
    bus: 'effects',
    play: (e, at, pan) => {
      // A heavy rush over the gunwale, and the wash draining off through the scuppers.
      const to = out(e, 'effects', pan, 0.15);
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        420,
        0.6,
        [
          [0, 0],
          [0.15, 0.9],
          [0.7, 0.55],
          [1.3, 0],
        ],
        900,
      );
      noiseHit(e, at + 0.6, to, 'bandpass', 1600, 1.2, [
        [0, 0],
        [0.3, 0.24],
        [1.6, 0],
      ]);
      return 2.3;
    },
  },
];

/** The storm's bed under the cold open (`AMB_COLD_STORM`). */
export class StormAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(311);
  readonly #out: GainNode;
  readonly #sources: AudioScheduledSourceNode[] = [];
  readonly #pitch: number;
  readonly #roll: number;
  #nextGroan = 0;
  #nextCreak = 0;
  #nextFlog = 0;
  #nextDrum = 0;
  #running = false;

  /** `pitch` and `roll`: the ship's periods (Book 10 section 25), so the timber rocks with it. */
  constructor(engine: SynthEngine, pitch: number, roll: number) {
    this.#e = engine;
    this.#pitch = pitch;
    this.#roll = roll;
    this.#out = engine.ctx.createGain();
    this.#out.connect(engine.buses.ambience);
  }

  start(at: number): void {
    const e = this.#e;
    const c = e.ctx;
    // Rain hissing on the sea: a steady high band.
    const hiss = e.noise(at, false);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3800;
    const hg = c.createGain();
    hg.gain.value = 0.11;
    hiss.connect(hp).connect(hg).connect(this.#out);
    // Rain on the deck and the sail: a lower, rougher band.
    const deck = e.noise(at + 0.3, true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 0.8;
    const dg = c.createGain();
    dg.gain.value = 0.07;
    deck.connect(bp).connect(dg).connect(this.#out);
    this.#sources.push(hiss, deck);
    this.#out.gain.setValueAtTime(0, at);
    this.#out.gain.linearRampToValueAtTime(0.8, at + 1);
    this.#nextGroan = at + 0.4;
    this.#nextCreak = at + this.#roll / 2;
    this.#nextFlog = at + 0.2;
    this.#nextDrum = at;
    this.#running = true;
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.3);
    for (const s of this.#sources) s.stop(at + 1.5);
  }

  setLevel(level: number, at: number): void {
    this.#out.gain.setTargetAtTime(0.8 * level, at, 0.3);
  }

  schedule(until: number): void {
    if (!this.#running) return;
    const e = this.#e;
    const to = this.#out;
    // Timber groaning with each pitch, low and dragging.
    while (this.#nextGroan < until) {
      const at = this.#nextGroan;
      const hz = 150 + this.#r() * 60;
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        hz,
        7,
        [
          [0, 0],
          [0.2, 0.22],
          [0.9, 0.16],
          [1.2, 0],
        ],
        hz * 0.7,
      );
      tone(
        e,
        at,
        to,
        'sawtooth',
        [
          [0, hz / 3],
          [1.1, hz / 4],
        ],
        [
          [0, 0],
          [0.2, 0.04],
          [1.1, 0],
        ],
      );
      this.#nextGroan += this.#pitch / 2;
    }
    // The mast creaking at each end of the roll.
    while (this.#nextCreak < until) {
      const at = this.#nextCreak;
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        620 + this.#r() * 200,
        9,
        [
          [0, 0],
          [0.06, 0.14],
          [0.5, 0],
        ],
        420,
      );
      this.#nextCreak += this.#roll / 2;
    }
    // The torn sail flogging: quick slaps in bursts.
    while (this.#nextFlog < until) {
      const at = this.#nextFlog;
      const n = 3 + Math.floor(this.#r() * 4);
      for (let k = 0; k < n; k++)
        noiseHit(e, at + k * 0.11, to, 'bandpass', 900, 1.4, [
          [0, 0],
          [0.008, 0.16],
          [0.07, 0],
        ]);
      this.#nextFlog += 1.1 + this.#r() * 1.4;
    }
    // Heavier drops drumming on the planks.
    while (this.#nextDrum < until) {
      const at = this.#nextDrum;
      noiseHit(e, at, to, 'bandpass', 2000 + this.#r() * 1500, 4, [
        [0, 0],
        [0.003, 0.05 + this.#r() * 0.04],
        [0.03, 0],
      ]);
      this.#nextDrum += 0.025 + this.#r() * 0.05;
    }
  }
}

/** Rain on the sail cloth, under the sail (`AMB_RAIN_CLOTH`): a soft patter and drips. */
export class RainClothAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(523);
  readonly #out: GainNode;
  #level: number;
  #nextPat = 0;
  #nextDrip = 0;
  #running = false;

  constructor(engine: SynthEngine, level: number) {
    this.#e = engine;
    this.#level = level;
    this.#out = engine.ctx.createGain();
    this.#out.connect(engine.buses.ambience);
  }

  start(at: number): void {
    this.#out.gain.setValueAtTime(0, at);
    this.#out.gain.linearRampToValueAtTime(this.#level, at + 1);
    this.#nextPat = at;
    this.#nextDrip = at + 0.6;
    this.#running = true;
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.4);
  }

  setLevel(level: number, at: number): void {
    this.#level = level;
    this.#out.gain.setTargetAtTime(level, at, 0.4);
  }

  schedule(until: number): void {
    if (!this.#running) return;
    const e = this.#e;
    while (this.#nextPat < until) {
      const at = this.#nextPat;
      // A drop on taut cloth: a soft, dull tap.
      noiseHit(e, at, this.#out, 'bandpass', 700 + this.#r() * 500, 2.5, [
        [0, 0],
        [0.004, 0.09 + this.#r() * 0.07],
        [0.05, 0],
      ]);
      this.#nextPat += 0.03 + this.#r() * 0.07;
    }
    while (this.#nextDrip < until) {
      const at = this.#nextDrip;
      // A drip from the cloth's edge into a puddle: a little falling pluck.
      const g = e.ctx.createGain();
      g.connect(this.#out);
      tone(
        e,
        at,
        g,
        'sine',
        [
          [0, 1400 + this.#r() * 500],
          [0.05, 700],
        ],
        [
          [0, 0],
          [0.004, 0.12],
          [0.09, 0],
        ],
      );
      this.#nextDrip += 0.5 + this.#r() * 1.2;
    }
  }
}

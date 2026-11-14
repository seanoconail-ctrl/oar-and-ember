/**
 * Stage 11's sounds (Book 11 sections 04, 07 and 12), generated in code like every sound in the
 * game: the work at the boat and each repair's own sound, the fitting, the steering oar, Thorkel's
 * rites and his lament, and Seal Cave's ambience. Every one has its caption (content/audio.json);
 * everything is scheduled ahead of the audio clock with seeded random streams.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** A knock of wood on wood (or iron on wood): a short tuned thud with a click on top. */
function knock(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  hz: number,
  level: number,
  bright = 1800,
): void {
  tone(
    e,
    at,
    to,
    'triangle',
    [
      [0, hz * 1.6],
      [0.03, hz],
    ],
    [
      [0, 0],
      [0.003, level],
      [0.12, 0],
    ],
  );
  noiseHit(e, at, to, 'bandpass', bright, 2.5, [
    [0, 0],
    [0.002, level * 0.6],
    [0.03, 0],
  ]);
}

/** A rope's creak as it takes the strain: a narrow, wavering band of noise. */
function creak(e: SynthEngine, at: number, to: AudioNode, len: number, level: number): void {
  const src = e.noise(at, true);
  const f = e.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 18;
  f.frequency.setValueAtTime(420, at);
  f.frequency.linearRampToValueAtTime(610, at + len * 0.6);
  f.frequency.linearRampToValueAtTime(380, at + len);
  const g = e.ctx.createGain();
  envelope(g.gain, at, [
    [0, 0],
    [0.05, level],
    [len - 0.05, level * 0.8],
    [len, 0],
  ]);
  src.connect(f).connect(g).connect(to);
  src.stop(at + len + 0.05);
}

export const REPAIR_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_WORK_REPAIR',
    captionKey: 'caption.sfx.task_repair',
    bus: 'effects',
    play: (e, at, pan) => {
      // Rivets clenched over roves on a strake: a hammer on iron over oak, struck in threes, then
      // the rasp of a board eased into place.
      const to = out(e, 'effects', pan, 0.15);
      const r = rng(1101);
      for (let k = 0; k < 6; k++) {
        const t = at + k * 0.36 + (k >= 3 ? 0.3 : 0) + r() * 0.03;
        knock(e, t, to, 330 + r() * 60, 0.5, 3200);
        tone(
          e,
          t,
          to,
          'sine',
          [
            [0, 2400 + r() * 300],
            [0.08, 2300],
          ],
          [
            [0, 0],
            [0.002, 0.12],
            [0.09, 0],
          ],
        );
      }
      noiseHit(
        e,
        at + 2.3,
        to,
        'bandpass',
        900,
        1.2,
        [
          [0, 0],
          [0.05, 0.18],
          [0.35, 0],
        ],
        1400,
      );
      return 2.7;
    },
  },
  {
    id: 'SFX_RIGGING_CUT',
    captionKey: 'caption.sfx.rigging_cut',
    bus: 'effects',
    play: (e, at, pan) => {
      // A knife sawing through wet rope, strand by strand, the last one parting with a snap, then
      // the sail and yard slumping onto the rocks.
      const to = out(e, 'effects', pan, 0.15);
      for (let k = 0; k < 7; k++) {
        const t = at + k * 0.22;
        noiseHit(
          e,
          t,
          to,
          'bandpass',
          2200 + (k % 2) * 600,
          3,
          [
            [0, 0],
            [0.04, 0.22],
            [0.18, 0],
          ],
          1500,
        );
      }
      knock(e, at + 1.6, to, 160, 0.5, 900);
      noiseHit(e, at + 1.62, to, 'lowpass', 700, 0.8, [
        [0, 0],
        [0.03, 0.35],
        [0.6, 0],
      ]);
      knock(e, at + 1.95, to, 120, 0.45, 600);
      return 2.6;
    },
  },
  {
    id: 'SFX_LOAD_LAID',
    captionKey: 'caption.sfx.load_laid',
    bus: 'effects',
    play: (e, at, pan) => {
      // A heavy load set down on the shingle by the boat: a thump, stones shifting under it.
      const to = out(e, 'effects', pan, 0.1);
      knock(e, at, to, 95, 0.6, 700);
      const r = rng(1103);
      for (let k = 0; k < 6; k++)
        noiseHit(e, at + 0.05 + r() * 0.3, to, 'bandpass', 2600 + r() * 1800, 4, [
          [0, 0],
          [0.002, 0.12],
          [0.04, 0],
        ]);
      return 0.6;
    },
  },
  {
    id: 'SFX_REPAIR_DONE',
    captionKey: 'caption.sfx.repair_done',
    bus: 'effects',
    play: (e, at, pan) => {
      // A repair finished: two last blows, and the hull's long creak as it takes the work.
      const to = out(e, 'effects', pan, 0.25);
      knock(e, at, to, 300, 0.55, 2600);
      knock(e, at + 0.38, to, 280, 0.6, 2400);
      creak(e, at + 0.7, to, 1.3, 0.22);
      return 2.1;
    },
  },
  {
    id: 'SFX_OAR_TAKEN',
    captionKey: 'caption.sfx.oar_taken',
    bus: 'effects',
    play: (e, at, pan) => {
      // The steering oar worked out of its withy: a twist of the lashing, wood sliding, a knock.
      const to = out(e, 'effects', pan, 0.15);
      creak(e, at, to, 0.45, 0.25);
      noiseHit(
        e,
        at + 0.4,
        to,
        'bandpass',
        1200,
        2,
        [
          [0, 0],
          [0.08, 0.2],
          [0.5, 0],
        ],
        700,
      );
      knock(e, at + 0.95, to, 140, 0.5, 900);
      return 1.3;
    },
  },
  {
    id: 'SFX_FITTING_DONE',
    captionKey: 'caption.sfx.fitting_done',
    bus: 'effects',
    play: (e, at, pan) => {
      // A fitting made: lashings drawn tight in three pulls, and a last knock.
      const to = out(e, 'effects', pan, 0.15);
      for (let k = 0; k < 3; k++) creak(e, at + k * 0.42, to, 0.3, 0.22);
      knock(e, at + 1.35, to, 220, 0.5, 1600);
      return 1.6;
    },
  },
  {
    id: 'SFX_FITTING_UNSHIPPED',
    captionKey: 'caption.sfx.fitting_unshipped',
    bus: 'effects',
    play: (e, at, pan) => {
      // A fitting taken off: lashings slipped, timber lifted out and laid down.
      const to = out(e, 'effects', pan, 0.15);
      creak(e, at, to, 0.35, 0.18);
      knock(e, at + 0.5, to, 170, 0.45, 1100);
      knock(e, at + 0.85, to, 110, 0.5, 700);
      return 1.2;
    },
  },
  {
    id: 'SFX_WORK_ADZE',
    captionKey: 'caption.sfx.work_adze',
    bus: 'effects',
    play: (e, at, pan) => {
      // An adze shaping new wood: short bright chops, chips falling.
      const to = out(e, 'effects', pan, 0.15);
      const r = rng(1107);
      for (let k = 0; k < 5; k++) {
        const t = at + k * 0.31 + r() * 0.04;
        knock(e, t, to, 260 + r() * 40, 0.45, 2800);
        noiseHit(e, t + 0.02, to, 'highpass', 3500, 0.7, [
          [0, 0],
          [0.004, 0.1],
          [0.08, 0],
        ]);
      }
      return 1.8;
    },
  },
  {
    id: 'SFX_STONES_SET',
    captionKey: 'caption.sfx.stones_set',
    bus: 'effects',
    play: (e, at, pan) => {
      // Stones set upright in the turf: a heavy settle, stone on stone, earth pressed in.
      const to = out(e, 'effects', pan, 0.2);
      const r = rng(1109);
      for (let k = 0; k < 3; k++) {
        const t = at + k * 0.7;
        knock(e, t, to, 80 + r() * 20, 0.6, 500);
        tone(
          e,
          t + 0.12,
          to,
          'triangle',
          [
            [0, 900 + r() * 200],
            [0.05, 760],
          ],
          [
            [0, 0],
            [0.002, 0.18],
            [0.07, 0],
          ],
        );
        noiseHit(e, t + 0.25, to, 'lowpass', 500, 0.7, [
          [0, 0],
          [0.05, 0.15],
          [0.3, 0],
        ]);
      }
      return 2.4;
    },
  },
  {
    id: 'SFX_SEA_BURIAL',
    captionKey: 'caption.sfx.sea_burial',
    bus: 'effects',
    play: (e, at, pan) => {
      // The sea takes him: a swell rising and breaking over, a deep slap, the wash running back.
      const to = out(e, 'effects', pan, 0.3);
      noiseHit(
        e,
        at,
        to,
        'lowpass',
        300,
        0.6,
        [
          [0, 0],
          [1.2, 0.45],
          [1.6, 0.6],
          [3.2, 0],
        ],
        1600,
      );
      knock(e, at + 1.55, to, 70, 0.55, 400);
      noiseHit(
        e,
        at + 1.7,
        to,
        'highpass',
        2000,
        0.7,
        [
          [0, 0],
          [0.2, 0.2],
          [1.8, 0],
        ],
        900,
      );
      return 3.6;
    },
  },
  {
    id: 'MUS_STINGER_BUILDING_FINISHED',
    captionKey: 'caption.stinger.boat_ready',
    bus: 'music',
    play: (e, at, pan) => {
      // The boat made whole: the frame drum and a lyre figure climbing to the home note, the
      // whistle answering (the Ship's motif, Book 11 section 04).
      const to = out(e, 'music', pan, 0.35);
      e.playNote('drum', 38, at, 0.3, 0.8, to);
      [62, 64, 65, 69].forEach((m, i) => e.playNote('lyre', m, at + 0.12 + i * 0.22, 0.4, 0.7, to));
      const end = e.playNote('whistle', 74, at + 1.0, 1.2, 0.5, to);
      e.playNote('drone', 38, at, 2.2, 0.3, to);
      return end - at;
    },
  },
  {
    id: 'MUS_LAMENT_THORKEL',
    captionKey: 'caption.music.lament_thorkel',
    bus: 'music',
    play: (e, at, pan) => {
      // Thorkel's lament (Book 11 section 04: keening voice, lyre): D Aeolian, slow, 48 bpm. The
      // pad keens a falling line over a drone; the lyre answers each phrase a beat behind; the last
      // phrase comes to rest on the home note. Written for the game; no borrowed tune.
      // Sung over the household: as loud as the hearth theme (Book 11 section 09: music about
      // -21 to -24 dBFS RMS).
      const to = e.ctx.createGain();
      to.gain.value = 3;
      to.connect(out(e, 'music', pan, 0.45));
      const beat = 60 / 48;
      // Each phrase: [note, beats]; MIDI in D Aeolian (D E F G A Bb C).
      const voice: [number, number][] = [
        [69, 2],
        [67, 1],
        [65, 1],
        [64, 2],
        [62, 2],
        [65, 2],
        [64, 1],
        [62, 1],
        [60, 2],
        [62, 2],
        [69, 1],
        [70, 1],
        [69, 2],
        [67, 2],
        [65, 2],
        [64, 2],
        [65, 1],
        [64, 1],
        [62, 4],
      ];
      let t = at + beat;
      for (const [m, b] of voice) {
        e.playNote('pad', m, t, b * beat * 0.95, 0.55, to);
        if (b >= 2) e.playNote('lyre', m - 12, t + beat * 0.5, beat * 0.9, 0.45, to);
        t += b * beat;
      }
      const length = t - at + beat;
      e.playNote('drone', 38, at, length, 0.3, to);
      e.playNote('drone', 45, at + length * 0.5, length * 0.5, 0.18, to);
      return length + 0.5;
    },
  },
];

/**
 * Seal Cave (`AMB_SEALCAVE`): over the surf of the cove (the strand's bed), water dripping in the
 * cave's dark with a hollow ring, the swell booming in the mouth, and now and then a seal calling
 * from the skerry.
 */
export class CaveAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(1201);
  readonly #out: GainNode;
  #next = 0;
  #boom = 0;
  #seal = 0;
  #running = false;

  constructor(engine: SynthEngine) {
    this.#e = engine;
    this.#out = engine.ctx.createGain();
    this.#out.gain.value = 0.9;
    this.#out.connect(engine.buses.ambience);
    const echo = engine.ctx.createGain();
    echo.gain.value = 0.35;
    this.#out.connect(echo).connect(engine.echoIn);
  }

  start(at: number): void {
    this.#running = true;
    this.#next = at;
    this.#boom = at + 1;
    this.#seal = at + 6;
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.3);
  }

  schedule(until: number): void {
    if (!this.#running) return;
    const e = this.#e;
    while (this.#next < until) {
      const t = this.#next;
      const f = 900 + this.#r() * 1400;
      tone(
        e,
        t,
        this.#out,
        'sine',
        [
          [0, f],
          [0.07, f * 1.5],
        ],
        [
          [0, 0],
          [0.003, 0.09 + this.#r() * 0.07],
          [0.25, 0],
        ],
      );
      this.#next += 0.35 + this.#r() * 1.6;
    }
    while (this.#boom < until) {
      noiseHit(e, this.#boom, this.#out, 'lowpass', 160, 0.7, [
        [0, 0],
        [0.4, 0.4],
        [2.2, 0],
      ]);
      this.#boom += 4 + this.#r() * 5;
    }
    while (this.#seal < until) {
      const t = this.#seal;
      const f = 300 + this.#r() * 80;
      tone(
        e,
        t,
        this.#out,
        'sawtooth',
        [
          [0, f],
          [0.35, f * 1.35],
          [0.8, f * 0.9],
        ],
        [
          [0, 0],
          [0.08, 0.05],
          [0.7, 0.04],
          [0.9, 0],
        ],
      );
      this.#seal += 11 + this.#r() * 14;
    }
  }
}

/**
 * Sound effects and supernatural tells, generated in code (Book 11 section 07). Each is a short
 * graph of oscillators, noise and filters built at the moment it plays. Effects go to the
 * effects bus, tells to the tells bus (their own slider), and every one has a caption key.
 *
 * Combat sounds are designed to be told apart by ear: the parry is bright and short, the block
 * low and woody, the level-2 charge a distinct ring that warns of a guard break.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';

export interface SoundDef {
  readonly id: string;
  readonly captionKey: string;
  readonly bus: 'effects' | 'tells' | 'music';
  /** Plays at `at`, panned -1..1; returns its length in seconds. */
  readonly play: (e: SynthEngine, at: number, pan: number, opts: SoundOptions) => number;
}

export interface SoundOptions {
  /** Book 2 gore setting: 0 off, 1 reduced, 2 full. */
  readonly gore: number;
}

export function out(
  e: SynthEngine,
  bus: 'effects' | 'tells' | 'music',
  pan: number,
  echo = 0,
): AudioNode {
  const p = e.ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(e.buses[bus]);
  if (echo > 0) {
    const s = e.ctx.createGain();
    s.gain.value = echo;
    p.connect(s).connect(e.echoIn);
  }
  return p;
}

/** A burst of filtered noise with an envelope. */
function noiseHit(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  filter: BiquadFilterType,
  hz: number,
  q: number,
  env: readonly (readonly [number, number])[],
  sweepTo?: number,
): void {
  const src = e.noise(at);
  const f = e.ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(hz, at);
  if (sweepTo !== undefined)
    f.frequency.exponentialRampToValueAtTime(sweepTo, at + (env[env.length - 1]?.[0] ?? 0.1));
  f.Q.value = q;
  const g = e.ctx.createGain();
  envelope(g.gain, at, env);
  src.connect(f).connect(g).connect(to);
  src.stop(at + (env[env.length - 1]?.[0] ?? 0.1) + 0.05);
}

/** A sine (or other wave) with pitch and level envelopes. */
function tone(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  type: OscillatorType,
  pitch: readonly (readonly [number, number])[],
  env: readonly (readonly [number, number])[],
): void {
  const o = e.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(pitch[0]?.[1] ?? 440, at);
  for (const [t, f] of pitch.slice(1)) o.frequency.exponentialRampToValueAtTime(f, at + t);
  const g = e.ctx.createGain();
  envelope(g.gain, at, env);
  o.connect(g).connect(to);
  o.start(at);
  o.stop(at + (env[env.length - 1]?.[0] ?? 0.2) + 0.05);
}

/** Metal: inharmonic partials struck together, each with its own decay. */
function metal(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  base: number,
  ratios: readonly number[],
  decay: number,
  level: number,
): void {
  ratios.forEach((r, i) => {
    tone(
      e,
      at,
      to,
      'sine',
      [[0, base * r]],
      [
        [0, 0],
        [0.002, level / (1 + i * 0.6)],
        [decay / (1 + i * 0.35), 0.0001],
      ],
    );
  });
}

/** A breath: noise through a vowel-ish band, swelling and falling. */
function breath(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  seconds: number,
  level: number,
  hz = 1100,
): void {
  noiseHit(e, at, to, 'bandpass', hz, 1.2, [
    [0, 0],
    [seconds * 0.35, level],
    [seconds, 0],
  ]);
}

/** A short voiced grunt (a formant buzz with a falling pitch). */
function grunt(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  hz: number,
  seconds: number,
  level: number,
): void {
  const o = e.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(hz, at);
  o.frequency.exponentialRampToValueAtTime(hz * 0.7, at + seconds);
  const g = e.ctx.createGain();
  envelope(g.gain, at, [
    [0, 0],
    [0.02, level],
    [seconds, 0],
  ]);
  for (const [f, q] of [
    [550, 4],
    [1300, 6],
  ] as const) {
    const b = e.ctx.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = f;
    b.Q.value = q;
    o.connect(b).connect(g);
  }
  g.connect(to);
  o.start(at);
  o.stop(at + seconds + 0.05);
}

export const COMBAT: readonly SoundDef[] = [
  {
    id: 'SFX_HIT_LIGHT',
    captionKey: 'caption.sfx.hit_light',
    bus: 'effects',
    play: (e, at, pan, o) => {
      const to = out(e, 'effects', pan);
      // The swing: a fast rising whoosh.
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        700,
        1.4,
        [
          [0, 0],
          [0.07, 0.35],
          [0.14, 0],
        ],
        2600,
      );
      // The hit on flesh: a low thump and a slap.
      const hit = at + 0.12;
      tone(
        e,
        hit,
        to,
        'sine',
        [
          [0, 120],
          [0.09, 60],
        ],
        [
          [0, 0],
          [0.003, 0.9],
          [0.12, 0],
        ],
      );
      noiseHit(e, hit, to, 'lowpass', 1800, 0.7, [
        [0, 0.7],
        [0.06, 0],
      ]);
      // Wetness scaled by the gore setting.
      if (o.gore > 0)
        noiseHit(
          e,
          hit + 0.01,
          to,
          'bandpass',
          600,
          2.5,
          [
            [0, 0],
            [0.01, 0.25 * o.gore],
            [0.14, 0],
          ],
          300,
        );
      return 0.35;
    },
  },
  {
    id: 'SFX_CHARGE_LEVEL_1',
    captionKey: 'caption.sfx.charge_level_1',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan);
      // A tightening creak: a gritty pulse train rising in rate and pitch, and a drawn breath.
      const o = e.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, at);
      o.frequency.linearRampToValueAtTime(115, at + 0.55);
      const am = e.ctx.createOscillator();
      am.frequency.setValueAtTime(18, at);
      am.frequency.linearRampToValueAtTime(42, at + 0.55);
      const amGain = e.ctx.createGain();
      amGain.gain.value = 0.5;
      // The grit is a separate stage (0.5 +/- 0.5), so the envelope alone decides silence.
      const grit = e.ctx.createGain();
      grit.gain.value = 0.5;
      const g = e.ctx.createGain();
      envelope(g.gain, at, [
        [0, 0],
        [0.1, 0.75],
        [0.5, 0.95],
        [0.62, 0],
      ]);
      const bp = e.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 1.5;
      am.connect(amGain).connect(grit.gain);
      o.connect(bp).connect(grit).connect(g).connect(to);
      o.start(at);
      am.start(at);
      o.stop(at + 0.7);
      am.stop(at + 0.7);
      breath(e, at + 0.05, to, 0.55, 0.35, 900);
      return 0.7;
    },
  },
  {
    id: 'SFX_CHARGE_LEVEL_2',
    captionKey: 'caption.sfx.charge_level_2',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan, 0.25);
      // The guard-break warning: a ring that swells and wavers, then a hard exhale.
      const ring = e.ctx.createGain();
      envelope(ring.gain, at, [
        [0, 0],
        [0.18, 1.8],
        [0.7, 1.45],
        [1.1, 0],
      ]);
      // The waver is its own stage (0.65 +/- 0.35), so the envelope alone decides silence.
      const waver = e.ctx.createGain();
      waver.gain.value = 0.65;
      const trem = e.ctx.createOscillator();
      trem.frequency.value = 7;
      const tg = e.ctx.createGain();
      tg.gain.value = 0.35;
      trem.connect(tg).connect(waver.gain);
      trem.start(at);
      trem.stop(at + 1.2);
      waver.connect(ring);
      ring.connect(to);
      for (const [f, a] of [
        [660, 0.28],
        [990, 0.16],
        [1485, 0.08],
      ] as const)
        tone(
          e,
          at,
          waver,
          'triangle',
          [
            [0, f * 0.97],
            [0.18, f],
          ],
          [
            [0, a],
            [1.1, a],
          ],
        );
      breath(e, at + 0.85, to, 0.4, 0.6, 1400);
      return 1.3;
    },
  },
  {
    id: 'SFX_PARRY',
    captionKey: 'caption.sfx.parry',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan);
      // Bright and unmistakable: a sharp click and high, clean metal with a short tail.
      noiseHit(e, at, to, 'highpass', 4000, 0.7, [
        [0, 0.9],
        [0.012, 0],
      ]);
      metal(e, at, to, 2093, [1, 1.51, 2.1, 2.83], 0.38, 0.35);
      return 0.5;
    },
  },
  {
    id: 'SFX_BLOCK',
    captionKey: 'caption.sfx.block',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan);
      // A heavy wooden thud: low body, a dull knock, no ring.
      tone(
        e,
        at,
        to,
        'sine',
        [
          [0, 150],
          [0.12, 70],
        ],
        [
          [0, 0],
          [0.002, 1],
          [0.18, 0],
        ],
      );
      noiseHit(e, at, to, 'bandpass', 420, 1.6, [
        [0, 0.9],
        [0.09, 0],
      ]);
      noiseHit(e, at, to, 'lowpass', 900, 0.5, [
        [0, 0.5],
        [0.04, 0],
      ]);
      return 0.25;
    },
  },
  {
    id: 'SFX_GUARD_BREAK',
    captionKey: 'caption.sfx.guard_break',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan);
      // Splintering: a crack, then a run of small cracks, and a stagger grunt.
      tone(
        e,
        at,
        to,
        'sine',
        [
          [0, 180],
          [0.1, 55],
        ],
        [
          [0, 0],
          [0.002, 1],
          [0.15, 0],
        ],
      );
      const r = rng(31);
      let t = at;
      for (let i = 0; i < 7; i++) {
        noiseHit(e, t, to, 'highpass', 1500 + r() * 2500, 0.8, [
          [0, 0.7 - i * 0.07],
          [0.012 + r() * 0.01, 0],
        ]);
        t += 0.015 + r() * 0.035;
      }
      grunt(e, at + 0.12, to, 150, 0.28, 0.5);
      return 0.5;
    },
  },
];

/**
 * People in water and the bow (Stage 6 rework: Book 7 section 07, Book 11 section 07). Soft and
 * low like the footsteps (decision AU-10): a wading splash is a dull rush with a slap, never a
 * click; the bow's draw is a slow wooden creak and the loose a dry snap and a low thrum.
 */
export const PEOPLE: readonly SoundDef[] = [
  {
    id: 'SFX_SPLASH',
    captionKey: 'caption.sfx.splash',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan);
      noiseHit(
        e,
        at,
        to,
        'lowpass',
        1800,
        0.7,
        [
          [0, 0],
          [0.012, 0.55],
          [0.09, 0.3],
          [0.42, 0],
        ],
        420,
      );
      noiseHit(e, at + 0.03, to, 'bandpass', 700, 1.4, [
        [0, 0],
        [0.01, 0.35],
        [0.16, 0],
      ]);
      // Drops falling back on the water.
      for (const d of [0.16, 0.24, 0.33])
        noiseHit(e, at + d, to, 'bandpass', 1300 + d * 900, 3, [
          [0, 0],
          [0.004, 0.12],
          [0.05, 0],
        ]);
      return 0.5;
    },
  },
  {
    id: 'SFX_BOW_DRAW',
    captionKey: 'caption.sfx.bow_draw',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan);
      // The stave bending: a slow, low wooden creak rising a little as the string comes back.
      tone(
        e,
        at,
        to,
        'sawtooth',
        [
          [0, 95],
          [0.45, 128],
        ],
        [
          [0, 0],
          [0.08, 0.11],
          [0.4, 0.09],
          [0.5, 0],
        ],
      );
      noiseHit(e, at, to, 'bandpass', 520, 4, [
        [0, 0],
        [0.1, 0.17],
        [0.45, 0.11],
        [0.5, 0],
      ]);
      return 0.55;
    },
  },
  {
    id: 'SFX_BOW_LOOSE',
    captionKey: 'caption.sfx.bow_loose',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan);
      // The string let go: a dry snap, then its low thrum dying away.
      noiseHit(e, at, to, 'bandpass', 1500, 1.2, [
        [0, 0],
        [0.003, 0.45],
        [0.04, 0],
      ]);
      tone(
        e,
        at,
        to,
        'triangle',
        [
          [0, 150],
          [0.3, 118],
        ],
        [
          [0, 0],
          [0.004, 0.3],
          [0.35, 0.0001],
        ],
      );
      return 0.4;
    },
  },
];

export const TELLS: readonly SoundDef[] = [
  {
    id: 'SFX_TELL_RAN',
    captionKey: 'caption.tell.ran',
    bus: 'tells',
    play: (e, at, pan) => {
      const to = out(e, 'tells', pan, 0.5);
      // Rán's sea-light: a hum under the water (detuned, beating, muffled) and a shimmer on top
      // that always falls.
      const under = e.ctx.createBiquadFilter();
      under.type = 'lowpass';
      under.frequency.value = 240;
      under.Q.value = 0.9;
      const under2 = e.ctx.createBiquadFilter();
      under2.type = 'lowpass';
      under2.frequency.value = 300;
      under.connect(under2).connect(to);
      for (const [f, a] of [
        [55, 0.45],
        [55.8, 0.4],
        [110.6, 0.18],
        [82.2, 0.12],
      ] as const)
        tone(
          e,
          at,
          under,
          'sawtooth',
          [[0, f]],
          [
            [0, 0],
            [1.4, a],
            [3.6, a * 0.8],
            [5, 0],
          ],
        );
      const r = rng(41);
      for (let i = 0; i < 6; i++) {
        const t = at + 0.6 + i * 0.55 + r() * 0.2;
        const f = 2400 - i * 190;
        tone(
          e,
          t,
          to,
          'sine',
          [
            [0, f],
            [0.9, f * 0.84],
          ],
          [
            [0, 0],
            [0.15, 0.05],
            [0.9, 0],
          ],
        );
      }
      return 5;
    },
  },
  {
    id: 'SFX_TELL_MANANNAN',
    captionKey: 'caption.tell.manannan',
    bus: 'tells',
    play: (e, at, pan) => {
      // Manannán's mist: hooves on water, cantering past from one side to the other, inside a
      // shimmer that never resolves (a cluster with a lowered second) and a far horn.
      const pad = out(e, 'tells', 0, 0.6);
      for (const [f, a] of [
        [1046.5, 0.06],
        [1108.7, 0.055],
        [1568, 0.045],
        [1661.2, 0.035],
      ] as const) {
        const o = e.ctx.createOscillator();
        o.frequency.value = f;
        const lfo = e.ctx.createOscillator();
        lfo.frequency.value = 0.3 + f / 9000;
        const lg = e.ctx.createGain();
        lg.gain.value = f * 0.004;
        lfo.connect(lg).connect(o.frequency);
        const g = e.ctx.createGain();
        envelope(g.gain, at, [
          [0, 0],
          [1.2, a],
          [4.5, a],
          [6, 0],
        ]);
        o.connect(g).connect(pad);
        o.start(at);
        lfo.start(at);
        o.stop(at + 6.1);
        lfo.stop(at + 6.1);
      }
      const horn = e.sampleSource('horn', 196);
      const hg = e.ctx.createGain();
      envelope(hg.gain, at + 1.5, [
        [0, 0],
        [0.8, 0.07],
        [2.2, 0.05],
        [3.2, 0],
      ]);
      const hf = e.ctx.createBiquadFilter();
      hf.type = 'lowpass';
      hf.frequency.value = 700;
      horn.connect(hf).connect(hg).connect(pad);
      horn.start(at + 1.5);
      horn.stop(at + 4.8);
      // The canter: da-da-DUM, moving across.
      const pattern = [0, 0.13, 0.3];
      for (let bar = 0; bar < 7; bar++) {
        for (let k = 0; k < 3; k++) {
          const t = at + 0.8 + bar * 0.62 + (pattern[k] ?? 0);
          const p = pan - 0.9 + (bar / 6) * 1.8;
          const to = out(e, 'tells', p, 0.4);
          const loud = (k === 2 ? 1 : 0.7) * Math.sin((Math.PI * (bar + 0.5)) / 7);
          tone(
            e,
            t,
            to,
            'sine',
            [
              [0, 160],
              [0.06, 90],
            ],
            [
              [0, 0],
              [0.003, 0.6 * loud],
              [0.09, 0],
            ],
          );
          noiseHit(
            e,
            t + 0.01,
            to,
            'bandpass',
            1600,
            1.2,
            [
              [0, 0],
              [0.01, 0.4 * loud],
              [0.16, 0],
            ],
            700,
          );
        }
      }
      return 6;
    },
  },
  {
    id: 'SFX_TELL_DRAUGR',
    captionKey: 'caption.tell.draugr',
    bus: 'tells',
    play: (e, at, pan) => {
      // The draugr: a dripping that follows, coming closer each drop, over a slow wet breath
      // and a creak.
      const r = rng(53);
      let t = at;
      for (let i = 0; i < 11; i++) {
        const near = i / 10;
        const to = out(e, 'tells', pan * (1 - near), 0.35 + 0.3 * (1 - near));
        const f = 900 + r() * 500;
        tone(
          e,
          t,
          to,
          'sine',
          [
            [0, f],
            [0.025, f * 2.1],
          ],
          [
            [0, 0],
            [0.002, 0.16 + 0.6 * near],
            [0.06, 0],
          ],
        );
        t += 0.32 + r() * 0.28 - near * 0.08;
      }
      const low = out(e, 'tells', 0, 0.2);
      noiseHit(e, at + 0.5, low, 'lowpass', 420, 0.8, [
        [0, 0],
        [1.5, 0.32],
        [3.2, 0.1],
        [4.6, 0.36],
        [5.4, 0],
      ]);
      tone(
        e,
        at + 2.2,
        low,
        'sawtooth',
        [
          [0, 46],
          [0.7, 38],
        ],
        [
          [0, 0],
          [0.2, 0.05],
          [0.7, 0],
        ],
      );
      return 5.5;
    },
  },
];

/**
 * Home sounds, generated in code (Book 11 sections 07 and 12; Stage 7): the work sounds of the
 * first homestead tasks, the fire, sleep and a well-timed stroke, and the machair's life by time
 * of day (larks and oystercatchers at dawn, sheep and larks by day, curlews at dusk, the corncrake
 * at night) laid over the heath's wind bed. Every effect has its caption.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { breath, metal, noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** Small crackles: dry clicks of burning wood, `n` of them over `seconds`. */
function crackles(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  n: number,
  seconds: number,
  level: number,
  seed: number,
): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const t = at + r() * seconds;
    noiseHit(e, t, to, 'bandpass', 1200 + r() * 2400, 1.4, [
      [0, 0],
      [0.002, level * (0.4 + r() * 0.6)],
      [0.018 + r() * 0.03, 0],
    ]);
  }
}

/** A hollow knock of wood on wood. */
function knock(e: SynthEngine, at: number, to: AudioNode, hz: number, level: number): void {
  tone(
    e,
    at,
    to,
    'triangle',
    [
      [0, hz * 1.3],
      [0.03, hz],
    ],
    [
      [0, 0],
      [0.002, level],
      [0.11, 0],
    ],
  );
  noiseHit(e, at, to, 'bandpass', hz * 3.2, 5, [
    [0, 0],
    [0.002, level * 0.8],
    [0.06, 0],
  ]);
}

export const HOME: readonly SoundDef[] = [
  {
    id: 'SFX_WORK_DRIFTWOOD',
    captionKey: 'caption.sfx.task_driftwood',
    bus: 'effects',
    play: (e, at, pan) => {
      // Wet driftwood pulled from the wrack and knocked together on the armful.
      const to = out(e, 'effects', pan);
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        900,
        0.9,
        [
          [0, 0],
          [0.05, 0.16],
          [0.28, 0],
        ],
        2200,
      );
      knock(e, at + 0.3, to, 230, 0.42);
      knock(e, at + 0.47, to, 190, 0.34);
      knock(e, at + 0.56, to, 260, 0.22);
      return 0.75;
    },
  },
  {
    id: 'SFX_WORK_CAST',
    captionKey: 'caption.sfx.task_cast',
    bus: 'effects',
    play: (e, at, pan) => {
      // The line whips out (a falling swish), then the weighted hook plops in.
      const to = out(e, 'effects', pan, 0.1);
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        3400,
        2.2,
        [
          [0, 0],
          [0.06, 0.3],
          [0.26, 0],
        ],
        800,
      );
      tone(
        e,
        at + 0.62,
        to,
        'sine',
        [
          [0, 950],
          [0.07, 260],
        ],
        [
          [0, 0],
          [0.004, 0.32],
          [0.1, 0],
        ],
      );
      noiseHit(e, at + 0.62, to, 'lowpass', 1500, 0.8, [
        [0, 0],
        [0.006, 0.18],
        [0.12, 0],
      ]);
      return 0.85;
    },
  },
  {
    id: 'SFX_WORK_CATCH',
    captionKey: 'caption.sfx.task_catch',
    bus: 'effects',
    play: (e, at, pan) => {
      // A fish thrashing at the surface, lifted out, and slapping wet on the stones.
      const to = out(e, 'effects', pan, 0.1);
      const r = rng(Math.floor(at * 1000) % 9973);
      let t = at;
      for (let i = 0; i < 5; i++) {
        noiseHit(e, t, to, 'lowpass', 1800 + r() * 1400, 0.7, [
          [0, 0],
          [0.008, 0.45 + r() * 0.25],
          [0.07 + r() * 0.05, 0],
        ]);
        t += 0.07 + r() * 0.08;
      }
      noiseHit(e, at + 0.75, to, 'lowpass', 520, 0.9, [
        [0, 0],
        [0.004, 0.9],
        [0.09, 0],
      ]);
      noiseHit(e, at + 0.92, to, 'lowpass', 680, 0.9, [
        [0, 0],
        [0.004, 0.504],
        [0.07, 0],
      ]);
      return 1.1;
    },
  },
  {
    id: 'SFX_WORK_TEND',
    captionKey: 'caption.sfx.task_tend',
    bus: 'effects',
    play: (e, at, pan) => {
      // Linen torn into a strip (a quick rasp of tiny fibres), then wound round and pulled tight.
      const to = out(e, 'effects', pan);
      const r = rng(41);
      for (let i = 0; i < 22; i++) {
        const t = at + (i / 22) * 0.42 + r() * 0.01;
        noiseHit(e, t, to, 'bandpass', 2600 + r() * 1800, 1.1, [
          [0, 0],
          [0.002, 0.34 + r() * 0.24],
          [0.016, 0],
        ]);
      }
      for (const [d, l] of [
        [0.62, 0.288],
        [0.95, 0.24],
      ] as const)
        noiseHit(e, at + d, to, 'bandpass', 1500, 0.8, [
          [0, 0],
          [0.12, l],
          [0.3, 0],
        ]);
      return 1.3;
    },
  },
  {
    id: 'SFX_WORK_COOK',
    captionKey: 'caption.sfx.task_cook',
    bus: 'effects',
    play: (e, at, pan) => {
      // Fish laid on the hot stone: a sizzle that settles, a pop or two of fat, a knock of the pot.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'highpass', 3800, 0.6, [
        [0, 0],
        [0.04, 0.2],
        [0.5, 0.12],
        [1.4, 0],
      ]);
      crackles(e, at + 0.1, to, 9, 1.1, 0.28, 77);
      metal(e, at + 0.02, to, 520, [1, 2.4, 3.9], 0.35, 0.08);
      return 1.5;
    },
  },
  {
    id: 'SFX_WORK_HAMMER',
    captionKey: 'caption.sfx.task_build',
    bus: 'effects',
    play: (e, at, pan) => {
      // A wooden mallet driving a stake into turf: a dull thud and the knock of the head, twice.
      const to = out(e, 'effects', pan, 0.08);
      for (const d of [0, 0.42]) {
        noiseHit(e, at + d, to, 'lowpass', 340, 0.9, [
          [0, 0],
          [0.003, 0.6],
          [0.12, 0],
        ]);
        tone(
          e,
          at + d,
          to,
          'sine',
          [
            [0, 150],
            [0.08, 92],
          ],
          [
            [0, 0],
            [0.003, 0.45],
            [0.14, 0],
          ],
        );
        knock(e, at + d + 0.004, to, 420, 0.2);
      }
      return 0.7;
    },
  },
  {
    id: 'SFX_FIRE_LIT',
    captionKey: 'caption.sfx.fire_lit',
    bus: 'effects',
    play: (e, at, pan) => {
      // Flint on steel, three strikes; the tinder takes and the kindling catches with a breath.
      const to = out(e, 'effects', pan);
      for (const d of [0, 0.32, 0.6]) {
        noiseHit(e, at + d, to, 'highpass', 5200, 0.9, [
          [0, 0],
          [0.001, 0.36],
          [0.014, 0],
        ]);
        metal(e, at + d, to, 3100, [1, 1.47], 0.07, 0.07);
      }
      noiseHit(
        e,
        at + 0.75,
        to,
        'lowpass',
        300,
        0.7,
        [
          [0, 0],
          [0.32, 0.34],
          [1.0, 0.1],
          [1.6, 0],
        ],
        1300,
      );
      crackles(e, at + 1.0, to, 10, 0.9, 0.3, 19);
      return 2;
    },
  },
  {
    id: 'SFX_FIRE_FED',
    captionKey: 'caption.sfx.fire_fed',
    bus: 'effects',
    play: (e, at, pan) => {
      // A log dropped on the embers, a puff of sparks and a run of crackles.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'lowpass', 260, 0.8, [
        [0, 0],
        [0.004, 0.5],
        [0.14, 0],
      ]);
      knock(e, at + 0.01, to, 150, 0.22);
      noiseHit(e, at + 0.05, to, 'bandpass', 1400, 0.7, [
        [0, 0],
        [0.1, 0.12],
        [0.45, 0],
      ]);
      crackles(e, at + 0.12, to, 12, 0.9, 0.32, 53);
      return 1.1;
    },
  },
  {
    id: 'SFX_FIRE_OUT',
    captionKey: 'caption.sfx.fire_out',
    bus: 'effects',
    play: (e, at, pan) => {
      // The last embers settle and hiss out, with a soft collapse of ash.
      const to = out(e, 'effects', pan);
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        2600,
        0.9,
        [
          [0, 0],
          [0.15, 0.392],
          [1.6, 0],
        ],
        900,
      );
      noiseHit(e, at + 0.35, to, 'lowpass', 220, 0.7, [
        [0, 0],
        [0.02, 0.896],
        [0.3, 0],
      ]);
      crackles(e, at + 0.1, to, 3, 0.7, 0.18, 7);
      return 1.8;
    },
  },
  {
    id: 'SFX_TIMING_GOOD',
    captionKey: 'caption.sfx.timing_good',
    bus: 'effects',
    play: (e, at, pan) => {
      // A small bright knock that says the stroke was true: two soft partials, like struck horn.
      const to = out(e, 'effects', pan, 0.12);
      for (const [hz, l] of [
        [1175, 0.16],
        [1760, 0.09],
      ] as const)
        tone(
          e,
          at,
          to,
          'sine',
          [[0, hz]],
          [
            [0, 0],
            [0.004, l],
            [0.32, 0],
          ],
        );
      return 0.4;
    },
  },
  {
    id: 'SFX_SLEEP',
    captionKey: 'caption.sfx.sleep',
    bus: 'effects',
    play: (e, at, pan) => {
      // A blanket pulled up, and a long breath out.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 1300, 0.6, [
        [0, 0],
        [0.15, 0.36],
        [0.5, 0],
      ]);
      breath(e, at + 0.55, to, 1.5, 0.36, 650);
      return 2.1;
    },
  },
];

/** The part of the day an ambience or a piece is for (Book 11 section 03). */
export type HomePhase = 'dawn' | 'day' | 'dusk' | 'night';

type Call = 'lark' | 'oyster' | 'wheatear' | 'sheep' | 'curlew' | 'corncrake';

/** What calls in each part of the day, and how often (seconds between, min and max). */
const LIFE: Readonly<Record<HomePhase, readonly (readonly [Call, number, number])[]>> = {
  dawn: [
    ['lark', 5, 12],
    ['oyster', 12, 26],
    ['wheatear', 7, 16],
  ],
  day: [
    ['sheep', 7, 18],
    ['lark', 10, 22],
    ['wheatear', 14, 30],
  ],
  dusk: [
    ['curlew', 9, 18],
    ['sheep', 20, 40],
  ],
  night: [['corncrake', 2.5, 7]],
};

/**
 * The machair's life by time of day, scheduled ahead of the audio clock like the strand's. The
 * wind bed is the heath's (the strand bed with the sea far off); this is what lives in it.
 */
export class HomeAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(503);
  readonly #out: GainNode;
  #phase: HomePhase;
  #next = new Map<Call, number>();
  #running = false;

  constructor(engine: SynthEngine, phase: HomePhase) {
    this.#e = engine;
    this.#phase = phase;
    this.#out = engine.ctx.createGain();
    this.#out.gain.value = 0;
    this.#out.connect(engine.buses.ambience);
  }

  get phase(): HomePhase {
    return this.#phase;
  }

  start(at: number): void {
    this.#running = true;
    this.#out.gain.setValueAtTime(0, at);
    this.#out.gain.linearRampToValueAtTime(1, at + 2);
    this.#plan(at);
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.5);
  }

  /** A new part of the day: the old callers fall quiet, the new ones begin after a while. */
  setPhase(phase: HomePhase, at: number): void {
    if (phase === this.#phase) return;
    this.#phase = phase;
    this.#plan(at);
  }

  #plan(at: number): void {
    this.#next = new Map(
      LIFE[this.#phase].map(([c, lo, hi]) => [c, at + 0.5 + this.#r() * (hi - lo) * 0.5]),
    );
  }

  schedule(until: number): void {
    if (!this.#running) return;
    for (const [call, lo, hi] of LIFE[this.#phase]) {
      let t = this.#next.get(call) ?? until;
      while (t < until) {
        t += this.#call(call, t) + lo + this.#r() * (hi - lo);
      }
      this.#next.set(call, t);
    }
  }

  /** Plays one call at `at`; returns how long it lasts. */
  #call(call: Call, at: number): number {
    const pan = (this.#r() - 0.5) * 1.5;
    const far = 0.55 + this.#r() * 0.45;
    const e = this.#e;
    const to = e.ctx.createStereoPanner();
    to.pan.value = pan;
    const g = e.ctx.createGain();
    g.gain.value = far;
    to.connect(g).connect(this.#out);
    const send = e.ctx.createGain();
    send.gain.value = 0.25;
    g.connect(send).connect(e.echoIn);
    switch (call) {
      case 'lark':
        return this.#lark(at, to);
      case 'oyster':
        return this.#oyster(at, to);
      case 'wheatear':
        return this.#wheatear(at, to);
      case 'sheep':
        return this.#sheep(at, to);
      case 'curlew':
        return this.#curlew(at, to);
      case 'corncrake':
        return this.#corncrake(at, to);
    }
  }

  /** A skylark high overhead: a long run of quick, liquid chirps that never quite repeats. */
  #lark(at: number, to: AudioNode): number {
    const len = 2.5 + this.#r() * 3;
    let t = at;
    while (t < at + len) {
      const a = 2600 + this.#r() * 1900;
      const b = a * (0.8 + this.#r() * 0.5);
      const d = 0.035 + this.#r() * 0.05;
      tone(
        this.#e,
        t,
        to,
        'sine',
        [
          [0, a],
          [d, b],
        ],
        [
          [0, 0],
          [0.006, 0.035 + this.#r() * 0.025],
          [d, 0],
        ],
      );
      t += d + 0.012 + this.#r() * 0.05;
    }
    return len;
  }

  /** Oystercatchers piping along the shore: a quickening run of sharp "kleep" notes. */
  #oyster(at: number, to: AudioNode): number {
    const n = 4 + Math.floor(this.#r() * 5);
    let t = at;
    let gap = 0.28;
    for (let i = 0; i < n; i++) {
      tone(
        this.#e,
        t,
        to,
        'sine',
        [
          [0, 2500],
          [0.03, 3150],
          [0.08, 2900],
        ],
        [
          [0, 0],
          [0.008, 0.07],
          [0.09, 0],
        ],
      );
      t += gap;
      gap = Math.max(0.13, gap * 0.86);
    }
    return t - at;
  }

  /** A wheatear on a stone: two dry "chack"s, like pebbles knocked together. */
  #wheatear(at: number, to: AudioNode): number {
    for (const d of [0, 0.16 + this.#r() * 0.06]) {
      noiseHit(this.#e, at + d, to, 'bandpass', 3600, 4, [
        [0, 0],
        [0.002, 0.12],
        [0.03, 0],
      ]);
      tone(
        this.#e,
        at + d,
        to,
        'sine',
        [[0, 2900]],
        [
          [0, 0],
          [0.002, 0.04],
          [0.04, 0],
        ],
      );
    }
    return 0.3;
  }

  /** A sheep's bleat: a reedy voice with a shaking tremolo, sometimes answered. */
  #sheep(at: number, to: AudioNode): number {
    const one = (t: number, hz: number, len: number, level: number): void => {
      const e = this.#e;
      const o = e.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(hz * 1.08, t);
      o.frequency.linearRampToValueAtTime(hz, t + 0.12);
      o.frequency.linearRampToValueAtTime(hz * 0.9, t + len);
      const vib = e.ctx.createOscillator();
      vib.frequency.value = 7 + this.#r() * 2;
      const depth = e.ctx.createGain();
      depth.gain.value = 0.35;
      const trem = e.ctx.createGain();
      trem.gain.value = 0.65;
      vib.connect(depth).connect(trem.gain);
      const f1 = e.ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 820;
      f1.Q.value = 3;
      const f2 = e.ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 1700;
      f2.Q.value = 4;
      const g = e.ctx.createGain();
      envelope(g.gain, t, [
        [0, 0],
        [0.06, level],
        [len * 0.7, level * 0.8],
        [len, 0],
      ]);
      o.connect(trem);
      trem.connect(f1).connect(g);
      trem.connect(f2).connect(g);
      g.connect(to);
      o.start(t);
      vib.start(t);
      o.stop(t + len + 0.05);
      vib.stop(t + len + 0.05);
    };
    const hz = 190 + this.#r() * 90;
    const len = 0.55 + this.#r() * 0.4;
    one(at, hz, len, 0.32);
    if (this.#r() < 0.4) {
      const t = at + len + 0.6 + this.#r() * 1.2;
      one(t, 230 + this.#r() * 110, 0.45 + this.#r() * 0.3, 0.2);
      return t + 0.8 - at;
    }
    return len;
  }

  /** A curlew at dusk: two rising "cour-lee" whistles, then the bubbling trill that falls away. */
  #curlew(at: number, to: AudioNode): number {
    let t = at;
    for (let i = 0; i < 2; i++) {
      tone(
        this.#e,
        t,
        to,
        'sine',
        [
          [0, 1250],
          [0.45, 2050],
          [0.6, 1950],
        ],
        [
          [0, 0],
          [0.12, 0.07],
          [0.5, 0.06],
          [0.62, 0],
        ],
      );
      t += 0.85;
    }
    if (this.#r() < 0.6) {
      // The trill: quick rising slurs, slowing and falling in pitch.
      const n = 14 + Math.floor(this.#r() * 8);
      for (let i = 0; i < n; i++) {
        const k = i / n;
        const base = 1900 + 500 * (1 - k);
        tone(
          this.#e,
          t,
          to,
          'sine',
          [
            [0, base],
            [0.07, base * 1.25],
          ],
          [
            [0, 0],
            [0.015, 0.055 * (1 - k * 0.6)],
            [0.08, 0],
          ],
        );
        t += 0.085 + k * 0.05;
      }
    }
    return t - at;
  }

  /** The corncrake in the long grass: "crex crex", a dry double rasp, over and over. */
  #corncrake(at: number, to: AudioNode): number {
    const runs = 5 + Math.floor(this.#r() * 8);
    let t = at;
    for (let i = 0; i < runs; i++) {
      for (const d of [0, 0.24]) {
        // Each rasp is a short train of clicks, like a comb drawn over a matchbox.
        for (let k = 0; k < 11; k++) {
          noiseHit(this.#e, t + d + k * 0.016, to, 'bandpass', 2300, 2.5, [
            [0, 0],
            [0.0015, 0.3],
            [0.012, 0],
          ]);
        }
      }
      t += 0.62 + this.#r() * 0.08;
    }
    return t - at;
  }
}

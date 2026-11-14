/**
 * The island's ambience layers (Stage 14; Book 11 sections 07 and 12; decisions S14-100 to
 * S14-109), generated in code like every sound in the game, over the strand's bed of wind, sea and
 * gulls (ambience.ts), which plays them louder or softer and from the sea's side:
 *
 * - birds: the cliff colony (kittiwakes crying over the growl of guillemots, echoing off the
 *   rock), the skylark's long song high over the moor by day, and the curlew's rising call and
 *   bubbling trill carried over the bog;
 * - the stream: water over stones, its gurgle and small bubbles, panned to it;
 * - the waterfall: a broad roar with the hiss of its spray, louder as the steerer nears it;
 * - the cave: drips with their echo off the walls (`AMB_CAVE_DRIP`);
 * - the deep passage's roar (`AMB_PASSAGE_ROAR`): the sea surging in under the rock, rising as the
 *   tide turns towards the flood, the warning before the passage floods;
 * - the bog's quiet (`AMB_BOG_QUIET`): the wind fallen low, and now and then a soft plop in a pool;
 * - the drowned's tell (`SFX_TELL_DROWNED`): slow drips from no rain, and a low wordless hum under
 *   the surf that swells and sinks, a lowered second against its root.
 *
 * Every layer is scheduled ahead of the audio clock from a seeded random stream, and a layer's
 * sources start only once it is first heard.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';
import type { BirdKind, IslandMix, Voice } from '../islandAmbience.ts';

/** The swash's period (render/elevation.ts SWASH_PERIOD), for the passage's surge, seconds. */
const SURGE_PERIOD = 6.5;

/** A sine drip: a drop's quick upward chirp and short ring. */
function drip(e: SynthEngine, at: number, to: AudioNode, hz: number, level: number): void {
  tone(
    e,
    at,
    to,
    'sine',
    [
      [0, hz],
      [0.05, hz * 1.55],
    ],
    [
      [0, 0],
      [0.003, level],
      [0.18, 0],
    ],
  );
}

/** The drowned's tell (one occurrence, about 6 seconds), on the tells bus with its caption. */
export const ISLAND_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_TELL_DROWNED',
    captionKey: 'caption.tell.drowned',
    bus: 'tells',
    play: (e, at, pan) => {
      const to = e.ctx.createGain();
      to.gain.value = 1.6;
      to.connect(out(e, 'tells', pan, 0.45));
      const r = rng(331);
      const len = 6.2;
      // The hum: three detuned voices, the root and a lowered second, swelling and sinking.
      for (const [hz, det] of [
        [110, 0],
        [110, 7],
        [116.5, -5],
      ] as const) {
        const o = e.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = hz;
        o.detune.value = det;
        const f = e.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        const g = e.ctx.createGain();
        envelope(g.gain, at, [
          [0, 0],
          [2.2, 0.06],
          [3.6, 0.05],
          [len, 0],
        ]);
        o.connect(f).connect(g).connect(to);
        o.start(at);
        o.stop(at + len + 0.05);
      }
      // Water running off something standing still: slow drips, in pairs, from no rain.
      let t = at + 0.6;
      while (t < at + len - 0.4) {
        const hz = 1300 + r() * 500;
        drip(e, t, to, hz, 0.1 + r() * 0.05);
        if (r() < 0.6) drip(e, t + 0.11 + r() * 0.05, to, hz * 0.92, 0.07);
        t += 0.75 + r() * 0.6;
      }
      return len + 0.2;
    },
  },
];

interface Layer {
  readonly gain: GainNode;
  readonly pan: StereoPannerNode;
}

export class IslandLayers {
  readonly #e: SynthEngine;
  readonly #r = rng(1409);
  readonly #out: GainNode;
  readonly #sources: AudioScheduledSourceNode[] = [];
  readonly #layers = new Map<string, Layer>();
  /** The cave's echo: a short feedback delay of its own, dark like wet rock. */
  readonly #caveIn: GainNode;
  #mix: IslandMix | null = null;
  readonly #next = new Map<string, number>();
  #running = false;
  #at = 0;

  constructor(engine: SynthEngine) {
    this.#e = engine;
    const c = engine.ctx;
    this.#out = c.createGain();
    this.#out.gain.value = 0;
    this.#out.connect(engine.buses.ambience);
    this.#caveIn = c.createGain();
    const delay = c.createDelay(1);
    delay.delayTime.value = 0.19;
    const fb = c.createGain();
    fb.gain.value = 0.48;
    const dark = c.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 2200;
    this.#caveIn.connect(this.#out);
    this.#caveIn.connect(delay);
    delay.connect(dark).connect(fb).connect(delay);
    dark.connect(this.#out);
  }

  start(at: number): void {
    this.#running = true;
    this.#at = at;
    this.#out.gain.setValueAtTime(0, at);
    this.#out.gain.linearRampToValueAtTime(1, at + 1.5);
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.4);
    for (const s of this.#sources) s.stop(at + 2);
  }

  /** A continuous layer (made the first time it is heard): its gain and pan. */
  #layer(name: string, build: (to: AudioNode) => void): Layer {
    let l = this.#layers.get(name);
    if (l === undefined) {
      const c = this.#e.ctx;
      const gain = c.createGain();
      gain.gain.value = 0;
      const pan = c.createStereoPanner();
      gain.connect(pan).connect(this.#out);
      build(gain);
      l = { gain, pan };
      this.#layers.set(name, l);
    }
    return l;
  }

  #noiseBand(
    to: AudioNode,
    type: BiquadFilterType,
    hz: number,
    q: number,
    level: number,
    pink: boolean,
    wobble: number,
  ): void {
    const c = this.#e.ctx;
    const src = this.#e.noise(c.currentTime + 0.01, pink);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = level;
    if (wobble > 0) {
      // A slow wobble of the band, so moving water never sounds like steady hiss.
      const lfo = c.createOscillator();
      lfo.frequency.value = wobble;
      const depth = c.createGain();
      depth.gain.value = hz * 0.22;
      lfo.connect(depth).connect(f.frequency);
      lfo.start();
      this.#sources.push(lfo);
    }
    src.connect(f).connect(g).connect(to);
    this.#sources.push(src);
  }

  #set(name: string, v: Voice, scale: number, at: number, build: (to: AudioNode) => void): void {
    if (v.level <= 0 && !this.#layers.has(name)) return;
    const l = this.#layer(name, build);
    l.gain.gain.setTargetAtTime(v.level * scale, at, 0.5);
    l.pan.pan.setTargetAtTime(v.pan, at, 0.5);
  }

  /** The layers' levels and sides for now (from islandAmbience.ts `islandMix`). */
  set(mix: IslandMix, at = this.#e.ctx.currentTime): void {
    this.#mix = mix;
    this.#set('stream', mix.stream, 0.24, at, (to) => {
      this.#noiseBand(to, 'bandpass', 1900, 2.2, 0.5, false, 2.7);
      this.#noiseBand(to, 'bandpass', 3400, 2.8, 0.35, false, 4.3);
      this.#noiseBand(to, 'lowpass', 420, 0.7, 0.6, true, 0.9);
    });
    this.#set('falls', mix.falls, 0.18, at, (to) => {
      this.#noiseBand(to, 'lowpass', 1300, 0.6, 0.9, true, 0.23);
      this.#noiseBand(to, 'bandpass', 520, 0.8, 0.5, true, 0.17);
      this.#noiseBand(to, 'highpass', 3800, 0.5, 0.12, false, 0.31);
    });
    this.#set('roar', mix.roar, 0.3, at, (to) => {
      // The surge: the sea heaving in under the rock on the swash's period.
      const c = this.#e.ctx;
      const surge = c.createGain();
      surge.gain.value = 0.6;
      const lfo = c.createOscillator();
      lfo.frequency.value = 1 / SURGE_PERIOD;
      const depth = c.createGain();
      depth.gain.value = 0.4;
      lfo.connect(depth).connect(surge.gain);
      lfo.start();
      this.#sources.push(lfo);
      surge.connect(to);
      this.#noiseBand(surge, 'lowpass', 240, 0.9, 1.1, true, 0.11);
      this.#noiseBand(surge, 'bandpass', 700, 1.1, 0.35, true, 0.37);
    });
  }

  /** Schedules the calls, drips and plops that start before `until`. */
  schedule(until: number): void {
    const mix = this.#mix;
    if (!this.#running || mix === null) return;
    const r = this.#r;
    const due = (name: string, every: () => number, play: (t: number) => void): void => {
      let t = this.#next.get(name) ?? this.#at + r() * 2;
      while (t < until) {
        play(t);
        t += every();
      }
      this.#next.set(name, t);
    };
    for (const kind of ['colony', 'skylark', 'curlew'] as const) {
      const v = mix.birds[kind];
      if (v.level <= 0) {
        this.#next.delete(kind);
        continue;
      }
      due(
        kind,
        () => this.#interval(kind) / v.level,
        (t) => {
          this.#bird(kind, t, v.level);
        },
      );
    }
    if (mix.cave > 0)
      due(
        'drip',
        () => (0.3 + r() * 1.4) / mix.cave,
        (t) => {
          drip(this.#e, t, this.#caveIn, 800 + r() * 1700, (0.06 + r() * 0.07) * mix.cave);
        },
      );
    else this.#next.delete('drip');
    if (mix.stream.level > 0.15)
      due(
        'bubble',
        () => (0.12 + r() * 0.5) / mix.stream.level,
        (t) => {
          // A bubble breaking at the surface: a short rising glug, panned with the stream.
          const p = this.#e.ctx.createStereoPanner();
          p.pan.value = Math.max(-1, Math.min(1, mix.stream.pan + (r() - 0.5) * 0.3));
          p.connect(this.#out);
          const hz = 380 + r() * 700;
          tone(
            this.#e,
            t,
            p,
            'sine',
            [
              [0, hz],
              [0.04, hz * 1.9],
            ],
            [
              [0, 0],
              [0.004, 0.035 * mix.stream.level],
              [0.06, 0],
            ],
          );
        },
      );
    else this.#next.delete('bubble');
    if (mix.quiet > 0)
      due(
        'plop',
        () => (4 + r() * 9) / mix.quiet,
        (t) => {
          // A soft plop in a bog pool, far off in the quiet.
          const p = this.#e.ctx.createStereoPanner();
          p.pan.value = (r() - 0.5) * 1.4;
          p.connect(this.#out);
          const hz = 150 + r() * 120;
          tone(
            this.#e,
            t,
            p,
            'sine',
            [
              [0, hz * 1.6],
              [0.09, hz],
            ],
            [
              [0, 0],
              [0.006, 0.05 * mix.quiet],
              [0.22, 0],
            ],
          );
        },
      );
    else this.#next.delete('plop');
  }

  /** The mean wait between calls at a rate of 1, seconds. */
  #interval(kind: BirdKind): number {
    const r = this.#r;
    if (kind === 'colony') return 0.35 + r() * 1.1;
    if (kind === 'skylark') return 10 + r() * 9;
    return 9 + r() * 12;
  }

  #bird(kind: BirdKind, at: number, level: number): void {
    const e = this.#e;
    const r = this.#r;
    const p = e.ctx.createStereoPanner();
    p.pan.value = (r() - 0.5) * 1.6;
    p.connect(this.#out);
    const echo = e.ctx.createGain();
    echo.gain.value = kind === 'colony' ? 0.3 : kind === 'curlew' ? 0.4 : 0.1;
    p.connect(echo).connect(e.echoIn);
    const k = Math.min(1, level);
    if (kind === 'colony') {
      if (r() < 0.6) {
        // A kittiwake's cry: the gull's call, higher and thinner, two or three notes.
        const notes = 2 + Math.floor(r() * 2);
        for (let n = 0; n < notes; n++) {
          const src = e.sampleSource('gull', 2600 * 2 ** ((r() * 4 - 1) / 12));
          const g = e.ctx.createGain();
          g.gain.value = (0.025 + r() * 0.03) * k;
          src.connect(g).connect(p);
          src.start(at + n * (0.16 + r() * 0.06));
          src.stop(at + n * 0.22 + 0.5);
        }
      } else {
        // A guillemot's growl on the ledges: a low, rolling "arrr".
        const o = e.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(190 + r() * 70, at);
        o.frequency.linearRampToValueAtTime(150 + r() * 40, at + 0.45);
        const am = e.ctx.createOscillator();
        am.frequency.value = 26 + r() * 10;
        const amDepth = e.ctx.createGain();
        amDepth.gain.value = 0.5;
        const f = e.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 900;
        f.Q.value = 1.2;
        const g = e.ctx.createGain();
        envelope(g.gain, at, [
          [0, 0],
          [0.05, 0.03 * k],
          [0.35, 0.025 * k],
          [0.5, 0],
        ]);
        am.connect(amDepth).connect(g.gain);
        o.connect(f).connect(g).connect(p);
        o.start(at);
        am.start(at);
        o.stop(at + 0.55);
        am.stop(at + 0.55);
      }
      return;
    }
    if (kind === 'skylark') {
      // The skylark's song: a long run of quick, high notes, overhead and far off.
      const len = 4 + r() * 5;
      let t = at;
      while (t < at + len) {
        const hz = 2800 + r() * 2400;
        const dur = 0.035 + r() * 0.06;
        tone(
          e,
          t,
          p,
          'sine',
          [
            [0, hz],
            [dur, hz * (0.85 + r() * 0.35)],
          ],
          [
            [0, 0],
            [0.006, 0.018 * k],
            [dur, 0],
          ],
        );
        t += dur + 0.01 + (r() < 0.12 ? 0.12 : 0);
      }
      return;
    }
    // The curlew: a rising "cour-lee", twice or three times, sometimes into its bubbling trill.
    const calls = 2 + Math.floor(r() * 2);
    let t = at;
    for (let n = 0; n < calls; n++) {
      tone(
        e,
        t,
        p,
        'sine',
        [
          [0, 1450 + r() * 80],
          [0.18, 1600],
          [0.48, 2250 + r() * 120],
        ],
        [
          [0, 0],
          [0.05, 0.04 * k],
          [0.4, 0.035 * k],
          [0.52, 0],
        ],
      );
      t += 0.7 + r() * 0.2;
    }
    if (r() < 0.35) {
      let u = t + 0.2;
      for (let n = 0; n < 10; n++) {
        const step = 0.16 - n * 0.009;
        tone(
          e,
          u,
          p,
          'sine',
          [
            [0, 1700 + n * 40],
            [step * 0.8, 2300 + n * 50],
          ],
          [
            [0, 0],
            [0.02, 0.03 * k],
            [step, 0],
          ],
        );
        u += step;
      }
    }
  }
}

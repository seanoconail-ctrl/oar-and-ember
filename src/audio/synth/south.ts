/**
 * Stage 10's sounds (Book 11 sections 07 and 12), generated in code like every sound in the game:
 *
 * - the Hag's Seat sign's tell (`SFX_TELL_CAILLEACH`): hail rattling on the standing stone out of a
 *   dry sky, under a cold wind that rises and falls away, and water dripping from the stone;
 * - the Kelda Spring (`AMB_KELDA_SPRING`): the spring bubbling up through its sand and the trickle
 *   of the stream leaving the pool, louder as the steerer nears it;
 * - the sheepfold under the cairn (`AMB_CAIRN_FOLD`) is the machair's day life with the sheep near
 *   and many (src/audio/synth/home.ts, its "fold" set), over the heath's wind;
 * - the Hag's Seat headland (`AMB_HAGSEAT_GALE`) is the strand's bed in a gale, the surf far below
 *   the cliffs (src/audio/synth/ambience.ts, played harder by src/audio/webAudio.ts).
 *
 * Everything is scheduled ahead of the audio clock and uses seeded random streams.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** The gale's wind against the place's own (Book 7 section 14: the Hag's Seat is the windiest). */
export const GALE_WIND = 1.7;

/** A short burst of filtered noise: a hailstone striking stone. */
function stone(e: SynthEngine, at: number, to: AudioNode, hz: number, level: number): void {
  const src = e.noise(at);
  const f = e.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = hz;
  f.Q.value = 3.5;
  const g = e.ctx.createGain();
  envelope(g.gain, at, [
    [0, 0],
    [0.002, level],
    [0.03, level * 0.25],
    [0.07, 0],
  ]);
  src.connect(f).connect(g).connect(to);
  src.stop(at + 0.1);
}

export const SOUTH: readonly SoundDef[] = [
  {
    id: 'SFX_TELL_CAILLEACH',
    captionKey: 'caption.tell.cailleach',
    bus: 'tells',
    play: (e, at, pan) => {
      // The Cailleach's tell: hail on the stone, thickening and thinning, in a cold wind.
      // Loud enough to stand out over the gale's ambience (Book 11 section 09: tells stand out).
      const to = e.ctx.createGain();
      to.gain.value = 2.6;
      to.connect(out(e, 'tells', pan, 0.35));
      const r = rng(77);
      const len = 5.5;
      let t = at + 0.15;
      while (t < at + len) {
        const u = (t - at) / len;
        // Density rises to the middle and falls away: a squall passing over.
        const dense = Math.sin(u * Math.PI);
        stone(e, t, to, 2600 + r() * 3200, 0.12 + 0.3 * dense * r());
        if (r() < 0.25) stone(e, t + 0.008, to, 1300 + r() * 900, 0.08 * dense);
        t += 0.012 + (1 - dense) * 0.18 * r() + 0.02 * r();
      }
      // The wind: a hollow moan whose band slides up as the squall comes and down as it goes.
      const wind = e.noise(at, true);
      const band = e.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 6;
      band.frequency.setValueAtTime(320, at);
      band.frequency.linearRampToValueAtTime(760, at + len * 0.5);
      band.frequency.linearRampToValueAtTime(280, at + len);
      const wg = e.ctx.createGain();
      envelope(wg.gain, at, [
        [0, 0],
        [1.2, 0.55],
        [len - 1.2, 0.5],
        [len, 0],
      ]);
      wind.connect(band).connect(wg).connect(to);
      wind.stop(at + len + 0.05);
      // Water running off the stone: drips after the hail.
      for (let i = 0; i < 6; i++) {
        const d = at + len * 0.55 + i * 0.42 + r() * 0.2;
        const f = 1500 + r() * 900;
        tone(
          e,
          d,
          to,
          'sine',
          [
            [0, f],
            [0.06, f * 1.6],
          ],
          [
            [0, 0],
            [0.004, 0.12],
            [0.08, 0],
          ],
        );
      }
      return len + 0.2;
    },
  },
];

/**
 * The Kelda Spring: water welling up through sand in slow bubbles that pop and glug, and the
 * stream's trickle leaving the pool over its stones. Its level follows the steerer's distance.
 */
export class SpringAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(211);
  readonly #out: GainNode;
  readonly #trickle: GainNode;
  readonly #sources: AudioScheduledSourceNode[] = [];
  #next = 0;
  #level: number;
  #running = false;

  constructor(engine: SynthEngine, level: number) {
    this.#e = engine;
    this.#level = level;
    const c = engine.ctx;
    this.#out = c.createGain();
    this.#out.gain.value = 0;
    this.#out.connect(engine.buses.ambience);
    this.#trickle = c.createGain();
    this.#trickle.gain.value = 0.16;
    // Water over stones, not a hiss: the top of the noise taken off.
    const soft = c.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 4200;
    this.#trickle.connect(soft).connect(this.#out);
  }

  start(at: number): void {
    this.#running = true;
    const c = this.#e.ctx;
    // The trickle: two bands of noise, each wobbling, never in step.
    for (const [hz, rate, depth] of [
      [2400, 3.1, 0.5],
      [3900, 4.7, 0.4],
    ] as const) {
      const src = this.#e.noise(at);
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = hz;
      f.Q.value = 2.6;
      const g = c.createGain();
      g.gain.value = 0.35;
      const lfo = c.createOscillator();
      lfo.frequency.value = rate;
      const lg = c.createGain();
      lg.gain.value = 0.35 * depth;
      lfo.connect(lg).connect(g.gain);
      src.connect(f).connect(g).connect(this.#trickle);
      src.loop = true;
      lfo.start(at);
      this.#sources.push(src, lfo);
    }
    this.#out.gain.setValueAtTime(0, at);
    this.#out.gain.linearRampToValueAtTime(this.#level, at + 1.5);
    this.#next = at + 0.2;
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.4);
    for (const s of this.#sources) s.stop(at + 2.5);
  }

  /** How near the spring the steerer is: 0 silent to 1 beside it. */
  setLevel(level: number, at: number): void {
    if (Math.abs(level - this.#level) < 0.01) return;
    this.#level = level;
    if (this.#running) this.#out.gain.setTargetAtTime(level, at, 0.3);
  }

  schedule(until: number): void {
    if (!this.#running) return;
    const r = this.#r;
    while (this.#next < until) {
      const t = this.#next;
      // A bubble: a rising blip as it breaks the surface, a smaller one after it now and then.
      const f = 260 + r() * 380;
      const level = 0.25 + r() * 0.4;
      tone(
        this.#e,
        t,
        this.#out,
        'sine',
        [
          [0, f],
          [0.05, f * (1.8 + r() * 0.8)],
        ],
        [
          [0, 0],
          [0.006, level],
          [0.06, 0],
        ],
      );
      if (r() < 0.35)
        tone(
          this.#e,
          t + 0.07,
          this.#out,
          'sine',
          [
            [0, f * 1.4],
            [0.04, f * 2.6],
          ],
          [
            [0, 0],
            [0.004, level * 0.5],
            [0.045, 0],
          ],
        );
      // Bubbles come in little runs, then a pause.
      this.#next += r() < 0.7 ? 0.09 + r() * 0.25 : 0.6 + r() * 1.4;
    }
  }
}

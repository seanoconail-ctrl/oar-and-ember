/**
 * Ambience generated in code (Book 11 section 07): Wreck Strand's bed of wind, sea and gulls.
 *
 * - Wind follows the game's own wind (Book 7 section 14): its strength sets the level, each gust
 *   opens the band and lifts it, a strong wind whistles, and it sits on the side it blows from.
 * - The sea: a low bed, then waves on the swash's own period that build, break and draw back.
 *   The tide sets how close they are: at high water they break near and the backwash rattles
 *   the shingle; at low water they are far off over the flats, softer and duller.
 * - Gulls call now and then, from either side.
 *
 * Everything is scheduled ahead of the audio clock and uses a seeded random stream.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';

/** The swash period of the water shader (render/elevation.ts SWASH_PERIOD), seconds. */
const WAVE_PERIOD = 6.5;

export class StrandAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(97);
  readonly #out: GainNode;
  readonly #windBand: BiquadFilterNode;
  readonly #windGain: GainNode;
  readonly #windPan: StereoPannerNode;
  readonly #whistleBand: BiquadFilterNode;
  readonly #whistleGain: GainNode;
  readonly #seaTone: BiquadFilterNode;
  readonly #seaGain: GainNode;
  readonly #sources: AudioScheduledSourceNode[] = [];
  #strength = 0.55;
  #gust = 0;
  #tide = 0.5;
  #nextWave = 0;
  #nextGull = 0;
  #running = false;

  constructor(engine: SynthEngine) {
    this.#e = engine;
    const c = engine.ctx;
    this.#out = c.createGain();
    this.#out.connect(engine.buses.ambience);
    this.#windBand = c.createBiquadFilter();
    this.#windBand.type = 'bandpass';
    this.#windBand.Q.value = 0.8;
    this.#windGain = c.createGain();
    this.#windPan = c.createStereoPanner();
    this.#windBand.connect(this.#windGain).connect(this.#windPan).connect(this.#out);
    this.#whistleBand = c.createBiquadFilter();
    this.#whistleBand.type = 'bandpass';
    this.#whistleBand.Q.value = 9;
    this.#whistleGain = c.createGain();
    this.#whistleBand.connect(this.#whistleGain).connect(this.#windPan);
    this.#seaTone = c.createBiquadFilter();
    this.#seaTone.type = 'lowpass';
    this.#seaGain = c.createGain();
    this.#seaTone.connect(this.#seaGain).connect(this.#out);
  }

  start(at: number): void {
    const e = this.#e;
    const wind = e.noise(at, true);
    wind.connect(this.#windBand);
    const whistle = e.noise(at + 0.37, false);
    whistle.connect(this.#whistleBand);
    const sea = e.noise(at + 0.71, true);
    sea.connect(this.#seaTone);
    this.#sources.push(wind, whistle, sea);
    this.#out.gain.setValueAtTime(0, at);
    // Ambience sits under the music (about -22 dBFS on the strand at high water).
    this.#out.gain.linearRampToValueAtTime(0.55, at + 1.5);
    this.#nextWave = at + 0.5;
    this.#nextGull = at + 2 + this.#r() * 3;
    this.#running = true;
    this.#apply(at);
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.4);
    for (const s of this.#sources) s.stop(at + 2);
  }

  /** The wind: strength 0..1, the gust here 0..1, and the side it blows from (-1 left .. 1 right). */
  setWind(strength: number, gust: number, from: number, at = this.#e.ctx.currentTime): void {
    this.#strength = strength;
    this.#gust = gust;
    this.#windPan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, from * 0.6)), at, 0.5);
    this.#apply(at);
  }

  /** The tide's drawn height, 0 low water .. 1 high. */
  setTide(height: number, at = this.#e.ctx.currentTime): void {
    this.#tide = height;
    this.#apply(at);
  }

  #apply(at: number): void {
    const s = this.#strength;
    const g = this.#gust;
    const level = 0.03 + 0.32 * s * (0.45 + 0.55 * g);
    this.#windGain.gain.setTargetAtTime(level, at, 0.35);
    this.#windBand.frequency.setTargetAtTime(260 + 900 * s * (0.4 + 0.6 * g), at, 0.4);
    this.#whistleGain.gain.setTargetAtTime(0.09 * Math.max(0, s - 0.45) * (0.3 + g), at, 0.5);
    this.#whistleBand.frequency.setTargetAtTime(900 + 700 * g * s, at, 0.6);
    const h = this.#tide;
    this.#seaTone.frequency.setTargetAtTime(180 + 420 * h, at, 1);
    this.#seaGain.gain.setTargetAtTime(0.1 + 0.14 * h, at, 1);
  }

  /** Schedules waves and gulls that start before `until`. */
  schedule(until: number): void {
    if (!this.#running) return;
    while (this.#nextWave < until) {
      this.#wave(this.#nextWave);
      this.#nextWave += WAVE_PERIOD * (0.85 + this.#r() * 0.3);
    }
    while (this.#nextGull < until) {
      this.#gull(this.#nextGull);
      this.#nextGull += 4 + this.#r() * 8;
    }
  }

  #wave(at: number): void {
    const e = this.#e;
    const c = e.ctx;
    const h = this.#tide;
    const near = 0.25 + 0.75 * h;
    const pan = (this.#r() - 0.5) * 0.8;
    const p = c.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.#out);
    // The body: a swell of low noise opening as it breaks.
    const body = e.noise(at, true);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.6;
    const top = 500 + 2200 * near;
    envelope(f.frequency, at, [
      [0, 250],
      [1.5, top * 0.6],
      [1.9, top],
      [4.6, 300],
    ]);
    const g = c.createGain();
    const peak = 0.16 + 0.42 * near;
    envelope(g.gain, at, [
      [0, 0],
      [1.5, peak * 0.45],
      [1.9, peak],
      [2.6, peak * 0.55],
      [5.2, 0],
    ]);
    body.connect(f).connect(g).connect(p);
    body.stop(at + 5.4);
    // The break: a hiss of spray.
    const spray = e.noise(at + 1.75, false);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const sg = c.createGain();
    envelope(sg.gain, at + 1.75, [
      [0, 0],
      [0.12, 0.12 * near],
      [0.9, 0],
    ]);
    spray.connect(hp).connect(sg).connect(p);
    spray.stop(at + 2.8);
    // The backwash: shingle rattling as the water draws back (near water only), or sand hiss.
    const stones = Math.round(70 * h * h);
    for (let i = 0; i < stones; i++) {
      const t = at + 2.2 + (i / stones) * 2.4 + this.#r() * 0.05;
      const grain = e.noise(t, false);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500 + this.#r() * 4000;
      bp.Q.value = 3;
      const gg = c.createGain();
      const a = 0.18 * h * (1 - i / stones) * (0.5 + this.#r() * 0.5);
      envelope(gg.gain, t, [
        [0, a],
        [0.008 + this.#r() * 0.01, 0],
      ]);
      grain.connect(bp).connect(gg).connect(p);
      grain.stop(t + 0.03);
    }
    if (h < 0.5) {
      const hiss = e.noise(at + 2, false);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 5000;
      bp.Q.value = 0.7;
      const hg = c.createGain();
      envelope(hg.gain, at + 2, [
        [0, 0],
        [0.4, 0.04 * (1 - h)],
        [2.6, 0],
      ]);
      hiss.connect(bp).connect(hg).connect(p);
      hiss.stop(at + 4.7);
    }
  }

  #gull(at: number): void {
    const e = this.#e;
    const calls = this.#r() < 0.35 ? 2 + Math.floor(this.#r() * 2) : 1;
    const pan = (this.#r() - 0.5) * 1.6;
    for (let k = 0; k < calls; k++) {
      const t = at + k * (0.45 + this.#r() * 0.2);
      const src = e.sampleSource('gull', 1760 * 2 ** ((this.#r() * 5 - 2) / 12));
      const g = e.ctx.createGain();
      g.gain.value = 0.06 + this.#r() * 0.06;
      const p = e.ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(g).connect(p).connect(this.#out);
      const send = e.ctx.createGain();
      send.gain.value = 0.3;
      g.connect(send).connect(e.echoIn);
      src.start(t);
    }
  }
}

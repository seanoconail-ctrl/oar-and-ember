/**
 * Stage 13's sounds at sea and at the wreck (Book 11 sections 03, 07 and 12; decisions S13-66 to
 * S13-72), generated in code like every sound in the game:
 *
 * - **The sea's bed** (`SeaAmbience`, the cues `AMB_WIND_RIGGING` and `AMB_FOG_QUIET`): the open
 *   swell, low and slow, the sound of distance; the water running along the strakes while she
 *   moves; small waves slapping the hull, heavier booms in a storm, panned to the side they strike;
 *   the wind in the rigging, rising with the wind's strength, its stays whistling and its gusts
 *   lifting it; the oars' splash at the catch and their creak on the recovery in time with the
 *   stroke while the crew row; the sail's sheets straining and, in light airs, the sail luffing;
 *   the hull groaning in a storm. In fog the wind and the far sea fall away to the dead quiet of
 *   fog: a dulled swell, water lapping close along the planks, a drip from the rigging, the mast's
 *   small creak, and nothing far off.
 * - **The sail and the hull** as one-shots: the sail reefed, the sail luffing, the sheets
 *   straining, and the hull groaning (with the existing wave on the hull, `SFX_WAVE_HULL`).
 * - **The wreck** (`WreckAmbience`, `AMB_SEA_WRECK`): surf breaking on the skerry and washing
 *   back, gulls crying over the wreck, water slopping in the broken hull and its timbers working;
 *   and as one-shots, timber breaking, the hull grinding on the rock, and cries from the wreck in
 *   the survivors' own voices (voice.ts `SEA_VOICES`), wordless and far.
 *
 * Everything is scheduled ahead of the audio clock with seeded random streams, so a render is
 * the same every time; nothing here reads the simulation.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { creak, splash } from './launch.ts';
import { rng } from './samples.ts';
import { noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';
import { SEA_VOICES } from './voice.ts';

/** A level-matched output (a quiet sound brought up to its place among the effects). */
function level(e: SynthEngine, k: number, pan: number, echo: number): GainNode {
  const g = e.ctx.createGain();
  g.gain.value = k;
  g.connect(out(e, 'effects', pan, echo));
  return g;
}

/** Cloth slapping: a run of dull, soft slaps, `n` of them `every` seconds apart, fading. */
function slaps(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  n: number,
  every: number,
  peak: number,
  seed: number,
): number {
  const r = rng(seed);
  let t = at;
  for (let k = 0; k < n; k++) {
    const swell = Math.sin((Math.PI * (k + 0.5)) / n);
    noiseHit(e, t, to, 'lowpass', 700 + r() * 600, 1.1, [
      [0, 0],
      [0.005, peak * (0.35 + 0.65 * swell) * (0.8 + r() * 0.4)],
      [0.06 + r() * 0.03, 0],
    ]);
    t += every * (0.8 + r() * 0.4);
  }
  return t - at;
}

/** A long timber groan: a low resonant scrape with a buzzing undertone, its pitch sagging. */
function groan(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  len: number,
  peak: number,
  hz: number,
): void {
  noiseHit(
    e,
    at,
    to,
    'bandpass',
    hz,
    8,
    [
      [0, 0],
      [len * 0.3, peak],
      [len * 0.75, peak * 0.7],
      [len, 0],
    ],
    hz * 0.72,
  );
  tone(
    e,
    at,
    to,
    'sawtooth',
    [
      [0, hz / 3],
      [len, hz / 4.2],
    ],
    [
      [0, 0],
      [len * 0.3, peak * 0.22],
      [len, 0],
    ],
  );
}

/** A wordless call in a survivor's voice: a held vowel whose pitch lifts and falls, far off. */
function cry(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  hz: number,
  len: number,
  peak: number,
  lift: number,
  vowel: 'o' | 'a',
): void {
  const c = e.ctx;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(hz * 0.92, at);
  o.frequency.linearRampToValueAtTime(hz * lift, at + len * 0.35);
  o.frequency.linearRampToValueAtTime(hz * lift * 0.82, at + len);
  // A tremble in a cold voice.
  const vib = c.createOscillator();
  vib.frequency.value = 5.5;
  const depth = c.createGain();
  depth.gain.value = hz * 0.025;
  vib.connect(depth).connect(o.frequency);
  const g = c.createGain();
  envelope(g.gain, at, [
    [0, 0],
    [0.06, peak],
    [len * 0.7, peak * 0.8],
    [len, 0],
  ]);
  const [f1, f2] = vowel === 'o' ? [520, 880] : [760, 1220];
  for (const [f, q, a] of [
    [f1, 5, 1],
    [f2, 7, 0.55],
  ] as const) {
    const b = c.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = f * (hz > 170 ? 1.08 : 0.94);
    b.Q.value = q;
    const bg = c.createGain();
    bg.gain.value = a;
    o.connect(b).connect(bg).connect(g);
  }
  g.connect(to);
  o.start(at);
  vib.start(at);
  o.stop(at + len + 0.05);
  vib.stop(at + len + 0.05);
}

/** Splintering: a crackle of small cracks closing up into one hard split. */
function splinter(e: SynthEngine, at: number, to: AudioNode, peak: number, seed: number): number {
  const r = rng(seed);
  let t = at;
  const n = 7 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) {
    noiseHit(e, t, to, 'bandpass', 1500 + r() * 2500, 2.2, [
      [0, 0],
      [0.002, peak * (0.3 + 0.5 * (k / n)) * (0.7 + r() * 0.3)],
      [0.025 + r() * 0.03, 0],
    ]);
    t += 0.03 + r() * 0.07;
  }
  // The split: a sharp crack and the wood's low thud as it gives.
  noiseHit(e, t, to, 'highpass', 1200, 0.8, [
    [0, 0],
    [0.002, peak],
    [0.12, 0],
  ]);
  noiseHit(e, t, to, 'lowpass', 320, 0.9, [
    [0, 0],
    [0.01, peak * 0.8],
    [0.3, 0],
  ]);
  return t - at;
}

export const SEA_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_SAIL_REEF',
    captionKey: 'caption.sfx.sail_reef',
    bus: 'effects',
    play: (e, at, pan) => {
      // Reefing: the halyard run out through its sheave, the yard coming down a little, the loose
      // cloth gathered and flogging, the reef points tied off in quick rubs of rope, and the sail
      // set again smaller, its sheets creaking taut.
      const to = level(e, 4.5, pan, 0.12);
      creak(e, at, to, 0.7, 0.16, 420);
      slaps(e, at + 0.45, to, 6, 0.12, 0.34, 5101);
      const r = rng(5102);
      for (let k = 0; k < 4; k++)
        noiseHit(e, at + 1.15 + k * 0.16 + r() * 0.04, to, 'bandpass', 2400 + r() * 800, 1.6, [
          [0, 0],
          [0.02, 0.12],
          [0.09, 0],
        ]);
      creak(e, at + 1.85, to, 0.6, 0.18, 260);
      return 2.6;
    },
  },
  {
    id: 'SFX_SAIL_LUFF',
    captionKey: 'caption.sfx.sail_luff',
    bus: 'effects',
    play: (e, at, pan) => {
      // Luffing: brought up too close, the cloth shivers along its edge in a rapid rattle that
      // swells and dies as she bears away again.
      const to = level(e, 4.5, pan, 0.1);
      const length = slaps(e, at, to, 16, 0.085, 0.22, 5111);
      creak(e, at + length * 0.4, to, 0.5, 0.08, 640);
      return length + 0.25;
    },
  },
  {
    id: 'SFX_SAIL_STRAIN',
    captionKey: 'caption.sfx.sail_strain',
    bus: 'effects',
    play: (e, at, pan) => {
      // A gust in the sail: the cloth booms full, the sheets and stays creak long under the load
      // and the taut rope hums.
      const to = level(e, 3, pan, 0.12);
      noiseHit(
        e,
        at,
        to,
        'lowpass',
        240,
        0.8,
        [
          [0, 0],
          [0.08, 0.4],
          [0.6, 0],
        ],
        120,
      );
      creak(e, at + 0.1, to, 1.3, 0.2, 230);
      creak(e, at + 0.35, to, 0.9, 0.12, 330);
      tone(
        e,
        at + 0.2,
        to,
        'triangle',
        [
          [0, 196],
          [1.1, 207],
        ],
        [
          [0, 0],
          [0.3, 0.035],
          [1.2, 0],
        ],
      );
      return 1.7;
    },
  },
  {
    id: 'SFX_HULL_GROAN',
    captionKey: 'caption.sea.hull_groan',
    bus: 'effects',
    play: (e, at, pan) => {
      // The hull working in a heavy sea: the strakes groaning long against their rivets and
      // lashings, and a treenail's sharp creak at the end.
      const to = level(e, 3.2, pan, 0.2);
      groan(e, at, to, 1.6, 0.3, 170);
      groan(e, at + 0.5, to, 1.3, 0.18, 132);
      creak(e, at + 1.5, to, 0.35, 0.16, 560);
      return 2.1;
    },
  },
  {
    id: 'SFX_WRECK_BREAK',
    captionKey: 'caption.sea.wreck_break',
    bus: 'effects',
    play: (e, at, pan) => {
      // The wreck breaking up on the skerry: a strake splintering, giving with a hard split, and
      // the piece falling into the sea.
      const to = level(e, 2.2, pan, 0.25);
      const split = splinter(e, at, to, 0.5, 5121);
      groan(e, at, to, split + 0.2, 0.12, 210);
      splash(e, at + split + 0.45, to, 0.45, 1.5);
      return split + 1.4;
    },
  },
  {
    id: 'SFX_WRECK_GRIND',
    captionKey: 'caption.sea.wreck_grind',
    bus: 'effects',
    play: (e, at, pan) => {
      // The hull grinding on the rock as the swell lifts it: a long rough scrape with grit in it,
      // the planks groaning, and the water slopping in the broken side.
      const to = level(e, 2.6, pan, 0.2);
      const r = rng(5131);
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        380,
        1.4,
        [
          [0, 0],
          [0.6, 0.38],
          [1.8, 0.3],
          [2.6, 0],
        ],
        260,
      );
      for (let k = 0; k < 26; k++) {
        const t = at + 0.3 + r() * 2.1;
        noiseHit(e, t, to, 'bandpass', 900 + r() * 1800, 3, [
          [0, 0],
          [0.004, 0.1 + r() * 0.1],
          [0.03, 0],
        ]);
      }
      groan(e, at + 0.4, to, 1.8, 0.2, 150);
      noiseHit(e, at + 2.1, to, 'bandpass', 700, 0.9, [
        [0, 0],
        [0.15, 0.2],
        [0.9, 0],
      ]);
      return 3.1;
    },
  },
  {
    id: 'SFX_WRECK_CRIES',
    captionKey: 'caption.sea.wreck_cries',
    bus: 'effects',
    play: (e, at, pan) => {
      // Cries from the wreck: the survivors calling across the water in their own voices, Derbáil
      // first and twice, Fínán's long low call, Ívar's quick one from the shingle; wordless, far,
      // softened by the distance and carried on the echo.
      const lp = e.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      lp.connect(level(e, 2.4, pan, 0.45));
      const v = (key: string, fallback: number): number => SEA_VOICES[key]?.pitch ?? fallback;
      const derbail = v('C_DERBAIL', 190) * 2;
      const finan = v('C_FINAN', 142) * 2;
      const ivar = v('C_IVAR', 166) * 2;
      cry(e, at, lp, derbail, 0.75, 0.32, 1.16, 'o');
      cry(e, at + 0.95, lp, derbail, 0.6, 0.28, 1.12, 'a');
      cry(e, at + 1.5, lp, finan, 1.1, 0.3, 1.08, 'o');
      cry(e, at + 2.55, lp, ivar, 0.4, 0.24, 1.2, 'a');
      cry(e, at + 2.98, lp, ivar, 0.45, 0.22, 1.14, 'o');
      return 3.6;
    },
  },
];

/** The sea's state as the bed plays it (seaAudio.ts `seaBed` makes it from the weather). */
export interface SeaBedState {
  /** The wind in the rigging, 0 (none) to 1 (a storm). */
  readonly wind: number;
  /** The sea's size, 0 (glassy) to 1 (a storm sea). */
  readonly sea: number;
  /** Fog: the wind and the far sea fall to the dead quiet of fog. */
  readonly fog: boolean;
  /** The crew at the oars (the stroke's splash and creak in time). */
  readonly rowing: boolean;
  /** Under way (water along the strakes, the sail's sounds); false at anchor or held. */
  readonly moving: boolean;
  readonly storm: boolean;
}

const QUIET: SeaBedState = {
  wind: 0.3,
  sea: 0.3,
  fog: false,
  rowing: true,
  moving: true,
  storm: false,
};

/** The sea's bed under the sea map (`AMB_WIND_RIGGING`, `AMB_FOG_QUIET`). */
export class SeaAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(5201);
  readonly #out: GainNode;
  readonly #swellTone: BiquadFilterNode;
  readonly #swellGain: GainNode;
  readonly #washGain: GainNode;
  readonly #windBand: BiquadFilterNode;
  readonly #windGain: GainNode;
  readonly #stays: { band: BiquadFilterNode; gain: GainNode; hz: number }[] = [];
  readonly #sources: AudioScheduledSourceNode[] = [];
  #state: SeaBedState = QUIET;
  #running = false;
  #nextWave = 0;
  #nextGust = 0;
  #nextSail = 0;
  #nextGroan = 0;
  #nextDrip = 0;
  /** The stroke's grid: a stroke every `strokeSeconds` from `strokeFrom` (the music's bar line). */
  #strokeSeconds = 1.875;
  #strokeFrom = 0;
  #nextStroke = 0;

  constructor(engine: SynthEngine) {
    this.#e = engine;
    const c = engine.ctx;
    this.#out = c.createGain();
    this.#out.connect(engine.buses.ambience);
    this.#swellTone = c.createBiquadFilter();
    this.#swellTone.type = 'lowpass';
    this.#swellTone.Q.value = 0.5;
    this.#swellGain = c.createGain();
    this.#swellTone.connect(this.#swellGain).connect(this.#out);
    this.#washGain = c.createGain();
    this.#windBand = c.createBiquadFilter();
    this.#windBand.type = 'bandpass';
    this.#windBand.Q.value = 0.9;
    this.#windGain = c.createGain();
    this.#windBand.connect(this.#windGain).connect(this.#out);
    // Two stays whistling a little apart, as rigging does.
    for (const hz of [610, 905]) {
      const band = c.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 14;
      band.frequency.value = hz;
      const gain = c.createGain();
      gain.gain.value = 0;
      band.connect(gain).connect(this.#out);
      this.#stays.push({ band, gain, hz });
    }
  }

  start(at: number): void {
    const e = this.#e;
    const c = e.ctx;
    const swell = e.noise(at, true);
    swell.connect(this.#swellTone);
    // The swell's slow breathing: a sine far below hearing moving the bed's level.
    const lfo = c.createOscillator();
    lfo.frequency.value = 1 / 7.5;
    const depth = c.createGain();
    depth.gain.value = 0.05;
    lfo.connect(depth).connect(this.#swellGain.gain);
    lfo.start(at);
    const wash = e.noise(at + 0.41, false);
    const washBand = c.createBiquadFilter();
    washBand.type = 'bandpass';
    washBand.frequency.value = 1100;
    washBand.Q.value = 0.7;
    wash.connect(washBand).connect(this.#washGain).connect(this.#out);
    const wind = e.noise(at + 0.23, true);
    wind.connect(this.#windBand);
    const whistle = e.noise(at + 0.67, false);
    for (const s of this.#stays) whistle.connect(s.band);
    this.#sources.push(swell, lfo, wash, wind, whistle);
    this.#out.gain.setValueAtTime(0, at);
    // Ambience sits under the music (Book 11 section 09: about -22 dBFS).
    this.#out.gain.linearRampToValueAtTime(0.8, at + 2);
    this.#nextWave = at + 0.8;
    this.#nextGust = at + 2;
    this.#nextSail = at + 3;
    this.#nextGroan = at + 1.5;
    this.#nextDrip = at + 1;
    this.#nextStroke = Math.max(at, this.#strokeFrom);
    this.#running = true;
    this.#apply(at);
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.6);
    for (const s of this.#sources) s.stop(at + 3);
  }

  setState(state: SeaBedState, at = this.#e.ctx.currentTime): void {
    this.#state = state;
    this.#apply(at);
  }

  /** Rows in time with the music: a stroke every `seconds` from `from` (its bar line). */
  setStroke(seconds: number, from: number): void {
    if (seconds <= 0) return;
    this.#strokeSeconds = seconds;
    this.#strokeFrom = from;
    if (this.#running) {
      // The next stroke on the new grid.
      const now = this.#nextStroke;
      const k = Math.ceil((now - from) / seconds - 1e-9);
      this.#nextStroke = from + Math.max(0, k) * seconds;
    }
  }

  /** The wind actually in the rigging: in fog it falls nearly away. */
  #wind(): number {
    return this.#state.fog ? this.#state.wind * 0.2 : this.#state.wind;
  }

  #apply(at: number): void {
    const s = this.#state;
    const w = this.#wind();
    const sea = s.fog ? s.sea * 0.4 : s.sea;
    // The far swell: low and wide; in fog only the near water is heard, dull and close.
    this.#swellTone.frequency.setTargetAtTime(s.fog ? 160 : 140 + 420 * sea, at, 1.2);
    this.#swellGain.gain.setTargetAtTime(0.1 + 0.14 * sea, at, 1.2);
    this.#washGain.gain.setTargetAtTime(s.moving ? 0.025 + 0.05 * sea : 0.01, at, 1);
    this.#windBand.frequency.setTargetAtTime(300 + 850 * w, at, 0.8);
    this.#windGain.gain.setTargetAtTime(0.015 + 0.18 * w, at, 0.8);
    for (const st of this.#stays) {
      st.band.frequency.setTargetAtTime(st.hz * (0.85 + 0.45 * w), at, 0.8);
      st.gain.gain.setTargetAtTime(0.12 * Math.max(0, w - 0.3), at, 0.8);
    }
  }

  schedule(until: number): void {
    if (!this.#running) return;
    const e = this.#e;
    const s = this.#state;
    const to = this.#out;
    const w = this.#wind();
    // Waves on the hull, panned to the side they strike: small slaps, heavier with the sea, a
    // boom and a hiss of spray in a storm.
    while (this.#nextWave < until) {
      const at = this.#nextWave;
      const pan = (this.#r() - 0.5) * 1.4;
      const p = e.ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(to);
      const sea = s.fog ? s.sea * 0.4 : s.sea;
      noiseHit(e, at, p, 'lowpass', 260 + 300 * sea, 0.8, [
        [0, 0],
        [0.03, 0.12 + 0.3 * sea],
        [0.35 + 0.4 * sea, 0],
      ]);
      noiseHit(e, at + 0.05, p, 'bandpass', 1800, 0.7, [
        [0, 0],
        [0.08, 0.03 + 0.08 * sea],
        [0.6 + 0.5 * sea, 0],
      ]);
      if (s.storm)
        tone(
          e,
          at,
          p,
          'sine',
          [
            [0, 66],
            [0.35, 42],
          ],
          [
            [0, 0],
            [0.02, 0.32],
            [0.55, 0],
          ],
        );
      this.#nextWave += (s.storm ? 2.2 : 3.2 - 1.2 * sea) * (0.7 + this.#r() * 0.8);
    }
    // Gusts: the wind in the rigging lifts and opens, then settles.
    while (this.#nextGust < until) {
      const at = this.#nextGust;
      if (w > 0.15) {
        const lift = 1 + 0.6 * this.#r();
        this.#windGain.gain.setTargetAtTime((0.015 + 0.18 * w) * lift, at, 0.5);
        this.#windGain.gain.setTargetAtTime(0.015 + 0.18 * w, at + 1.2 + this.#r(), 0.9);
        this.#windBand.frequency.setTargetAtTime(
          (300 + 850 * w) * (1 + 0.25 * (lift - 1)),
          at,
          0.6,
        );
        this.#windBand.frequency.setTargetAtTime(300 + 850 * w, at + 1.4, 1);
      }
      this.#nextGust += 3 + this.#r() * 6;
    }
    // The oars: the blades' splash at the catch on each stroke and the creak on the recovery.
    while (this.#nextStroke < until) {
      const at = this.#nextStroke;
      if (s.rowing && s.moving) {
        for (let k = 0; k < 3; k++)
          splash(e, at + this.#r() * 0.05, to, 0.07 + this.#r() * 0.03, 0.75);
        creak(e, at + this.#strokeSeconds * 0.5, to, 0.26, 0.05, 520 + this.#r() * 80);
      }
      this.#nextStroke += this.#strokeSeconds;
    }
    // Under sail: the sheets straining now and then, and in light airs the cloth luffing.
    while (this.#nextSail < until) {
      const at = this.#nextSail;
      if (s.moving && !s.rowing && !s.fog) {
        if (w < 0.4) slaps(e, at, to, 8, 0.1, 0.05, 5211 + Math.floor(at));
        else creak(e, at, to, 1.1, 0.05 + 0.04 * w, 240 + this.#r() * 60);
      }
      this.#nextSail += 5 + this.#r() * 7;
    }
    // The hull groaning in a storm, with every heavy sea.
    while (this.#nextGroan < until) {
      const at = this.#nextGroan;
      if (s.storm) groan(e, at, to, 1.4 + this.#r() * 0.6, 0.12, 150 + this.#r() * 50);
      else if (s.fog) creak(e, at, to, 0.4, 0.025, 600 + this.#r() * 120);
      this.#nextGroan += s.storm ? 3.5 + this.#r() * 2.5 : 6 + this.#r() * 6;
    }
    // In fog, the quiet is close: a drip from the rigging, water lapping at the planks.
    while (this.#nextDrip < until) {
      const at = this.#nextDrip;
      if (s.fog) {
        tone(
          e,
          at,
          to,
          'sine',
          [
            [0, 1300 + this.#r() * 500],
            [0.05, 650],
          ],
          [
            [0, 0],
            [0.004, 0.05],
            [0.09, 0],
          ],
        );
        noiseHit(e, at + 0.3, to, 'bandpass', 600, 1.2, [
          [0, 0],
          [0.12, 0.05],
          [0.5, 0],
        ]);
      }
      this.#nextDrip += 1.2 + this.#r() * 2.5;
    }
  }
}

/** The wreck on its skerry (`AMB_SEA_WRECK`): surf, gulls, the broken hull working. */
export class WreckAmbience {
  readonly #e: SynthEngine;
  readonly #r = rng(5301);
  readonly #out: GainNode;
  readonly #pan: StereoPannerNode;
  readonly #sources: AudioScheduledSourceNode[] = [];
  #running = false;
  #nextSurf = 0;
  #nextGull = 0;
  #nextWork = 0;

  constructor(engine: SynthEngine) {
    this.#e = engine;
    const c = engine.ctx;
    this.#out = c.createGain();
    this.#pan = c.createStereoPanner();
    this.#pan.connect(this.#out).connect(engine.buses.ambience);
  }

  /** Where the wreck lies, -1 (left) to 1 (right) of the listener. */
  setSide(side: number, at = this.#e.ctx.currentTime): void {
    this.#pan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, side * 0.7)), at, 0.4);
  }

  start(at: number): void {
    const e = this.#e;
    const c = e.ctx;
    // The sea round the skerry, never still.
    const bed = e.noise(at, true);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0.2;
    bed.connect(lp).connect(g).connect(this.#pan);
    this.#sources.push(bed);
    this.#out.gain.setValueAtTime(0, at);
    this.#out.gain.linearRampToValueAtTime(1, at + 1.5);
    this.#nextSurf = at + 0.4;
    this.#nextGull = at + 1.2;
    this.#nextWork = at + 3;
    this.#running = true;
  }

  stop(at: number): void {
    this.#running = false;
    this.#out.gain.setTargetAtTime(0, at, 0.5);
    for (const s of this.#sources) s.stop(at + 2.5);
  }

  schedule(until: number): void {
    if (!this.#running) return;
    const e = this.#e;
    const to = this.#pan;
    // Surf breaking on the skerry: the swell heaving up, a heavy break and its wash draining
    // back off the rock through the weed.
    while (this.#nextSurf < until) {
      const at = this.#nextSurf;
      const big = 0.7 + this.#r() * 0.3;
      noiseHit(e, at, to, 'lowpass', 300, 0.6, [
        [0, 0],
        [1.2, 0.22 * big],
        [1.5, 0.5 * big],
        [2.4, 0.25 * big],
        [4.2, 0],
      ]);
      noiseHit(e, at + 1.45, to, 'highpass', 2400, 0.6, [
        [0, 0],
        [0.1, 0.12 * big],
        [1.1, 0],
      ]);
      noiseHit(e, at + 2.2, to, 'bandpass', 1400, 0.8, [
        [0, 0],
        [0.4, 0.08 * big],
        [2, 0],
      ]);
      this.#nextSurf += 5.2 * (0.85 + this.#r() * 0.3);
    }
    // Gulls over the wreck, crying more often than on the strand.
    while (this.#nextGull < until) {
      const at = this.#nextGull;
      const calls = 1 + Math.floor(this.#r() * 3);
      const pan = (this.#r() - 0.5) * 1.6;
      for (let k = 0; k < calls; k++) {
        const src = e.sampleSource('gull', 1760 * 2 ** ((this.#r() * 6 - 2) / 12));
        const g = e.ctx.createGain();
        g.gain.value = 0.07 + this.#r() * 0.06;
        const p = e.ctx.createStereoPanner();
        p.pan.value = pan;
        src.connect(g).connect(p).connect(this.#out);
        const send = e.ctx.createGain();
        send.gain.value = 0.3;
        g.connect(send).connect(e.echoIn);
        src.start(at + k * (0.4 + this.#r() * 0.25));
      }
      this.#nextGull += 2.5 + this.#r() * 5;
    }
    // The broken hull working on the rock: water slopping inside it, a plank's creak.
    while (this.#nextWork < until) {
      const at = this.#nextWork;
      noiseHit(e, at, to, 'bandpass', 650 + this.#r() * 300, 1, [
        [0, 0],
        [0.15, 0.08],
        [0.7, 0],
      ]);
      creak(e, at + 0.4, to, 0.7, 0.05, 260 + this.#r() * 90);
      this.#nextWork += 4 + this.#r() * 5;
    }
  }
}

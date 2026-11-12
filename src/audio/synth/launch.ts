/**
 * Stage 12's sounds (Book 11 sections 03, 07 and 12), generated in code like every sound in the
 * game: the keel grinding down its skids into the water, the oars' creak and splash in time with
 * the stroke, the sail flapping as it drops and filling with a crack, and the chapter's end. Each
 * has its caption (content/audio.json); the launch's music is note data (content/music/ship.json).
 * Everything is scheduled ahead of the audio clock with seeded random streams.
 */
import { envelope } from './engine.ts';
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** A creak of wood working on wood or rope: a narrow, wavering band of noise. */
function creak(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  len: number,
  level: number,
  hz: number,
): void {
  const src = e.noise(at, true);
  const f = e.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 16;
  f.frequency.setValueAtTime(hz, at);
  f.frequency.linearRampToValueAtTime(hz * 1.45, at + len * 0.55);
  f.frequency.linearRampToValueAtTime(hz * 0.9, at + len);
  const g = e.ctx.createGain();
  envelope(g.gain, at, [
    [0, 0],
    [0.04, level],
    [len - 0.04, level * 0.8],
    [len, 0],
  ]);
  src.connect(f).connect(g).connect(to);
  src.stop(at + len + 0.05);
}

/** A splash: a hiss of water with a low plop under it. */
function splash(e: SynthEngine, at: number, to: AudioNode, level: number, size = 1): void {
  noiseHit(e, at, to, 'bandpass', 2600, 0.8, [
    [0, 0],
    [0.01, level],
    [0.18 * size, level * 0.3],
    [0.45 * size, 0],
  ]);
  tone(
    e,
    at,
    to,
    'sine',
    [
      [0, 260],
      [0.12, 120],
    ],
    [
      [0, 0],
      [0.005, level * 0.7],
      [0.16, 0],
    ],
  );
}

export const LAUNCH_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_BEACHING',
    captionKey: 'caption.sfx.beaching',
    bus: 'effects',
    play: (e, at, pan) => {
      // The keel grinding down its skids over the shingle: a low rumbling scrape with stones
      // rattling away from it, the timbers creaking under the strain, then the bow taking water.
      const to = out(e, 'effects', pan, 0.1);
      const r = rng(1211);
      noiseHit(
        e,
        at,
        to,
        'lowpass',
        420,
        0.9,
        [
          [0, 0],
          [0.15, 0.55],
          [1.3, 0.45],
          [1.7, 0],
        ],
        180,
      );
      for (let k = 0; k < 18; k++) {
        const t = at + 0.1 + r() * 1.5;
        noiseHit(e, t, to, 'bandpass', 1800 + r() * 2200, 3, [
          [0, 0],
          [0.004, 0.18 + r() * 0.16],
          [0.05, 0],
        ]);
      }
      creak(e, at + 0.3, to, 0.7, 0.22, 300);
      creak(e, at + 1.0, to, 0.6, 0.18, 360);
      splash(e, at + 1.55, to, 0.5, 1.6);
      return 2.3;
    },
  },
  {
    id: 'SFX_OAR_CREAK',
    captionKey: 'caption.sfx.oar_creak',
    bus: 'effects',
    play: (e, at, pan) => {
      // Oars working against their thole pins on the recovery, staggered a little along the boat.
      const to = out(e, 'effects', pan, 0.05);
      const r = rng(1212);
      for (let k = 0; k < 3; k++) creak(e, at + k * 0.05 + r() * 0.03, to, 0.24, 0.16, 520 + k * 60);
      return 0.45;
    },
  },
  {
    id: 'SFX_OAR_SPLASH',
    captionKey: 'caption.sfx.oar_splash',
    bus: 'effects',
    play: (e, at, pan) => {
      // The blades biting together at the catch, a ragged chord of splashes, then the run of water
      // off them on the drive.
      const to = out(e, 'effects', pan, 0.12);
      const r = rng(1213);
      for (let k = 0; k < 4; k++) splash(e, at + r() * 0.06, to, 0.32 + r() * 0.08, 0.8);
      noiseHit(e, at + 0.12, to, 'highpass', 3000, 0.7, [
        [0, 0],
        [0.1, 0.08],
        [0.55, 0],
      ]);
      return 0.75;
    },
  },
  {
    id: 'SFX_SAIL_FLAP',
    captionKey: 'caption.sfx.sail_flap',
    bus: 'effects',
    play: (e, at, pan) => {
      // Wool cloth flogging as the yard goes up and the sail drops loose: quick dull slaps.
      const to = out(e, 'effects', pan, 0.08);
      const r = rng(1214);
      let t = at;
      for (let k = 0; k < 9; k++) {
        noiseHit(e, t, to, 'lowpass', 900 + r() * 500, 1.2, [
          [0, 0],
          [0.006, 0.42 - k * 0.025],
          [0.09, 0],
        ]);
        t += 0.11 + r() * 0.12;
      }
      creak(e, at + 0.2, to, 0.9, 0.12, 700);
      return t - at + 0.2;
    },
  },
  {
    id: 'SFX_SAIL_FILL',
    captionKey: 'caption.sfx.sail_fill',
    bus: 'effects',
    play: (e, at, pan) => {
      // The wind takes the sail: a sharp crack of cloth snapping taut, a deep whump as it fills,
      // and the sheets and stays groaning as they take the strain.
      const to = out(e, 'effects', pan, 0.15);
      noiseHit(e, at, to, 'bandpass', 1400, 1.4, [
        [0, 0],
        [0.003, 0.7],
        [0.06, 0],
      ]);
      noiseHit(
        e,
        at + 0.02,
        to,
        'lowpass',
        260,
        0.8,
        [
          [0, 0],
          [0.05, 0.6],
          [0.5, 0],
        ],
        120,
      );
      creak(e, at + 0.25, to, 1.1, 0.2, 240);
      return 1.4;
    },
  },
  {
    id: 'MUS_STINGER_CHAPTER_END',
    captionKey: 'caption.stinger.chapter_end',
    bus: 'music',
    play: (e, at, pan) => {
      // The chapter's end (Book 11 section 03, stingers): the horn calls twice over a slow roll of
      // the frame drum, and the household's chord rises to rest on D (Dorian). 8 beats at 72.
      const to = e.ctx.createGain();
      to.gain.value = 2.6;
      to.connect(out(e, 'music', pan, 0.4));
      const beat = 60 / 72;
      e.playNote('horn', 50, at, beat * 1.4, 0.8, to, 0);
      e.playNote('horn', 57, at + beat * 1.5, beat * 2.2, 0.85, to, 0);
      for (let k = 0; k < 6; k++) e.playNote('drum', 38, at + k * beat * 0.5, 0.4, 0.5 + k * 0.08, to);
      e.playNote('drum', 38, at + beat * 4, 0.6, 1, to);
      for (const m of [50, 57, 62]) e.playNote('pad', m, at + beat * 3.5, beat * 4.5, 0.55, to);
      e.playNote('lyre', 74, at + beat * 4, beat * 2, 0.5, to);
      e.playNote('drone', 38, at, beat * 8, 0.35, to);
      return beat * 8 + 0.5;
    },
  },
];

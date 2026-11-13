/**
 * The user's third playtest's story sounds (Book 11 sections 03 and 07; decisions DG-12, DG-14 and
 * DG-29), generated like every other sound (Book 11 section 12):
 *
 * - **The shelter's frame** (`SFX_SHELTER_FRAME`): oars knocked together as they are stood up, the
 *   lashing drawn tight with a creak where the ridge crosses them, and pegs driven into the turf
 *   with a stone, across the stage's 5 s work loop.
 * - **The body taken** (`SFX_BODY_TAKEN`): the surf's wash rising wave by wave, each a deeper boom
 *   and a longer hiss of foam, 2.6 s apart (Book 10 seaWaves); the bier's planks knocking on the
 *   shingle as the third lifts it, then quiet; a slap of water on the cloak as it drifts.
 * - **The sinking** (`SFX_BODY_SINK`): a deep swallowing gulp and a fizz of bubbles, then only the
 *   surf and the gulls.
 * - **The lament's sea ending** (`MUS_LAMENT_SEA`): Thorkel's lament holds a single keening note as
 *   the bier is borne down, thins to the drone as the waves come in, and its last note ends with
 *   the sink (no stinger).
 *
 * The rhythms are Book 10's: the cue lengths are set by the scene's timeline, passed in when the
 * sounds are made (src/sim/narrative/seaBurial.ts). Seen, so not captioned (the audit).
 */
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** A wooden knock: oar on oar, plank on stone. */
function knock(e: SynthEngine, at: number, to: AudioNode, hz: number, level: number): void {
  tone(
    e,
    at,
    to,
    'triangle',
    [
      [0, hz * 1.7],
      [0.03, hz],
    ],
    [
      [0, 0],
      [0.003, level],
      [0.14, 0],
    ],
  );
  noiseHit(e, at, to, 'bandpass', 1500, 2.5, [
    [0, 0],
    [0.002, level * 0.55],
    [0.035, 0],
  ]);
}

/** A rope drawn tight: a narrow band of noise rising as it takes the strain. */
function creak(e: SynthEngine, at: number, to: AudioNode, len: number, level: number): void {
  noiseHit(
    e,
    at,
    to,
    'bandpass',
    360,
    7,
    [
      [0, 0],
      [0.05, level],
      [len * 0.7, level * 1.4],
      [len, 0],
    ],
    720,
  );
}

/** One wave's wash: a boom as it breaks, and a hiss of foam running up and drawing back. */
function wash(e: SynthEngine, at: number, to: AudioNode, k: number): void {
  const boom = 0.32 + k * 0.08;
  tone(
    e,
    at,
    to,
    'sine',
    [
      [0, 64 - k * 6],
      [0.5, 42 - k * 4],
    ],
    [
      [0, 0],
      [0.06, boom],
      [0.9 + k * 0.2, 0],
    ],
  );
  noiseHit(e, at, to, 'lowpass', 380, 0.6, [
    [0, 0],
    [0.08, 0.32 + k * 0.06],
    [0.7, 0.12],
    [1.1 + k * 0.2, 0],
  ]);
  // The foam's hiss, longer each wave, running up the shingle and back.
  noiseHit(
    e,
    at + 0.15,
    to,
    'highpass',
    2600,
    0.7,
    [
      [0, 0],
      [0.25, 0.1 + k * 0.03],
      [1.0 + k * 0.4, 0.06],
      [1.8 + k * 0.5, 0],
    ],
    1400,
  );
}

export const STORY3_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_SHELTER_FRAME',
    captionKey: 'caption.sfx.shelter_frame',
    bus: 'effects',
    play: (e, at, pan) => {
      // Across the frame's 5 s: an oar stood up and knocked against the wall-head, the second
      // knocked against it, the ridge laid across, the lashings drawn tight, the pegs driven.
      const to = out(e, 'effects', pan, 0.12);
      knock(e, at + 0.2, to, 150, 0.4);
      knock(e, at + 0.35, to, 170, 0.22);
      knock(e, at + 1.2, to, 140, 0.4);
      knock(e, at + 1.32, to, 160, 0.2);
      knock(e, at + 2.1, to, 120, 0.45);
      creak(e, at + 2.5, to, 0.6, 0.12);
      creak(e, at + 3.2, to, 0.5, 0.11);
      for (let k = 0; k < 4; k++) knock(e, at + 3.9 + k * 0.22, to, 95 - k * 4, 0.32);
      return 5;
    },
  },
  {
    id: 'SFX_BODY_TAKEN',
    captionKey: 'caption.sfx.body_taken',
    bus: 'effects',
    play: (e, at, pan) => {
      // The three waves 2.6 s apart (Book 10 seaWaves), each deeper and longer; the planks
      // knocking on the stones as the third lifts the bier, then quiet; a slap on the cloak.
      const to = out(e, 'effects', pan, 0.3);
      const r = rng(3301);
      for (let k = 0; k < 3; k++) wash(e, at + k * 2.6, to, k);
      for (let k = 0; k < 5; k++)
        knock(e, at + 5.3 + k * 0.17 + r() * 0.05, to, 110 + r() * 30, 0.3 - k * 0.05);
      for (const s of [7.9, 9.6, 11.0])
        noiseHit(e, at + s, to, 'bandpass', 700, 1.2, [
          [0, 0],
          [0.01, 0.16],
          [0.18, 0],
        ]);
      return 12;
    },
  },
  {
    id: 'SFX_BODY_SINK',
    captionKey: 'caption.sfx.body_sink',
    bus: 'effects',
    play: (e, at, pan) => {
      // A deep swallowing gulp as the water closes over, then a fizz of bubbles rising.
      const to = out(e, 'effects', pan, 0.35);
      tone(
        e,
        at + 0.4,
        to,
        'sine',
        [
          [0, 120],
          [0.25, 46],
        ],
        [
          [0, 0],
          [0.03, 0.55],
          [0.5, 0],
        ],
      );
      noiseHit(e, at + 0.4, to, 'lowpass', 300, 1.5, [
        [0, 0],
        [0.04, 0.3],
        [0.5, 0],
      ]);
      const r = rng(3307);
      for (let k = 0; k < 22; k++)
        tone(
          e,
          at + 0.6 + r() * 1.6,
          to,
          'sine',
          [
            [0, 600 + r() * 900],
            [0.05, 1200 + r() * 1400],
          ],
          [
            [0, 0],
            [0.005, 0.05 + r() * 0.04],
            [0.06, 0],
          ],
        );
      noiseHit(e, at + 0.5, to, 'highpass', 3000, 0.7, [
        [0, 0],
        [0.3, 0.06],
        [1.8, 0],
      ]);
      return 2.6;
    },
  },
  {
    id: 'MUS_LAMENT_SEA',
    captionKey: 'caption.music.lament_sea',
    bus: 'music',
    play: (e, at, pan) => {
      // The lament's ending at the sea (Book 11 section 03): one keening note held as the bier is
      // borne down (4 s), thinning to the drone through the waves, its last note ending with the
      // sink, 19.2 s on (Book 10's timeline: the bier, three waves, the backwash, the drift, the
      // sink). D Aeolian like the lament, no stinger.
      const to = e.ctx.createGain();
      to.gain.value = 4.2;
      to.connect(out(e, 'music', pan, 0.45));
      e.playNote('pad', 69, at, 4.2, 0.55, to);
      e.playNote('pad', 62, at + 4.0, 3.0, 0.3, to);
      e.playNote('lyre', 50, at + 4.0, 1.2, 0.3, to);
      e.playNote('drone', 38, at, 15.0, 0.3, to);
      e.playNote('drone', 45, at + 7.0, 8.0, 0.16, to);
      // The last note, low and soft, ending as he goes under.
      const end = e.playNote('pad', 62, at + 15.2, 4.0, 0.25, to);
      return end - at + 0.3;
    },
  },
];

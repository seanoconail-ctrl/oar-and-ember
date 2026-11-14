/**
 * The movement verbs' sounds (Stage 14; Book 11 sections 07 and 12; decision S14-61), generated in
 * code like every effect:
 *
 * - **A hand-hold taken** (`SFX_CLIMB_HOLD`): fingers biting into a crack, a little grit falling and
 *   a shoe scuffing for the next hold.
 * - **The climb's strain** (`SFX_CLIMB_STRAIN`): a held, effortful breath pushed out through the
 *   teeth as the body is hauled up, with the shoulders' creak of leather; the steerer's breath,
 *   never a voice (Book 11 section 12: the steerer has no voice blip).
 * - **The slide** (`SFX_CLIMB_SLIDE`): the grip going, hands and shoes scrabbling down the face in a
 *   rattle of grit and small stones, falling away.
 * - **A swim stroke** (`SFX_SWIM_STROKE`): an arm reaching over and pulling through, a soft slap and
 *   the water's swirl after it.
 * - **Sinking** (`SFX_SINK`): water closing over the mouth, a choked gulp and bubbles rising.
 * - **The gasp** (`SFX_SINK_GASP`): head up out of it, a ragged in-breath and a cough of water.
 * - **The crawl** (`SFX_CRAWL`): knees and palms shuffling on damp rock, cloth dragging.
 * - **Stone scraping** (`SFX_STONE_SCRAPE`): a heavy stone ground along stone, a low grating with
 *   small chatters as it catches.
 * - **The jump's landing** (`SFX_JUMP_LAND`): both feet coming down together, a thud and a scuff.
 *
 * Each has its information caption (`caption.sfx.*`); all are seen in the steerer's frames, so the
 * audit keeps them off the screen (src/ui/textAudit.ts), except the sinking, whose safety line
 * says what to do (`caption.traverse.sinking`).
 */
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { breath, noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** A few grains of grit trickling down rock. */
function grit(e: SynthEngine, at: number, to: AudioNode, n: number, seed: number, level: number): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++)
    noiseHit(e, at + i * 0.035 + r() * 0.05, to, 'bandpass', 3800 + r() * 2600, 9, [
      [0, 0],
      [0.002, level * (0.5 + r() * 0.5)],
      [0.025, 0],
    ]);
}

/** A soft slap of a hand or arm on water, and the swirl after it. */
function slap(e: SynthEngine, at: number, to: AudioNode, level: number, hz = 900): void {
  noiseHit(e, at, to, 'bandpass', hz, 1.4, [
    [0, 0],
    [0.006, level],
    [0.09, level * 0.25],
    [0.32, 0],
  ], hz * 0.55);
  noiseHit(e, at + 0.08, to, 'lowpass', 600, 0.7, [
    [0, 0],
    [0.12, level * 0.35],
    [0.5, 0],
  ]);
}

/** Bubbles rising: small pitched blips going up. */
function bubbles(e: SynthEngine, at: number, to: AudioNode, n: number, seed: number, level: number): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const t = at + i * 0.06 + r() * 0.05;
    const f = 380 + r() * 520;
    tone(
      e,
      t,
      to,
      'sine',
      [
        [0, f],
        [0.05, f * 1.9],
      ],
      [
        [0, 0],
        [0.004, level * (0.4 + r() * 0.6)],
        [0.06, 0.0001],
      ],
    );
  }
}

export const TRAVERSE_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_CLIMB_HOLD',
    captionKey: 'caption.sfx.climb_hold',
    bus: 'effects',
    play: (e, at, pan) => {
      // Fingers into a crack (a dry, close scrape), grit trickling, a shoe finding the next hold.
      const to = out(e, 'effects', pan, 0.12);
      noiseHit(e, at, to, 'bandpass', 2600, 2.5, [
        [0, 0],
        [0.01, 0.2],
        [0.07, 0],
      ], 1500);
      grit(e, at + 0.05, to, 5, 141, 0.09);
      noiseHit(e, at + 0.22, to, 'bandpass', 900, 1.6, [
        [0, 0],
        [0.015, 0.16],
        [0.11, 0],
      ]);
      return 0.45;
    },
  },
  {
    id: 'SFX_CLIMB_STRAIN',
    captionKey: 'caption.sfx.climb_strain',
    bus: 'effects',
    play: (e, at, pan) => {
      // A breath held and pushed out through the teeth under load, then a short recovery breath.
      const to = out(e, 'effects', pan, 0.1);
      noiseHit(e, at, to, 'bandpass', 2900, 3, [
        [0, 0],
        [0.08, 0.05],
        [0.42, 0.11],
        [0.5, 0],
      ]);
      breath(e, at + 0.04, to, 0.46, 0.06, 760);
      breath(e, at + 0.62, to, 0.34, 0.07, 1250);
      // The leather of the belt and shoes creaking under the pull.
      tone(
        e,
        at + 0.18,
        to,
        'sawtooth',
        [
          [0, 140],
          [0.12, 118],
        ],
        [
          [0, 0],
          [0.02, 0.025],
          [0.14, 0.0001],
        ],
      );
      return 1.0;
    },
  },
  {
    id: 'SFX_CLIMB_SLIDE',
    captionKey: 'caption.sfx.climb_slide',
    bus: 'effects',
    play: (e, at, pan) => {
      // The grip goes: a sharp scrabble, then a long rattling slither of grit down the face.
      const to = out(e, 'effects', pan, 0.2);
      noiseHit(e, at, to, 'bandpass', 2200, 1.8, [
        [0, 0],
        [0.01, 0.26],
        [0.12, 0.05],
      ]);
      noiseHit(e, at + 0.08, to, 'bandpass', 1700, 0.9, [
        [0, 0],
        [0.15, 0.16],
        [1.1, 0.09],
        [1.6, 0],
      ], 700);
      grit(e, at + 0.1, to, 28, 142, 0.12);
      return 1.7;
    },
  },
  {
    id: 'SFX_SWIM_STROKE',
    captionKey: 'caption.sfx.swim_stroke',
    bus: 'effects',
    play: (e, at, pan) => {
      // An arm over and in: the slap, the pull through and the swirl, and the other arm's softer.
      const to = out(e, 'effects', pan, 0.18);
      slap(e, at, to, 0.22);
      slap(e, at + 0.34, to, 0.13, 1100);
      return 0.9;
    },
  },
  {
    id: 'SFX_SINK',
    captionKey: 'caption.sfx.sink',
    bus: 'effects',
    play: (e, at, pan) => {
      // A thrash at the surface, the water closing over with a choked gulp, bubbles rising.
      const to = out(e, 'effects', pan, 0.3);
      slap(e, at, to, 0.24, 1300);
      slap(e, at + 0.18, to, 0.2, 800);
      tone(
        e,
        at + 0.38,
        to,
        'sine',
        [
          [0, 210],
          [0.18, 70],
        ],
        [
          [0, 0],
          [0.02, 0.32],
          [0.26, 0.0001],
        ],
      );
      noiseHit(e, at + 0.38, to, 'lowpass', 420, 0.8, [
        [0, 0],
        [0.05, 0.2],
        [0.5, 0],
      ]);
      bubbles(e, at + 0.6, to, 12, 143, 0.12);
      return 1.6;
    },
  },
  {
    id: 'SFX_SINK_GASP',
    captionKey: 'caption.sfx.sink_gasp',
    bus: 'effects',
    play: (e, at, pan) => {
      // Up out of it: water streaming off, a ragged in-breath, a cough.
      const to = out(e, 'effects', pan, 0.12);
      noiseHit(e, at, to, 'bandpass', 1500, 0.8, [
        [0, 0],
        [0.04, 0.16],
        [0.4, 0],
      ], 600);
      noiseHit(e, at + 0.12, to, 'bandpass', 1900, 2.2, [
        [0, 0],
        [0.05, 0.14],
        [0.24, 0.1],
        [0.32, 0],
      ], 2600);
      // The cough: two short bursts low in the throat.
      for (const d of [0.5, 0.68])
        noiseHit(e, at + d, to, 'bandpass', 620, 2.0, [
          [0, 0],
          [0.008, 0.2],
          [0.09, 0],
        ]);
      return 0.95;
    },
  },
  {
    id: 'SFX_CRAWL',
    captionKey: 'caption.sfx.crawl',
    bus: 'effects',
    play: (e, at, pan) => {
      // A palm and a knee on damp rock, the cloth dragging between.
      const to = out(e, 'effects', pan, 0.25);
      for (const [d, hz, lvl] of [
        [0, 1300, 0.13],
        [0.22, 700, 0.15],
      ] as const)
        noiseHit(e, at + d, to, 'bandpass', hz, 1.8, [
          [0, 0],
          [0.012, lvl],
          [0.1, 0],
        ]);
      noiseHit(e, at + 0.05, to, 'bandpass', 2400, 0.7, [
        [0, 0],
        [0.1, 0.05],
        [0.36, 0],
      ]);
      return 0.5;
    },
  },
  {
    id: 'SFX_STONE_SCRAPE',
    captionKey: 'caption.sfx.stone_scrape',
    bus: 'effects',
    play: (e, at, pan) => {
      // Stone ground along stone for the step's length: a low grating with catches in it.
      const to = out(e, 'effects', pan, 0.28);
      noiseHit(e, at, to, 'bandpass', 260, 1.1, [
        [0, 0],
        [0.12, 0.3],
        [1.0, 0.26],
        [1.25, 0],
      ], 200);
      noiseHit(e, at, to, 'bandpass', 1400, 2.2, [
        [0, 0],
        [0.1, 0.05],
        [1.1, 0.04],
        [1.25, 0],
      ]);
      const r = rng(144);
      for (let i = 0; i < 9; i++)
        noiseHit(e, at + 0.08 + i * 0.12 + r() * 0.05, to, 'bandpass', 520 + r() * 400, 4, [
          [0, 0],
          [0.004, 0.14],
          [0.05, 0],
        ]);
      return 1.3;
    },
  },
  {
    id: 'SFX_JUMP_LAND',
    captionKey: 'caption.sfx.jump_land',
    bus: 'effects',
    play: (e, at, pan) => {
      // Both feet down at once: a dull thud with a scuff of grit, and a breath let out.
      const to = out(e, 'effects', pan, 0.12);
      tone(
        e,
        at,
        to,
        'sine',
        [
          [0, 110],
          [0.08, 58],
        ],
        [
          [0, 0],
          [0.004, 0.42],
          [0.16, 0.0001],
        ],
      );
      noiseHit(e, at, to, 'lowpass', 900, 0.7, [
        [0, 0],
        [0.004, 0.22],
        [0.12, 0],
      ]);
      grit(e, at + 0.03, to, 4, 145, 0.08);
      breath(e, at + 0.12, to, 0.3, 0.035, 900);
      return 0.5;
    },
  },
];

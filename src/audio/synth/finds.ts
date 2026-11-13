/**
 * The small finds' sounds (the user's fourth playtest, request 24; decision DH-119; Book 11
 * sections 07 and 12), generated in code like every effect: shells clinking in the hand, a gull
 * crying over its nest, a hand brushing old stone, a stone set on a cairn, the faint ring of an old
 * bronze pin, dry bone on rock, and iron scraped free of a crack. Each has its caption
 * (`caption.sfx.find_*`); the find's own story caption is shown with it (Book 8 section 10).
 */
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { metal, noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** A small hard click (a shell, a pebble). */
function click(e: SynthEngine, at: number, to: AudioNode, hz: number, level: number): void {
  noiseHit(e, at, to, 'bandpass', hz, 6, [
    [0, 0],
    [0.001, level],
    [0.03, 0],
  ]);
  tone(
    e,
    at,
    to,
    'sine',
    [
      [0, hz * 0.9],
      [0.04, hz * 0.85],
    ],
    [
      [0, 0],
      [0.001, level * 0.35],
      [0.06, 0.0001],
    ],
  );
}

/** A heavy dull knock of stone on stone. */
function stoneKnock(e: SynthEngine, at: number, to: AudioNode, level: number): void {
  noiseHit(e, at, to, 'lowpass', 520, 0.8, [
    [0, 0],
    [0.002, level],
    [0.12, 0],
  ]);
  tone(
    e,
    at,
    to,
    'triangle',
    [
      [0, 150],
      [0.08, 110],
    ],
    [
      [0, 0],
      [0.002, level * 0.6],
      [0.16, 0.0001],
    ],
  );
}

export const FIND_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_FIND_SHELLS',
    captionKey: 'caption.sfx.find_shells',
    bus: 'effects',
    play: (e, at, pan) => {
      // A handful of cowries lifted out of the wrack: a damp rustle, then the shells clink.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 1400, 0.9, [
        [0, 0],
        [0.05, 0.18],
        [0.22, 0],
      ]);
      const r = rng(71);
      for (let i = 0; i < 6; i++) click(e, at + 0.2 + i * 0.045 + r() * 0.03, to, 3200 + r() * 1800, 0.18 + r() * 0.1);
      return 0.6;
    },
  },
  {
    id: 'SFX_FIND_EGGS',
    captionKey: 'caption.sfx.find_eggs',
    bus: 'effects',
    play: (e, at, pan) => {
      // The gull overhead protests (a falling, nasal cry, twice), and straw rustles under a hand.
      const to = out(e, 'effects', pan, 0.15);
      for (const [d, f] of [
        [0, 1180],
        [0.34, 1050],
      ] as const)
        tone(
          e,
          at + d,
          to,
          'sawtooth',
          [
            [0, f],
            [0.05, f * 1.12],
            [0.24, f * 0.7],
          ],
          [
            [0, 0],
            [0.02, 0.07],
            [0.2, 0.05],
            [0.26, 0.0001],
          ],
        );
      noiseHit(e, at + 0.5, to, 'bandpass', 2400, 1.2, [
        [0, 0],
        [0.04, 0.16],
        [0.3, 0],
      ]);
      return 0.9;
    },
  },
  {
    id: 'SFX_FIND_STONE',
    captionKey: 'caption.sfx.find_stone',
    bus: 'effects',
    play: (e, at, pan) => {
      // A palm brushed over lichen and weathered stone, slow, then a fingertip tracing a groove.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 900, 0.7, [
        [0, 0],
        [0.12, 0.2],
        [0.5, 0.12],
        [0.7, 0],
      ]);
      noiseHit(e, at + 0.75, to, 'bandpass', 2600, 2.5, [
        [0, 0],
        [0.05, 0.1],
        [0.35, 0],
      ]);
      return 1.1;
    },
  },
  {
    id: 'SFX_FIND_CAIRN',
    captionKey: 'caption.sfx.find_cairn',
    bus: 'effects',
    play: (e, at, pan) => {
      // A stone picked up (a scrape), set on the cairn (a knock), and settling (a smaller one).
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 700, 1.1, [
        [0, 0],
        [0.03, 0.22],
        [0.14, 0],
      ]);
      stoneKnock(e, at + 0.5, to, 0.5);
      stoneKnock(e, at + 0.63, to, 0.2);
      return 0.9;
    },
  },
  {
    id: 'SFX_FIND_OFFERING',
    captionKey: 'caption.sfx.find_offering',
    bus: 'effects',
    play: (e, at, pan) => {
      // The old pin stirred in its cleft: a faint, dull ring of bronze, and the wind hushing.
      const to = out(e, 'effects', pan);
      metal(e, at + 0.1, to, 1480, [1, 2.76, 5.4], 0.9, 0.08);
      noiseHit(e, at, to, 'lowpass', 420, 0.6, [
        [0, 0],
        [0.4, 0.08],
        [1.2, 0],
      ]);
      return 1.3;
    },
  },
  {
    id: 'SFX_FIND_BONE',
    captionKey: 'caption.sfx.find_bone',
    bus: 'effects',
    play: (e, at, pan) => {
      // A skull's dry, hollow knock on its ledge, and the shells round it shifting.
      const to = out(e, 'effects', pan);
      tone(
        e,
        at,
        to,
        'triangle',
        [
          [0, 720],
          [0.05, 560],
        ],
        [
          [0, 0],
          [0.002, 0.3],
          [0.09, 0.0001],
        ],
      );
      const r = rng(83);
      for (let i = 0; i < 3; i++) click(e, at + 0.15 + i * 0.06 + r() * 0.02, to, 3600 + r() * 1200, 0.12);
      return 0.5;
    },
  },
  {
    id: 'SFX_FIND_KNIFE',
    captionKey: 'caption.sfx.find_knife',
    bus: 'effects',
    play: (e, at, pan) => {
      // The blade worked free of the crack: iron grating on rock, then a small ring as it comes.
      const to = out(e, 'effects', pan);
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        1900,
        3,
        [
          [0, 0],
          [0.05, 0.22],
          [0.32, 0.18],
          [0.4, 0],
        ],
        2600,
      );
      metal(e, at + 0.42, to, 2300, [1, 2.4, 4.1], 0.35, 0.12);
      return 0.8;
    },
  },
];

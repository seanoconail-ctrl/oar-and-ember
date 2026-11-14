/**
 * Stage 14, work package C: the island's collectibles, puzzles and resource nodes (Book 11 sections
 * 07 and 12; decision S14-86), generated in code like every effect. Each has its caption
 * (`caption.sfx.*`); the find's own information caption is shown with it (Book 8 section 07).
 *
 * - A shell lifted: a damp scrape, then one hollow click and its ring.
 * - A page: dry leather unfolded and vellum's soft crackle.
 * - The drowned: slow drips on dry rock, and a low breath of the sea under them.
 * - Lore: a palm on cold stone, and a low hum that is not quite there.
 * - The bronze cauldron: peat sucking free, and a dull bronze note.
 * - The cairn's door turning: stone grinding on its pivot, a long low rumble, then settling.
 * - The deep passage growing loud: the sea booming through rock, swelling.
 * - Gathering: cress pulled from water, heather cut, a hare taken, cotton plucked, kelp hauled,
 *   eggs lifted, a peat spade biting, a fish landed on rock, and a seal taken.
 */
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { metal, noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** A small hollow click with its ring (a shell, a pebble). */
function click(e: SynthEngine, at: number, to: AudioNode, hz: number, level: number): void {
  noiseHit(e, at, to, 'bandpass', hz, 7, [
    [0, 0],
    [0.001, level],
    [0.035, 0],
  ]);
  tone(
    e,
    at,
    to,
    'sine',
    [
      [0, hz * 0.62],
      [0.09, hz * 0.58],
    ],
    [
      [0, 0],
      [0.002, level * 0.4],
      [0.14, 0.0001],
    ],
  );
}

/** A water drop on rock: a short falling blip and a tiny splash. */
function drip(e: SynthEngine, at: number, to: AudioNode, hz: number, level: number): void {
  tone(
    e,
    at,
    to,
    'sine',
    [
      [0, hz],
      [0.05, hz * 1.9],
    ],
    [
      [0, 0],
      [0.003, level],
      [0.07, 0.0001],
    ],
  );
  noiseHit(e, at + 0.004, to, 'highpass', 3200, 0.7, [
    [0, 0],
    [0.004, level * 0.4],
    [0.05, 0],
  ]);
}

/** A swish of plant stems (heather, grass, cress) torn or cut. */
function swish(e: SynthEngine, at: number, to: AudioNode, hz: number, dur: number, level: number): void {
  noiseHit(
    e,
    at,
    to,
    'bandpass',
    hz,
    1.4,
    [
      [0, 0],
      [dur * 0.25, level],
      [dur, 0],
    ],
    hz * 1.6,
  );
}

/** A wet slap and drag (kelp, peat). */
function wet(e: SynthEngine, at: number, to: AudioNode, level: number): void {
  noiseHit(e, at, to, 'lowpass', 700, 1.2, [
    [0, 0],
    [0.015, level],
    [0.22, 0],
  ]);
  tone(
    e,
    at,
    to,
    'triangle',
    [
      [0, 120],
      [0.12, 70],
    ],
    [
      [0, 0],
      [0.01, level * 0.5],
      [0.18, 0.0001],
    ],
  );
}

export const ISLAND_FIND_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_FIND_SHELL',
    captionKey: 'caption.sfx.find_shell',
    bus: 'effects',
    play: (e, at, pan) => {
      // A single shell lifted from shingle or weed: a damp scrape, one hollow click, its ring.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 1800, 1.1, [
        [0, 0],
        [0.04, 0.14],
        [0.18, 0],
      ]);
      click(e, at + 0.22, to, 2900, 0.24);
      click(e, at + 0.31, to, 3500, 0.1);
      return 0.6;
    },
  },
  {
    id: 'SFX_FIND_PAGE',
    captionKey: 'caption.sfx.find_page',
    bus: 'effects',
    play: (e, at, pan) => {
      // Oiled leather drawn back, then vellum lifted: a soft dry crackle that settles.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 900, 0.9, [
        [0, 0],
        [0.08, 0.12],
        [0.3, 0],
      ]);
      const r = rng(141);
      for (let i = 0; i < 9; i++)
        noiseHit(e, at + 0.32 + i * 0.05 + r() * 0.03, to, 'highpass', 4200 + r() * 1800, 1.5, [
          [0, 0],
          [0.004, 0.06 + r() * 0.05],
          [0.03, 0],
        ]);
      noiseHit(e, at + 0.85, to, 'bandpass', 2400, 0.8, [
        [0, 0],
        [0.05, 0.08],
        [0.32, 0],
      ]);
      return 1.2;
    },
  },
  {
    id: 'SFX_FIND_DROWNED',
    captionKey: 'caption.sfx.find_drowned',
    bus: 'effects',
    play: (e, at, pan) => {
      // Water running off someone onto dry rock, slow drips, and the sea breathing low under it.
      const to = out(e, 'effects', pan, 0.3);
      noiseHit(e, at, to, 'lowpass', 300, 0.7, [
        [0, 0],
        [0.8, 0.1],
        [2.2, 0.06],
        [3.0, 0],
      ]);
      const r = rng(151);
      for (let i = 0; i < 7; i++) drip(e, at + 0.2 + i * 0.38 + r() * 0.12, to, 900 + r() * 500, 0.12);
      return 3.1;
    },
  },
  {
    id: 'SFX_FIND_LORE',
    captionKey: 'caption.sfx.find_lore',
    bus: 'effects',
    play: (e, at, pan) => {
      // A palm on cold stone, and under it a low hum, two close tones beating, felt more than heard.
      const to = out(e, 'effects', pan, 0.4);
      noiseHit(e, at, to, 'bandpass', 760, 0.7, [
        [0, 0],
        [0.15, 0.16],
        [0.55, 0],
      ]);
      for (const hz of [110, 113.5])
        tone(
          e,
          at + 0.3,
          to,
          'sine',
          [[0, hz]],
          [
            [0, 0],
            [0.6, 0.07],
            [1.6, 0.05],
            [2.4, 0.0001],
          ],
        );
      return 2.5;
    },
  },
  {
    id: 'SFX_FIND_CAULDRON',
    captionKey: 'caption.sfx.find_cauldron',
    bus: 'effects',
    play: (e, at, pan) => {
      // Peat sucking free of bronze, then the rim's dull, green-old note.
      const to = out(e, 'effects', pan);
      wet(e, at, to, 0.22);
      metal(e, at + 0.35, to, 196, [1, 2.32, 3.9, 5.1], 1.6, 0.16);
      return 1.9;
    },
  },
  {
    id: 'SFX_CAIRN_DOOR',
    captionKey: 'caption.sfx.cairn_door',
    bus: 'effects',
    play: (e, at, pan) => {
      // A great stone turning on its pivot: a grinding rumble that swells and stops, then settles.
      const to = out(e, 'effects', pan, 0.5);
      noiseHit(
        e,
        at,
        to,
        'lowpass',
        180,
        3,
        [
          [0, 0],
          [0.6, 0.3],
          [2.2, 0.26],
          [2.6, 0],
        ],
        320,
      );
      tone(
        e,
        at,
        to,
        'sawtooth',
        [
          [0, 38],
          [2.4, 46],
        ],
        [
          [0, 0],
          [0.5, 0.06],
          [2.3, 0.05],
          [2.6, 0.0001],
        ],
      );
      noiseHit(e, at + 2.7, to, 'lowpass', 400, 1, [
        [0, 0],
        [0.01, 0.24],
        [0.3, 0],
      ]);
      return 3.1;
    },
  },
  {
    id: 'SFX_PASSAGE_LOUD',
    captionKey: 'caption.sfx.passage_loud',
    bus: 'tells',
    play: (e, at, pan) => {
      // The tide turning in the deep passage: the sea booming through rock, swelling (a warning).
      const to = out(e, 'tells', pan, 0.6);
      const r = rng(161);
      for (let i = 0; i < 4; i++) {
        const t = at + i * 0.9 + r() * 0.2;
        noiseHit(
          e,
          t,
          to,
          'lowpass',
          140 + i * 30,
          1.5,
          [
            [0, 0],
            [0.25, 0.18 + i * 0.05],
            [1.2, 0],
          ],
          90,
        );
      }
      return 4.2;
    },
  },
  {
    id: 'SFX_GATHER_CRESS',
    captionKey: 'caption.sfx.gather_cress',
    bus: 'effects',
    play: (e, at, pan) => {
      // Cress pulled from cold running water: a trickle, a soft tear, drips falling back.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 2600, 0.8, [
        [0, 0],
        [0.1, 0.07],
        [0.6, 0],
      ]);
      swish(e, at + 0.2, to, 1700, 0.25, 0.14);
      const r = rng(171);
      for (let i = 0; i < 4; i++) drip(e, at + 0.5 + i * 0.09 + r() * 0.04, to, 1200 + r() * 600, 0.08);
      return 0.9;
    },
  },
  {
    id: 'SFX_GATHER_HEATHER',
    captionKey: 'caption.sfx.gather_heather',
    bus: 'effects',
    play: (e, at, pan) => {
      // Woody heather stems cut, three strokes, and the armful gathered up.
      const to = out(e, 'effects', pan);
      for (let i = 0; i < 3; i++) swish(e, at + i * 0.3, to, 2200, 0.16, 0.18);
      noiseHit(e, at + 1.0, to, 'bandpass', 1100, 0.8, [
        [0, 0],
        [0.08, 0.12],
        [0.4, 0],
      ]);
      return 1.5;
    },
  },
  {
    id: 'SFX_GATHER_HARE',
    captionKey: 'caption.sfx.gather_hare',
    bus: 'effects',
    play: (e, at, pan) => {
      // A hare lifted from its form: a thump in the heather and the stems swishing back.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'lowpass', 260, 1, [
        [0, 0],
        [0.01, 0.2],
        [0.12, 0],
      ]);
      swish(e, at + 0.15, to, 1900, 0.3, 0.1);
      return 0.6;
    },
  },
  {
    id: 'SFX_GATHER_COTTON',
    captionKey: 'caption.sfx.gather_cotton',
    bus: 'effects',
    play: (e, at, pan) => {
      // Bog cotton plucked: the softest snaps of stems, in a breath of wind.
      const to = out(e, 'effects', pan);
      const r = rng(181);
      for (let i = 0; i < 5; i++)
        noiseHit(e, at + i * 0.14 + r() * 0.05, to, 'highpass', 3800, 1, [
          [0, 0],
          [0.006, 0.05],
          [0.05, 0],
        ]);
      noiseHit(e, at, to, 'bandpass', 600, 0.5, [
        [0, 0],
        [0.3, 0.05],
        [0.9, 0],
      ]);
      return 1.0;
    },
  },
  {
    id: 'SFX_GATHER_KELP',
    captionKey: 'caption.sfx.gather_kelp',
    bus: 'effects',
    play: (e, at, pan) => {
      // Kelp hauled off the rocks: wet slaps and a heavy drag, water running off.
      const to = out(e, 'effects', pan);
      wet(e, at, to, 0.24);
      wet(e, at + 0.38, to, 0.18);
      noiseHit(e, at + 0.5, to, 'bandpass', 2000, 0.7, [
        [0, 0],
        [0.1, 0.07],
        [0.7, 0],
      ]);
      return 1.3;
    },
  },
  {
    id: 'SFX_GATHER_EGGS',
    captionKey: 'caption.sfx.gather_eggs',
    bus: 'effects',
    play: (e, at, pan) => {
      // Eggs lifted from the ledge: seabirds crying round, and the eggs clicking together.
      const to = out(e, 'effects', pan, 0.2);
      for (const [d, f] of [
        [0, 1320],
        [0.22, 1180],
        [0.5, 1400],
      ] as const)
        tone(
          e,
          at + d,
          to,
          'sawtooth',
          [
            [0, f],
            [0.04, f * 1.15],
            [0.18, f * 0.72],
          ],
          [
            [0, 0],
            [0.02, 0.05],
            [0.2, 0.0001],
          ],
        );
      click(e, at + 0.7, to, 2400, 0.12);
      click(e, at + 0.78, to, 2600, 0.1);
      return 1.0;
    },
  },
  {
    id: 'SFX_GATHER_PEAT',
    captionKey: 'caption.sfx.gather_peat',
    bus: 'effects',
    play: (e, at, pan) => {
      // A peat spade bites, levers and lifts: a dull cut, a wet tearing, the block set down.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'lowpass', 480, 1.2, [
        [0, 0],
        [0.01, 0.26],
        [0.1, 0],
      ]);
      wet(e, at + 0.2, to, 0.2);
      noiseHit(e, at + 0.7, to, 'lowpass', 300, 1, [
        [0, 0],
        [0.01, 0.18],
        [0.14, 0],
      ]);
      return 1.0;
    },
  },
  {
    id: 'SFX_GATHER_FISH',
    captionKey: 'caption.sfx.gather_fish',
    bus: 'effects',
    play: (e, at, pan) => {
      // A fish swung up onto the rock and flapping: three wet smacks, quicker each time.
      const to = out(e, 'effects', pan);
      for (const d of [0, 0.22, 0.38, 0.5])
        noiseHit(e, at + d, to, 'bandpass', 1300, 1.1, [
          [0, 0],
          [0.005, 0.18],
          [0.06, 0],
        ]);
      return 0.7;
    },
  },
  {
    id: 'SFX_GATHER_SEAL',
    captionKey: 'caption.sfx.gather_seal',
    bus: 'effects',
    play: (e, at, pan) => {
      // A seal taken at the haul-out: the others' low groans and a heavy weight dragged on wet sand.
      const to = out(e, 'effects', pan, 0.2);
      tone(
        e,
        at,
        to,
        'sawtooth',
        [
          [0, 220],
          [0.5, 160],
          [0.9, 140],
        ],
        [
          [0, 0],
          [0.1, 0.05],
          [0.9, 0.0001],
        ],
      );
      noiseHit(e, at + 0.6, to, 'lowpass', 500, 1, [
        [0, 0],
        [0.1, 0.16],
        [0.8, 0],
      ]);
      return 1.5;
    },
  },
];

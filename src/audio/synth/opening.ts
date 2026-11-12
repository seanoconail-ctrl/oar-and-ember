/**
 * Design addendum 2.4's opening sounds (Book 11 section 07, "The opening's tactile sounds", Doors
 * and the Hag's Stone's tell), generated like every other sound (Book 11 section 12): the cold
 * open's strike, waking coughing in the surf, the net's cords parting, a heavy load set down, the
 * flint's strike, the sail hauled up and filling, the key and the lid, the lashing parting and the
 * bundle's splash, the arm-ring's clink, a driftwood door's creak and knock, a cloth flap's slap,
 * a bar dropped, and the Hag's Stone's drone and whisper and its sudden gust. Each has its caption.
 */
import type { SynthEngine } from './engine.ts';
import { rng } from './samples.ts';
import { noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** A dull thud: a tuned triangle drop with a burst of low noise. */
function thud(e: SynthEngine, at: number, to: AudioNode, hz: number, level: number): void {
  tone(
    e,
    at,
    to,
    'triangle',
    [
      [0, hz * 1.5],
      [0.04, hz],
    ],
    [
      [0, 0],
      [0.004, level],
      [0.16, 0],
    ],
  );
  noiseHit(e, at, to, 'lowpass', 900, 0.7, [
    [0, 0],
    [0.003, level * 0.5],
    [0.08, 0],
  ]);
}

/** A creak: a narrow band of noise sweeping as timber or rope takes the strain. */
function creak(
  e: SynthEngine,
  at: number,
  to: AudioNode,
  len: number,
  from: number,
  toHz: number,
  level: number,
): void {
  noiseHit(
    e,
    at,
    to,
    'bandpass',
    from,
    6,
    [
      [0, 0],
      [0.04, level * 3],
      [len - 0.04, level * 2],
      [len, 0],
    ],
    toHz,
  );
  // The stick and slip of the timber: a low buzz whose pitch drags as it goes.
  tone(
    e,
    at,
    to,
    'sawtooth',
    [
      [0, from / 3],
      [len * 0.5, toHz / 2.6],
      [len, from / 3.4],
    ],
    [
      [0, 0],
      [0.05, level * 0.9],
      [len - 0.05, level * 0.6],
      [len, 0],
    ],
  );
}

export const OPENING_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_COLD_STRIKE',
    captionKey: 'caption.cold.strike',
    bus: 'effects',
    play: (e, at, pan) => {
      // The hull on the skerry: a deep crack, timbers splintering, the sea over the side.
      const to = out(e, 'effects', pan, 0.3);
      thud(e, at, to, 55, 0.9);
      const r = rng(4401);
      for (let k = 0; k < 9; k++)
        noiseHit(e, at + 0.05 + r() * 0.5, to, 'bandpass', 900 + r() * 1800, 3, [
          [0, 0],
          [0.003, 0.3],
          [0.09, 0],
        ]);
      noiseHit(
        e,
        at + 0.2,
        to,
        'lowpass',
        600,
        0.6,
        [
          [0, 0],
          [0.3, 0.45],
          [1.8, 0],
        ],
        250,
      );
      return 2.2;
    },
  },
  {
    id: 'SFX_COUGH',
    captionKey: 'caption.wake.cough',
    bus: 'effects',
    play: (e, at, pan) => {
      // Coughing up seawater: rough breaths, never a voiced cry (Book 11 section 08).
      const to = out(e, 'effects', pan);
      for (let k = 0; k < 3; k++)
        noiseHit(e, at + k * 0.32, to, 'bandpass', 700 + k * 60, 1.4, [
          [0, 0],
          [0.01, 0.9],
          [0.16, 0],
        ]);
      noiseHit(e, at + 1.2, to, 'bandpass', 500, 1.1, [
        [0, 0],
        [0.2, 0.4],
        [0.7, 0],
      ]);
      return 2;
    },
  },
  {
    id: 'SFX_NET_CUT',
    captionKey: 'caption.action.net_parts',
    bus: 'effects',
    play: (e, at, pan) => {
      // The net's cords parting under the seax, strand by strand, then slack in the water.
      const to = out(e, 'effects', pan, 0.1);
      for (let k = 0; k < 5; k++)
        noiseHit(e, at + k * 0.09, to, 'bandpass', 2600 + (k % 2) * 700, 4, [
          [0, 0],
          [0.002, 0.7],
          [0.05, 0],
        ]);
      noiseHit(
        e,
        at + 0.5,
        to,
        'lowpass',
        1200,
        0.7,
        [
          [0, 0],
          [0.05, 0.45],
          [0.5, 0],
        ],
        400,
      );
      return 1.1;
    },
  },
  {
    id: 'SFX_CHEST_DRAG',
    captionKey: 'caption.chest.drag',
    bus: 'effects',
    play: (e, at, pan) => {
      // A chest scraping and bumping up the shingle.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 1800, 1.2, [
        [0, 0],
        [0.1, 0.16],
        [0.6, 0.12],
        [0.8, 0],
      ]);
      thud(e, at + 0.3, to, 120, 0.25);
      return 0.9;
    },
  },
  {
    id: 'SFX_CHEST_THUD',
    captionKey: 'caption.chest.thud',
    bus: 'effects',
    play: (e, at, pan) => {
      // A heavy load set down with a thud, stones shifting under it.
      const to = out(e, 'effects', pan, 0.08);
      thud(e, at, to, 85, 0.6);
      const r = rng(2203);
      for (let k = 0; k < 5; k++)
        noiseHit(e, at + 0.04 + r() * 0.25, to, 'bandpass', 2400 + r() * 1600, 4, [
          [0, 0],
          [0.002, 0.1],
          [0.04, 0],
        ]);
      return 0.6;
    },
  },
  {
    id: 'SFX_FLINT',
    captionKey: 'caption.action.sparks',
    bus: 'effects',
    play: (e, at, pan) => {
      // The flint's strike and sparks, three blows, the tinder's crackle and the flame taking.
      const to = out(e, 'effects', pan, 0.1);
      for (let k = 0; k < 3; k++) {
        tone(
          e,
          at + k * 0.28,
          to,
          'square',
          [
            [0, 3200],
            [0.02, 2400],
          ],
          [
            [0, 0],
            [0.001, 0.12],
            [0.05, 0],
          ],
        );
        noiseHit(e, at + k * 0.28, to, 'highpass', 5000, 1, [
          [0, 0],
          [0.001, 0.2],
          [0.04, 0],
        ]);
      }
      const r = rng(907);
      for (let k = 0; k < 10; k++)
        noiseHit(e, at + 0.9 + r() * 1.2, to, 'bandpass', 3000 + r() * 2500, 6, [
          [0, 0],
          [0.001, 0.08],
          [0.02, 0],
        ]);
      noiseHit(e, at + 0.9, to, 'lowpass', 500, 0.5, [
        [0, 0],
        [0.6, 0.2],
        [2, 0],
      ]);
      return 2.2;
    },
  },
  {
    id: 'SFX_SAIL_RAISE',
    captionKey: 'caption.action.sail',
    bus: 'effects',
    play: (e, at, pan) => {
      // The sail hauled up, the ropes creaking taut, the cloth flapping then filling with a soft
      // boom, and settling.
      const to = out(e, 'effects', pan, 0.15);
      creak(e, at, to, 0.7, 380, 620, 0.16);
      creak(e, at + 0.8, to, 0.5, 450, 700, 0.14);
      for (let k = 0; k < 4; k++)
        noiseHit(e, at + 1.4 + k * 0.13, to, 'bandpass', 900, 1.5, [
          [0, 0],
          [0.01, 0.2],
          [0.07, 0],
        ]);
      tone(
        e,
        at + 2.0,
        to,
        'sine',
        [
          [0, 70],
          [0.3, 55],
        ],
        [
          [0, 0],
          [0.05, 0.35],
          [0.7, 0],
        ],
      );
      noiseHit(e, at + 2.0, to, 'lowpass', 400, 0.6, [
        [0, 0],
        [0.05, 0.25],
        [0.8, 0],
      ]);
      return 3;
    },
  },
  {
    id: 'SFX_CHEST_OPEN',
    captionKey: 'caption.chest.key',
    bus: 'effects',
    play: (e, at, pan) => {
      // The key in the lock, its turn and click, and the lid's long creak.
      const to = out(e, 'effects', pan, 0.1);
      noiseHit(e, at, to, 'bandpass', 3600, 5, [
        [0, 0],
        [0.002, 0.45],
        [0.05, 0],
      ]);
      tone(
        e,
        at + 0.25,
        to,
        'square',
        [
          [0, 1900],
          [0.03, 1500],
        ],
        [
          [0, 0],
          [0.001, 0.2],
          [0.06, 0],
        ],
      );
      creak(e, at + 0.5, to, 0.9, 300, 520, 0.14);
      return 1.6;
    },
  },
  {
    id: 'SFX_LASHING',
    captionKey: 'caption.action.lashing',
    bus: 'effects',
    play: (e, at, pan) => {
      // The lashing parting under an arrow: a twang and the rope's slither.
      const to = out(e, 'effects', pan, 0.15);
      tone(
        e,
        at,
        to,
        'sawtooth',
        [
          [0, 220],
          [0.2, 140],
        ],
        [
          [0, 0],
          [0.002, 0.18],
          [0.3, 0],
        ],
      );
      noiseHit(
        e,
        at + 0.05,
        to,
        'bandpass',
        2000,
        2,
        [
          [0, 0],
          [0.02, 0.18],
          [0.4, 0],
        ],
        900,
      );
      return 0.7;
    },
  },
  {
    id: 'SFX_BUNDLE_SPLASH',
    captionKey: 'caption.action.splash',
    bus: 'effects',
    play: (e, at, pan) => {
      // The bundle's fall and splash into the shallows.
      const to = out(e, 'effects', pan, 0.2);
      noiseHit(
        e,
        at,
        to,
        'lowpass',
        1800,
        0.8,
        [
          [0, 0],
          [0.01, 0.5],
          [0.25, 0.15],
          [0.9, 0],
        ],
        500,
      );
      thud(e, at, to, 70, 0.35);
      const r = rng(613);
      for (let k = 0; k < 8; k++)
        noiseHit(e, at + 0.15 + r() * 0.7, to, 'bandpass', 2000 + r() * 2000, 5, [
          [0, 0],
          [0.002, 0.07],
          [0.03, 0],
        ]);
      return 1.2;
    },
  },
  {
    id: 'SFX_RING_CLINK',
    captionKey: 'caption.ring.clink',
    bus: 'effects',
    play: (e, at, pan) => {
      // The arm-ring's small clink from the pool.
      const to = out(e, 'effects', pan, 0.2);
      tone(
        e,
        at,
        to,
        'sine',
        [
          [0, 2637],
          [0.4, 2600],
        ],
        [
          [0, 0],
          [0.002, 0.14],
          [0.5, 0],
        ],
      );
      tone(
        e,
        at + 0.08,
        to,
        'sine',
        [
          [0, 3520],
          [0.3, 3480],
        ],
        [
          [0, 0],
          [0.002, 0.08],
          [0.35, 0],
        ],
      );
      return 0.7;
    },
  },
  {
    id: 'SFX_DOOR_CREAK',
    captionKey: 'caption.door.open',
    bus: 'effects',
    play: (e, at, pan) => {
      // A driftwood door's creak on its rope hinges.
      const to = out(e, 'effects', pan, 0.08);
      creak(e, at, to, 0.45, 260, 410, 0.3);
      return 0.5;
    },
  },
  {
    id: 'SFX_DOOR_KNOCK',
    captionKey: 'caption.door.close',
    bus: 'effects',
    play: (e, at, pan) => {
      // ...and its knock shut against the jamb.
      const to = out(e, 'effects', pan, 0.08);
      thud(e, at, to, 140, 0.4);
      return 0.3;
    },
  },
  {
    id: 'SFX_FLAP',
    captionKey: 'caption.door.flap',
    bus: 'effects',
    play: (e, at, pan) => {
      // A cloth flap's soft slap.
      const to = out(e, 'effects', pan);
      noiseHit(e, at, to, 'bandpass', 700, 1.2, [
        [0, 0],
        [0.01, 0.6],
        [0.12, 0],
      ]);
      return 0.25;
    },
  },
  {
    id: 'SFX_DOOR_BAR',
    captionKey: 'caption.door.close',
    bus: 'effects',
    play: (e, at, pan) => {
      // A bar dropped into its brackets (Stage 19's defences).
      const to = out(e, 'effects', pan, 0.08);
      thud(e, at, to, 180, 0.45);
      thud(e, at + 0.08, to, 160, 0.3);
      return 0.4;
    },
  },
  {
    id: 'SFX_HAG_DRONE',
    captionKey: 'caption.hag.whisper',
    bus: 'tells',
    play: (e, at, pan) => {
      // Out of the silence, a low drone and a whisper rising by the stone (Book 11 section 07).
      const to = out(e, 'tells', pan, 0.4);
      const end = e.playNote('drone', 33, at, 4.2, 0.75, to);
      e.playNote('drone', 40, at + 0.8, 3.2, 0.45, to);
      const r = rng(1771);
      for (let k = 0; k < 7; k++)
        noiseHit(e, at + 0.6 + k * 0.5 + r() * 0.2, to, 'bandpass', 2400 + r() * 1400, 8, [
          [0, 0],
          [0.12, 0.14],
          [0.35, 0],
        ]);
      return end - at;
    },
  },
  {
    id: 'SFX_HAG_GUST',
    captionKey: 'caption.hag.gust',
    bus: 'tells',
    play: (e, at, pan) => {
      // A sudden gust off the sea, and the world's sounds back at once.
      const to = out(e, 'tells', pan, 0.15);
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        500,
        0.7,
        [
          [0, 0],
          [0.12, 0.5],
          [0.6, 0.1],
          [1.1, 0],
        ],
        1400,
      );
      return 1.2;
    },
  },
];

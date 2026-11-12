/**
 * Combat v2's sounds (Book 11 section 07, combat v2 rows; decisions DE-5, DE-7, DE-9, DE-10),
 * generated in code like every effect (Book 11 section 12): the hurt layered under each hit (a
 * wordless grunt for others; for the steerer a sharp breath, never a voiced cry, so no sound hints
 * at a gender), the parry's long bright ring, the riposte's heavy whoosh and impact, the lunge's
 * scuff and drawn breath, the backstab's short muffled struggle, a sidestep's scuff, the sharp
 * intake and drawn weapon of an enemy turning alert, and binding a wound and eating.
 */
import { boosted, breath, grunt, metal, noiseHit, out, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

export const COMBAT2_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_STEERER_BREATH',
    captionKey: 'caption.sfx.steerer_breath',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.6, 'effects', pan);
      // A sharp breath through the teeth: a quick hiss in, cut off, a short breath out.
      noiseHit(e, at, to, 'bandpass', 2400, 1.6, [
        [0, 0],
        [0.03, 0.55],
        [0.11, 0],
      ]);
      breath(e, at + 0.14, to, 0.22, 0.35, 900);
      return 0.4;
    },
  },
  {
    id: 'SFX_GRUNT',
    captionKey: 'caption.sfx.grunt',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 2.4, 'effects', pan);
      // A wordless grunt, cut short by the blow.
      grunt(e, at, to, 150, 0.16, 0.28);
      breath(e, at + 0.02, to, 0.12, 0.15, 800);
      return 0.25;
    },
  },
  {
    id: 'SFX_PARRY_RING',
    captionKey: 'caption.sfx.parry_ring',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan, 0.3);
      // The ring that rides on the parry's long hitstop: high, clean, slowly beating.
      metal(e, at + 0.01, to, 2637, [1, 1.006, 2.02, 2.76], 1.1, 0.22);
      return 1.2;
    },
  },
  {
    id: 'SFX_RIPOSTE',
    captionKey: 'caption.sfx.riposte',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.4, 'effects', pan);
      // A heavy whoosh rising, then a deep impact and the body's thump.
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        300,
        1.0,
        [
          [0, 0],
          [0.09, 0.45],
          [0.13, 0],
        ],
        1600,
      );
      tone(
        e,
        at + 0.12,
        to,
        'sine',
        [
          [0, 120],
          [0.22, 45],
        ],
        [
          [0, 0],
          [0.004, 0.9],
          [0.3, 0],
        ],
      );
      noiseHit(e, at + 0.12, to, 'lowpass', 700, 0.8, [
        [0, 0.6],
        [0.09, 0],
      ]);
      return 0.5;
    },
  },
  {
    id: 'SFX_LUNGE',
    captionKey: 'caption.sfx.lunge',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.8, 'effects', pan);
      // A scuff of the feet and a drawn breath: the tell before the lunge.
      noiseHit(e, at, to, 'lowpass', 1100, 0.7, [
        [0, 0],
        [0.01, 0.45],
        [0.09, 0],
      ]);
      breath(e, at + 0.03, to, 0.18, 0.3, 1600);
      return 0.25;
    },
  },
  {
    id: 'SFX_BACKSTAB',
    captionKey: 'caption.sfx.backstab',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.5, 'effects', pan);
      // A short struggle, muffled: cloth, two dull thuds, a stifled breath.
      noiseHit(e, at, to, 'lowpass', 600, 0.6, [
        [0, 0],
        [0.05, 0.35],
        [0.3, 0],
      ]);
      for (const t of [0.08, 0.2])
        tone(
          e,
          at + t,
          to,
          'sine',
          [
            [0, 95],
            [0.1, 55],
          ],
          [
            [0, 0],
            [0.004, 0.6],
            [0.14, 0],
          ],
        );
      breath(e, at + 0.24, to, 0.2, 0.18, 700);
      return 0.5;
    },
  },
  {
    id: 'SFX_SIDESTEP',
    captionKey: 'caption.sfx.sidestep',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.8, 'effects', pan);
      // A quick scuff to the side.
      noiseHit(e, at, to, 'bandpass', 1300, 0.9, [
        [0, 0],
        [0.005, 0.5],
        [0.07, 0],
      ]);
      return 0.12;
    },
  },
  {
    id: 'SFX_ALERT',
    captionKey: 'caption.sfx.alert',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.5, 'effects', pan);
      // A sharp intake of breath and a weapon drawn: the scrape of iron.
      noiseHit(e, at, to, 'bandpass', 2000, 1.4, [
        [0, 0],
        [0.06, 0.4],
        [0.12, 0],
      ]);
      noiseHit(
        e,
        at + 0.12,
        to,
        'bandpass',
        3000,
        3,
        [
          [0, 0],
          [0.02, 0.25],
          [0.2, 0],
        ],
        5200,
      );
      metal(e, at + 0.3, to, 1800, [1, 2.7], 0.2, 0.05);
      return 0.5;
    },
  },
  {
    id: 'SFX_BIND_WOUND',
    captionKey: 'caption.sfx.bind_wound',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.6, 'effects', pan);
      // Linen torn, then wound round and pulled tight: a rip and soft rasps.
      noiseHit(e, at, to, 'highpass', 2500, 0.8, [
        [0, 0],
        [0.01, 0.45],
        [0.18, 0],
      ]);
      for (const t of [0.5, 0.9, 1.3, 1.7])
        noiseHit(e, at + t, to, 'bandpass', 1500, 1.2, [
          [0, 0],
          [0.08, 0.2],
          [0.2, 0],
        ]);
      breath(e, at + 2.0, to, 0.3, 0.2, 900);
      return 2.4;
    },
  },
  {
    id: 'SFX_EAT',
    captionKey: 'caption.sfx.eat',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.6, 'effects', pan);
      // Salt fish torn and chewed: a pull, then a few soft bites.
      noiseHit(e, at, to, 'bandpass', 1800, 1.0, [
        [0, 0],
        [0.02, 0.3],
        [0.12, 0],
      ]);
      for (const t of [0.4, 0.7, 1.0, 1.3])
        noiseHit(e, at + t, to, 'lowpass', 800, 1.0, [
          [0, 0],
          [0.01, 0.25],
          [0.07, 0],
        ]);
      return 1.6;
    },
  },
];

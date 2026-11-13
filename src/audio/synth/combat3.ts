/**
 * The user's third playtest's combat sounds (Book 11 section 07; decision DG-29), generated in code
 * like every effect (Book 11 section 12). None is captioned in play (decision DF-80): each has its
 * drawn twin (content/audio.json `drawn`).
 *
 * - SFX_FINISHER: one heavy, distinct blow on the finisher's active tick, by its weapon's kind
 *   (variant 0 a short wet thrust for the seax, spear and the foe's own seax; 1 a heavy chop for
 *   the axes and the sword's cut; 2 a dull crushing blow for the club), riding the long hitstop,
 *   then the foe's short wordless breath out (at their own pitch). Never a cry drawn out.
 * - SFX_SPARE: the steerer's sharp breath with the shout (the steerer has no voice: no blip) and the
 *   weapon swept aside through the air.
 * - SFX_GUARD_TURN: Svart's guard turning a blow: a dry clack of the shaft and a scrape of iron along
 *   the wood (variant 0), or on the shield a hollow knock with a short ring (variant 1). Unlike a
 *   block's thud, so the ear learns that nothing landed.
 * - SFX_RED_SCRAPE: the red blow's tell: the axe's beard drawn along the shield's iron rim from the
 *   wind-up's first tick, rising to the flash (at 28 of its 56 ticks), then a bright metallic hiss.
 *   Unlike every other tell, so it can be dodged by ear.
 */
import { boosted, breath, grunt, metal, noiseHit, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

/** The red blow's flash comes this far into its scrape (28 of the 56 wind-up ticks, at 60 Hz). */
const RED_FLASH_AT = 28 / 60;

export const COMBAT3_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_FINISHER',
    captionKey: 'ui.sound.sfx.finisher',
    bus: 'effects',
    play: (e, at, pan, opts) => {
      const to = boosted(e, 1.3, 'effects', pan);
      const kind = opts.variant ?? 0;
      if (kind === 0) {
        // A short wet thrust: a tight push of breath through the blade, a soft deep thud.
        noiseHit(
          e,
          at,
          to,
          'bandpass',
          900,
          1.4,
          [
            [0, 0],
            [0.015, 0.5],
            [0.09, 0],
          ],
          380,
        );
        tone(
          e,
          at + 0.01,
          to,
          'sine',
          [
            [0, 110],
            [0.12, 62],
          ],
          [
            [0, 0],
            [0.01, 0.55],
            [0.16, 0],
          ],
        );
      } else if (kind === 1) {
        // A heavy chop: a hard bite with a crack of bone in it, and the thud behind.
        noiseHit(e, at, to, 'highpass', 1800, 0.9, [
          [0, 0],
          [0.004, 0.6],
          [0.05, 0],
        ]);
        tone(
          e,
          at,
          to,
          'triangle',
          [
            [0, 180],
            [0.1, 70],
          ],
          [
            [0, 0],
            [0.006, 0.6],
            [0.18, 0],
          ],
        );
        noiseHit(e, at + 0.02, to, 'bandpass', 2600, 3, [
          [0, 0],
          [0.005, 0.25],
          [0.03, 0],
        ]);
      } else {
        // A dull crushing blow: low, broad and short, no ring.
        tone(
          e,
          at,
          to,
          'sine',
          [
            [0, 85],
            [0.14, 48],
          ],
          [
            [0, 0],
            [0.008, 0.75],
            [0.22, 0],
          ],
        );
        noiseHit(e, at, to, 'lowpass', 600, 0.7, [
          [0, 0],
          [0.01, 0.45],
          [0.12, 0],
        ]);
      }
      // The foe's last sound: a short wordless breath out, at their own pitch, after the hitstop.
      const voice = opts.voice ?? 140;
      grunt(e, at + 0.22, to, voice * 0.8, 0.12, 0.12);
      breath(e, at + 0.3, to, 0.35, 0.18, 700);
      return 0.7;
    },
  },
  {
    id: 'SFX_SPARE',
    captionKey: 'ui.sound.sfx.spare',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = boosted(e, 1.5, 'effects', pan);
      // The sharp breath with the shout, then the weapon swept aside towards the way out.
      noiseHit(e, at, to, 'bandpass', 2200, 1.4, [
        [0, 0],
        [0.03, 0.45],
        [0.1, 0],
      ]);
      breath(e, at + 0.12, to, 0.28, 0.3, 950);
      noiseHit(
        e,
        at + 0.18,
        to,
        'bandpass',
        700,
        1.2,
        [
          [0, 0],
          [0.12, 0.35],
          [0.22, 0],
        ],
        2400,
      );
      return 0.5;
    },
  },
  {
    id: 'SFX_GUARD_TURN',
    captionKey: 'ui.sound.sfx.guard_turn',
    bus: 'effects',
    play: (e, at, pan, opts) => {
      const to = boosted(e, 1.6, 'effects', pan);
      if ((opts.variant ?? 0) === 1) {
        // On the shield: a hollow knock, and a short ring off the boss.
        tone(
          e,
          at,
          to,
          'triangle',
          [
            [0, 260],
            [0.08, 190],
          ],
          [
            [0, 0],
            [0.003, 0.55],
            [0.14, 0],
          ],
        );
        metal(e, at + 0.005, to, 1480, [1, 2.3, 3.6], 0.18, 0.12);
        return 0.3;
      }
      // On the shaft: a dry clack of wood on wood, then iron scraped along it, brief.
      noiseHit(e, at, to, 'bandpass', 1500, 4, [
        [0, 0],
        [0.002, 0.7],
        [0.035, 0],
      ]);
      tone(
        e,
        at,
        to,
        'square',
        [
          [0, 620],
          [0.03, 480],
        ],
        [
          [0, 0],
          [0.002, 0.12],
          [0.04, 0],
        ],
      );
      noiseHit(
        e,
        at + 0.03,
        to,
        'bandpass',
        3800,
        5,
        [
          [0, 0],
          [0.03, 0.22],
          [0.16, 0],
        ],
        2600,
      );
      return 0.25;
    },
  },
  {
    id: 'SFX_RED_SCRAPE',
    captionKey: 'ui.sound.sfx.red_scrape',
    bus: 'tells',
    play: (e, at, pan) => {
      const to = boosted(e, 1.7, 'tells', pan);
      // Steel drawn along the rim: a rough, narrow rasp that rises in pitch and level to the flash.
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        1600,
        9,
        [
          [0, 0],
          [0.08, 0.12],
          [RED_FLASH_AT - 0.02, 0.4],
          [RED_FLASH_AT, 0.05],
        ],
        4200,
      );
      tone(
        e,
        at,
        to,
        'sawtooth',
        [
          [0, 210],
          [RED_FLASH_AT, 330],
        ],
        [
          [0, 0],
          [0.1, 0.025],
          [RED_FLASH_AT, 0.06],
          [RED_FLASH_AT + 0.02, 0],
        ],
      );
      // At the flash, a bright metallic hiss with the red glint.
      noiseHit(e, at + RED_FLASH_AT, to, 'highpass', 5200, 1.5, [
        [0, 0],
        [0.01, 0.42],
        [0.3, 0],
      ]);
      metal(e, at + RED_FLASH_AT, to, 2960, [1, 1.5, 2.8], 0.35, 0.12);
      return RED_FLASH_AT + 0.35;
    },
  },
];

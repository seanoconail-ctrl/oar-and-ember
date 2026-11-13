/**
 * The user's fourth playtest's story sounds (Book 11 sections 07 and 08; decisions DH-26 and DH-17),
 * generated in code like every other sound (Book 11 section 12):
 *
 * - **The steerer's breath out** (`SFX_STEERER_SIGH`) under the steerer's word over a body: a slow,
 *   soft breath through the nose, falling away. The steerer has no voice blip, so the line is shown
 *   as text with this breath alone, never a voice that could hint at a gender (Book 11 section 08).
 * - **The strongbox snatched up** (`SFX_SNATCH`): feet skidding to a stop in the shingle, the box's
 *   iron handles clanking as it is hauled up, and the coins shifting inside.
 *
 * Both are seen as well as heard, so neither is captioned in play (the audit); each has its caption
 * string for the sound test and the coverage test.
 */
import { breath, metal, noiseHit, out } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

export const STORY4_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_STEERER_SIGH',
    captionKey: 'caption.sfx.steerer_sigh',
    bus: 'effects',
    play: (e, at, pan) => {
      // A slow breath out through the nose: a soft low band swelling and drawing away, with a
      // fainter, higher edge as the last of it goes.
      const to = out(e, 'effects', pan, 0.05);
      breath(e, at, to, 1.1, 0.32, 650);
      breath(e, at + 0.25, to, 0.9, 0.12, 1500);
      return 1.3;
    },
  },
  {
    id: 'SFX_SNATCH',
    captionKey: 'caption.sfx.snatch',
    bus: 'effects',
    play: (e, at, pan) => {
      const to = out(e, 'effects', pan, 0.1);
      // Feet skidding to a stop in the shingle: a rough scrape of pebbles.
      noiseHit(
        e,
        at,
        to,
        'bandpass',
        2600,
        0.9,
        [
          [0, 0],
          [0.03, 0.45],
          [0.22, 0.05],
          [0.3, 0],
        ],
        1400,
      );
      // The iron handles knocking up against the box as it comes up, two clanks.
      metal(e, at + 0.28, to, 520, [1, 2.76, 5.4], 0.28, 0.22);
      metal(e, at + 0.43, to, 610, [1, 2.76, 5.4], 0.22, 0.16);
      // Coins sliding inside: a short bright rustle.
      noiseHit(e, at + 0.5, to, 'highpass', 5200, 1.5, [
        [0, 0],
        [0.04, 0.12],
        [0.32, 0],
      ]);
      return 0.9;
    },
  },
];

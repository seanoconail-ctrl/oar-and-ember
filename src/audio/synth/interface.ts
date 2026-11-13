/**
 * The interface's sounds (Book 11 section 09; decision DG-29): the pause menu's soft wooden click
 * for each move and choice, and its lower, muted knock as it opens. Interface sounds, not captioned
 * (the caption string exists for the audio table's rule only). They play on the master bus, past
 * the effects bus the menu pauses while it holds time.
 */
import type { SynthEngine } from './engine.ts';
import { noiseHit, tone } from './sfx.ts';
import type { SoundDef } from './sfx.ts';

function master(e: SynthEngine, pan: number): AudioNode {
  const p = e.ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(e.buses.master);
  return p;
}

export const INTERFACE_SOUNDS: readonly SoundDef[] = [
  {
    id: 'SFX_MENU_CLICK',
    captionKey: 'caption.sfx.menu_click',
    bus: 'effects',
    play: (e, at, pan, opts) => {
      const to = master(e, pan);
      // A knuckle on a dry board: a short woody knock (lower and softer as the menu opens, when
      // `voice` carries the opening's pitch), with a tick of grain on top.
      const knock = opts.voice ?? 520;
      tone(
        e,
        at,
        to,
        'triangle',
        [
          [0, knock],
          [0.05, knock * 0.6],
        ],
        [
          [0, 0],
          [0.002, opts.voice === undefined ? 0.16 : 0.22],
          [0.07, 0],
        ],
      );
      noiseHit(e, at, to, 'bandpass', opts.voice === undefined ? 2600 : 900, 2.2, [
        [0, 0],
        [0.001, opts.voice === undefined ? 0.09 : 0.05],
        [0.025, 0],
      ]);
      return 0.1;
    },
  },
];

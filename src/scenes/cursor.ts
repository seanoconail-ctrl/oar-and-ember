/**
 * The mouse cursor in cinematic moments (design addendum 2.5 section 3; Book 2 section 21; Book 10
 * section 25, cursorHidden; decision DF-15): hidden through the cold open, the strike and the
 * black, the waking until the first input, and every scene that takes control (the first night's
 * fire, the rites, the launch). Once control returns it shows again on the first mouse movement,
 * or at once when a pointer use is offered (a panel with buttons, the sea map, game over).
 */
import type { WreckPhase } from '../sim/narrative/wreck.ts';

export interface CinematicState {
  readonly phase: WreckPhase;
  /** The first input on waking has been given (the steerer is getting up). */
  readonly gettingUp: boolean;
  /** A scene that takes control (a SCENE talk, the first night's fire). */
  readonly scene: boolean;
  readonly rites: boolean;
  readonly launch: boolean;
}

/** Whether this is a cinematic, non-interactive moment. */
export function cinematicNow(s: CinematicState): boolean {
  if (s.phase === 'COLD_OPEN') return true;
  if (s.phase === 'WAKING' && !s.gettingUp) return true;
  return s.scene || s.rites || s.launch;
}

/** Hides the cursor in cinematic moments and shows it again on the first movement after. */
export class CursorGate {
  #hidden = false;
  #moves = 0;
  #movesAtEnd = 0;
  #wasCinematic = false;

  /** The mouse moved (a window `mousemove`). */
  mouseMoved(): void {
    this.#moves++;
  }

  /** Returns whether the cursor is hidden now. */
  update(cinematic: boolean, pointerOffered: boolean): boolean {
    if (cinematic) {
      this.#hidden = true;
      this.#wasCinematic = true;
      return true;
    }
    if (this.#wasCinematic) {
      this.#wasCinematic = false;
      this.#movesAtEnd = this.#moves;
    }
    if (this.#hidden && (pointerOffered || this.#moves > this.#movesAtEnd)) this.#hidden = false;
    return this.#hidden;
  }
}

/**
 * Skipping the intro (Book 2 section 21; Book 10 section 21, "The intro"; decision DG-19): once the
 * cold open has been seen to its end on this device, holding any key or pad button for `skipHold`,
 * or a click on the Skip button, goes to the black and the waking. Before it has been seen, only the
 * title's "Intro: skip" leaves it out. The button shows `skipShows` into the cold open and fades
 * after a few seconds until a key is pressed. Pure: real time in, what to show and whether to skip
 * out; the view draws it and the play view skips (running the cold open unseen to its end).
 */
export interface SkipTiming {
  readonly holdSeconds: number;
  readonly showSeconds: number;
  readonly fadeSeconds: number;
}

export interface SkipView {
  /** The button's opacity, 0 to 1. */
  readonly alpha: number;
  /** How full the ring is, 0 to 1. */
  readonly ring: number;
  /** Skip now. */
  readonly skip: boolean;
}

export class SkipHold {
  readonly #timing: SkipTiming;
  /** Real seconds when a key or button began to be held (null: none held). */
  #heldSince: number | null = null;
  /** Real seconds of the last key press (the button shows again from it). */
  #lastPress = -Infinity;
  #skipped = false;

  constructor(timing: SkipTiming) {
    this.#timing = timing;
  }

  /** A key or button went down (`now` real seconds). */
  press(now: number): void {
    this.#lastPress = now;
    this.#heldSince ??= now;
  }

  /** Every key and button is up. */
  releaseAll(): void {
    this.#heldSince = null;
  }

  /**
   * Each frame: `into` is real seconds into the cold open (null when it is not playing), `seen`
   * whether it may be skipped by holding (introSeen), `clicked` a click on the button.
   */
  update(now: number, into: number | null, seen: boolean, clicked = false): SkipView {
    if (into === null || !seen || this.#skipped) return { alpha: 0, ring: 0, skip: false };
    const t = this.#timing;
    const held = this.#heldSince === null ? 0 : now - this.#heldSince;
    const ring = Math.max(0, Math.min(1, held / t.holdSeconds));
    const shown = into >= t.showSeconds;
    const since = Math.min(into - t.showSeconds, now - this.#lastPress);
    const alpha = !shown
      ? 0
      : since <= t.fadeSeconds
        ? 1
        : Math.max(0, 1 - (since - t.fadeSeconds));
    const skip = held >= t.holdSeconds || (clicked && shown);
    if (skip) this.#skipped = true;
    return { alpha: held > 0 ? 1 : alpha, ring, skip };
  }
}

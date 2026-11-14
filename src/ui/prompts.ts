/**
 * Tutorial prompts and pickup tooltips (Book 2 section 18; Book 10 section 21, promptFade,
 * promptQuiet, promptDone and tipHold; design addendum 2.5 section 2; decision DF-12): they fade
 * out (never blink off) while a speech line, a story beat, a scene or a talk shows, come back a
 * little after it unless done, and once done they are gone for good. They never share the screen
 * with a narrative line. Presentation only and pure, on the frame's clock (seconds).
 */
import type { TextBalance } from '../content/presentationBalance.ts';

/** One tutorial prompt's fade: its opacity follows whether it may show, at promptFade's rate. */
export class PromptFade {
  readonly #b: Pick<TextBalance, 'promptFadeSeconds' | 'promptBackSeconds'>;
  #alpha = 0;
  #quietAt = -Infinity;
  #last = -Infinity;
  #done = false;

  constructor(b: Pick<TextBalance, 'promptFadeSeconds' | 'promptBackSeconds'>) {
    this.#b = b;
  }

  /** Marks the prompt done for good (the player has done the thing). */
  done(): void {
    this.#done = true;
  }

  get isDone(): boolean {
    return this.#done;
  }

  get alpha(): number {
    return this.#alpha;
  }

  /**
   * Advances to `now`: `wanted` is whether the moment calls for the prompt, `quiet` whether a
   * narrative line, beat, scene or talk is showing. Returns the opacity.
   */
  update(now: number, wanted: boolean, quiet: boolean): number {
    const dt = this.#last === -Infinity ? 0 : Math.max(0, now - this.#last);
    this.#last = now;
    if (quiet) this.#quietAt = now;
    const back = now - this.#quietAt >= this.#b.promptBackSeconds;
    const target = wanted && !this.#done && !quiet && back ? 1 : 0;
    const step = this.#b.promptFadeSeconds <= 0 ? 1 : dt / this.#b.promptFadeSeconds;
    this.#alpha =
      target > this.#alpha
        ? Math.min(target, this.#alpha + step)
        : Math.max(target, this.#alpha - step);
    return this.#alpha;
  }
}

/**
 * A pickup tooltip's life: it shows for tipHold seconds of play (time it is actually up, not
 * while hidden), or until its controls have been used twice, then fades.
 */
export class TipLife {
  readonly #b: Pick<TextBalance, 'tipSeconds' | 'tipUses'>;
  readonly fade: PromptFade;
  #shown = 0;
  #uses = 0;
  #last = -Infinity;

  constructor(
    b: Pick<TextBalance, 'tipSeconds' | 'tipUses' | 'promptFadeSeconds' | 'promptBackSeconds'>,
  ) {
    this.#b = b;
    this.fade = new PromptFade(b);
  }

  /** Its controls were used once. */
  used(): void {
    this.#uses++;
  }

  /** Whether it has had its time and has faded out. */
  get over(): boolean {
    return this.fade.isDone && this.fade.alpha <= 0;
  }

  update(now: number, quiet: boolean): number {
    const dt = this.#last === -Infinity ? 0 : Math.max(0, now - this.#last);
    this.#last = now;
    if (this.fade.alpha >= 1 && !quiet) this.#shown += dt;
    if (this.#shown >= this.#b.tipSeconds || this.#uses >= this.#b.tipUses) this.fade.done();
    return this.fade.update(now, true, quiet);
  }
}

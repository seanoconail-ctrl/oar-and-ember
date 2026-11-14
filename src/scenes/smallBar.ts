/**
 * Book 7 section 10's small stamina bar (Stage 14, decision S14-142; presentation only): while
 * the steerer climbs, swims or wades waist deep, the stamina bar also shows small beside them, and
 * an empty bar flashes its frame once before a slide or a sink (no flash with reduced flashes).
 *
 * The bar is final pixel art in the scene layer (`ui_stamina_small`: an end cap, 1 px columns of
 * fill or empty groove, the other cap), as many columns as the maximum stamina scaled to the
 * bar's length, so a smaller maximum draws a shorter bar as the big one does. It costs a few
 * sprites a frame and nothing when not shown.
 *
 * The flash: the drawn fill reaching no pixel at all comes a moment before the simulation's bar is
 * exactly empty (the last pixel goes at a fraction of a point), so the frame lights then; and if
 * a slide or a sink begins without it having flashed (a bar emptied at once), it lights then.
 * Once flashed it does not flash again until the bar has refilled past its first pixel.
 */
import type { SceneSprite } from '../render/scene.ts';

export const SMALL_BAR_SHEET = 'ui_stamina_small';
/** Columns of fill at the full base maximum (the bar's length in logical pixels, art layout). */
export const SMALL_BAR_COLUMNS = 14;
/** How long the frame stays lit in its one flash, in ticks (art timing, not tuning). */
export const SMALL_BAR_FLASH_TICKS = 10;
/** Where the bar sits beside the steerer: right of the shoulder, from the foot anchor. */
export const SMALL_BAR_AT = { x: 9, y: -36 } as const;

export interface SmallBarInput {
  /** Whether the steerer is climbing, swimming or wading waist deep (or sinking or sliding). */
  readonly shown: boolean;
  readonly current: number;
  readonly max: number;
  /** The full maximum the bar's length is measured against (Book 10's base stamina). */
  readonly base: number;
  /** A slide or a sink has begun. */
  readonly failing: boolean;
  readonly tick: number;
  readonly reducedFlashes: boolean;
}

export interface SmallBarView {
  /** Columns inside the frame (the maximum's share of the bar's length, at least 3). */
  readonly columns: number;
  /** Columns filled. */
  readonly filled: number;
  /** The frame is lit this frame (its one flash). */
  readonly flash: boolean;
}

export class SmallStaminaBar {
  #flashFrom = -Infinity;
  #flashed = false;

  /** The bar this frame, or null when it is not shown. */
  update(i: SmallBarInput): SmallBarView | null {
    if (!i.shown) {
      this.#flashed = false;
      this.#flashFrom = -Infinity;
      return null;
    }
    const base = Math.max(1, i.base);
    const columns = Math.max(3, Math.round((SMALL_BAR_COLUMNS * Math.min(i.max, base)) / base));
    const filled = Math.max(
      0,
      Math.min(columns, Math.floor((columns * Math.max(0, i.current)) / Math.max(1e-9, i.max))),
    );
    if (filled > 0 && !i.failing) this.#flashed = false;
    else if (!this.#flashed) {
      this.#flashed = true;
      this.#flashFrom = i.tick;
    }
    const flash =
      !i.reducedFlashes &&
      i.tick >= this.#flashFrom &&
      i.tick - this.#flashFrom < SMALL_BAR_FLASH_TICKS;
    return { columns, filled, flash };
  }
}

/** The bar's sprites at the steerer's foot (screen pixels), drawn over everything round them. */
export function smallBarSprites(bar: SmallBarView, x: number, y: number): SceneSprite[] {
  const lit = bar.flash ? '_flash' : '';
  const x0 = Math.round(x + SMALL_BAR_AT.x);
  const y0 = Math.round(y + SMALL_BAR_AT.y);
  const out: SceneSprite[] = [];
  const put = (frame: string, dx: number): void => {
    out.push({
      sheet: SMALL_BAR_SHEET,
      frame: `${frame}${lit}/-/0`,
      x: x0 + dx,
      y: y0,
      layer: 'actor',
      sort: y + 1000,
    });
  };
  put('cap', 0);
  for (let k = 0; k < bar.columns; k++) put(k < bar.filled ? 'fill' : 'empty', 1 + k);
  put('cap', bar.columns + 1);
  return out;
}

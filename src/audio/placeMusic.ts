/**
 * Which music a place wants (Book 11 section 03; Stage 7). Pure: give it the time and the place,
 * it says which cue should play, or none for ambience only.
 *
 * - No music until the opening has let it in (Book 11: wind, surf and Hild's voice first).
 * - Away from the steading, the island theme (`MUS_ISLAND_EXPLORE`).
 * - At home, the hearth theme for the part of the day (`MUS_HOME_DAWN/DAY/DUSK/NIGHT`), in turns
 *   with ambience only: each visit begins with `restSeconds` of ambience, then `playSeconds` of
 *   music, over and over, so at least a third of home time is ambience only (Book 11 section 12).
 *   The first fire brings the music in at once (the hearth theme starts there, Book 11 section 04).
 */
import type { HomePhase } from './synth/home.ts';

export interface HomeMusicPlan {
  readonly restSeconds: number;
  readonly playSeconds: number;
}

export interface Place {
  /** Whether music may play at all yet. */
  readonly allowed: boolean;
  /** At the steading (the camp's zone). */
  readonly home: boolean;
  readonly phase: HomePhase;
}

export const ISLAND_CUE = 'MUS_ISLAND_EXPLORE';

export function homeCue(phase: HomePhase): string {
  return `MUS_HOME_${phase.toUpperCase()}`;
}

/** The share of a home visit's cycle that is ambience only. */
export function restShare(plan: HomeMusicPlan): number {
  return plan.restSeconds / (plan.restSeconds + plan.playSeconds);
}

export class PlaceMusic {
  readonly #plan: HomeMusicPlan;
  #homeSince: number | null = null;

  constructor(plan: HomeMusicPlan) {
    this.#plan = plan;
  }

  /** The cue the place wants at `now` (seconds), or null for ambience only. */
  want(now: number, place: Place): string | null {
    if (!place.allowed) {
      this.#homeSince = null;
      return null;
    }
    if (!place.home) {
      this.#homeSince = null;
      return ISLAND_CUE;
    }
    this.#homeSince ??= now;
    const cycle = this.#plan.restSeconds + this.#plan.playSeconds;
    const into = (now - this.#homeSince) % cycle;
    return into < this.#plan.restSeconds ? null : homeCue(place.phase);
  }

  /** Brings the hearth theme in now (the first fire): the cycle moves to its music turn. */
  begin(now: number): void {
    this.#homeSince = now - this.#plan.restSeconds;
  }
}

/**
 * The wreck on Sgeir Dhubh played on foot from a voyage (Stage 13; work package C's scene,
 * src/sim/sea/wreck.ts and src/scenes/seaWreck.ts; wired here by the sea map's package, decisions
 * S13-29 and S13-36). While the steerer is on the reef the play view calls `frame` once a frame:
 *
 * - each tick since the last frame, the survivors near the steerer turn to look (`stepWreck`), and
 *   the wreck's timber and cries sound on their schedule (`wreckSounds`), the cries with their
 *   direction, the timber's captions only while the wreck is out of view; its ambience is panned
 *   to the wreck's side (`setWreckSide`);
 * - Interact by a survivor or at the boat's side opens their words (`wreckInteract`), and a
 *   number, or Interact on the highlighted answer, takes one of the wreck's answers (`wreckOptions`,
 *   `chooseWreck`); the talk panel shows them (`options`);
 * - once an answer is taken and its words have played (`wreckReady`), the scene ends
 *   (`finishWreck`: the deeds, the survivors aboard, the steerer back aboard) and its result goes
 *   to the voyage (`SEA_HANDOFF_RETURN`), and the chart comes back.
 *
 * Like the scene's begin (S13-29), these run between ticks, not as simulation commands: the sea's
 * simulation has none for them. Flagged: a replay of commands does not reproduce them.
 */
import type { Direction } from '../audio/router.ts';
import type { Content } from '../content/registry.ts';
import type { ZoneMap } from '../content/zoneMap.ts';
import { SLOT_ACTIONS } from '../input/actions.ts';
import type { InputFrame } from '../input/inputState.ts';
import type { SimEvent, Simulation, SimWorldContext } from '../sim/simulation.ts';
import {
  chooseWreck,
  finishWreck,
  inWreck,
  nearestWreckUse,
  seaWreckContext,
  stepWreck,
  wreckInteract,
  wreckOptions,
  wreckReady,
} from '../sim/sea/wreck.ts';
import type { SeaWreckContext } from '../sim/sea/wreck.ts';
import { wreckSide, wreckSounds } from './seaWreck.ts';

export interface SeaWreckHost {
  readonly sim: Simulation;
  readonly land: SimWorldContext;
  readonly content: Content;
  /** The wreck's sounds: a game event with its direction, and a caption shown as unseen. */
  readonly sound: (event: string, direction: Direction) => void;
  readonly unseenCaption: (key: string) => void;
  readonly setWreckSide: (side: number) => void;
}

export class SeaWreckPlay {
  readonly #h: SeaWreckHost;
  readonly #ctx: SeaWreckContext | null;
  #lastTick = -1;
  #cursor = 0;
  /** Times the scene was finished and handed back (tests). */
  finished = 0;

  constructor(host: SeaWreckHost) {
    this.#h = host;
    this.#ctx = seaWreckContext(host.content, host.land.people ?? null);
  }

  /** Whether the steerer is on the reef now. */
  on(): boolean {
    return this.#ctx !== null && inWreck(this.#h.sim.state, this.#ctx);
  }

  /** The wreck's answers on offer in the open words, or null when the words are not the wreck's. */
  options(): { key: string; kind: 'CHOICE' }[] | null {
    const w = this.#h.sim.state;
    const ctx = this.#ctx;
    if (ctx === null || w.talk?.kind !== 'SEARCH' || !(w.talk.scene ?? '').startsWith('wreck.'))
      return null;
    return wreckOptions(w, ctx).map((o) => ({ key: o.key, kind: 'CHOICE' as const }));
  }

  /** The highlighted answer (the talk panel's cursor). */
  get cursor(): number {
    return this.#cursor;
  }

  /** One frame on the reef. */
  frame(
    input: InputFrame,
    map: ZoneMap,
    camera: { readonly x: number; readonly y: number },
    view: { readonly w: number; readonly h: number },
  ): void {
    const ctx = this.#ctx;
    const sim = this.#h.sim;
    const w = sim.state;
    if (ctx === null || !inWreck(w, ctx)) {
      this.#lastTick = -1;
      return;
    }
    const tile = map.tile;
    // The ticks since the last frame: the survivors' heads, and the wreck's sounds on schedule.
    const from = this.#lastTick < 0 ? w.tick : this.#lastTick + 1;
    for (let tick = from; tick <= w.tick; tick++) {
      for (const s of wreckSounds({ ...w, tick }, ctx, map, camera, view)) {
        this.#h.sound(s.event, s.direction);
        if (s.unseen && s.event !== 'WRECK_CRIES')
          this.#h.unseenCaption(`caption.sea.${s.event.toLowerCase()}`);
      }
    }
    if (this.#lastTick !== w.tick) stepWreck(w, ctx, tile);
    this.#lastTick = w.tick;
    this.#h.setWreckSide(wreckSide(map, camera.x, view.w));
    const emit = (e: SimEvent): void => {
      sim.events.emit(e);
    };
    const options = this.options();
    if (options !== null) {
      // The wreck's words: a number, or Interact on the highlighted answer, takes it.
      const n = options.length;
      if (n > 0) {
        this.#cursor = Math.min(this.#cursor, n - 1);
        if (input.pressed.has('slotNext')) this.#cursor = (this.#cursor + 1) % n;
        if (input.pressed.has('slotPrev')) this.#cursor = (this.#cursor - 1 + n) % n;
        let chosen: number | null = null;
        SLOT_ACTIONS.forEach((a, i) => {
          if (input.pressed.has(a) && i < n) chosen = i;
        });
        if (input.pressed.has('interact') || input.pressed.has('useItem')) chosen = this.#cursor;
        if (chosen !== null) {
          chooseWreck(w, ctx, chosen);
          this.#cursor = 0;
        }
      }
    } else if (
      w.talk === null &&
      input.pressed.has('interact') &&
      nearestWreckUse(w, ctx, tile) !== null
    ) {
      wreckInteract(w, ctx, tile, emit);
      this.#cursor = 0;
    }
    if (wreckReady(w, ctx)) {
      const outcome = finishWreck(w, ctx, emit);
      if (outcome !== null) {
        sim.submit({ type: 'SEA_HANDOFF_RETURN', result: outcome.result });
        this.finished++;
      }
    }
  }
}

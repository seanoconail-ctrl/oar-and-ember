/**
 * The wreck on Sgeir Dhubh played on foot from a voyage (Stage 13; work package C's scene,
 * src/sim/sea/wreck.ts and src/scenes/seaWreck.ts). Presentation and sound only (decision S13-80,
 * superseding S13-29 and S13-36): the simulation begins the scene when the wreck's handoff waits,
 * takes Interact and the talk panel's answers as commands (`INTERACT`, `INTERACT_AT`,
 * `TALK_CHOOSE`), turns the survivors' heads each tick, and finishes the scene and hands its result
 * to the voyage itself, so a replay of commands reproduces a wreck. While the steerer is on the reef
 * the play view calls `frame` once a frame for what is heard:
 *
 * - each tick since the last frame, the wreck's timber and cries sound on their schedule
 *   (`wreckSounds`), the cries with their direction, the timber's captions only while the wreck is
 *   out of view;
 * - its ambience is panned to the wreck's side (`setWreckSide`).
 */
import type { Direction } from '../audio/router.ts';
import type { ZoneMap } from '../content/zoneMap.ts';
import type { Simulation } from '../sim/simulation.ts';
import { ASK_SITE, inWreck } from '../sim/sea/wreck.ts';
import type { SeaWreckContext, WreckUse } from '../sim/sea/wreck.ts';
import { wreckSide, wreckSounds } from './seaWreck.ts';

/**
 * The prompt line's words for a use on the reef (decision S13-81), for the device in use: a
 * survivor's by the game's own "Talk to" with their short name (`person.short.<id>`), the boat's
 * side by `ui.prompt.wreck_board`. Never an ID (Book 8 section 10).
 */
export function wreckUseLabel(
  use: WreckUse,
  nameOf: (id: string) => string,
  t: (key: string, vars?: Record<string, string>) => string,
  key: string,
  mouse: boolean,
): { text: string; kind: string } {
  const say = (k: string, vars: Record<string, string> = {}): string =>
    mouse ? t(`${k}_click`, vars) : t(k, { key, ...vars });
  if (use.site === ASK_SITE) return { text: say('ui.prompt.wreck_board'), kind: 'wreck_board' };
  return { text: say('ui.prompt.talk', { name: nameOf(use.target) }), kind: 'talk' };
}

export interface SeaWreckHost {
  readonly sim: Simulation;
  /** The wreck's context, as the simulation runs it (`SimWorldContext.seaWreck`). */
  readonly ctx: SeaWreckContext | null;
  /** The wreck's sounds: a game event with its direction, and a caption shown as unseen. */
  readonly sound: (event: string, direction: Direction) => void;
  readonly unseenCaption: (key: string) => void;
  readonly setWreckSide: (side: number) => void;
}

export class SeaWreckPlay {
  readonly #h: SeaWreckHost;
  #lastTick = -1;

  constructor(host: SeaWreckHost) {
    this.#h = host;
  }

  /** Whether the steerer is on the reef now. */
  on(): boolean {
    const ctx = this.#h.ctx;
    return ctx !== null && inWreck(this.#h.sim.state, ctx);
  }

  /** One frame on the reef: the sounds of the ticks since the last frame, and the pan. */
  frame(
    map: ZoneMap,
    camera: { readonly x: number; readonly y: number },
    view: { readonly w: number; readonly h: number },
  ): void {
    const ctx = this.#h.ctx;
    const w = this.#h.sim.state;
    if (ctx === null || !inWreck(w, ctx)) {
      this.#lastTick = -1;
      return;
    }
    const from = this.#lastTick < 0 ? w.tick : this.#lastTick + 1;
    for (let tick = from; tick <= w.tick; tick++) {
      for (const s of wreckSounds({ ...w, tick }, ctx, map, camera, view)) {
        this.#h.sound(s.event, s.direction);
        if (s.unseen && s.event !== 'WRECK_CRIES')
          this.#h.unseenCaption(`caption.sea.${s.event.toLowerCase()}`);
      }
    }
    this.#lastTick = w.tick;
    this.#h.setWreckSide(wreckSide(map, camera.x, view.w));
  }
}

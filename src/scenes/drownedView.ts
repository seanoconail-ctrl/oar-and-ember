/**
 * The drowned on the Skerry as drawn (Stage 14; Book 7 section 09, Book 8 section 07, Book 9
 * section 03; decisions S14-147 to S14-150). Presentation only: it reads the world (the tide, who
 * is due, who has been met, whether Thorkel stands among them) and never changes it.
 *
 * While the causeway is open at a spring low the drowned stand on the skerry, water running from
 * them though the tide is out; they do not come near and do not follow. The one whose turn it is
 * stands forward at the place where they are spoken with (the collectible's place in
 * content/finds.json); the others stand back in a loose group on the crown of the rock; Thorkel,
 * when he is there, stands apart at his own place (content/puzzles.json). Donngal stands among
 * them once his turn can come (the wreck on Sgeir Dhubh met). A figure rises out of the wet rock
 * as it comes (`appear`), and runs back down into it as the window closes (`fade`); one speaking
 * moves its mouth (`speak`); the rest stand at rest or sway (`idle`, `shift`).
 *
 * The sheets are `actor_c_drowned_<key>` (assets/art/authoring/stage14_drowned.py).
 */
import type { IslandContext } from '../sim/land/island.ts';
import { drownedDue, holds } from '../sim/land/islandConditions.ts';
import { thorkelHere } from '../sim/land/puzzles.ts';
import type { WorldState } from '../sim/world.ts';
import { hash01 } from '../render/noise.ts';

/** Where the ones not speaking stand, in tiles from the place they are spoken with (art layout). */
const BACK: readonly (readonly [number, number])[] = [
  [3.0, 1.2],
  [4.7, 0.4],
  [3.9, 2.8],
  [6.1, 2.0],
  [1.7, 3.4],
];
/** The appearance's and the fade's length in ticks (6 frames of 7 ticks: the sheets' timing). */
export const DROWNED_TURN_TICKS = 42;
const TURN_FRAMES = 6;
/** How long a speaker's mouth moves after each line, in ticks. */
const SPEAK_TICKS = 240;

export const drownedSheet = (key: string): string => `actor_c_drowned_${key}`;

export interface DrownedFigure {
  readonly key: string;
  /** Tiles, at the foot. */
  readonly x: number;
  readonly y: number;
  readonly facing: 's' | 'w';
  readonly forward: boolean;
}

/** Who stands on the skerry now, and where (empty unless the causeway is open at a spring low). */
export function drownedStanding(world: WorldState, ctx: IslandContext): DrownedFigure[] {
  const d = ctx.puzzles.drowned;
  if (!holds(world, ctx, { tide: 'SPRING_LOW' })) return [];
  const place = ctx.collectibles.find((c) => c.scene === d.scene && c.use === 'TALK')?.pos;
  if (place === undefined) return [];
  const due = drownedDue(world, ctx);
  const out: DrownedFigure[] = [];
  let back = 0;
  for (const who of d.order) {
    if (!who.requires.every((c) => holds(world, ctx, c))) continue;
    if (who.key === due) {
      out.push({ key: who.key, x: place.x, y: place.y, facing: 'w', forward: true });
      continue;
    }
    const [dx, dy] = BACK[back % BACK.length] ?? [3, 1];
    back++;
    out.push({ key: who.key, x: place.x + dx, y: place.y + dy, facing: 's', forward: false });
  }
  if (thorkelHere(world, ctx))
    out.push({ key: 'thorkel', x: d.thorkel.x, y: d.thorkel.y, facing: 'w', forward: true });
  return out;
}

/** The drowned's key from one of their lines (`c_drowned.<key>.<n>`), or null. */
export function drownedOfLine(lineKey: string): string | null {
  const m = /^c_drowned\.([a-z]+)\.\d+$/.exec(lineKey);
  return m?.[1] ?? null;
}

interface Shown {
  figure: DrownedFigure;
  /** The tick it began to appear, or to fade (when `going`). */
  since: number;
  going: boolean;
}

/**
 * Keeps each figure's appearance and fade across ticks, and who is speaking: the props to draw,
 * each with its frame chosen here (`fixed`, so the scene does not loop it again).
 */
export class DrownedView {
  readonly #shown = new Map<string, Shown>();
  #zone = '';
  readonly #speaking = new Map<string, number>();

  /** A line was spoken: that one's mouth moves for a while. */
  spoke(lineKey: string, tick: number): void {
    const key = drownedOfLine(lineKey);
    if (key !== null) this.#speaking.set(key, tick);
    else if (lineKey.startsWith('c_drowned.thorkel')) this.#speaking.set('thorkel', tick);
  }

  props(
    world: WorldState,
    ctx: IslandContext,
    zone: string,
  ): { sheet: string; frame: string; x: number; y: number; fixed: boolean }[] {
    const tick = world.tick;
    if (zone !== this.#zone) {
      this.#shown.clear();
      this.#zone = zone;
    }
    if (zone !== ctx.puzzles.drowned.scene) return [];
    const now = new Map(drownedStanding(world, ctx).map((f) => [f.key, f]));
    for (const [key, f] of now) {
      const s = this.#shown.get(key);
      if (s === undefined || s.going) this.#shown.set(key, { figure: f, since: tick, going: false });
      else s.figure = f;
    }
    for (const [key, s] of this.#shown) {
      if (now.has(key) || s.going) continue;
      s.going = true;
      s.since = tick;
    }
    const out: { sheet: string; frame: string; x: number; y: number; fixed: boolean }[] = [];
    for (const [key, s] of [...this.#shown]) {
      const f = s.figure;
      const age = tick - s.since;
      let frame: string;
      if (age < DROWNED_TURN_TICKS) {
        const i = Math.min(TURN_FRAMES - 1, Math.floor((age * TURN_FRAMES) / DROWNED_TURN_TICKS));
        frame = `${s.going ? 'fade' : 'appear'}/${f.facing}/${i}`;
      } else if (s.going) {
        this.#shown.delete(key);
        continue;
      } else {
        const spoke = this.#speaking.get(key);
        const phase = Math.floor(hash01(f.x * 10, f.y * 10, 75) * 600);
        if (spoke !== undefined && tick - spoke < SPEAK_TICKS)
          frame = `speak/${f.facing}/${Math.floor((tick - spoke) / 12) % 4}`;
        else {
          // At rest: water running down them; now and then a slow sway, each on its own phase.
          const spell = Math.floor((tick + phase) / 480) % 4;
          frame =
            spell === 3
              ? `shift/${f.facing}/${Math.floor((tick + phase) / 30) % 4}`
              : `idle/${f.facing}/${Math.floor((tick + phase) / 16) % 4}`;
        }
      }
      out.push({ sheet: drownedSheet(key), frame, x: f.x, y: f.y, fixed: true });
    }
    return out;
  }
}

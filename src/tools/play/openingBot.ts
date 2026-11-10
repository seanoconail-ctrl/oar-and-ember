/**
 * A scripted player for tests and golden saves: finds a path over the zone's tiles and walks it
 * by submitting MOVE commands, exactly as the input layer would. It plays the opening the way a
 * new player is led to: towards Hild's call, lift her, try to set her down on the wet stones,
 * then carry her up above the tide line.
 */
import { tideAt } from '../../sim/calendar/calendar.ts';
import type { TimeBalance } from '../../content/balance.ts';
import { aboveTideLine, blocksMovement, terrainAt, tileOf } from '../../sim/land/zoneMap.ts';
import type { ZoneMap } from '../../sim/land/zoneMap.ts';
import type { Simulation } from '../../sim/simulation.ts';

export interface Tile {
  readonly tx: number;
  readonly ty: number;
}

/** Breadth-first path over open tiles to the first tile that satisfies `goal`. */
export function findPath(
  map: ZoneMap,
  tideOpen: boolean,
  from: Tile,
  goal: (t: Tile) => boolean,
): Tile[] | null {
  const key = (t: Tile): number => t.ty * map.width + t.tx;
  const came = new Map<number, Tile | null>([[key(from), null]]);
  const queue: Tile[] = [from];
  // The queue grows while it is walked; for-of sees the new entries.
  for (const t of queue) {
    if (goal(t)) {
      const path: Tile[] = [];
      for (let at: Tile | null | undefined = t; at != null; at = came.get(key(at)))
        path.unshift(at);
      return path;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { tx: t.tx + dx, ty: t.ty + dy };
      if (n.tx < 0 || n.ty < 0 || n.tx >= map.width || n.ty >= map.height) continue;
      if (came.has(key(n)) || blocksMovement(terrainAt(map, n.tx, n.ty), tideOpen)) continue;
      came.set(key(n), t);
      queue.push(n);
    }
  }
  return null;
}

export class OpeningBot {
  readonly #sim: Simulation;
  readonly #map: ZoneMap;
  readonly #b: TimeBalance;
  /** Ticks run by this bot. */
  ticks = 0;

  constructor(sim: Simulation, map: ZoneMap, b: TimeBalance) {
    this.#sim = sim;
    this.#map = map;
    this.#b = b;
  }

  get #player() {
    const onFoot = this.#sim.state.onFoot;
    if (onFoot === null) throw new Error('the bot needs the steerer on foot');
    return onFoot.player;
  }

  step(): void {
    this.#sim.step();
    this.ticks++;
  }

  tile(): Tile {
    return tileOf(this.#map, this.#player.x, this.#player.y);
  }

  /** Walks to the first tile matching `goal`; returns false if there is no path or it stalls. */
  walkTo(goal: (t: Tile) => boolean, opts: { run?: boolean; maxTicks?: number } = {}): boolean {
    const tideOpen = tideAt(this.#sim.state.calendar, this.#b).tidalGroundOpen;
    const path = findPath(this.#map, tideOpen, this.tile(), goal);
    if (path === null) return false;
    const limit = this.ticks + (opts.maxTicks ?? 60 * 120);
    for (const waypoint of path.slice(1)) {
      const cx = (waypoint.tx + 0.5) * this.#map.tile;
      const cy = (waypoint.ty + 0.7) * this.#map.tile;
      for (;;) {
        const p = this.#player;
        const dx = cx - p.x;
        const dy = cy - p.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
        if (this.ticks > limit) return false;
        const len = Math.hypot(dx, dy);
        this.#sim.submit({
          type: 'MOVE',
          x: dx / len,
          y: dy / len,
          run: opts.run ?? false,
          sneak: false,
        });
        this.step();
      }
    }
    this.stop();
    return true;
  }

  /** Turns to face a direction with the smallest nudge, then stops. */
  face(x: number, y: number): void {
    this.#sim.submit({ type: 'MOVE', x: x * 0.05, y: y * 0.05, run: false, sneak: false });
    this.step();
    this.stop();
  }

  stop(): void {
    this.#sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
    this.step();
  }

  interact(): void {
    this.#sim.submit({ type: 'INTERACT' });
    this.step();
  }

  /** Plays beat 1 the way the opening leads a new player. */
  rescue(person: string): void {
    const actor = this.#sim.state.onFoot?.actors[person];
    if (actor === undefined) throw new Error(`${person} is not in the zone`);
    const at = tileOf(this.#map, actor.x, actor.y);
    if (!this.walkTo((t) => Math.abs(t.tx - at.tx) + Math.abs(t.ty - at.ty) === 1)) {
      throw new Error(`no way to reach ${person}`);
    }
    this.face(at.tx - this.tile().tx, at.ty - this.tile().ty);
    this.interact();
    // On the wet stones: the tide line refuses.
    this.face(0, 1);
    this.interact();
    // Up the beach, facing north on to dry shingle.
    const dry = (t: Tile): boolean =>
      aboveTideLine(terrainAt(this.#map, t.tx, t.ty)) &&
      aboveTideLine(terrainAt(this.#map, t.tx, t.ty - 1));
    if (!this.walkTo(dry)) throw new Error('no dry ground in reach');
    this.face(0, -1);
    this.interact();
  }
}

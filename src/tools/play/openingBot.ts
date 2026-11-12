/**
 * A scripted player for tests and golden saves: finds a path over the zone's tiles and walks it
 * by submitting MOVE commands, exactly as the input layer would. It plays the opening the way a
 * new player is led to: towards Hild's call, lift her, try to set her down on the wet stones,
 * then carry her up above the tide line.
 */
import { tideAt } from '../../sim/calendar/calendar.ts';
import type { TimeBalance } from '../../content/balance.ts';
import type { LandContext } from '../../sim/land/onFoot.ts';
import { bandAt, isDeep, stillWaterLevel } from '../../sim/land/water.ts';
import { aboveTideLine, terrainAt, tileBlocks, tileOf } from '../../sim/land/zoneMap.ts';
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
  passable: (t: Tile) => boolean = () => true,
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
      if (came.has(key(n)) || tileBlocks(map, n.tx, n.ty, tideOpen)) continue;
      if (!passable(n)) continue;
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
  readonly #land: Pick<LandContext, 'water' | 'elevations'> | null;
  /** Ticks run by this bot. */
  ticks = 0;

  /** With the land context the bot keeps out of deep water, as a player must. */
  constructor(
    sim: Simulation,
    map: ZoneMap,
    b: TimeBalance,
    land: Pick<LandContext, 'water' | 'elevations'> | null = null,
  ) {
    this.#sim = sim;
    this.#map = map;
    this.#b = b;
    this.#land = land;
  }

  /** Where the bot aims inside a tile. */
  #spot(t: Tile): { x: number; y: number } {
    return { x: (t.tx + 0.5) * this.#map.tile, y: (t.ty + 0.7) * this.#map.tile };
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
    const tide = tideAt(this.#sim.state.calendar, this.#b);
    const land = this.#land;
    const elevation = land?.elevations.get(this.#map.zone);
    const level = stillWaterLevel(tide);
    const passable = (t: Tile): boolean => {
      if (land === null || elevation === undefined) return true;
      const at = this.#spot(t);
      return !isDeep(bandAt(land.water, elevation, at.x, at.y, level));
    };
    const path = findPath(this.#map, tide.tidalGroundOpen, this.tile(), goal, passable);
    if (path === null) return false;
    const limit = this.ticks + (opts.maxTicks ?? 60 * 120);
    const run = opts.run ?? false;
    for (const waypoint of path.slice(1)) {
      const { x: cx, y: cy } = this.#spot(waypoint);
      for (;;) {
        const p = this.#player;
        const dx = cx - p.x;
        const dy = cy - p.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
        if (this.ticks > limit) return false;
        const len = Math.hypot(dx, dy);
        // Design addendum 2.5: speed builds and dies (Book 10 "Movement and acceleration"); near
        // a waypoint the keys ease off so the steerer does not circle it.
        const k = len < 10 ? Math.max(0.25, len / 10) : 1;
        this.#sim.submit({ type: 'MOVE', x: (dx / len) * k, y: (dy / len) * k, run, sneak: false });
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
    // Design addendum 2.5: the steerer slows to a stop over Book 10's ticks; wait for it.
    for (let i = 0; i < 30; i++) {
      const v = this.#player.vel;
      if (v === undefined || Math.hypot(v.x, v.y) < 1e-6) break;
      this.step();
    }
  }

  interact(): void {
    this.#sim.submit({ type: 'INTERACT' });
    this.step();
  }

  /** Steps until `done` holds, or throws after `maxTicks`. */
  waitFor(done: () => boolean, maxTicks = 60 * 60): void {
    const limit = this.ticks + maxTicks;
    while (!done()) {
      if (this.ticks > limit) throw new Error('the bot waited too long');
      this.step();
    }
  }

  /** Walks to an item lying in the zone and picks it up with Interact. */
  pickUp(key: string): void {
    const onFoot = this.#sim.state.onFoot;
    const item = onFoot?.items.find((i) => i.key === key);
    if (item === undefined) throw new Error(`nothing called ${key} lies here`);
    const at = { tx: Math.floor(item.x), ty: Math.floor(item.y - 0.001) };
    if (!this.walkTo((t) => t.tx === at.tx && t.ty === at.ty)) throw new Error(`no way to ${key}`);
    this.interact();
    if (this.#sim.state.onFoot?.items.some((i) => i.key === key) === true)
      throw new Error(`${key} was not picked up`);
  }

  /** Takes the first hotbar slot holding `item` in hand. */
  selectItem(item: string): void {
    const slot = this.#sim.state.player.hotbar.slots.indexOf(item);
    if (slot < 0) throw new Error(`${item} is not on the hotbar`);
    this.#sim.submit({ type: 'SELECT_SLOT', slot });
    this.step();
  }

  /**
   * Draws towards aim direction `dir` (of 64, 0 east, clockwise) for `drawTicks`, aimed at a point
   * `dist` tiles off, and looses.
   */
  shoot(dir: number, dist: number | null, drawTicks: number): void {
    this.#sim.submit({ type: 'AIM', dir, dist });
    for (let i = 0; i < drawTicks; i++) this.step();
    this.#sim.submit({ type: 'AIM', dir: null });
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
    // Design addendum 2.4: caught in the net, she is cut free first (a hold-to-cut with the
    // seax), then lifted.
    const facts = this.#sim.state.facts;
    if (facts['ch1.phase'] !== undefined && facts['ch1.net_free'] !== true) {
      this.waitFor(() => this.#sim.state.facts['ch1.net_free'] === true, 60 * 10);
      this.interact();
    }
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

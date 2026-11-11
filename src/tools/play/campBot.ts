/**
 * A scripted player for Stage 7's tests and golden save: walks between zones (up the cut from
 * Wreck Strand to the broch and back), goes to the camp's sites and does their tasks with or
 * without a good timing press, casts the line into water, and sleeps. It submits commands exactly
 * as the input layer would.
 */
import type { TimeBalance } from '../../content/balance.ts';
import type { CampSite } from '../../content/registry.ts';
import { tideAt } from '../../sim/calendar/calendar.ts';
import type { CampContext } from '../../sim/home/camp.ts';
import { markTick } from '../../sim/home/camp.ts';
import type { LandContext } from '../../sim/land/onFoot.ts';
import { bandAt, isDeep, stillWaterLevel } from '../../sim/land/water.ts';
import { tileOf } from '../../sim/land/zoneMap.ts';
import type { ZoneMap } from '../../sim/land/zoneMap.ts';
import type { Simulation } from '../../sim/simulation.ts';
import { findPath } from './openingBot.ts';
import type { Tile } from './openingBot.ts';

export class CampBot {
  readonly #sim: Simulation;
  readonly #b: TimeBalance;
  readonly #land: LandContext;
  readonly #camp: CampContext;
  ticks = 0;

  constructor(sim: Simulation, b: TimeBalance, land: LandContext, camp: CampContext) {
    this.#sim = sim;
    this.#b = b;
    this.#land = land;
    this.#camp = camp;
  }

  get #onFoot() {
    const onFoot = this.#sim.state.onFoot;
    if (onFoot === null) throw new Error('the bot needs the steerer on foot');
    return onFoot;
  }

  get map(): ZoneMap {
    const map = this.#land.maps.get(this.#onFoot.zone);
    if (map === undefined) throw new Error(`no map for ${this.#onFoot.zone}`);
    return map;
  }

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      this.#sim.step();
      this.ticks++;
    }
  }

  stop(): void {
    this.#sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
    this.step();
  }

  #move(x: number, y: number, run = false): void {
    this.#sim.submit({ type: 'MOVE', x, y, run, sneak: false });
    this.step();
  }

  /** Walks within the zone to the first tile matching `goal`. */
  walkTo(goal: (t: Tile) => boolean, run = false, maxTicks = 60 * 180): boolean {
    const map = this.map;
    const tide = tideAt(this.#sim.state.calendar, this.#b);
    const elevation = this.#land.elevations.get(map.zone);
    const level = stillWaterLevel(tide);
    const spot = (t: Tile) => ({ x: (t.tx + 0.5) * map.tile, y: (t.ty + 0.7) * map.tile });
    const passable = (t: Tile): boolean => {
      if (elevation === undefined) return true;
      const at = spot(t);
      return !isDeep(bandAt(this.#land.water, elevation, at.x, at.y, level));
    };
    const p = this.#onFoot.player;
    const path = findPath(map, tide.tidalGroundOpen, tileOf(map, p.x, p.y), goal, passable);
    if (path === null) return false;
    const limit = this.ticks + maxTicks;
    for (const waypoint of path.slice(1)) {
      const { x: cx, y: cy } = spot(waypoint);
      for (;;) {
        const pl = this.#onFoot.player;
        const dx = cx - pl.x;
        const dy = cy - pl.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
        if (this.ticks > limit) return false;
        const len = Math.hypot(dx, dy);
        this.#move(dx / len, dy / len, run);
      }
    }
    this.stop();
    return true;
  }

  /** Walks to `zone`, crossing a linked edge (north or south) where needed. */
  goToZone(zone: string): void {
    for (let guard = 0; guard < 3 && this.#onFoot.zone !== zone; guard++) {
      const map = this.map;
      const link = map.links?.find((l) => l.to === zone);
      if (link === undefined) throw new Error(`${map.zone} has no link to ${zone}`);
      const edgeRow = link.edge === 'n' ? 0 : map.height - 1;
      if (!this.walkTo((t) => t.ty === edgeRow)) throw new Error(`no way to the ${link.edge} edge`);
      const dir = link.edge === 'n' ? -1 : 1;
      for (let i = 0; i < 120 && this.#onFoot.zone !== zone; i++) this.#move(0, dir);
      this.stop();
    }
    if (this.#onFoot.zone !== zone) throw new Error(`could not walk into ${zone}`);
  }

  /** Walks next to a site of the camp (crossing zones) and faces it. */
  goToSite(key: string): CampSite {
    const site = this.#camp.def.sites.find((s) => s.key === key);
    if (site === undefined) throw new Error(`no site ${key}`);
    this.goToZone(site.zone);
    const at = { tx: Math.floor(site.x), ty: Math.floor(site.y - 0.001) };
    const near = (t: Tile): boolean => Math.abs(t.tx - at.tx) + Math.abs(t.ty - at.ty) <= 1;
    if (!this.walkTo((t) => t.tx === at.tx && t.ty === at.ty) && !this.walkTo(near))
      throw new Error(`no way to ${key}`);
    return site;
  }

  /** Walks next to a person and tends them with a click on them (INTERACT_AT their tile). */
  tend(id: string, press: 'good' | 'late' | 'none' = 'good'): void {
    const actor = this.#onFoot.actors[id];
    if (actor === undefined) throw new Error(`${id} is not here`);
    const at = tileOf(this.map, actor.x, actor.y);
    if (!this.walkTo((t) => Math.abs(t.tx - at.tx) + Math.abs(t.ty - at.ty) === 1))
      throw new Error(`no way to ${id}`);
    this.#sim.submit({ type: 'INTERACT_AT', tile: at });
    this.step();
    if (this.#onFoot.player.work == null) throw new Error(`could not tend ${id}`);
    this.work(press);
  }

  /** Interact (the key), then step once. */
  interact(): void {
    this.#sim.submit({ type: 'INTERACT' });
    this.step();
  }

  /**
   * Plays a hands-on action already begun: a press on the mark (`press: 'good'`), a late one
   * (`'late'`) or none, then waits for its end.
   */
  work(press: 'good' | 'late' | 'none' = 'good'): void {
    const w = this.#onFoot.player.work;
    if (w == null) throw new Error('no work began');
    const mark = markTick(w.since, this.#camp.action);
    const pressAt = press === 'good' ? mark : press === 'late' ? w.since + w.ticks - 2 : -1;
    while (this.#onFoot.player.work != null) {
      if (this.#sim.state.tick === pressAt) this.#sim.submit({ type: 'WORK_PRESS' });
      this.step();
    }
  }

  /** Goes to a site and does what it offers, with a timing press. */
  doAt(key: string, press: 'good' | 'late' | 'none' = 'good'): void {
    this.goToSite(key);
    this.interact();
    if (this.#onFoot.player.work != null) this.work(press);
  }

  /** Steps until `done`, or throws after `maxTicks`. */
  waitFor(done: () => boolean, maxTicks = 60 * 600): void {
    const limit = this.ticks + maxTicks;
    while (!done()) {
      if (this.ticks > limit) throw new Error('the bot waited too long');
      this.step();
    }
  }

  /** Runs the clock (standing still) to a time of day, minutes after midnight. */
  waitUntil(minuteOfDay: number): void {
    this.stop();
    this.waitFor(() => this.#sim.state.calendar.minuteOfDay === minuteOfDay, 60 * 60 * 60);
  }

  /** Walks to dry ground with water deep enough to fish within casting reach. */
  goToWater(): void {
    const map = this.map;
    const level = stillWaterLevel(tideAt(this.#sim.state.calendar, this.#b));
    const elevation = this.#land.elevations.get(map.zone);
    const deepEnough = (tx: number, ty: number): boolean => {
      if (elevation === undefined) return false;
      const band = bandAt(
        this.#land.water,
        elevation,
        (tx + 0.5) * map.tile,
        (ty + 0.5) * map.tile,
        level,
      );
      return band !== null && band.band !== 'WET' && band.band !== 'ANKLE' && !isDeep(band);
    };
    const reach = Math.floor(this.#land.controls.castReach) - 1;
    const ok = (t: Tile): boolean => {
      if (deepEnough(t.tx, t.ty)) return false;
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++)
          if (Math.hypot(dx, dy) <= reach && deepEnough(t.tx + dx, t.ty + dy)) return true;
      return false;
    };
    if (!this.walkTo(ok)) throw new Error('no shore to fish from');
  }

  /**
   * Casts the line into the nearest water deep enough, from the shore, and plays the action out
   * (or, with `press: 'leave'`, leaves it running).
   */
  fish(press: 'good' | 'late' | 'none' | 'leave' = 'good'): boolean {
    const map = this.map;
    const p = this.#onFoot.player;
    const slot = this.#sim.state.player.hotbar.slots.indexOf('ITEM_LINE');
    if (slot < 0) throw new Error('no line in hand');
    const tile = tileOf(map, p.x, p.y);
    const level = stillWaterLevel(tideAt(this.#sim.state.calendar, this.#b));
    const elevation = this.#land.elevations.get(map.zone);
    const reach = this.#land.controls.castReach;
    for (let r = 1; r <= reach; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.hypot(dx, dy) > reach) continue;
          const t = { tx: tile.tx + dx, ty: tile.ty + dy };
          const x = (t.tx + 0.5) * map.tile;
          const y = (t.ty + 0.5) * map.tile;
          const band =
            elevation === undefined ? null : bandAt(this.#land.water, elevation, x, y, level);
          if (band === null || band.band === 'WET' || band.band === 'ANKLE') continue;
          this.#sim.submit({ type: 'SELECT_SLOT', slot });
          this.#sim.submit({ type: 'USE_AT', slot, tile: t });
          this.step();
          if (this.#onFoot.player.work == null) return false;
          if (press !== 'leave') this.work(press);
          return true;
        }
    return false;
  }
}

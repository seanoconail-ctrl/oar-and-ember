/**
 * A scripted player for Stage 7's tests and golden save: walks between zones (up the cut from
 * Wreck Strand to the broch and back), goes to the camp's sites and does their tasks (a plain
 * action, decision PT-1), picks up the driftwood lying on the strand (PT-2), casts the line into
 * water with or without a good timing press, and sleeps. It submits commands exactly as the input
 * layer would.
 */
import type { TimeBalance } from '../../content/balance.ts';
import type { CampSite } from '../../content/registry.ts';
import { tideAt } from '../../sim/calendar/calendar.ts';
import type { CampContext } from '../../sim/home/camp.ts';
import { markTick } from '../../sim/home/camp.ts';
import { bandAt, isDeep, stillWaterLevel } from '../../sim/land/water.ts';
import { tileOf } from '../../sim/land/zoneMap.ts';
import type { ZoneMap } from '../../sim/land/zoneMap.ts';
import type { Simulation, SimWorldContext } from '../../sim/simulation.ts';
import { beyond, findActor } from '../../sim/land/zoneLinks.ts';
import { talkOptions } from '../../sim/people/talk.ts';
import { findPath } from './openingBot.ts';
import type { Tile } from './openingBot.ts';

export class CampBot {
  readonly #sim: Simulation;
  readonly #b: TimeBalance;
  readonly #land: SimWorldContext;
  readonly #camp: CampContext;
  ticks = 0;

  constructor(sim: Simulation, b: TimeBalance, land: SimWorldContext, camp: CampContext) {
    this.#sim = sim;
    this.#b = b;
    this.#land = land;
    this.#camp = camp;
  }

  /** The simulation, its world context and the scene on foot (for bots built on this one). */
  get sim(): Simulation {
    return this.#sim;
  }

  get land(): SimWorldContext {
    return this.#land;
  }

  get onFoot() {
    return this.#onFoot;
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
  walkTo(
    goal: (t: Tile) => boolean,
    run = false,
    maxTicks = 60 * 180,
    /** Tiles to keep off (Stage 10: the Hag's neck in her gale), and the gait. */
    avoid: (t: Tile) => boolean = () => false,
    sneak = false,
  ): boolean {
    const map = this.map;
    const tide = tideAt(this.#sim.state.calendar, this.#b);
    const elevation = this.#land.elevations.get(map.zone);
    const level = stillWaterLevel(tide);
    const spot = (t: Tile) => ({ x: (t.tx + 0.5) * map.tile, y: (t.ty + 0.7) * map.tile });
    const passable = (t: Tile): boolean => {
      if (elevation === undefined) return true;
      const at = spot(t);
      return !avoid(t) && !isDeep(bandAt(this.#land.water, elevation, at.x, at.y, level));
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
        this.#sim.submit({ type: 'MOVE', x: dx / len, y: dy / len, run, sneak });
        this.step();
      }
    }
    this.stop();
    return true;
  }

  /**
   * Walks to `zone`, crossing linked edges where needed (any side; Stage 10 joins the machair to
   * the Hag's Seat on the west and the cairn on the east): the next zone on the shortest chain of
   * links, through the edge's tiles where that zone runs on beyond it.
   */
  goToZone(zone: string): void {
    for (let guard = 0; guard < 6 && this.#onFoot.zone !== zone; guard++) {
      const map = this.map;
      const next = this.#nextZone(map.zone, zone);
      if (next === null) throw new Error(`${map.zone} has no way to ${zone}`);
      const link = map.links?.find((l) => l.to === next);
      const toMap = this.#land.maps.get(next);
      if (link === undefined || toMap === undefined) throw new Error(`no link to ${next}`);
      const T = map.tile;
      const onEdge = (t: Tile): boolean => {
        const at =
          link.edge === 'n'
            ? t.ty === 0
            : link.edge === 's'
              ? t.ty === map.height - 1
              : link.edge === 'w'
                ? t.tx === 0
                : t.tx === map.width - 1;
        return at && beyond(map, toMap, { x: (t.tx + 0.5) * T, y: (t.ty + 0.9) * T });
      };
      if (!this.walkTo(onEdge)) throw new Error(`no way to the ${link.edge} edge`);
      const dir = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[link.edge];
      const dx = dir[0] ?? 0;
      const dy = dir[1] ?? 0;
      for (let i = 0; i < 120 && this.#onFoot.zone === map.zone; i++) this.#move(dx, dy);
      this.stop();
    }
    if (this.#onFoot.zone !== zone) throw new Error(`could not walk into ${zone}`);
  }

  /** The first zone on the shortest chain of links from `from` to `to`. */
  #nextZone(from: string, to: string): string | null {
    const came = new Map<string, string>([[from, '']]);
    const queue = [from];
    for (const z of queue) {
      if (z === to) break;
      for (const l of this.#land.maps.get(z)?.links ?? [])
        if (!came.has(l.to)) {
          came.set(l.to, z);
          queue.push(l.to);
        }
    }
    if (!came.has(to)) return null;
    let at = to;
    while (came.get(at) !== from) at = came.get(at) ?? from;
    return at;
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

  /**
   * Walks to a person (into their zone if need be) and talks to them with a click on them
   * (INTERACT_AT their tile). Returns once the conversation is open.
   */
  talkTo(id: string): void {
    for (let tries = 0; tries < 4; tries++) {
      const found = findActor(this.#onFoot, id);
      if (found === null) throw new Error(`${id} is nowhere`);
      if (found.zone !== this.#onFoot.zone) this.goToZone(found.zone);
      // Someone walking to their work is caught once they are there.
      this.waitFor(() => this.#onFoot.actors[id]?.walk === undefined, 60 * 120);
      const actor = this.#onFoot.actors[id];
      if (actor === undefined) continue;
      const at = tileOf(this.map, actor.x, actor.y);
      // Beside them, or on a corner of their tile: within reach (Book 10 section 21).
      const beside = (t: Tile): boolean =>
        Math.max(Math.abs(t.tx - at.tx), Math.abs(t.ty - at.ty)) === 1;
      if (!this.walkTo(beside)) throw new Error(`no way to ${id}`);
      const now = this.#onFoot.actors[id];
      if (now === undefined) continue;
      this.#sim.submit({ type: 'INTERACT_AT', tile: tileOf(this.map, now.x, now.y) });
      this.step();
      if (this.#sim.state.talk?.with === id) return;
    }
    throw new Error(`could not talk to ${id}`);
  }

  /** The options of the conversation open, as string keys. */
  options(): string[] {
    const people = this.#land.people ?? null;
    return people === null
      ? []
      : talkOptions(this.#sim.state, people, this.#land.searches ?? null).map((o) => o.key);
  }

  /** Chooses the option whose string key is `key` in the conversation open. */
  choose(key: string): void {
    const i = this.options().indexOf(key);
    if (i < 0) throw new Error(`no option ${key} among ${this.options().join(', ')}`);
    this.#sim.submit({ type: 'TALK_CHOOSE', index: i });
    this.step();
  }

  /**
   * Tends a person's wound: talks to them, takes up the wound and says "Let me see to it" (Stage
   * 8: tending is offered through the wound's topic), then plays the hands-on action.
   */
  tend(id: string, press: 'good' | 'late' | 'none' = 'good'): void {
    this.talkTo(id);
    this.choose('ui.talk.topic.wound');
    this.choose('p_steerer.talk.tend');
    if (this.#onFoot.player.work == null) throw new Error(`could not tend ${id}`);
    this.work(press);
  }

  /** Holds a direction for `ticks` ticks (up the beach off ground the tide has closed). */
  walkFor(x: number, y: number, ticks: number): void {
    for (let i = 0; i < ticks; i++) this.#move(x, y);
    this.stop();
  }

  /** Interact (the key), then step once. */
  interact(): void {
    this.#sim.submit({ type: 'INTERACT' });
    this.step();
  }

  /**
   * Plays a hands-on action already begun: a press on the mark (`press: 'good'`), a late one
   * (`'late'`) or none, then waits for its end. A plain action ignores the press (PT-1).
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

  /** Goes to a site and does what it offers (on a timed task, with the press given). */
  doAt(key: string, press: 'good' | 'late' | 'none' = 'good'): void {
    this.goToSite(key);
    this.interact();
    if (this.#onFoot.player.work != null) this.work(press);
  }

  /** Goes to a piece of driftwood and picks it up: a plain interact and the stoop (PT-2). */
  pickUp(key: string): void {
    const site = this.#camp.def.sites.find((s) => s.key === key);
    if (site?.kind !== 'DRIFTWOOD') throw new Error(`${key} is not a piece of driftwood`);
    this.doAt(key, 'none');
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

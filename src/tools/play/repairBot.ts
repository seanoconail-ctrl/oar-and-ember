/**
 * A scripted player for Stage 11's repairs, fitting and rites (Book 4 section 08, beats 4 to 6),
 * for the scenario tests, the golden save and the captures: it carries the salvaged boards to the
 * boat, cuts the rigging free of the wreck at low water and carries it back, comes by the steering
 * oar at Seal Cave by fight, theft or trade (or asks Runa to carve one), works on the boat, chooses
 * and takes off the fitting, and asks for Thorkel's rites. It submits commands exactly as the
 * input layer would.
 */
import type { TimeBalance } from '../../content/balance.ts';
import { tideAt } from '../../sim/calendar/calendar.ts';
import type { CampContext } from '../../sim/home/camp.ts';
import { findActor } from '../../sim/land/zoneLinks.ts';
import { aboveTideLine, terrainAt, tileBlocks, tileOf } from '../../sim/land/zoneMap.ts';
import type { RepairsContext } from '../../sim/narrative/repairs.ts';
import { boatOf } from '../../sim/narrative/repairs.ts';
import type { SearchContext } from '../../sim/narrative/searches.ts';
import type { Simulation, SimWorldContext } from '../../sim/simulation.ts';
import type { Tile } from './openingBot.ts';
import { SearchBot } from './searchBot.ts';

export type OarApproach = 'FIGHT' | 'THEFT' | 'TRADE' | 'CARVE';

export class RepairBot extends SearchBot {
  readonly repairs: RepairsContext;
  readonly #b: TimeBalance;

  constructor(
    sim: Simulation,
    b: TimeBalance,
    land: SimWorldContext,
    camp: CampContext,
    search: SearchContext,
    repairs: RepairsContext,
  ) {
    super(sim, b, land, camp, search);
    this.repairs = repairs;
    this.#b = b;
  }

  /** Book 10 section 02's time balance (for bots built on this one). */
  get timeBalance(): TimeBalance {
    return this.#b;
  }

  get tideOpen(): boolean {
    return tideAt(this.sim.state.calendar, this.#b).tidalGroundOpen;
  }

  /** Waits (standing) for the tidal ground to open: low water. */
  waitForLowWater(): void {
    this.stop();
    this.waitFor(() => this.tideOpen, 60 * 60 * 60);
  }

  /** Walks to a tile within reach of a point (tiles) in a zone, and presses interact there. */
  useAt(zone: string, x: number, y: number, reach = 1.2): void {
    this.goToZone(zone);
    const near = (t: Tile): boolean =>
      Math.hypot(t.tx + 0.5 - x, t.ty + 0.7 - y) <= reach &&
      !tileBlocks(this.map, t.tx, t.ty, this.tideOpen);
    if (!this.walkTo(near, false, 60 * 300)) throw new Error(`no way to (${x}, ${y}) in ${zone}`);
    this.interact();
  }

  /** A tile by the boat to lay a load on: above the tide line, open, within the lay-by reach. */
  #byBoat = (t: Tile): boolean => {
    const d = this.repairs.def.boat;
    return (
      Math.hypot(t.tx + 0.5 - d.x, t.ty + 0.5 - (d.y + 1)) <= d.layByTiles - 1.5 &&
      aboveTideLine(terrainAt(this.map, t.tx, t.ty)) &&
      !tileBlocks(this.map, t.tx, t.ty, false)
    );
  };

  /**
   * Carries one of the repairs' loads to the boat and lays it there. A bar run empty sets the load
   * down (Book 10 heavyCarryEmpty): the bot gets its breath back, goes back for it and lifts it again.
   */
  carryToBoat(id: string): void {
    const boatZone = this.repairs.def.boat.zone;
    for (let tries = 0; tries < 30; tries++) {
      if (this.onFoot.carrying !== id) {
        const found = findActor(this.onFoot, id);
        if (found === null) return;
        this.goToZone(found.zone);
        this.waitFor(() => this.onFoot.player.winded?.carry !== true, 60 * 60);
        this.lift(id);
      }
      this.goToZone(boatZone);
      if (this.onFoot.carrying !== id) continue;
      this.walkTo(this.#byBoat, false, 60 * 400);
      if (this.onFoot.carrying === id) {
        this.setDown();
        return;
      }
    }
    throw new Error(`could not carry ${id} to the boat`);
  }

  /** The salvaged boards, from the debris to the boat. */
  boards(): void {
    this.carryToBoat(this.repairs.def.boards.id);
  }

  /** The rigging: at low water out to the wreck, cut it free, and carry it back to the boat. */
  rigging(): void {
    const d = this.repairs.def.rigging;
    this.goToZone(d.zone);
    this.waitForLowWater();
    this.useAt(d.zone, d.cut.x, d.cut.y);
    if (this.onFoot.player.work == null) throw new Error('could not cut the rigging');
    this.work('none');
    if (this.sim.state.facts['repair.rigging_cut'] !== true) throw new Error('rigging not cut');
    this.carryToBoat(d.id);
  }

  /** Selects an empty hand (no weapon in hand: the scavengers talk first). */
  emptyHand(): void {
    const slots = this.sim.state.player.hotbar.slots;
    const free = slots.findIndex((s) => s === null);
    if (free >= 0) {
      this.sim.submit({ type: 'SELECT_SLOT', slot: free });
      this.step();
    }
  }

  /** Takes the seax in hand, if the steerer has it. */
  seaxInHand(): void {
    const slot = this.sim.state.player.hotbar.slots.indexOf('ITEM_SEAX');
    if (slot >= 0) {
      this.sim.submit({ type: 'SELECT_SLOT', slot });
      this.step();
    }
  }

  /** At Seal Cave: walks down to the scavengers' camp with empty hands until they talk. */
  meetScavengers(): void {
    const d = this.repairs.def.oar;
    this.goToZone(d.zone);
    this.emptyHand();
    const camp = { x: 44.5, y: 25.5 };
    const near = (t: Tile): boolean => Math.hypot(t.tx + 0.5 - camp.x, t.ty + 0.5 - camp.y) < 7;
    this.walkTo(near, false, 60 * 300);
    this.waitFor(() => this.onFoot.battle?.parley != null, 60 * 20);
  }

  /** Talks to the scavengers' speaker at the cave while they hold their parley. */
  talkAtCave(): void {
    for (const id of ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN']) {
      const a = this.onFoot.actors[id];
      if (a === undefined || a.fight?.dead != null) continue;
      const at = tileOf(this.map, a.x, a.y);
      const beside = (t: Tile): boolean =>
        Math.max(Math.abs(t.tx - at.tx), Math.abs(t.ty - at.ty)) === 1;
      this.walkTo(beside);
      this.sim.submit({ type: 'INTERACT_AT', tile: tileOf(this.map, a.x, a.y) });
      this.step();
      if (this.sim.state.talk !== null) return;
    }
    throw new Error('no one to talk to at the cave');
  }

  /** Takes the steering oar from the skiff (at low water), and the oar is lifted. */
  takeOar(): void {
    const d = this.repairs.def.oar;
    this.goToZone(d.zone);
    this.waitForLowWater();
    // Close enough to reach it from wherever the fight ended (a riposte steps in, combat v2).
    this.useAt(d.zone, d.take.x, d.take.y, 1.0);
    if (this.sim.state.facts['repair.oar'] === undefined) throw new Error('could not take the oar');
  }

  /**
   * Steals the oar unseen: round by the moor to the south-east of the cove, then at low water
   * sneaking north over the flats into the cave's mouth, well away from the scavengers' fire.
   */
  sneakOar(): void {
    const d = this.repairs.def.oar;
    this.goToZone(d.zone);
    this.emptyHand();
    const camp = { x: 44.5, y: 25.5 };
    const far = (t: Tile, r: number): boolean =>
      Math.hypot(t.tx + 0.5 - camp.x, t.ty + 0.5 - camp.y) < r;
    const round = (t: Tile): boolean => Math.hypot(t.tx + 0.5 - 62, t.ty + 0.5 - 40) < 1.5;
    if (!this.walkTo(round, false, 60 * 300, (t) => far(t, 17))) throw new Error('no way round');
    this.waitForLowWater();
    const at = (t: Tile): boolean =>
      Math.hypot(t.tx + 0.5 - d.take.x, t.ty + 0.7 - d.take.y) <= 1.2 &&
      !tileBlocks(this.map, t.tx, t.ty, this.tideOpen);
    if (!this.walkTo(at, false, 60 * 300, (t) => far(t, 11.5), true)) throw new Error('no way in');
    this.interact();
    if (this.sim.state.facts['repair.oar'] === undefined) throw new Error('could not take the oar');
  }

  /**
   * The steering oar by one of the four ways, laid by the boat. THEFT expects the skiff unguarded
   * (the scavengers still at the sheepfold, or unaware); FIGHT expects the seax.
   */
  oar(approach: OarApproach): void {
    const d = this.repairs.def.oar;
    if (approach === 'CARVE') {
      this.lookAtBoat();
      this.choose('p_steerer.boat.carve');
      this.waitFor(() => this.sim.state.talk === null, 60 * 30);
      this.waitFor(
        () => boatOf(this.sim.state)?.repairs.STEERING_OAR.stage !== 'LACKING',
        60 * 60 * 400,
      );
      return;
    }
    if (approach === 'THEFT') {
      this.sneakOar();
    } else if (approach === 'TRADE') {
      this.meetScavengers();
      this.talkAtCave();
      this.waitFor(() => this.options().length > 0, 60 * 30);
      const opts = this.options();
      this.choose(
        opts.includes('p_steerer.cave.silver') ? 'p_steerer.cave.silver' : 'p_steerer.cave.food',
      );
      this.waitFor(() => this.sim.state.talk === null, 60 * 30);
    } else {
      this.meetScavengers();
      this.talkAtCave();
      this.waitFor(() => this.options().length > 0, 60 * 30);
      this.choose('p_steerer.cave.take');
      this.waitFor(() => this.sim.state.talk === null, 60 * 30);
      this.seaxInHand();
      this.fightAll(60 * 300);
      if (this.sim.state.gameOver !== null) throw new Error('the steerer died at Seal Cave');
      this.takeOar();
    }
    this.carryToBoat(d.id);
  }

  /** Opens the boat's words (Look the boat over). */
  lookAtBoat(): void {
    const d = this.repairs.def.boat;
    this.useAt(d.zone, d.look.x, d.look.y);
    if (this.sim.state.talk?.scene !== 'boat.look') throw new Error('the boat did not open');
    this.waitFor(() => this.options().length > 0, 60 * 30);
  }

  /** Works on the boat by hand once (a plain "Repair the ship" action). */
  workOnBoat(): void {
    const d = this.repairs.def.boat;
    this.useAt(d.zone, d.work.x, d.work.y);
    if (this.onFoot.player.work == null) throw new Error('no work at the boat');
    this.work('none');
  }

  /** Chooses a fitting at the boat and works on it until it is fitted. */
  fit(which: 'HOLD' | 'BOW'): void {
    this.lookAtBoat();
    this.choose(which === 'HOLD' ? 'p_steerer.boat.fit_hold' : 'p_steerer.boat.fit_bow');
    this.waitFor(() => this.sim.state.talk === null, 60 * 30);
    const id = which === 'HOLD' ? 'FIT_EXTENDED_HOLD' : 'FIT_RAISED_BOW_PLATFORM';
    for (let k = 0; k < 40; k++) {
      if (Object.values(boatOf(this.sim.state)?.fittings ?? {}).includes(id)) return;
      this.workOnBoat();
    }
    throw new Error(`${id} was not fitted`);
  }

  /** Takes the fitting off again (one action at the boat). */
  unshipFitting(): void {
    this.lookAtBoat();
    const opt = this.options().find((o) => o.startsWith('p_steerer.boat.unship'));
    if (opt === undefined) throw new Error('nothing to take off');
    this.choose(opt);
    this.waitFor(() => this.onFoot.player.work != null || this.sim.state.talk === null, 60 * 30);
    this.waitFor(() => this.onFoot.player.work != null, 60 * 30);
    this.work('none');
  }

  /** Works on the boat by hand until `done` (or a limit). */
  workUntil(done: () => boolean, actions = 200): void {
    for (let k = 0; k < actions && !done(); k++) this.workOnBoat();
    if (!done()) throw new Error('the work at the boat did not finish');
  }

  /** Asks Hild for her father's rites at the bier (she must be by it) and goes to them. */
  rites(form: 'SETTING' | 'SEA'): void {
    const r = this.repairs.def.rites;
    const body = findActor(this.onFoot, r.body);
    if (body === null) throw new Error('no body');
    this.goToZone(body.zone);
    const at = tileOf(this.map, body.actor.x, body.actor.y);
    const near = (t: Tile): boolean =>
      Math.max(Math.abs(t.tx - at.tx), Math.abs(t.ty - at.ty)) === 1;
    if (!this.walkTo(near)) throw new Error('no way to the bier');
    this.waitFor(() => this.sim.state.talk === null, 60 * 30);
    this.sim.submit({ type: 'INTERACT_AT', tile: at });
    this.step();
    if (this.sim.state.talk?.scene !== 'hild.rites')
      throw new Error('Hild did not speak of the rites');
    this.waitFor(() => this.options().length > 0, 60 * 30);
    this.choose(form === 'SETTING' ? 'p_steerer.rites.setting' : 'p_steerer.rites.sea');
    this.waitFor(() => this.sim.state.talk === null, 60 * 30);
    const place = form === 'SETTING' ? r.setting : r.sea;
    // Wait for the stones and the body, then go to the place.
    this.waitFor(() => this.sim.state.facts['rites.laid'] === true, 60 * 60 * 30);
    this.goToZone(place.zone);
    const by = (t: Tile): boolean =>
      Math.hypot(t.tx + 0.5 - place.x, t.ty + 0.5 - place.y) < 4 &&
      !tileBlocks(this.map, t.tx, t.ty, this.tideOpen);
    if (!this.walkTo(by)) throw new Error('no way to the rite');
    this.waitFor(() => this.sim.state.facts['ch1.rites'] !== undefined, 60 * 60 * 60);
  }
}

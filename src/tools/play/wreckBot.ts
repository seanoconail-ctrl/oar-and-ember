/**
 * A scripted player for design addendum 2.4's opening (Book 4 section 08, beats 1 to 15): the
 * chest carried up to its outline, the first fire, the sail raised, the first night's fire, his
 * key and his chest, the stores shot down from the mast, and Runa's chest. Built on the launch
 * bot, so it plays the whole chapter (src/tools/play/chapterRun.ts).
 */
import { AIM_DIRECTIONS } from '../../sim/simulation.ts';
import { findActor } from '../../sim/land/zoneLinks.ts';
import { tileOf } from '../../sim/land/zoneMap.ts';
import type { TimeBalance } from '../../content/balance.ts';
import type { CampContext } from '../../sim/home/camp.ts';
import type { Simulation, SimWorldContext } from '../../sim/simulation.ts';
import { OpeningBot } from './openingBot.ts';
import type { Tile } from './openingBot.ts';
import { LaunchBot } from './launchBot.ts';

export class WreckBot extends LaunchBot {
  get #rw() {
    const rw = this.land.wreck?.rw;
    if (rw === undefined) throw new Error('no rework content');
    return rw;
  }

  /** Carries Thorkel's chest from where it lies up to its home by the shelter, and sets it there. */
  chestToCamp(): void {
    const c = this.#rw.chest;
    for (let tries = 0; tries < 12; tries++) {
      this.waitFor(() => this.onFoot.player.winded?.carry !== true, 60 * 60);
      if (this.onFoot.carrying !== c.id) this.lift(c.id);
      this.goToZone(c.home.zone);
      if (this.onFoot.carrying !== c.id) continue;
      const home = { tx: Math.floor(c.home.x), ty: Math.floor(c.home.y) };
      // Stand east of its home and set it down there (facing west).
      if (!this.walkTo((t: Tile) => t.tx === home.tx + 1 && t.ty === home.ty)) continue;
      this.sim.submit({ type: 'INTERACT_AT', tile: home });
      this.step();
      if (this.sim.state.facts['ch1.chest_home'] === true) return;
    }
    throw new Error('could not bring the chest home');
  }

  /** Two pieces of driftwood, then the fire lit (Book 10 section 03, fireLight). */
  firstFire(pieces: readonly string[]): void {
    for (const key of pieces) this.pickUp(key);
    this.doAt('fire');
    if (this.sim.state.facts['ch1.fire_lit'] !== true) throw new Error('the fire did not take');
  }

  /** Waits for Hild to walk up to the camp at the first fire's smoke. */
  waitForHild(maxTicks = 60 * 240): void {
    this.waitFor(() => this.sim.state.facts['ch1.hild_walked_up'] === true, maxTicks);
  }

  /** Raises the sail between the oars (one hands-on action). */
  raiseShelter(): void {
    const c = this.land.wreck?.camp;
    if (c === null || c === undefined) throw new Error('no camp');
    this.goToZone(c.zone);
    const at = { tx: Math.floor(c.shelter.x), ty: Math.floor(c.shelter.y) };
    if (!this.walkTo((t: Tile) => Math.abs(t.tx - at.tx) + Math.abs(t.ty - at.ty) <= 1))
      throw new Error('no way to the sail');
    this.sim.submit({ type: 'INTERACT_AT', tile: at });
    this.step();
    if (this.onFoot.player.work == null) throw new Error('the sail was not taken up');
    this.waitFor(() => this.onFoot.player.work == null, 60 * 30);
    if (this.sim.state.facts['ch1.shelter_raised'] !== true) throw new Error('no shelter');
  }

  /** Sits with Hild by the fire on the first night (the scene plays to its end). */
  fireScene(): void {
    const c = this.land.wreck?.camp;
    if (c === null || c === undefined) throw new Error('no camp');
    this.goToZone(c.zone);
    const fire = { tx: Math.floor(c.fire.x), ty: Math.floor(c.fire.y) };
    this.walkTo((t: Tile) => Math.abs(t.tx - fire.tx) + Math.abs(t.ty - fire.ty) === 2);
    this.waitFor(() => this.sim.state.facts['ch1.fire_scene'] === true, 60 * 300);
  }

  /** Takes Thorkel's key from his body, if Bran did not give it. */
  takeKey(): void {
    if (this.sim.state.facts['ch1.key'] !== undefined) return;
    const id = this.land.wreck?.bran?.body ?? 'C_THORKEL';
    this.goBeside(id);
    const a = this.onFoot.actors[id];
    if (a === undefined) throw new Error('no body');
    this.sim.submit({ type: 'INTERACT_AT', tile: tileOf(this.map, a.x, a.y) });
    this.step();
    if (!('ch1.key' in this.sim.state.facts)) throw new Error('no key');
  }

  /** Opens Thorkel's chest with the key. */
  openChest(): void {
    const id = this.#rw.chest.id;
    this.goBeside(id);
    const a = this.onFoot.actors[id];
    if (a === undefined) throw new Error('no chest');
    this.sim.submit({ type: 'INTERACT_AT', tile: tileOf(this.map, a.x, a.y) });
    this.step();
    if (this.sim.state.facts['ch1.chest_opened'] !== true) throw new Error('the chest stayed shut');
  }

  /**
   * Shoots through the stores' lashing from `from` (tiles, on dry shingle): the bow in hand, the
   * aim at the lashing as drawn, a full draw. Tries a few times; returns the arrows spent.
   */
  shootLashing(from: { x: number; y: number }, tries = 6): number {
    const m = this.#rw.mast;
    this.goToZone(m.zone);
    const at = { tx: Math.floor(from.x), ty: Math.floor(from.y) };
    if (!this.walkTo((t: Tile) => t.tx === at.tx && t.ty === at.ty))
      throw new Error('no way there');
    this.selectItem('ITEM_BOW');
    let spent = 0;
    for (let k = 0; k < tries && this.sim.state.facts['ch1.lashing_cut'] !== true; k++) {
      const p = this.onFoot.player;
      const tile = this.map.tile;
      // The point on the ground the lashing is drawn over: the cursor's ground point.
      const tx = m.lashing.x * tile;
      const ty = m.lashing.y * tile - m.lashing.heightPx;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dir = Math.round((Math.atan2(dy, dx) / (2 * Math.PI)) * AIM_DIRECTIONS);
      const dist = Math.hypot(dx, dy) / tile;
      this.sim.submit({ type: 'AIM', dir, dist });
      this.step(40);
      this.sim.submit({ type: 'AIM', dir: null });
      this.step(40);
      spent++;
    }
    return spent;
  }

  /** Selects a hotbar item. */
  selectItem(item: string): void {
    const slot = this.sim.state.player.hotbar.slots.indexOf(item);
    if (slot < 0) throw new Error(`${item} is not on the hotbar`);
    this.sim.submit({ type: 'SELECT_SLOT', slot });
    this.step();
  }

  /** Wades out for the fallen stores and carries them up to the camp. */
  storesToCamp(): void {
    const m = this.#rw.mast;
    const c = this.land.wreck?.camp;
    if (c === null || c === undefined) throw new Error('no camp');
    for (let tries = 0; tries < 8; tries++) {
      this.waitFor(() => this.onFoot.player.winded?.carry !== true, 60 * 60);
      if (this.onFoot.carrying !== m.bundle) {
        // On the flats it waits for the ebb (decision DE-64).
        try {
          this.lift(m.bundle);
        } catch {
          this.waitForLowWater();
          this.lift(m.bundle);
        }
      }
      this.goToZone(c.zone);
      if (this.onFoot.carrying !== m.bundle) continue;
      const fire = { tx: Math.floor(c.fire.x), ty: Math.floor(c.fire.y) };
      if (!this.walkTo((t: Tile) => t.tx === fire.tx + 2 && t.ty === fire.ty)) continue;
      this.sim.submit({ type: 'INTERACT_AT', tile: { tx: fire.tx + 3, ty: fire.ty } });
      this.step();
      if (this.sim.state.facts['ch1.mast_stores'] === 'CAMP') return;
      this.setDown();
    }
    throw new Error('the stores did not reach the camp');
  }

  /** Brings Runa's tool chest to the camp (by the fire) and sets it down there. */
  runaChestToCamp(): void {
    const id = this.land.wreck?.runa?.tools ?? 'ITEM_RUNA_TOOLS';
    const c = this.land.wreck?.camp;
    if (c === null || c === undefined) throw new Error('no camp');
    for (let tries = 0; tries < 8; tries++) {
      this.waitFor(() => this.onFoot.player.winded?.carry !== true, 60 * 60);
      if (this.onFoot.carrying !== id) this.lift(id);
      this.goToZone(c.zone);
      if (this.onFoot.carrying !== id) continue;
      const fire = { tx: Math.floor(c.fire.x), ty: Math.floor(c.fire.y) };
      if (!this.walkTo((t: Tile) => t.tx === fire.tx + 2 && t.ty === fire.ty + 1)) continue;
      this.setDown();
      if (this.sim.state.facts['runa.tools_at'] !== undefined) return;
    }
    throw new Error("Runa's chest did not reach the camp");
  }

  /** Talks to Runa and names a place for her chest. */
  answerRuna(place: 'FIRE' | 'SHELTER' | 'BOAT'): void {
    const id = this.land.wreck?.runa?.person ?? 'C_RUNA';
    this.talkTo(id);
    this.waitFor(() => this.options().length > 0, 60 * 10);
    this.choose(`ui.talk.runa.place.${place.toLowerCase()}`);
    this.waitFor(() => this.sim.state.talk === null, 60 * 20);
  }

  /** Where someone is now (zone, tiles), for reports. */
  where(id: string): string {
    const f = findActor(this.onFoot, id);
    return f === null
      ? 'nowhere'
      : `${f.zone} ${(f.actor.x / 24).toFixed(1)},${(f.actor.y / 24).toFixed(1)} ${f.actor.pose}`;
  }
}

/**
 * The opening as a new player plays it, to the camp (design addendum 2.4): the seax on the way,
 * Hild cut free and carried up, Thorkel's chest carried to its outline (which reaches the camp
 * and opens its work), and, unless asked not to, the sail raised between the oars.
 */
export function playToCamp(
  sim: Simulation,
  b: TimeBalance,
  land: SimWorldContext,
  camp: CampContext,
  options: { readonly raise?: boolean } = {},
): WreckBot {
  const strand = land.maps.get('ZONE_SK_STRAND');
  if (strand === undefined || land.searches == null || land.repairs == null)
    throw new Error('no strand, searches or repairs');
  const opening = new OpeningBot(sim, strand, b, land);
  opening.pickUp('wreck_seax');
  opening.rescue('C_HILD');
  const bot = new WreckBot(sim, b, land, camp, land.searches, land.repairs);
  bot.waitFor(() => sim.state.facts['ch1.chest_named'] === true, 60 * 30);
  bot.chestToCamp();
  if (options.raise !== false) bot.raiseShelter();
  return bot;
}

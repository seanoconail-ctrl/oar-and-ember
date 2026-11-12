/**
 * A scripted player for Stage 10's three searches (Book 4 section 08, beat 3), for the scenario
 * tests, the golden save and the captures: it carries people and chests up out of the wash and
 * past the Hag's neck, fights, sneaks or bargains at the sheepfold, and leaves the stone an
 * offering or takes the cliff path. It submits commands exactly as the input layer would.
 */
import type { TimeBalance } from '../../content/balance.ts';
import { tideAt } from '../../sim/calendar/calendar.ts';
import { charging, striking } from '../../sim/combat/fighter.ts';
import { STEERER } from '../../sim/land/missiles.ts';
import type { CampContext } from '../../sim/home/camp.ts';
import { findActor } from '../../sim/land/zoneLinks.ts';
import { aboveTideLine, terrainAt, tileBlocks, tileOf } from '../../sim/land/zoneMap.ts';
import { onNeck } from '../../sim/narrative/searches.ts';
import type { SearchContext } from '../../sim/narrative/searches.ts';
import type { Simulation, SimWorldContext } from '../../sim/simulation.ts';
import { CampBot } from './campBot.ts';
import type { Tile } from './openingBot.ts';

export type OddiOrder = 'CHEST_FIRST' | 'ODDI_FIRST';
export type BranApproach = 'FIGHT' | 'SNEAK' | 'BARGAIN';
export type RunaApproach = 'OFFERING' | 'CLIFF_PATH';

export class SearchBot extends CampBot {
  readonly search: SearchContext;
  readonly #b: TimeBalance;

  constructor(
    sim: Simulation,
    b: TimeBalance,
    land: SimWorldContext,
    camp: CampContext,
    search: SearchContext,
  ) {
    super(sim, b, land, camp);
    this.search = search;
    this.#b = b;
  }

  #tideOpen(): boolean {
    return tideAt(this.sim.state.calendar, this.#b).tidalGroundOpen;
  }

  /** Walks beside whoever (or whatever) `id` is, in the zone they are in. */
  goBeside(id: string, avoid: (t: Tile) => boolean = () => false): void {
    const found = findActor(this.onFoot, id);
    if (found === null) throw new Error(`${id} is nowhere`);
    if (found.zone !== this.onFoot.zone) this.goToZone(found.zone);
    const a = this.onFoot.actors[id];
    if (a === undefined) throw new Error(`${id} is not here`);
    const at = tileOf(this.map, a.x, a.y);
    const beside = (t: Tile): boolean =>
      Math.max(Math.abs(t.tx - at.tx), Math.abs(t.ty - at.ty)) === 1;
    if (!this.walkTo(beside, false, 60 * 180, avoid)) throw new Error(`no way to ${id}`);
  }

  /** Lifts `id` from beside them. */
  lift(id: string, avoid: (t: Tile) => boolean = () => false): void {
    this.goBeside(id, avoid);
    const a = this.onFoot.actors[id];
    if (a === undefined) throw new Error(`${id} is not here`);
    this.sim.submit({ type: 'INTERACT_AT', tile: tileOf(this.map, a.x, a.y) });
    this.step();
    if (this.onFoot.carrying !== id) throw new Error(`could not lift ${id}`);
  }

  /** Sets down what is carried on an open tile beside the steerer above the tide line. */
  setDown(): void {
    const map = this.map;
    const p = this.onFoot.player;
    const own = tileOf(map, p.x, p.y);
    const tide = this.#tideOpen();
    const around: Tile[] = [
      { tx: own.tx + 1, ty: own.ty },
      { tx: own.tx - 1, ty: own.ty },
      { tx: own.tx, ty: own.ty + 1 },
      { tx: own.tx, ty: own.ty - 1 },
      { tx: own.tx + 1, ty: own.ty + 1 },
      { tx: own.tx - 1, ty: own.ty - 1 },
      { tx: own.tx + 1, ty: own.ty - 1 },
      { tx: own.tx - 1, ty: own.ty + 1 },
    ];
    for (const t of around) {
      if (tileBlocks(map, t.tx, t.ty, tide) || !aboveTideLine(terrainAt(map, t.tx, t.ty))) continue;
      this.sim.submit({ type: 'INTERACT_AT', tile: t });
      this.step();
      if (this.onFoot.carrying === null) return;
    }
    throw new Error('nowhere to set down');
  }

  /** Carries `id` to the first tile matching `goal` (avoiding `avoid`) and sets it down there. */
  carryTo(id: string, goal: (t: Tile) => boolean, avoid: (t: Tile) => boolean = () => false): void {
    for (let tries = 0; tries < 12; tries++) {
      // A bar run empty sets the load down (Book 10 heavyCarryEmpty): get the breath back, lift it
      // again where it lies, and go on.
      this.waitFor(() => this.onFoot.player.winded?.carry !== true, 60 * 60);
      this.lift(id, avoid);
      if (!this.walkTo(goal, false, 60 * 300, avoid)) throw new Error(`no way to carry ${id}`);
      if (this.onFoot.carrying === id) {
        this.setDown();
        return;
      }
    }
    throw new Error(`could not carry ${id} there`);
  }

  /** Carries someone downed to the safe place at the camp and sets them down there. */
  carryHome(id: string): void {
    const safe = this.land.fight?.def.safePlaces[0];
    if (safe === undefined) throw new Error('no safe place');
    this.lift(id);
    this.goToZone(safe.zone);
    const inside = (t: Tile): boolean =>
      Math.hypot(t.tx + 0.5 - safe.x, t.ty + 0.5 - safe.y) < safe.r - 1.5 &&
      this.#dry(t) &&
      !tileBlocks(this.map, t.tx, t.ty, false);
    if (!this.walkTo(inside)) throw new Error('no way into the camp');
    this.setDown();
  }

  /** A tile above the tide line, of shingle or turf, in the zone in view. */
  #dry = (t: Tile): boolean => {
    const ter = terrainAt(this.map, t.tx, t.ty);
    return (
      aboveTideLine(ter) &&
      [1, -1].every((d) => aboveTideLine(terrainAt(this.map, t.tx + d, t.ty))) &&
      aboveTideLine(terrainAt(this.map, t.tx, t.ty + 1))
    );
  };

  /** Oddi's search: the chest first, or Oddi first (the sea then takes the chest). */
  oddi(order: OddiOrder): void {
    const d = this.search.def.oddi;
    this.goToZone(d.zone);
    const machair = this.search.def.bran.bier.zone;
    const off = (id: string): void => {
      this.lift(id);
      this.goToZone(machair);
      if (!this.walkTo(this.#dry)) throw new Error('nowhere dry');
      this.setDown();
    };
    if (order === 'CHEST_FIRST') {
      off(d.chest.id);
      this.goToZone(d.zone);
    }
    off(d.person);
  }

  /** Runa's search: an offering at the stone, or the cliff path round the neck. */
  runa(approach: RunaApproach): void {
    const d = this.search.def.runa;
    this.goToZone(d.zone);
    this.talkTo(d.person);
    for (;;) {
      this.waitFor(() => this.options().length > 0, 60 * 30);
      const first = this.options()[0] ?? 'ui.talk.leave';
      this.choose(first);
      if (first === 'ui.talk.leave') break;
    }
    this.waitFor(() => this.sim.state.talk === null, 60 * 30);
    const neck = (t: Tile): boolean => onNeck(this.search, this.map, t);
    if (approach === 'OFFERING') {
      const stone = { tx: Math.floor(d.stone.x), ty: Math.floor(d.stone.y - 0.001) };
      const beside = (t: Tile): boolean =>
        Math.max(Math.abs(t.tx - stone.tx), Math.abs(t.ty - stone.ty)) === 1 && t.ty >= stone.ty;
      if (!this.walkTo(beside)) throw new Error('no way to the stone');
      this.sim.submit({ type: 'INTERACT_AT', tile: stone });
      this.step();
      this.waitFor(() => this.options().length > 0, 60 * 30);
      this.choose('p_steerer.search.stone.confess');
      this.waitFor(() => this.sim.state.talk === null, 60 * 30);
    }
    const safe = (t: Tile): boolean =>
      t.tx >= d.safe.x0 + 2 && t.tx <= d.safe.x0 + 6 && t.ty >= 19 && t.ty <= 24;
    this.carryTo(d.tools.id, safe, approach === 'CLIFF_PATH' ? neck : () => false);
    this.waitFor(() => this.sim.state.facts['search.runa'] !== undefined, 60 * 600);
  }

  /** Bran's search: fight the scavengers, sneak to him unseen, or buy the body with the silver. */
  bran(approach: BranApproach): void {
    const d = this.search.def.bran;
    this.goToZone(d.zone);
    const slots = this.sim.state.player.hotbar.slots;
    if (approach === 'FIGHT') {
      const seax = slots.indexOf('ITEM_SEAX');
      if (seax < 0) throw new Error('no seax to fight with');
      this.sim.submit({ type: 'SELECT_SLOT', slot: seax });
      this.step();
      this.fightAll();
      this.waitFor(() => this.sim.state.facts['search.bran'] !== undefined, 60 * 30);
      // Bran downed in it: carried to the camp, he lives (Book 10 broughtHome).
      if (this.onFoot.actors[d.person]?.pose === 'down') this.carryHome(d.person);
      return;
    }
    // Open hands: an empty slot in hand.
    const empty = slots.findIndex((s) => s === null);
    this.sim.submit({ type: 'SELECT_SLOT', slot: empty < 0 ? slots.length : empty });
    this.step();
    if (approach === 'SNEAK') {
      // Round the north of the fold, out of the scavengers' sight, to the back wall.
      for (const [x, y] of [
        [12, 27],
        [22, 20],
        [42, 20],
        [48, 28],
        [43, 36],
      ] as const) {
        const ok = this.walkTo(
          (t) => t.tx === x && t.ty === y,
          false,
          60 * 120,
          () => false,
          true,
        );
        if (!ok) throw new Error(`no way to ${x},${y}`);
      }
      this.sim.submit({ type: 'INTERACT' });
      this.step();
      if (this.sim.state.talk?.scene !== 'bran.guard') throw new Error('Bran did not answer');
      this.waitFor(() => this.options().length > 0, 60 * 30);
      this.choose('p_steerer.search.bran.sneak');
      this.waitFor(() => this.sim.state.facts['search.bran'] !== undefined, 60 * 30);
      return;
    }
    // The bargain: walk up openly in front of them, empty-handed, and speak with Ketill.
    for (const [x, y] of [
      [14, 28],
      [30, 30],
    ] as const)
      if (!this.walkTo((t) => t.tx === x && t.ty === y)) throw new Error(`no way to ${x},${y}`);
    this.waitFor(() => this.onFoot.battle?.parley != null, 60 * 10);
    const ketill = this.onFoot.actors['E_WRECKER_KETILL'];
    if (ketill === undefined) throw new Error('no Ketill');
    const at = tileOf(this.map, ketill.x, ketill.y);
    this.walkTo((t) => Math.abs(t.tx - at.tx) + Math.abs(t.ty - at.ty) === 1 && t.ty < at.ty);
    this.sim.submit({ type: 'INTERACT' });
    this.step();
    if (this.sim.state.talk?.scene !== 'ketill.parley') throw new Error('Ketill did not answer');
    this.waitFor(() => this.options().length > 0, 60 * 30);
    this.choose('p_steerer.search.ketill.silver');
    this.waitFor(() => this.sim.state.facts['search.bran'] !== undefined, 60 * 30);
  }

  /** The scavengers still in the fight (not dead, downed, surrendered or fled). */
  foes(): { id: string; x: number; y: number; d: number }[] {
    const p = this.onFoot.player;
    return Object.entries(this.onFoot.actors)
      .filter(
        ([, a]) =>
          a.fight?.side === 'ENEMY' &&
          a.fight.dead === null &&
          a.fight.f.state !== 'surrendered' &&
          a.fight.f.state !== 'downed' &&
          a.fight.ai.mode !== 'FLEE',
      )
      .map(([id, a]) => ({ id, x: a.x, y: a.y, d: Math.hypot(a.x - p.x, a.y - p.y) }))
      .sort((a, b) => a.d - b.d);
  }

  /**
   * Fights every scavenger to the end as a careful player would (Stage 9's scripted player, S9-29):
   * closes on the nearest, faces whoever is coming and parries just before their blow lands,
   * ripostes the staggered, dodges an arrow about to land, and strikes only into a foe's recovery
   * or stagger, never into a guard.
   */
  fightAll(maxTicks = 60 * 240): void {
    const onFoot = this.onFoot;
    const cb = this.land.fight?.cb;
    if (cb === undefined) throw new Error('no fight content');
    const limit = this.ticks + maxTicks;
    while (this.ticks < limit && this.sim.state.gameOver === null) {
      const ranked = this.foes();
      if (ranked.length === 0) break;
      const p = onFoot.player;
      const pf = p.fight;
      const t = this.sim.state.tick + 1;
      const facingTo = (a: { x: number; y: number }): 's' | 'n' | 'e' | 'w' => {
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
      };
      const ready = pf == null || pf.state === 'idle';
      const stamina = this.sim.state.player.stamina.current;
      const still = { type: 'MOVE', x: 0, y: 0, run: false, sneak: false } as const;
      const nearest = ranked[0];
      const fighterOf = (id: string) => onFoot.actors[id]?.fight?.f;
      const arrow = onFoot.projectiles.find(
        (q) =>
          q.shooter !== STEERER && Math.hypot(q.x - p.x, q.y - p.y) < (q.length / q.ticks) * 10,
      );
      const coming = ranked.find(({ id, d }) => {
        const fa = onFoot.actors[id]?.fight;
        return (
          fa?.ai.target === STEERER &&
          d < 60 &&
          (charging(fa.f) || (striking(fa.f) && t < fa.f.activeAt))
        );
      });
      if (pf?.state === 'chargeL0' && this.sim.state.tick - pf.since > 2)
        this.sim.submit({ type: 'MELEE_RELEASE' });
      if (arrow !== undefined && stamina >= cb.dodge.stamina && ready) {
        this.sim.submit({ type: 'DODGE', x: -arrow.uy, y: arrow.ux });
      } else if (coming !== undefined) {
        const cf = fighterOf(coming.id);
        const want = facingTo(coming);
        if (p.facing !== want && ready) {
          const [x, y] = ({ e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] } as const)[want];
          this.sim.submit({ type: 'MOVE', x, y, run: false, sneak: false });
        } else this.sim.submit(still);
        if (cf !== undefined && striking(cf) && cf.activeAt - t === cb.parry.startup + 2)
          this.sim.submit({ type: 'PARRY' });
      } else if (nearest !== undefined && nearest.d > 26) {
        this.sim.submit({
          type: 'MOVE',
          x: (nearest.x - p.x) / nearest.d,
          y: (nearest.y - p.y) / nearest.d,
          run: false,
          sneak: false,
        });
      } else {
        this.sim.submit(still);
        // Combat v2: a parried foe reels open ('parried'); one whose poise broke staggers.
        const staggered = ranked.find(({ id, d }) => {
          const st = fighterOf(id)?.state;
          return (st === 'parried' || st === 'stagger') && d < 40;
        });
        const punish = ranked.find(({ id, d }) => {
          const f = fighterOf(id);
          // Combat v2: one who has not noticed the steerer is struck (a backstab from behind).
          const unaware = onFoot.actors[id]?.fight?.ai.awareness.state !== 'ALERT';
          if (d < 26 && unaware) return true;
          return (
            d < 34 &&
            f !== undefined &&
            (['stagger', 'parried', 'parryRecovery', 'blockStun', 'guardBroken'].includes(
              f.state,
            ) ||
              (striking(f) && t >= f.activeEnd))
          );
        });
        if (
          pf != null &&
          pf.riposteUntil > t &&
          staggered !== undefined &&
          !charging(pf) &&
          !striking(pf)
        )
          this.sim.submit({ type: 'MELEE', facing: facingTo(staggered) });
        else if (punish !== undefined && stamina >= 30 && ready)
          this.sim.submit({ type: 'MELEE', facing: facingTo(punish) });
      }
      this.step();
    }
    this.stop();
    // Combat v2: a riposte or a blow still under way (and its hitstop) finishes before anything else.
    if (this.sim.state.gameOver === null)
      this.waitFor(() => (onFoot.player.fight?.state ?? 'idle') === 'idle', 60 * 5);
  }
}

/**
 * Combat v2's presentation (Book 7 sections 10, 12 and 14; decisions DE-3, DE-5, DE-7, DE-8, DE-9,
 * DE-10): what the simulation's fight events look like. Hitstop is simulation (the fighters' own
 * clocks are held, so the frames hold too); here are the rest of a hit's reactions, read from the
 * BLOW event: the knockback in the hit's direction (held through the hitstop, then easing back),
 * the one-frame flash (never with reduced motion), sparks off mail and iron, splinters off a
 * shield's boards, the parry's bright star, and the sidestep's dust; the awareness marks; the thin
 * bar over the locked or recently hit enemy; and the bars' fade top left. Presentation only: it
 * never changes the simulation.
 */
import type { Id } from '../core/ids.ts';
import type { OnFootState } from '../sim/land/onFoot.ts';
import { barAlpha, enemyBarShown } from './bars.ts';
import type { BarsBalance } from './bars.ts';
import type { CombatOverlay } from './zoneScene.ts';

/** Ticks a knockback eases back over, once its hitstop ends (presentation). */
const KNOCK_EASE = 6;
/** Frames each effect plays (its sheet's frames, at its ticks a frame: combat24_ui.py). */
const FX: Readonly<Record<string, { readonly frames: number; readonly ticks: number }>> = {
  parry: { frames: 4, ticks: 3 },
  sparks: { frames: 3, ticks: 3 },
  splinters: { frames: 3, ticks: 4 },
  puff: { frames: 3, ticks: 4 },
};

/** Broken shields lying in view at once (the oldest goes first). */
const BROKEN_SHIELDS = 8;

export interface BlowLook {
  readonly attacker: Id;
  readonly defender: Id;
  readonly outcome: string;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly material: string;
  readonly kind?: string;
  readonly hitstop?: number;
  readonly knockback?: number;
}

export class CombatFx {
  readonly #k: BarsBalance;
  readonly #markAlertTicks: number;
  #knocks = new Map<Id, { dx: number; dy: number; from: number; hold: number }>();
  #flash = new Map<Id, number>();
  #hit = new Map<Id, number>();
  #alert = new Map<Id, number>();
  #fx: { kind: string; x: number; y: number; from: number }[] = [];
  /** Design addendum 2.5: telegraph flashes due (who, the tick, reduced to the edge). */
  #tells = new Map<Id, { tick: number; soft: boolean }>();
  /** Broken shields lying where they broke (Book 10 shieldBreaks: it is dropped). */
  #broken: { x: number; y: number }[] = [];
  #health = { value: -1, changed: 0 };
  #stamina = { value: -1, changed: 0 };

  constructor(k: BarsBalance, markAlertTicks: number) {
    this.#k = k;
    this.#markAlertTicks = markAlertTicks;
  }

  /** A blow (melee or missile) met someone: its reactions on the one hit. */
  blow(e: BlowLook, tick: number, reducedMotion: boolean): void {
    const landed = e.outcome === 'HIT' || e.outcome === 'GUARD_BROKEN';
    if (e.outcome === 'PARRIED') {
      this.#fx.push({ kind: 'parry', x: (e.x + e.x - e.dx) / 2, y: e.y - 22, from: tick });
      return;
    }
    if (e.material === 'SHIELD' || e.outcome === 'HOOKED')
      this.#fx.push({
        kind: e.kind === 'missile' ? 'splinters' : 'sparks',
        x: e.x,
        y: e.y - 20,
        from: tick,
      });
    if (!landed) return;
    if (e.material === 'MAIL') this.#fx.push({ kind: 'sparks', x: e.x, y: e.y - 20, from: tick });
    this.#hit.set(e.defender, tick);
    const l = Math.hypot(e.dx, e.dy) || 1;
    const px = e.knockback ?? 0;
    if (px > 0)
      this.#knocks.set(e.defender, {
        dx: (e.dx / l) * px,
        dy: (e.dy / l) * px * 0.5,
        from: tick,
        hold: e.hitstop ?? 0,
      });
    if (!reducedMotion) this.#flash.set(e.defender, tick);
  }

  /** An enemy's awareness changed: the "!" shows a moment on turning alert. */
  awareness(person: Id, state: string, tick: number): void {
    if (state === 'ALERT') this.#alert.set(person, tick);
    else this.#alert.delete(person);
  }

  /**
   * An enemy's telegraph (Book 10 "Telegraphs", flash; Book 7 section 12): a one-frame flash on
   * its weapon two palette steps lighter, never white; with reduced flashes the weapon's edge
   * brightens instead. Its drawn twin of the tell's sound (DF-80: no caption ever).
   */
  telegraph(who: Id, tick: number, reducedFlashes: boolean): void {
    this.#tells.set(who, { tick, soft: reducedFlashes });
  }

  /** A shield broke: its halves lie where it broke for the scene (DF-21). */
  shieldBroken(x: number, y: number): void {
    this.#broken.push({ x, y });
    if (this.#broken.length > BROKEN_SHIELDS) this.#broken.shift();
  }

  /** A new zone: what lay in the last one is not drawn here. */
  clearGround(): void {
    this.#broken = [];
  }

  /** A sidestep's tell: a puff of dust at the feet. */
  sidestep(x: number, y: number, tick: number): void {
    this.#fx.push({ kind: 'puff', x, y: y - 6, from: tick });
  }

  /** What the scene draws of the fight now. */
  overlay(onFoot: OnFootState, tick: number, marksOn: boolean): CombatOverlay {
    const offsets: Record<string, { dx: number; dy: number }> = {};
    for (const [id, k] of this.#knocks) {
      const t = tick - k.from - k.hold;
      if (t >= KNOCK_EASE) {
        this.#knocks.delete(id);
        continue;
      }
      const s = t <= 0 ? 1 : 1 - t / KNOCK_EASE;
      offsets[id] = { dx: Math.round(k.dx * s), dy: Math.round(k.dy * s) };
    }
    const flash: string[] = [];
    for (const [id, at] of this.#flash) {
      if (tick === at || tick === at + 1) flash.push(id);
      else if (tick > at + 1) this.#flash.delete(id);
    }
    const marks: Record<string, '?' | '!'> = {};
    const bars: Record<string, number> = {};
    const lockOn = onFoot.player.stance?.lockOn ?? null;
    for (const [id, a] of Object.entries(onFoot.actors)) {
      const fa = a.fight;
      if (fa?.side !== 'ENEMY' || fa.dead !== null || a.pose === 'dead') continue;
      const aw = fa.ai.awareness.state;
      const alertAt = this.#alert.get(id);
      if (marksOn && aw === 'SUSPICIOUS') marks[id] = '?';
      if (
        marksOn &&
        aw === 'ALERT' &&
        alertAt !== undefined &&
        tick - alertAt < this.#markAlertTicks
      )
        marks[id] = '!';
      const shown = enemyBarShown(
        { locked: lockOn === id, lastHit: this.#hit.get(id) ?? null },
        tick,
        this.#k,
      );
      if (shown) bars[id] = Math.max(0, fa.vitality / Math.max(1, fa.maxVitality));
    }
    const fx: { frame: string; x: number; y: number; decal?: boolean }[] = [];
    for (const b of this.#broken)
      fx.push({ frame: 'shield_broken/-/0', x: b.x, y: b.y - 4, decal: true });
    for (const [id, t] of this.#tells) {
      if (tick !== t.tick) {
        if (tick > t.tick) this.#tells.delete(id);
        continue;
      }
      const who = id === 'P_STEERER' ? onFoot.player : onFoot.actors[id];
      if (who === undefined) continue;
      const side = who.facing === 'w' ? 3 : who.facing === 'e' ? -3 : 0;
      fx.push({ frame: `tell/-/${t.soft ? 1 : 0}`, x: who.x + side, y: who.y - 26 });
    }
    this.#fx = this.#fx.filter((f) => {
      const d = FX[f.kind];
      if (d === undefined) return false;
      const i = Math.floor((tick - f.from) / d.ticks);
      if (i >= d.frames) return false;
      if (i >= 0) fx.push({ frame: `${f.kind}/-/${i}`, x: f.x, y: f.y });
      return true;
    });
    return { offsets, flash, marks, bars, lockOn, fx };
  }

  /**
   * The bars' opacity top left (Book 10 "Bars"): each shows while not full or in a fight, and
   * fades its time after either last changed.
   */
  bars(
    health: { readonly current: number; readonly max: number },
    stamina: { readonly current: number; readonly max: number },
    inFight: boolean,
    tick: number,
  ): { health: number; stamina: number } {
    const h = Math.round(health.current);
    const s = Math.round(stamina.current);
    if (h !== this.#health.value) this.#health = { value: h, changed: tick };
    if (s !== this.#stamina.value) this.#stamina = { value: s, changed: tick };
    const since = tick - Math.max(this.#health.changed, this.#stamina.changed);
    const full = h >= Math.round(health.max) && s >= Math.round(stamina.max);
    const a = barAlpha({ full, inFight, sinceChange: since }, this.#k);
    return { health: a, stamina: a };
  }
}

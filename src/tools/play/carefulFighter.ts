/**
 * The careful scripted player's side of a fight (Stage 9's, S9-29), rebuilt for design addendum
 * 2.5's committed combat: it locks on to the nearest foe, keeps just outside the reach of whoever
 * faces it and lets them come; it reads each enemy's telegraph flash and presses the predictive
 * parry so its live ticks meet the blow (Book 10 "Parry": the press 15 to 22 ticks after the
 * flash), walks in and ripostes the stunned, punishes a foe caught in a recovery, a broken guard
 * or exhausted, dodges an arrow about to land, and backs off to recover its stamina when low. It
 * never mashes: every press is one committed action, judged from what a player sees (the flash,
 * the drawn poses), which the simulation exposes as the fighters' state.
 *
 * Used by the scenario tests (the fold, Seal Cave), the combat tests and the captures.
 */
import type { CombatBalance } from '../../content/combatBalance.ts';
import { charging, free, punishable, striking } from '../../sim/combat/fighter.ts';
import type { Fighter } from '../../sim/combat/fighter.ts';
import { STEERER } from '../../sim/land/missiles.ts';
import type { OnFootState } from '../../sim/land/onFoot.ts';
import type { Command as SimCommand } from '../../sim/simulation.ts';

export interface Foe {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly d: number;
}

/** The scavengers still in the fight (not dead, downed, surrendered or fled), nearest first. */
export function foesOf(onFoot: OnFootState): Foe[] {
  const p = onFoot.player;
  return Object.entries(onFoot.actors)
    .filter(
      ([, a]) =>
        a.fight?.side === 'ENEMY' &&
        a.fight.dead === null &&
        a.fight.f.state !== 'surrendered' &&
        a.fight.f.state !== 'downed' &&
        a.fight.ai.mode !== 'FLEE' &&
        a.fight.ai.mode !== 'LEAVE',
    )
    .map(([id, a]) => ({ id, x: a.x, y: a.y, d: Math.hypot(a.x - p.x, a.y - p.y) }))
    .sort((a, b) => a.d - b.d);
}

/** The first active tick an enemy's attack will have, as its tell shows it, or null. */
export function blowLandsAt(f: Fighter, cb: CombatBalance): number | null {
  if (striking(f) || f.state === 'shove') return f.activeAt;
  if (charging(f) && f.flashAt >= f.since) return f.flashAt + cb.telegraphs.flashLead;
  return null;
}

/** State the careful player keeps between ticks. */
export interface CarefulMemory {
  lockedAt: number;
  pressedAt: number;
}

export function carefulMemory(): CarefulMemory {
  return { lockedAt: -1_000, pressedAt: -1_000 };
}

/**
 * One tick of the careful player: the commands it gives (in order), for the simulation's next
 * tick. `tile` is the zone's tile in pixels; `stamina` the steerer's bar now.
 */
export function carefulTick(
  onFoot: OnFootState,
  cb: CombatBalance,
  tick: number,
  stamina: number,
  staminaMax: number,
  mem: CarefulMemory,
  tile = 24,
): SimCommand[] {
  const out: SimCommand[] = [];
  const ranked = foesOf(onFoot);
  const p = onFoot.player;
  const pf = p.fight ?? null;
  const t = tick + 1;
  const still: SimCommand = { type: 'MOVE', x: 0, y: 0, run: false, sneak: false };
  const nearest = ranked[0];
  if (nearest === undefined) return [still];
  const fighterOf = (id: string): Fighter | undefined => onFoot.actors[id]?.fight?.f;
  const ready = pf == null || free(pf);
  // A light pressed is let go at once (chargeFromPress: released before level 1, a light).
  if (pf?.state === 'chargeL0') out.push({ type: 'MELEE_RELEASE' });
  // Locked on to the nearest foe (its attacks aim at it, DF-81).
  const lock = p.stance?.lockOn ?? null;
  if (
    (lock === null || !ranked.some((f) => f.id === lock)) &&
    nearest.d < 8 * tile &&
    tick - mem.lockedAt > 30
  ) {
    out.push({ type: 'LOCK_ON', down: true }, { type: 'LOCK_ON', down: false });
    mem.lockedAt = tick;
  }
  const away = (f: Foe): SimCommand => ({
    type: 'MOVE',
    x: (p.x - f.x) / Math.max(1e-6, f.d),
    y: (p.y - f.y) / Math.max(1e-6, f.d),
    run: false,
    sneak: false,
  });
  const towards = (f: Foe): SimCommand => ({
    type: 'MOVE',
    x: (f.x - p.x) / Math.max(1e-6, f.d),
    y: (f.y - p.y) / Math.max(1e-6, f.d),
    run: false,
    sneak: false,
  });
  // An arrow about to land: a dodge across its path.
  const arrow = onFoot.projectiles.find(
    (q) => q.shooter !== STEERER && Math.hypot(q.x - p.x, q.y - p.y) < (q.length / q.ticks) * 12,
  );
  if (arrow !== undefined && ready && stamina > 0 && pf?.exhausted !== true) {
    out.push({ type: 'DODGE', x: -arrow.uy, y: arrow.ux });
    return out;
  }
  // A blow coming at the steerer: stand, and parry so its live ticks meet the blow.
  const coming = ranked.find(({ id, d }) => {
    const fa = onFoot.actors[id]?.fight;
    if (fa?.ai.target !== STEERER || d > 3 * tile) return false;
    const at = blowLandsAt(fa.f, cb);
    return at !== null && at >= t;
  });
  if (coming !== undefined) {
    const cf = fighterOf(coming.id);
    const at = cf === undefined ? null : blowLandsAt(cf, cb);
    out.push(still);
    const lead = cb.parry.windup + Math.floor(cb.parry.window / 2);
    if (at !== null && at - t === lead && (ready || pf.state === 'block') && stamina > 0)
      out.push({ type: 'PARRY' });
    return out;
  }
  const ownReach = pf?.weapon == null ? cb.unarmed.reachTiles : cb.weapons[pf.weapon].reachTiles;
  const reachPx = (ownReach + cb.bodyRadiusTiles) * tile;
  // A riposte on the stunned: walk in to its reach, then strike.
  const stunned = ranked.find(({ id }) => fighterOf(id)?.state === 'parried');
  if (pf != null && pf.riposteUntil > t && stunned !== undefined) {
    const ripReach = reachPx + cb.parry.riposteReachExtra * tile;
    if (stunned.d > ripReach * 0.9) {
      out.push(towards(stunned));
      return out;
    }
    out.push(still);
    if (ready) out.push({ type: 'MELEE', facing: p.facing });
    return out;
  }
  // Low on stamina: back off and let it come back (the rhythm of a fight).
  if (stamina < staminaMax * 0.35 || pf?.exhausted === true) {
    out.push(nearest.d < 5 * tile ? away(nearest) : still);
    return out;
  }
  // A foe open to a punish, near: strike it.
  const open = ranked.find(({ id, d }) => {
    const f = fighterOf(id);
    if (f === undefined || d > reachPx * 1.6) return false;
    const unaware = onFoot.actors[id]?.fight?.ai.awareness.state !== 'ALERT';
    return (
      unaware ||
      f.state === 'stagger' ||
      f.state === 'knockdown' ||
      f.state === 'getUp' ||
      punishable(f, t) ||
      f.exhausted
    );
  });
  if (open !== undefined) {
    if (open.d > reachPx * 0.95) out.push(towards(open));
    else {
      out.push(still);
      if (ready && tick - mem.pressedAt > 4) {
        out.push({ type: 'MELEE', facing: p.facing });
        mem.pressedAt = tick;
      }
    }
    return out;
  }
  // Otherwise keep just outside the reach of the nearest foe and let it come.
  const fa = onFoot.actors[nearest.id]?.fight;
  const theirs = fa?.f.weapon == null ? cb.unarmed.reachTiles : cb.weapons[fa.f.weapon].reachTiles;
  const hold = (theirs + cb.bodyRadiusTiles + 0.6) * tile;
  if (fa?.bow === true && (fa.arrows > 0 || fa.ai.sidearmAt < 0)) {
    // An archer: close on it.
    out.push(nearest.d > reachPx * 0.95 ? towards(nearest) : still);
    if (nearest.d <= reachPx && ready && tick - mem.pressedAt > 4) {
      out.push({ type: 'MELEE', facing: p.facing });
      mem.pressedAt = tick;
    }
    return out;
  }
  if (nearest.d > hold + 0.5 * tile) out.push(towards(nearest));
  else if (nearest.d < hold - 0.5 * tile) out.push(away(nearest));
  else out.push(still);
  return out;
}

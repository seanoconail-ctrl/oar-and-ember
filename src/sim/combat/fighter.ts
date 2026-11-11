/**
 * The fighter's state machine (Book 2 section 12, "States" and "Rules"; Book 10 section 06): light
 * combos, the charged heavy with its two levels, parry and riposte, block, blockStun and the
 * broken guard, dodge with its invulnerable ticks, shove, stagger, and the terminal states. Pure
 * and deterministic: the caller gives the tick and a stamina pool, and applies what comes back.
 *
 * Every attack's phases are stored as ticks when it starts (`activeAt`, `activeEnd`,
 * `recoveryEnd`), so a hit stop simply moves them on. How a press becomes a light or a heavy
 * (Book 10 "Fight rules", chargeFromPress): the press starts the charge, the raised weapon being
 * the tell; let go before level1At it is a light attack whose windup counts from the press; held
 * on, it reaches level 1 and level 2 and is released as a heavy, swinging with the weapon's windup.
 *
 * May depend only on core and content (src/sim/combat/README.md).
 */
import type { CombatBalance, MeleeWeaponName, WeaponStats } from '../../content/combatBalance.ts';

export type Facing = 's' | 'n' | 'e' | 'w';

/** Book 2 section 12's states. `move` is never stored: a fighter at `idle` who walks is moving. */
export const COMBAT_STATES = [
  'idle',
  'move',
  'light1',
  'light2',
  'light3',
  'chargeL0',
  'chargeL1',
  'chargeL2',
  'heavyRelease',
  'recovery',
  'parry',
  'parryRecovery',
  'riposte',
  'block',
  'blockStun',
  'guardBroken',
  'dodge',
  'shove',
  'draw',
  'loose',
  'stagger',
  'carry',
  'downed',
  'surrendered',
  'dead',
] as const;
export type CombatState = (typeof COMBAT_STATES)[number];

/** States that strike: they have a windup, active ticks and a recovery. */
export const STRIKES: readonly CombatState[] = [
  'light1',
  'light2',
  'light3',
  'heavyRelease',
  'riposte',
];
export const CHARGES: readonly CombatState[] = ['chargeL0', 'chargeL1', 'chargeL2'];
/** States that end the fight for this person. */
export const OUT_OF_FIGHT: readonly CombatState[] = ['downed', 'surrendered', 'dead'];

export type Armour = 'NONE' | 'PADDED' | 'MAIL';

export interface Fighter {
  state: CombatState;
  /** The tick the state began (a charge: the press). */
  since: number;
  /** The facing the fighter committed to (turning is locked from windup start to recovery end). */
  facing: Facing;
  /** The melee weapon in hand (a Book 10 row), or null: unarmed, shove and dodge only. */
  weapon: MeleeWeaponName | null;
  shield: boolean;
  /** The heavy build (Book 10 section 24): poise, slower windups, heavier hits. */
  heavy: boolean;
  armour: Armour;
  /** The strike's number in its chain (1 to the weapon's combo). */
  combo: number;
  /** A light attack pressed in the chain window, to follow when the recovery ends. */
  queued: boolean;
  /** The charge was let go (a light attack chosen) before its active ticks came. */
  released: boolean;
  /** The charge level a heavy was released at (0 for a light attack). */
  level: 0 | 1 | 2;
  /** Ticks of the strike's phases: active from, active until, recovery until (or a timed state's end). */
  activeAt: number;
  activeEnd: number;
  recoveryEnd: number;
  /** The strike already met someone (one blow per active window). */
  hit: boolean;
  /** This strike is a riposte (after a parry). */
  riposte: boolean;
  /** A riposte may follow until this tick (the parried attacker's stagger). */
  riposteUntil: number;
  /** The block key held: a blow taken returns to the block after its stun. */
  guard: boolean;
  /** A dodge's direction (unit vector). */
  dodge: { readonly x: number; readonly y: number } | null;
}

/** A stamina bar the fighter spends from: the steerer's, or a person's own. */
export interface StaminaPool {
  current: number;
  spentTick: number;
}

export function newFighter(
  weapon: MeleeWeaponName | null,
  opts: { shield?: boolean; heavy?: boolean; armour?: Armour; facing?: Facing } = {},
): Fighter {
  return {
    state: 'idle',
    since: 0,
    facing: opts.facing ?? 's',
    weapon,
    shield: opts.shield ?? false,
    heavy: opts.heavy ?? false,
    armour: opts.armour ?? 'NONE',
    combo: 0,
    queued: false,
    released: false,
    level: 0,
    activeAt: 0,
    activeEnd: 0,
    recoveryEnd: 0,
    hit: false,
    riposte: false,
    riposteUntil: -1,
    guard: false,
    dodge: null,
  };
}

export function weaponOf(f: Fighter, cb: CombatBalance): WeaponStats | null {
  return f.weapon === null ? null : cb.weapons[f.weapon];
}

/** The windup of a strike by this fighter: the weapon's, plus the heavy build's extra. */
export function windupOf(f: Fighter, cb: CombatBalance): number {
  const w = weaponOf(f, cb);
  return w === null ? 0 : w.windup + (f.heavy ? cb.heavy.windupExtra : 0);
}

/**
 * The frame data of an attack kind (Book 10 section 06), with the heavy build's extra windup: the
 * windup, active and recovery ticks, and the tell's lead (ticks from the visible tell to the
 * first active tick, at the soonest).
 */
export function frameData(
  cb: CombatBalance,
  weapon: MeleeWeaponName,
  kind: 'light' | 'heavy1' | 'heavy2' | 'riposte',
  heavyBuild = false,
): { windup: number; active: number; recovery: number; tellLead: number } {
  const w = cb.weapons[weapon];
  const windup = w.windup + (heavyBuild ? cb.heavy.windupExtra : 0);
  if (kind === 'light' || kind === 'riposte')
    return { windup, active: w.active, recovery: w.recovery, tellLead: windup };
  // A heavy's tell is the raised weapon from the press; its level's own tell (the glint, the
  // flash and sound) comes at the level's tick, and the release swings with the windup after it.
  return {
    windup,
    active: w.active,
    recovery: w.recovery + cb.charge.releaseRecoveryExtra,
    tellLead: windup,
  };
}

/** Whether a fighter can act on a new press (not mid-strike, not out of the fight). */
export function free(f: Fighter): boolean {
  return f.state === 'idle';
}

export function striking(f: Fighter): boolean {
  return STRIKES.includes(f.state);
}

export function charging(f: Fighter): boolean {
  return CHARGES.includes(f.state);
}

/** Facing is locked from windup start to recovery end, and while committed to a defence. */
export function facingLocked(f: Fighter): boolean {
  return f.state !== 'idle' && f.state !== 'block';
}

/** The feet are planted (Book 2: attacks commit), except while charging, which walks slowly. */
export function feetPlanted(f: Fighter): boolean {
  return f.state !== 'idle' && !charging(f) && f.state !== 'dodge';
}

/** Which phase of a strike the tick is in. */
export function strikePhase(f: Fighter, tick: number): 'windup' | 'active' | 'recovery' | null {
  if (!striking(f) && f.state !== 'shove') return null;
  if (tick < f.activeAt) return 'windup';
  if (tick < f.activeEnd) return 'active';
  return 'recovery';
}

/** The dodge's invulnerable ticks (Book 10: ticks 4 to 13 of the dodge). */
export function invulnerable(f: Fighter, tick: number, cb: CombatBalance): boolean {
  if (f.state !== 'dodge') return false;
  const t = tick - f.since;
  return t >= cb.dodge.invulnFrom && t <= cb.dodge.invulnTo;
}

/** The parry's active window (startup, then the window: Book 10, with the difficulty option). */
export function parrying(f: Fighter, tick: number, cb: CombatBalance, window: number): boolean {
  if (f.state !== 'parry') return false;
  const t = tick - f.since;
  return t >= cb.parry.startup && t < cb.parry.startup + window;
}

export type PressResult = 'STARTED' | 'QUEUED' | 'REFUSED' | 'NO_STAMINA' | 'NO_SHIELD';

function spend(pool: StaminaPool, amount: number, tick: number): void {
  pool.current = Math.max(0, pool.current - amount);
  pool.spentTick = tick;
}

/**
 * The attack button pressed: the charge begins (its raised weapon is the tell), or in a strike's
 * chain window the next light attack is queued, or after a parry a riposte begins.
 */
export function pressAttack(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  facing: Facing,
  pool: StaminaPool,
): PressResult {
  const w = weaponOf(f, cb);
  if (w === null) return 'REFUSED';
  if (striking(f) && f.state !== 'heavyRelease') {
    // The chain window: the last chain-window ticks of the recovery (Book 10 "Fight rules").
    const inWindow = tick >= f.recoveryEnd - w.chainWindow && tick < f.recoveryEnd;
    if (inWindow && f.combo < w.combo && !f.riposte) {
      if (pool.current < w.stamina) return 'NO_STAMINA';
      f.queued = true;
      return 'QUEUED';
    }
    return 'REFUSED';
  }
  if (!free(f)) return 'REFUSED';
  if (pool.current < w.stamina) return 'NO_STAMINA';
  f.facing = facing;
  if (tick < f.riposteUntil) {
    // A riposte: a light strike at riposte damage, straight from the press.
    beginStrike(f, 'riposte', tick, tick + windupOf(f, cb), w, cb, 0);
    spend(pool, w.stamina, tick);
    f.riposteUntil = -1;
    return 'STARTED';
  }
  f.state = 'chargeL0';
  f.since = tick;
  f.released = false;
  f.level = 0;
  f.combo = 0;
  return 'STARTED';
}

function beginStrike(
  f: Fighter,
  state: CombatState,
  tick: number,
  activeAt: number,
  w: WeaponStats,
  cb: CombatBalance,
  level: 0 | 1 | 2,
): void {
  f.state = state;
  f.since = tick;
  f.activeAt = activeAt;
  f.activeEnd = activeAt + w.active;
  f.recoveryEnd =
    f.activeEnd + w.recovery + (state === 'heavyRelease' ? cb.charge.releaseRecoveryExtra : 0);
  f.hit = false;
  f.queued = false;
  f.level = level;
  f.riposte = state === 'riposte';
  if (state === 'light1' || state === 'riposte') f.combo = 1;
}

/**
 * The attack button let go. Before level 1 the charge becomes a light attack (its windup counted
 * from the press: the active ticks come at the windup's end or now, whichever is later); from
 * level 1 it is released as a heavy, spending the level's stamina (a level the pool cannot pay
 * for falls back a level).
 */
export function releaseAttack(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  pool: StaminaPool,
): void {
  const w = weaponOf(f, cb);
  if (w === null || !charging(f)) return;
  const pressed = f.since;
  let level: 0 | 1 | 2 = f.state === 'chargeL2' ? 2 : f.state === 'chargeL1' ? 1 : 0;
  if (level === 2 && pool.current < w.stamina * cb.charge.staminaL2) level = 1;
  if (level === 1 && pool.current < w.stamina * cb.charge.staminaL1) level = 0;
  if (level === 0) {
    beginStrike(f, 'light1', pressed, Math.max(pressed + windupOf(f, cb), tick), w, cb, 0);
    spend(pool, w.stamina, tick);
    return;
  }
  beginStrike(f, 'heavyRelease', tick, tick + windupOf(f, cb), w, cb, level);
  spend(pool, w.stamina * (level === 2 ? cb.charge.staminaL2 : cb.charge.staminaL1), tick);
}

/** The parry key: a timed press (Book 10: startup, window, recovery on a miss). */
export function pressParry(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  pool: StaminaPool,
): PressResult {
  if (!free(f) && f.state !== 'block') return 'REFUSED';
  if (f.weapon === null && !f.shield) return 'REFUSED';
  if (pool.current < cb.parry.cost) return 'NO_STAMINA';
  spend(pool, cb.parry.cost, tick);
  f.state = 'parry';
  f.since = tick;
  f.recoveryEnd = tick + cb.parry.startup + cb.parry.window;
  return 'STARTED';
}

/** The block key held or let go. Only a shield blocks (Book 10 "Fight rules", blockNeedsShield). */
export function setBlock(f: Fighter, on: boolean, tick: number): PressResult {
  f.guard = on && f.shield;
  if (!on) {
    if (f.state === 'block') {
      f.state = 'idle';
      f.since = tick;
    }
    return 'STARTED';
  }
  if (!f.shield) return 'NO_SHIELD';
  if (f.state === 'idle') {
    f.state = 'block';
    f.since = tick;
  }
  return 'STARTED';
}

/** The dodge key: a short committed move with brief invulnerability, along `dir`. */
export function pressDodge(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  dir: { x: number; y: number } | null,
  pool: StaminaPool,
): PressResult {
  if (!free(f) && f.state !== 'block' && !charging(f)) return 'REFUSED';
  if (pool.current < cb.dodge.stamina) return 'NO_STAMINA';
  spend(pool, cb.dodge.stamina, tick);
  const back = { s: [0, -1], n: [0, 1], e: [-1, 0], w: [1, 0] }[f.facing] as [number, number];
  const d = dir === null || Math.hypot(dir.x, dir.y) < 1e-6 ? { x: back[0], y: back[1] } : dir;
  const len = Math.hypot(d.x, d.y);
  f.state = 'dodge';
  f.since = tick;
  f.dodge = { x: d.x / len, y: d.y / len };
  f.recoveryEnd = tick + cb.dodge.ticks;
  return 'STARTED';
}

/** The shove: breaks a block and makes space (Book 10: stamina, stagger; "Fight rules" timing). */
export function pressShove(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  facing: Facing,
  pool: StaminaPool,
): PressResult {
  if (!free(f) && f.state !== 'block') return 'REFUSED';
  if (pool.current < cb.shove.stamina) return 'NO_STAMINA';
  spend(pool, cb.shove.stamina, tick);
  f.facing = facing;
  f.state = 'shove';
  f.since = tick;
  f.activeAt = tick + cb.shove.windup;
  f.activeEnd = f.activeAt + cb.shove.active;
  f.recoveryEnd = f.activeEnd + cb.shove.recovery;
  f.hit = false;
  return 'STARTED';
}

/** A timed state (stagger, blockStun, guardBroken) until `ticks` from now. */
export function enterTimed(
  f: Fighter,
  state: 'stagger' | 'blockStun' | 'guardBroken' | 'parryRecovery',
  tick: number,
  ticks: number,
): void {
  f.state = state;
  f.since = tick;
  f.recoveryEnd = tick + ticks;
  f.queued = false;
  f.hit = false;
}

export type FighterEvent =
  | { readonly type: 'CHARGE_LEVEL'; readonly level: 1 | 2 }
  | { readonly type: 'AUTO_RELEASE' }
  | { readonly type: 'ACTIVE' }
  | { readonly type: 'STATE_ENDED'; readonly state: CombatState };

/**
 * One tick of the fighter's own clock: the charge's levels and its maximum hold, a strike's active
 * ticks beginning, a queued chain following its recovery, and timed states ending. Hits are the
 * caller's (it knows where everyone stands).
 */
export function stepFighter(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  pool: StaminaPool,
): FighterEvent[] {
  const out: FighterEvent[] = [];
  const w = weaponOf(f, cb);
  if (charging(f)) {
    const held = tick - f.since;
    if (f.state === 'chargeL0' && held >= cb.charge.level1At) {
      f.state = 'chargeL1';
      out.push({ type: 'CHARGE_LEVEL', level: 1 });
    }
    if (f.state === 'chargeL1' && held >= cb.charge.level2At) {
      f.state = 'chargeL2';
      out.push({ type: 'CHARGE_LEVEL', level: 2 });
    }
    if (held >= cb.charge.maxHold) {
      out.push({ type: 'AUTO_RELEASE' });
      releaseAttack(f, tick, cb, pool);
    }
    return out;
  }
  if (striking(f) || f.state === 'shove') {
    if (tick === f.activeAt) out.push({ type: 'ACTIVE' });
    if (tick >= f.recoveryEnd) {
      const ended = f.state;
      if (f.queued && w !== null && (ended === 'light1' || ended === 'light2')) {
        const next = ended === 'light1' ? 'light2' : 'light3';
        const combo = f.combo + 1;
        beginStrike(f, next, tick, tick + windupOf(f, cb), w, cb, 0);
        f.combo = combo;
        spend(pool, w.stamina, tick);
      } else {
        f.state = 'idle';
        f.since = tick;
        f.combo = 0;
        f.queued = false;
      }
      out.push({ type: 'STATE_ENDED', state: ended });
    }
    return out;
  }
  if (
    (f.state === 'parry' ||
      f.state === 'parryRecovery' ||
      f.state === 'stagger' ||
      f.state === 'blockStun' ||
      f.state === 'guardBroken' ||
      f.state === 'dodge') &&
    tick >= f.recoveryEnd
  ) {
    const ended = f.state;
    if (ended === 'parry') {
      // The window passed with nothing parried: the recovery on a miss.
      enterTimed(f, 'parryRecovery', tick, cb.parry.recoveryOnMiss);
    } else {
      f.state = f.guard && f.shield && ended !== 'guardBroken' ? 'block' : 'idle';
      f.since = tick;
      f.dodge = null;
    }
    out.push({ type: 'STATE_ENDED', state: ended });
  }
  return out;
}

/** Moves every tick of the fighter's current phase on by `ticks` (a hit stop). */
export function hold(f: Fighter, ticks: number): void {
  f.since += ticks;
  f.activeAt += ticks;
  f.activeEnd += ticks;
  f.recoveryEnd += ticks;
  if (f.riposteUntil >= 0) f.riposteUntil += ticks;
}

/** What a blow did. */
export type Outcome = 'DODGED' | 'PARRIED' | 'BLOCKED' | 'GUARD_BROKEN' | 'HIT';

export interface Blow {
  /** Damage before armour (the defender's armour and berserk apply in `damageOf`). */
  readonly damage: number;
  /** What it costs a shield. */
  readonly vsShield: number;
  /** A level-2 charge: unblockable, parryable. */
  readonly guardBreak: boolean;
  /** A light blow (poise ignores it). */
  readonly light: boolean;
  readonly cut: boolean;
}

/** The blow of an attacker's current strike (Book 10 section 06 and the charged heavy). */
export function blowOf(f: Fighter, cb: CombatBalance, opts: { berserk?: boolean } = {}): Blow {
  const w = weaponOf(f, cb);
  if (w === null) return { damage: 0, vsShield: 0, guardBreak: false, light: true, cut: false };
  let mult = 1;
  let shieldMult = 1;
  if (f.state === 'heavyRelease') {
    mult = f.level === 2 ? cb.charge.level2Damage : cb.charge.level1.damage;
    shieldMult = f.level === 2 ? cb.charge.level2Damage : cb.charge.level1.vsShield;
  }
  if (f.riposte) mult *= cb.parry.riposte;
  if (f.heavy) mult *= cb.heavy.damage;
  if (opts.berserk === true) mult *= cb.berserk.damage;
  return {
    damage: w.damage * mult,
    vsShield: w.vsShield * shieldMult,
    guardBreak: f.state === 'heavyRelease' && f.level === 2,
    light: f.state !== 'heavyRelease' && !f.riposte,
    cut: w.name !== 'Spear',
  };
}

/** Damage after armour (Book 10: padded -10% all; mail -30% cut, -15% thrust and missiles). */
export function damageOf(
  blow: { readonly damage: number; readonly cut: boolean },
  armour: Armour,
  cb: CombatBalance,
  berserkDefender = false,
): number {
  const a =
    armour === 'PADDED'
      ? cb.armour.padded
      : armour === 'MAIL'
        ? blow.cut
          ? cb.armour.mailCut
          : cb.armour.mailThrust
        : 0;
  const d = blow.damage * (1 - a) * (berserkDefender ? 1 / cb.berserk.defence : 1);
  return Math.round(d * 10) / 10;
}

/** Whether `from` (a point) lies within `arcDegrees` in front of a fighter facing `facing`. */
export function inFront(facing: Facing, dx: number, dy: number, arcDegrees: number): boolean {
  const [fx, fy] = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[facing] as [number, number];
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return true;
  return (fx * dx + fy * dy) / d >= Math.cos(((arcDegrees / 2) * Math.PI) / 180) - 1e-9;
}

/**
 * Resolves a blow against a defender (Book 2 section 12): a dodge's invulnerable ticks, then a
 * parry in its window from the front, then a raised shield from the front (a level-2 charge breaks
 * it and lands), else a hit. `attackerDir` is the vector from the defender to the attacker.
 * Changes the defender's state (and, for a parry, the attacker's) and returns the outcome and the
 * stamina the shield cost.
 */
export function resolveBlow(
  attacker: Fighter,
  defender: Fighter,
  blow: Blow,
  attackerDir: { readonly x: number; readonly y: number },
  tick: number,
  cb: CombatBalance,
  parryWindow: number,
  pool: StaminaPool,
): Outcome {
  if (invulnerable(defender, tick, cb)) return 'DODGED';
  const front = (arc: number): boolean =>
    inFront(defender.facing, attackerDir.x, attackerDir.y, arc);
  if (parrying(defender, tick, cb, parryWindow) && front(cb.block.arcDegrees)) {
    // Success: the attacker staggers, the parry's cost comes back, a riposte is open.
    pool.current += cb.parry.cost;
    defender.state = 'idle';
    defender.since = tick;
    defender.riposteUntil = tick + cb.parry.stagger;
    enterTimed(attacker, 'stagger', tick, cb.parry.stagger);
    return 'PARRIED';
  }
  const raised = defender.shield && (defender.state === 'block' || defender.state === 'blockStun');
  if (raised && front(cb.block.arcDegrees)) {
    if (blow.guardBreak) {
      enterTimed(defender, 'guardBroken', tick, cb.block.guardBreak);
      return 'GUARD_BROKEN';
    }
    pool.current = Math.max(0, pool.current - cb.block.costFactor * blow.vsShield);
    pool.spentTick = tick;
    if (pool.current <= 0) enterTimed(defender, 'guardBroken', tick, cb.block.guardBreak);
    else enterTimed(defender, 'blockStun', tick, cb.block.stun);
    return 'BLOCKED';
  }
  return 'HIT';
}

/** After a blow lands: the defender staggers, unless poise holds against a light blow. */
export function staggerOnHit(
  defender: Fighter,
  blow: Blow,
  tick: number,
  cb: CombatBalance,
): boolean {
  if (OUT_OF_FIGHT.includes(defender.state)) return false;
  if (defender.heavy && blow.light) return false;
  if (defender.state === 'guardBroken') return false;
  enterTimed(defender, 'stagger', tick, cb.hitStagger);
  return true;
}

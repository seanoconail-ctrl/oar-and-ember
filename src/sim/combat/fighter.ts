/**
 * The fighter's state machine (Book 2 section 12, "States", "Combat v2" and "Rules"; Book 10
 * section 06): light combos, the charged heavy with its two levels, the lunge, parry and riposte,
 * block with its stamina cost and the broken guard, dodge with its invulnerable ticks, shove,
 * poise with its flinch, stagger and knockdown, the backstab, the sidestep from a missile, healing,
 * hitstop, exhaustion and the terminal states. Pure and deterministic: the caller gives the tick
 * and a stamina pool, and applies what comes back.
 *
 * Combat v2 (decisions DE-1 to DE-10): the facing is continuous (`angle`, radians, 0 east, y
 * south), drawn in the nearest of the four facings (`facing`); attacks commit (a windup may turn a
 * little, an active or recovering strike not at all); a hit wears poise rather than staggering;
 * hitstop freezes a fighter's own clock for its ticks (both fighters of a blow), so a replay is
 * exact. How a press becomes a light or a heavy is still Book 10's chargeFromPress: the press
 * starts the charge (the raised weapon is the tell); let go before level1At it is a light attack
 * whose windup counts from the press; held on, it is released as a heavy.
 *
 * May depend only on core and content (src/sim/combat/README.md).
 */
import type {
  CombatBalance,
  DamageType,
  MeleeWeaponName,
  WeaponStats,
} from '../../content/combatBalance.ts';
import type { Id } from '../../core/ids.ts';

export type Facing = 's' | 'n' | 'e' | 'w';

/**
 * Book 2 section 12's states, with combat v2's (decisions DE-1 to DE-10). `move` is never stored
 * (a fighter at `idle` who walks is moving), nor is `flinch` (drawn from `flinchUntil`, it never
 * stops what the fighter is doing).
 */
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
  'lunge',
  'parried',
  'backstab',
  'flinch',
  'knockdown',
  'getUp',
  'sidestep',
  'heal',
] as const;
export type CombatState = (typeof COMBAT_STATES)[number];

/** States that strike: they have a windup, active ticks and a recovery. */
export const STRIKES: readonly CombatState[] = [
  'light1',
  'light2',
  'light3',
  'heavyRelease',
  'riposte',
  'lunge',
  'backstab',
];
export const CHARGES: readonly CombatState[] = ['chargeL0', 'chargeL1', 'chargeL2'];
/** States that end the fight for this person. */
export const OUT_OF_FIGHT: readonly CombatState[] = ['downed', 'surrendered', 'dead'];
/** Timed states that end at `recoveryEnd`. */
const TIMED: readonly CombatState[] = [
  'parry',
  'parryRecovery',
  'stagger',
  'blockStun',
  'guardBroken',
  'dodge',
  'parried',
  'knockdown',
  'getUp',
  'sidestep',
  'heal',
];

export type Armour = 'NONE' | 'PADDED' | 'MAIL';

/** A heal under way (Book 10 "Health, stamina and healing"): what, and where it began. */
export interface HealUnderWay {
  readonly kind: 'BIND' | 'EAT';
  readonly x: number;
  readonly y: number;
}

export interface Fighter {
  state: CombatState;
  /** The tick the state began (a charge: the press). */
  since: number;
  /** The nearest of the four facings to `angle`: how the body is drawn. */
  facing: Facing;
  /** The true facing, radians (0 east, y south): strike arcs, shields and backs use it. */
  angle: number;
  /** The melee weapon in hand (a Book 10 row), or null: unarmed, shove and dodge only. */
  weapon: MeleeWeaponName | null;
  shield: boolean;
  /** The heavy build (Book 10 section 24): more poise, slower windups, heavier hits. */
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
  /** A riposte may follow until this tick (the parried attacker reels open). */
  riposteUntil: number;
  /** The block key held: a blow taken returns to the block after its stun. */
  guard: boolean;
  /** A dodge's or sidestep's direction (unit vector). */
  dodge: { readonly x: number; readonly y: number } | null;
  /** Poise worn away (0: whole), and the tick of the last hit (it refills after Book 10's pause). */
  poiseLost: number;
  poiseAt: number;
  /** Ticks of hitstop left: the fighter's own clock is frozen (decision DE-7). */
  hitstop: number;
  /** At 0 stamina until back to Book 10's recoverAt: no dodge or run, slower windups. */
  exhausted: boolean;
  /** Drawn flinching until this tick (a hit that did not break poise). */
  flinchUntil: number;
  /** Guard breaks taken with this shield (it breaks after Book 10's number). */
  shieldBreaks: number;
  /** An axe hooked the shield aside: the next block costs double until it is used. */
  hookedUntil: number;
  /** A lunge's ground: tiles covered over its windup, from `from` (ticks), along `angle`. */
  lunge: { readonly tiles: number; readonly from: number } | null;
  /** The one a riposte or backstab is aimed at, or a sidestep reads (missile number as text). */
  target: Id | null;
  /** A heal under way. */
  heal: HealUnderWay | null;
  /** Extra windup on the next strike (a spear with a foe inside its reach, Weapon rules). */
  windupExtra: number;
  /** The facing an attack began at: its windup turns at most Book 10's attackTurn from it. */
  turnFrom: number;
}

/** A stamina bar the fighter spends from: the steerer's, or a person's own. */
export interface StaminaPool {
  current: number;
  spentTick: number;
}

/** Book 2 section 12's four facings as an angle (radians, 0 east, y south). */
export const FACING_ANGLE: Readonly<Record<Facing, number>> = {
  e: 0,
  s: Math.PI / 2,
  w: Math.PI,
  n: -Math.PI / 2,
};

/** The nearest of the four drawn facings to an angle (Book 10 drawnFacing). */
export function facingOfAngle(angle: number): Facing {
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? 'e' : 'w';
  return y > 0 ? 's' : 'n';
}

/** An angle wrapped to (-pi, pi]. */
export function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
}

/** Turns `from` towards `to` by at most `maxRadians`. */
export function turnTowards(from: number, to: number, maxRadians: number): number {
  const d = wrapAngle(to - from);
  if (Math.abs(d) <= maxRadians) return wrapAngle(to);
  return wrapAngle(from + Math.sign(d) * maxRadians);
}

/** Sets a fighter's true facing and its drawn one. */
export function setAngle(f: Fighter, angle: number): void {
  f.angle = wrapAngle(angle);
  f.facing = facingOfAngle(f.angle);
}

export function newFighter(
  weapon: MeleeWeaponName | null,
  opts: { shield?: boolean; heavy?: boolean; armour?: Armour; facing?: Facing } = {},
): Fighter {
  const facing = opts.facing ?? 's';
  return {
    state: 'idle',
    since: 0,
    facing,
    angle: FACING_ANGLE[facing],
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
    poiseLost: 0,
    poiseAt: -1,
    hitstop: 0,
    exhausted: false,
    flinchUntil: -1,
    shieldBreaks: 0,
    hookedUntil: -1,
    lunge: null,
    target: null,
    heal: null,
    windupExtra: 0,
    turnFrom: FACING_ANGLE[facing],
  };
}

export function weaponOf(f: Fighter, cb: CombatBalance): WeaponStats | null {
  return f.weapon === null ? null : cb.weapons[f.weapon];
}

/** How much longer an exhausted fighter's windups and recoveries are (Book 10 exhausted). */
function slow(f: Fighter, cb: CombatBalance, ticks: number): number {
  return f.exhausted ? Math.round(ticks * cb.stamina.exhaustedSlow) : ticks;
}

/** The windup of a strike by this fighter: the weapon's, the heavy build's extra, exhaustion. */
export function windupOf(f: Fighter, cb: CombatBalance, extra = 0): number {
  const w = weaponOf(f, cb);
  return w === null ? 0 : slow(f, cb, w.windup + (f.heavy ? cb.heavy.windupExtra : 0) + extra);
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
  if (kind === 'riposte') {
    const r = riposteFrames(cb, weapon);
    return { ...r, tellLead: r.windup };
  }
  const windup = w.windup + (heavyBuild ? cb.heavy.windupExtra : 0);
  if (kind === 'light') return { windup, active: w.active, recovery: w.recovery, tellLead: windup };
  return {
    windup,
    active: w.active,
    recovery: w.recovery + cb.charge.releaseRecoveryExtra,
    tellLead: windup,
  };
}

/** A riposte's frames (Book 10 riposteTicks and riposteFrames): 40% windup, active, the rest. */
export function riposteFrames(
  cb: CombatBalance,
  weapon: MeleeWeaponName,
): { windup: number; active: number; recovery: number } {
  return splitFrames(cb, cb.parry.riposteTicks[weapon], cb.weapons[weapon].active);
}

/** A backstab's frames (Book 10 backstabTicks, backstabFrames). */
export function backstabFrames(
  cb: CombatBalance,
  ticks: number,
  weapon: MeleeWeaponName,
): { windup: number; active: number; recovery: number } {
  return splitFrames(cb, ticks, cb.weapons[weapon].active);
}

function splitFrames(
  cb: CombatBalance,
  total: number,
  active: number,
): { windup: number; active: number; recovery: number } {
  const windup = Math.round(total * cb.parry.windupShare);
  return { windup, active, recovery: Math.max(1, total - windup - active) };
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

/**
 * Attacks commit (Book 10 attackTurn): a windup may turn a little, from the first active tick to
 * the end of recovery not at all; defences and the timed states hold the facing too.
 */
export function facingLocked(f: Fighter, tick?: number): boolean {
  if (f.state === 'idle' || f.state === 'block' || f.state === 'heal') return false;
  if (charging(f)) return false;
  if (striking(f) && tick !== undefined && tick < f.activeAt) return false;
  return true;
}

/** How far a windup may still turn: Book 10 attackTurn, from the facing the strike began at. */
export function windupTurnLeft(f: Fighter, tick: number): boolean {
  return (charging(f) || striking(f)) && tick < f.activeAt;
}

/**
 * The feet are planted (Book 2: attacks commit), except while charging (a slow walk), dodging or
 * sidestepping (moved by the fight), healing (a step ends it) and at ease.
 */
export function feetPlanted(f: Fighter): boolean {
  if (f.hitstop > 0) return true;
  return (
    f.state !== 'idle' &&
    !charging(f) &&
    f.state !== 'dodge' &&
    f.state !== 'sidestep' &&
    f.state !== 'heal'
  );
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

/** The parry's window: Book 10's (with the option), and the sword's extra ticks. */
export function parryWindowOf(f: Fighter, cb: CombatBalance, window: number): number {
  return window + (f.weapon === 'Sword' ? cb.parry.swordExtra : 0);
}

/** The parry's active window (startup, then the window). */
export function parrying(f: Fighter, tick: number, cb: CombatBalance, window: number): boolean {
  if (f.state !== 'parry') return false;
  const t = tick - f.since;
  return t >= cb.parry.startup && t < cb.parry.startup + parryWindowOf(f, cb, window);
}

/** A fighter's whole poise (Book 10 "Poise": by build and armour). */
export function poiseMax(f: Fighter, cb: CombatBalance): number {
  const base = f.heavy ? cb.poise.heavy : cb.poise.ordinary;
  const armour = f.armour === 'MAIL' ? cb.poise.mail : f.armour === 'PADDED' ? cb.poise.padded : 0;
  return base + armour;
}

export type PressResult = 'STARTED' | 'QUEUED' | 'REFUSED' | 'NO_STAMINA' | 'NO_SHIELD';

function spend(pool: StaminaPool, amount: number, tick: number): void {
  pool.current = Math.max(0, pool.current - amount);
  pool.spentTick = tick;
}

/** Exhaustion follows the bar (Book 10 exhausted): at 0 until back to recoverAt. */
export function updateExhausted(f: Fighter, pool: StaminaPool, cb: CombatBalance): void {
  if (pool.current <= 0) f.exhausted = true;
  else if (f.exhausted && pool.current >= cb.stamina.recoverAt) f.exhausted = false;
}

/** What kind of attack a press makes (decided by the caller from the zone). */
export interface PressKind {
  /** Running at the faced direction, or at a locked target beyond reach (Book 10 lungeWhen). */
  readonly lunge?: boolean;
  /** An unaware foe's back within reach (Book 10 "Sneak attacks"). */
  readonly backstab?: Id | null;
  /** A spear with a foe nearer than spearInside: its windup is longer (Weapon rules). */
  readonly inside?: boolean;
  /** The riposte's target, the parried foe in reach. */
  readonly riposteAt?: Id | null;
}

/**
 * The attack button pressed: the charge begins (its raised weapon is the tell), or in a strike's
 * chain window the next light attack is queued, or after a parry a riposte begins, or on an
 * unaware back a backstab, or running in a lunge.
 */
export function pressAttack(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  facing: number | Facing,
  pool: StaminaPool,
  kind: PressKind = {},
): PressResult {
  const angle = typeof facing === 'number' ? facing : FACING_ANGLE[facing];
  const w = weaponOf(f, cb);
  if (w === null) return 'REFUSED';
  if (striking(f) && f.state !== 'heavyRelease' && !f.riposte && f.state !== 'lunge') {
    if (f.state === 'backstab') return 'REFUSED';
    // The chain window: the last chain-window ticks of the recovery (Book 10 "Fight rules").
    const inWindow = tick >= f.recoveryEnd - w.chainWindow && tick < f.recoveryEnd;
    if (inWindow && f.combo < w.combo) {
      if (pool.current < w.stamina) return 'NO_STAMINA';
      f.queued = true;
      return 'QUEUED';
    }
    return 'REFUSED';
  }
  if (!free(f)) return 'REFUSED';
  if (pool.current < w.stamina) return 'NO_STAMINA';
  setAngle(f, angle);
  f.target = null;
  if (tick < f.riposteUntil) {
    // A riposte (Book 10 "Parry and riposte"): heavy, distinct and committed.
    const r = riposteFrames(cb, w.name);
    beginStrike(f, 'riposte', tick, tick + r.windup, r.active, r.recovery, 0);
    f.target = kind.riposteAt ?? null;
    spend(pool, w.stamina, tick);
    f.riposteUntil = -1;
    return 'STARTED';
  }
  f.riposteUntil = -1;
  if (kind.backstab != null) {
    return pressBackstab(f, tick, cb, kind.backstab, pool);
  }
  const lungeTiles = cb.lunge.tiles[w.name];
  if (kind.lunge === true && lungeTiles > 0) {
    const cost = w.stamina + cb.lunge.staminaExtra;
    if (pool.current < cost) return 'NO_STAMINA';
    // The tell (a step and a dip of the shoulders), then the windup, covering the lunge's ground.
    const windupStart = tick + cb.lunge.tellTicks;
    const activeAt = windupStart + windupOf(f, cb);
    beginStrike(
      f,
      'lunge',
      tick,
      activeAt,
      w.active,
      slow(f, cb, w.recovery + cb.lunge.recoveryExtra),
      0,
    );
    f.lunge = { tiles: lungeTiles, from: windupStart };
    spend(pool, cost, tick);
    return 'STARTED';
  }
  f.state = 'chargeL0';
  f.since = tick;
  f.released = false;
  f.level = 0;
  f.combo = 0;
  f.lunge = null;
  f.windupExtra = kind.inside === true ? cb.rules.spearInsideWindup : 0;
  return 'STARTED';
}

/** A backstab (Book 10 "Sneak attacks"): a heavy, distinct strike the striker is committed to. */
export function pressBackstab(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  target: Id,
  pool: StaminaPool,
  ticks?: number,
): PressResult {
  const w = weaponOf(f, cb);
  if (w === null || !free(f)) return 'REFUSED';
  if (pool.current < w.stamina) return 'NO_STAMINA';
  const total = ticks ?? 0;
  const fr = backstabFrames(cb, total, w.name);
  beginStrike(f, 'backstab', tick, tick + fr.windup, fr.active, fr.recovery, 0);
  f.target = target;
  spend(pool, w.stamina, tick);
  return 'STARTED';
}

function beginStrike(
  f: Fighter,
  state: CombatState,
  tick: number,
  activeAt: number,
  active: number,
  recovery: number,
  level: 0 | 1 | 2,
): void {
  f.state = state;
  f.since = tick;
  f.activeAt = activeAt;
  f.activeEnd = activeAt + active;
  f.recoveryEnd = f.activeEnd + recovery;
  f.hit = false;
  f.queued = false;
  f.level = level;
  f.riposte = state === 'riposte';
  if (state !== 'lunge') f.lunge = null;
  if (state === 'light1' || state === 'riposte' || state === 'lunge' || state === 'backstab')
    f.combo = 1;
}

/**
 * The attack button let go. Before level 1 the charge becomes a light attack (its windup counted
 * from the press: the active ticks come at the windup's end or now, whichever is later); from
 * level 1 it is released as a heavy, spending the level's stamina (a level the pool cannot pay
 * for falls back a level). `extraWindup` lengthens a heavy's windup (Svart at dusk, DE-15).
 */
export function releaseAttack(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  pool: StaminaPool,
  extraWindup = 0,
): void {
  const w = weaponOf(f, cb);
  if (w === null || !charging(f)) return;
  const pressed = f.since;
  const inside = f.windupExtra;
  f.windupExtra = 0;
  let level: 0 | 1 | 2 = f.state === 'chargeL2' ? 2 : f.state === 'chargeL1' ? 1 : 0;
  if (level === 2 && pool.current < w.stamina * cb.charge.staminaL2) level = 1;
  if (level === 1 && pool.current < w.stamina * cb.charge.staminaL1) level = 0;
  if (level === 0) {
    beginStrike(
      f,
      'light1',
      pressed,
      Math.max(pressed + windupOf(f, cb, inside), tick),
      w.active,
      slow(f, cb, w.recovery),
      0,
    );
    spend(pool, w.stamina, tick);
    return;
  }
  beginStrike(
    f,
    'heavyRelease',
    tick,
    tick + windupOf(f, cb, inside + extraWindup),
    w.active,
    slow(f, cb, w.recovery + cb.charge.releaseRecoveryExtra),
    level,
  );
  spend(pool, w.stamina * (level === 2 ? cb.charge.staminaL2 : cb.charge.staminaL1), tick);
}

/**
 * A feint (Book 10 "Self-preservation", feint): the charge's tell lowered with no swing and no
 * stamina spent.
 */
export function feint(f: Fighter, tick: number): void {
  if (!charging(f)) return;
  f.state = 'idle';
  f.since = tick;
  f.lunge = null;
}

/** The parry key: a timed press (Book 10: startup, window, recovery on a miss). */
export function pressParry(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  pool: StaminaPool,
  window = cb.parry.window,
): PressResult {
  if (!free(f) && f.state !== 'block') return 'REFUSED';
  if (f.weapon === null && !f.shield) return 'REFUSED';
  if (pool.current < cb.parry.cost) return 'NO_STAMINA';
  spend(pool, cb.parry.cost, tick);
  f.state = 'parry';
  f.since = tick;
  f.recoveryEnd = tick + cb.parry.startup + parryWindowOf(f, cb, window);
  return 'STARTED';
}

/**
 * The block key held or let go. Only a shield blocks (Book 10 "Fight rules", blockNeedsShield; the
 * Dane axe is two-handed, so never with a shield).
 */
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

/**
 * Whether a dodge may start now: at ease, blocking, or in the first dodgeCancel ticks of a light
 * attack's windup (Book 10 dodgeCancel; a charge held past them, or any other attack, commits).
 */
export function canDodge(f: Fighter, tick: number, cb: CombatBalance): boolean {
  if (f.exhausted) return false;
  if (free(f) || f.state === 'block') return true;
  const early = tick - f.since < cb.stance.dodgeCancelTicks;
  if (f.state === 'chargeL0' && early) return true;
  return (
    (f.state === 'light1' || f.state === 'light2' || f.state === 'light3') &&
    early &&
    tick < f.activeAt
  );
}

/** The dodge key: a short committed move with brief invulnerability, along `dir`. */
export function pressDodge(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  dir: { x: number; y: number } | null,
  pool: StaminaPool,
): PressResult {
  if (!canDodge(f, tick, cb)) return 'REFUSED';
  if (pool.current < cb.dodge.stamina) return 'NO_STAMINA';
  spend(pool, cb.dodge.stamina, tick);
  const d =
    dir === null || Math.hypot(dir.x, dir.y) < 1e-6
      ? { x: -Math.cos(f.angle) + 0, y: -Math.sin(f.angle) + 0 }
      : dir;
  const len = Math.hypot(d.x, d.y);
  f.state = 'dodge';
  f.since = tick;
  f.dodge = { x: d.x / len, y: d.y / len };
  f.recoveryEnd = tick + cb.dodge.ticks;
  f.queued = false;
  f.lunge = null;
  return 'STARTED';
}

/**
 * A sidestep from a missile (Book 10 awareDodge, sidestepMove): a tell, then a dodge's move across
 * the missile's path along `dir`. `missile` is the one it reads (it passes the sidestepper).
 */
export function startSidestep(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  tell: number,
  dir: { x: number; y: number },
  missile: number,
): void {
  const len = Math.hypot(dir.x, dir.y) || 1;
  f.state = 'sidestep';
  f.since = tick;
  f.activeAt = tick + tell;
  f.recoveryEnd = tick + tell + cb.dodge.ticks;
  f.dodge = { x: dir.x / len, y: dir.y / len };
  f.target = `missile:${String(missile)}`;
}

/** The shove: breaks a block and makes space (Book 10: stamina, stagger; "Fight rules" timing). */
export function pressShove(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  facing: number | Facing,
  pool: StaminaPool,
): PressResult {
  const angle = typeof facing === 'number' ? facing : FACING_ANGLE[facing];
  if (!free(f) && f.state !== 'block') return 'REFUSED';
  if (pool.current < cb.shove.stamina) return 'NO_STAMINA';
  spend(pool, cb.shove.stamina, tick);
  setAngle(f, angle);
  f.state = 'shove';
  f.since = tick;
  f.activeAt = tick + cb.shove.windup;
  f.activeEnd = f.activeAt + cb.shove.active;
  f.recoveryEnd = f.activeEnd + cb.shove.recovery;
  f.hit = false;
  return 'STARTED';
}

/** Binding a wound or eating (Book 10 "Health, stamina and healing"): a short committed action. */
export function startHeal(
  f: Fighter,
  tick: number,
  ticks: number,
  heal: HealUnderWay,
): PressResult {
  if (!free(f)) return 'REFUSED';
  f.state = 'heal';
  f.since = tick;
  f.recoveryEnd = tick + ticks;
  f.heal = heal;
  return 'STARTED';
}

/** A heal ended before its time: the binding or ration is already spent and lost. */
export function interruptHeal(f: Fighter, tick: number): boolean {
  if (f.state !== 'heal') return false;
  f.state = 'idle';
  f.since = tick;
  f.heal = null;
  return true;
}

/** A timed state until `ticks` from now. */
export function enterTimed(
  f: Fighter,
  state:
    'stagger' | 'blockStun' | 'guardBroken' | 'parryRecovery' | 'parried' | 'knockdown' | 'getUp',
  tick: number,
  ticks: number,
): void {
  f.state = state;
  f.since = tick;
  f.recoveryEnd = tick + ticks;
  f.queued = false;
  f.hit = false;
  f.lunge = null;
  f.heal = null;
}

export type FighterEvent =
  | { readonly type: 'CHARGE_LEVEL'; readonly level: 1 | 2 }
  | { readonly type: 'AUTO_RELEASE' }
  | { readonly type: 'ACTIVE' }
  | { readonly type: 'MISSED' }
  | { readonly type: 'STATE_ENDED'; readonly state: CombatState; readonly heal?: HealUnderWay };

/**
 * One tick of the fighter's own clock: the charge's levels and its maximum hold, a strike's active
 * ticks beginning, a swing that met no one recovering longer, a queued chain following its
 * recovery, poise refilling, and timed states ending (a knockdown into the get-up). Hits are the
 * caller's (it knows where everyone stands). A fighter in hitstop does not step: its clock is held.
 */
export function stepFighter(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  pool: StaminaPool,
): FighterEvent[] {
  const out: FighterEvent[] = [];
  if (f.hitstop > 0) {
    f.hitstop--;
    hold(f, 1);
    return out;
  }
  updateExhausted(f, pool, cb);
  // Poise refills after Book 10's pause without a hit.
  if (f.poiseLost > 0 && tick - f.poiseAt >= cb.poise.regenDelay)
    f.poiseLost = Math.max(0, f.poiseLost - cb.poise.regenPerSecond / 60);
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
    // A missed swing matters (Book 10 missRecovery; a spear's spearMiss in its place).
    if (tick === f.activeEnd && !f.hit && f.state !== 'shove' && w !== null) {
      const extra = w.name === 'Spear' ? cb.rules.spearMissRecovery : cb.stance.missRecovery;
      f.recoveryEnd += extra;
      out.push({ type: 'MISSED' });
    }
    if (tick >= f.recoveryEnd) {
      const ended = f.state;
      if (f.queued && w !== null && (ended === 'light1' || ended === 'light2')) {
        const next = ended === 'light1' ? 'light2' : 'light3';
        const combo = f.combo + 1;
        beginStrike(f, next, tick, tick + windupOf(f, cb), w.active, slow(f, cb, w.recovery), 0);
        f.combo = combo;
        spend(pool, w.stamina, tick);
      } else {
        f.state = 'idle';
        f.since = tick;
        f.combo = 0;
        f.queued = false;
        f.lunge = null;
        f.target = null;
        f.riposte = false;
      }
      out.push({ type: 'STATE_ENDED', state: ended });
    }
    return out;
  }
  if (TIMED.includes(f.state) && tick >= f.recoveryEnd) {
    const ended = f.state;
    const heal = f.heal;
    if (ended === 'parry') {
      // The window passed with nothing parried: the recovery on a miss.
      enterTimed(f, 'parryRecovery', tick, cb.parry.recoveryOnMiss);
    } else if (ended === 'knockdown') {
      enterTimed(f, 'getUp', tick, cb.poise.getUpTicks);
    } else {
      f.state = f.guard && f.shield && ended !== 'guardBroken' ? 'block' : 'idle';
      f.since = tick;
      f.dodge = null;
      f.heal = null;
      f.target = null;
    }
    out.push(
      heal === null
        ? { type: 'STATE_ENDED', state: ended }
        : { type: 'STATE_ENDED', state: ended, heal },
    );
  }
  return out;
}

/** Moves every tick of the fighter's current phase on by `ticks` (its clock held in hitstop). */
export function hold(f: Fighter, ticks: number): void {
  f.since += ticks;
  f.activeAt += ticks;
  f.activeEnd += ticks;
  f.recoveryEnd += ticks;
  if (f.riposteUntil >= 0) f.riposteUntil += ticks;
  if (f.flinchUntil >= 0) f.flinchUntil += ticks;
  if (f.lunge !== null) f.lunge = { ...f.lunge, from: f.lunge.from + ticks };
}

/** Starts a hitstop of `ticks` (the longest one under way wins). */
export function hitstop(f: Fighter, ticks: number): void {
  f.hitstop = Math.max(f.hitstop, ticks);
}

/** What a blow did. */
export type Outcome = 'DODGED' | 'PARRIED' | 'BLOCKED' | 'GUARD_BROKEN' | 'HOOKED' | 'HIT';

/** The kind of a blow, for its hitstop, knockback, poise and shake (Book 10 "Hit reactions"). */
export type BlowKind = 'light' | 'heavy' | 'lunge' | 'riposte' | 'backstab' | 'shove';

export interface Blow {
  /** Damage before armour (the defender's armour and berserk apply in `damageOf`). */
  readonly damage: number;
  /** What it costs a shield. */
  readonly vsShield: number;
  readonly poise: number;
  readonly type: DamageType;
  readonly kind: BlowKind;
  readonly weapon: MeleeWeaponName | null;
  /** Breaks a raised guard (a level-2 charge, a Dane axe heavy; never a seax's). */
  readonly guardBreak: boolean;
  /** A hand axe's charged heavy hooks a shield aside (Weapon rules, axeHook). */
  readonly hook: boolean;
  /** A Dane axe's level-2 heavy splits the shield it meets. */
  readonly split: boolean;
  /** A riposte cannot be blocked and ignores poise (it always staggers). */
  readonly unblockable: boolean;
  /** A light blow (no knockback beyond the light, no shake). */
  readonly light: boolean;
  /** Kept for missiles' and gore's callers: a cutting blow. */
  readonly cut: boolean;
}

/** The blow of an attacker's current strike (Book 10 section 06 and the charged heavy). */
export function blowOf(f: Fighter, cb: CombatBalance, opts: { berserk?: boolean } = {}): Blow {
  const w = weaponOf(f, cb);
  if (w === null)
    return {
      damage: 0,
      vsShield: 0,
      poise: cb.unarmed.poiseDamage,
      type: 'BLOW',
      kind: 'shove',
      weapon: null,
      guardBreak: false,
      hook: false,
      split: false,
      unblockable: false,
      light: true,
      cut: false,
    };
  let mult = 1;
  let shieldMult = 1;
  let poiseMult = 1;
  const heavy = f.state === 'heavyRelease';
  if (heavy) {
    mult = f.level === 2 ? cb.charge.level2Damage : cb.charge.level1.damage;
    shieldMult = f.level === 2 ? cb.charge.level2Damage : cb.charge.level1.vsShield;
    poiseMult = f.level === 2 ? cb.poise.chargedL2 : cb.poise.chargedL1;
  }
  if (f.riposte) mult *= w.name === 'Sword' ? cb.parry.riposteDamageSword : cb.parry.riposteDamage;
  if (f.heavy) mult *= cb.heavy.damage;
  if (opts.berserk === true) mult *= cb.berserk.damage;
  const kind: BlowKind = f.riposte
    ? 'riposte'
    : f.state === 'backstab'
      ? 'backstab'
      : f.state === 'lunge'
        ? 'lunge'
        : heavy
          ? 'heavy'
          : 'light';
  const dane = w.name === 'Dane axe';
  return {
    damage: w.damage * mult,
    vsShield: w.vsShield * shieldMult,
    poise: w.poiseDamage * poiseMult,
    type: w.type,
    kind,
    weapon: w.name,
    guardBreak: heavy && ((f.level === 2 && w.name !== 'Seax') || dane),
    hook: heavy && w.name === 'Hand axe',
    split: heavy && dane && f.level === 2,
    unblockable: f.riposte,
    light: kind === 'light',
    cut: w.type === 'CUT',
  };
}

/** Damage after armour (Book 10 "Weapon rules": padded -10% all; mail by damage type). */
export function damageOf(
  blow: { readonly damage: number; readonly type: DamageType },
  armour: Armour,
  cb: CombatBalance,
  berserkDefender = false,
): number {
  const a =
    armour === 'PADDED'
      ? cb.armour.padded
      : armour === 'MAIL'
        ? blow.type === 'CUT'
          ? cb.armour.mailCut
          : blow.type === 'THRUST'
            ? cb.armour.mailThrust
            : cb.armour.mailBlow
        : 0;
  const d = blow.damage * (1 - a) * (berserkDefender ? 1 / cb.berserk.defence : 1);
  return Math.round(d * 10) / 10;
}

/** Whether a point lies within `arcDegrees` in front of a fighter facing `angle` (radians). */
export function inFrontAngle(angle: number, dx: number, dy: number, arcDegrees: number): boolean {
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return true;
  const cos = (Math.cos(angle) * dx + Math.sin(angle) * dy) / d;
  return cos >= Math.cos(((arcDegrees / 2) * Math.PI) / 180) - 1e-9;
}

/** Whether `from` (a point) lies within `arcDegrees` in front of a four-way facing. */
export function inFront(facing: Facing, dx: number, dy: number, arcDegrees: number): boolean {
  return inFrontAngle(FACING_ANGLE[facing], dx, dy, arcDegrees);
}

/**
 * The block's stamina (Book 10 "Guard", blockCost): the factor of the blow's vs-shield damage plus
 * the flat cost, double on a shield the axe hooked aside.
 */
export function blockCost(
  blow: { readonly vsShield: number },
  cb: CombatBalance,
  hooked: boolean,
): number {
  return (cb.block.costFactor * blow.vsShield + cb.block.costFlat) * (hooked ? 2 : 1);
}

/** A guard broken (Book 10 "Guard" and shieldBreaks): open, and the shield worn towards breaking. */
function breakGuard(
  defender: Fighter,
  tick: number,
  cb: CombatBalance,
  ticks: number,
  split: boolean,
): void {
  enterTimed(defender, 'guardBroken', tick, ticks);
  defender.guard = false;
  defender.shieldBreaks += 1;
  if (split || defender.shieldBreaks >= cb.rules.shieldBreaksAfter) defender.shield = false;
}

/**
 * Resolves a blow against a defender (Book 2 section 12): a dodge's invulnerable ticks, then a
 * parry in its window from the front, then a raised shield from the front (a guard break breaks it
 * and lands; an axe's heavy hooks it aside; else it costs stamina), else a hit. `attackerDir` is the
 * vector from the defender to the attacker. Changes the defender's state (and, for a parry, the
 * attacker's: it reels open) and returns the outcome. A riposte cannot be parried or blocked.
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
  if (blow.unblockable || blow.kind === 'backstab') return 'HIT';
  const front = (arc: number): boolean =>
    inFrontAngle(defender.angle, attackerDir.x, attackerDir.y, arc);
  if (parrying(defender, tick, cb, parryWindow) && front(cb.block.arcDegrees)) {
    // Success: the attacker reels open, the parry's cost comes back, a riposte is open.
    pool.current += cb.parry.cost;
    defender.state = 'idle';
    defender.since = tick;
    defender.riposteUntil = tick + cb.parry.open;
    enterTimed(attacker, 'parried', tick, cb.parry.open);
    return 'PARRIED';
  }
  const raised = defender.shield && (defender.state === 'block' || defender.state === 'blockStun');
  if (raised && front(cb.block.arcDegrees)) {
    if (blow.guardBreak) {
      breakGuard(defender, tick, cb, cb.block.guardBreak, blow.split);
      return 'GUARD_BROKEN';
    }
    if (blow.hook) {
      breakGuard(defender, tick, cb, cb.rules.axeHookTicks, false);
      defender.hookedUntil = tick + cb.rules.axeHookTicks + cb.block.guardBreak;
      return 'HOOKED';
    }
    const hooked = tick < defender.hookedUntil;
    pool.current = Math.max(0, pool.current - blockCost(blow, cb, hooked));
    pool.spentTick = tick;
    if (hooked) defender.hookedUntil = -1;
    if (pool.current <= 0) {
      breakGuard(defender, tick, cb, cb.block.guardBreak, false);
      return 'GUARD_BROKEN';
    }
    enterTimed(defender, 'blockStun', tick, cb.block.stun);
    return 'BLOCKED';
  }
  return 'HIT';
}

/** What a landed blow did to the body: a flinch, a stagger or a knockdown (Book 10 "Poise"). */
export type PoiseResult = 'FLINCH' | 'STAGGER' | 'KNOCKDOWN' | 'NONE';

/**
 * After a blow lands (Book 10 "Poise"): it wears the defender's poise by its poise damage; broken,
 * the defender staggers (a big enough hit knocks down) and the poise refills; else a flinch that
 * does not stop what they are doing. A riposte and a backstab ignore poise: they always stagger.
 */
export function poiseHit(
  defender: Fighter,
  blow: Pick<Blow, 'poise' | 'kind'>,
  tick: number,
  cb: CombatBalance,
): PoiseResult {
  if (OUT_OF_FIGHT.includes(defender.state)) return 'NONE';
  defender.poiseAt = tick;
  const max = poiseMax(defender, cb);
  const ignores = blow.kind === 'riposte' || blow.kind === 'backstab';
  defender.poiseLost += blow.poise;
  if (!ignores && defender.poiseLost < max) {
    defender.flinchUntil = tick + cb.hit.flinchTicks;
    if (defender.state === 'heal') interruptHeal(defender, tick);
    return 'FLINCH';
  }
  defender.poiseLost = 0;
  defender.guard = false;
  if (blow.poise >= cb.poise.knockdownAt) {
    enterTimed(defender, 'knockdown', tick, cb.poise.knockdownTicks);
    return 'KNOCKDOWN';
  }
  enterTimed(defender, 'stagger', tick, cb.poise.staggerTicks);
  return 'STAGGER';
}

/** The hitstop a blow gives (Book 10 "Hit reactions"), by its outcome and kind. */
export function hitstopFor(
  blow: Pick<Blow, 'kind' | 'weapon'>,
  outcome: Outcome,
  cb: CombatBalance,
): number {
  const h = cb.hit;
  if (outcome === 'PARRIED') return h.hitstopParry;
  if (outcome === 'BLOCKED') return h.hitstopBlock;
  if (outcome === 'DODGED') return 0;
  if (blow.kind === 'riposte') return h.hitstopRiposte;
  if (blow.kind === 'heavy' || blow.kind === 'lunge' || blow.kind === 'backstab')
    return h.hitstopHeavy;
  if (blow.weapon === 'Seax') return h.hitstopCleanSeax;
  if (blow.weapon === 'Club or hammer' || blow.weapon === 'Dane axe')
    return h.hitstopCleanHeavyWeapon;
  return h.hitstopClean;
}

/** The knockback a blow gives, in logical px (presentation reads it from the BLOW event). */
export function knockbackFor(
  blow: Pick<Blow, 'kind'>,
  poise: PoiseResult,
  cb: CombatBalance,
): number {
  const h = cb.hit;
  if (blow.kind === 'riposte' || blow.kind === 'backstab' || poise === 'KNOCKDOWN')
    return h.knockbackBig;
  if (blow.kind === 'heavy' || blow.kind === 'lunge') return h.knockbackHeavy;
  return h.knockbackLight;
}

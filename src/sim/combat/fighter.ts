/**
 * The fighter's state machine (Book 2 section 12, "States", "Combat v2" and "Combat by design
 * addendum 2.5"; Book 10 section 06): light combos, the charged heavy with its two levels, the
 * lunge, the predictive parry and the riposte, the block with its raise and lower, the dodge with
 * its invulnerable middle and planted recovery, the shove, poise with its flinch, stagger and
 * knockdown, the backstab, the sidestep from a missile, healing, hitstop, exhaustion and the
 * terminal states. Pure and deterministic: the caller gives the tick and a stamina pool, and
 * applies what comes back.
 *
 * Design addendum 2.5 (decisions DF-1 to DF-10): every action has three strict phases (wind-up,
 * active, recovery) from Book 10's "Frame data", and from its first wind-up tick to its last
 * recovery tick the fighter is locked: no moving, turning, dodging, blocking, parrying or starting
 * another action, and nothing cancels into anything. A missed attack adds its miss recovery, and a
 * hit on a fighter caught in a miss recovery, a mistimed parry's recovery, a dodge's recovery or a
 * broken guard is a punish. An enemy's wind-up is never shorter than Book 10's telegraph floor for
 * its weight. At 0 stamina a fighter is exhausted until stamina is back to Book 10's share.
 *
 * May depend only on core and content (src/sim/combat/README.md).
 */
import type {
  CombatBalance,
  DamageType,
  MeleeWeaponName,
  MoveFrames,
  MoveName,
  WeaponStats,
  Weight,
} from '../../content/combatBalance.ts';
import type { Id } from '../../core/ids.ts';

export type Facing = 's' | 'n' | 'e' | 'w';

/**
 * Book 2 section 12's states, with combat v2's (decisions DE-1 to DE-10) and design addendum 2.5's
 * (`parryWindup`, `blockRaise`, `blockLower`, `dodgeRecovery`; decisions DF-1 to DF-6). `move` is
 * never stored (a fighter at `idle` who walks is moving), nor is `flinch` (drawn from
 * `flinchUntil`, it never stops what the fighter is doing). `recovery` is a feint's lowering.
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
  'parryWindup',
  'blockRaise',
  'blockLower',
  'dodgeRecovery',
] as const;
export type CombatState = (typeof COMBAT_STATES)[number];

/** States that strike: they have a wind-up, active ticks and a recovery. */
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
  'parryWindup',
  'parry',
  'parryRecovery',
  'stagger',
  'blockRaise',
  'blockStun',
  'blockLower',
  'guardBroken',
  'dodge',
  'dodgeRecovery',
  'parried',
  'knockdown',
  'getUp',
  'sidestep',
  'heal',
  'recovery',
];

export type Armour = 'NONE' | 'PADDED' | 'MAIL';

/** A heal under way (Book 10 "Health, stamina and healing"): what, and where it began. */
export interface HealUnderWay {
  readonly kind: 'BIND' | 'EAT';
  readonly x: number;
  readonly y: number;
}

/** The move a strike plays (Book 10 "Frame data"), or the shove. */
export type Move = MoveName | 'shove';

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
  /** The heavy build (Book 10 section 24): more poise, slower wind-ups, heavier hits. */
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
  /** The block key held: the guard comes up, and a blow taken returns to it after its stun. */
  guard: boolean;
  /** A dodge's or sidestep's direction (unit vector). */
  dodge: { readonly x: number; readonly y: number } | null;
  /** Poise worn away (0: whole), and the tick of the last hit (it refills after Book 10's pause). */
  poiseLost: number;
  poiseAt: number;
  /** Ticks of hitstop left: the fighter's own clock is frozen (decision DE-7). */
  hitstop: number;
  /** At 0 stamina until back to Book 10's share (design addendum 2.5, "Exhausted"). */
  exhausted: boolean;
  /** Drawn flinching until this tick (a hit that did not break poise). */
  flinchUntil: number;
  /** Guard breaks taken with this shield (it breaks after Book 10's number). */
  shieldBreaks: number;
  /** An axe hooked the shield aside: the next block costs double until it is used. */
  hookedUntil: number;
  /** A lunge's ground: tiles covered over its strides, from `from` (ticks), along `angle`. */
  lunge: { readonly tiles: number; readonly from: number } | null;
  /** The one a riposte or backstab is aimed at, or a sidestep reads (missile number as text). */
  target: Id | null;
  /** A heal under way. */
  heal: HealUnderWay | null;
  /** Extra wind-up on the next strike (a spear with a foe inside its reach, Weapon rules). */
  windupExtra: number;
  /** Design addendum 2.5: the move in play (its frames: miss recovery, step, weight). */
  move: Move | null;
  /** The move's weight, for its telegraph (Book 10 "Telegraphs"). */
  weight: Weight;
  /** Its active ticks met no one: the miss recovery was added (a punish window). */
  missed: boolean;
  /** Tiles stepped forward evenly over the active ticks (Book 10 "Frame data", Step). */
  step: number;
  /** An enemy's telegraph flash tick (Book 10 "Telegraphs", flash), or -1. */
  flashAt: number;
  /** Plays by the enemies' telegraph floors (Book 10 "Enemy attacks"). */
  floors: boolean;
}

/** A stamina bar the fighter spends from: the steerer's, or a person's own. */
export interface StaminaPool {
  current: number;
  spentTick: number;
  /** The bar's maximum now (exhaustion ends at a share of it); Book 10 staminaMax if absent. */
  max?: number;
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
  opts: {
    shield?: boolean;
    heavy?: boolean;
    armour?: Armour;
    facing?: Facing;
    floors?: boolean;
  } = {},
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
    move: null,
    weight: 'LIGHT',
    missed: false,
    step: 0,
    flashAt: -1,
    floors: opts.floors ?? false,
  };
}

export function weaponOf(f: Fighter, cb: CombatBalance): WeaponStats | null {
  return f.weapon === null ? null : cb.weapons[f.weapon];
}

/** A weapon's frames for a move (Book 10 "Frame data"), or null if it has no such move. */
export function movesOf(
  cb: CombatBalance,
  weapon: MeleeWeaponName,
  move: MoveName,
): MoveFrames | null {
  return cb.weapons[weapon].moves[move] ?? null;
}

/**
 * The wind-up a fighter plays for a move: the frame data's, with the heavy build's extra and, for
 * an enemy, never below the telegraph floor of its weight (Book 10 "Enemy attacks"). For a heavy
 * or charged heavy this is the swing after the release (the hold is the AI's, holdFor).
 */
export function windupFor(
  f: Pick<Fighter, 'heavy' | 'floors'>,
  cb: CombatBalance,
  m: MoveFrames,
  lights = true,
): number {
  const build = f.heavy ? cb.heavy.windupExtra : 0;
  if (!f.floors || !lights) return m.windup + build;
  return Math.max(m.windup, cb.telegraphs.floor[m.weight]) + build;
}

/**
 * How long an enemy holds a heavy or charged heavy before its swing, so that hold and swing
 * together meet the telegraph floor of the move's weight, and the hold reaches its charge level
 * (Book 10 "Enemy attacks": the rows give the result).
 */
export function holdFor(cb: CombatBalance, m: MoveFrames, level: 1 | 2): number {
  const at = level === 2 ? cb.charge.level2At : cb.charge.level1At;
  return Math.max(cb.telegraphs.floor[m.weight] - m.windup, at);
}

/**
 * The frames of an attack kind (Book 10 "Frame data"), with the heavy build's extra wind-up: the
 * wind-up, active, recovery and miss recovery ticks.
 */
export function frameData(
  cb: CombatBalance,
  weapon: MeleeWeaponName,
  move: MoveName,
  heavyBuild = false,
): MoveFrames {
  const m = movesOf(cb, weapon, move);
  if (m === null) throw new Error(`${weapon} has no ${move}`);
  return { ...m, windup: m.windup + (heavyBuild ? cb.heavy.windupExtra : 0) };
}

/** A riposte's frames (Book 10 "Frame data", Riposte; the same ticks as riposteTicks). */
export function riposteFrames(cb: CombatBalance, weapon: MeleeWeaponName): MoveFrames {
  return frameData(cb, weapon, 'riposte');
}

/** A backstab's frames (Book 10 "Frame data", Backstab). */
export function backstabFrames(cb: CombatBalance, weapon: MeleeWeaponName): MoveFrames {
  return frameData(cb, weapon, 'backstab');
}

/** Whether a fighter is at ease: free to start an action. */
export function free(f: Fighter): boolean {
  return f.state === 'idle';
}

/**
 * Locked (Book 10 "Commitment", locked): from the first wind-up tick of an action to its last
 * recovery tick a fighter cannot move, turn, dodge, block, parry or start another action. Only the
 * idle and a held, live guard are not locked (and the dead, downed and surrendered do nothing).
 */
export function locked(f: Fighter): boolean {
  return f.state !== 'idle' && f.state !== 'block';
}

export function striking(f: Fighter): boolean {
  return STRIKES.includes(f.state);
}

export function charging(f: Fighter): boolean {
  return CHARGES.includes(f.state);
}

/** The facing holds while locked (Book 10 "Commitment", facing). */
export function facingLocked(f: Fighter): boolean {
  return locked(f);
}

/**
 * The feet are planted while locked (Book 10 stopOnAttack), except where the action itself moves
 * the fighter (a dodge's dash, a sidestep, a lunge's strides, a strike's step: moved by the
 * fight). A held guard walks at half speed.
 */
export function feetPlanted(f: Fighter): boolean {
  if (f.hitstop > 0) return true;
  return locked(f);
}

/** Which phase of a strike the tick is in. */
export function strikePhase(f: Fighter, tick: number): 'windup' | 'active' | 'recovery' | null {
  if (!striking(f) && f.state !== 'shove') return null;
  if (tick < f.activeAt) return 'windup';
  if (tick < f.activeEnd) return 'active';
  return 'recovery';
}

/** Which of the three phases any action is in (Book 10 "Commitment", phases), or null at ease. */
export function phaseOf(f: Fighter, tick: number): 'WINDUP' | 'ACTIVE' | 'RECOVERY' | null {
  if (striking(f) || f.state === 'shove') {
    const p = strikePhase(f, tick);
    return p === 'windup' ? 'WINDUP' : p === 'active' ? 'ACTIVE' : 'RECOVERY';
  }
  switch (f.state) {
    case 'chargeL0':
    case 'chargeL1':
    case 'chargeL2':
    case 'parryWindup':
    case 'blockRaise':
      return 'WINDUP';
    case 'parry':
      return 'ACTIVE';
    case 'block':
    case 'blockStun':
      return 'ACTIVE';
    case 'parryRecovery':
    case 'blockLower':
    case 'dodgeRecovery':
    case 'recovery':
      return 'RECOVERY';
    case 'dodge':
    case 'sidestep':
      return tick < f.activeAt ? 'WINDUP' : 'ACTIVE';
    default:
      return f.state === 'idle' ? null : 'ACTIVE';
  }
}

/** The dodge's invulnerable ticks (Book 10 "Dodge": ticks 8 to 13 of the dodge). */
export function invulnerable(f: Fighter, tick: number, cb: CombatBalance): boolean {
  if (f.state !== 'dodge') return false;
  const t = tick - f.since;
  return t >= cb.dodge.invulnFrom && t <= cb.dodge.invulnTo;
}

/** The parry's live ticks: Book 10's (with the option), and the sword's extra ticks. */
export function parryWindowOf(f: Fighter, cb: CombatBalance, window: number): number {
  return window + (f.weapon === 'Sword' ? cb.parry.swordExtra : 0);
}

/** The parry is live (Book 10 "Parry": its active ticks, after its wind-up). */
export function parrying(f: Fighter): boolean {
  return f.state === 'parry';
}

/**
 * A hit now would be a punish (Book 10 "Commitment", punish): the fighter is in a miss recovery,
 * a mistimed parry's recovery, a dodge's recovery or a broken guard.
 */
export function punishable(f: Fighter, tick: number): boolean {
  if ((striking(f) || f.state === 'shove') && f.missed && tick >= f.activeEnd) return true;
  if (f.state === 'parryRecovery') return f.riposteUntil <= tick;
  return f.state === 'dodgeRecovery' || f.state === 'guardBroken';
}

/** A fighter's whole poise (Book 10 "Poise": by build and armour). */
export function poiseMax(f: Fighter, cb: CombatBalance): number {
  const base = f.heavy ? cb.poise.heavy : cb.poise.ordinary;
  const armour = f.armour === 'MAIL' ? cb.poise.mail : f.armour === 'PADDED' ? cb.poise.padded : 0;
  return base + armour;
}

export type PressResult =
  'STARTED' | 'QUEUED' | 'REFUSED' | 'NO_STAMINA' | 'NO_SHIELD' | 'EXHAUSTED';

function spend(pool: StaminaPool, amount: number, tick: number): void {
  pool.current = Math.max(0, pool.current - amount);
  pool.spentTick = tick;
}

/**
 * Exhaustion follows the bar (Book 10 "Exhausted"): at 0 until back to its share of the current
 * maximum. A raised shield drops (lowering), and a held charge comes out as it stands.
 */
export function updateExhausted(f: Fighter, pool: StaminaPool, cb: CombatBalance, tick = 0): void {
  const max = pool.max ?? cb.stamina.max;
  if (pool.current <= 0) {
    if (!f.exhausted) {
      f.exhausted = true;
      f.guard = false;
      if (f.state === 'block') enterLower(f, tick, cb);
    }
  } else if (f.exhausted && pool.current >= cb.exhausted.until * max - 1e-9) f.exhausted = false;
}

/** Whether an action that costs stamina may start (Book 10 needsStamina and exhaustedLocks). */
function canSpend(f: Fighter, pool: StaminaPool): PressResult | null {
  if (f.exhausted) return 'EXHAUSTED';
  if (pool.current <= 0) return 'NO_STAMINA';
  return null;
}

/** What kind of attack a press makes (decided by the caller from the zone). */
export interface PressKind {
  /** Running at the faced direction, or at a locked target beyond reach (Book 10 lungeWhen). */
  readonly lunge?: boolean;
  /** An unaware foe's back within reach (Book 10 "Sneak attacks"). */
  readonly backstab?: Id | null;
  /** A spear with a foe nearer than spearInside: its wind-up is longer (Weapon rules). */
  readonly inside?: boolean;
  /** The riposte's target, the parried foe in reach. */
  readonly riposteAt?: Id | null;
}

/**
 * The attack button pressed (Book 10 chargeFromPress): the charge begins (its raised weapon is the
 * tell), or in a light's chain window the next light is queued, or after a parry a riposte
 * begins, or on an unaware back a backstab, or running in a lunge. The facing is fixed at the
 * press (Book 10 "Commitment", facing) and the fighter stops at once (stopOnAttack).
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
  if (f.state === 'light1' || f.state === 'light2') {
    // The chain window: the last chain-window ticks of the recovery (Book 10 "Fight rules").
    const m = movesOf(cb, w.name, f.state);
    const next = movesOf(cb, w.name, f.state === 'light1' ? 'light2' : 'light3');
    const chain = m?.chain ?? null;
    const inWindow = chain !== null && tick >= f.recoveryEnd - chain && tick < f.recoveryEnd;
    if (inWindow && next !== null && f.combo < w.combo) {
      const no = canSpend(f, pool);
      if (no !== null) return no;
      f.queued = true;
      return 'QUEUED';
    }
    return 'REFUSED';
  }
  if (!free(f)) return 'REFUSED';
  const no = canSpend(f, pool);
  if (no !== null) return no;
  setAngle(f, angle);
  f.target = null;
  f.flashAt = -1;
  if (tick < f.riposteUntil) {
    // A riposte (Book 10 "Parry and riposte"): heavy, distinct and committed.
    const r = riposteFrames(cb, w.name);
    beginStrike(f, 'riposte', 'riposte', tick, tick + r.windup, r, 0);
    f.target = kind.riposteAt ?? null;
    spend(pool, r.stamina, tick);
    f.riposteUntil = -1;
    return 'STARTED';
  }
  f.riposteUntil = -1;
  if (kind.backstab != null) return pressBackstab(f, tick, cb, kind.backstab, pool);
  const lungeTiles = cb.lunge.tiles[w.name];
  const lm = movesOf(cb, w.name, 'lunge');
  if (kind.lunge === true && lungeTiles > 0 && lm !== null) {
    // The tell (a step and a dip of the shoulders), then the strides over its wind-up, covering
    // the lunge's ground at a fixed distance; an enemy's tell and strides meet its floor.
    const tell = f.floors ? cb.telegraphs.enemyLungeTell : cb.lunge.tellTicks;
    const strides = f.floors
      ? Math.max(lm.windup, cb.telegraphs.floor[lm.weight] - tell)
      : lm.windup;
    const windupStart = tick + tell;
    const activeAt = windupStart + strides + (f.heavy ? cb.heavy.windupExtra : 0);
    beginStrike(f, 'lunge', 'lunge', tick, activeAt, lm, 0);
    f.step = 0;
    f.lunge = { tiles: lungeTiles, from: windupStart };
    spend(pool, lm.stamina, tick);
    return 'STARTED';
  }
  f.state = 'chargeL0';
  f.since = tick;
  f.released = false;
  f.level = 0;
  f.combo = 0;
  f.lunge = null;
  f.missed = false;
  f.hit = false;
  f.queued = false;
  f.move = 'light1';
  f.weight = movesOf(cb, w.name, 'light1')?.weight ?? 'LIGHT';
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
): PressResult {
  const w = weaponOf(f, cb);
  if (w === null || !free(f)) return 'REFUSED';
  const no = canSpend(f, pool);
  if (no !== null) return no;
  const fr = backstabFrames(cb, w.name);
  beginStrike(f, 'backstab', 'backstab', tick, tick + fr.windup, fr, 0);
  f.target = target;
  spend(pool, fr.stamina, tick);
  return 'STARTED';
}

function beginStrike(
  f: Fighter,
  state: CombatState,
  move: Move,
  tick: number,
  activeAt: number,
  m: MoveFrames,
  level: 0 | 1 | 2,
): void {
  f.state = state;
  f.since = tick;
  f.activeAt = activeAt;
  f.activeEnd = activeAt + m.active;
  f.recoveryEnd = f.activeEnd + m.recovery;
  f.hit = false;
  f.missed = false;
  f.queued = false;
  f.level = level;
  f.move = move;
  f.weight = m.weight;
  f.step = m.step;
  f.riposte = state === 'riposte';
  if (state !== 'lunge') f.lunge = null;
  if (state === 'light1' || state === 'riposte' || state === 'lunge' || state === 'backstab')
    f.combo = 1;
}

/**
 * The attack button let go (a held charge can only be released: Book 10 noCancels). Before level
 * 1 the charge becomes a light attack (its wind-up counted from the press: the active ticks come
 * at the wind-up's end or now, whichever is later); from level 1 it is released as a heavy, or at
 * level 2 a charged heavy, swinging with its own wind-up (Book 10 "Frame data"), spending the
 * level's stamina. `extraWindup` lengthens a heavy's swing (Svart at dusk, DE-15).
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
  const level: 0 | 1 | 2 = f.state === 'chargeL2' ? 2 : f.state === 'chargeL1' ? 1 : 0;
  if (level === 0) {
    const m = movesOf(cb, w.name, 'light1');
    if (m === null) return;
    beginStrike(
      f,
      'light1',
      'light1',
      pressed,
      Math.max(pressed + windupFor(f, cb, m) + inside, tick),
      m,
      0,
    );
    spend(pool, m.stamina, tick);
    return;
  }
  const m = movesOf(cb, w.name, level === 2 ? 'charged' : 'heavy');
  if (m === null) return;
  const swing = m.windup + (f.heavy ? cb.heavy.windupExtra : 0) + inside + extraWindup;
  beginStrike(f, 'heavyRelease', level === 2 ? 'charged' : 'heavy', tick, tick + swing, m, level);
  // The press began the wind-up; the strike counts its hold as part of it.
  f.since = pressed;
  spend(pool, m.stamina, tick);
}

/**
 * A feint (Book 10 "Self-preservation", feint): the charge's tell lowered with no swing, no
 * stamina spent; the lowering is a light's recovery, still committed.
 */
export function feint(f: Fighter, tick: number, cb?: CombatBalance): void {
  if (!charging(f)) return;
  const m = cb !== undefined && f.weapon !== null ? movesOf(cb, f.weapon, 'light1') : null;
  enterTimed(f, 'recovery', tick, m?.recovery ?? 1);
  f.flashAt = -1;
}

/** The parry key: its wind-up, its live ticks, its recovery (Book 10 "Parry"; DF-4). */
export function pressParry(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  pool: StaminaPool,
  window = cb.parry.window,
): PressResult {
  if (!free(f) && f.state !== 'block') return 'REFUSED';
  if (f.weapon === null && !f.shield) return 'REFUSED';
  const no = canSpend(f, pool);
  if (no !== null) return no;
  spend(pool, cb.parry.cost, tick);
  f.state = 'parryWindup';
  f.since = tick;
  f.recoveryEnd = tick + cb.parry.windup;
  // The live ticks are fixed at the press (the option, the sword's extra).
  f.activeAt = tick + cb.parry.windup;
  f.activeEnd = f.activeAt + parryWindowOf(f, cb, window);
  f.move = null;
  f.riposteUntil = -1;
  return 'STARTED';
}

function enterLower(f: Fighter, tick: number, cb: CombatBalance): void {
  enterTimed(f, 'blockLower', tick, cb.block.lower);
}

/**
 * The block key held or let go (Book 10 "Block"; DF-5). Held, the shield comes up over Book 10's
 * raise and is live from then; let go, it comes down over the lower. Only a shield blocks (Book
 * 10 "Fight rules", blockNeedsShield); an exhausted fighter cannot raise it.
 */
export function setBlock(f: Fighter, on: boolean, tick: number, cb?: CombatBalance): PressResult {
  if (!on) {
    f.guard = false;
    if (f.state === 'block' && cb !== undefined) enterLower(f, tick, cb);
    else if (f.state === 'block') {
      f.state = 'idle';
      f.since = tick;
    }
    return 'STARTED';
  }
  if (!f.shield) return 'NO_SHIELD';
  if (f.exhausted) return 'EXHAUSTED';
  f.guard = true;
  if (f.state === 'idle') {
    if (cb === undefined) {
      f.state = 'block';
      f.since = tick;
    } else enterTimed(f, 'blockRaise', tick, cb.block.raise);
    f.guard = true;
  }
  return 'STARTED';
}

/** Whether a dodge may start now: at ease or from a held guard, and not exhausted. */
export function canDodge(f: Fighter): boolean {
  if (f.exhausted) return false;
  return free(f) || f.state === 'block';
}

/**
 * The dodge key (Book 10 "Dodge"; DF-6): a dip and push-off, a dash along `dir` with an
 * invulnerable middle, then a planted recovery; a large stamina cost.
 */
export function pressDodge(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  dir: { x: number; y: number } | null,
  pool: StaminaPool,
): PressResult {
  if (f.exhausted) return 'EXHAUSTED';
  if (!canDodge(f)) return 'REFUSED';
  const no = canSpend(f, pool);
  if (no !== null) return no;
  spend(pool, cb.dodge.stamina, tick);
  const d =
    dir === null || Math.hypot(dir.x, dir.y) < 1e-6
      ? { x: -Math.cos(f.angle) + 0, y: -Math.sin(f.angle) + 0 }
      : dir;
  const len = Math.hypot(d.x, d.y);
  f.state = 'dodge';
  f.since = tick;
  f.guard = false;
  f.dodge = { x: d.x / len, y: d.y / len };
  f.activeAt = tick + cb.dodge.start;
  f.recoveryEnd = tick + cb.dodge.start + cb.dodge.dash;
  f.queued = false;
  f.lunge = null;
  f.move = null;
  return 'STARTED';
}

/**
 * The ground a dodge (or a sidestep, or an archer's hop) covers on a tick of its dash, eased out:
 * the distance so far is `tiles` x (1 - (1 - k/dash)^2) (Book 10 dodgeDash).
 */
export function dashStep(k: number, dash: number, tiles: number): number {
  if (k < 0 || k >= dash) return 0;
  const at = (n: number): number => tiles * (1 - (1 - n / dash) ** 2);
  return at(k + 1) - at(k);
}

/**
 * A sidestep from a missile (Book 10 awareDodge, sidestepMove): a tell, then a dodge's dash across
 * the missile's path along `dir`, then the dodge's recovery. `missile` is the one it reads.
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
  f.recoveryEnd = tick + tell + cb.dodge.dash;
  f.dodge = { x: dir.x / len, y: dir.y / len };
  f.target = `missile:${String(missile)}`;
  f.guard = false;
}

/**
 * The shove (or a shield's bash): breaks a block and makes space (Book 10: its stamina and
 * stagger; "Frame data", Unarmed Shove and Shield Bash). From a held guard it is the bash.
 */
export function pressShove(
  f: Fighter,
  tick: number,
  cb: CombatBalance,
  facing: number | Facing,
  pool: StaminaPool,
): PressResult {
  const angle = typeof facing === 'number' ? facing : FACING_ANGLE[facing];
  if (!free(f) && f.state !== 'block') return 'REFUSED';
  const no = canSpend(f, pool);
  if (no !== null) return no;
  const m = f.shield ? cb.shove.bash : cb.shove.frames;
  spend(pool, cb.shove.stamina, tick);
  setAngle(f, angle);
  f.guard = false;
  beginStrike(f, 'shove', 'shove', tick, tick + windupFor(f, cb, m), m, 0);
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
    | 'stagger'
    | 'blockStun'
    | 'guardBroken'
    | 'parryRecovery'
    | 'parried'
    | 'knockdown'
    | 'getUp'
    | 'parry'
    | 'blockRaise'
    | 'blockLower'
    | 'dodgeRecovery'
    | 'recovery',
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
  f.flashAt = -1;
  if (state !== 'parry' && state !== 'parryRecovery') f.move = null;
}

export type FighterEvent =
  | { readonly type: 'CHARGE_LEVEL'; readonly level: 1 | 2 }
  | { readonly type: 'AUTO_RELEASE' }
  | { readonly type: 'ACTIVE' }
  | { readonly type: 'MISSED' }
  | { readonly type: 'STATE_ENDED'; readonly state: CombatState; readonly heal?: HealUnderWay };

/** Back to rest after an action. */
function toIdle(f: Fighter, tick: number): void {
  f.state = 'idle';
  f.since = tick;
  f.combo = 0;
  f.queued = false;
  f.lunge = null;
  f.target = null;
  f.riposte = false;
  f.dodge = null;
  f.heal = null;
  f.move = null;
  f.missed = false;
  f.step = 0;
  f.flashAt = -1;
}

/**
 * One tick of the fighter's own clock: the charge's levels and its maximum hold, a strike's active
 * ticks beginning, a swing that met no one recovering longer (its miss recovery), a queued chain
 * following its recovery, the parry, block and dodge moving through their phases, poise
 * refilling, exhaustion following the bar, and timed states ending (a knockdown into the get-up).
 * Hits are the caller's (it knows where everyone stands). A fighter in hitstop does not step.
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
  updateExhausted(f, pool, cb, tick);
  // Poise refills after Book 10's pause without a hit.
  if (f.poiseLost > 0 && tick - f.poiseAt >= cb.poise.regenDelay)
    f.poiseLost = Math.max(0, f.poiseLost - cb.poise.regenPerSecond / 60);
  const w = weaponOf(f, cb);
  if (charging(f)) {
    const held = tick - f.since;
    if (f.state === 'chargeL0' && held >= cb.charge.level1At) {
      f.state = 'chargeL1';
      f.weight = (w === null ? null : movesOf(cb, w.name, 'heavy'))?.weight ?? 'HEAVY';
      out.push({ type: 'CHARGE_LEVEL', level: 1 });
    }
    if (f.state === 'chargeL1' && held >= cb.charge.level2At) {
      f.state = 'chargeL2';
      f.weight = (w === null ? null : movesOf(cb, w.name, 'charged'))?.weight ?? 'CHARGED';
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
    // A missed attack leaves the attacker highly vulnerable (Book 10 "Commitment", missRecovery).
    if (tick === f.activeEnd && !f.hit && !f.missed) {
      const m =
        f.move === 'shove'
          ? f.shield
            ? cb.shove.bash
            : cb.shove.frames
          : w !== null && f.move !== null
            ? movesOf(cb, w.name, f.move)
            : null;
      if (m?.miss != null) {
        f.recoveryEnd += m.miss;
        f.missed = true;
        out.push({ type: 'MISSED' });
      }
    }
    if (tick >= f.recoveryEnd) {
      const ended = f.state;
      const next = ended === 'light1' ? 'light2' : ended === 'light2' ? 'light3' : null;
      const m = next === null || w === null ? null : movesOf(cb, w.name, next);
      if (f.queued && m !== null && next !== null && !f.exhausted && pool.current > 0) {
        const combo = f.combo + 1;
        beginStrike(f, next, next, tick, tick + windupFor(f, cb, m), m, 0);
        f.combo = combo;
        spend(pool, m.stamina, tick);
      } else toIdle(f, tick);
      out.push({ type: 'STATE_ENDED', state: ended });
    }
    return out;
  }
  if (TIMED.includes(f.state) && tick >= f.recoveryEnd) {
    const ended = f.state;
    const heal = f.heal;
    if (ended === 'parryWindup') {
      // The parry is live for its active ticks.
      f.state = 'parry';
      f.since = tick;
      f.recoveryEnd = f.activeEnd;
    } else if (ended === 'parry') {
      // Nothing was parried: the mistimed parry's recovery, open to a punish.
      enterTimed(f, 'parryRecovery', tick, cb.parry.recovery);
    } else if (ended === 'knockdown') {
      enterTimed(f, 'getUp', tick, cb.poise.getUpTicks);
    } else if (ended === 'dodge') {
      enterTimed(f, 'dodgeRecovery', tick, cb.dodge.recovery);
      f.dodge = null;
    } else if (ended === 'sidestep') {
      enterTimed(f, 'dodgeRecovery', tick, cb.dodge.recovery);
      f.dodge = null;
      f.target = null;
    } else if (ended === 'blockRaise' || ended === 'blockStun') {
      if (f.guard && f.shield && !f.exhausted) {
        f.state = 'block';
        f.since = tick;
      } else if (f.shield) enterLower(f, tick, cb);
      else toIdle(f, tick);
    } else {
      toIdle(f, tick);
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
  if (f.flashAt >= 0) f.flashAt += ticks;
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
 * The block's stamina (Book 10 "Guard", blockCost; "Block", blockDrain): the factor of the blow's
 * vs-shield damage plus the flat cost, double on a shield the axe hooked aside.
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

/** Whether the guard is live: the shield up past its raise (Book 10 "Block", blockRaise). */
export function guardLive(f: Fighter): boolean {
  return f.shield && (f.state === 'block' || f.state === 'blockStun');
}

/**
 * Resolves a blow against a defender (Book 2 section 12; design addendum 2.5): a dodge's
 * invulnerable ticks, then a live parry from the front (the overlap rule: this is the blow's first
 * active tick that meets the parrier), then a live guard from the front (a guard break breaks it
 * and lands; an axe's heavy hooks it aside; else it drains stamina, and a drain that empties the
 * bar breaks the guard with Book 10's large stagger), else a hit. `attackerDir` is the vector from
 * the defender to the attacker. A riposte cannot be parried or blocked.
 */
export function resolveBlow(
  attacker: Fighter,
  defender: Fighter,
  blow: Blow,
  attackerDir: { readonly x: number; readonly y: number },
  tick: number,
  cb: CombatBalance,
  _parryWindow: number,
  pool: StaminaPool,
): Outcome {
  if (invulnerable(defender, tick, cb)) return 'DODGED';
  if (blow.unblockable || blow.kind === 'backstab') return 'HIT';
  const front = (arc: number): boolean =>
    inFrontAngle(defender.angle, attackerDir.x, attackerDir.y, arc);
  if (parrying(defender) && front(cb.block.arcDegrees)) {
    // Success: the attacker is stunned, the parry's cost comes back, and the parrier's remaining
    // ticks become a settle before the riposte (Book 10 "Parry": parryStun, parrySettle).
    pool.current += cb.parry.cost;
    enterTimed(defender, 'parryRecovery', tick, cb.parry.settle);
    defender.riposteUntil = tick + cb.parry.open;
    enterTimed(attacker, 'parried', tick, cb.parry.open);
    attacker.guard = false;
    return 'PARRIED';
  }
  if (guardLive(defender) && front(cb.block.arcDegrees)) {
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
      // Emptied: the guard breaks with the large stagger, and the blocker is exhausted.
      breakGuard(defender, tick, cb, cb.block.breakEmpty, false);
      defender.exhausted = true;
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
 * the defender staggers (a big enough hit knocks down) and the poise refills, ending any action
 * (Book 10 "Commitment", interrupt); else a flinch that does not stop what they are doing. A
 * riposte and a backstab ignore poise: they always stagger.
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
  // A broken guard keeps its own (longer) stagger.
  if (defender.state === 'guardBroken' && defender.recoveryEnd - tick > cb.poise.staggerTicks)
    return 'STAGGER';
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

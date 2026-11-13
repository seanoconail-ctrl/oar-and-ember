/**
 * Typed access to Book 10's combat numbers (Stage 9): section 06 (weapons, the charged heavy,
 * defence, the fight rules, vitality and armour, downed and carried), section 07 (archetypes,
 * perception, cohesion and surrender, fighters' habits), section 08's berserk trait and section
 * 24's heavy build. Each value is parsed strictly, as in balance.ts: if Book 10's wording changes,
 * loading fails with the table, key and value rather than reading a wrong number.
 */

type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rows(json: unknown, section: string, table: string): Row[] {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables[section] : undefined;
  const list = isRecord(sec) ? sec[table] : undefined;
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${section}.${table}`);
  return list as Row[];
}

function keyed(json: unknown, section: string, table: string): (key: string) => string {
  const list = rows(json, section, table);
  return (key) => {
    const value = list.find((r) => r['Key'] === key)?.['Value'];
    if (value === undefined) throw new Error(`balance.json: ${section}.${table} has no "${key}"`);
    return value;
  };
}

function fail(where: string, value: string, expected: string): never {
  throw new Error(`balance.json: ${where} is "${value}"; expected ${expected}`);
}

const N = '(\\d+(?:\\.\\d+)?)';

/** The numbers a pattern captures from a keyed value, or a clear failure. */
function grab(
  table: (key: string) => string,
  where: string,
  key: string,
  pattern: string,
  expected: string,
): number[] {
  const text = table(key);
  const m = new RegExp(pattern).exec(text);
  if (m === null) fail(`${where}.${key}`, text, expected);
  return m.slice(1).map(Number);
}

function num(where: string, value: string | undefined): number {
  if (value === undefined || !/^-?\d+(\.\d+)?$/.test(value)) fail(where, value ?? '', 'a number');
  return Number(value);
}

/**
 * The melee weapons of Book 10 section 06, "Weapon movesets" (combat v2, decision DE-4). The bow
 * and the thrown spear are missiles; bare hands and the shield bash are the shove.
 */
export const MELEE_WEAPONS = [
  'Seax',
  'Hand axe',
  'Spear',
  'Sword',
  'Dane axe',
  'Club or hammer',
] as const;
export type MeleeWeaponName = (typeof MELEE_WEAPONS)[number];
/** How armour takes a blow (Book 10 "Weapon rules": mail by damage type). */
export type DamageType = 'CUT' | 'THRUST' | 'BLOW';

/** A move's class for its telegraph and sound (Book 10 "Frame data", Weight). */
export type Weight = 'LIGHT' | 'HEAVY' | 'CHARGED';
/** The moves of Book 10's "Frame data" (design addendum 2.5; decision DF-10). */
export type MoveName =
  'light1' | 'light2' | 'light3' | 'heavy' | 'charged' | 'lunge' | 'riposte' | 'backstab';

/**
 * One move's frames (Book 10 "Frame data"): wind-up, active and recovery ticks, the miss recovery
 * added when its active ticks meet no one (null: it starts only on a target in reach), the step in
 * tiles covered over its active ticks, its stamina, and its chain window (null: none).
 */
export interface MoveFrames {
  readonly weight: Weight;
  readonly windup: number;
  readonly active: number;
  readonly recovery: number;
  readonly miss: number | null;
  readonly step: number;
  readonly stamina: number;
  readonly chain: number | null;
}

/** One weapon's moveset: reach, combo, damage, type, poise damage and stamina, and its frames. */
export interface WeaponStats {
  readonly name: MeleeWeaponName;
  readonly reachTiles: number;
  /** Light attacks in a chain. */
  readonly combo: number;
  /** Every move's frames (design addendum 2.5, "Frame data"). */
  readonly moves: Readonly<Partial<Record<MoveName, MoveFrames>>>;
  readonly damage: number;
  readonly type: DamageType;
  /** What a blow costs a shield (the block's stamina is Guard's blockCost of this). */
  readonly vsShield: number;
  readonly poiseDamage: number;
  readonly stamina: number;
}

export interface MissileDamage {
  readonly damage: number;
  readonly vsShield: number;
  readonly poiseDamage: number;
}

export interface CombatBalance {
  readonly weapons: Readonly<Record<MeleeWeaponName, WeaponStats>>;
  /** Bare hands' shove and the shield bash (both the shove): their reach and poise damage. */
  readonly unarmed: { readonly reachTiles: number; readonly poiseDamage: number };
  readonly shieldBash: { readonly reachTiles: number; readonly poiseDamage: number };
  readonly arrow: MissileDamage;
  readonly thrownSpear: MissileDamage;
  /** Bone heads (Book 10 section 21, headDamage). */
  readonly boneHead: { readonly damage: number; readonly vsShield: number };
  readonly charge: {
    readonly level1At: number;
    readonly level1: { readonly damage: number; readonly vsShield: number };
    readonly level2At: number;
    readonly level2Damage: number;
    readonly maxHold: number;
    readonly staminaL1: number;
    readonly staminaL2: number;
  };
  /** Design addendum 2.5's predictive parry (Book 10 "Parry"; decision DF-4). */
  readonly parry: {
    /** Ticks before the parry is live. */
    readonly windup: number;
    /** Its live ticks (the overlap window), and the difficulty option's widest. */
    readonly window: number;
    readonly windowMax: number;
    /** Ticks of recovery after the live ticks when nothing was parried (open to a punish). */
    readonly recovery: number;
    /** On a parry, the parrier's remaining ticks become this settle before a riposte. */
    readonly settle: number;
    readonly cost: number;
    /** A sword widens the live ticks by this many (Weapon rules, swordParry; Parry, parryActive). */
    readonly swordExtra: number;
    /** Hitstop on both fighters (Parry and riposte, parryHitstop). */
    readonly hitstop: number;
    /** The parried attacker reels open this long (parryOpen). */
    readonly open: number;
    /** The riposte's reach beyond the weapon's, in tiles. */
    readonly riposteReachExtra: number;
    readonly riposteTicks: Readonly<Record<MeleeWeaponName, number>>;
    readonly riposteDamage: number;
    readonly riposteDamageSword: number;
    /** The share of a riposte's (and a backstab's) ticks that is its windup (riposteFrames). */
    readonly windupShare: number;
  };
  readonly block: {
    readonly arcDegrees: number;
    /** Guard's blockCost: factor x the vs-shield damage + flat. */
    readonly costFactor: number;
    readonly costFlat: number;
    /** A broken guard leaves the blocker open this long (Guard, guardBreak; Block, guardBreakOther). */
    readonly guardBreak: number;
    readonly stun: number;
    /** Design addendum 2.5 (Book 10 "Block"; decision DF-5): raising and lowering take ticks. */
    readonly raise: number;
    readonly lower: number;
    /** A raised shield's speed share. */
    readonly speed: number;
    /** A hit that empties the bar: the stagger's ticks and its knockback in px. */
    readonly breakEmpty: number;
    readonly breakEmptyPx: number;
  };
  /** Design addendum 2.5's dodge (Book 10 "Dodge"; decision DF-6). */
  readonly dodge: {
    readonly stamina: number;
    /** The dip and push-off, the dash, and the planted recovery, in ticks. */
    readonly start: number;
    readonly dash: number;
    readonly recovery: number;
    /** The whole dodge, start to end of recovery. */
    readonly ticks: number;
    /** The invulnerable ticks of the dodge (counted from its first tick), inclusive. */
    readonly invulnFrom: number;
    readonly invulnTo: number;
    readonly tiles: number;
  };
  readonly shove: {
    readonly stamina: number;
    readonly stagger: number;
    /** Its frames (Book 10 "Frame data": Unarmed, Shove; Shield, Bash). */
    readonly frames: MoveFrames;
    readonly bash: MoveFrames;
    readonly reachTiles: number;
    /** How far the one shoved is pushed back. */
    readonly pushTiles: number;
  };
  /** The bow's draw, loose and recovery, and the spear's throw (Book 10 "Frame data"). */
  readonly bowFrames: MoveFrames;
  readonly throwFrames: MoveFrames;
  /** Book 10 "Commitment" (decision DF-1): the punish's hitstop and poise multiple. */
  readonly commitment: { readonly punishHitstop: number; readonly punishPoise: number };
  /** Book 10 "Telegraphs" (decision DF-9). */
  readonly telegraphs: {
    readonly floor: Readonly<Record<Weight, number>>;
    readonly floorDraw: number;
    readonly enemyLungeTell: number;
    /** How far the weapon is drawn back past its ready pose, in px, by weight. */
    readonly drawBack: Readonly<Record<Weight, number>>;
    /** The flash's frames, and its lead before the first active tick. */
    readonly flashFrames: number;
    readonly flashLead: number;
  };
  /** Book 10 "Movement and acceleration" (decision DF-2): ticks to full speed and to stop. */
  readonly accel: {
    readonly modes: Readonly<Record<AccelMode, { readonly up: number; readonly stop: number }>>;
    /** Run from a walk. */
    readonly runFromWalk: number;
    readonly mail: number;
    readonly heavy: number;
    readonly both: number;
    /** Exhausted and blocking speed shares. */
    readonly exhaustedSpeed: number;
    readonly blockingSpeed: number;
  };
  /** Book 10 "Exhausted" (decision DF-3). */
  readonly exhausted: {
    /** Recovered at this share of the current maximum. */
    readonly until: number;
    readonly regenDelay: number;
    readonly exhaustedRegenDelay: number;
    readonly regenPerSecond: number;
    readonly exhaustedRegenPerSecond: number;
    readonly speed: number;
  };
  readonly strikeArcDegrees: number;
  readonly bodyRadiusTiles: number;
  readonly vitality: number;
  readonly stamina: {
    readonly max: number;
    readonly regenPerSecond: number;
    readonly regenDelay: number;
  };
  readonly armour: {
    readonly padded: number;
    readonly mailCut: number;
    readonly mailThrust: number;
    readonly mailBlow: number;
  };
  readonly bloodiedBelow: number;
  /** Book 10 section 08, Wounds: a light wound's loss of vitality maximum. */
  readonly lightWoundVitality: number;
  readonly secondWind: { readonly ticks: number; readonly liftTo: number };
  readonly dismemberChance: number;
  readonly finisherHold: number;
  /**
   * Ketill's red blow (Book 10 "Teaching foes", redBlow; decision DG-9): set by the fight from
   * src/content/pt3Balance.ts, so the fighter's miss recovery finds it.
   */
  readonly redBlow?: MoveFrames;
  readonly finishWarningTicks: number;
  readonly heavy: {
    readonly windupExtra: number;
    readonly damage: number;
    readonly runSpeed: number;
    readonly carrySpeed: number;
    readonly runStamina: number;
  };
  readonly berserk: {
    readonly onWounded: number;
    readonly onFriendFalls: number;
    readonly ticks: number;
    readonly damage: number;
    readonly defence: number;
  };
  /** Book 10 "Stance and lock-on" (decisions DE-2 and DE-3). Angles in degrees. */
  readonly stance: {
    readonly turnDegreesPerTick: number;
    readonly forward: number;
    readonly strafe: number;
    readonly backOff: number;
    /** Within this many degrees of the facing, movement is forward; beyond backDegrees, backing off. */
    readonly forwardDegrees: number;
    readonly backDegrees: number;
    readonly lockOnRange: number;
    readonly lockOnConeDegrees: number;
    readonly lockReleaseHoldTicks: number;
    readonly lockLostRange: number;
    readonly lockLostTicks: number;
    readonly lockCameraShare: number;
  };
  /** Book 10 "Weapon rules". */
  readonly rules: {
    readonly axeHookTicks: number;
    readonly spearEdge: number;
    readonly spearKeepTiles: number;
    readonly spearInsideTiles: number;
    readonly spearInsideDamage: number;
    readonly spearInsideWindup: number;
    readonly shieldBreaksAfter: number;
  };
  /** Book 10 "Lunge". */
  readonly lunge: {
    readonly tiles: Readonly<Record<MeleeWeaponName, number>>;
    readonly tellTicks: number;
    readonly staminaExtra: number;
  };
  /** Book 10 "Poise". */
  readonly poise: {
    readonly ordinary: number;
    readonly heavy: number;
    readonly padded: number;
    readonly mail: number;
    readonly chargedL1: number;
    readonly chargedL2: number;
    readonly regenPerSecond: number;
    readonly regenDelay: number;
    readonly staggerTicks: number;
    readonly knockdownAt: number;
    readonly knockdownTicks: number;
    readonly getUpTicks: number;
  };
  /** Book 10 "Hit reactions" (decision DE-7): hitstop ticks, knockback px, flinch, shake. */
  readonly hit: {
    readonly hitstopClean: number;
    readonly hitstopCleanSeax: number;
    readonly hitstopCleanHeavyWeapon: number;
    readonly hitstopHeavy: number;
    readonly hitstopRiposte: number;
    readonly hitstopParry: number;
    readonly hitstopBlock: number;
    readonly knockbackLight: number;
    readonly knockbackHeavy: number;
    readonly knockbackBig: number;
    readonly flinchTicks: number;
    readonly flashFrames: number;
    readonly shakeHeavy: {
      readonly px: number;
      readonly ticks: number;
      readonly steererDamage: number;
    };
    readonly shakeRiposte: { readonly px: number; readonly ticks: number };
  };
  /** Book 10 "Health, stamina and healing": binding a wound and eating. */
  readonly heal: {
    readonly bindTicks: number;
    readonly bindVitality: number;
    readonly eatTicks: number;
    readonly eatVitality: number;
    readonly eatStamina: number;
    readonly stepTiles: number;
    readonly maxBindings: number;
    readonly maxRations: number;
    readonly rationRd: number;
  };
  /** Book 10 "Bars" (presentation): the fade and the enemy's bar. */
  readonly bars: {
    readonly fadeAfterTicks: number;
    readonly fadeTicks: number;
    readonly enemyBarTicks: number;
  };
}

/** Ticks per second (Book 2 section 03). */
const HZ = 60;

/** The modes of Book 10 "Movement and acceleration". */
export type AccelMode =
  'walk' | 'run' | 'sneak' | 'backOff' | 'strafe' | 'blocking' | 'exhausted' | 'carry';

const MOVE_NAMES: Readonly<Record<string, MoveName>> = {
  'Light 1': 'light1',
  'Light 2': 'light2',
  'Light 3': 'light3',
  Heavy: 'heavy',
  'Charged heavy': 'charged',
  Lunge: 'lunge',
  Riposte: 'riposte',
  Backstab: 'backstab',
};

const WEIGHTS: Readonly<Record<string, Weight>> = {
  Light: 'LIGHT',
  Heavy: 'HEAVY',
  Charged: 'CHARGED',
};

/** A "Frame data" row read strictly (a dash, "-", for no miss recovery or chain window). */
function moveFrames(r: Row, where: string): MoveFrames {
  const weight = WEIGHTS[r['Weight'] ?? ''];
  if (weight === undefined) fail(`${where}.Weight`, r['Weight'] ?? '', 'Light, Heavy or Charged');
  const opt = (col: string): number | null =>
    r[col] === '-' ? null : num(`${where}.${col}`, r[col]);
  return {
    weight,
    windup: num(`${where}.Wind-up`, r['Wind-up']),
    active: num(`${where}.Active`, r['Active']),
    recovery: num(`${where}.Recovery`, r['Recovery']),
    miss: opt('Miss recovery'),
    step: num(`${where}.Step`, r['Step']),
    stamina: num(`${where}.Stamina`, r['Stamina']),
    chain: opt('Chain window'),
  };
}

const DAMAGE_TYPES: Readonly<Record<string, DamageType>> = {
  Cut: 'CUT',
  Thrust: 'THRUST',
  Blow: 'BLOW',
};

export function parseCombatBalance(json: unknown): CombatBalance {
  const moveRows = rows(json, 'combatTimings', 'weaponMovesets');
  const row = (name: string): Row => {
    const r = moveRows.find((w) => w['Weapon'] === name);
    if (r === undefined) throw new Error(`balance.json: weaponMovesets has no ${name} row`);
    return r;
  };
  const cell = (name: string, col: string): number =>
    num(`weaponMovesets.${name}.${col}`, row(name)[col]);
  // Design addendum 2.5 (decision DF-10): every move's frames.
  const frameRows = rows(json, 'combatTimings', 'frameData');
  const framesOf = (weapon: string, move: string): MoveFrames => {
    const r = frameRows.find((x) => x['Weapon'] === weapon && x['Move'] === move);
    if (r === undefined) throw new Error(`balance.json: frameData has no ${weapon} ${move} row`);
    return moveFrames(r, `frameData.${weapon}.${move}`);
  };
  const weapons = {} as Record<MeleeWeaponName, WeaponStats>;
  for (const name of MELEE_WEAPONS) {
    const moves: Partial<Record<MoveName, MoveFrames>> = {};
    for (const r of frameRows.filter((x) => x['Weapon'] === name)) {
      const move = MOVE_NAMES[r['Move'] ?? ''];
      if (move === undefined) fail(`frameData.${name}.Move`, r['Move'] ?? '', 'a known move');
      moves[move] = moveFrames(r, `frameData.${name}.${r['Move'] ?? ''}`);
    }
    const typeText = row(name)['Type'] ?? '';
    const type = DAMAGE_TYPES[typeText];
    if (type === undefined) fail(`weaponMovesets.${name}.Type`, typeText, 'Cut, Thrust or Blow');
    weapons[name] = {
      name,
      reachTiles: cell(name, 'Reach'),
      combo: cell(name, 'Combo'),
      moves,
      damage: cell(name, 'Damage'),
      type,
      vsShield: cell(name, 'vs shield'),
      poiseDamage: cell(name, 'Poise damage'),
      stamina: cell(name, 'Stamina'),
    };
  }
  const missile = (name: string): MissileDamage => ({
    damage: cell(name, 'Damage'),
    vsShield: cell(name, 'vs shield'),
    poiseDamage: cell(name, 'Poise damage'),
  });

  const ch = keyed(json, 'combatTimings', 'chargedHeavy');
  const [l1, l1d, l1s] = grab(
    ch,
    'chargedHeavy',
    'level1At',
    `^(\\d+) ticks held: damage x${N}, vs shield x${N}, tell: glint$`,
    '"N ticks held: damage xN, vs shield xN, tell: glint"',
  );
  const [l2, l2d] = grab(
    ch,
    'chargedHeavy',
    'level2At',
    `^(\\d+) ticks held: damage x${N}, guard break \\(unblockable, parryable\\), tell: flash and sound$`,
    '"N ticks held: damage xN, guard break (unblockable, parryable), tell: flash and sound"',
  );
  const [maxHold] = grab(
    ch,
    'chargedHeavy',
    'maxHold',
    '^(\\d+) ticks, then auto-release$',
    '"N ticks, then auto-release"',
  );
  const [s1, s2] = grab(
    ch,
    'chargedHeavy',
    'staminaCost',
    `^Weapon stamina x${N} \\(L1\\), x${N} \\(L2\\)$`,
    '"Weapon stamina xN (L1), xN (L2)"',
  );

  const d = keyed(json, 'combatTimings', 'defence');
  const [pcost] = grab(
    d,
    'defence',
    'parryCost',
    '^(\\d+) stamina, refunded on success$',
    '"N stamina, refunded on success"',
  );
  const [arc] = grab(d, 'defence', 'blockArc', '^(\\d+) degrees front$', '"N degrees front"');
  const [ss, sstag] = grab(
    d,
    'defence',
    'shove',
    '^(\\d+) stamina; breaks block; target staggered (\\d+) ticks$',
    '"N stamina; breaks block; target staggered N ticks"',
  );

  const f = keyed(json, 'combatTimings', 'fightRules');
  const [strikeArc] = grab(
    f,
    'fightRules',
    'strikeArc',
    '^(\\d+) degrees in front',
    '"N degrees in front ..."',
  );
  const [body] = grab(f, 'fightRules', 'bodyRadius', `^${N} tiles:`, '"N tiles: ..."');
  const [blockStun] = grab(f, 'fightRules', 'blockStun', '^(\\d+) ticks:', '"N ticks: ..."');
  // The shove's reach is bare hands' (Weapon movesets, Unarmed), its push the row's Strength.
  const unarmedStrength = row('Unarmed')['Strength'] ?? '';
  const pushMatch = new RegExp(`pushes ${N} tiles`).exec(unarmedStrength);
  if (pushMatch === null)
    fail('weaponMovesets.Unarmed.Strength', unarmedStrength, '"... pushes N tiles ..."');
  const spush = Number(pushMatch[1]);

  const v = keyed(json, 'combatTimings', 'vitalityStaminaAndArmour');
  const [vit] = grab(v, 'vitality', 'vitality', '^(\\d+) for', '"N for ..."');
  const [bloodied] = grab(v, 'vitality', 'bloodiedBelow', '^(\\d+)% vitality$', '"N% vitality"');
  const [swSec, swTo] = grab(
    v,
    'vitality',
    'secondWind',
    '^(\\d+) seconds; adjacent ally lifts the steerer to (\\d+) vitality; once per scene$',
    '"N seconds; adjacent ally lifts the steerer to N vitality; once per scene"',
  );
  const [dism] = grab(v, 'vitality', 'dismemberChance', '^(\\d+)% on killing blows', '"N% ..."');
  const [finish] = grab(v, 'vitality', 'finisherHold', '^(\\d+) ticks$', '"N ticks"');

  const dc = keyed(json, 'combatTimings', 'downedAndCarried');
  const [warn] = grab(
    dc,
    'downedAndCarried',
    'finishWarning',
    '^Berserkers and named cruel enemies may finish the downed, after a visible (\\d+) s warning',
    '"... after a visible N s warning ..."',
  );

  const h = keyed(json, 'heavyBuild', 'table');
  const [hw] = grab(h, 'heavyBuild', 'windup', '^\\+(\\d+) ticks on every attack$', '"+N ticks"');
  const [hd] = grab(h, 'heavyBuild', 'damage', `^x${N}$`, '"xN"');
  const [hr] = grab(h, 'heavyBuild', 'runSpeed', `^x${N}$`, '"xN"');
  const [hc] = grab(h, 'heavyBuild', 'carrySpeed', `^x${N} carrying`, '"xN carrying ..."');
  const [hs] = grab(h, 'heavyBuild', 'runStamina', `^Running drains x${N}$`, '"Running drains xN"');

  const traits = rows(json, 'peopleSkillsAndWounds', 'traits');
  const berserkText = traits.find((r) => r['Trait'] === 'Berserk')?.['Effect'] ?? '';
  const b =
    /^When wounded \((\d+)%\) or when a friend falls \((\d+)%\), goes berserk for (\d+) s: .*damage x(\d+(?:\.\d+)?), defence x(\d+(?:\.\d+)?);/.exec(
      berserkText,
    );
  if (b === null)
    fail(
      'traits.Berserk',
      berserkText,
      '"When wounded (N%) or when a friend falls (N%), goes berserk for N s: ... damage xN, defence xN; ..."',
    );
  const woundRows = rows(json, 'peopleSkillsAndWounds', 'wounds');
  const lightText = woundRows.find((r) => r['Severity'] === 'Light')?.['Effect'] ?? '';
  const light = /^-(\d+) vitality max$/.exec(lightText);
  if (light === null) fail('wounds.Light.Effect', lightText, '"-N vitality max"');
  const arrows = keyed(json, 'controlsAndCamera', 'arrows');
  const [bone, boneShield] = grab(
    arrows,
    'arrows',
    'headDamage',
    `^Bone heads: damage x${N} and vs shield x${N};`,
    '"Bone heads: damage xN and vs shield xN; ..."',
  );

  // ---------------------------------------------------------------- combat v2 (decision DE-13)
  const st = keyed(json, 'combatTimings', 'stanceAndLockOn');
  const sg = (key: string, pattern: string): number[] =>
    grab(st, 'stanceAndLockOn', key, pattern, `"${pattern}"`);
  const [turnRate] = sg('turnRate', '^(\\d+) degrees per second$');
  const [fwd] = sg('forward', `^${N} x walking speed$`);
  const [strafe] = sg('strafe', `^${N} x walking speed$`);
  const [back] = sg('backOff', `^${N} x walking speed$`);
  const fwdNote = rows(json, 'combatTimings', 'stanceAndLockOn').find(
    (r) => r['Key'] === 'forward',
  )?.['Notes'];
  const backNote = rows(json, 'combatTimings', 'stanceAndLockOn').find(
    (r) => r['Key'] === 'backOff',
  )?.['Notes'];
  const fd = /^Moving within (\d+) degrees of the faced direction$/.exec(fwdNote ?? '');
  if (fd === null)
    fail('stanceAndLockOn.forward.Notes', fwdNote ?? '', '"Moving within N degrees ..."');
  const bd = /^Moving more than (\d+) degrees off it/.exec(backNote ?? '');
  if (bd === null)
    fail(
      'stanceAndLockOn.backOff.Notes',
      backNote ?? '',
      '"Moving more than N degrees off it ..."',
    );
  const [lockRange] = sg('lockOnRange', `^${N} tiles$`);
  const [lockCone] = sg('lockOnCone', '^(\\d+) degrees$');
  const [relHold, relRange, relSight] = sg(
    'lockOnRelease',
    `^Holding the key ${N} s; the target dead, downed or surrendered; the target beyond ${N} tiles, or out of sight for ${N} s$`,
  );
  const [camShare] = sg(
    'lockOnCamera',
    `^The look-ahead points at the target and is ${N} of the way to it`,
  );

  const wr = keyed(json, 'combatTimings', 'weaponRules');
  const wg = (key: string, pattern: string): number[] =>
    grab(wr, 'weaponRules', key, pattern, `"${pattern}"`);
  const [hook] = wg(
    'axeHook',
    "the blocker's guard is open for (\\d+) ticks and its next block costs double$",
  );
  const [edge] = wg(
    'spearEdge',
    '^A spear thrust blocked by a single shield still lands (\\d+)% of its damage',
  );
  const [keep] = wg('spearKeep', `^A spear hit pushes the one struck back ${N} tiles$`);
  const [insideAt, insideDmg, insideWind] = wg(
    'spearInside',
    `^Against a foe nearer than ${N} tiles, a spear does x${N} damage and its windup is (\\d+) ticks longer$`,
  );
  const [swordParry] = wg('swordParry', '^A sword widens the parry window by (\\d+) ticks$');
  const [mailCut] = wg('mailCut', '^Mail: -(\\d+)% from cuts$');
  const [mailThrust] = wg('mailThrust', '^Mail: -(\\d+)% from thrusts and missiles$');
  const [mailBlow] = wg('mailBlow', '^Mail: -(\\d+)% from blows$');
  const [padded] = wg('padded', '^Padded: -(\\d+)% from everything$');
  const [breaksAfter] = wg('shieldBreaks', '^A shield breaks after (\\d+) guard breaks');

  const lu = keyed(json, 'combatTimings', 'lunge');
  const [lungeAll, lungeSpear, lungeHeavy] = grab(
    lu,
    'lunge',
    'lungeDistance',
    `^${N} tiles covered during the windup \\(spear ${N}; Dane axe and club ${N}\\); the seax and bare hands do not lunge$`,
    '"N tiles covered during the windup (spear N; Dane axe and club N); ..."',
  );
  const [lungeTell] = grab(
    lu,
    'lunge',
    'lungeTell',
    ', (\\d+) ticks before the windup starts',
    '"..., N ticks before the windup starts"',
  );
  const [lungeStam] = grab(
    lu,
    'lunge',
    'lungeStamina',
    "^The attack's stamina \\+ (\\d+)$",
    '"The attack\'s stamina + N"',
  );

  const pr = keyed(json, 'combatTimings', 'parryAndRiposte');
  const pg = (key: string, pattern: string): number[] =>
    grab(pr, 'parryAndRiposte', key, pattern, `"${pattern}"`);
  const [pHit] = pg('parryHitstop', '^(\\d+) ticks on both fighters');
  const [pOpen] = pg('parryOpen', '^The parried attacker reels open for (\\d+) ticks$');
  const [ripReach] = pg('riposteReach', `^The weapon's reach \\+ ${N} tiles`);
  const [rSeax, rSword, rSpear, rAxe, rClub, rDane] = pg(
    'riposteTicks',
    '^Seax (\\d+), sword (\\d+), spear (\\d+), hand axe (\\d+), club (\\d+), Dane axe (\\d+):',
  );
  const [ripDmg, ripSword] = pg('riposteDamage', `^x${N} the weapon's damage \\(sword x${N}\\)`);
  const [share] = pg('riposteFrames', "^The riposte's ticks are (\\d+)% windup");

  const po = keyed(json, 'combatTimings', 'poise');
  const og = (key: string, pattern: string): number[] =>
    grab(po, 'poise', key, pattern, `"${pattern}"`);
  const [pOrd] = og('poiseOrdinary', '^(\\d+):');
  const [pHeavy] = og('poiseHeavy', '^(\\d+):');
  const [pPad, pMail] = og('poiseArmour', '^\\+(\\d+) padded; \\+(\\d+) mail$');
  const [pc1, pc2] = og(
    'poiseCharged',
    `x${N} its weapon's poise damage at level 1 and x${N} at level 2$`,
  );
  const [pRegen, pDelay] = og('poiseRegen', '^(\\d+) a second, after (\\d+) ticks without a hit$');
  const [pStag] = og('poiseBreak', '^Stagger for (\\d+) ticks');
  const [kdAt, kdTicks, kdUp] = og(
    'knockdown',
    '^A hit that breaks poise with (\\d+) poise damage or more knocks down: (\\d+) ticks on the ground, then (\\d+) to get up$',
  );

  const gu = keyed(json, 'combatTimings', 'guard');
  const [bf, bflat] = grab(
    gu,
    'guard',
    'blockCost',
    `^${N} x the attack's vs-shield damage \\+ (\\d+) stamina a block$`,
    '"N x the attack\'s vs-shield damage + N stamina a block"',
  );
  const [gbTicks] = grab(
    gu,
    'guard',
    'guardBreak',
    'the guard is broken and the blocker open for (\\d+) ticks$',
    '"... open for N ticks"',
  );

  const hr2 = keyed(json, 'combatTimings', 'hitReactions');
  const hg = (key: string, pattern: string): number[] =>
    grab(hr2, 'hitReactions', key, pattern, `"${pattern}"`);
  const [hsClean, hsSeax, hsHeavyW] = hg(
    'hitstopClean',
    '^(\\d+) ticks for a clean hit \\(seax (\\d+); club and Dane axe (\\d+)\\)$',
  );
  const [hsHeavy] = hg('hitstopHeavy', '^(\\d+) ticks:');
  const [hsRip] = hg('hitstopRiposte', '^(\\d+) ticks$');
  const [hsParry] = hg('hitstopParry', '^(\\d+) ticks');
  const [hsBlock] = hg('hitstopBlock', '^(\\d+) ticks?$');
  const [kbL] = hg('knockbackLight', '^(\\d+) px$');
  const [kbH] = hg('knockbackHeavy', '^(\\d+) px:');
  const [kbR] = hg('knockbackRiposte', '^(\\d+) px:');
  const [flinch] = hg('flinch', 'flinches the body for (\\d+) ticks');
  const [flash] = hg('flash', '^(\\d+) frames? on the one hit$');
  const [shPx, shTicks, shDmg] = hg(
    'shakeHeavy',
    '^(\\d+) px for (\\d+) ticks: a heavy hit, or a hit of (\\d+) damage or more taken by the steerer$',
  );
  const [srPx, srTicks] = hg('shakeRiposte', '^(\\d+) px for (\\d+) ticks:');

  const hs2 = keyed(json, 'combatTimings', 'healthStaminaAndHealing');
  const sh = (key: string, pattern: string): number[] =>
    grab(hs2, 'healthStaminaAndHealing', key, pattern, `"${pattern}"`);
  const [smax] = sh('staminaMax', '^(\\d+)$');
  const [sregen, sdelay] = sh(
    'staminaRegen',
    '^(\\d+) a second after (\\d+) ticks without spending; half while blocking$',
  );
  const [bindS, bindV] = sh(
    'bindWound',
    `^${N} real seconds kneeling; uses 1 binding; restores (\\d+) vitality`,
  );
  const [eatS, eatV, eatSt] = sh(
    'eat',
    `^${N} real seconds; uses 1 carried ration; restores (\\d+) vitality and (\\d+) stamina$`,
  );
  // "half a tile" is the number (0.5) in Book 10's wording.
  sh('healInterrupt', 'a run or a step of more than half a tile ends it');
  const [maxB, maxR, rationRd] = sh(
    'healCarry',
    `^Up to (\\d+) bindings and (\\d+) carried rations \\(each (\\d+) rd taken from the stores\\)$`,
  );

  const ba = keyed(json, 'combatTimings', 'bars');
  const [fadeAfter, fadeOver] = grab(
    ba,
    'bars',
    'barsFade',
    `fades out ${N} s after it last changed, over ${N} s`,
    '"... fades out N s after it last changed, over N s ..."',
  );
  const [enemyBar] = grab(
    ba,
    'bars',
    'enemyBar',
    `over any enemy for ${N} s after it was last hit$`,
    '"... over any enemy for N s after it was last hit"',
  );

  // ------------------------------------------------- design addendum 2.5 (decisions DF-1 to DF-10)
  const t2 = (table: string): ((key: string, pattern: string) => number[]) => {
    const k = keyed(json, 'combatTimings', table);
    return (key, pattern) => grab(k, table, key, pattern, `"${pattern}"`);
  };
  const cm = t2('commitment');
  const [punishStop, punishPoise] = cm(
    'punish',
    `: hitstopHeavy \\((\\d+) ticks\\) and x${N} the blow's poise damage$`,
  );
  const tg = t2('telegraphs');
  const [fl] = tg('floorLight', '^(\\d+) ticks$');
  const [fh] = tg('floorHeavy', '^(\\d+) ticks$');
  const [fc] = tg('floorCharged', '^(\\d+) ticks$');
  const [fd2] = tg('floorDraw', '^(\\d+) ticks$');
  const [elt] = tg('enemyLungeTell', '^(\\d+) ticks$');
  const [dbl, dbh, dbc] = tg(
    'drawBack',
    '^(\\d+) px for a light, (\\d+) px for a heavy, (\\d+) px for a charged attack$',
  );
  const [flF, flLead] = tg('flash', '^(\\d+) frames?, (\\d+) ticks before the first active tick$');
  const accRows = rows(json, 'combatTimings', 'movementAndAcceleration');
  const accRow = (mode: string): Row => {
    const r = accRows.find((x) => x['Mode'] === mode);
    if (r === undefined) throw new Error(`balance.json: movementAndAcceleration has no ${mode}`);
    return r;
  };
  const ticksOf = (mode: string, col: string): number => {
    const text = accRow(mode)[col] ?? '';
    const m = /^(\d+) ticks$/.exec(text);
    if (m === null) fail(`movementAndAcceleration.${mode}.${col}`, text, '"N ticks"');
    return Number(m[1]);
  };
  const accel = (mode: string): { up: number; stop: number } => ({
    up: ticksOf(mode, 'To full speed'),
    stop: ticksOf(mode, 'To stop'),
  });
  const runNote = accRow('Run')['Notes'] ?? '';
  const runWalk = /from a walk (\d+) ticks/.exec(runNote);
  if (runWalk === null)
    fail('movementAndAcceleration.Run.Notes', runNote, '"... from a walk N ticks ..."');
  const speedShare = (mode: string): number => {
    const text = accRow(mode)['Speed'] ?? '';
    const m = new RegExp(`^${N} x the speed the way moved$`).exec(text);
    if (m === null)
      fail(`movementAndAcceleration.${mode}.Speed`, text, '"N x the speed the way moved"');
    return Number(m[1]);
  };
  const factor = (mode: string): number => {
    const text = accRow(mode)['To full speed'] ?? '';
    const m = new RegExp(`^x${N} the ticks$`).exec(text);
    if (m === null) fail(`movementAndAcceleration.${mode}`, text, '"xN the ticks"');
    return Number(m[1]);
  };
  const heavyNote = accRow('Heavy build')['Notes'] ?? '';
  const both = new RegExp(`In mail as well, x${N}`).exec(heavyNote);
  if (both === null)
    fail('movementAndAcceleration.Heavy build.Notes', heavyNote, '"In mail as well, xN"');
  const ex = t2('exhausted');
  const [exUntil] = ex('exhaustedUntil', '^(\\d+)% of the current maximum$');
  const [exDelay] = ex('regenDelay', '^(\\d+) ticks after the last cost$');
  const [exZeroDelay] = ex('exhaustedRegenDelay', '^(\\d+) ticks after reaching 0$');
  const [rr, rrEx] = ex('regenRate', '^(\\d+) a second; (\\d+) a second while exhausted$');
  const [exSpeed] = ex('exhaustedSpeed', `^${N} x the speed the way moved$`);
  const pa = t2('parry');
  const [pWind] = pa('parryWindup', '^(\\d+) ticks$');
  const [pAct, pActMax, pSword] = pa(
    'parryActive',
    '^(\\d+) ticks \\(option: up to (\\d+)\\); a sword \\+(\\d+)$',
  );
  const [pRec] = pa('parryRecovery', '^(\\d+) ticks after the active ticks');
  const [pSettle] = pa('parrySettle', 'become a (\\d+)-tick settle');
  const [pCost] = pa('parryStamina', '^(\\d+), refunded on a parry$');
  const bl = t2('block');
  const [bRaise] = bl('blockRaise', '^(\\d+) ticks$');
  const [bLower] = bl('blockLower', '^(\\d+) ticks after the key is let go$');
  const [bSpeed] = bl('blockSpeed', `^${N} x the speed the way moved$`);
  const [gbe, gbePx] = bl('guardBreakEmpty', '^(\\d+) ticks of stagger, knocked back (\\d+) px');
  const [gbo] = bl('guardBreakOther', 'open (\\d+) ticks\\)$');
  const dg = t2('dodge');
  const [dStart] = dg('dodgeStart', '^(\\d+) ticks');
  const [dDash, dTiles] = dg('dodgeDash', `^(\\d+) ticks covering ${N} tiles`);
  const [, , dInv0, dInv1] = dg(
    'dodgeInvulnerable',
    '^Dash ticks (\\d+) to (\\d+) \\(ticks (\\d+) to (\\d+) of the dodge\\)',
  );
  const [dRec] = dg('dodgeRecovery', '^(\\d+) ticks');
  const [dTotal] = dg('dodgeTotal', '^(\\d+) ticks$');
  const [dStam] = dg('dodgeStamina', '^(\\d+)$');
  if ((dStart ?? 0) + (dDash ?? 0) + (dRec ?? 0) !== dTotal)
    fail('dodge.dodgeTotal', String(dTotal), 'dodgeStart + dodgeDash + dodgeRecovery');
  if ((gbo ?? 0) !== (gbTicks ?? 0))
    fail('block.guardBreakOther', String(gbo), `Guard's guardBreak (${String(gbTicks)})`);

  return {
    weapons,
    unarmed: { reachTiles: cell('Unarmed', 'Reach'), poiseDamage: cell('Unarmed', 'Poise damage') },
    shieldBash: {
      reachTiles: cell('Shield', 'Reach'),
      poiseDamage: cell('Shield', 'Poise damage'),
    },
    arrow: missile('Hunting bow'),
    thrownSpear: missile('Spear, thrown'),
    boneHead: { damage: bone ?? 1, vsShield: boneShield ?? 1 },
    charge: {
      level1At: l1 ?? 0,
      level1: { damage: l1d ?? 1, vsShield: l1s ?? 1 },
      level2At: l2 ?? 0,
      level2Damage: l2d ?? 1,
      maxHold: maxHold ?? 0,
      staminaL1: s1 ?? 1,
      staminaL2: s2 ?? 1,
    },
    parry: {
      windup: pWind ?? 0,
      window: pAct ?? 0,
      windowMax: pActMax ?? 0,
      recovery: pRec ?? 0,
      settle: pSettle ?? 0,
      cost: pCost ?? pcost ?? 0,
      swordExtra: pSword ?? swordParry ?? 0,
      hitstop: pHit ?? 0,
      open: pOpen ?? 0,
      riposteReachExtra: ripReach ?? 0,
      riposteTicks: {
        Seax: rSeax ?? 0,
        Sword: rSword ?? 0,
        Spear: rSpear ?? 0,
        'Hand axe': rAxe ?? 0,
        'Club or hammer': rClub ?? 0,
        'Dane axe': rDane ?? 0,
      },
      riposteDamage: ripDmg ?? 1,
      riposteDamageSword: ripSword ?? 1,
      windupShare: (share ?? 0) / 100,
    },
    block: {
      arcDegrees: arc ?? 0,
      costFactor: bf ?? 0,
      costFlat: bflat ?? 0,
      guardBreak: gbTicks ?? 0,
      stun: blockStun ?? 0,
      raise: bRaise ?? 0,
      lower: bLower ?? 0,
      speed: bSpeed ?? 1,
      breakEmpty: gbe ?? 0,
      breakEmptyPx: gbePx ?? 0,
    },
    dodge: {
      stamina: dStam ?? 0,
      start: dStart ?? 0,
      dash: dDash ?? 0,
      recovery: dRec ?? 0,
      ticks: dTotal,
      invulnFrom: Number(dInv0),
      invulnTo: Number(dInv1),
      tiles: dTiles ?? 0,
    },
    shove: {
      stamina: ss ?? 0,
      stagger: sstag ?? 0,
      frames: framesOf('Unarmed', 'Shove'),
      bash: framesOf('Shield', 'Bash'),
      reachTiles: cell('Unarmed', 'Reach'),
      pushTiles: spush,
    },
    bowFrames: framesOf('Hunting bow', 'Draw, loose, recover'),
    throwFrames: framesOf('Spear, thrown', 'Throw'),
    commitment: { punishHitstop: punishStop ?? 0, punishPoise: punishPoise ?? 1 },
    telegraphs: {
      floor: { LIGHT: fl ?? 0, HEAVY: fh ?? 0, CHARGED: fc ?? 0 },
      floorDraw: fd2 ?? 0,
      enemyLungeTell: elt ?? 0,
      drawBack: { LIGHT: dbl ?? 0, HEAVY: dbh ?? 0, CHARGED: dbc ?? 0 },
      flashFrames: flF ?? 0,
      flashLead: flLead ?? 0,
    },
    accel: {
      modes: {
        walk: accel('Walk'),
        run: accel('Run'),
        sneak: accel('Sneak'),
        backOff: accel('Back off'),
        strafe: accel('Strafe'),
        blocking: accel('Blocking'),
        exhausted: accel('Exhausted'),
        carry: accel('Carry'),
      },
      runFromWalk: Number(runWalk[1]),
      mail: factor('In mail'),
      heavy: factor('Heavy build'),
      both: Number(both[1]),
      exhaustedSpeed: speedShare('Exhausted'),
      blockingSpeed: speedShare('Blocking'),
    },
    exhausted: {
      until: (exUntil ?? 0) / 100,
      regenDelay: exDelay ?? 0,
      exhaustedRegenDelay: exZeroDelay ?? 0,
      regenPerSecond: rr ?? 0,
      exhaustedRegenPerSecond: rrEx ?? 0,
      speed: exSpeed ?? 1,
    },
    strikeArcDegrees: strikeArc ?? 0,
    bodyRadiusTiles: body ?? 0,
    vitality: vit ?? 0,
    stamina: {
      max: smax ?? 0,
      regenPerSecond: sregen ?? 0,
      regenDelay: sdelay ?? 0,
    },
    armour: {
      padded: (padded ?? 0) / 100,
      mailCut: (mailCut ?? 0) / 100,
      mailThrust: (mailThrust ?? 0) / 100,
      mailBlow: (mailBlow ?? 0) / 100,
    },
    bloodiedBelow: (bloodied ?? 0) / 100,
    lightWoundVitality: Number(light[1]),
    secondWind: { ticks: (swSec ?? 0) * HZ, liftTo: swTo ?? 0 },
    dismemberChance: (dism ?? 0) / 100,
    finisherHold: finish ?? 0,
    finishWarningTicks: (warn ?? 0) * HZ,
    heavy: {
      windupExtra: hw ?? 0,
      damage: hd ?? 1,
      runSpeed: hr ?? 1,
      carrySpeed: hc ?? 1,
      runStamina: hs ?? 1,
    },
    berserk: {
      onWounded: Number(b[1]) / 100,
      onFriendFalls: Number(b[2]) / 100,
      ticks: Number(b[3]) * HZ,
      damage: Number(b[4]),
      defence: Number(b[5]),
    },
    stance: {
      turnDegreesPerTick: (turnRate ?? 0) / HZ,
      forward: fwd ?? 1,
      strafe: strafe ?? 1,
      backOff: back ?? 1,
      forwardDegrees: Number(fd[1]),
      backDegrees: Number(bd[1]),
      lockOnRange: lockRange ?? 0,
      lockOnConeDegrees: lockCone ?? 0,
      lockReleaseHoldTicks: Math.round((relHold ?? 0) * HZ),
      lockLostRange: relRange ?? 0,
      lockLostTicks: Math.round((relSight ?? 0) * HZ),
      lockCameraShare: camShare ?? 0,
    },
    rules: {
      axeHookTicks: hook ?? 0,
      spearEdge: (edge ?? 0) / 100,
      spearKeepTiles: keep ?? 0,
      spearInsideTiles: insideAt ?? 0,
      spearInsideDamage: insideDmg ?? 1,
      spearInsideWindup: insideWind ?? 0,
      shieldBreaksAfter: breaksAfter ?? 0,
    },
    lunge: {
      tiles: {
        Seax: 0,
        'Hand axe': lungeAll ?? 0,
        Spear: lungeSpear ?? 0,
        Sword: lungeAll ?? 0,
        'Dane axe': lungeHeavy ?? 0,
        'Club or hammer': lungeHeavy ?? 0,
      },
      tellTicks: lungeTell ?? 0,
      staminaExtra: lungeStam ?? 0,
    },
    poise: {
      ordinary: pOrd ?? 0,
      heavy: pHeavy ?? 0,
      padded: pPad ?? 0,
      mail: pMail ?? 0,
      chargedL1: pc1 ?? 1,
      chargedL2: pc2 ?? 1,
      regenPerSecond: pRegen ?? 0,
      regenDelay: pDelay ?? 0,
      staggerTicks: pStag ?? 0,
      knockdownAt: kdAt ?? 0,
      knockdownTicks: kdTicks ?? 0,
      getUpTicks: kdUp ?? 0,
    },
    hit: {
      hitstopClean: hsClean ?? 0,
      hitstopCleanSeax: hsSeax ?? 0,
      hitstopCleanHeavyWeapon: hsHeavyW ?? 0,
      hitstopHeavy: hsHeavy ?? 0,
      hitstopRiposte: hsRip ?? 0,
      hitstopParry: hsParry ?? 0,
      hitstopBlock: hsBlock ?? 0,
      knockbackLight: kbL ?? 0,
      knockbackHeavy: kbH ?? 0,
      knockbackBig: kbR ?? 0,
      flinchTicks: flinch ?? 0,
      flashFrames: flash ?? 0,
      shakeHeavy: { px: shPx ?? 0, ticks: shTicks ?? 0, steererDamage: shDmg ?? 0 },
      shakeRiposte: { px: srPx ?? 0, ticks: srTicks ?? 0 },
    },
    heal: {
      bindTicks: Math.round((bindS ?? 0) * HZ),
      bindVitality: bindV ?? 0,
      eatTicks: Math.round((eatS ?? 0) * HZ),
      eatVitality: eatV ?? 0,
      eatStamina: eatSt ?? 0,
      stepTiles: 0.5,
      maxBindings: maxB ?? 0,
      maxRations: maxR ?? 0,
      rationRd: rationRd ?? 0,
    },
    bars: {
      fadeAfterTicks: Math.round((fadeAfter ?? 0) * HZ),
      fadeTicks: Math.round((fadeOver ?? 0) * HZ),
      enemyBarTicks: Math.round((enemyBar ?? 0) * HZ),
    },
  };
}

/** Book 10 section 07: an archetype's vitality and armour. */
export interface ArchetypeStats {
  readonly vitality: number;
  readonly armour: 'NONE' | 'PADDED' | 'MAIL';
}

/** Book 10 section 07: perception, cohesion and surrender, the fighters' habits, and combat v2. */
export interface AiBalance {
  readonly archetypes: Readonly<Record<string, ArchetypeStats>>;
  readonly sight: {
    readonly day: number;
    readonly dusk: number;
    /** Minutes either side of first light and of dark that count as dusk. */
    readonly duskMinutes: number;
    readonly night: number;
    readonly fogFactor: number;
    readonly heightBonus: number;
    readonly coneDegrees: number;
    readonly rainFactor: number;
  };
  readonly noise: {
    readonly sneak: number;
    readonly walk: number;
    readonly run: number;
    readonly combat: number;
    readonly shout: number;
    readonly shingle: number;
    readonly sand: number;
    readonly grass: number;
    readonly rock: number;
    readonly water: number;
    readonly rain: number;
  };
  readonly memoryTicks: number;
  readonly torchLightTiles: number;
  readonly cohesion: {
    readonly start: number;
    readonly allyKilled: number;
    readonly allyDowned: number;
    readonly leaderKilled: number;
    readonly memberBloodied: number;
    readonly outnumbered: number;
    readonly outnumberedEveryTicks: number;
    readonly surrenderBelow: number;
    readonly fleeBelow: number;
    readonly noQuarterAfter: number;
  };
  readonly habits: {
    /** Awareness fills and decays this often (Book 10 awarenessEvery). */
    readonly awarenessEvery: number;
    readonly reactChance: number;
    readonly reactTicks: number;
    readonly parryShare: number;
    readonly heavyChance: number;
    readonly archerRange: { readonly min: number; readonly max: number };
    readonly archerArrows: number;
    readonly searchTicks: number;
    readonly crewFollow: number;
    readonly crewProtect: number;
    readonly orderLapseTicks: number;
    /** How many of one group may be in an attack on one target at once (S9-29). */
    readonly attackTokens: number;
    /** Ticks a side waits after the last attack on a target ends before the next starts. */
    readonly tokenRestTicks: number;
    /** The share of its reach a fighter closes to before it strikes. */
    readonly closeIn: number;
    readonly runAt: number;
    readonly crewRunAt: number;
    readonly guardHeld: number;
    readonly fledAt: number;
  };
  /** Book 10 section 08 Cowardly: breaks when cohesion falls below this. */
  readonly cowardBreak: number;
  readonly braveCohesion: number;
  /** Book 10 "Awareness" (decision DE-9). */
  readonly awareness: {
    readonly fillNear: number;
    readonly nearTiles: number;
    readonly fillFar: number;
    readonly fillNoise: number;
    readonly footfallTicks: number;
    readonly suspiciousAt: number;
    readonly alertAt: number;
    readonly decayPerSecond: number;
    readonly decayAfterTicks: number;
    readonly markAlertTicks: number;
  };
  /** Book 10 "Sneaking". */
  readonly sneaking: {
    readonly speed: number;
    readonly hideTiles: number;
    readonly shadow: number;
  };
  /** Book 10 "Sneak attacks". */
  readonly sneakAttacks: {
    readonly backArcDegrees: number;
    readonly killAtOrBelow: number;
    readonly damage: number;
    readonly damageSeax: number;
    readonly ticks: number;
    readonly ticksSeax: number;
    readonly noiseTiles: number;
    readonly unawareMissile: number;
  };
  /** Book 10 "Self-preservation" (decision DE-6). */
  readonly self: {
    readonly holdOffExtra: number;
    readonly stepOutTicks: number;
    readonly feint: number;
    readonly longReachAt: number;
    readonly longReachExtra: number;
    readonly shortReach: number;
    readonly woundedAt: number;
    /** Patience is this many times longer when wounded. */
    readonly woundedPatience: number;
    readonly woundedDefend: number;
    readonly woundedBackOff: number;
    readonly retreatAt: number;
    readonly retreatFriendTiles: number;
    readonly circleMin: number;
    readonly circleMax: number;
    readonly avoidCliffTiles: number;
    readonly avoidFireTiles: number;
    readonly leashTiles: number;
    readonly rememberDays: number;
    readonly leaveIfStronger: number;
    readonly leaveRange: number;
    readonly awareDodge: number;
    readonly sidestepTell: number;
  };
  /** Book 10 "Warnings" (decision DE-11). */
  readonly warnings: {
    readonly warnAt: number;
    readonly again: number;
    readonly lastStep: number;
    readonly gapTicks: number;
    readonly walkAway: number;
  };
  /** Book 10 "AI states" and "AI decisions" (design addendum 2.5; decision DF-7). */
  readonly states: {
    /** The least ticks in each state (its cooldown); Attack lasts until its recovery ends. */
    readonly least: Readonly<Record<FightStateName, number>>;
    /** Recover stamina goes back to Circle at this share of the maximum. */
    readonly recoverTo: number;
    /** Recover stamina backs off this far beyond the circle radius, in tiles. */
    readonly recoverExtraTiles: number;
    readonly decisionInterval: number;
    readonly attackCooldown: number;
    readonly turnAround: number;
  };
  /** Book 10 "Distances by archetype" (decision DF-7), by archetype name. */
  readonly distances: Readonly<Record<string, ArchetypeDistances>>;
  /** Book 10 "Archers" (decision DF-8). */
  readonly archers: {
    readonly shootFrom: { readonly min: number; readonly max: number };
    readonly settle: number;
    readonly recover: number;
    readonly tooClose: number;
    readonly dashTiles: number;
    readonly dashTicks: number;
    readonly dashStamina: number;
    readonly reset: number;
    readonly dashOnceTicks: number;
    readonly corneredTiles: number;
    /** Ticks to draw the sidearm (cornered or out of arrows). */
    readonly sidearmTicks: number;
  };
  /** Book 10 "The scavengers at dusk" (decisions DE-14 and DE-15). */
  readonly dusk: {
    readonly day: number;
    readonly fromMinute: number;
    readonly svartWindup: number;
    readonly svartHeavies: number;
    readonly foodRd: number;
  };
}

/** Book 10 "AI states" (Book 2 section 13's FightState). */
export type FightStateName =
  | 'IDLE'
  | 'APPROACH'
  | 'CIRCLE'
  | 'WAIT_FOR_OPENING'
  | 'ATTACK'
  | 'RETREAT'
  | 'RECOVER_STAMINA'
  | 'FLEE_OR_SURRENDER';

/** One archetype's distances (Book 10 "Distances by archetype"); null where its row has none. */
export interface ArchetypeDistances {
  /** Tiles where it stops approaching and circles (null: an archer's shooting range). */
  readonly engage: number | null;
  /** Added to its circle radius (null: it does not circle). */
  readonly margin: number | null;
  /** The stamina share below which it backs off to recover (null: never). */
  readonly recoverAt: number | null;
  /** Its patience in ticks (null: none). */
  readonly patience: { readonly min: number; readonly max: number } | null;
}

const STATE_ROWS: Readonly<Record<string, FightStateName>> = {
  Idle: 'IDLE',
  Approach: 'APPROACH',
  Circle: 'CIRCLE',
  'Wait for opening': 'WAIT_FOR_OPENING',
  Attack: 'ATTACK',
  Retreat: 'RETREAT',
  'Recover stamina': 'RECOVER_STAMINA',
  'Flee or surrender': 'FLEE_OR_SURRENDER',
};

function parseAiStates(json: unknown): Pick<AiBalance, 'states' | 'distances' | 'archers'> {
  const least = {} as Record<FightStateName, number>;
  let recoverTo = 0;
  let recoverExtra = 0;
  for (const r of rows(json, 'enemiesWildlifeAndPerception', 'aiStates')) {
    const st = STATE_ROWS[r['State'] ?? ''];
    if (st === undefined) fail('aiStates.State', r['State'] ?? '', 'a known state');
    const text = r['Least time'] ?? '';
    const m = /^(\d+) ticks$/.exec(text);
    least[st] = m === null ? 0 : Number(m[1]);
    if (m === null && st !== 'ATTACK' && st !== 'FLEE_OR_SURRENDER')
      fail(`aiStates.${st}.Least time`, text, '"N ticks"');
    if (st === 'RECOVER_STAMINA') {
      const does = r['Does'] ?? '';
      const to = /back to Circle at (\d+)%/.exec(does);
      const extra = new RegExp(`its circle radius \\+ ${N} tiles`).exec(does);
      if (to === null || extra === null)
        fail(
          'aiStates.Recover stamina.Does',
          does,
          '"... radius + N tiles ... back to Circle at N%"',
        );
      recoverTo = Number(to[1]) / 100;
      recoverExtra = Number(extra[1]);
    }
  }
  const dk = keyed(json, 'enemiesWildlifeAndPerception', 'aiDecisions');
  const dg = (key: string, pattern: string): number[] =>
    grab(dk, 'aiDecisions', key, pattern, `"${pattern}"`);
  const [interval] = dg('decisionInterval', '^(\\d+) ticks:');
  const [cool] = dg('attackCooldown', '^(\\d+) ticks after its own recovery ends');
  const [turn] = dg('turnAround', 'at most once each (\\d+) ticks');
  const distances: Record<string, ArchetypeDistances> = {};
  for (const r of rows(json, 'enemiesWildlifeAndPerception', 'distancesByArchetype')) {
    const name = (r['Archetype'] ?? '').replace(/ \(.*\)$/, '');
    const engage = /^(\d+(?:\.\d+)?)$/.exec(r['Engage'] ?? '');
    const margin = /^(\d+(?:\.\d+)?)$/.exec(r['Circle margin'] ?? '');
    const rec = /^(\d+)%$/.exec(r['Recover at'] ?? '');
    const pat = new RegExp(`^${N} to ${N} s$`).exec(r['Patience'] ?? '');
    distances[name] = {
      engage: engage === null ? null : Number(engage[1]),
      margin: margin === null ? null : Number(margin[1]),
      recoverAt: rec === null ? null : Number(rec[1]) / 100,
      patience:
        pat === null
          ? null
          : { min: Math.round(Number(pat[1]) * HZ), max: Math.round(Number(pat[2]) * HZ) },
    };
  }
  const ak = keyed(json, 'enemiesWildlifeAndPerception', 'archers');
  const ag = (key: string, pattern: string): number[] =>
    grab(ak, 'archers', key, pattern, `"${pattern}"`);
  const [sMin, sMax] = ag('shootFrom', `^${N} to ${N} tiles`);
  const [settle, recover] = ag(
    'standStill',
    '^It settles for (\\d+) ticks, then draws and looses .* and recovers for (\\d+) ticks',
  );
  const [close] = ag('tooClose', `^${N} tiles$`);
  const [dTiles, dTicks, dStam] = ag(
    'dashAway',
    `^Once: a hop back away from the target, ${N} tiles over (\\d+) ticks, (\\d+) stamina, not invulnerable$`,
  );
  const [reset] = ag('reset', '^(\\d+) ticks after the dash');
  const [once] = ag('dashOnce', `^At most one dash in ${N} real seconds$`);
  const [corner] = ag('cornered', `within ${N} tiles behind it`);
  const cornerNote =
    rows(json, 'enemiesWildlifeAndPerception', 'archers').find((r) => r['Key'] === 'cornered')?.[
      'Notes'
    ] ?? '';
  const sideM = /^It draws its sidearm \((\d+) ticks; a seax\)/.exec(cornerNote);
  if (sideM === null)
    fail('archers.cornered.Notes', cornerNote, '"It draws its sidearm (N ticks; a seax) ..."');
  const side = Number(sideM[1]);
  return {
    states: {
      least,
      recoverTo,
      recoverExtraTiles: recoverExtra,
      decisionInterval: interval ?? 0,
      attackCooldown: cool ?? 0,
      turnAround: turn ?? 0,
    },
    distances,
    archers: {
      shootFrom: { min: sMin ?? 0, max: sMax ?? 0 },
      settle: settle ?? 0,
      recover: recover ?? 0,
      tooClose: close ?? 0,
      dashTiles: dTiles ?? 0,
      dashTicks: dTicks ?? 0,
      dashStamina: dStam ?? 0,
      reset: reset ?? 0,
      dashOnceTicks: Math.round((once ?? 0) * HZ),
      corneredTiles: corner ?? 0,
      sidearmTicks: side,
    },
  };
}

export function parseAiBalance(json: unknown): AiBalance {
  const archetypes: Record<string, ArchetypeStats> = {};
  for (const r of rows(json, 'enemiesWildlifeAndPerception', 'archetypes')) {
    const name = (r['Archetype'] ?? '').replace(/ \(.*\)$/, '');
    const vitality = Number(r['Vitality']);
    if (!Number.isFinite(vitality)) continue;
    const a = r['Armour'] ?? '';
    archetypes[name] = {
      vitality,
      armour: a.startsWith('Mail') ? 'MAIL' : a.startsWith('Padded') ? 'PADDED' : 'NONE',
    };
  }
  const p = keyed(json, 'enemiesWildlifeAndPerception', 'perception');
  const n1 = (key: string, pattern = `^${N}$`): number =>
    grab(p, 'perception', key, pattern, `"${pattern}"`)[0] ?? 0;
  const c = keyed(json, 'enemiesWildlifeAndPerception', 'cohesionAndSurrender');
  const cn = (key: string, pattern = '^(-?\\d+)$'): number =>
    grab(c, 'cohesionAndSurrender', key, pattern, `"${pattern}"`)[0] ?? 0;
  const [outN, outEvery] = grab(
    c,
    'cohesionAndSurrender',
    'outnumberedTwoToOne',
    '^(-?\\d+) per (\\d+) seconds$',
    '"-N per N seconds"',
  );
  const hb = keyed(json, 'enemiesWildlifeAndPerception', 'fightersHabits');
  const g = (key: string, pattern: string): number[] =>
    grab(hb, 'fightersHabits', key, pattern, `"${pattern}"`);
  const traits = rows(json, 'peopleSkillsAndWounds', 'traits');
  const coward = /^Breaks when cohesion falls below (\d+)/.exec(
    traits.find((r) => r['Trait'] === 'Cowardly')?.['Effect'] ?? '',
  );
  const brave = /^Cohesion \+(\d+)/.exec(
    traits.find((r) => r['Trait'] === 'Brave')?.['Effect'] ?? '',
  );
  if (coward === null || brave === null)
    fail('traits.Cowardly/Brave', '', '"Breaks when cohesion falls below N" and "Cohesion +N"');
  return {
    archetypes,
    sight: {
      day: n1('sightDay'),
      dusk: n1('sightDusk'),
      duskMinutes: n1('duskSpan', `^(\\d+) minutes either side`),
      night: n1('sightNightUnlit'),
      fogFactor: n1('fogFactor'),
      heightBonus: n1('heightBonus', `^x${N}`),
      coneDegrees: n1('sightCone', `^(\\d+) degrees$`),
      rainFactor: n1('rainFactor', `^${N}:`),
    },
    noise: {
      sneak: n1('noiseSneak'),
      walk: n1('noiseWalk'),
      run: n1('noiseRun'),
      combat: n1('noiseCombat'),
      shout: n1('noiseShout'),
      shingle: n1('surfaceShingle', `^Noise x${N}$`),
      sand: n1('surfaceSand', `^Noise x${N}$`),
      grass: n1('surfaceGrass', `^Noise x${N} `),
      rock: n1('surfaceRock', `^Noise x${N}$`),
      water: n1('surfaceWater', `^Noise x${N} `),
      rain: n1('rainNoise', `^${N}:`),
    },
    memoryTicks: n1('memorySeconds') * HZ,
    torchLightTiles: n1('torchLightRadius', `^${N} tiles$`),
    cohesion: {
      start: cn('groupCohesionStart'),
      allyKilled: cn('allyKilled'),
      allyDowned: cn('allyDowned'),
      leaderKilled: cn('leaderKilled'),
      memberBloodied: cn('memberBloodied', '^(-?\\d+):'),
      outnumbered: outN ?? 0,
      outnumberedEveryTicks: (outEvery ?? 0) * HZ,
      surrenderBelow: cn('surrenderBelow'),
      fleeBelow: cn('fleeBelow'),
      noQuarterAfter: cn('noQuarterAfter', '^(\\d+) known'),
    },
    habits: {
      awarenessEvery: g('awarenessEvery', '^(\\d+) ticks:')[0] ?? 6,
      reactChance: (g('reactChance', '^(\\d+)%:')[0] ?? 0) / 100,
      reactTicks: g('reactTicks', '^(\\d+) ticks after')[0] ?? 0,
      parryShare: (g('parryShare', '^(\\d+)% of')[0] ?? 0) / 100,
      heavyChance: (g('heavyChance', '^(\\d+)% of')[0] ?? 0) / 100,
      archerRange: ((m) => ({ min: m[0] ?? 0, max: m[1] ?? 0 }))(
        g('archerRange', `^${N} to ${N} tiles:`),
      ),
      archerArrows: g('archerArrows', '^(\\d+) arrows')[0] ?? 0,
      searchTicks: (g('searchSeconds', '^(\\d+):')[0] ?? 0) * HZ,
      crewFollow: g('crewFollow', `^${N} tiles behind`)[0] ?? 0,
      crewProtect: g('crewProtect', `^${N} tiles:`)[0] ?? 0,
      orderLapseTicks: (g('orderLapse', '^(\\d+) s:')[0] ?? 0) * HZ,
      attackTokens: g('attackTokens', '^(\\d+): at most')[0] ?? 0,
      tokenRestTicks: Math.round((g('tokenRest', `^${N} s:`)[0] ?? 0) * HZ),
      closeIn: g('closeIn', `^${N}:`)[0] ?? 0,
      runAt: g('runAt', `^${N} tiles:`)[0] ?? 0,
      crewRunAt: g('crewRunAt', `^${N} tiles:`)[0] ?? 0,
      guardHeld: g('guardHeld', '^(\\d+) ticks:')[0] ?? 0,
      fledAt: g('fledAt', `^${N} tiles:`)[0] ?? 0,
    },
    cowardBreak: Number(coward[1]),
    braveCohesion: Number(brave[1]),
    ...parseCombatV2Ai(json),
    ...parseAiStates(json),
  };
}

function parseCombatV2Ai(
  json: unknown,
): Pick<AiBalance, 'awareness' | 'sneaking' | 'sneakAttacks' | 'self' | 'warnings' | 'dusk'> {
  const t = (table: string): ((key: string, pattern: string) => number[]) => {
    const k = keyed(json, 'enemiesWildlifeAndPerception', table);
    return (key, pattern) => grab(k, table, key, pattern, `"${pattern}"`);
  };
  const aw = t('awareness');
  const [fillNear, nearTiles] = aw(
    'fillNear',
    `^(\\d+) a second while the steerer is seen within ${N} tiles$`,
  );
  const [fillFar] = aw('fillFar', '^(\\d+) a second at the edge of sight range');
  const [fillNoise] = aw('fillNoise', '^\\+(\\d+) for each noise heard');
  const [footfall] = aw('footfall', `^${N} s:`);
  const [susp] = aw('suspiciousAt', '^(\\d+):');
  const [alert] = aw('alertAt', '^(\\d+):');
  const [decay, decayAfter] = aw(
    'decay',
    `^(\\d+) a second after ${N} s with nothing seen or heard`,
  );
  const [markAlert] = aw('marks', `a "!" for ${N} s on turning alert`);
  const sn = t('sneaking');
  const [speed] = sn('sneakSpeed', `^${N} tiles per second`);
  const [hide] = sn('tallGrass', `is not seen beyond ${N} tiles$`);
  const shadowText = keyed(json, 'enemiesWildlifeAndPerception', 'sneaking')('shadow');
  if (!shadowText.endsWith('is seen at half the sight range'))
    fail('sneaking.shadow', shadowText, '"... is seen at half the sight range"');
  const sa = t('sneakAttacks');
  const [backArc] = sa('backstab', "^A melee strike from within (\\d+) degrees of a target's back");
  const [killAt] = sa('backstabKill', 'whose vitality \\(Archetypes\\) is (\\d+) or less');
  const [bsDmg, bsSeax] = sa(
    'backstabDamage',
    `^Otherwise x${N} the weapon's damage \\(seax x${N}\\)`,
  );
  const [bsTicks, bsSeaxTicks] = sa('backstabTicks', '^(\\d+) ticks \\(seax (\\d+)\\)');
  const [bsNoise] = sa('backstabNoise', `^${N} tiles:`);
  const [unaware] = sa('unawareMissile', `^x${N} damage`);
  const sp = t('selfPreservation');
  const [holdOff] = sp('holdOff', `^The reach of the one they face \\+ ${N} tiles`);
  const [stepOut] = sp('stepOut', '^Within (\\d+) ticks after');
  const [feint] = sp('feint', '^(\\d+)% of a melee');
  const [longAt, longExtra] = sp(
    'longReach',
    `at least ${N} tiles longer than its own, a fighter waits a further ${N} tiles out`,
  );
  const [shortR] = sp('shortReach', `crowds in to ${N} of its own reach$`);
  const [wAt, wGap, wDef, wBack] = sp(
    'woundedAt',
    `^Below (\\d+)% vitality a fighter grows cautious: patience x${N}, it defends (\\d+) points more often, backs off ${N} tiles between attacks`,
  );
  const [rAt, rTiles] = sp(
    'retreatAt',
    `^Below (\\d+)% vitality it falls back towards the nearest friend within ${N} tiles`,
  );
  const [cMin, cMax] = sp('pressers', `the rest circle ${N} to ${N} tiles out`);
  const [cliff, fire] = sp(
    'avoid',
    `^Deep water, cliff edges within ${N} tiles?, and fire within ${N} tiles$`,
  );
  const [leash] = sp('leash', `^${N} tiles from their own ground`);
  const [remember] = sp('remember', '^(\\d+) days:');
  // "twice" is the number (2) in Book 10's wording.
  const [leaveRange] = sp('leaveIfStronger', `within ${N} tiles is twice theirs or more$`);
  const [dodge, tell] = sp(
    'awareDodge',
    '^(\\d+)%: an aware fighter that sees the shooter sidesteps an arrow or thrown spear, with a (\\d+)-tick tell',
  );
  const wa = t('warnings');
  const [warnAt] = wa('warnAt', `^${N} tiles:`);
  const [again] = wa('warnAgain', `^${N} tiles:`);
  const [last] = wa('lastStep', `^${N} tiles:`);
  const [gap] = wa('warnGap', `^At least ${N} real seconds between warnings$`);
  const [away] = wa('walkAway', `^Beyond ${N} tiles`);
  const du = t('theScavengersAtDusk');
  const [hh, mm, day] = du('when', '^From (\\d+):(\\d+) on day (\\d+) until dark');
  const [svartWindup] = du('svartWindup', "^\\+(\\d+) ticks on Svart's charged heavy");
  const [svartHeavies] = du('svartHeavies', "^(\\d+)% of Svart's attacks are charged heavies");
  const [food] = du('foodBargain', `^${N} rd of salt fish`);
  return {
    awareness: {
      fillNear: fillNear ?? 0,
      nearTiles: nearTiles ?? 0,
      fillFar: fillFar ?? 0,
      fillNoise: fillNoise ?? 0,
      footfallTicks: Math.round((footfall ?? 0) * HZ),
      suspiciousAt: susp ?? 0,
      alertAt: alert ?? 0,
      decayPerSecond: decay ?? 0,
      decayAfterTicks: Math.round((decayAfter ?? 0) * HZ),
      markAlertTicks: Math.round((markAlert ?? 0) * HZ),
    },
    sneaking: { speed: speed ?? 0, hideTiles: hide ?? 0, shadow: 0.5 },
    sneakAttacks: {
      backArcDegrees: backArc ?? 0,
      killAtOrBelow: killAt ?? 0,
      damage: bsDmg ?? 1,
      damageSeax: bsSeax ?? 1,
      ticks: bsTicks ?? 0,
      ticksSeax: bsSeaxTicks ?? 0,
      noiseTiles: bsNoise ?? 0,
      unawareMissile: unaware ?? 1,
    },
    self: {
      holdOffExtra: holdOff ?? 0,
      stepOutTicks: stepOut ?? 0,
      feint: (feint ?? 0) / 100,
      longReachAt: longAt ?? 0,
      longReachExtra: longExtra ?? 0,
      shortReach: shortR ?? 1,
      woundedAt: (wAt ?? 0) / 100,
      woundedPatience: wGap ?? 1,
      woundedDefend: (wDef ?? 0) / 100,
      woundedBackOff: wBack ?? 0,
      retreatAt: (rAt ?? 0) / 100,
      retreatFriendTiles: rTiles ?? 0,
      circleMin: cMin ?? 0,
      circleMax: cMax ?? 0,
      avoidCliffTiles: cliff ?? 0,
      avoidFireTiles: fire ?? 0,
      leashTiles: leash ?? 0,
      rememberDays: remember ?? 0,
      leaveIfStronger: 2,
      leaveRange: leaveRange ?? 0,
      awareDodge: (dodge ?? 0) / 100,
      sidestepTell: tell ?? 0,
    },
    warnings: {
      warnAt: warnAt ?? 0,
      again: again ?? 0,
      lastStep: last ?? 0,
      gapTicks: Math.round((gap ?? 0) * HZ),
      walkAway: away ?? 0,
    },
    dusk: {
      day: day ?? 1,
      fromMinute: (hh ?? 0) * 60 + (mm ?? 0),
      svartWindup: svartWindup ?? 0,
      svartHeavies: (svartHeavies ?? 0) / 100,
      foodRd: food ?? 0,
    },
  };
}

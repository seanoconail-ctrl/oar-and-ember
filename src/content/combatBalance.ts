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

/** The melee weapons of Book 10 section 06 (the bow and thrown spear are missiles). */
export const MELEE_WEAPONS = ['Spear', 'Axe', 'Sword', 'Seax', 'Dane axe'] as const;
export type MeleeWeaponName = (typeof MELEE_WEAPONS)[number];

/** One weapon's frame data (ticks at 60 Hz), reach and damage. */
export interface WeaponStats {
  readonly name: MeleeWeaponName;
  readonly reachTiles: number;
  /** Light attacks in a chain. */
  readonly combo: number;
  readonly windup: number;
  readonly active: number;
  readonly recovery: number;
  readonly chainWindow: number;
  readonly damage: number;
  /** What a blow costs a shield (the block's stamina is blockCost times this). */
  readonly vsShield: number;
  readonly stamina: number;
}

export interface MissileDamage {
  readonly damage: number;
  readonly vsShield: number;
}

export interface CombatBalance {
  readonly weapons: Readonly<Record<MeleeWeaponName, WeaponStats>>;
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
    /** Added to the weapon's recovery after a released charge. */
    readonly releaseRecoveryExtra: number;
    readonly staminaL1: number;
    readonly staminaL2: number;
  };
  readonly parry: {
    readonly startup: number;
    readonly window: number;
    /** The difficulty option's widest window. */
    readonly windowMax: number;
    readonly recoveryOnMiss: number;
    readonly cost: number;
    readonly stagger: number;
    readonly riposte: number;
  };
  readonly block: {
    readonly arcDegrees: number;
    readonly costFactor: number;
    readonly guardBreak: number;
    readonly stun: number;
  };
  readonly dodge: {
    readonly stamina: number;
    readonly ticks: number;
    readonly invulnFrom: number;
    readonly invulnTo: number;
    readonly tiles: number;
  };
  readonly shove: {
    readonly stamina: number;
    readonly stagger: number;
    readonly windup: number;
    readonly active: number;
    readonly recovery: number;
    readonly reachTiles: number;
    /** How far the one shoved is pushed back. */
    readonly pushTiles: number;
  };
  readonly strikeArcDegrees: number;
  readonly bodyRadiusTiles: number;
  readonly hitStagger: number;
  readonly hitStop: number;
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
  };
  readonly bloodiedBelow: number;
  /** Book 10 section 08, Wounds: a light wound's loss of vitality maximum. */
  readonly lightWoundVitality: number;
  readonly secondWind: { readonly ticks: number; readonly liftTo: number };
  readonly dismemberChance: number;
  readonly finisherHold: number;
  readonly finishWarningTicks: number;
  /** Book 10 section 02, "Charge (heavy)": tiles a second while holding a heavy. */
  readonly chargeSpeed: number;
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
}

/** Ticks per second (Book 2 section 03). */
const HZ = 60;

export function parseCombatBalance(json: unknown): CombatBalance {
  const weaponRows = rows(json, 'combatTimings', 'weapons');
  const row = (name: string): Row => {
    const r = weaponRows.find((w) => w['Weapon'] === name);
    if (r === undefined) throw new Error(`balance.json: weapons has no ${name} row`);
    return r;
  };
  const weapons = {} as Record<MeleeWeaponName, WeaponStats>;
  for (const name of MELEE_WEAPONS) {
    const r = row(name);
    const w = `weapons.${name}`;
    weapons[name] = {
      name,
      reachTiles: num(`${w}.Reach tiles`, r['Reach tiles']),
      combo: num(`${w}.Combo`, r['Combo']),
      windup: num(`${w}.Windup`, r['Windup']),
      active: num(`${w}.Active`, r['Active']),
      recovery: num(`${w}.Recovery`, r['Recovery']),
      chainWindow: num(`${w}.Chain window`, r['Chain window']),
      damage: num(`${w}.Damage`, r['Damage']),
      vsShield: num(`${w}.vs shield`, r['vs shield']),
      stamina: num(`${w}.Stamina`, r['Stamina']),
    };
  }
  const missile = (name: string): MissileDamage => ({
    damage: num(`weapons.${name}.Damage`, row(name)['Damage']),
    vsShield: num(`weapons.${name}.vs shield`, row(name)['vs shield']),
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
  const [extra] = grab(
    ch,
    'chargedHeavy',
    'releaseRecovery',
    '^Weapon recovery \\+ (\\d+) ticks$',
    '"Weapon recovery + N ticks"',
  );
  const [s1, s2] = grab(
    ch,
    'chargedHeavy',
    'staminaCost',
    `^Weapon stamina x${N} \\(L1\\), x${N} \\(L2\\)$`,
    '"Weapon stamina xN (L1), xN (L2)"',
  );

  const d = keyed(json, 'combatTimings', 'defence');
  const [startup] = grab(d, 'defence', 'parryStartup', '^(\\d+) ticks$', '"N ticks"');
  const [win, winMax] = grab(
    d,
    'defence',
    'parryWindow',
    '^(\\d+) ticks \\(option: up to (\\d+)\\)$',
    '"N ticks (option: up to N)"',
  );
  const [miss] = grab(d, 'defence', 'parryRecoveryOnMiss', '^(\\d+) ticks$', '"N ticks"');
  const [pcost] = grab(
    d,
    'defence',
    'parryCost',
    '^(\\d+) stamina, refunded on success$',
    '"N stamina, refunded on success"',
  );
  const [pstag, rip] = grab(
    d,
    'defence',
    'parryStagger',
    `^Attacker staggered (\\d+) ticks; riposte damage x${N}$`,
    '"Attacker staggered N ticks; riposte damage xN"',
  );
  const [arc] = grab(d, 'defence', 'blockArc', '^(\\d+) degrees front$', '"N degrees front"');
  const [bcost] = grab(
    d,
    'defence',
    'blockCost',
    `^${N} x the attack's shield damage$`,
    '"N x the attack\'s shield damage"',
  );
  const [gb] = grab(
    d,
    'defence',
    'guardBreak',
    '^Stamina empty while blocking: (\\d+) ticks broken$',
    '"Stamina empty while blocking: N ticks broken"',
  );
  const [ds, dt, di0, di1, dtiles] = grab(
    d,
    'defence',
    'dodge',
    `^(\\d+) stamina; (\\d+) ticks; invulnerable ticks (\\d+) to (\\d+); ${N} tiles$`,
    '"N stamina; N ticks; invulnerable ticks N to N; N tiles"',
  );
  const [ss, sstag] = grab(
    d,
    'defence',
    'shove',
    '^(\\d+) stamina; breaks block; target staggered (\\d+) ticks$',
    '"N stamina; breaks block; target staggered N ticks"',
  );
  const turn = d('turnLock');
  if (turn !== 'Facing locked from windup start to recovery end')
    fail('defence.turnLock', turn, '"Facing locked from windup start to recovery end"');

  const f = keyed(json, 'combatTimings', 'fightRules');
  const [strikeArc] = grab(
    f,
    'fightRules',
    'strikeArc',
    '^(\\d+) degrees in front',
    '"N degrees in front ..."',
  );
  const [body] = grab(f, 'fightRules', 'bodyRadius', `^${N} tiles:`, '"N tiles: ..."');
  const [hitStagger] = grab(f, 'fightRules', 'hitStagger', '^(\\d+) ticks:', '"N ticks: ..."');
  const [blockStun] = grab(f, 'fightRules', 'blockStun', '^(\\d+) ticks:', '"N ticks: ..."');
  const [sw, sa, sr, sreach, spush] = grab(
    f,
    'fightRules',
    'shoveTiming',
    `^Windup (\\d+) ticks, active (\\d+), recovery (\\d+); reach ${N} tiles?; pushes the one shoved ${N} tiles$`,
    '"Windup N ticks, active N, recovery N; reach N tile; pushes the one shoved N tiles"',
  );

  const v = keyed(json, 'combatTimings', 'vitalityStaminaAndArmour');
  const [vit] = grab(v, 'vitality', 'vitality', '^(\\d+) for', '"N for ..."');
  const [smax, sregen, sdelay] = grab(
    v,
    'vitality',
    'stamina',
    '^(\\d+); regenerates (\\d+) per second after (\\d+) ticks without spending; half while blocking$',
    '"N; regenerates N per second after N ticks without spending; half while blocking"',
  );
  const [padded] = grab(v, 'vitality', 'padded', '^-(\\d+)% all damage$', '"-N% all damage"');
  const [mcut, mthrust] = grab(
    v,
    'vitality',
    'mail',
    '^-(\\d+)% cut, -(\\d+)% thrust and missiles$',
    '"-N% cut, -N% thrust and missiles"',
  );
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
  const [hitStop] = grab(v, 'vitality', 'hitStop', '^(\\d+) ticks$', '"N ticks"');

  const dc = keyed(json, 'combatTimings', 'downedAndCarried');
  const [warn] = grab(
    dc,
    'downedAndCarried',
    'finishWarning',
    '^Berserkers and named cruel enemies may finish the downed, after a visible (\\d+) s warning',
    '"... after a visible N s warning ..."',
  );

  const moves = rows(json, 'timeAndTravel', 'movementOnFoot');
  const chargeRow = moves.find((r) => r['Mode'] === 'Charge (heavy)');
  const chargeSpeed = num('movementOnFoot.Charge (heavy)', chargeRow?.['Speed']);

  const h = keyed(json, 'heavyBuild', 'table');
  const [hw] = grab(h, 'heavyBuild', 'windup', '^\\+(\\d+) ticks on every attack$', '"+N ticks"');
  const [hd] = grab(h, 'heavyBuild', 'damage', `^x${N}$`, '"xN"');
  const [hr] = grab(h, 'heavyBuild', 'runSpeed', `^x${N}$`, '"xN"');
  const [hc] = grab(h, 'heavyBuild', 'carrySpeed', `^x${N} carrying`, '"xN carrying ..."');
  const [hs] = grab(h, 'heavyBuild', 'runStamina', `^Running drains x${N}$`, '"Running drains xN"');
  const poise = h('poise');
  if (poise !== 'Light attacks do not stagger a heavy fighter')
    fail('heavyBuild.poise', poise, '"Light attacks do not stagger a heavy fighter"');

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

  return {
    weapons,
    arrow: missile('Bow'),
    thrownSpear: missile('Thrown spear'),
    boneHead: { damage: bone ?? 1, vsShield: boneShield ?? 1 },
    charge: {
      level1At: l1 ?? 0,
      level1: { damage: l1d ?? 1, vsShield: l1s ?? 1 },
      level2At: l2 ?? 0,
      level2Damage: l2d ?? 1,
      maxHold: maxHold ?? 0,
      releaseRecoveryExtra: extra ?? 0,
      staminaL1: s1 ?? 1,
      staminaL2: s2 ?? 1,
    },
    parry: {
      startup: startup ?? 0,
      window: win ?? 0,
      windowMax: winMax ?? 0,
      recoveryOnMiss: miss ?? 0,
      cost: pcost ?? 0,
      stagger: pstag ?? 0,
      riposte: rip ?? 1,
    },
    block: {
      arcDegrees: arc ?? 0,
      costFactor: bcost ?? 0,
      guardBreak: gb ?? 0,
      stun: blockStun ?? 0,
    },
    dodge: {
      stamina: ds ?? 0,
      ticks: dt ?? 0,
      invulnFrom: di0 ?? 0,
      invulnTo: di1 ?? 0,
      tiles: dtiles ?? 0,
    },
    shove: {
      stamina: ss ?? 0,
      stagger: sstag ?? 0,
      windup: sw ?? 0,
      active: sa ?? 0,
      recovery: sr ?? 0,
      reachTiles: sreach ?? 0,
      pushTiles: spush ?? 0,
    },
    strikeArcDegrees: strikeArc ?? 0,
    bodyRadiusTiles: body ?? 0,
    hitStagger: hitStagger ?? 0,
    hitStop: hitStop ?? 0,
    vitality: vit ?? 0,
    stamina: { max: smax ?? 0, regenPerSecond: sregen ?? 0, regenDelay: sdelay ?? 0 },
    armour: {
      padded: (padded ?? 0) / 100,
      mailCut: (mcut ?? 0) / 100,
      mailThrust: (mthrust ?? 0) / 100,
    },
    bloodiedBelow: (bloodied ?? 0) / 100,
    lightWoundVitality: Number(light[1]),
    secondWind: { ticks: (swSec ?? 0) * HZ, liftTo: swTo ?? 0 },
    dismemberChance: (dism ?? 0) / 100,
    finisherHold: finish ?? 0,
    finishWarningTicks: (warn ?? 0) * HZ,
    chargeSpeed,
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
  };
}

/** Book 10 section 07: an archetype's vitality and armour. */
export interface ArchetypeStats {
  readonly vitality: number;
  readonly armour: 'NONE' | 'PADDED' | 'MAIL';
}

/** Book 10 section 07: perception, cohesion and surrender, and the fighters' habits. */
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
  };
  readonly noise: {
    readonly sneak: number;
    readonly walk: number;
    readonly run: number;
    readonly combat: number;
    readonly shout: number;
    readonly shingle: number;
    readonly sand: number;
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
    readonly decideEvery: number;
    readonly reactChance: number;
    readonly reactTicks: number;
    readonly parryShare: number;
    readonly heavyChance: number;
    readonly attackGap: { readonly min: number; readonly max: number };
    readonly archerRange: { readonly min: number; readonly max: number };
    readonly archerArrows: number;
    readonly searchTicks: number;
    readonly crewFollow: number;
    readonly crewProtect: number;
    readonly fallBackFrom: number;
    readonly orderLapseTicks: number;
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
    },
    noise: {
      sneak: n1('noiseSneak'),
      walk: n1('noiseWalk'),
      run: n1('noiseRun'),
      combat: n1('noiseCombat'),
      shout: n1('noiseShout'),
      shingle: n1('surfaceShingle', `^Noise x${N}$`),
      sand: n1('surfaceSand', `^Noise x${N}$`),
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
      decideEvery: g('decideEvery', '^(\\d+) ticks:')[0] ?? 6,
      reactChance: (g('reactChance', '^(\\d+)%:')[0] ?? 0) / 100,
      reactTicks: g('reactTicks', '^(\\d+) ticks after')[0] ?? 0,
      parryShare: (g('parryShare', '^(\\d+)% of')[0] ?? 0) / 100,
      heavyChance: (g('heavyChance', '^(\\d+)% of')[0] ?? 0) / 100,
      attackGap: ((m) => ({ min: (m[0] ?? 0) * HZ, max: (m[1] ?? 0) * HZ }))(
        g('attackGap', `^${N} to ${N} s between`),
      ),
      archerRange: ((m) => ({ min: m[0] ?? 0, max: m[1] ?? 0 }))(
        g('archerRange', `^${N} to ${N} tiles:`),
      ),
      archerArrows: g('archerArrows', '^(\\d+) arrows')[0] ?? 0,
      searchTicks: (g('searchSeconds', '^(\\d+):')[0] ?? 0) * HZ,
      crewFollow: g('crewFollow', `^${N} tiles behind`)[0] ?? 0,
      crewProtect: g('crewProtect', `^${N} tiles:`)[0] ?? 0,
      fallBackFrom: g('fallBackFrom', `^${N} tiles:`)[0] ?? 0,
      orderLapseTicks: (g('orderLapse', '^(\\d+) s:')[0] ?? 0) * HZ,
      closeIn: g('closeIn', `^${N}:`)[0] ?? 0,
      runAt: g('runAt', `^${N} tiles:`)[0] ?? 0,
      crewRunAt: g('crewRunAt', `^${N} tiles:`)[0] ?? 0,
      guardHeld: g('guardHeld', '^(\\d+) ticks:')[0] ?? 0,
      fledAt: g('fledAt', `^${N} tiles:`)[0] ?? 0,
    },
    cowardBreak: Number(coward[1]),
    braveCohesion: Number(brave[1]),
  };
}

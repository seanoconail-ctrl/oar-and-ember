/**
 * Typed access to the Book 10 rows of the user's fourth playtest that combat and the AI read
 * (decisions DH-70 to DH-99): "The steerer's death" and "Hitboxes" (section 06), "Guarding and
 * pursuit", "Target choice", "Running off" and "Attack pace" (section 07). Parsed strictly, as
 * combatBalance.ts and pt3Balance.ts are: if Book 10's wording changes, loading fails with the
 * table, key and value rather than reading a wrong number.
 */
import type { MeleeWeaponName } from './combatBalance.ts';

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

function keyed(json: unknown, section: string, table: string) {
  const list = rows(json, section, table);
  return (key: string, column = 'Value'): string => {
    const value = list.find((r) => r['Key'] === key)?.[column];
    if (value === undefined)
      throw new Error(`balance.json: ${section}.${table} has no "${key}" (${column})`);
    return value;
  };
}

const N = '(\\d+(?:\\.\\d+)?)';

function grab(text: string, where: string, pattern: string): number[] {
  const m = new RegExp(pattern).exec(text);
  if (m === null) throw new Error(`balance.json: ${where} is "${text}"; expected /${pattern}/`);
  return m.slice(1).map(Number);
}

function one(text: string, where: string, pattern: string): number {
  return grab(text, where, pattern)[0] ?? 0;
}

const HZ = 60;
const ticks = (seconds: number): number => Math.round(seconds * HZ);

/** How a weapon's blow meets a body (Book 10 "Hitboxes"). */
export interface Hitbox {
  /** THRUST: a line along the facing; SWING: an arc in front. */
  readonly shape: 'THRUST' | 'SWING';
  /** A swing's arc, in degrees (the whole arc, centred on the facing). */
  readonly arcDegrees: number;
  /** A thrust's half-width beyond the struck body's edge, in tiles. */
  readonly halfWidthTiles: number;
  /** A thrust's shaft held this far right of the facing line, in tiles. */
  readonly handTiles: number;
}

export interface Pt4Balance {
  /** Book 10 "The steerer's death" (decision DH-71). */
  readonly death: {
    readonly buckleTicks: number;
    readonly fallFrames: number;
    readonly fallFrameTicks: number;
    readonly soundFadeSeconds: number;
    readonly soundQuickSeconds: number;
    readonly beatSeconds: number;
    readonly restoreSeconds: number;
  };
  /** Book 10 "Hitboxes" (decision DH-76), by weapon row. */
  readonly hitboxes: Readonly<Partial<Record<MeleeWeaponName, Hitbox>>>;
  /** Book 10 "Hitbox checks": how far a drawn tip may lie from the hitbox's reach, in tiles. */
  readonly hitboxToleranceTiles: number;
  /** Book 10 "Guarding and pursuit" (decisions DH-72 and DH-73), in tiles and ticks. */
  readonly guard: {
    readonly radiusTiles: number;
    readonly resumeTiles: number;
    readonly homeTiles: number;
    readonly chaseTicks: number;
    readonly pursuitResumeTiles: number;
    readonly spreadTiles: number;
    readonly waitTiles: number;
  };
  /** Book 10 "Target choice" (decision DH-74). */
  readonly threat: {
    readonly memoryTicks: number;
    readonly perDamage: number;
    readonly struckMe: number;
    readonly steerer: number;
    readonly attacking: number;
    readonly near: number;
    readonly nearTiles: number;
    readonly weak: number;
    readonly keep: number;
    readonly switchAt: number;
  };
  /** Book 10 "Running off" (decision DH-75). */
  readonly runOff: {
    /** The logical view (px) and the look-ahead (tiles) the run's "out of sight" allows for. */
    readonly viewW: number;
    readonly viewH: number;
    readonly lookTiles: number;
    readonly keepTiles: number;
    readonly marginTiles: number;
    readonly replanTicks: number;
  };
  /** Book 10 "Attack pace" (decision DH-77). */
  readonly pace: {
    readonly spearPatience: number;
    readonly spearCooldownTicks: number;
  };
}

export function parsePt4Balance(json: unknown): Pt4Balance {
  const d = keyed(json, 'combatTimings', 'theSteererSDeath');
  const fall = grab(d('collapseFall'), 'collapseFall', `^${N} frames of ${N} ticks`);
  const fade = d('soundFade');
  const g = keyed(json, 'enemiesWildlifeAndPerception', 'guardingAndPursuit');
  const t = keyed(json, 'enemiesWildlifeAndPerception', 'targetChoice');
  const near = grab(
    t('threatNear'),
    'threatNear',
    `^${N} at the fighter's own body, falling evenly to 0 at ${N} tiles`,
  );
  const r = keyed(json, 'enemiesWildlifeAndPerception', 'runningOff');
  const p = keyed(json, 'enemiesWildlifeAndPerception', 'attackPace');
  const hitboxes: Partial<Record<MeleeWeaponName, Hitbox>> = {};
  for (const row of rows(json, 'combatTimings', 'hitboxes')) {
    const weapon = row['Weapon'] as MeleeWeaponName | undefined;
    const shape = row['Shape'];
    if (weapon === undefined || (shape !== 'Thrust' && shape !== 'Swing'))
      throw new Error(`balance.json: hitboxes row ${JSON.stringify(row)}`);
    const size = row['Arc or width'] ?? '';
    hitboxes[weapon] =
      shape === 'Thrust'
        ? {
            shape: 'THRUST',
            arcDegrees: 0,
            halfWidthTiles: one(size, `hitboxes ${weapon}`, `^${N} tiles either side`),
            handTiles: one(size, `hitboxes ${weapon}`, `held ${N} tiles right of the facing`),
          }
        : {
            shape: 'SWING',
            arcDegrees: one(size, `hitboxes ${weapon}`, `^${N} degrees`),
            halfWidthTiles: 0,
            handTiles: 0,
          };
  }
  return {
    death: {
      buckleTicks: one(d('collapseBuckle'), 'collapseBuckle', `^${N} ticks`),
      fallFrames: fall[0] ?? 0,
      fallFrameTicks: fall[1] ?? 0,
      soundFadeSeconds: one(fade, 'soundFade', `^${N} real seconds`),
      soundQuickSeconds: one(fade, 'soundFade', `over the first ${N} s`),
      beatSeconds: one(d('beat'), 'beat', `^${N} real seconds`),
      restoreSeconds: one(d('soundFade', 'Notes'), 'soundFade notes', `back over ${N} s`),
    },
    hitboxes,
    hitboxToleranceTiles: one(
      keyed(json, 'combatTimings', 'hitboxChecks')('hitboxTolerance'),
      'hitboxTolerance',
      `^${N} tiles`,
    ),
    guard: {
      radiusTiles: one(g('guardRadius'), 'guardRadius', `^${N} tiles`),
      resumeTiles: one(g('guardResume'), 'guardResume', `^${N} tiles`),
      homeTiles: one(g('guardHome'), 'guardHome', `^${N} tiles`),
      chaseTicks: ticks(one(g('guardChase'), 'guardChase', `^${N} real seconds`)),
      pursuitResumeTiles: one(g('pursuitResume'), 'pursuitResume', `^${N} tiles`),
      spreadTiles: one(g('cohesionSpread'), 'cohesionSpread', `^${N} tiles`),
      waitTiles: one(g('cohesionWait'), 'cohesionWait', `^${N} tiles`),
    },
    threat: {
      memoryTicks: ticks(one(t('threatMemory'), 'threatMemory', `^${N} real seconds`)),
      perDamage: one(t('threatDamage'), 'threatDamage', `^${N} points? for each point`),
      struckMe: one(t('threatStruckMe'), 'threatStruckMe', `^${N}:`),
      steerer: one(t('threatSteerer'), 'threatSteerer', `^${N}:`),
      attacking: one(t('threatAttacking'), 'threatAttacking', `^${N}:`),
      near: near[0] ?? 0,
      nearTiles: near[1] ?? 0,
      weak: one(t('threatWeak'), 'threatWeak', `^${N} x`),
      keep: one(t('threatKeep'), 'threatKeep', `^${N}:`),
      switchAt: one(t('threatSwitch'), 'threatSwitch', `^${N}:`),
    },
    runOff: {
      viewW: grab(r('runOffSight'), 'runOffSight', `\\(${N} x ${N}`)[0] ?? 0,
      viewH: grab(r('runOffSight'), 'runOffSight', `\\(${N} x ${N}`)[1] ?? 0,
      lookTiles: one(r('runOffSight'), 'runOffSight', `lookAheadAiming \\(${N} tiles\\)`),
      keepTiles: one(r('runOffKeep'), 'runOffKeep', `^${N} tiles?`),
      marginTiles: one(r('runOffMargin'), 'runOffMargin', `^${N} tiles?`),
      replanTicks: ticks(one(r('runOffReplan'), 'runOffReplan', `^${N} real seconds?`)),
    },
    pace: {
      spearPatience: one(p('spearPatience'), 'spearPatience', `^x${N}`),
      spearCooldownTicks: one(p('spearCooldown'), 'spearCooldown', `^${N} ticks`),
    },
  };
}

/**
 * Typed access to the Book 10 rows of the user's third playtest that the fight reads (decisions
 * DG-2 to DG-11, DG-25 and DG-26): "Finishing a beaten foe" and "Finishers" (section 06), the
 * allySpared row of "Cohesion and surrender", "First sight", "Teaching foes" and "At the fold"
 * (section 07), "The spared remembered" (section 17) and "Combat prompts" (section 21). Each value
 * is parsed strictly, as in combatBalance.ts: if Book 10's wording changes, loading fails with the
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

/** A keyed table's column reader: `get(key)` the Value, `get(key, 'Notes')` another column. */
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

/** The numbers a pattern captures from a value, or a clear failure. */
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

/** The weapon rows of Book 10's "Finishers": the melee weapons and bare hands. */
export type FinisherWeapon = MeleeWeaponName | 'Unarmed';
export type FinisherVariant = 'STANDING' | 'LYING';

/** One finisher's frames (Book 10 "Finishers"). */
export interface FinisherFrames {
  readonly windup: number;
  readonly active: number;
  readonly recovery: number;
  readonly hitstop: number;
  /** Tiles stepped over its active ticks. */
  readonly step: number;
  readonly shake: { readonly px: number; readonly ticks: number };
}

export interface Pt3Balance {
  /** Book 10 "Finishing a beaten foe" (decision DG-2). */
  readonly finishing: {
    /** A stagger at or below this share of vitality is a beaten stagger (a reel). */
    readonly beatenBelow: number;
    readonly reelTicks: number;
    /** To the beaten foe's near edge, in tiles. */
    readonly offerReachTiles: number;
    readonly spareReplyTicks: number;
    /** A downed foe let go gets up over this many ticks first. */
    readonly getUpTicks: number;
    readonly spareStamina: number;
  };
  /** Book 10 "Finishers" (decision DG-3), by weapon row and variant. */
  readonly finishers: Readonly<
    Record<FinisherWeapon, Readonly<Record<FinisherVariant, FinisherFrames>>>
  >;
  /** Book 10 "Cohesion and surrender", allySpared. */
  readonly allySpared: number;
  /** Book 10 "First sight" (decision DG-8). */
  readonly sight: {
    /** No friend within this many tiles: alone. Outnumbered is counted within it too. */
    readonly aloneTiles: number;
    readonly lineDelayTicks: number;
    readonly secondLineTicks: number;
    readonly pauseWarningTicks: number;
    readonly pauseTauntTicks: number;
  };
  /** Book 10 "Teaching foes" (decision DG-9). */
  readonly teaching: {
    readonly svart: { readonly vitality: number; readonly poise: number };
    readonly ketill: { readonly vitality: number; readonly poise: number };
    /** The share of Ketill's Chapter 1 attacks that are the red blow. */
    readonly redShare: number;
    /** The red blow (Book 10 redBlow): its wind-up (hold and swing) and the rest. */
    readonly red: {
      readonly windup: number;
      readonly hold: number;
      readonly swing: number;
      readonly active: number;
      readonly recovery: number;
      readonly miss: number;
      readonly step: number;
      readonly stamina: number;
    };
    /** At most one guidance line in this many ticks. */
    readonly guidanceGapTicks: number;
  };
  /** Book 10 "At the fold" (decision DG-26). */
  readonly fold: {
    readonly overhearTiles: number;
    readonly murmurTiles: number;
    readonly lineGapSeconds: number;
    readonly exchangeGapSeconds: number;
  };
  /** Book 10 section 17, "The spared remembered" (decisions DG-5 and DG-6), in percent. */
  readonly spared: {
    readonly base: { readonly favour: number; readonly ambush: number; readonly gone: number };
    readonly begged: { readonly favour: number; readonly ambush: number };
    readonly kinKilled: { readonly favour: number; readonly ambush: number };
    readonly shamed: number;
    readonly shamedTiles: number;
    readonly robbed: number;
    readonly favourRange: readonly [number, number];
    readonly ambushRange: readonly [number, number];
    readonly goneAtLeast: number;
    readonly dueDays: readonly [number, number];
    /** A Chapter 1 spare is due no sooner than this many days after the launch. */
    readonly afterLaunchDays: number;
    readonly precursorDays: number;
    /** An ambush not made within this many days of its due day is gone. */
    readonly ambushWithinDays: number;
    readonly forms: {
      readonly help: number;
      readonly warning: number;
      readonly gift: number;
      readonly standAside: number;
    };
  };
  /** Book 10 section 21, "Combat prompts" (decisions DG-7, DG-11 and DG-25). */
  readonly prompts: {
    readonly fights: number;
    readonly holdSeconds: number;
    readonly fadeSeconds: number;
    readonly againSeconds: number;
    readonly retireUses: number;
    readonly rightPx: number;
    readonly bandTop: number;
    readonly bandBottom: number;
    readonly maxLines: number;
    readonly maxChars: number;
    readonly healBelow: number;
    readonly healHoldSeconds: number;
    readonly healUntil: number;
    readonly sneakTiles: number;
    readonly sneakHoldSeconds: number;
    readonly sneakTimes: number;
    readonly sneakDoneTiles: number;
    /** Hild's dune-grass line follows her dusk aim by this (Book 8 section 05). */
    readonly sneakCueSeconds: number;
    readonly quietBackSeconds: number;
  };
}

const FINISHER_ROWS: Readonly<Record<string, FinisherWeapon>> = {
  Seax: 'Seax',
  'Hand axe': 'Hand axe',
  Spear: 'Spear',
  Sword: 'Sword',
  'Dane axe': 'Dane axe',
  'Club or hammer': 'Club or hammer',
  "Unarmed (the foe's weapon)": 'Unarmed',
};

function parseFinishers(json: unknown): Pt3Balance['finishers'] {
  const out: Partial<Record<FinisherWeapon, Partial<Record<FinisherVariant, FinisherFrames>>>> =
    {};
  for (const r of rows(json, 'combatTimings', 'finishers')) {
    const w = FINISHER_ROWS[r['Weapon'] ?? ''];
    const v = r['Variant'] === 'Standing' ? 'STANDING' : r['Variant'] === 'Lying' ? 'LYING' : null;
    const where = `finishers.${r['Weapon'] ?? '?'}.${r['Variant'] ?? '?'}`;
    if (w === undefined || v === null) throw new Error(`balance.json: ${where} is not a row`);
    const n = (col: string): number => one(r[col] ?? '', `${where}.${col}`, `^${N}$`);
    const [px, sticks] = grab(r['Shake'] ?? '', `${where}.Shake`, `^${N} px, ${N} ticks$`);
    (out[w] ??= {})[v] = {
      windup: n('Wind-up'),
      active: n('Active'),
      recovery: n('Recovery'),
      hitstop: n('Hitstop'),
      step: n('Step'),
      shake: { px: px ?? 0, ticks: sticks ?? 0 },
    };
  }
  for (const w of Object.values(FINISHER_ROWS))
    if (out[w]?.STANDING === undefined || out[w].LYING === undefined)
      throw new Error(`balance.json: finishers has no two variants for ${w}`);
  return out as Pt3Balance['finishers'];
}

export function parsePt3Balance(json: unknown): Pt3Balance {
  const fin = keyed(json, 'combatTimings', 'finishingABeatenFoe');
  const coh = keyed(json, 'enemiesWildlifeAndPerception', 'cohesionAndSurrender');
  const fs = keyed(json, 'enemiesWildlifeAndPerception', 'firstSight');
  const tf = keyed(json, 'enemiesWildlifeAndPerception', 'teachingFoes');
  const fold = keyed(json, 'enemiesWildlifeAndPerception', 'atTheFold');
  const sp = keyed(json, 'theLivingWorld', 'theSparedRemembered');
  const cp = keyed(json, 'controlsAndCamera', 'combatPrompts');
  const red = grab(
    tf('redBlow'),
    'teachingFoes.redBlow',
    `^Wind-up ${N} \\(hold ${N}, swing ${N}\\), active ${N}, recovery ${N}, miss recovery ${N}, step ${N} tiles, stamina ${N}`,
  );
  const svart = grab(tf('svartStats'), 'teachingFoes.svartStats', `vitality ${N}.*poise ${N}$`);
  const ketill = grab(tf('ketillStats'), 'teachingFoes.ketillStats', `vitality ${N}.*poise ${N}$`);
  const odds = grab(
    sp('baseOdds'),
    'theSparedRemembered.baseOdds',
    `^Favour ${N}%, ambush ${N}%, gone ${N}%$`,
  );
  const begged = grab(sp('begged'), 'theSparedRemembered.begged', `^Favour \\+${N}, ambush -${N}$`);
  const kin = grab(sp('kinKilled'), 'theSparedRemembered.kinKilled', `^Ambush \\+${N}, favour -${N}$`);
  const clamp = grab(
    sp('clamp'),
    'theSparedRemembered.clamp',
    `^Favour ${N} to ${N}%, ambush ${N} to ${N}%; gone takes the rest, never below ${N}%$`,
  );
  const due = grab(sp('due'), 'theSparedRemembered.due', `^${N} to ${N} days after the deed`);
  const forms = grab(
    sp('favourForms'),
    'theSparedRemembered.favourForms',
    `^Help in a fight ${N}%, a warning ${N}%, a gift ${N}%, standing aside ${N}%$`,
  );
  const place = grab(
    cp('promptPlace'),
    'combatPrompts.promptPlace',
    `right-aligned ${N} px in from the edge, in the band from ${N}% to ${N}%`,
  );
  const lines = grab(
    cp('promptPlace', 'Notes'),
    'combatPrompts.promptPlace (Notes)',
    `^At most ${N} prompt lines at once, each at most ${N} characters$`,
  );
  const hold = grab(
    cp('promptHold'),
    'combatPrompts.promptHold',
    `^${N} real seconds, then a promptFade \\(${N} s\\) fade$`,
  );
  return {
    finishing: {
      beatenBelow: one(fin('beatenBelow'), 'finishingABeatenFoe.beatenBelow', `^${N}% `) / 100,
      reelTicks: one(fin('reel'), 'finishingABeatenFoe.reel', `^${N} ticks`),
      offerReachTiles: one(fin('offerReach'), 'finishingABeatenFoe.offerReach', `^${N} tiles`),
      spareReplyTicks: ticks(
        one(fin('spareReply'), 'finishingABeatenFoe.spareReply', `^${N} real seconds`),
      ),
      getUpTicks: one(fin('spareLeave'), 'finishingABeatenFoe.spareLeave', `getUp's ${N} ticks`),
      spareStamina: one(fin('spareStamina'), 'finishingABeatenFoe.spareStamina', `^${N}$`),
    },
    finishers: parseFinishers(json),
    allySpared: -one(coh('allySpared'), 'cohesionAndSurrender.allySpared', `^-${N}:`),
    sight: {
      aloneTiles: one(fs('warning'), 'firstSight.warning', `no friend within ${N} tiles`),
      lineDelayTicks: ticks(one(fs('lineDelay'), 'firstSight.lineDelay', `^${N} real seconds`)),
      secondLineTicks: ticks(one(fs('who'), 'firstSight.who', `${N} real second after`)),
      pauseWarningTicks: ticks(
        one(fs('pauseWarning'), 'firstSight.pauseWarning', `^${N} real seconds`),
      ),
      pauseTauntTicks: ticks(one(fs('pauseTaunt'), 'firstSight.pauseTaunt', `^${N} real seconds`)),
    },
    teaching: {
      svart: { vitality: svart[0] ?? 0, poise: svart[1] ?? 0 },
      ketill: { vitality: ketill[0] ?? 0, poise: ketill[1] ?? 0 },
      redShare: one(tf('ketillRedShare'), 'teachingFoes.ketillRedShare', `^${N}%`) / 100,
      red: {
        windup: red[0] ?? 0,
        hold: red[1] ?? 0,
        swing: red[2] ?? 0,
        active: red[3] ?? 0,
        recovery: red[4] ?? 0,
        miss: red[5] ?? 0,
        step: red[6] ?? 0,
        stamina: red[7] ?? 0,
      },
      guidanceGapTicks: ticks(
        one(
          tf('svartGuidance', 'Notes'),
          'teachingFoes.svartGuidance (Notes)',
          `one guidance line in ${N} real seconds`,
        ),
      ),
    },
    fold: {
      overhearTiles: one(fold('overhearRange'), 'atTheFold.overhearRange', `^${N} tiles`),
      murmurTiles: one(
        fold('overhearRange', 'Notes'),
        'atTheFold.overhearRange (Notes)',
        `heard to ${N} tiles`,
      ),
      lineGapSeconds: one(fold('lineGap'), 'atTheFold.lineGap', `^${N} real seconds`),
      exchangeGapSeconds: one(fold('exchangeGap'), 'atTheFold.exchangeGap', `^${N} real seconds`),
    },
    spared: {
      base: { favour: odds[0] ?? 0, ambush: odds[1] ?? 0, gone: odds[2] ?? 0 },
      begged: { favour: begged[0] ?? 0, ambush: -(begged[1] ?? 0) },
      kinKilled: { favour: -(kin[1] ?? 0), ambush: kin[0] ?? 0 },
      shamed: one(sp('shamed'), 'theSparedRemembered.shamed', `^Ambush \\+${N}$`),
      shamedTiles: one(
        sp('shamed', 'Notes'),
        'theSparedRemembered.shamed (Notes)',
        `within ${N} tiles`,
      ),
      robbed: one(sp('robbed'), 'theSparedRemembered.robbed', `^Ambush \\+${N}$`),
      favourRange: [clamp[0] ?? 0, clamp[1] ?? 0],
      ambushRange: [clamp[2] ?? 0, clamp[3] ?? 0],
      goneAtLeast: clamp[4] ?? 0,
      dueDays: [due[0] ?? 0, due[1] ?? 0],
      afterLaunchDays: one(
        sp('due', 'Notes'),
        'theSparedRemembered.due (Notes)',
        `no sooner than ${N} days after the launch`,
      ),
      precursorDays: one(sp('precursor'), 'theSparedRemembered.precursor', `^${N} days before`),
      ambushWithinDays: one(
        sp('ambushWhere'),
        'theSparedRemembered.ambushWhere',
        `within ${N} days of it`,
      ),
      forms: {
        help: forms[0] ?? 0,
        warning: forms[1] ?? 0,
        gift: forms[2] ?? 0,
        standAside: forms[3] ?? 0,
      },
    },
    prompts: {
      fights: one(cp('promptFights'), 'combatPrompts.promptFights', `first ${N} fights`),
      holdSeconds: hold[0] ?? 0,
      fadeSeconds: hold[1] ?? 0,
      againSeconds: one(
        cp('promptHold', 'Notes'),
        'combatPrompts.promptHold (Notes)',
        `waits ${N} real seconds`,
      ),
      retireUses: one(cp('promptRetire'), 'combatPrompts.promptRetire', `done ${N} times`),
      rightPx: place[0] ?? 0,
      bandTop: (place[1] ?? 0) / 100,
      bandBottom: (place[2] ?? 0) / 100,
      maxLines: lines[0] ?? 0,
      maxChars: lines[1] ?? 0,
      healBelow:
        one(cp('healPrompt'), 'combatPrompts.healPrompt', `below ${N}% of the vitality maximum`) /
        100,
      healHoldSeconds: one(
        cp('healPromptHold'),
        'combatPrompts.healPromptHold',
        `^${N} real seconds`,
      ),
      healUntil: one(cp('healPromptUntil'), 'combatPrompts.healPromptUntil', `^${N} heals`),
      sneakTiles: one(cp('sneakHint'), 'combatPrompts.sneakHint', `within ${N} tiles`),
      sneakHoldSeconds: one(
        cp('sneakHintHold'),
        'combatPrompts.sneakHintHold',
        `^${N} real seconds`,
      ),
      sneakTimes: one(cp('sneakHintTimes'), 'combatPrompts.sneakHintTimes', `At most ${N} showings`),
      sneakDoneTiles: one(cp('sneakDone'), 'combatPrompts.sneakDone', `sneaked ${N} tiles`),
      sneakCueSeconds: one(cp('sneakCue'), 'combatPrompts.sneakCue', `^${N} real seconds after`),
      quietBackSeconds: one(cp('quiet'), 'combatPrompts.quiet', `come back ${N} real seconds after`),
    },
  };
}

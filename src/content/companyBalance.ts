/**
 * Typed access to the Book 10 section 08 rows of the user's fourth playtest's people (decisions
 * DH-40 onwards): "Own hours", "Binding a wound", "Talk among the household", "Nudges and advice"
 * and "Boat work". Each value is parsed strictly, as in pt3Balance.ts: if Book 10's wording changes,
 * loading fails with the table, key and value rather than reading a wrong number.
 */

type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SEC = 'peopleSkillsAndWounds';

function keyed(json: unknown, table: string) {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables[SEC] : undefined;
  const list = isRecord(sec) ? sec[table] : undefined;
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${SEC}.${table}`);
  return (key: string, column = 'Value'): string => {
    const value = (list as Row[]).find((r) => r['Key'] === key)?.[column];
    if (value === undefined) throw new Error(`balance.json: ${SEC}.${table} has no "${key}"`);
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

export interface CompanyBalance {
  /** Book 10 "Own hours" (DH-44 to DH-47), in game minutes. */
  readonly hours: {
    readonly earlyRiseMinutes: number;
    readonly lateFireMinutes: number;
    /** Minute of the day the watch ends (02:00 is 120). */
    readonly watchUntil: number;
    /** Residents at home for a watch to be kept. */
    readonly watchFrom: number;
    readonly watchSleepInMinutes: number;
  };
  /** Book 10 "Binding a wound" (DH-40 to DH-43). */
  readonly care: { readonly laterDays: number };
  /** Book 10 "Talk among the household" (DH-48 to DH-52), in real seconds and tiles. */
  readonly exchange: {
    readonly everySeconds: readonly [number, number];
    readonly firstSeconds: number;
    readonly nearTiles: number;
    readonly lineGapSeconds: number;
    readonly quietSeconds: number;
    readonly repeatSeconds: number;
    /** What makes an exchange particular: an event or memory, a tie, a trait, an activity. */
    readonly weights: {
      readonly event: number;
      readonly tie: number;
      readonly trait: number;
      readonly activity: number;
    };
  };
  /** Book 10 "Nudges and advice" (DH-53 to DH-58), in real seconds. */
  readonly nudge: {
    readonly firstSeconds: number;
    readonly everySeconds: number;
    readonly quietSeconds: number;
    readonly afterProgressSeconds: number;
    readonly maxPerAim: number;
    readonly adviceAims: number;
    readonly adviceTrust: number;
  };
  /** Book 10 "Boat work" (DH-59 to DH-64). */
  readonly boat: {
    readonly spotClearTiles: number;
    /** The labour shares at which the hull's drawn stage steps on (25%, 50%, 75%). */
    readonly hullSteps: readonly number[];
    readonly riggingSteps: readonly number[];
    readonly workSoundSeconds: number;
  };
}

export function parseCompanyBalance(json: unknown): CompanyBalance {
  const h = keyed(json, 'ownHours');
  const c = keyed(json, 'bindingAWound');
  const x = keyed(json, 'talkAmongTheHousehold');
  const n = keyed(json, 'nudgesAndAdvice');
  const b = keyed(json, 'boatWork');
  const every = grab(x('exchangeEvery'), 'exchangeEvery', `^${N} to ${N} real seconds`);
  const choice = grab(
    x('exchangeChoice', 'Notes'),
    'exchangeChoice',
    `An event or a memory counts ${N}, a tie ${N}, a trait ${N}, an activity ${N}`,
  );
  const watch = h('nightWatch');
  const until = grab(watch, 'nightWatch', 'until (\\d{2}):(\\d{2})');
  /** The labour shares named in a stages row, in order ("at 25%, 50% and 75%"). */
  const percents = (text: string, where: string): number[] => {
    const out = [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]) / 100);
    if (out.length === 0) throw new Error(`balance.json: ${where} names no share of labour`);
    return out;
  };
  return {
    hours: {
      earlyRiseMinutes: one(h('earlyRise'), 'earlyRise', `^${N} game minutes before`),
      lateFireMinutes: one(h('lateFire'), 'lateFire', `^${N} game minutes after`),
      watchUntil: (until[0] ?? 0) * 60 + (until[1] ?? 0),
      watchFrom: one(watch, 'nightWatch', `while ${N} or more are at home`),
      watchSleepInMinutes: one(h('watchSleepIn'), 'watchSleepIn', `^${N} game minutes`),
    },
    care: { laterDays: one(c('careLater'), 'careLater', `^${N} days?`) },
    exchange: {
      everySeconds: [every[0] ?? 0, every[1] ?? 0],
      firstSeconds: one(x('exchangeFirst'), 'exchangeFirst', `^${N} real seconds`),
      nearTiles: one(x('exchangeNear'), 'exchangeNear', `^${N} tiles`),
      lineGapSeconds: one(x('exchangeLineGap'), 'exchangeLineGap', `^${N} real seconds`),
      quietSeconds: one(x('exchangeQuiet'), 'exchangeQuiet', `^${N} real seconds`),
      repeatSeconds: one(x('exchangeRepeat'), 'exchangeRepeat', `^${N} real minutes`) * 60,
      weights: {
        event: choice[0] ?? 0,
        tie: choice[1] ?? 0,
        trait: choice[2] ?? 0,
        activity: choice[3] ?? 0,
      },
    },
    nudge: {
      firstSeconds: one(n('nudgeFirst'), 'nudgeFirst', `^${N} real seconds`),
      everySeconds: one(n('nudgeEvery'), 'nudgeEvery', `^${N} real seconds`),
      quietSeconds: one(n('nudgeQuiet'), 'nudgeQuiet', `^${N} real seconds`),
      afterProgressSeconds: one(
        n('nudgeAfterProgress'),
        'nudgeAfterProgress',
        `^${N} real seconds`,
      ),
      maxPerAim: one(n('nudgeMax'), 'nudgeMax', `^${N} an aim`),
      adviceAims: one(n('adviceAims'), 'adviceAims', `^${N}$`),
      adviceTrust: one(n('adviceTrust'), 'adviceTrust', `^Friendship ${N} or more`),
    },
    boat: {
      spotClearTiles: one(b('boatSpotClear'), 'boatSpotClear', `^${N} tiles?`),
      hullSteps: percents(b('hullStages'), 'hullStages'),
      riggingSteps: percents(b('riggingStages'), 'riggingStages'),
      workSoundSeconds: one(b('boatWorkSound'), 'boatWorkSound', `^Every ${N} real seconds`),
    },
  };
}

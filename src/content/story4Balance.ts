/**
 * Typed access to Book 10's rows for the user's fourth playtest's story and scenes (decisions
 * DH-10 to DH-39): section 25's "Story and scenes" table and the World feedback row edgeWay. Each
 * value is parsed strictly, as in pt3Balance.ts: if Book 10's wording changes, loading fails with
 * the table, key and value rather than reading a wrong number.
 */
type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keyed(json: unknown, section: string, table: string) {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables[section] : undefined;
  const list = isRecord(sec) ? sec[table] : undefined;
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${section}.${table}`);
  const rows = list as Row[];
  return (key: string): string => {
    const value = rows.find((r) => r['Key'] === key)?.['Value'];
    if (value === undefined) throw new Error(`balance.json: ${section}.${table} has no "${key}"`);
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

export interface Story4Balance {
  /** The strongbox taken in sight (DH-12 to DH-16). */
  readonly snatch: {
    readonly afterSeconds: number;
    readonly startTiles: number;
    readonly runTilesPerSecond: number;
    readonly stoopSeconds: number;
    readonly holdSeconds: number;
    readonly carryTilesPerSecond: number;
    readonly catchTiles: number;
  };
  /** The steerer's word over a body (DH-24). */
  readonly remarkReachTiles: number;
  /** Half the view, across and up and down, in tiles (DH-29). */
  readonly sightView: { readonly x: number; readonly y: number };
  /** Runa's reminder of her tool chest (DH-31). */
  readonly runaRemind: {
    readonly afterSeconds: number;
    readonly everySeconds: number;
    readonly times: number;
  };
  /** Between any two of Bran's teaching shouts in a fight, in real seconds (DH-33). */
  readonly branAdviceGapSeconds: number;
  /** The stores' second hint only this near the mast's foot, in tiles (DH-35). */
  readonly storesHintNearTiles: number;
}

/** Reads the Story and scenes table (Book 10 section 25). */
export function parseStory4Balance(json: unknown): Story4Balance {
  const sec = 'theOpeningGuidanceAndFeel';
  const get = keyed(json, sec, 'storyAndScenes');
  const at = (key: string): string => `${sec}.storyAndScenes.${key}`;
  const view = grab(
    get('sightView'),
    at('sightView'),
    `${N} tiles across and ${N} tiles up and down`,
  );
  const hold = get('snatchHold');
  return {
    snatch: {
      afterSeconds: one(get('snatchAfter'), at('snatchAfter'), `^${N} real seconds`),
      startTiles: one(get('snatchStart'), at('snatchStart'), `^${N} tiles`),
      runTilesPerSecond: one(get('snatchRun'), at('snatchRun'), `^${N} tiles a second`),
      stoopSeconds: one(get('snatchStoop'), at('snatchStoop'), `^${N} real seconds`),
      holdSeconds: one(hold, at('snatchHold'), `at most ${N} real seconds`),
      carryTilesPerSecond: one(get('snatchCarry'), at('snatchCarry'), `^${N} tiles a second`),
      catchTiles: one(get('snatchCatch'), at('snatchCatch'), `^${N} tiles`),
    },
    remarkReachTiles: one(get('remarkReach'), at('remarkReach'), `^${N} tiles`),
    sightView: { x: view[0] ?? 0, y: view[1] ?? 0 },
    runaRemind: {
      afterSeconds: one(get('runaRemindAfter'), at('runaRemindAfter'), `^${N} real seconds`),
      everySeconds: one(get('runaRemindEvery'), at('runaRemindEvery'), `^${N} real seconds`),
      times: one(get('runaRemindTimes'), at('runaRemindTimes'), `^${N}$`),
    },
    branAdviceGapSeconds: one(get('branAdviceGap'), at('branAdviceGap'), `^${N} real seconds`),
    storesHintNearTiles: one(get('storesHintNear'), at('storesHintNear'), `^${N} tiles`),
  };
}

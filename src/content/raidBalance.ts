/**
 * Typed access to Book 10 section 22's "Reasons for the first raid" (the user's request "give the
 * player a reason to make the first raid", decisions DH-130 to DH-159). Each value is parsed
 * strictly, as in story4Balance.ts: if Book 10's wording changes, loading fails with the table, key
 * and value rather than reading a wrong number.
 */
type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const N = '(-?\\d+(?:\\.\\d+)?)';

function grab(text: string, where: string, pattern: string): number[] {
  const m = new RegExp(pattern).exec(text);
  if (m === null) throw new Error(`balance.json: ${where} is "${text}"; expected /${pattern}/`);
  return m.slice(1).map(Number);
}

function one(text: string, where: string, pattern: string): number {
  return grab(text, where, pattern)[0] ?? 0;
}

function clock(text: string, where: string): [number, number] {
  const m = /^(\d\d):(\d\d) to (\d\d):(\d\d)/.exec(text);
  if (m === null) throw new Error(`balance.json: ${where} is "${text}"; expected "HH:MM to HH:MM"`);
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}

export interface RaidBalance {
  /** The ship's meal-sack among the salvage, in ration-days. */
  readonly wreckGrainRd: number;
  /** Rations a mouth eats from the grain each day, while any is left. */
  readonly grainShare: number;
  /** Grain for fewer days than this is felt as a need. */
  readonly grainEnoughDays: number;
  /** Runa's own nails, in her tool chest. */
  readonly runaNails: number;
  readonly ironEnough: number;
  readonly clothEnough: number;
  readonly saltEnough: number;
  /** Real seconds between any two of the household's need lines. */
  readonly needLineGapSeconds: number;
  readonly needLinesPerDay: number;
  readonly reportNeedLines: number;
  /** Fewer fish than this landed in a day, with someone fishing: a poor day's fishing. */
  readonly poorCatch: number;
  /** The day of the year the autumn storms begin. */
  readonly stormsAtDay: number;
  readonly stormsEveryDays: number;
  /** A clue told by this many sources reads likely. */
  readonly likelyFrom: number;
  readonly carrickSackRd: number;
  readonly carrickNails: number;
  readonly carrickNet: number;
  readonly goodsCampTiles: number;
  /** Minutes after midnight: a clear day's hours at the Hag's Seat. */
  readonly pointOutFrom: number;
  readonly pointOutUntil: number;
  readonly pointOutTiles: number;
  readonly councilReachTiles: number;
  readonly councilGatherSeconds: number;
  readonly councilHeard: number;
  readonly councilOverruled: number;
  /** Stage 16's: the raid as the council said, and against it. */
  readonly intentKept: number;
  readonly intentBrokenWord: number;
  readonly intentBrokenOthers: number;
}

export function parseRaidBalance(json: unknown): RaidBalance {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables['storyGates'] : undefined;
  const list = isRecord(sec) ? sec['reasonsForTheFirstRaid'] : undefined;
  if (!Array.isArray(list))
    throw new Error('balance.json: no table storyGates.reasonsForTheFirstRaid');
  const rows = list as Row[];
  const get = (key: string): string => {
    const value = rows.find((r) => r['Key'] === key)?.['Value'];
    if (value === undefined)
      throw new Error(`balance.json: storyGates.reasonsForTheFirstRaid has no "${key}"`);
    return value;
  };
  const at = (key: string): string => `storyGates.reasonsForTheFirstRaid.${key}`;
  const num = (key: string, pattern: string): number => one(get(key), at(key), pattern);
  const [from, until] = clock(get('pointOutHours'), at('pointOutHours'));
  const broken = grab(
    get('intentBroken'),
    at('intentBroken'),
    `^${N} friendship from the Word-minded, ${N} from the rest`,
  );
  return {
    wreckGrainRd: num('wreckGrain', `^${N} rd`),
    grainShare: num('grainShare', `^${N} rd a mouth a day`),
    grainEnoughDays: num('grainEnough', `^${N} days`),
    runaNails: num('runaNails', `^${N} nails`),
    ironEnough: num('ironEnough', `^${N} iron lot`),
    clothEnough: num('clothEnough', `^${N} cloth lot`),
    saltEnough: num('saltEnough', `^${N} salt lot`),
    needLineGapSeconds: num('needLineGap', `^${N} real seconds`),
    needLinesPerDay: num('needLinesPerDay', `^${N}$`),
    reportNeedLines: num('reportNeedLines', `^${N}$`),
    poorCatch: num('poorCatch', `^${N} fish`),
    stormsAtDay: num('stormsAt', `^Day ${N}`),
    stormsEveryDays: num('stormsEvery', `^${N} days`),
    likelyFrom: num('likelyFrom', `^${N} sources`),
    carrickSackRd: num('carrickSack', `^${N} rd`),
    carrickNails: num('carrickNails', `^${N} nails`),
    carrickNet: num('carrickNet', `^${N} net`),
    goodsCampTiles: num('goodsCamp', `^${N} tiles`),
    pointOutFrom: from,
    pointOutUntil: until,
    pointOutTiles: num('pointOutTiles', `^${N} tiles`),
    councilReachTiles: num('councilReach', `^${N} tiles`),
    councilGatherSeconds: num('councilGather', `^${N} real seconds`),
    councilHeard: num('councilHeard', `^\\+?${N} friendship`),
    councilOverruled: num('councilOverruled', `^${N} friendship`),
    intentKept: num('intentKept', `^\\+?${N} friendship`),
    intentBrokenWord: broken[0] ?? 0,
    intentBrokenOthers: broken[1] ?? 0,
  };
}

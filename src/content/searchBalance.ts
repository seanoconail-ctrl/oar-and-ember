/**
 * Book 10 section 08, "The three searches" (Stage 10, decisions S10-7 to S10-12): the numbers of
 * Chapter 1's three searches, read from content/balance.json as the books write them.
 */
type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function value(json: unknown, key: string): string {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables['peopleSkillsAndWounds'] : undefined;
  const list = isRecord(sec) ? sec['theThreeSearches'] : undefined;
  if (!Array.isArray(list))
    throw new Error('balance.json: no table peopleSkillsAndWounds.theThreeSearches');
  const v = (list as Row[]).find((r) => r['Key'] === key)?.['Value'];
  if (v === undefined) throw new Error(`balance.json: The three searches has no "${key}"`);
  return v;
}

function read(json: unknown, key: string, pattern: RegExp, expected: string): number {
  const text = value(json, key);
  const m = pattern.exec(text);
  if (m === null) throw new Error(`balance.json: ${key} is "${text}"; expected ${expected}`);
  return Number(m[1]);
}

const N = '(-?\\d+(?:\\.\\d+)?)';
const FRIENDSHIP = (who: string): RegExp => new RegExp(`^${who} ([+-]\\d+) friendship$`);

export interface SearchBalance {
  /** Oddi calls out when the steerer is this near (tiles). */
  readonly oddiCallTiles: number;
  /** Thorkel's silver in his chest (oz). */
  readonly chestSilverOz: number;
  /** Oddi's friendship when the chest is carried up first, and when the sea takes it. */
  readonly chestFirstFriendship: number;
  readonly chestLostFriendship: number;
  /** A hurt rescue walking home on their own (tiles a second). */
  readonly limpSpeed: number;
  /** How long the scavengers hold and talk with an empty-handed steerer (real seconds). */
  readonly parleySeconds: number;
  /** Bran fights any foe this near Thorkel's body (tiles). */
  readonly guardTiles: number;
  /** Runa's friendship for the Cailleach given her due, and for the rite left undone. */
  readonly offeringFriendship: number;
  readonly cliffPathFriendship: number;
}

export function parseSearchBalance(json: unknown): SearchBalance {
  return {
    oddiCallTiles: read(json, 'oddiCall', new RegExp(`^${N} tiles$`), '"N tiles"'),
    chestSilverOz: read(json, 'chestSilver', new RegExp(`^${N} oz$`), '"N oz"'),
    chestFirstFriendship: read(json, 'chestFirst', FRIENDSHIP('Oddi'), '"Oddi +N friendship"'),
    chestLostFriendship: read(json, 'chestLost', FRIENDSHIP('Oddi'), '"Oddi -N friendship"'),
    limpSpeed: read(json, 'limp', new RegExp(`^${N} tiles per second$`), '"N tiles per second"'),
    parleySeconds: read(json, 'parley', new RegExp(`^${N} real seconds$`), '"N real seconds"'),
    guardTiles: read(json, 'guard', new RegExp(`^${N} tiles$`), '"N tiles"'),
    offeringFriendship: read(json, 'offering', FRIENDSHIP('Runa'), '"Runa +N friendship"'),
    cliffPathFriendship: read(json, 'cliffPath', FRIENDSHIP('Runa'), '"Runa -N friendship"'),
  };
}

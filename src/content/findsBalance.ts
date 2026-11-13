/**
 * Book 10 section 20, "Chapter 1 finds" (the user's fourth playtest, request 24; DH-115 to DH-121):
 * what each small find gives. Parsed strictly, like balance.ts: a change of wording fails at load.
 */
import type { Season } from './balance.ts';

export type FindReward =
  | { readonly kind: 'COLLECTIBLE'; readonly count: number }
  | { readonly kind: 'FOOD'; readonly rd: number; readonly seasons: readonly Season[] }
  | { readonly kind: 'SILVER'; readonly oz: number }
  | { readonly kind: 'STORY' };

function rows(json: unknown): Record<string, string>[] {
  const tables = (json as { tables?: Record<string, Record<string, unknown>> }).tables;
  const list = tables?.['explorationDensity']?.['chapter1Finds'];
  if (!Array.isArray(list))
    throw new Error('balance.json: no table explorationDensity.chapter1Finds');
  return list as Record<string, string>[];
}

const N = '(\\d+(?:\\.\\d+)?)';
const SEASON_NAMES: Readonly<Record<string, Season>> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

/** One find's reward from its value text. */
export function parseFindReward(key: string, value: string): FindReward {
  let m = new RegExp(`^${N} collectibles?$`).exec(value);
  if (m !== null) return { kind: 'COLLECTIBLE', count: Number(m[1]) };
  m = new RegExp(`^${N} ration-days of fresh eggs in (\\w+)(?: and (\\w+))?$`).exec(value);
  if (m !== null) {
    const seasons = [m[2], m[3]]
      .filter((x): x is string => x !== undefined)
      .map((x) => {
        const s = SEASON_NAMES[x];
        if (s === undefined)
          throw new Error(`balance.json: chapter1Finds.${key}: no season "${x}"`);
        return s;
      });
    return { kind: 'FOOD', rd: Number(m[1]), seasons };
  }
  m = new RegExp(`^${N} oz of silver$`).exec(value);
  if (m !== null) return { kind: 'SILVER', oz: Number(m[1]) };
  if (value === 'Nothing but its story') return { kind: 'STORY' };
  throw new Error(
    `balance.json: chapter1Finds.${key} is "${value}"; expected "N collectible", "N ration-days of fresh eggs in <season> and <season>", "N oz of silver" or "Nothing but its story"`,
  );
}

/** Every find's reward, by its key in the table. */
export function parseFindsBalance(json: unknown): ReadonlyMap<string, FindReward> {
  const out = new Map<string, FindReward>();
  for (const r of rows(json)) {
    const key = r['Key'] ?? '';
    out.set(key, parseFindReward(key, r['Value'] ?? ''));
  }
  return out;
}

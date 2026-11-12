/**
 * Book 10 section 22, "The launch" (Stage 12; decisions S12-3 to S12-9): Chapter 1's gate. The
 * boat is run down its skids by the household and floats off only where the water at its keel is
 * deep enough; the readiness screen looks ahead for that water. Read from content/balance.json as
 * Book 10 writes it; a value that does not read as expected is an error.
 */
import { DEPTH_BANDS } from './balance.ts';
import type { DepthBand } from './balance.ts';

type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keyed(json: unknown, key: string): string {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables['storyGates'] : undefined;
  const list = isRecord(sec) ? sec['theLaunch'] : undefined;
  if (!Array.isArray(list)) throw new Error('balance.json: no table storyGates.theLaunch');
  const v = (list as Row[]).find((r) => r['Key'] === key)?.['Value'];
  if (v === undefined) throw new Error(`balance.json: The launch has no "${key}"`);
  return v;
}

function num(text: string, unit: string, key: string): number {
  const m = new RegExp(`^(\\d+(?:\\.\\d+)?) ${unit}$`).exec(text.trim());
  if (m === null) throw new Error(`balance.json: The launch "${key}" is "${text}"`);
  return Number(m[1]);
}

/** Book 10 section 22, "The launch". */
export interface LaunchBalance {
  /** The shallowest depth band the boat floats in, at its keel from stern to stem. */
  readonly floats: DepthBand;
  /** How far down the shingle the household can run the boat on its skids, in tiles. */
  readonly skidsTiles: number;
  /** Tiles a second: the boat run down its skids. */
  readonly slideSpeed: number;
  /** Tiles a second: the boat rowed out from the strand. */
  readonly rowSpeed: number;
  /** How far it goes out before the sea map, in tiles. */
  readonly rowOutTiles: number;
  /** Game minutes the trial row takes from the day. */
  readonly trialRowMinutes: number;
  /** Game minutes the readiness screen looks ahead for water enough. */
  readonly tideLookaheadMinutes: number;
  /** Fewer days of food than this reads short. */
  readonly storesShortDays: number;
}

export function parseLaunchBalance(json: unknown): LaunchBalance {
  const floats = keyed(json, 'floats').toUpperCase();
  if (!(DEPTH_BANDS as readonly string[]).includes(floats))
    throw new Error(`balance.json: The launch "floats" is "${floats}"`);
  return {
    floats: floats as DepthBand,
    skidsTiles: num(keyed(json, 'skids'), 'tiles', 'skids'),
    slideSpeed: num(keyed(json, 'slideSpeed'), 'tiles a second', 'slideSpeed'),
    rowSpeed: num(keyed(json, 'rowSpeed'), 'tiles a second', 'rowSpeed'),
    rowOutTiles: num(keyed(json, 'rowOut'), 'tiles', 'rowOut'),
    trialRowMinutes: num(keyed(json, 'trialRow'), 'game minutes', 'trialRow'),
    tideLookaheadMinutes: num(keyed(json, 'tideLookahead'), 'game hours', 'tideLookahead') * 60,
    storesShortDays: num(keyed(json, 'storesShort'), 'days', 'storesShort'),
  };
}

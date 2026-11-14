/**
 * Book 10 section 02, "The wreck with survivors" (Stage 13, work package C; decisions S13-40 to
 * S13-59): the numbers of the wreck on Sgeir Dhubh (Book 6 section 19). Read from
 * content/balance.json as Book 10 writes it; a value that does not read as expected is an error,
 * so a changed wording never reads as a wrong number.
 */

type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rows(json: unknown): Row[] {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables['timeAndTravel'] : undefined;
  const list = isRecord(sec) ? sec['theWreckWithSurvivors'] : undefined;
  if (!Array.isArray(list))
    throw new Error('balance.json: no table timeAndTravel.theWreckWithSurvivors');
  return list as Row[];
}

export interface WreckBalance {
  /** Survivors on the reef (Book 5 section 02). */
  readonly survivors: number;
  /** Cargo slots a survivor beyond the free berths takes (Book 6 section 01). */
  readonly passengerSlots: number;
  /** Ration-days the cask of herring adds to the ship's stores. */
  readonly caskStoresRd: number;
  /** Lots of bar iron from the wreck. */
  readonly ironLots: number;
  /** Survivors left on the reef live if the next day's wind is below this strength. */
  readonly leftTakenOffBelow: number;
  /** Days until the survivors' word reaches Ardcarn. */
  readonly wordDays: number;
  /** How near the boat's side the steerer stands for Hild's question, in tiles. */
  readonly boardReachTiles: number;
  /** How near a survivor the steerer stands to speak with them, in tiles. */
  readonly talkReachTiles: number;
  /** How near the steerer comes before a standing survivor turns to look, in tiles (S13-82). */
  readonly lookTiles: number;
}

export function parseWreckBalance(json: unknown): WreckBalance {
  const list = rows(json);
  const n = (key: string): number => {
    const v = list.find((r) => r['Key'] === key)?.['Value'];
    if (v === undefined) throw new Error(`balance.json: theWreckWithSurvivors has no "${key}"`);
    if (!/^-?\d+(\.\d+)?$/.test(v.trim()))
      throw new Error(`balance.json: theWreckWithSurvivors.${key} is "${v}"; expected a number`);
    return Number(v);
  };
  return {
    survivors: n('survivors'),
    passengerSlots: n('passengerSlots'),
    caskStoresRd: n('caskStoresRd'),
    ironLots: n('ironLots'),
    leftTakenOffBelow: n('leftTakenOffBelow'),
    wordDays: n('wordDays'),
    boardReachTiles: n('boardReachTiles'),
    talkReachTiles: n('talkReachTiles'),
    lookTiles: n('lookTiles'),
  };
}

/** Whether balance.json has the wreck's table (tests may give a trimmed balance). */
export function hasWreckBalance(json: unknown): boolean {
  try {
    rows(json);
    return true;
  } catch {
    return false;
  }
}

/**
 * Book 10 section 02's sea numbers (Stage 13, decisions S13-1 to S13-7): sea travel, ship stores,
 * the routes, the weather, storms and calm windows, the encounter governor, exposure factors and
 * the encounter tables' weights; and from section 05 the wear and storm damage at sea. Read from
 * content/balance.json as Book 10 writes it; a value that does not read as expected is an error,
 * so a changed wording never reads as a wrong number.
 */
import { SEASONS } from './balance.ts';
import type { Season } from './balance.ts';

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
    const v = list.find((r) => r['Key'] === key)?.['Value'];
    if (v === undefined) throw new Error(`balance.json: ${section}.${table} has no "${key}"`);
    return v;
  };
}

function fail(where: string, value: string, expected: string): never {
  throw new Error(`balance.json: ${where} is "${value}"; expected ${expected}`);
}

function num(where: string, value: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) fail(where, value, 'a number');
  return Number(value);
}

function match(where: string, value: string, re: RegExp, expected: string): RegExpExecArray {
  const m = re.exec(value.trim());
  if (m === null) fail(where, value, expected);
  return m;
}

/** The eight points of the compass, clockwise from north (Book 10 Weather's columns). */
export const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Point8 = (typeof POINTS)[number];
export type WinterRule = 'OPEN' | 'CALM_WINDOWS' | 'CLOSED';

/** A route of Book 10's routes table. */
export interface RouteRow {
  readonly id: string;
  readonly name: string;
  readonly baseWatches: number;
  readonly exposure: 0 | 1 | 2 | 3;
  readonly winter: WinterRule;
  readonly coastal: boolean;
  readonly tideGateSlack: boolean;
}

/** Odds in percent, in the order of their table's columns. */
export type Odds = readonly number[];

export interface SeaBalance {
  /** Book 10 watchesFormula: the speed a route's base watches are given at (3). */
  readonly referenceSpeed: number;
  readonly windFactor: {
    readonly running: number;
    readonly broadReach: number;
    readonly beam: number;
    readonly closeHauled: number;
    readonly against: number;
  };
  /** The factor on deriveStats's oarSpeed (which already counts rowers present). */
  readonly rowingFactor: number;
  readonly storesPerPersonPerWatch: number;
  readonly forecastAccuracy: number;
  readonly choiceExposure: number;
  readonly risingStrength: number;
  /** Minutes after midnight that sheltering waits until. */
  readonly shelterUntil: number;
  readonly fiercerStorms: number;
  /** Game minutes either side of a tide turn that count as slack water. */
  readonly slackWindowMinutes: number;
  /** Days of stores by Book 10 hull row ("T1 Coastal boat"). */
  readonly storesDays: ReadonlyMap<string, number>;
  readonly routes: ReadonlyMap<string, RouteRow>;
  readonly weather: {
    /** By season: odds for each of POINTS. */
    readonly windFrom: Readonly<Record<Season, Odds>>;
    /** By season: odds for strength 0 to 4. */
    readonly strength: Readonly<Record<Season, Odds>>;
    /** By season: odds for CLEAR, HAZE, FOG. */
    readonly visibility: Readonly<Record<Season, Odds>>;
    readonly stormFrom: number;
    readonly firstStorm: readonly [number, number];
    readonly autumnStorms: { readonly count: readonly [number, number]; readonly days: readonly [number, number] };
    readonly washing: readonly [number, number];
    readonly calmWindowChance: number;
    readonly calmWindowDays: readonly [number, number];
    readonly calmStrengthMax: number;
  };
  readonly governor: {
    readonly eventfulShare: number;
    readonly eventfulBand: readonly [number, number];
    readonly supernaturalEvery: number;
    readonly supernaturalBand: readonly [number, number];
    /** By exposure 0 to 3. */
    readonly exposureFactor: readonly number[];
  };
  /** Table ID to entry key to weight. */
  readonly weights: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Book 10 section 05: wear per watch at sea, and stormDamage's constant. */
  readonly wearPerWatch: number;
  readonly stormDamagePerStrength: number;
}

function oddsRow(where: string, row: Row, columns: readonly string[]): number[] {
  const out = columns.map((c) => num(`${where}.${c}`, row[c] ?? ''));
  const sum = out.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 1e-9) fail(where, String(sum), 'odds summing to 100');
  return out;
}

function bySeason(
  json: unknown,
  table: string,
  columns: readonly string[],
): Record<Season, Odds> {
  const list = rows(json, 'timeAndTravel', table);
  const out = {} as Record<Season, Odds>;
  for (const season of SEASONS) {
    const row = list.find((r) => r['Season'] === season);
    if (row === undefined) throw new Error(`balance.json: ${table} has no ${season} row`);
    out[season] = oddsRow(`${table}.${season}`, row, columns);
  }
  return out;
}

const range = (where: string, text: string, re: RegExp): [number, number] => {
  const m = match(where, text, re, `"${re.source}"`);
  return [Number(m[1]), Number(m[2])];
};

export function parseSeaBalance(json: unknown): SeaBalance {
  const sea = keyed(json, 'timeAndTravel', 'seaTravel');
  const tide = keyed(json, 'timeAndTravel', 'tide');
  const storms = keyed(json, 'timeAndTravel', 'stormsAndCalmWindows');
  const enc = keyed(json, 'timeAndTravel', 'encounters');
  const ship = keyed(json, 'shipStatisticsAndCosts', 'refitsWearAndRepair');

  const ref = match(
    'seaTravel.watchesFormula',
    sea('watchesFormula'),
    /^baseWatches x (\d+(?:\.\d+)?) \/ effectiveSpeed$/,
    '"baseWatches x N / effectiveSpeed"',
  );
  const against = match('seaTravel.windFactorAgainst', sea('windFactorAgainst'), /^(\d+) \(row\)$/, '"0 (row)"');
  const rowing = match(
    'seaTravel.rowingFactor',
    sea('rowingFactor'),
    /^oarSpeed x rowersPresent \/ rowingCrew x (\d+(?:\.\d+)?)$/,
    '"oarSpeed x rowersPresent / rowingCrew x N"',
  );
  const stores = match(
    'seaTravel.storesPerPersonPerWatch',
    sea('storesPerPersonPerWatch'),
    /^(\d+(?:\.\d+)?) rd$/,
    '"N rd"',
  );
  const shelter = match('seaTravel.shelterUntil', sea('shelterUntil'), /^(\d{2}):(\d{2})$/, '"HH:MM"');
  const slack = match(
    'tide.slackWindow',
    tide('slackWindow'),
    /^(\d+) game minutes either side of a tide turn$/,
    '"N game minutes either side of a tide turn"',
  );

  const storesDays = new Map<string, number>();
  for (const r of rows(json, 'timeAndTravel', 'shipStores'))
    storesDays.set(r['Hull'] ?? '', num(`shipStores.${r['Hull']}`, r['Days of stores'] ?? ''));

  const routes = new Map<string, RouteRow>();
  for (const r of rows(json, 'timeAndTravel', 'routes')) {
    const id = r['ID'] ?? '';
    const where = `routes.${id}`;
    const exposure = num(`${where}.Exposure`, r['Exposure'] ?? '');
    if (![0, 1, 2, 3].includes(exposure)) fail(`${where}.Exposure`, String(exposure), '0 to 3');
    const winterText = r['Winter'] ?? '';
    const winter: WinterRule | undefined = (
      { Open: 'OPEN', 'Calm windows': 'CALM_WINDOWS', Closed: 'CLOSED' } as const
    )[winterText as 'Open' | 'Calm windows' | 'Closed'];
    if (winter === undefined) fail(`${where}.Winter`, winterText, 'Open, Calm windows or Closed');
    const notes = r['Notes'] ?? '';
    routes.set(id, {
      id,
      name: r['Route'] ?? '',
      baseWatches: num(`${where}.Base watches`, r['Base watches'] ?? ''),
      exposure: exposure as 0 | 1 | 2 | 3,
      winter,
      coastal: notes === 'Coastal',
      tideGateSlack: notes === 'Tide gate: slack only',
    });
  }

  const autumn = match(
    'stormsAndCalmWindows.autumnStorms',
    storms('autumnStorms'),
    /^(\d+) to (\d+) days in days (\d+) to (\d+)$/,
    '"a to b days in days c to d"',
  );

  const share = match('encounters.eventfulShare', enc('eventfulShare'), /^1 in (\d+)$/, '"1 in N"');
  const every = match(
    'encounters.supernaturalEvery',
    enc('supernaturalEvery'),
    /^(\d+(?:\.\d+)?) voyages$/,
    '"N voyages"',
  );
  const exposureRows = rows(json, 'timeAndTravel', 'exposure');
  const exposureFactor = [0, 1, 2, 3].map((e) => {
    const row = exposureRows.find((r) => r['Exposure'] === String(e));
    if (row === undefined) throw new Error(`balance.json: exposure has no ${e} row`);
    return num(`exposure.${e}`, row['Encounter factor'] ?? '');
  });
  const weights = new Map<string, Map<string, number>>();
  for (const r of rows(json, 'timeAndTravel', 'encounterWeights')) {
    const table = r['Table'] ?? '';
    const entry = r['Encounter'] ?? '';
    const t = weights.get(table) ?? new Map<string, number>();
    if (t.has(entry)) fail(`encounterWeights.${table}.${entry}`, entry, 'one row per entry');
    t.set(entry, num(`encounterWeights.${table}.${entry}`, r['Weight'] ?? ''));
    weights.set(table, t);
  }

  const damage = match(
    'refitsWearAndRepair.stormDamage',
    ship('stormDamage'),
    /^(\d+(?:\.\d+)?) x storm strength x exposure \/ seaworthiness per watch$/,
    '"N x storm strength x exposure / seaworthiness per watch"',
  );

  return {
    referenceSpeed: Number(ref[1]),
    windFactor: {
      running: num('seaTravel.windFactorRunning', sea('windFactorRunning')),
      broadReach: num('seaTravel.windFactorBroadReach', sea('windFactorBroadReach')),
      beam: num('seaTravel.windFactorBeam', sea('windFactorBeam')),
      closeHauled: num('seaTravel.windFactorCloseHauled', sea('windFactorCloseHauled')),
      against: Number(against[1]),
    },
    rowingFactor: Number(rowing[1]),
    storesPerPersonPerWatch: Number(stores[1]),
    forecastAccuracy: num('seaTravel.forecastAccuracy', sea('forecastAccuracy')),
    choiceExposure: num('seaTravel.choiceExposure', sea('choiceExposure')),
    risingStrength: num('seaTravel.risingStrength', sea('risingStrength')),
    shelterUntil: Number(shelter[1]) * 60 + Number(shelter[2]),
    fiercerStorms: num('seaTravel.fiercerStorms', sea('fiercerStorms')),
    slackWindowMinutes: Number(slack[1]),
    storesDays,
    routes,
    weather: {
      windFrom: bySeason(json, 'weather', POINTS),
      strength: bySeason(json, 'windStrength', ['0', '1', '2', '3', '4']),
      visibility: bySeason(json, 'visibility', ['Clear', 'Haze', 'Fog']),
      stormFrom: num('stormsAndCalmWindows.stormFrom', storms('stormFrom')),
      firstStorm: range(
        'stormsAndCalmWindows.firstStorm',
        storms('firstStorm'),
        /^One day in days (\d+) to (\d+) of each year$/,
      ),
      autumnStorms: {
        count: [Number(autumn[1]), Number(autumn[2])],
        days: [Number(autumn[3]), Number(autumn[4])],
      },
      washing: range(
        'stormsAndCalmWindows.cailleachWashing',
        storms('cailleachWashing'),
        /^One day in days (\d+) to (\d+) of each year$/,
      ),
      calmWindowChance: num('stormsAndCalmWindows.calmWindowChance', storms('calmWindowChance')),
      calmWindowDays: range(
        'stormsAndCalmWindows.calmWindowDays',
        storms('calmWindowDays'),
        /^(\d+) to (\d+)$/,
      ),
      calmStrengthMax: num('stormsAndCalmWindows.calmStrengthMax', storms('calmStrengthMax')),
    },
    governor: {
      eventfulShare: 1 / Number(share[1]),
      eventfulBand: range('encounters.eventfulBand', enc('eventfulBand'), /^(\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)$/),
      supernaturalEvery: Number(every[1]),
      supernaturalBand: range(
        'encounters.supernaturalBand',
        enc('supernaturalBand'),
        /^(\d+(?:\.\d+)?) to (\d+(?:\.\d+)?) voyages$/,
      ),
      exposureFactor,
    },
    weights,
    wearPerWatch: num('refitsWearAndRepair.wearPerWatchAtSea', ship('wearPerWatchAtSea')),
    stormDamagePerStrength: Number(damage[1]),
  };
}

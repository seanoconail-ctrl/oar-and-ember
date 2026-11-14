/**
 * Stage 14's island numbers (Book 10 sections 03 and 20; decisions S14-12, S14-15, S14-16, S14-19
 * and S14-26), parsed strictly from content/balance.json as balance.ts does: a change of wording in
 * the book fails at load, so no number is ever guessed in code.
 *
 * - "Island resource nodes" (section 03): each node's seasons or day window, tide, respawn, yield,
 *   minutes and stamina, and how many of it lie in each scene.
 * - "Stopping points", "Skarvholm collectibles", "Grey Men alignment", "Deep passage", "Skerry of
 *   the Drowned" and "Year 1 secrets" (section 20).
 */
import { SEASONS } from './balance.ts';
import type { Season } from './balance.ts';

type Row = Record<string, string>;

function table(json: unknown, section: string, name: string): Row[] {
  const tables = (json as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  const list = tables?.[section]?.[name];
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${section}.${name}`);
  return list as Row[];
}

function keyed(json: unknown, section: string, name: string): (key: string) => string {
  const list = table(json, section, name);
  return (key) => {
    const v = list.find((r) => r['Key'] === key)?.['Value'];
    if (v === undefined) throw new Error(`balance.json: ${section}.${name} has no "${key}"`);
    return v;
  };
}

function fail(where: string, value: string, expected: string): never {
  throw new Error(`balance.json: ${where} is "${value}"; expected ${expected}`);
}

function match(where: string, value: string, re: RegExp, expected: string): RegExpExecArray {
  const m = re.exec(value);
  if (m === null) fail(where, value, expected);
  return m;
}

const SEASON_WORDS: Readonly<Record<string, Season>> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

function seasonWord(where: string, w: string): Season {
  const s = SEASON_WORDS[w.trim().toLowerCase()];
  if (s === undefined) fail(where, w, 'a season');
  return s;
}

// --------------------------------------------------------------------------- resource nodes

export const NODE_KINDS = [
  'watercress',
  'heather',
  'hares',
  'bogCotton',
  'kelp',
  'seals',
  'eggs',
  'peat',
  'rockFish',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** What one gathering gives (Book 10 "Island resource nodes", Yield). */
export interface NodeYield {
  /** Fresh food into the home's fresh stores, in ration-days, and how many days it keeps. */
  readonly freshRd: number;
  readonly keepsDays: number;
  /** Stores (RES_ id to amount): bundles, loads, hides. */
  readonly stores: Readonly<Record<string, number>>;
}

export interface NodeBalance {
  readonly kind: NodeKind;
  readonly scenes: readonly string[];
  /** The seasons it exists in (all four for a day window: `days` decides). */
  readonly seasons: readonly Season[];
  /** A window of days of the year instead of whole seasons (the eggs, the seals' pups). */
  readonly days?: readonly [number, number];
  /** Winter on calm days only (the fishing rocks). */
  readonly winterCalmOnly: boolean;
  readonly tide: 'ANY' | 'LOW';
  /** Days until it comes again once taken (0: only the season's limit holds it back). */
  readonly respawnDays: number;
  /** It comes again at the dawn after a storm too (the kelp). */
  readonly afterStorm: boolean;
  /** At most this many taken in a season (the seals, a peat bank's loads); null: no limit. */
  readonly perSeason: number | null;
  /** The season a cut-back node is reset in (a peat bank: the next spring). */
  readonly resetSeason: Season | null;
  /** A rock's catches a day by season (the fishing rocks: "Fishing from shore"). */
  readonly perDay: Readonly<Record<Season, number>> | null;
  readonly yield: NodeYield;
  /** Game minutes and stamina one gathering costs. */
  readonly minutes: number;
  readonly stamina: number;
  /** What it is taken with (ITEM_ ids, any one), if anything. */
  readonly tools: readonly string[];
  /** How many lie in all (from the notes: "2 beds at the Kelda, 3 in the upper stream"). */
  readonly count: number;
  /** How many lie in each scene, where the notes say (scenes with no count are absent). */
  readonly perScene: Readonly<Record<string, number>>;
}

/** The days of the year a "Days a to b" window covers. */
function dayWindow(where: string, v: string): [number, number] {
  const m = match(where, v, /^Days (\d+) to (\d+)/, '"Days a to b"');
  return [Number(m[1]), Number(m[2])];
}

function parseSeasons(
  where: string,
  v: string,
): { seasons: Season[]; days?: [number, number]; winterCalmOnly: boolean } {
  if (v.startsWith('Days ')) return { seasons: [...SEASONS], days: dayWindow(where, v), winterCalmOnly: false };
  const calm = / \(winter on calm days only\)$/.test(v);
  const list = v.replace(/ \(.*\)$/, '');
  const seasons = list.split(',').map((w) => seasonWord(where, w));
  return { seasons, winterCalmOnly: calm };
}

const RES_BY_WORD: Readonly<Record<string, string>> = {
  'bundle of heather': 'RES_HEATHER',
  'bundle of bog cotton': 'RES_BOG_COTTON',
  'load of kelp': 'RES_KELP',
  'load of wet peat': 'RES_PEAT_WET',
  hide: 'RES_HIDE',
};

function parseYield(where: string, v: string, eggsKeep: number, fishKeep: number, fishRd: number): NodeYield {
  let m = /^(\d+(?:\.\d+)?) rd of fresh (?:greens|meat), keeping (\d+) days$/.exec(v);
  if (m !== null) return { freshRd: Number(m[1]), keepsDays: Number(m[2]), stores: {} };
  m = /^(\d+(?:\.\d+)?) rd of fresh meat and (\d+) hide$/.exec(v);
  // The seals' meat keeps as fresh meat does (the hares' 2 days, the only fresh meat in the table).
  if (m !== null) return { freshRd: Number(m[1]), keepsDays: fishKeep, stores: { RES_HIDE: Number(m[2]) } };
  m = /^Eggs, (\d+(?:\.\d+)?) rd a climb \(Food items\)$/.exec(v);
  if (m !== null) return { freshRd: Number(m[1]), keepsDays: eggsKeep, stores: {} };
  m = /^(\d+) fresh fish a catch \(Food items\)$/.exec(v);
  if (m !== null) return { freshRd: Number(m[1]) * fishRd, keepsDays: fishKeep, stores: {} };
  m = /^(\d+(?:\.\d+)?) (bundle of heather|bundle of bog cotton|load of kelp|load of wet peat)\b/.exec(v);
  if (m !== null) {
    const res = RES_BY_WORD[m[2] ?? ''];
    if (res !== undefined) return { freshRd: 0, keepsDays: 0, stores: { [res]: Number(m[1]) } };
  }
  return fail(where, v, 'a yield Book 10 writes ("N rd of fresh greens, keeping N days", "N bundle of ...", ...)');
}

/** Book 10 "Driftwood finds" pickUp: the plain gathering a node with no minutes of its own takes. */
function pickUp(json: unknown): { minutes: number; stamina: number } {
  const v = keyed(json, 'foodFuelAndSeasons', 'driftwoodFinds')('pickUp');
  const m = match('driftwoodFinds.pickUp', v, /^(\d+) game minutes and (\d+) stamina/, '"N game minutes and N stamina"');
  return { minutes: Number(m[1]), stamina: Number(m[2]) };
}

function foodKeeps(json: unknown, item: string): number {
  const row = table(json, 'foodFuelAndSeasons', 'foodItems').find((r) => r['Item'] === item);
  const v = row?.['Keeps'] ?? '';
  const m = match(`foodItems.${item}.Keeps`, v, /^(\d+) days$/, '"N days"');
  return Number(m[1]);
}

function fishRd(json: unknown): number {
  const row = table(json, 'foodFuelAndSeasons', 'foodItems').find((r) => r['Item'] === 'Fresh fish');
  const v = row?.['Food value'] ?? '';
  return Number(match('foodItems.Fresh fish', v, /^(\d+(?:\.\d+)?) rd per fish$/, '"N rd per fish"')[1]);
}

function shoreCatch(json: unknown): Record<Season, number> {
  const row = table(json, 'foodFuelAndSeasons', 'gatheringAndFishing').find(
    (r) => r['Source'] === 'Fishing from shore',
  );
  const out = {} as Record<Season, number>;
  for (const s of SEASONS) {
    const v = row?.[s] ?? '';
    out[s] = Number(match(`gatheringAndFishing.Fishing from shore.${s}`, v, /^(\d+)/, 'a number')[1]);
  }
  return out;
}

/** Peat's cut: Book 10 "Fuel and hay" peatCut, quoted in the node's yield as minutes and stamina. */
function minutesAndStamina(text: string): { minutes: number; stamina: number } | null {
  const m = /(\d+) game minutes(?:,| and) (?:no stamina|(\d+) stamina)/.exec(text);
  if (m === null) return null;
  return { minutes: Number(m[1]), stamina: m[2] === undefined ? 0 : Number(m[2]) };
}

/** "2 beds at the Kelda, 3 in the upper stream": a count with its noun, then counts that share it. */
const COUNT_RE = /(\d+) (?:beds?|patches|forms|stands|ledges|banks|rocks)\b|, (\d+) (?:in|on|under|at)\b/g;

export function parseNodeBalance(json: unknown): ReadonlyMap<NodeKind, NodeBalance> {
  const rows = table(json, 'foodFuelAndSeasons', 'islandResourceNodes');
  const plain = pickUp(json);
  const eggsKeep = foodKeeps(json, 'Eggs');
  const fishKeep = foodKeeps(json, 'Fresh fish');
  const rd = fishRd(json);
  const out = new Map<NodeKind, NodeBalance>();
  for (const r of rows) {
    const kind = r['Node'] as NodeKind;
    if (!NODE_KINDS.includes(kind)) fail('islandResourceNodes.Node', r['Node'] ?? '', 'a known node');
    const where = `islandResourceNodes.${kind}`;
    const scenes = (r['Scenes'] ?? '')
      .split(',')
      .map((s) => s.trim().split(' ')[0] ?? '')
      .filter((s) => s.startsWith('ZONE_'));
    if (scenes.length === 0) fail(`${where}.Scenes`, r['Scenes'] ?? '', 'ZONE_ ids');
    const { seasons, days, winterCalmOnly } = parseSeasons(`${where}.Seasons`, r['Seasons'] ?? '');
    const tideText = r['Tide'] ?? '';
    const tide = tideText === 'Any' ? 'ANY' : tideText === 'Low water' ? 'LOW' : fail(`${where}.Tide`, tideText, '"Any" or "Low water"');
    const respawn = r['Respawn'] ?? '';
    let respawnDays = 0;
    let afterStorm = false;
    let perSeason: number | null = null;
    let resetSeason: Season | null = null;
    let perDay: Record<Season, number> | null = null;
    let m = /^(\d+) days(?: a ledge)?(, and again at the dawn after a storm)?/.exec(respawn);
    if (m !== null) {
      respawnDays = Number(m[1]);
      afterStorm = m[2] !== undefined;
    } else if ((m = /^Once a year: at most (\d+) taken in a season$/.exec(respawn)) !== null) {
      perSeason = Number(m[1]);
      respawnDays = 0;
    } else if (
      (m = /^A bank gives (\d+) loads a season, then is cut back until the next (\w+)$/.exec(respawn)) !== null
    ) {
      perSeason = Number(m[1]);
      resetSeason = seasonWord(`${where}.Respawn`, m[2] ?? '');
    } else if (/^A rock gives the season's "Fishing from shore" catch a day$/.test(respawn)) {
      perDay = shoreCatch(json);
    } else fail(`${where}.Respawn`, respawn, 'a respawn Book 10 writes');
    const notes = r['Notes'] ?? '';
    const yieldText = r['Yield'] ?? '';
    const cost = minutesAndStamina(notes) ?? minutesAndStamina(yieldText) ?? plain;
    const tools: string[] = [];
    if (/taken with the bow/.test(notes)) tools.push('ITEM_BOW');
    if (/Taken with a spear or an axe/.test(notes)) tools.push('ITEM_SPEAR', 'ITEM_AXE', 'ITEM_DANE_AXE');
    if (/needs a peat spade/.test(notes)) tools.push('ITEM_SPADE');
    if (/shore-fishing timed task/.test(notes)) tools.push('ITEM_LINE');
    const counts = [...notes.matchAll(COUNT_RE)].map((c) => Number(c[1] ?? c[2]));
    // The seals have one place: the haul-out in the cove.
    if (counts.length === 0 && /at the haul-out/.test(notes)) counts.push(1);
    if (counts.length === 0) fail(`${where}.Notes`, notes, 'how many lie ("N beds", "N ledges", ...)');
    const count = counts.reduce((a, b) => a + b, 0);
    // By scene where the notes give one count for each of its scenes, in their order.
    const perScene: Record<string, number> = {};
    if (counts.length === scenes.length) scenes.forEach((z, i) => (perScene[z] = counts[i] ?? 0));
    else if (scenes.length === 1 && scenes[0] !== undefined) perScene[scenes[0]] = count;
    out.set(kind, {
      kind,
      scenes,
      seasons,
      ...(days === undefined ? {} : { days }),
      winterCalmOnly,
      tide,
      respawnDays,
      afterStorm,
      perSeason,
      resetSeason,
      perDay,
      yield: parseYield(`${where}.Yield`, yieldText, eggsKeep, fishKeep, rd),
      minutes: cost.minutes,
      stamina: cost.stamina,
      tools,
      count,
      perScene,
    });
  }
  for (const k of NODE_KINDS) if (!out.has(k)) throw new Error(`balance.json: islandResourceNodes has no ${k}`);
  return out;
}

// --------------------------------------------------------------------------- exploration density

export interface DensityBalance {
  /** A stop counts once on screen and within this many tiles of the walker. */
  readonly stopWithin: number;
  /** The walker's gap between stops, in tiles along the path. */
  readonly intervalTiles: readonly [number, number];
}

export function parseDensityBalance(json: unknown): DensityBalance {
  const k = keyed(json, 'explorationDensity', 'stoppingPoints');
  const within = match('stoppingPoints.stopWithin', k('stopWithin'), /^(\d+) tiles$/, '"N tiles"');
  const gap = match('stoppingPoints.stopIntervalWalk', k('stopIntervalWalk'), /^(\d+) to (\d+) tiles$/, '"a to b tiles"');
  return { stopWithin: Number(within[1]), intervalTiles: [Number(gap[1]), Number(gap[2])] };
}

export interface CollectibleCounts {
  readonly shells: number;
  readonly carvedStones: number;
  readonly psalterPages: number;
  readonly namesOfTheDead: number;
  readonly songs: number;
  readonly lore: number;
  readonly offPathTiles: number;
}

export function parseCollectibleCounts(json: unknown): CollectibleCounts {
  const rows = table(json, 'explorationDensity', 'skarvholmCollectibles');
  const get = (k: string): string => {
    const v = rows.find((r) => r['Kind'] === k)?.['On Skarvholm'];
    if (v === undefined) throw new Error(`balance.json: skarvholmCollectibles has no ${k}`);
    return v;
  };
  const n = (k: string): number => Number(match(`skarvholmCollectibles.${k}`, get(k), /^(?:Up to )?(\d+)$/, '"N" or "Up to N"')[1]);
  return {
    shells: n('shells'),
    carvedStones: n('carvedStones'),
    psalterPages: n('psalterPages'),
    namesOfTheDead: n('namesOfTheDead'),
    songs: n('songs'),
    lore: n('lore'),
    offPathTiles: Number(match('skarvholmCollectibles.offPath', get('offPath'), /^(\d+) tiles$/, '"N tiles"')[1]),
  };
}

export interface AlignmentBalance {
  /** Game minutes from first light. */
  readonly windowMinutes: number;
  /** Year 1's festival mornings, days of the year. */
  readonly mornings: readonly number[];
  readonly doorWaitTiles: number;
  /** Fog hides the sun. */
  readonly fogHides: boolean;
}

export function parseAlignmentBalance(json: unknown): AlignmentBalance {
  const k = keyed(json, 'explorationDensity', 'greyMenAlignment');
  const w = match('greyMenAlignment.alignmentWindow', k('alignmentWindow'), /^(\d+) game minutes from first light$/, '"N game minutes from first light"');
  const days = match('greyMenAlignment.festivalMornings', k('festivalMornings'), /^Days ([\d, ]+) and (\d+) in Year 1$/, '"Days a, b, c and d in Year 1"');
  const d = match('greyMenAlignment.doorWaitTiles', k('doorWaitTiles'), /^(\d+) tiles$/, '"N tiles"');
  const fog = k('alignmentFog');
  if (!/^Fog hides the sun/.test(fog)) fail('greyMenAlignment.alignmentFog', fog, '"Fog hides the sun: ..."');
  return {
    windowMinutes: Number(w[1]),
    mornings: [...(days[1] ?? '').split(',').map((x) => Number(x.trim())), Number(days[2])],
    doorWaitTiles: Number(d[1]),
    fogHides: true,
  };
}

export interface DeepPassageBalance {
  /** Minutes after the window's close the knee pool is waist deep, then deep. */
  readonly poolWaistAfter: number;
  readonly poolDeepAfter: number;
  /** Minutes after the window's close the banks and floor close. */
  readonly floorClosesAfter: number;
}

export function parseDeepPassageBalance(json: unknown): DeepPassageBalance {
  const k = keyed(json, 'explorationDensity', 'deepPassage');
  if (k('passageOpen') !== 'Spring-tide days only, inside tidalGroundWindow')
    fail('deepPassage.passageOpen', k('passageOpen'), '"Spring-tide days only, inside tidalGroundWindow"');
  if (k('lowestPointCloses') !== "At the window's close")
    fail('deepPassage.lowestPointCloses', k('lowestPointCloses'), `"At the window's close"`);
  const pool = match('deepPassage.poolRises', k('poolRises'), /^Waist at (\d+) game minutes after the window's close, deep at (\d+)$/, '"Waist at N game minutes after the window\'s close, deep at N"');
  const floor = match('deepPassage.floorCloses', k('floorCloses'), /^(\d+) game minutes after the window's close$/, '"N game minutes after the window\'s close"');
  return { poolWaistAfter: Number(pool[1]), poolDeepAfter: Number(pool[2]), floorClosesAfter: Number(floor[1]) };
}

export interface SkerryBalance {
  readonly namesPerSpring: number;
}

export function parseSkerryBalance(json: unknown): SkerryBalance {
  const k = keyed(json, 'explorationDensity', 'skerryOfTheDrowned');
  if (k('causewayOpen') !== 'Spring-tide days only, inside tidalGroundWindow')
    fail('skerryOfTheDrowned.causewayOpen', k('causewayOpen'), '"Spring-tide days only, inside tidalGroundWindow"');
  return { namesPerSpring: Number(match('skerryOfTheDrowned.namesPerSpring', k('namesPerSpring'), /^(\d+)$/, 'a number')[1]) };
}

export interface SecretsBalance {
  /** The bog offering shows in this season once this many loads are cut from its bank. */
  readonly offeringSeason: Season;
  readonly offeringLoads: number;
  /** Taken: worth this much silver in trade. */
  readonly cauldronSilver: number;
  /** Behind the falls and the old naust each give a carved stone. */
  readonly fallsGive: 'CARVED_STONE';
  readonly naustGives: 'CARVED_STONE';
}

export function parseSecretsBalance(json: unknown): SecretsBalance {
  const k = keyed(json, 'explorationDensity', 'year1Secrets');
  const shows = match('year1Secrets.bogOfferingShows', k('bogOfferingShows'), /^(\w+), once (\d+) loads of peat are cut from the bank at \(33, 13\)$/, '"<Season>, once N loads of peat are cut from the bank at (33, 13)"');
  if (k('bogOfferingLeft') !== 'Nothing but its story') fail('year1Secrets.bogOfferingLeft', k('bogOfferingLeft'), '"Nothing but its story"');
  const taken = match('year1Secrets.bogOfferingTaken', k('bogOfferingTaken'), /^A bronze cauldron, worth (\d+) oz of silver in trade$/, '"A bronze cauldron, worth N oz of silver in trade"');
  for (const key of ['behindTheFalls', 'oldNaust'])
    if (k(key) !== 'A carved stone') fail(`year1Secrets.${key}`, k(key), '"A carved stone"');
  return {
    offeringSeason: seasonWord('year1Secrets.bogOfferingShows', shows[1] ?? ''),
    offeringLoads: Number(shows[2]),
    cauldronSilver: Number(taken[1]),
    fallsGive: 'CARVED_STONE',
    naustGives: 'CARVED_STONE',
  };
}

export interface IslandBalance {
  readonly nodes: ReadonlyMap<NodeKind, NodeBalance>;
  readonly density: DensityBalance;
  readonly counts: CollectibleCounts;
  readonly alignment: AlignmentBalance;
  readonly passage: DeepPassageBalance;
  readonly skerry: SkerryBalance;
  readonly secrets: SecretsBalance;
}

export function parseIslandBalance(json: unknown): IslandBalance {
  return {
    nodes: parseNodeBalance(json),
    density: parseDensityBalance(json),
    counts: parseCollectibleCounts(json),
    alignment: parseAlignmentBalance(json),
    passage: parseDeepPassageBalance(json),
    skerry: parseSkerryBalance(json),
    secrets: parseSecretsBalance(json),
  };
}

/** Whether balance.json has Stage 14's island tables (tests may give a trimmed balance). */
export function hasIslandBalance(json: unknown): boolean {
  const t = (json as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  return (
    t?.['foodFuelAndSeasons']?.['islandResourceNodes'] !== undefined &&
    t['explorationDensity']?.['year1Secrets'] !== undefined
  );
}

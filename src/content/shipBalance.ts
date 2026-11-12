/**
 * Book 10 section 05, "Ship statistics and costs" (Stage 11): the hulls, the fittings with their
 * effects and drawbacks, the refits and wear, and Chapter 1's repairs; and Book 10 section 08,
 * "Thorkel's rites". Read from content/balance.json as the books write them: a fitting's effect is
 * parsed term by term ("Cargo +2 (+1 on T1)", "Oar -1; rowing crew +1"), and a term this file does
 * not know is an error, so Book 10 stays the only source of every number.
 */
type Row = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function table(json: unknown, section: string, name: string): Row[] {
  const tables = isRecord(json) ? json['tables'] : undefined;
  const sec = isRecord(tables) ? tables[section] : undefined;
  const list = isRecord(sec) ? sec[name] : undefined;
  if (!Array.isArray(list)) throw new Error(`balance.json: no table ${section}.${name}`);
  return list as Row[];
}

function keyed(rows: readonly Row[], key: string, where: string): string {
  const v = rows.find((r) => r['Key'] === key)?.['Value'];
  if (v === undefined) throw new Error(`balance.json: ${where} has no "${key}"`);
  return v;
}

const N = '(-?\\d+(?:\\.\\d+)?)';

function num(text: string, pattern: RegExp, what: string): number {
  const m = pattern.exec(text.trim());
  if (m === null) throw new Error(`balance.json: ${what} is "${text}"`);
  return Number(m[1]);
}

export type Tier = 'T1' | 'T2' | 'T3A' | 'T3B';
export type Draft = 'SHALLOW' | 'MEDIUM' | 'DEEP';

/** Book 10's hull row (Book 2 section 08, Hull). */
export interface HullRow {
  readonly lengthTiles: number;
  readonly oars: number;
  readonly berths: number;
  readonly rowingCrew: number;
  readonly cargo: number;
  readonly draft: Draft;
  readonly sea: number;
  readonly oar: number;
  readonly sail: number;
  readonly integrity: number;
  readonly slots: number;
}

/**
 * What a fitting, refit or wear changes: additions to a statistic, in Book 10's own units. Every
 * field is optional; absent means unchanged.
 */
export interface StatMods {
  readonly cargo?: number;
  /** Book 10's "(+1 on T1)": the cargo change on a T1 hull instead. */
  readonly cargoT1?: number;
  readonly oar?: number;
  readonly sail?: number;
  readonly rowingCrew?: number;
  readonly sea?: number;
  /** Integrity, in percent of the hull's. */
  readonly integrityPercent?: number;
  readonly storesDays?: number;
  readonly boardingDefencePercent?: number;
  readonly archerRangeTiles?: number;
  /** Missile hits, in percent, with shields up. */
  readonly missileHitsPercent?: number;
  readonly intimidation?: number;
  readonly identification?: number;
  readonly grapplePercent?: number;
  readonly stormDamagePercent?: number;
  readonly towCargo?: number;
  /** Speed while towing (a drawback that applies only then). */
  readonly towingSpeed?: number;
  readonly closeHauled?: number;
  readonly wearWithoutShipwrightPercent?: number;
  readonly tradePricesPercent?: number;
  readonly forecast?: number;
  readonly healsAtSea?: boolean;
  readonly offendsLocals?: boolean;
}

export interface FittingRow {
  readonly name: string;
  readonly costOz: number;
  readonly selfBuilt: string;
  readonly effect: StatMods;
  readonly drawback: StatMods;
}

/** Wear's effect: at `at` wear, oar speed changes by `oar` (Book 10 wearLeak). */
export interface WearLeak {
  readonly at: number;
  readonly oar: number;
}

/** Chapter 1's repairs (Book 10 section 05, "Chapter 1 repairs"); labour in worker-days. */
export interface ChapterOneRepairs {
  readonly wreckedIntegrity: number;
  readonly patchedIntegrity: number;
  /** The hull patch: Carpentry, "Hull patch (Chapter 1)". */
  readonly hullBoards: number;
  readonly hullRivets: number;
  readonly hullWorkerDays: number;
  readonly cutRiggingMinutes: number;
  readonly cutRiggingStamina: number;
  readonly riggingWorkerDays: number;
  readonly shipOarWorkerDays: number;
  readonly carveOarWorkerDays: number;
  readonly fitHoldWorkerDays: number;
  readonly fitBowPlatformWorkerDays: number;
  readonly unshipMinutes: number;
  readonly unshipStamina: number;
  /** Salt fish (ration-days) the scavengers take for their steering oar. */
  readonly oarFoodRd: number;
}

/** Book 10 section 08, "Thorkel's rites". */
export interface RitesBalance {
  /** Friendship per point of Kin and of Faith, when the rites are given. */
  readonly perValuePoint: number;
  /** Bran's, for the body he kept. */
  readonly guardFriendship: number;
  /** Happiness for everyone at the rite. */
  readonly happiness: number;
  /** Friendship per point of Gain, when the gold goes into the sea. */
  readonly seaGoldPerGain: number;
  /** Game minutes to lay the ship-setting's stones, and the rite's own length. */
  readonly settingMinutes: number;
  readonly riteMinutes: number;
}

export interface ShipBalance {
  readonly hulls: ReadonlyMap<string, HullRow>;
  readonly fittings: ReadonlyMap<string, FittingRow>;
  /** Refits by key (shallowDraft, doubledStrakes): what they change. */
  readonly refits: ReadonlyMap<string, StatMods>;
  readonly wearLeak: WearLeak;
  readonly repairs: ChapterOneRepairs;
  readonly rites: RitesBalance;
}

const DRAFTS: Readonly<Record<string, Draft>> = {
  Shallow: 'SHALLOW',
  Medium: 'MEDIUM',
  Deep: 'DEEP',
};

function hullRow(r: Row): HullRow {
  const n = (col: string): number => num(r[col] ?? '', new RegExp(`^${N}$`), `${r['Hull']} ${col}`);
  const draft = DRAFTS[r['Draft'] ?? ''];
  if (draft === undefined) throw new Error(`balance.json: ${r['Hull']} Draft is "${r['Draft']}"`);
  return {
    lengthTiles: n('Length tiles'),
    oars: n('Oars'),
    berths: n('Berths'),
    rowingCrew: n('Rowing crew'),
    cargo: n('Cargo'),
    draft,
    sea: n('Sea'),
    oar: n('Oar'),
    sail: n('Sail'),
    integrity: n('Integrity'),
    slots: n('Slots'),
  };
}

/**
 * The grammar of Book 10's fitting effects and drawbacks: each term, separated by ";" or ",", is
 * one of these. A term no pattern knows is an error (the test reads every row).
 */
const TERMS: readonly {
  readonly re: RegExp;
  readonly to: (m: RegExpExecArray) => StatMods;
}[] = [
  {
    re: new RegExp(`^cargo ([+-]\\d+) \\(([+-]\\d+) on T1\\)$`),
    to: (m) => ({ cargo: Number(m[1]), cargoT1: Number(m[2]) }),
  },
  { re: /^cargo ([+-]\d+)$/, to: (m) => ({ cargo: Number(m[1]) }) },
  { re: /^oar ([+-]\d+)$/, to: (m) => ({ oar: Number(m[1]) }) },
  { re: /^sail ([+-]\d+)$/, to: (m) => ({ sail: Number(m[1]) }) },
  { re: /^sea ([+-]\d+)$/, to: (m) => ({ sea: Number(m[1]) }) },
  { re: /^rowing crew ([+-]\d+)$/, to: (m) => ({ rowingCrew: Number(m[1]) }) },
  { re: /^integrity ([+-]\d+)%$/, to: (m) => ({ integrityPercent: Number(m[1]) }) },
  { re: /^boarding defence ([+-]\d+)%$/, to: (m) => ({ boardingDefencePercent: Number(m[1]) }) },
  { re: /^archers ([+-]\d+) tiles$/, to: (m) => ({ archerRangeTiles: Number(m[1]) }) },
  {
    re: /^missile hits ([+-]\d+)% with shields up$/,
    to: (m) => ({ missileHitsPercent: Number(m[1]) }),
  },
  { re: /^intimidation ([+-]\d+)$/, to: (m) => ({ intimidation: Number(m[1]) }) },
  {
    re: new RegExp(`^identification ([+-]\\d+(?:\\.\\d+)?)$`),
    to: (m) => ({ identification: Number(m[1]) }),
  },
  { re: /^grapple contest ([+-]\d+)%$/, to: (m) => ({ grapplePercent: Number(m[1]) }) },
  { re: /^stores ([+-]\d+) days$/, to: (m) => ({ storesDays: Number(m[1]) }) },
  { re: /^light wounds heal at sea$/, to: () => ({ healsAtSea: true }) },
  {
    re: /^storm and hull damage ([+-]\d+)%$/,
    to: (m) => ({ stormDamagePercent: Number(m[1]) }),
  },
  { re: /^tow a boat for ([+-]\d+) cargo$/, to: (m) => ({ towCargo: Number(m[1]) }) },
  { re: /^speed ([+-]\d+) while towing$/, to: (m) => ({ towingSpeed: Number(m[1]) }) },
  {
    re: new RegExp(`^close-hauled factor ${N}$`),
    to: (m) => ({ closeHauled: Number(m[1]) }),
  },
  {
    re: /^wear ([+-]\d+)% without a shipwright$/,
    to: (m) => ({ wearWithoutShipwrightPercent: Number(m[1]) }),
  },
  { re: /^trade prices ([+-]\d+)%$/, to: (m) => ({ tradePricesPercent: Number(m[1]) }) },
  { re: new RegExp(`^forecast ${N}$`), to: (m) => ({ forecast: Number(m[1]) }) },
  {
    re: /^offends land-spirits and locals if not unshipped$/,
    to: () => ({ offendsLocals: true }),
  },
];

/** Parses one cell of effects ("Oar -1; rowing crew +1") into the changes it makes. */
export function parseMods(text: string, where: string): StatMods {
  const out: Record<string, number | boolean> = {};
  for (const raw of text.split(/;|,/)) {
    const term = raw.trim().toLowerCase();
    if (term === '') continue;
    let matched = false;
    for (const t of TERMS) {
      const m = t.re.exec(term);
      if (m === null) continue;
      for (const [k, v] of Object.entries(t.to(m))) {
        const prev = out[k];
        out[k] = typeof v === 'number' && typeof prev === 'number' ? prev + v : v;
      }
      matched = true;
      break;
    }
    if (!matched) throw new Error(`balance.json: ${where}: unknown effect "${raw.trim()}"`);
  }
  return out as StatMods;
}

function workerDays(text: string, what: string): number {
  return num(text, new RegExp(`^${N} worker-days?$`), what);
}

function minutesAndStamina(text: string, what: string): { minutes: number; stamina: number } {
  const m = new RegExp(`^${N} game minutes, ${N} stamina$`).exec(text.trim());
  if (m === null) throw new Error(`balance.json: ${what} is "${text}"`);
  return { minutes: Number(m[1]), stamina: Number(m[2]) };
}

export function parseShipBalance(json: unknown): ShipBalance {
  const hulls = new Map<string, HullRow>();
  for (const r of table(json, 'shipStatisticsAndCosts', 'hulls'))
    hulls.set(r['Hull'] ?? '', hullRow(r));
  const fittings = new Map<string, FittingRow>();
  for (const r of table(json, 'shipStatisticsAndCosts', 'fittings')) {
    const name = r['Fitting'] ?? '';
    fittings.set(name, {
      name,
      costOz: num(r['Cost'] ?? '', new RegExp(`^${N} oz$`), `${name} Cost`),
      selfBuilt: r['Self-built'] ?? '',
      effect: parseMods(r['Effect'] ?? '', `${name} Effect`),
      drawback: parseMods(r['Drawback'] ?? '', `${name} Drawback`),
    });
  }
  const refitRows = table(json, 'shipStatisticsAndCosts', 'refitsWearAndRepair');
  const refits = new Map<string, StatMods>();
  for (const key of ['shallowDraft', 'doubledStrakes']) {
    const text = keyed(refitRows, key, 'Refits, wear and repair');
    const effects = text.split(';').slice(1).join(';');
    refits.set(key, parseMods(effects, key));
  }
  const leak = /^At (\d+): oar ([+-]\d+)$/.exec(
    keyed(refitRows, 'wearLeak', 'Refits, wear and repair'),
  );
  if (leak === null) throw new Error('balance.json: wearLeak is not "At N: oar -N"');
  const ch1 = table(json, 'shipStatisticsAndCosts', 'chapter1Repairs');
  const v = (key: string): string => keyed(ch1, key, 'Chapter 1 repairs');
  const patch = table(json, 'buildingsToolsAndCrafting', 'carpentry').find(
    (r) => r['Product'] === 'Hull patch (Chapter 1)',
  );
  if (patch === undefined) throw new Error('balance.json: Carpentry has no "Hull patch (Chapter 1)"');
  const mats = /^(\d+) boards, (\d+) rivets$/.exec(patch['Materials'] ?? '');
  if (mats === null) throw new Error(`balance.json: Hull patch materials "${patch['Materials']}"`);
  const cut = minutesAndStamina(v('cutRigging'), 'cutRigging');
  const unship = minutesAndStamina(v('unship'), 'unship');
  const rites = table(json, 'peopleSkillsAndWounds', 'thorkelSRites');
  const r = (key: string): string => keyed(rites, key, "Thorkel's rites");
  return {
    hulls,
    fittings,
    refits,
    wearLeak: { at: Number(leak[1]), oar: Number(leak[2]) },
    repairs: {
      wreckedIntegrity: num(v('wreckedIntegrity'), new RegExp(`^${N}$`), 'wreckedIntegrity'),
      patchedIntegrity: num(v('patchedIntegrity'), new RegExp(`^${N}$`), 'patchedIntegrity'),
      hullBoards: Number(mats[1]),
      hullRivets: Number(mats[2]),
      hullWorkerDays: workerDays(patch['Labour'] ?? '', 'Hull patch (Chapter 1) Labour'),
      cutRiggingMinutes: cut.minutes,
      cutRiggingStamina: cut.stamina,
      riggingWorkerDays: workerDays(v('rigging'), 'rigging'),
      shipOarWorkerDays: workerDays(v('shipOar'), 'shipOar'),
      carveOarWorkerDays: workerDays(v('carveOar'), 'carveOar'),
      fitHoldWorkerDays: workerDays(v('fitHold'), 'fitHold'),
      fitBowPlatformWorkerDays: workerDays(v('fitBowPlatform'), 'fitBowPlatform'),
      unshipMinutes: unship.minutes,
      unshipStamina: unship.stamina,
      oarFoodRd: num(v('oarFood'), new RegExp(`^${N} rd$`), 'oarFood'),
    },
    rites: {
      perValuePoint: num(
        r('ritesValue'),
        new RegExp(`^([+-]\\d+) friendship per point$`),
        'ritesValue',
      ),
      guardFriendship: num(r('ritesGuard'), /^Bran ([+-]\d+) friendship$/, 'ritesGuard'),
      happiness: num(r('ritesHappiness'), /^([+-]\d+) happiness$/, 'ritesHappiness'),
      seaGoldPerGain: num(r('seaGold'), /^([+-]\d+) friendship per point$/, 'seaGold'),
      settingMinutes: num(r('settingStones'), new RegExp(`^${N} game hours$`), 'settingStones') * 60,
      riteMinutes: num(r('riteLength'), new RegExp(`^${N} game minutes$`), 'riteLength'),
    },
  };
}

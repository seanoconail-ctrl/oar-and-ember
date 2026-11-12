/**
 * The ship (Book 2 section 08; Book 7 sections 02 to 05; Book 10 section 05; Stage 11): the
 * household's ship as saved, and `deriveStats`, a pure function of the hull, its fittings, refits,
 * wear, the repairs it still lacks, its load and its crew. Every number comes from Book 10 through
 * `parseShipBalance`; a hull's slot layout is content (content/hulls.json).
 *
 * Chapter 1's coastal boat is found wrecked on Wreck Strand: it lacks its hull boards, its rigging
 * and its steering oar (Book 4 section 08, beat 4). Until all three are made good it cannot be
 * launched (`seaworthy` false); without rigging it has no sail, and its integrity is Book 10's
 * wreckedIntegrity until the hull is patched.
 */
import type { FittingRow, HullRow, ShipBalance, StatMods } from '../../content/shipBalance.ts';
import type { Id } from '../../core/ids.ts';

/** The three repairs of Chapter 1 (Book 4 section 08, beat 4). */
export const REPAIRS = ['HULL', 'RIGGING', 'STEERING_OAR'] as const;
export type RepairKind = (typeof REPAIRS)[number];

/**
 * A repair: what it lacks (LACKING), its materials laid by the boat and the work under way
 * (MATERIALS, `progress` in worker-minutes), or done; and how it was come by (the oar's FIGHT,
 * THEFT, TRADE, CARVED).
 */
export interface RepairState {
  stage: 'LACKING' | 'MATERIALS' | 'DONE';
  progress: number;
  how?: string;
  day?: number;
}

/** A notable event in the ship's history (Book 7 section 02, the ship's history log). */
export interface ShipLogEntry {
  readonly day: number;
  readonly kind: 'FOUND' | 'REPAIRED' | 'FITTED' | 'UNSHIPPED';
  readonly what: string;
  readonly how?: string;
}

/** What identifies the ship (Book 7 section 04): chosen at the launch (Stage 12) and after. */
export interface IdentityMarks {
  sail: string | null;
  shields: string[];
  carvings: string[];
  trophies: string[];
}

export interface CargoLot {
  readonly kind: string;
  readonly slots: number;
}

/** Book 2 section 08's ShipInstance, with Chapter 1's repairs and a fitting under way. */
export interface ShipInstance {
  readonly id: string;
  /** Named at the launch (Stage 12). */
  nameKey: string | null;
  hull: Id;
  /** Each of the hull's slots (BOW, MIDSHIP, STERN; a second MIDSHIP is MIDSHIP_2) and what is in it. */
  fittings: Record<string, Id | null>;
  refits: Id[];
  integrity: number;
  wear: number;
  marks: IdentityMarks;
  cargo: CargoLot[];
  aboard: Id[];
  history: ShipLogEntry[];
  isFlagship: boolean;
  /** Where it lies on foot: its zone and its foot (the near keel line) in tiles. */
  lies: { zone: Id; x: number; y: number };
  /** Chapter 1's repairs (version 9). */
  repairs: Record<RepairKind, RepairState>;
  /** A fitting being made: its ID, the slot it goes in and the worker-minutes done. */
  fitting: { id: Id; slot: string; progress: number } | null;
}

/** The world's key for the household's ship (not a content ID: Book 2 has no ship prefix). */
export const FLAGSHIP = 'flagship';

/** What the ship reads of content: hull and fitting definitions with their Book 10 rows. */
export interface ShipDefs {
  readonly hulls: ReadonlyMap<
    Id,
    { readonly tier: string; readonly balanceRow: string; readonly slots?: readonly string[] }
  >;
  readonly fittings: ReadonlyMap<Id, { readonly slot: string; readonly balanceRow: string }>;
  readonly balance: ShipBalance;
}

export interface ShipStats {
  readonly tier: string;
  readonly lengthTiles: number;
  readonly oars: number;
  readonly berths: number;
  readonly rowingCrew: number;
  readonly cargoSlots: number;
  readonly draft: HullRow['draft'];
  readonly seaworthiness: number;
  readonly integrityMax: number;
  readonly integrity: number;
  /** Relative speeds 0 to 5 (Book 7 section 02): oars at the crew aboard, and sail. */
  readonly oarSpeed: number;
  readonly sailSpeed: number;
  readonly closeHauled: number | null;
  readonly storesDays: number;
  readonly boardingDefencePercent: number;
  readonly archerRangeTiles: number;
  readonly missileHitsPercent: number;
  readonly intimidation: number;
  readonly identification: number;
  readonly grapplePercent: number;
  readonly stormDamagePercent: number;
  readonly towCargo: number;
  readonly towingSpeed: number;
  readonly tradePricesPercent: number;
  readonly forecast: number | null;
  readonly wearWithoutShipwrightPercent: number;
  readonly healsAtSea: boolean;
  readonly offendsLocals: boolean;
  /** Cargo slots in use, and whether that is more than it holds. */
  readonly usedCargo: number;
  readonly overloaded: boolean;
  /** Rowers aboard, at most one per oar. */
  readonly rowers: number;
  /** What it still lacks of Chapter 1's repairs; seaworthy when nothing. */
  readonly lacks: readonly RepairKind[];
  readonly seaworthy: boolean;
}

/** The load aboard: cargo lots (one slot each), livestock pens (two), and passengers. */
export interface ShipLoad {
  readonly lots: number;
  readonly pens: number;
  readonly passengers: number;
}

export const NO_LOAD: ShipLoad = { lots: 0, pens: 0, passengers: 0 };

/** The hull's slots, in order (content/hulls.json), MIDSHIP_2 for a second midship. */
export function slotsOf(defs: ShipDefs, hull: Id): string[] {
  const def = defs.hulls.get(hull);
  const seen = new Map<string, number>();
  return (def?.slots ?? []).map((s) => {
    const n = (seen.get(s) ?? 0) + 1;
    seen.set(s, n);
    return n === 1 ? s : `${s}_${n}`;
  });
}

/** The slot kind of a slot label (MIDSHIP_2 is a MIDSHIP). */
export function slotKind(label: string): string {
  return label.replace(/_\d+$/, '');
}

/** A new ship of a hull: empty slots, Book 10's integrity, nothing lacking. */
export function newShip(defs: ShipDefs, hull: Id, lies: ShipInstance['lies']): ShipInstance {
  const row = hullRowOf(defs, hull);
  return {
    id: FLAGSHIP,
    nameKey: null,
    hull,
    fittings: Object.fromEntries(slotsOf(defs, hull).map((s) => [s, null])),
    refits: [],
    integrity: row.integrity,
    wear: 0,
    marks: { sail: null, shields: [], carvings: [], trophies: [] },
    cargo: [],
    aboard: [],
    history: [],
    isFlagship: true,
    lies,
    repairs: {
      HULL: { stage: 'DONE', progress: 0 },
      RIGGING: { stage: 'DONE', progress: 0 },
      STEERING_OAR: { stage: 'DONE', progress: 0 },
    },
    fitting: null,
  };
}

/** Chapter 1's coastal boat as found on the strand: holed, unrigged, its steering oar gone. */
export function wreckedBoat(
  defs: ShipDefs,
  hull: Id,
  lies: ShipInstance['lies'],
  day: number,
): ShipInstance {
  const ship = newShip(defs, hull, lies);
  ship.integrity = defs.balance.repairs.wreckedIntegrity;
  for (const r of REPAIRS) ship.repairs[r] = { stage: 'LACKING', progress: 0 };
  ship.history.push({ day, kind: 'FOUND', what: hull });
  return ship;
}

function hullRowOf(defs: ShipDefs, hull: Id): HullRow {
  const def = defs.hulls.get(hull);
  const row = def === undefined ? undefined : defs.balance.hulls.get(def.balanceRow);
  if (def === undefined || row === undefined) throw new Error(`no Book 10 hull row for ${hull}`);
  return row;
}

function fittingRowOf(defs: ShipDefs, fitting: Id): FittingRow {
  const def = defs.fittings.get(fitting);
  const row = def === undefined ? undefined : defs.balance.fittings.get(def.balanceRow);
  if (def === undefined || row === undefined)
    throw new Error(`no Book 10 fitting row for ${fitting}`);
  return row;
}

/**
 * Whether a fitting can go on the ship now, and in which slot: its own kind of slot, free.
 * Identity fittings (a carved head, a vane) take no slot; the shield rack is free on T2 and up and
 * takes no slot on T1 either (Book 7 section 03 gives it the gunwale; decision S11-6).
 */
export function slotFor(defs: ShipDefs, ship: ShipInstance, fitting: Id): string | null {
  const def = defs.fittings.get(fitting);
  if (def === undefined) return null;
  if (Object.values(ship.fittings).includes(fitting)) return null;
  if (def.slot === 'BOW_IDENTITY' || def.slot === 'MAST_IDENTITY' || def.slot === 'GUNWALE')
    return def.slot;
  for (const label of slotsOf(defs, ship.hull))
    if (slotKind(label) === def.slot && (ship.fittings[label] ?? null) === null) return label;
  return null;
}

type Totals = Record<string, number>;

function add(t: Totals, mods: StatMods, tier: string): void {
  for (const [k, v] of Object.entries(mods)) {
    if (typeof v !== 'number') continue;
    if (k === 'cargoT1') continue;
    if (k === 'cargo' && tier === 'T1' && mods.cargoT1 !== undefined) {
      t['cargo'] = (t['cargo'] ?? 0) + mods.cargoT1;
      continue;
    }
    t[k] = (t[k] ?? 0) + v;
  }
}

function flag(mods: readonly StatMods[], key: 'healsAtSea' | 'offendsLocals'): boolean {
  return mods.some((m) => m[key] === true);
}

/**
 * The ship's statistics now (Book 2 section 08: pure). `crew` is how many aboard can row; the load
 * is what is aboard. Fittings add their effect and drawback; refits theirs; wear past Book 10's
 * wearLeak slows the oars; fewer rowers than the rowing crew slow the oars in proportion (Book 7
 * section 02); a boat with no rigging has no sail.
 */
export function deriveStats(
  ship: ShipInstance,
  defs: ShipDefs,
  crew: number,
  load: ShipLoad = NO_LOAD,
): ShipStats {
  const hullDef = defs.hulls.get(ship.hull);
  const tier = hullDef?.tier ?? 'T1';
  const row = hullRowOf(defs, ship.hull);
  const t: Totals = {};
  const mods: StatMods[] = [];
  for (const fid of Object.values(ship.fittings)) {
    if (fid === null) continue;
    const f = fittingRowOf(defs, fid);
    mods.push(f.effect, f.drawback);
  }
  for (const refit of ship.refits) {
    const r = defs.balance.refits.get(refit);
    if (r !== undefined) mods.push(r);
  }
  for (const m of mods) add(t, m, tier);
  const get = (k: string): number => t[k] ?? 0;
  if (ship.wear >= defs.balance.wearLeak.at) t['oar'] = get('oar') + defs.balance.wearLeak.oar;
  const lacks = REPAIRS.filter((r) => ship.repairs[r].stage !== 'DONE');
  const rowingCrew = Math.max(1, row.rowingCrew + get('rowingCrew'));
  const oars = row.oars;
  const rowers = Math.max(0, Math.min(crew, oars));
  const oarBase = Math.max(0, row.oar + get('oar'));
  const oarSpeed = oarBase * Math.min(1, rowers / rowingCrew);
  const sailSpeed = lacks.includes('RIGGING') ? 0 : Math.max(0, row.sail + get('sail'));
  const cargoSlots = Math.max(0, row.cargo + get('cargo'));
  const extraPassengers = Math.max(0, load.passengers - row.berths);
  const usedCargo = load.lots + 2 * load.pens + 2 * extraPassengers;
  const integrityMax = Math.round(row.integrity * (1 + get('integrityPercent') / 100));
  const closeHauled = mods.find((m) => m.closeHauled !== undefined)?.closeHauled ?? null;
  const forecast = mods.find((m) => m.forecast !== undefined)?.forecast ?? null;
  return {
    tier,
    lengthTiles: row.lengthTiles,
    oars,
    berths: row.berths,
    rowingCrew,
    cargoSlots,
    draft: row.draft,
    seaworthiness: Math.max(1, Math.min(5, row.sea + get('sea'))),
    integrityMax,
    integrity: Math.min(ship.integrity, integrityMax),
    oarSpeed,
    sailSpeed,
    closeHauled,
    storesDays: get('storesDays'),
    boardingDefencePercent: get('boardingDefencePercent'),
    archerRangeTiles: get('archerRangeTiles'),
    missileHitsPercent: get('missileHitsPercent'),
    intimidation: get('intimidation'),
    identification: get('identification'),
    grapplePercent: get('grapplePercent'),
    stormDamagePercent: get('stormDamagePercent'),
    towCargo: get('towCargo'),
    towingSpeed: get('towingSpeed'),
    tradePricesPercent: get('tradePricesPercent'),
    forecast,
    wearWithoutShipwrightPercent: get('wearWithoutShipwrightPercent'),
    healsAtSea: flag(mods, 'healsAtSea'),
    offendsLocals: flag(mods, 'offendsLocals'),
    usedCargo,
    overloaded: usedCargo > cargoSlots,
    rowers,
    lacks,
    seaworthy: lacks.length === 0,
  };
}

/** Puts a fitting in its slot (the work done): reversible with `unship`. */
export function fit(defs: ShipDefs, ship: ShipInstance, fitting: Id, day: number): boolean {
  const slot = slotFor(defs, ship, fitting);
  if (slot === null) return false;
  ship.fittings[slot] = fitting;
  ship.history.push({ day, kind: 'FITTED', what: fitting });
  return true;
}

/** Takes a fitting off: its slot is free again and the ship is as it was without it. */
export function unship(ship: ShipInstance, fitting: Id, day: number): boolean {
  const slot = Object.entries(ship.fittings).find(([, f]) => f === fitting)?.[0];
  if (slot === undefined) return false;
  if (slot === 'BOW_IDENTITY' || slot === 'MAST_IDENTITY' || slot === 'GUNWALE')
    Reflect.deleteProperty(ship.fittings, slot);
  else ship.fittings[slot] = null;
  ship.history.push({ day, kind: 'UNSHIPPED', what: fitting });
  return true;
}

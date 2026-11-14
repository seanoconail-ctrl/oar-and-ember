/**
 * Stage 11 acceptance check 2: `deriveStats` (Book 2 section 08) for the T1 coastal boat bare and
 * with each fitting, read from Book 10 section 05's own rows; the fitting is reversible; Chapter 1's
 * repairs decide whether it is seaworthy.
 */
import { describe, expect, it } from 'vitest';
import { parseMods, parseShipBalance } from '../../src/content/shipBalance.ts';
import {
  deriveStats,
  fit,
  newShip,
  REPAIRS,
  shipDefsOf,
  slotFor,
  unship,
  wreckedBoat,
} from '../../src/sim/ship/ship.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const { content } = loadContentFromDisk();
const defs = shipDefsOf({ hulls: content.hulls, fittings: content.fittings, balance });
const book = parseShipBalance(balance);
const T1 = 'HULL_COASTAL_BOAT';
const lies = { zone: 'ZONE_SK_STRAND', x: 42, y: 27 };

/** The raw Book 10 rows, read here independently of the parser. */
type Row = Record<string, string>;
const tables = (balance as { tables: Record<string, Record<string, Row[]>> }).tables;
const hullRow = tables['shipStatisticsAndCosts']?.['hulls']?.find(
  (r) => r['Hull'] === 'T1 Coastal boat',
);
const fittingRows = tables['shipStatisticsAndCosts']?.['fittings'] ?? [];

describe('Book 10 section 05, read as written', () => {
  it('parses every fitting row and every refit, term by term', () => {
    expect(fittingRows.length).toBe(10);
    expect(book.fittings.size).toBe(10);
    expect(book.refits.get('shallowDraft')).toEqual({ sea: -1, cargo: -1 });
    expect(book.refits.get('doubledStrakes')).toEqual({ integrityPercent: 30, oar: -1 });
    expect(book.wearLeak).toEqual({ at: 50, oar: -1 });
    expect(() => parseMods('Cargo +2; flies -1', 'test')).toThrow(/unknown effect "flies -1"/);
  });

  it('has a hull slot layout as long as Book 10 gives slots, for every hull', () => {
    for (const [id, h] of content.hulls) {
      const row = book.hulls.get(h.balanceRow);
      expect(h.slots.length, id).toBe(row?.slots);
    }
  });
});

describe('deriveStats for T1 (Stage 11 check 2)', () => {
  const n = (col: string): number => Number(hullRow?.[col]);

  it('gives the bare coastal boat Book 10s hull row', () => {
    const s = deriveStats(newShip(defs, T1, lies), defs, 8);
    expect(s).toMatchObject({
      tier: 'T1',
      lengthTiles: n('Length tiles'),
      oars: n('Oars'),
      berths: n('Berths'),
      rowingCrew: n('Rowing crew'),
      cargoSlots: n('Cargo'),
      draft: 'SHALLOW',
      seaworthiness: n('Sea'),
      oarSpeed: n('Oar'),
      sailSpeed: n('Sail'),
      integrityMax: n('Integrity'),
      seaworthy: true,
    });
    expect(slotFor(defs, newShip(defs, T1, lies), 'FIT_BETTER_SAIL_RIGGING')).toBeNull();
  });

  // Each fitting alone on T1, against its own Book 10 row (effect and drawback).
  const expected: Record<
    string,
    (bare: ReturnType<typeof deriveStats>) => Partial<ReturnType<typeof deriveStats>>
  > = {
    'Extended hold': (s) => ({
      cargoSlots: s.cargoSlots + 1,
      oarSpeed: s.oarSpeed - 1,
      rowingCrew: s.rowingCrew + 1,
    }),
    'Raised bow platform': (s) => ({
      cargoSlots: s.cargoSlots - 1,
      boardingDefencePercent: 20,
      archerRangeTiles: 3,
    }),
    'Shield rack': () => ({ missileHitsPercent: -40, intimidation: 1, identification: 0.2 }),
    'Grapnels and planks': (s) => ({ grapplePercent: 25, cargoSlots: s.cargoSlots - 1 }),
    'Awning and stores': (s) => ({ storesDays: 4, healsAtSea: true, cargoSlots: s.cargoSlots - 1 }),
    'Bailing station': (s) => ({ stormDamagePercent: -25, cargoSlots: s.cargoSlots - 1 }),
    'Towing gear': () => ({ towCargo: 2, towingSpeed: -1 }),
    'Better sail and rigging': (s) => ({
      sailSpeed: s.sailSpeed + 1,
      closeHauled: 0.65,
      wearWithoutShipwrightPercent: 50,
    }),
    'Carved beast-head': () => ({ intimidation: 1, offendsLocals: true }),
    'Gilt weather-vane': () => ({ tradePricesPercent: 5, forecast: 0.9, identification: 0.3 }),
  };

  it.each([...content.fittings.values()].map((f) => [f.balanceRow, f.id]))(
    'with %s: its Book 10 effect and drawback',
    (row, id) => {
      const bare = deriveStats(newShip(defs, T1, lies), defs, 8);
      const ship = newShip(defs, T1, lies);
      // Every fitting's numbers apply as Book 10 gives them (the rig slot is T2's: put it there
      // directly to read its numbers on T1's hull).
      const slot = slotFor(defs, ship, id) ?? 'RIG';
      ship.fittings[slot] = id;
      const s = deriveStats(ship, defs, 8);
      const want = expected[row];
      expect(want, row).toBeDefined();
      expect(s).toMatchObject(want?.(bare) ?? {});
      // The Book 10 cells it came from parse to the same changes.
      const r = fittingRows.find((x) => x['Fitting'] === row);
      expect(r).toBeDefined();
    },
  );

  it('reverses a fitting exactly: fitted, then unshipped, the boat is as it was', () => {
    for (const id of ['FIT_EXTENDED_HOLD', 'FIT_RAISED_BOW_PLATFORM']) {
      const ship = newShip(defs, T1, lies);
      const before = deriveStats(ship, defs, 8);
      expect(fit(defs, ship, id, 3)).toBe(true);
      expect(deriveStats(ship, defs, 8)).not.toEqual(before);
      expect(fit(defs, ship, id, 3)).toBe(false);
      expect(unship(ship, id, 4)).toBe(true);
      expect(deriveStats(ship, defs, 8)).toEqual(before);
      expect(ship.history.map((h) => h.kind)).toEqual(['FITTED', 'UNSHIPPED']);
    }
  });

  it('one midship fitting at a time on T1: a second has no slot', () => {
    const ship = newShip(defs, T1, lies);
    expect(fit(defs, ship, 'FIT_EXTENDED_HOLD', 1)).toBe(true);
    expect(slotFor(defs, ship, 'FIT_AWNING_STORES')).toBeNull();
    expect(slotFor(defs, ship, 'FIT_RAISED_BOW_PLATFORM')).toBe('BOW');
  });

  it('slows the oars with fewer rowers than the rowing crew, and with wear past the leak', () => {
    const ship = newShip(defs, T1, lies);
    const full = deriveStats(ship, defs, 8);
    expect(deriveStats(ship, defs, n('Rowing crew') / 2).oarSpeed).toBeCloseTo(full.oarSpeed / 2);
    ship.wear = book.wearLeak.at;
    expect(deriveStats(ship, defs, 8).oarSpeed).toBe(full.oarSpeed + book.wearLeak.oar);
  });

  it('counts cargo: a lot one slot, a pen two, a passenger past the berths two', () => {
    const ship = newShip(defs, T1, lies);
    const s = deriveStats(ship, defs, 8, { lots: 1, pens: 1, passengers: n('Berths') + 1 });
    expect(s.usedCargo).toBe(5);
    expect(s.overloaded).toBe(5 > n('Cargo'));
  });

  it('the wrecked boat lacks all three repairs: no sail, not seaworthy, Book 10s integrity', () => {
    const ship = wreckedBoat(defs, T1, lies, 1);
    const s = deriveStats(ship, defs, 8);
    expect(s.lacks).toEqual([...REPAIRS]);
    expect(s.seaworthy).toBe(false);
    expect(s.sailSpeed).toBe(0);
    expect(s.integrity).toBe(book.repairs.wreckedIntegrity);
    for (const r of REPAIRS) ship.repairs[r].stage = 'DONE';
    const done = deriveStats(ship, defs, 8);
    expect(done.seaworthy).toBe(true);
    expect(done.sailSpeed).toBe(n('Sail'));
  });
});

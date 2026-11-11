/**
 * Stage 3 acceptance check 2: save under 200 ms; reload reproduces the hash; the migration chain.
 * Golden saves 1 to 5 are frozen and load through it; golden save 6 (Stage 8: people with
 * happiness, friendship and fear, their day, talk and jobs) is reproduced by its scenario.
 */
import { describe, expect, it } from 'vitest';
import {
  parsePeopleBasics,
  parseStartingWeapons,
  parseTimeBalance,
} from '../../src/content/balance.ts';
import { parseWorkBalance } from '../../src/content/homeBalance.ts';
import { attachWakingAutosave, MemoryStore, SaveManager } from '../../src/persist/manager.ts';
import { fromBase64, readSave, SaveError, toBase64, writeSave } from '../../src/persist/save.ts';
import type { Migration, SaveFile } from '../../src/persist/save.ts';
import { appendDeed, appendEvidence } from '../../src/sim/ledger/ledger.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import {
  GOLDEN_01,
  GOLDEN_02,
  GOLDEN_03,
  GOLDEN_04,
  GOLDEN_05,
  GOLDEN_06,
  goldenSave06,
} from '../../src/tools/saves/golden.ts';
import { repoFile } from './books.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const basics = parsePeopleBasics(balance);
const { content } = loadContentFromDisk();
const meta = {
  build: 'test',
  kind: 'manual' as const,
  slot: 'manual-1',
  sequence: 1,
  savedAt: 'now',
};
/**
 * Migrating from schema 3 reads Book 10's starting arrows; from schema 5, the people's content
 * (content/people.json and content/household.json).
 */
const context = {
  balance,
  people: JSON.parse(repoFile('content/people.json')) as unknown,
  household: JSON.parse(repoFile('content/household.json')) as unknown,
};

function campaign(seed = 'save-test'): WorldState {
  return newCampaign(seed, b, basics, content);
}

/** A world as heavy as a late campaign: a full household, a long ledger and much evidence. */
function heavyWorld(): WorldState {
  const world = campaign('heavy');
  world.household.residents = Object.keys(world.people)
    .filter((id) => id.startsWith('C_'))
    .slice(0, 16);
  for (let i = 0; i < 2000; i++) {
    appendDeed(world, {
      id: `DEED_${i}`,
      tag: 'THEFT',
      day: 1 + (i % 270),
      placeId: 'SITE_CARRICK',
      doer: 'HOUSEHOLD',
      context: { lots: i % 5, night: i % 2 === 0 },
      victims: ['L_MUIREDACH'],
      witnesses: [{ person: 'L_MUIREDACH', escaped: i % 3 === 0 }],
      identification: (i % 10) / 10,
      marksSeen: ['sail'],
    });
    appendEvidence(world, {
      id: `EV_${i}`,
      kind: 'TRACKS',
      placeId: 'SITE_CARRICK',
      pos: { x: i % 40, y: i % 30 },
      deedIds: [`DEED_${i}`],
      points: 1,
    });
  }
  for (const person of Object.values(world.people)) {
    for (let m = 0; m < 40; m++)
      person.memories.push({ day: m, kind: 'EVENT', about: `MEMORY_${m}`, source: 'SAW' });
  }
  return world;
}

describe('save files', () => {
  it('save in under 200 ms, even for a late-campaign world', () => {
    const world = heavyWorld();
    writeSave(world, meta); // warm up
    const start = performance.now();
    const file = writeSave(world, meta);
    const text = JSON.stringify(file);
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(200);
    expect(text.length).toBeLessThan(JSON.stringify(world).length);
  });

  it('reload to the same state hash, and play on identically', () => {
    const world = campaign();
    const sim = createSimulation(b, world);
    for (let i = 0; i < 5000; i++) sim.step();
    const file = JSON.parse(JSON.stringify(writeSave(sim.state, meta))) as SaveFile;
    const { state } = readSave(file);
    expect(stateHash(state)).toBe(stateHash(sim.state));
    expect(file.header).toMatchObject({
      day: 1,
      chapter: 'CH_1_WRECK',
      seed: 'save-test',
      schemaVersion: 6,
    });
    const resumed = createSimulation(b, state);
    for (let i = 0; i < 50_000; i++) {
      sim.step();
      resumed.step();
    }
    expect(stateHash(resumed.state)).toBe(stateHash(sim.state));
  });

  it('migrate a save through the chain', () => {
    const v7: Migration = {
      from: 6,
      describe: 'test: move player.name into player.identity.name',
      up: (s) => {
        const player = s['player'] as Record<string, unknown>;
        const { name, ...rest } = player;
        return { ...s, player: { ...rest, identity: { name } } };
      },
    };
    const world = campaign();
    world.player.name = 'Ingrid';
    const { state, migratedFrom } = readSave(writeSave(world, meta), {
      migrations: [v7],
      currentVersion: 7,
    });
    expect(migratedFrom).toBe(6);
    expect(state.version).toBe(7);
    expect((state.player as unknown as { identity: { name: string } }).identity.name).toBe(
      'Ingrid',
    );
    expect('name' in state.player).toBe(false);
  });

  it('refuse a future version, a missing migration and corrupt data, with a reason', () => {
    const file = writeSave(campaign(), meta);
    const expectReason = (fn: () => unknown, reason: SaveError['reason']) => {
      try {
        fn();
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(SaveError);
        expect((error as SaveError).reason).toBe(reason);
      }
    };
    expectReason(
      () => readSave({ ...file, header: { ...file.header, schemaVersion: 9 } }),
      'FUTURE_VERSION',
    );
    expectReason(() => readSave(file, { migrations: [], currentVersion: 7 }), 'NO_MIGRATION');
    // Schema 3 to 4 needs balance.json: without it the load says so rather than guessing.
    expectReason(() => readSave(JSON.parse(repoFile(GOLDEN_03)) as SaveFile), 'NO_MIGRATION');
    expectReason(
      () => readSave({ ...file, header: { ...file.header, stateHash: '00000000000000' } }),
      'CORRUPT',
    );
    expectReason(() => readSave({ ...file, data: file.data.slice(0, 40) }), 'CORRUPT');
    expectReason(() => readSave({ hello: 1 }), 'NOT_A_SAVE');
  });

  it('round-trip base64 exactly', () => {
    for (const n of [0, 1, 2, 3, 4, 255, 1000]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37) % 256);
      expect(fromBase64(toBase64(bytes))).toEqual(bytes);
    }
  });
});

describe('save slots', () => {
  it('refuse a manual save while a hostile is aware of the player (the safe rule)', () => {
    const saves = new SaveManager(new MemoryStore(), 'test', () => 'now');
    expect(saves.manualSave(campaign(), 'manual-1', { awareHostiles: 1 })).toMatchObject({
      ok: false,
      reason: 'NOT_SAFE',
    });
    expect(saves.manualSave(campaign(), 'manual-1', { awareHostiles: 0 }).ok).toBe(true);
    expect(() => saves.manualSave(campaign(), 'autosave-1', { awareHostiles: 0 })).toThrow(
      /not a manual slot/,
    );
  });

  it('rotate three autosaves and offer the newest autosave or checkpoint', () => {
    const store = new MemoryStore();
    const saves = new SaveManager(store, 'test', () => 'now');
    const world = campaign();
    for (const reason of ['WAKING', 'DEPARTURE', 'LANDING', 'WAKING', 'WAKING'] as const)
      saves.autosave(world, reason);
    const autos = saves.headers().filter((h) => h.kind === 'autosave');
    expect(autos.map((h) => h.slot).sort()).toEqual(['autosave-1', 'autosave-2', 'autosave-3']);
    expect(autos.map((h) => h.sequence)).toEqual([3, 4, 5]);
    expect(saves.latestRestorePoint()).toMatchObject({ kind: 'autosave', sequence: 5 });
    saves.checkpoint(world, 'before-carrick');
    saves.manualSave(world, 'manual-2', { awareHostiles: 0 });
    expect(saves.latestRestorePoint()).toMatchObject({
      kind: 'checkpoint',
      label: 'before-carrick',
    });
    expect(stateHash(saves.load('checkpoint:before-carrick').state)).toBe(stateHash(world));
  });

  it('autosave on waking, before the morning report', () => {
    const store = new MemoryStore();
    const saves = new SaveManager(store, 'test', () => 'now');
    const sim = createSimulation(b, campaign());
    const order: string[] = [];
    attachWakingAutosave(sim, saves);
    sim.events.onAny((e: SimEvent) => {
      if (e.type === 'WOKE' || e.type === 'MORNING_REPORT_DUE')
        order.push(`${e.type}:${saves.headers().length}`);
    });
    while (sim.state.calendar.minuteOfDay !== 18 * 60) sim.step();
    sim.submit({ type: 'SLEEP' });
    sim.step();
    expect(order).toEqual(['WOKE:1', 'MORNING_REPORT_DUE:1']);
    expect(saves.latestRestorePoint()).toMatchObject({
      kind: 'autosave',
      reason: 'WAKING',
      day: 2,
    });
  });
});

describe('golden save 1 (schema 1, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_01)) as SaveFile;

  it('loads through the real migration chain and still holds its scenario', () => {
    expect(golden.header.schemaVersion).toBe(1);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(1);
    expect(state.version).toBe(6);
    expect(state.onFoot).toBeNull();
    expect(state.player.hotbar).toEqual({ slots: [], selected: 0 });
    expect(state.player.inventory).toEqual({});
    expect(state.player.tipsSeen).toEqual([]);
    expect(state.calendar).toEqual({ day: 3, minuteOfDay: 8 * 60 });
    // The collapse's penalty became the Exhausted reason (schema 5).
    expect(state.player.stamina.reductions).toEqual([
      expect.objectContaining({ reason: 'EXHAUSTED', amount: 30 }),
    ]);
    expect(state.player.stamina.max).toBe(state.player.stamina.base - 30);
    expect(state.report).toBeNull();
    expect(state.oneShots).toEqual({ BEAT_1_WAKE: 1 });
  });
});

describe('golden save 2 (schema 2, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_02)) as SaveFile;

  it('loads through the real migration chain and still holds the rescue', () => {
    expect(golden.header.schemaVersion).toBe(2);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(2);
    expect(state.version).toBe(6);
    expect(state.onFoot?.items).toEqual([]);
    expect(state.onFoot?.projectiles).toEqual([]);
    expect(state.onFoot?.stuck).toEqual([]);
    expect(state.player).toMatchObject({ name: 'Ash', bodyModel: 'B' });
    expect(state.player.hotbar).toEqual({ slots: [], selected: 0 });
    expect(state.onFoot?.player.aim).toBeNull();
    expect(state.household.residents).toEqual(['C_HILD']);
    expect(state.onFoot?.actors['C_HILD']?.pose).toBe('sit');
    expect(state.calendar).toEqual({ day: 3, minuteOfDay: 8 * 60 });
    expect(state.oneShots).toEqual({ BEAT_1_WAKE: 1 });
  });
});

describe('golden save 3 (schema 3, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_03)) as SaveFile;

  it('loads through the migration: the bow and seax kept, with the starting arrows', () => {
    expect(golden.header.schemaVersion).toBe(3);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(3);
    expect(state.version).toBe(6);
    expect(state.player).toMatchObject({ name: 'Ash', bodyModel: 'B' });
    expect(state.player.hotbar.slots.slice(0, 3)).toEqual(['ITEM_BOW', 'ITEM_SEAX', null]);
    expect(state.player.inventory).toEqual({
      ITEM_ARROW: parseStartingWeapons(balance).startingArrows,
    });
    expect(state.player.tipsSeen).toEqual([]);
    expect(state.onFoot).toMatchObject({ items: [], projectiles: [], nextMissile: 1, stuck: [] });
    expect(state.onFoot?.player.aim).toBeNull();
    expect(state.household.residents).toEqual(['C_HILD']);
    expect(state.onFoot?.actors['C_HILD']?.pose).toBe('sit');
    expect(state.calendar).toEqual({ day: 3, minuteOfDay: 8 * 60 });
    expect(state.oneShots).toEqual({ BEAT_1_WAKE: 1 });
  });

  it('plays on after the migration', () => {
    const { state } = readSave(golden, { context });
    const sim = createSimulation(b, state);
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.state.tick).toBe(state.tick);
  });
});

describe('golden save 4 (schema 4, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_04)) as SaveFile;

  it('loads through the migration and holds the weapons found, the arrow spent and the camp', () => {
    expect(golden.header.schemaVersion).toBe(4);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(4);
    expect(state.version).toBe(6);
    expect(state.player).toMatchObject({ name: 'Ash', bodyModel: 'B' });
    expect(state.player.hotbar.slots.slice(0, 3)).toEqual(['ITEM_SEAX', 'ITEM_BOW', null]);
    expect(state.player.inventory).toEqual({
      ITEM_ARROW: parseStartingWeapons(balance).startingArrows - 1,
    });
    expect(state.onFoot?.stuck).toHaveLength(1);
    expect(state.calendar).toEqual({ day: 3, minuteOfDay: 8 * 60 });
    expect(state.facts).toMatchObject({ 'ch1.hild_safe': true, 'ch1.bow_named': true });
    // Schema 5: the camp as a new one starts, Hild's leg wound, and nothing elsewhere.
    expect(state.homes['ISLE_SKARV']).toMatchObject({
      stage: 'S0',
      fire: { lit: false, fuel: 0 },
      stores: { RES_SALTED_FISH: parseWorkBalance(balance).wreckStoresRd },
    });
    expect(state.people['C_HILD']?.wounds).toEqual([{ day: 1, severity: 'SERIOUS', where: 'leg' }]);
    expect(state.onFoot?.elsewhere).toEqual({});
    expect(state.player.stamina.reductions).toEqual([
      expect.objectContaining({ reason: 'EXHAUSTED', amount: 30 }),
    ]);
  });

  it('plays on after the migration', () => {
    const { state } = readSave(golden, { context });
    const tick = state.tick;
    const sim = createSimulation(b, state);
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.state.tick).toBe(tick + 600);
  });
});

describe('golden save 5 (schema 5, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_05)) as SaveFile;

  it('loads through the migration: the camp kept, and its people as Stage 8 shapes them', () => {
    expect(golden.header.schemaVersion).toBe(5);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(5);
    expect(state.version).toBe(6);
    expect(state.calendar).toEqual({ day: 2, minuteOfDay: 15 * 60 });
    expect(state.homes['ISLE_SKARV']?.building?.id).toBe('BLD_SAIL_SHELTER');
    expect(state.oneShots['BEAT_1_BROCH']).toBe(1);
    const hild = state.people['C_HILD'];
    expect(hild?.wounds[0]?.tendedDay).toBe(1);
    // Schema 6: the three measures at Book 10's start (a tie to the steerer: 20), her traits,
    // likes and tendency from Book 5, and her day begun: a job and the wreck remembered.
    expect(hild).toMatchObject({ happiness: 60, friendship: 20, fear: 0, codes: ['NORSE'] });
    expect(hild?.traits.map((t) => t.trait)).toEqual(['BRAVE', 'KEEN_EYED', 'GRUDGE_HOLDER']);
    expect(hild?.job?.kind).toBe('FISHER');
    expect(hild?.life.joinedDay).toBe(2);
    expect(hild?.memories.map((m) => m.about)).toEqual(['WRECK', 'THORKEL']);
    expect(state.talk).toBeNull();
    expect(state.disputes).toEqual([]);
    expect('regard' in (hild ?? {})).toBe(false);
  });

  it('plays on after the migration', () => {
    const { state } = readSave(golden, { context });
    const tick = state.tick;
    const sim = createSimulation(b, state);
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.state.tick).toBe(tick + 600);
  });

  it('needs the people content to migrate', () => {
    expect(() => readSave(golden, { context: { balance } })).toThrow(SaveError);
  });
});

describe('golden save 6 (schema 6)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_06)) as SaveFile;

  it("loads, matches its hash and holds the camp, Hild's day, her talk and her job", () => {
    const { state, migratedFrom } = readSave(golden);
    expect(migratedFrom).toBeNull();
    expect(state.version).toBe(6);
    expect(state.calendar).toEqual({ day: 2, minuteOfDay: 15 * 60 });
    expect(state.facts).toMatchObject({
      'ch1.at_broch': true,
      'ch1.fire_lit': true,
      'ch1.hild_tended': true,
    });
    expect(state.oneShots['BEAT_1_BROCH']).toBe(1);
    const hild = state.people['C_HILD'];
    expect(hild?.wounds[0]?.tendedDay).toBe(1);
    // The rescue and the care, remembered; the talk about her father; the camp her work now.
    expect(hild?.memories.map((m) => m.about)).toEqual(
      expect.arrayContaining(['WRECK', 'THORKEL', 'RESCUE', 'TENDED', 'FIRE_LIT']),
    );
    expect(hild?.life.topics['c_hild.father']).toBe(2);
    expect(hild?.job).toMatchObject({ kind: 'CAMP', since: 2, byOrder: true });
    expect(hild?.friendship).toBeGreaterThan(20);
    expect(state.ledger.map((d) => d.tag)).toContain('RESCUE');
    expect(state.report?.day).toBe(2);
    expect(state.report?.lines.some((l) => l.key === 'report.work.job')).toBe(true);
  });

  it('is reproduced exactly by its scenario', () => {
    expect(goldenSave06()).toEqual(golden);
  });
});

/**
 * Stage 3 acceptance check 2: save under 200 ms; reload reproduces the hash; the migration chain.
 * Golden saves 1 to 10 are frozen and load through it; golden save 11 (design addendum 2.4: Chapter
 * 1 played to its end by the chapter run) is reproduced by its scenario (decision DE-80).
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
import { landContext } from '../../src/sim/land/context.ts';
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
  GOLDEN_07,
  GOLDEN_08,
  GOLDEN_09,
  GOLDEN_10,
  GOLDEN_11,
  goldenSave11,
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
      schemaVersion: 11,
    });
    const resumed = createSimulation(b, state);
    for (let i = 0; i < 50_000; i++) {
      sim.step();
      resumed.step();
    }
    expect(stateHash(resumed.state)).toBe(stateHash(sim.state));
  });

  it('migrate a save through the chain', () => {
    const v12: Migration = {
      from: 11,
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
      migrations: [v12],
      currentVersion: 12,
    });
    expect(migratedFrom).toBe(11);
    expect(state.version).toBe(12);
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
      () => readSave({ ...file, header: { ...file.header, schemaVersion: 13 } }),
      'FUTURE_VERSION',
    );
    expectReason(() => readSave(file, { migrations: [], currentVersion: 12 }), 'NO_MIGRATION');
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
    expect(state.version).toBe(11);
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
    expect(state.version).toBe(11);
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
    expect(state.version).toBe(11);
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
    const tick = state.tick;
    const sim = createSimulation(b, state);
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.state.tick).toBe(tick + 600);
  });
});

describe('golden save 4 (schema 4, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_04)) as SaveFile;

  it('loads through the migration and holds the weapons found, the arrow spent and the camp', () => {
    expect(golden.header.schemaVersion).toBe(4);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(4);
    expect(state.version).toBe(11);
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
    // Schema 11 (design addendum 2.4): the bow came from Thorkel's chest, so the chest stands
    // opened at its home by the shelter in the camp (and nothing else is elsewhere).
    expect(state.onFoot?.elsewhere).toEqual({
      ZONE_SK_MACHAIR: {
        actors: { ITEM_THORKEL_CHEST: { x: 32.2 * 24, y: 31.4 * 24, facing: 'e', pose: 'idle' } },
        items: [],
        stuck: [],
      },
    });
    expect(state.facts['ch1.chest_opened']).toBe(true);
    expect(state.homes['ISLE_SKARV']?.placed).toEqual(['ITEM_THORKEL_CHEST']);
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
    expect(state.version).toBe(11);
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

describe('golden save 6 (schema 6, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_06)) as SaveFile;

  it("loads through the migration and holds the camp, Hild's day, her talk and her job", () => {
    expect(golden.header.schemaVersion).toBe(6);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(6);
    expect(state.version).toBe(11);
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
    // Schema 7: a new campaign's options, no game over, and the wreck-scavengers among the people.
    expect(state.options).toEqual({ secondWind: false, ransMercy: false, parryWindow: null });
    expect(state.gameOver).toBeNull();
    expect(state.people['E_WRECKER_KETILL']).toMatchObject({ status: 'alive' });
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

describe('golden save 7 (schema 7, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_07)) as SaveFile;

  it('loads through the migration: the scavengers met on the strand but never fought go to the fold', () => {
    expect(golden.header.schemaVersion).toBe(7);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(7);
    expect(state.version).toBe(11);
    expect(state.calendar).toEqual({ day: 2, minuteOfDay: 15 * 60 });
    expect(state.options.secondWind).toBe(true);
    expect(state.gameOver).toBeNull();
    // Decision S10-5: off the strand, and the encounter comes again at the sheepfold.
    expect(state.facts['enc.SCN_SK_WRECKERS']).toBeUndefined();
    const actors = state.onFoot?.actors ?? {};
    expect(Object.keys(actors).filter((id) => id.startsWith('E_'))).toEqual([]);
    expect(state.onFoot?.player.fight).toMatchObject({ weapon: 'Seax', state: 'idle' });
    expect(state.people['C_HILD']?.job?.kind).toBe('CAMP');
  });

  it('plays on after the migration', () => {
    const { state } = readSave(golden, { context });
    const tick = state.tick;
    const sim = createSimulation(b, state);
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.state.tick).toBe(tick + 600);
  });
});

describe('golden save 8 (schema 8, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_08)) as SaveFile;

  it('loads through the migration and holds the three searches decided and their people at home', () => {
    expect(golden.header.schemaVersion).toBe(8);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(8);
    expect(state.version).toBe(11);
    expect(state.facts['search.oddi']).toBe('CHEST_FIRST');
    expect(state.facts['search.runa']).toBe('OFFERING');
    expect(state.facts['search.bran']).toBe('BARGAIN');
    expect(state.facts['ch1.chest']).toBe('GIVEN');
    expect(state.facts['hagseat.offering']).toBe('CONFESSION');
    expect([...state.household.residents].sort()).toEqual(['C_BRAN', 'C_HILD', 'C_ODDI', 'C_RUNA']);
    expect(state.powers['POWER_CAILLEACH']).toMatchObject({ stone: 'DRY', offering: 'CONFESSION' });
    // Version 9 (Stage 11): no ship was saved; the boat is laid on the strand as play goes on.
    expect(state.ships).toEqual({});
  });

  it('plays on after the migration, and the wrecked boat lies on the strand', () => {
    const { state } = readSave(golden, { context });
    const balance = loadBalanceJson();
    const { content } = loadContentFromDisk();
    const sim = createSimulation(b, state, landContext(content, balance));
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.state.ships['flagship']).toMatchObject({
      hull: 'HULL_COASTAL_BOAT',
      repairs: { HULL: { stage: 'LACKING' }, RIGGING: { stage: 'LACKING' } },
    });
  });
});

describe('golden save 9 (schema 9, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_09)) as SaveFile;

  it('loads through the migration and holds the repairs, the oar traded for and the fitting', () => {
    expect(golden.header.schemaVersion).toBe(9);
    const { state, migratedFrom } = readSave(golden, { context });
    expect(migratedFrom).toBe(9);
    expect(state.version).toBe(11);
    expect(state.facts['repair.oar']).toBe('TRADE');
    expect(state.facts['ch1.boat_ready']).toBe(true);
    const ship = state.ships['flagship'];
    expect(ship?.repairs).toMatchObject({
      HULL: { stage: 'DONE' },
      RIGGING: { stage: 'DONE' },
      STEERING_OAR: { stage: 'DONE', how: 'TRADE' },
    });
    expect(ship?.fittings['MIDSHIP']).toBe('FIT_EXTENDED_HOLD');
    expect(state.oneShots['BEAT_1_REPAIRS']).toBeDefined();
    // Version 10 (Stage 12): no gate yet, the boat unnamed, and no telemetry known.
    expect(state.gates).toEqual({});
    expect(ship?.name).toBeNull();
    expect(state.telemetry).toEqual({ start: null, heldMs: 0, marks: {} });
  });

  it('plays on after the migration: the launch opens, and play is timed from the load', () => {
    const { state } = readSave(golden, { context });
    const { content: c } = loadContentFromDisk();
    const sim = createSimulation(b, state, landContext(c, balance));
    const tick = state.tick;
    for (let i = 0; i < 10; i++) sim.step();
    expect(sim.state.gates['BEAT_1_LAUNCH']?.status).toBe('OPEN');
    expect(sim.state.telemetry.start).toBe(tick);
    expect(sim.state.telemetry.marks['boat_ready']?.tick).toBe(tick);
  });
});

describe('golden save 10 (schema 10, frozen)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_10)) as SaveFile;

  it('loads through the migration and holds Chapter 1 ended: the boat launched, named and marked', () => {
    expect(golden.header.schemaVersion).toBe(10);
    const { state, migratedFrom } = readSave(golden, { context });
    // Frozen from design addendum 2.4 (decision DE-80): it loads through combat v2's step and the
    // opening's (decisions DE-1 to DE-79).
    expect(migratedFrom).toBe(10);
    expect(state.version).toBe(11);
    expect(golden.header.chapter).toBe('CH_2_FIRST_RAID');
    expect(state.chapters['CH_1_WRECK']).toMatchObject({ status: 'RESOLVED' });
    expect(state.gates['BEAT_1_LAUNCH']?.status).toBe('PASSED');
    expect(state.ships['flagship']).toMatchObject({
      name: 'Grey Seal',
      marks: { sail: 'stripes_broad:madder' },
    });
    expect(state.facts['ch1.rites']).toBe('SEA_BURIAL');
    expect(state.facts['tutorialComplete']).toBe(true);
    expect(state.knowledge.places['SITE_CARRICK']).toBe('RUMOURED');
    expect(state.telemetry.marks['chapter_end']).toBeDefined();
    // Version 11: the steerer's stance at rest (no lock-on, not sneaking).
    expect(state.onFoot?.player.stance).toMatchObject({ lockOn: null, sneaking: false });
  });

  it('plays on after the migration', () => {
    const { state } = readSave(golden, { context });
    const { content: c } = loadContentFromDisk();
    const sim = createSimulation(b, state, landContext(c, balance));
    const tick = state.tick;
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.state.tick).toBe(tick + 600);
    expect(sim.state.chapters['CH_1_WRECK']).toMatchObject({ status: 'RESOLVED' });
  });
});

describe('golden save 11 (schema 11): the chapter-end save of design addendum 2.4', () => {
  const golden = JSON.parse(repoFile(GOLDEN_11)) as SaveFile;

  it('loads, matches its hash and holds Chapter 1 as 2.4 plays it, ended', () => {
    const { state, migratedFrom } = readSave(golden);
    expect(migratedFrom).toBeNull();
    expect(state.version).toBe(11);
    expect(golden.header).toMatchObject({ seed: 'chapter-1', chapter: 'CH_2_FIRST_RAID' });
    expect(state.chapters['CH_1_WRECK']).toMatchObject({ status: 'RESOLVED' });
    expect(state.gates['BEAT_1_LAUNCH']?.status).toBe('PASSED');
    expect(state.ships['flagship']).toMatchObject({
      name: 'Grey Seal',
      marks: { sail: 'raven:woad' },
      fittings: { MIDSHIP: 'FIT_EXTENDED_HOLD' },
    });
    // The 2.4 opening: Hild cut free, the chest home, the fire, Hild walking up, the sail raised.
    expect(state.facts).toMatchObject({
      'ch1.net_free': true,
      'ch1.chest_home': true,
      'ch1.fire_lit': true,
      'ch1.hild_walked_up': true,
      'ch1.shelter_raised': true,
      'ch1.dusk': 'DARK',
      'ch1.fire_scene': true,
    });
    // The searches, Runa's question answered truly, the key, the chest and the mast stores.
    expect(state.facts).toMatchObject({
      'search.oddi': 'CHEST_FIRST',
      'search.runa': 'OFFERING',
      'search.bran': 'FIGHT',
      'runa.told': 'FIRE',
      'runa.tools_at': 'FIRE',
      'ch1.key': 'BODY',
      'ch1.chest_opened': true,
      'ch1.mast_stores': 'CAMP',
      'ch1.rites': 'SEA_BURIAL',
      tutorialComplete: true,
    });
    expect(state.player.hotbar.slots.slice(0, 2)).toEqual(['ITEM_SEAX', 'ITEM_BOW']);
    expect([...state.household.residents].sort()).toEqual(['C_BRAN', 'C_HILD', 'C_ODDI', 'C_RUNA']);
    expect(state.knowledge.places['SITE_CARRICK']).toBe('RUMOURED');
    for (const mark of ['first_combat', 'bow', 'stores', 'chapter_end'])
      expect(state.telemetry.marks[mark], mark).toBeDefined();
  });

  it('is reproduced exactly by its scenario', () => {
    expect(goldenSave11()).toEqual(golden);
  }, 120_000);
});

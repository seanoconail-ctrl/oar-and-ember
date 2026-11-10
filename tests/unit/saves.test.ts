/** Stage 3 acceptance check 2: save under 200 ms; reload reproduces the hash; a v1-to-v2 migration. */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
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
import { GOLDEN_01, GOLDEN_02, goldenSave02 } from '../../src/tools/saves/golden.ts';
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
    for (let m = 0; m < 40; m++) person.memories.push({ day: m, about: `MEMORY_${m}` });
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
      schemaVersion: 2,
    });
    const resumed = createSimulation(b, state);
    for (let i = 0; i < 50_000; i++) {
      sim.step();
      resumed.step();
    }
    expect(stateHash(resumed.state)).toBe(stateHash(sim.state));
  });

  it('migrate a save through the chain', () => {
    const v3: Migration = {
      from: 2,
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
      migrations: [v3],
      currentVersion: 3,
    });
    expect(migratedFrom).toBe(2);
    expect(state.version).toBe(3);
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
    expectReason(() => readSave(file, { migrations: [], currentVersion: 3 }), 'NO_MIGRATION');
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
    const { state, migratedFrom } = readSave(golden);
    expect(migratedFrom).toBe(1);
    expect(state.version).toBe(2);
    expect(state.onFoot).toBeNull();
    expect(state.calendar).toEqual({ day: 3, minuteOfDay: 8 * 60 });
    expect(state.player.staminaMaxChange).toBe(-30);
    expect(state.oneShots).toEqual({ BEAT_1_WAKE: 1 });
  });
});

describe('golden save 2 (schema 2)', () => {
  const golden = JSON.parse(repoFile(GOLDEN_02)) as SaveFile;

  it('loads, matches its hash and holds the rescue', () => {
    const { state, migratedFrom } = readSave(golden);
    expect(migratedFrom).toBeNull();
    expect(state.player).toMatchObject({ name: 'Ash', bodyModel: 'B' });
    expect(state.household.residents).toEqual(['C_HILD']);
    expect(state.onFoot?.actors['C_HILD']?.pose).toBe('sit');
    expect(state.calendar).toEqual({ day: 3, minuteOfDay: 8 * 60 });
    expect(state.oneShots).toEqual({ BEAT_1_WAKE: 1 });
  });

  it('is reproduced exactly by its scenario', () => {
    expect(goldenSave02()).toEqual(golden);
  });
});

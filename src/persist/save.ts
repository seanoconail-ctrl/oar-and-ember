/**
 * Save files (Book 2 section 20): JSON world state, compressed, under a header with the schema
 * version, build, seed, day, chapter and state hash. Loading verifies the hash, refuses unknown
 * future versions and runs the migration chain.
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { parsePeopleBasics, parseStartingWeapons, parseTimeBalance } from '../content/balance.ts';
import { parseWorkBalance } from '../content/homeBalance.ts';
import { hashValue } from '../core/hash.ts';
import { activeChapter, WORLD_STATE_VERSION } from '../sim/world.ts';
import type { WorldState } from '../sim/world.ts';

export const SAVE_FORMAT = 'oar-and-ember-save';

export type SaveKind = 'manual' | 'autosave' | 'checkpoint';
export type AutosaveReason = 'WAKING' | 'DEPARTURE' | 'LANDING';

export interface SaveHeader {
  readonly schemaVersion: number;
  readonly build: string;
  readonly seed: string;
  readonly day: number;
  readonly chapter: string | null;
  readonly stateHash: string;
  readonly kind: SaveKind;
  readonly slot: string;
  readonly label?: string;
  readonly reason?: AutosaveReason;
  /** Increases with every save, so the newest can be found without trusting clocks. */
  readonly sequence: number;
  /** Wall-clock time, for people to read only. */
  readonly savedAt: string;
}

export interface SaveFile {
  readonly format: typeof SAVE_FORMAT;
  readonly header: SaveHeader;
  /** The world state as JSON, deflated, in base64. */
  readonly data: string;
}

export class SaveError extends Error {
  readonly reason: 'NOT_A_SAVE' | 'FUTURE_VERSION' | 'CORRUPT' | 'NO_MIGRATION';
  constructor(reason: SaveError['reason'], message: string) {
    super(message);
    this.name = 'SaveError';
    this.reason = reason;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] ?? '';
    out += B64[(n >> 12) & 63] ?? '';
    out += i + 1 < bytes.length ? (B64[(n >> 6) & 63] ?? '') : '=';
    out += i + 2 < bytes.length ? (B64[n & 63] ?? '') : '=';
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let o = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v === -1) throw new SaveError('CORRUPT', 'The save data is not valid base64');
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (value >> bits) & 0xff;
    }
  }
  return out;
}

export interface SaveMeta {
  readonly build: string;
  readonly kind: SaveKind;
  readonly slot: string;
  readonly sequence: number;
  readonly savedAt: string;
  readonly label?: string;
  readonly reason?: AutosaveReason;
}

export function writeSave(world: WorldState, meta: SaveMeta): SaveFile {
  const json = JSON.stringify(world);
  const header: SaveHeader = {
    schemaVersion: world.version,
    build: meta.build,
    seed: world.seed,
    day: world.calendar.day,
    chapter: activeChapter(world),
    stateHash: hashValue(world),
    kind: meta.kind,
    slot: meta.slot,
    sequence: meta.sequence,
    savedAt: meta.savedAt,
    ...(meta.label === undefined ? {} : { label: meta.label }),
    ...(meta.reason === undefined ? {} : { reason: meta.reason }),
  };
  return { format: SAVE_FORMAT, header, data: toBase64(deflateSync(strToU8(json), { level: 6 })) };
}

/** What a migration may read besides the save: balance.json (a step that needs a Book 10 number). */
export interface MigrationContext {
  readonly balance: unknown;
}

/** One step of the migration chain: a save at `from` becomes a save at `from + 1`. */
export interface Migration {
  readonly from: number;
  readonly describe: string;
  readonly up: (
    state: Record<string, unknown>,
    ctx: MigrationContext | null,
  ) => Record<string, unknown>;
}

/**
 * The real migration chain. Version 1 to 2 (Stage 6) adds `onFoot`, empty: a version 1 save
 * holds no positions, so the game places the steerer at the zone's spawn when it loads one.
 * Version 2 to 3 (the Stage 6 rework) adds the hotbar and the aim. Version 3 to 4 (starting weapons
 * and missiles) adds the inventory with counts, the pickup tooltips shown, an aim's distance, and
 * the zone's items and missiles; it reads Book 10's startingArrows, so it needs balance.json.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    describe: 'adds onFoot (Stage 6), empty',
    up: (state) => ({ ...state, onFoot: null }),
  },
  {
    from: 2,
    describe: "adds the hotbar and a drawn bow's aim (Stage 6 rework), empty",
    // A version 2 save predates the hotbar: the steerer keeps their gear list, with an empty
    // hotbar (only development builds wrote version 2 saves), and is not drawing a bow.
    up: (state) => {
      const player = state['player'] as Record<string, unknown>;
      const onFoot = state['onFoot'] as { player: Record<string, unknown> } | null;
      return {
        ...state,
        player: { ...player, hotbar: { slots: [], selected: 0 } },
        onFoot: onFoot === null ? null : { ...onFoot, player: { ...onFoot.player, aim: null } },
      };
    },
  },
  {
    from: 3,
    describe:
      'adds the inventory (arrows), the pickup tooltips shown, the aim distance, and the zone items and missiles',
    // A version 3 save woke with the bow and seax in hand (the Stage 6 rework): it keeps them, and
    // a steerer holding the bow gets Book 10's starting arrows. No tooltip has been shown. What
    // lay in the zone is not known to a version 3 save, so nothing lies there; nothing is in
    // flight or stuck. A draw in progress flies to full range.
    up: (state, ctx) => {
      if (ctx === null)
        throw new SaveError('NO_MIGRATION', 'Migrating a schema 3 save needs balance.json');
      const player = state['player'] as Record<string, unknown> & {
        hotbar?: { slots?: unknown[] };
      };
      const hasBow = (player.hotbar?.slots ?? []).includes('ITEM_BOW');
      const arrows = parseStartingWeapons(ctx.balance).startingArrows;
      const onFoot = state['onFoot'] as {
        player: Record<string, unknown> & { aim?: Record<string, unknown> | null };
      } | null;
      const aim = onFoot?.player.aim;
      return {
        ...state,
        player: {
          ...player,
          inventory: hasBow ? { ITEM_ARROW: arrows } : {},
          tipsSeen: [],
        },
        onFoot:
          onFoot === null
            ? null
            : {
                ...onFoot,
                player: { ...onFoot.player, aim: aim == null ? null : { ...aim, dist: null } },
                items: [],
                projectiles: [],
                nextMissile: 1,
                stuck: [],
              },
      };
    },
  },
  {
    from: 4,
    describe:
      "stamina as Book 2 section 24, the steerer's condition, the camp, tended wounds and the zones out of view (Stage 7)",
    // The bar becomes its Book 2 shape at Book 10's base; a collapse's penalty becomes the
    // Exhausted reason. The camp starts as a new one does (the salvaged stores, no fire). Hild,
    // wounded, has her leg wound, not yet tended. Other zones hold nothing a version 4 save knew.
    up: (state, ctx) => {
      if (ctx === null)
        throw new SaveError('NO_MIGRATION', 'Migrating a schema 4 save needs balance.json');
      const b = parseTimeBalance(ctx.balance);
      const base = parsePeopleBasics(ctx.balance).stamina;
      const work = parseWorkBalance(ctx.balance);
      const player = state['player'] as Record<string, unknown> & {
        stamina?: number;
        staminaMaxChange?: number;
      };
      const calendar = state['calendar'] as { day: number; minuteOfDay: number };
      const now = (calendar.day - 1) * 1440 + ((calendar.minuteOfDay - b.dayStart + 1440) % 1440);
      const change = player.staminaMaxChange ?? 0;
      const reductions =
        change < 0 ? [{ reason: 'EXHAUSTED', amount: -change, since: now, cause: 'collapse' }] : [];
      const max = base + Math.min(0, change);
      const rest: Record<string, unknown> = { ...player };
      delete rest['staminaMaxChange'];
      const homes = state['homes'] as Record<string, Record<string, unknown>>;
      const nextHomes: Record<string, unknown> = {};
      for (const [id, home] of Object.entries(homes)) {
        const stores = { ...((home['stores'] as Record<string, number> | undefined) ?? {}) };
        if (home['stage'] === 'S0' && stores['RES_SALTED_FISH'] === undefined) {
          stores['RES_SALTED_FISH'] = work.wreckStoresRd;
          stores['RES_DRIFTWOOD'] = work.campFuelLoads;
        }
        nextHomes[id] = {
          ...home,
          stores,
          fresh: [],
          fire: { lit: false, fuel: 0 },
          building: null,
          catch: 0,
          rationDay: calendar.day,
          shortDays: 0,
        };
      }
      const people = state['people'] as Record<string, Record<string, unknown>>;
      const nextPeople: Record<string, unknown> = {};
      for (const [id, person] of Object.entries(people)) {
        const wounds = (person['wounds'] as unknown[] | undefined) ?? [];
        nextPeople[id] =
          id === 'C_HILD' && person['status'] === 'wounded' && wounds.length === 0
            ? { ...person, wounds: [{ day: 1, severity: 'SERIOUS', where: 'leg' }] }
            : person;
      }
      const onFoot = state['onFoot'] as Record<string, unknown> | null;
      return {
        ...state,
        player: {
          ...rest,
          stamina: {
            current: Math.min(player.stamina ?? base, max),
            max,
            base,
            reductions,
            spentTick: 0,
          },
          condition: {
            wokeAt: now,
            lastMealAt: null,
            mealsWhileStarving: 0,
            workedMinutes: 0,
            warmMinutes: 0,
          },
          wounds: [],
        },
        homes: nextHomes,
        people: nextPeople,
        onFoot: onFoot === null ? null : { ...onFoot, elsewhere: {} },
        report: null,
      };
    },
  },
];

export interface ReadOptions {
  readonly migrations?: readonly Migration[];
  readonly currentVersion?: number;
  /** For migrations that read balance.json (schema 3 to 4). */
  readonly context?: MigrationContext;
}

export function readSave(
  file: unknown,
  options: ReadOptions = {},
): { state: WorldState; header: SaveHeader; migratedFrom: number | null } {
  const migrations = options.migrations ?? MIGRATIONS;
  const current = options.currentVersion ?? WORLD_STATE_VERSION;
  const save = file as Partial<SaveFile> | null;
  if (save?.format !== SAVE_FORMAT || typeof save.data !== 'string' || save.header === undefined) {
    throw new SaveError('NOT_A_SAVE', 'This is not an Oar and Ember save file');
  }
  const { header } = save;
  if (header.schemaVersion > current) {
    throw new SaveError(
      'FUTURE_VERSION',
      `This save is from a newer version of the game (schema ${header.schemaVersion}; this build reads up to ${current})`,
    );
  }
  let state: Record<string, unknown>;
  try {
    state = JSON.parse(strFromU8(inflateSync(fromBase64(save.data)))) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SaveError) throw error;
    throw new SaveError('CORRUPT', 'The save data cannot be read');
  }
  if (hashValue(state) !== header.stateHash) {
    throw new SaveError('CORRUPT', 'The save data does not match its hash');
  }
  let version = header.schemaVersion;
  while (version < current) {
    const step = migrations.find((m) => m.from === version);
    if (step === undefined)
      throw new SaveError('NO_MIGRATION', `No migration from schema ${version}`);
    state = { ...step.up(state, options.context ?? null), version: version + 1 };
    version++;
  }
  return {
    state: state as unknown as WorldState,
    header,
    migratedFrom: header.schemaVersion === current ? null : header.schemaVersion,
  };
}

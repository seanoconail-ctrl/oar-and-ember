/**
 * Save files (Book 2 section 20): JSON world state, compressed, under a header with the schema
 * version, build, seed, day, chapter and state hash. Loading verifies the hash, refuses unknown
 * future versions and runs the migration chain.
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
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

/** One step of the migration chain: a save at `from` becomes a save at `from + 1`. */
export interface Migration {
  readonly from: number;
  readonly describe: string;
  readonly up: (state: Record<string, unknown>) => Record<string, unknown>;
}

/** The real migration chain. Empty while the world state is at version 1. */
export const MIGRATIONS: readonly Migration[] = [];

export interface ReadOptions {
  readonly migrations?: readonly Migration[];
  readonly currentVersion?: number;
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
    state = { ...step.up(state), version: version + 1 };
    version++;
  }
  return {
    state: state as unknown as WorldState,
    header,
    migratedFrom: header.schemaVersion === current ? null : header.schemaVersion,
  };
}

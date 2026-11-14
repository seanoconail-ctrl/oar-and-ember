/**
 * The ID registry (content/ids.json): every stable ID the books name, with where it comes from.
 * Validation here is pure; tests also check each entry against the book text.
 */
import { ID_MAX_LENGTH, ID_PATTERN, ID_PREFIXES, idPrefix } from '../core/ids.ts';
import type { Id, IdPrefix } from '../core/ids.ts';

export type IdOrigin = 'stated' | 'expanded' | 'assigned';

export interface BookRef {
  readonly book: number;
  /** Two-digit section number, e.g. "02". */
  readonly section: string;
}

export interface IdEntry extends BookRef {
  readonly id: Id;
  readonly prefix: IdPrefix;
  /** Text copied verbatim from the book that names the entity. */
  readonly ref: string;
  readonly origin: IdOrigin;
  /** Where a stated ID is written, when that is not the defining book (e.g. SCN_CARRICK). */
  readonly statedIn?: BookRef;
  readonly note?: string;
}

/** A pattern the books give without listing every member, e.g. MUS_FINALE_*. */
export interface IdFamily extends BookRef {
  readonly pattern: string;
  /** The fixed part every member starts with, e.g. MUS_FINALE_. */
  readonly stem: string;
  readonly ref: string;
}

export interface DeedTag extends BookRef {
  readonly tag: string;
  readonly ref: string;
}

export interface IdRegistry {
  readonly entries: readonly IdEntry[];
  readonly byId: ReadonlyMap<Id, IdEntry>;
  readonly families: readonly IdFamily[];
  readonly deedTags: readonly DeedTag[];
}

const ORIGINS: readonly IdOrigin[] = ['stated', 'expanded', 'assigned'];
const SECTION = /^\d{2}$/;
const DEED_TAG = /^[A-Z]+(_[A-Z]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bookRef(raw: Record<string, unknown>, where: string, problems: string[]): BookRef {
  const { book, section } = raw;
  if (typeof book !== 'number' || !Number.isInteger(book) || book < 1 || book > 11) {
    problems.push(`${where}: "book" must be a book number from 1 to 11`);
  }
  if (typeof section !== 'string' || !SECTION.test(section)) {
    problems.push(`${where}: "section" must be two digits, e.g. "02"`);
  }
  return { book: typeof book === 'number' ? book : 0, section: String(section) };
}

function text(
  raw: Record<string, unknown>,
  key: string,
  where: string,
  problems: string[],
): string {
  const value = raw[key];
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${where}: "${key}" must be non-empty text`);
    return '';
  }
  return value;
}

/**
 * Validates the registry file. Returns the registry and a list of problems, each naming the
 * entry and the reason; the registry is usable only when the list is empty.
 */
export function parseIdRegistry(json: unknown): { registry: IdRegistry; problems: string[] } {
  const problems: string[] = [];
  const entries: IdEntry[] = [];
  const families: IdFamily[] = [];
  const deedTags: DeedTag[] = [];
  const byId = new Map<Id, IdEntry>();
  const registry: IdRegistry = { entries, byId, families, deedTags };
  if (!isRecord(json)) return { registry, problems: ['ids.json: expected an object'] };

  const rawEntries = Array.isArray(json['entries']) ? (json['entries'] as unknown[]) : [];
  if (rawEntries.length === 0) problems.push('ids.json: "entries" must list IDs');
  rawEntries.forEach((raw, i) => {
    const where = `entries[${i}]`;
    if (!isRecord(raw)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const id = text(raw, 'id', where, problems);
    const at = `${where} ${id}`;
    const prefix = idPrefix(id);
    if (!ID_PATTERN.test(id)) problems.push(`${at}: not shaped like PREFIX_NAME in capitals`);
    else if (id.length > ID_MAX_LENGTH) problems.push(`${at}: longer than ${ID_MAX_LENGTH}`);
    else if (prefix === null) problems.push(`${at}: prefix is not one of Book 2 section 04`);
    if (byId.has(id)) problems.push(`${at}: duplicate ID`);
    const origin = raw['origin'];
    if (typeof origin !== 'string' || !ORIGINS.includes(origin as IdOrigin)) {
      problems.push(`${at}: "origin" must be one of ${ORIGINS.join(', ')}`);
    }
    const ref = text(raw, 'ref', at, problems);
    const book = bookRef(raw, at, problems);
    if (prefix === null) return;
    const entry: {
      -readonly [K in keyof IdEntry]: IdEntry[K];
    } = { id, prefix, ref, origin: origin as IdOrigin, ...book };
    const statedIn = raw['statedIn'];
    if (statedIn !== undefined) {
      if (!isRecord(statedIn)) problems.push(`${at}: "statedIn" must be an object`);
      else entry.statedIn = bookRef(statedIn, `${at} statedIn`, problems);
    }
    if (typeof raw['note'] === 'string') entry.note = raw['note'];
    entries.push(entry);
    byId.set(id, entry);
  });

  const rawFamilies = Array.isArray(json['families']) ? (json['families'] as unknown[]) : [];
  rawFamilies.forEach((raw, i) => {
    const where = `families[${i}]`;
    if (!isRecord(raw)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const pattern = text(raw, 'pattern', where, problems);
    const stem = pattern.split(/[<*]/)[0] ?? '';
    const head = stem.slice(0, stem.indexOf('_'));
    if (!stem.endsWith('_') || !Object.hasOwn(ID_PREFIXES, head)) {
      problems.push(`${where} ${pattern}: must start with a Book 2 prefix and end its stem in "_"`);
    }
    families.push({
      pattern,
      stem,
      ref: text(raw, 'ref', where, problems),
      ...bookRef(raw, where, problems),
    });
  });

  const rawTags = Array.isArray(json['deedTags']) ? (json['deedTags'] as unknown[]) : [];
  const seenTags = new Set<string>();
  rawTags.forEach((raw, i) => {
    const where = `deedTags[${i}]`;
    if (!isRecord(raw)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const tag = text(raw, 'tag', where, problems);
    if (!DEED_TAG.test(tag)) problems.push(`${where} ${tag}: must be capitals and underscores`);
    if (seenTags.has(tag)) problems.push(`${where} ${tag}: duplicate deed tag`);
    seenTags.add(tag);
    deedTags.push({
      tag,
      ref: text(raw, 'ref', where, problems),
      ...bookRef(raw, where, problems),
    });
  });

  return { registry, problems };
}

/**
 * Every token in `text` shaped like an ID with a Book 2 prefix. A trailing "_" marks a family
 * stem (e.g. MUS_FINALE_ from `MUS_FINALE_*`); a bare prefix such as `MUS_` is not an ID.
 */
export function findIdTokens(text: string): string[] {
  const prefixes = Object.keys(ID_PREFIXES);
  const pattern = new RegExp(`\\b(?:${prefixes.join('|')})_[A-Z0-9_]*`, 'g');
  const bare = new Set(prefixes.map((p) => `${p}_`));
  return [...new Set(text.match(pattern) ?? [])].filter((token) => !bare.has(token));
}

/** Whether `token` is a registered ID or the stem of a registered family. */
export function isRegistered(registry: IdRegistry, token: string): boolean {
  if (registry.byId.has(token)) return true;
  return registry.families.some((f) => token.startsWith(f.stem));
}

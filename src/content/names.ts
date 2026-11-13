/**
 * Names for the screen (the user's fourth playtest, request 25; decisions DH-110 to DH-114): every
 * person, item, load, resource and place the game can show is named from a string, never by its
 * ID. `displayName` never returns an ID: an ID with no name shows as a plain "that" and the
 * content lint (npm run lint) fails on it before it can ship. `idLikeTokens` finds what looks like
 * an ID or a string key in text meant for the player.
 */
import type { Id } from '../core/ids.ts';

/** An ID in either case: `ITEM_RIGGING`, `item_rigging`, `C_HILD` (an underscore inside a word). */
const ID_UPPER = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]*[A-Z0-9]\b/g;
const ID_LOWER = /\b[a-z][a-z0-9]*_[a-z0-9_]*[a-z0-9]\b/g;
/** A string key left unfilled: `ui.prompt.sleep`, `item.name.rigging` (three dotted parts). */
const KEY_LIKE = /\b[a-z][a-z0-9_]*(?:\.[a-z0-9_]+){2,}\b/g;
/** A variable in a string's text, `{name}`: filled at run time, not shown as written. */
const VARIABLE = /\{[a-zA-Z0-9_]+\}/g;

/** The tokens in `text` that look like an ID or a string key (none in good player text). */
export function idLikeTokens(text: string): string[] {
  const plain = text.replace(VARIABLE, ' ');
  return [
    ...(plain.match(ID_UPPER) ?? []),
    ...(plain.match(ID_LOWER) ?? []),
    ...(plain.match(KEY_LIKE) ?? []),
  ];
}

/** Whether a whole value looks like an ID (`/^[a-z]+_[a-z0-9_]+$/` or `/^[A-Z][A-Z0-9_]+$/`). */
export function looksLikeId(value: string): boolean {
  return /^[a-z]+_[a-z0-9_]+$/.test(value) || /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(value);
}

/** What the names are looked up in: the strings, and content's own name keys by ID. */
export interface NameBook {
  readonly has: (key: string) => boolean;
  readonly t: (key: string, vars?: Record<string, string>) => string;
  /** Name keys from content: people (`nameKey`), hotbar items, buildings, places, fittings. */
  readonly keys: ReadonlyMap<Id, string>;
  /** A zone's place name key (ZONE_PLACE_KEYS). */
  readonly zones?: Readonly<Record<string, string>>;
}

/** The place's name by zone: the save slots' table (src/persist/save.ts; decision DG-79). */

/**
 * The string key that names `id`, or null. In order: the short name used in barks and prompts
 * (`person.short.<id>`, which also names the loads carried: Thorkel's chest, the rigging), the
 * content's own name key (a person's full name, a hotbar item's, a building's or a place's), a
 * zone's place, a fitting's and a resource's name.
 */
export function nameKeyOf(id: Id, book: NameBook): string | null {
  const lower = id.toLowerCase();
  const tries = [
    `person.short.${lower}`,
    book.keys.get(id),
    book.zones?.[id],
    `fitting.name.${lower}`,
    `resource.name.${lower}`,
    `place.name.${lower}`,
  ];
  // An item's own name string (`item.name.comb` for ITEM_BONE_COMB): the whole of it after the
  // family, then each of its words, and each plural (`item.name.bindings` for ITEM_BINDING).
  if (lower.startsWith('item_')) {
    const rest = lower.slice('item_'.length);
    tries.push(`item.name.${rest}`);
    for (const word of rest.split('_')) tries.push(`item.name.${word}`, `item.name.${word}s`);
  }
  for (const key of tries) if (key !== undefined && book.has(key)) return key;
  return null;
}

/** The name to show for `id`; never the ID itself ("that" when nothing names it). */
export function displayName(id: Id, book: NameBook): string {
  const key = nameKeyOf(id, book);
  return key === null ? book.t('ui.name.unknown') : book.t(key);
}

/** Content's name keys by ID: people, hotbar items, buildings, places, hulls and fittings. */
export function contentNameKeys(content: {
  readonly people: ReadonlyMap<Id, { readonly nameKey: string }>;
  readonly places: ReadonlyMap<Id, { readonly nameKey: string }>;
  readonly fittings: ReadonlyMap<Id, { readonly nameKey: string }>;
  readonly onFoot: { readonly items: Readonly<Record<string, { readonly nameKey: string }>> } | null;
}): Map<Id, string> {
  const out = new Map<Id, string>();
  for (const [id, p] of content.places) out.set(id, p.nameKey);
  for (const [id, f] of content.fittings) out.set(id, f.nameKey);
  for (const [id, item] of Object.entries(content.onFoot?.items ?? {})) out.set(id, item.nameKey);
  for (const [id, p] of content.people) out.set(id, p.nameKey);
  return out;
}

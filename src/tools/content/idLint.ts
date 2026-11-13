/**
 * The ID lint (the user's fourth playtest, request 25; decisions DH-110 to DH-114), a step of
 * `npm run lint` (src/tools/content/lint.ts): it fails if any player-facing string looks like an ID
 * or a string key, or if anything the game can name on the screen (a person, a load carried, an
 * item, a place) has no name string, so `displayName` would fall back. The developer menu's own
 * strings (`ui.dev.*`, shown only with ?dev) are excepted.
 */
import { contentNameKeys, idLikeTokens, nameKeyOf } from '../../content/names.ts';
import type { NameBook } from '../../content/names.ts';
import type { Content } from '../../content/registry.ts';
import { ZONE_PLACE_KEYS } from '../../persist/save.ts';

export interface IdLintIssue {
  readonly where: string;
  readonly reason: string;
}

/** Strings only a developer sees (the developer menu, under ?dev). */
const DEV_ONLY = /^ui\.dev\./;

/** Every player-facing string whose text holds an ID-like token or an unfilled string key. */
export function stringIdIssues(
  strings: ReadonlyMap<string, { readonly text: string }>,
): IdLintIssue[] {
  const out: IdLintIssue[] = [];
  for (const [key, entry] of strings) {
    if (DEV_ONLY.test(key)) continue;
    const bad = idLikeTokens(entry.text);
    if (bad.length > 0)
      out.push({ where: `string ${key}`, reason: `looks like an ID: ${bad.join(', ')}` });
  }
  return out;
}

/** The IDs content can put on the screen by name: people, loads, items and zones it mentions. */
export function namedIds(files: ReadonlyMap<string, string>): Set<string> {
  const out = new Set<string>();
  for (const [file, text] of files) {
    if (/(^|\/)(ids|balance)\.json$/.test(file) || file.includes('strings/')) continue;
    for (const m of text.matchAll(/"((?:ITEM|C|P|ZONE)_[A-Z0-9_]+)"/g))
      if (m[1] !== undefined) out.add(m[1]);
  }
  return out;
}

/** Every ID content mentions that the name functions cannot name. */
export function nameIssues(content: Content, files: ReadonlyMap<string, string>): IdLintIssue[] {
  const book: NameBook = {
    has: (k) => content.strings.has(k),
    t: (k) => content.strings.get(k)?.text ?? k,
    keys: contentNameKeys(content),
    zones: ZONE_PLACE_KEYS,
  };
  const out: IdLintIssue[] = [];
  // Only registered IDs: sound events such as ITEM_PICKED_UP share the spelling but are not things.
  const registered = new Set(content.ids.entries.map((e) => e.id));
  for (const id of namedIds(files)) {
    if (!registered.has(id)) continue;
    // Zones not yet built (Stage 14) have no place on the screen yet.
    if (id.startsWith('ZONE_') && !content.zoneMaps.has(id)) continue;
    if (nameKeyOf(id, book) === null)
      out.push({ where: `id ${id}`, reason: 'shown by name, but no string names it' });
  }
  return out;
}

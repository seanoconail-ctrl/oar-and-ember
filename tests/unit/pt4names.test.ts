/**
 * The user's fourth playtest, request 25: "Some items show internal IDs like item_rigging. Find
 * every place an ID can reach the screen, fix them all, and add a lint check that fails the build
 * if any player-facing string looks like an ID" (decisions DH-110 to DH-114).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contentNameKeys,
  displayName,
  idLikeTokens,
  looksLikeId,
  nameKeyOf,
} from '../../src/content/names.ts';
import type { NameBook } from '../../src/content/names.ts';
import { CONTENT_FILES } from '../../src/content/registry.ts';
import { formatString } from '../../src/content/strings.ts';
import { ZONE_PLACE_KEYS } from '../../src/persist/save.ts';
import { campUseLabel } from '../../src/scenes/camp.ts';
import { readinessText } from '../../src/scenes/launchPanels.ts';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';
import { nameIssues, namedIds, stringIdIssues } from '../../src/tools/content/idLint.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const { content } = loadContentFromDisk();
const t = (key: string, vars: Record<string, string> = {}): string =>
  formatString(content.strings, key, vars);
const book: NameBook = {
  has: (k) => content.strings.has(k),
  t: (k, v) => t(k, v ?? {}),
  keys: contentNameKeys(content),
  zones: ZONE_PLACE_KEYS,
};
const files = new Map(
  Object.values(CONTENT_FILES).map((p) => [p, readFileSync(join(REPO_ROOT, p), 'utf8')]),
);

describe('the ID lint (asked; DH-112)', () => {
  it('finds a planted ID, in either case, and a planted string key', () => {
    expect(idLikeTokens('Lift ITEM_RIGGING')).toEqual(['ITEM_RIGGING']);
    expect(idLikeTokens('Carry item_rigging to the boat.')).toEqual(['item_rigging']);
    expect(idLikeTokens('Talk to C_HILD')).toEqual(['C_HILD']);
    expect(idLikeTokens('Press ui.prompt.sleep')).toEqual(['ui.prompt.sleep']);
    expect(looksLikeId('item_rigging')).toBe(true);
    expect(looksLikeId('ITEM_RIGGING')).toBe(true);
    expect(looksLikeId('The rigging')).toBe(false);
  });

  it('passes good text: names, keys in braces, abbreviations and possessives', () => {
    for (const ok of [
      "Thorkel's chest",
      'Lift {name} ({key})',
      'W A S D to move',
      'Too early to sleep: after 18:00.',
      'Hild, calling from the west',
    ])
      expect(idLikeTokens(ok), ok).toEqual([]);
  });

  it('fails the build on a planted player-facing string, and passes the real content', () => {
    const planted = new Map([
      ['ui.prompt.lift_test', { text: 'Lift ITEM_RIGGING' }],
      ['ui.dev.zone', { text: 'Zone ZONE_SK_STRAND' }],
      ['ui.prompt.ok', { text: 'Lift {name}' }],
    ]);
    const issues = stringIdIssues(planted);
    expect(issues.map((i) => i.where)).toEqual(['string ui.prompt.lift_test']);
    expect(stringIdIssues(content.strings)).toEqual([]);
  });

  it('fails when something shown by name has no name string, and passes the real content', () => {
    const planted = new Map([['content/x.json', '{ "id": "ITEM_MANANNAN_CUP" }']]);
    // The Cup is registered but not named yet: shown by a content file, it would fail.
    const issues = nameIssues(content, planted);
    expect(issues.map((i) => i.where)).toEqual(['id ITEM_MANANNAN_CUP']);
    expect(nameIssues(content, files)).toEqual([]);
  });
});

describe('the runtime guard: every ID through the name functions (asked; DH-113)', () => {
  const families =
    /^(C|E|P|ITEM|RES|ZONE|ISLE|BLD|FIT|TASK|SITE|TOWN|FORT|ABBEY|GLEN|CAMP|HULL|FAC)_/;
  const ids = content.ids.entries.map((e) => e.id).filter((id) => families.test(id));

  it('no registered ID of a thing, person or place is ever shown as an ID', () => {
    expect(ids.length).toBeGreaterThan(150);
    for (const id of ids) {
      const name = displayName(id, book);
      expect(looksLikeId(name), `${id} shows as "${name}"`).toBe(false);
      expect(idLikeTokens(name), `${id} shows as "${name}"`).toEqual([]);
    }
  });

  it('everything content can show by name has its own name (people, loads, items, zones)', () => {
    const shown = [...namedIds(files)].filter(
      (id) =>
        content.ids.entries.some((e) => e.id === id) &&
        (!id.startsWith('ZONE_') || content.zoneMaps.has(id)),
    );
    for (const id of ['ITEM_RIGGING', 'ITEM_BOARDS', 'ITEM_STEERING_OAR', 'ITEM_THORKEL_CHEST'])
      expect(shown).toContain(id);
    for (const id of shown) expect(nameKeyOf(id, book), id).not.toBeNull();
    expect(displayName('ITEM_RIGGING', book)).toBe('The rigging');
  });

  it('every prompt with a name in it reads as words for every person and load', () => {
    const keys = [...content.strings.keys()].filter(
      (k) =>
        /\{(name|item|what|task)\}/.test(k) ||
        /\{(name|item|what|task)\}/.test(content.strings.get(k)?.text ?? ''),
    );
    expect(keys.length).toBeGreaterThan(5);
    for (const key of keys) {
      const text = content.strings.get(key)?.text ?? '';
      const vars: Record<string, string> = {};
      for (const m of text.matchAll(/\{([a-zA-Z0-9_]+)\}/g))
        vars[m[1] ?? ''] = displayName('ITEM_RIGGING', book);
      expect(idLikeTokens(t(key, vars)), key).toEqual([]);
    }
  });

  it('the camp prompt and the readiness screen name what they list, never by ID', () => {
    const label = campUseLabel(
      { kind: 'TASK', task: 'TASK_NOT_A_TASK', site: 'x' },
      content,
      t,
      (id) => displayName(id, book),
      'E',
      false,
    );
    expect(idLikeTokens(label.text)).toEqual([]);
    const words = {
      t: (k: string, v?: Record<string, string>) => t(k, v ?? {}),
      person: (id: string) => displayName(id, book),
      item: (id: string) => displayName(id, book),
      fitting: (id: string) => displayName(id, book),
    };
    const text = readinessText(
      {
        measure: 'WEAPONS',
        state: 'READY',
        labelKey: 'ui.gate.launch.title',
        textKey: 'ui.gate.launch.gear.ready',
        vars: { arrows: 0 },
        list: { kind: 'item', ids: ['ITEM_SEAX', 'ITEM_BOW', 'ITEM_RIGGING'] },
      } as unknown as Parameters<typeof readinessText>[0],
      words,
    );
    expect(idLikeTokens(text), text).toEqual([]);
  });
});

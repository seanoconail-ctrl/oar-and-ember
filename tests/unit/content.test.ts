/** Stage 3 acceptance check 1: lint passes on seed data; a broken reference fails with file, path and reason. */
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content/registry.ts';
import type { ContentFiles } from '../../src/content/registry.ts';
import { balanceJsonText } from '../../src/tools/content/balanceFromBook.ts';
import { readContentFiles } from '../../src/tools/content/loadContentFiles.ts';
import { book, repoFile } from './books.ts';

const files = readContentFiles();

/** A copy of the content with one file changed. */
function withChange(key: keyof ContentFiles, change: (data: unknown[]) => void): ContentFiles {
  const copy = structuredClone(files) as Record<keyof ContentFiles, unknown>;
  change(copy[key] as unknown[]);
  return copy;
}

describe('content/balance.json', () => {
  it('is exactly what Book 10 generates', () => {
    expect(balanceJsonText(book(10), book(1))).toBe(repoFile('content/balance.json'));
  });
});

describe('the seed data from Books 4, 5, 7 and 10', () => {
  const { content, issues } = loadContent(files);

  it('passes content lint', () => {
    expect(issues).toEqual([]);
  });

  it('holds the places, people, factions and ship parts the books name', () => {
    // 27 since design addendum 2.2 dropped Arra Foot as a home site (decision DA-3).
    expect(content.places.size).toBe(27);
    expect(content.hazards.size).toBe(4);
    // 13 since Stage 13: the reef of the wreck on Sgeir Dhubh, in Rán's Reach (decision S13-48).
    expect(content.zones.size).toBe(13);
    expect([...content.people.values()].filter((p) => p.kind === 'RESIDENT')).toHaveLength(17);
    expect(content.factions.size).toBe(8);
    expect(content.hulls.size).toBe(4);
    expect(content.fittings.size).toBe(10);
  });

  it("copies each resident's values from Book 5", () => {
    const text = book(5);
    for (const person of content.people.values()) {
      if (person.values === undefined) continue;
      // The resident's passage: from their ID to the next heading or table row.
      const at = text.indexOf(`\`${person.id}\``);
      expect(at, person.id).toBeGreaterThan(-1);
      const near = text.slice(at, at + 700);
      for (const [value, n] of Object.entries(person.values)) {
        const word = value.charAt(0) + value.slice(1).toLowerCase();
        expect(near, `${person.id} ${word} ${n}`).toContain(`${word} ${n}`);
      }
    }
  });

  it('gives every name a string', () => {
    expect(content.strings.get('person.name.c_hild')?.text).toBe('Hild Thorkelsdóttir');
    expect(content.strings.get('place.name.sk_tidecave')?.text).toBe('Seal Cave');
  });
});

describe('content lint names the file, path and reason of every problem', () => {
  it('a broken reference', () => {
    const { issues } = loadContent(
      withChange('factions', (list) => {
        (list[0] as { home: string }).home = 'TOWN_NOWHERE';
      }),
    );
    expect(issues).toEqual([
      { file: 'content/factions.json', path: '[0].home', reason: 'unknown place "TOWN_NOWHERE"' },
    ]);
  });

  it('a missing string key and a wrong ID prefix', () => {
    const { issues } = loadContent(
      withChange('hazards', (list) => {
        (list[1] as { nameKey: string }).nameKey = 'hazard.name.nowhere';
        (list[2] as { id: string }).id = 'SK_MIST';
      }),
    );
    expect(issues).toContainEqual({
      file: 'content/hazards.json',
      path: '[1].nameKey',
      reason: 'unknown string key "hazard.name.nowhere"',
    });
    expect(issues).toContainEqual({
      file: 'content/hazards.json',
      path: '[2].id',
      reason: '"SK_MIST" should start with HAZ_',
    });
  });

  it('an unknown field, a missing field and an unregistered ID', () => {
    const { issues } = loadContent(
      withChange('hulls', (list) => {
        const hull = list[0] as Record<string, unknown>;
        hull['colour'] = 'red';
        delete hull['tier'];
        (list[1] as { id: string }).id = 'HULL_DRAGON';
      }),
    );
    expect(issues).toContainEqual({
      file: 'content/hulls.json',
      path: '[0].colour',
      reason: 'unknown field "colour"',
    });
    expect(issues).toContainEqual({
      file: 'content/hulls.json',
      path: '[0].tier',
      reason: 'missing',
    });
    expect(issues).toContainEqual({
      file: 'content/hulls.json',
      path: 'HULL_DRAGON',
      reason: '"HULL_DRAGON" is not in the ID registry (content/ids.json)',
    });
  });

  it('a Book 10 row that does not exist, and a one-sided tie', () => {
    const { issues } = loadContent(
      withChange('fittings', (list) => {
        (list[0] as { balanceRow: string }).balanceRow = 'Dragon prow';
      }),
    );
    expect(issues).toContainEqual({
      file: 'content/fittings.json',
      path: '[0].balanceRow',
      reason: 'unknown Book 10 fitting row "Dragon prow"',
    });
    const tie = loadContent(
      withChange('people', (list) => {
        const gudrun = list.find((p) => (p as { id: string }).id === 'C_GUDRUN') as {
          ties: unknown[];
        };
        gudrun.ties.push({ to: 'C_HILD', kind: 'KIN' });
      }),
    );
    expect(tie.issues.map((i) => i.reason)).toContain(
      'C_HILD has no matching KIN tie back to C_GUDRUN',
    );
  });
});

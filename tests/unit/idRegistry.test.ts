/** Stage 1 deliverable: the ID registry seeded from Books 4 to 11 (Book 2 section 04). */
import { describe, expect, it } from 'vitest';
import { ID_PREFIXES, idPrefix, isValidId } from '../../src/core/ids.ts';
import { findIdTokens, isRegistered, parseIdRegistry } from '../../src/content/idRegistry.ts';
import { book, bookSection, repoFile } from './books.ts';

const { registry, problems } = parseIdRegistry(JSON.parse(repoFile('content/ids.json')));

describe('ID shapes (Book 2 section 04)', () => {
  it('accepts IDs with a Book 2 prefix and rejects others', () => {
    expect(isValidId('SK_WRECK_STRAND')).toBe(true);
    expect(idPrefix('C_HILD')).toBe('C');
    expect(idPrefix('CH_1_WRECK')).toBe('CH');
    expect(isValidId('XX_THING')).toBe(false);
    expect(isValidId('sk_broch')).toBe(false);
    expect(isValidId('SK_')).toBe(false);
    expect(isValidId(`SK_${'A'.repeat(40)}`)).toBe(false);
  });

  it('knows all 41 prefixes of the Book 2 table (MAIN_ since design addendum 2.2, SEA_ and ENC_ since Stage 13)', () => {
    const table = bookSection(2, '04') ?? '';
    const written = new Set(
      table
        .match(/`([A-Z]+_ ?)+`/g)
        ?.join(' ')
        .match(/[A-Z]+(?=_)/g) ?? [],
    );
    expect(new Set(Object.keys(ID_PREFIXES))).toEqual(written);
    expect(written.size).toBe(41);
  });
});

describe('the registry file', () => {
  it('has no structural problems', () => {
    expect(problems).toEqual([]);
    expect(registry.entries.length).toBeGreaterThan(300);
  });

  it('cites a real section for every entry, family and deed tag', () => {
    const missing = [...registry.entries, ...registry.families, ...registry.deedTags]
      .filter((e) => bookSection(e.book, e.section) === null)
      .map((e) => `Book ${e.book} section ${e.section}`);
    expect(missing).toEqual([]);
  });

  it('copies every ref verbatim from its book', () => {
    const wrong = [...registry.entries, ...registry.families, ...registry.deedTags]
      .filter((e) => !book(e.book).includes(e.ref))
      .map((e) => `${'id' in e ? e.id : 'tag' in e ? e.tag : e.pattern}: "${e.ref}"`);
    expect(wrong).toEqual([]);
  });

  it('marks an ID "stated" only if a book writes it, and "assigned" only if none does', () => {
    const all = Array.from({ length: 11 }, (_, i) => book(i + 1)).join('\n');
    const notWritten = registry.entries
      .filter((e) => e.origin === 'stated')
      .filter((e) => !findIdTokens(book(e.statedIn?.book ?? e.book)).includes(e.id))
      .map((e) => e.id);
    expect(notWritten).toEqual([]);
    const alreadyWritten = registry.entries
      .filter((e) => e.origin === 'assigned' && findIdTokens(all).includes(e.id))
      .map((e) => e.id);
    expect(alreadyWritten).toEqual([]);
  });

  it('registers every ID written in Books 4 to 11 and the level grids', () => {
    const texts = [4, 5, 6, 7, 8, 9, 10, 11].map((n) => book(n));
    for (const grid of [
      'carrick_tiles',
      'hollow_cairn_tiles',
      'sea_wreck_tiles',
      'skarvholm_blocks',
      'skarvholm_occupied_blocks',
      'steading_tiles',
    ]) {
      texts.push(repoFile(`docs/levels/${grid}.txt`));
    }
    const unregistered = [...new Set(texts.flatMap(findIdTokens))].filter(
      (token) => !isRegistered(registry, token),
    );
    expect(unregistered).toEqual([]);
  });

  it('seeds every stated place, zone, hazard and person of Books 4 and 5', () => {
    for (const id of [
      'ISLE_SKARV',
      'SITE_CARRICK',
      'HAZ_CAULDRON',
      'SK_WRECK_STRAND',
      'ZONE_SK_SEALCAVE',
      'REG_MAINLAND',
      'P_STEERER',
      'C_HILD',
      'E_ORM',
    ]) {
      expect(registry.byId.get(id)?.origin).toBe('stated');
    }
  });

  it('has an entry under every prefix the books give things for', () => {
    const used = new Set(registry.entries.map((e) => e.prefix));
    // VO_ has no entries: Book 11 names no individual voiced bark (only the VO_<stringKey> family).
    const expected = Object.keys(ID_PREFIXES).filter((p) => p !== 'VO');
    expect(expected.filter((p) => !used.has(p as keyof typeof ID_PREFIXES))).toEqual([]);
    expect(registry.families.some((f) => f.stem === 'VO_')).toBe(true);
  });

  it('lists the Book 6 deed tags exactly', () => {
    const table = bookSection(6, '01') ?? '';
    const start = table.indexOf('### Deed tags');
    const rows = table
      .slice(start)
      .split('\n')
      .filter((l) => l.startsWith('| `'));
    const written = rows.flatMap((r) => r.split('|')[1]?.match(/`([A-Z_]+)`/g) ?? []);
    expect(registry.deedTags.map((t) => `\`${t.tag}\``).sort()).toEqual(written.sort());
    expect(registry.deedTags.map((t) => t.tag)).toContain('SURRENDERED_KILLED');
  });
});

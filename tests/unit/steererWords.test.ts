/** Stage 6 check 3: no string addresses or describes the steerer with gendered terms (Book 8 section 03). */
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content/registry.ts';
import {
  genderedWordsIn,
  GENDERED_WORDS,
  steererWordingProblems,
} from '../../src/content/steererWords.ts';
import { readContentFiles } from '../../src/tools/content/loadContentFiles.ts';

const files = readContentFiles();

describe('the steerer wording lint', () => {
  it('holds every word Book 8 section 03 bans', () => {
    for (const word of [
      'he',
      'she',
      'him',
      'her',
      'his',
      'hers',
      'lad',
      'lass',
      'lord',
      'lady',
      'brother',
      'sister',
      'son',
      'daughter',
      'man',
      'woman',
      'sir',
      'madam',
      'king',
      'queen',
    ]) {
      expect(GENDERED_WORDS, word).toContain(word);
    }
  });

  it("finds whole words in any case, but not inside other words or in someone else's possessive", () => {
    expect(genderedWordsIn('Well done, lad.')).toEqual(['lad']);
    expect(genderedWordsIn("He's lost HIS nerve.")).toEqual(['his']);
    expect(genderedWordsIn('My Lord, the ships are ready.')).toEqual(['lord']);
    expect(genderedWordsIn('The shepherd sheltered them.')).toEqual([]);
    expect(genderedWordsIn("Thorkel's sister's child")).toEqual([]);
    expect(genderedWordsIn("{steerer}'s lost their nerve.")).toEqual([]);
  });

  it('flags a tagged string that uses one, and a string naming the steerer without a tag', () => {
    expect(steererWordingProblems('Well done, lad.', ['ADDRESS_STEERER'])).toHaveLength(1);
    expect(steererWordingProblems('She will lead us to ruin.', ['ABOUT_STEERER'])).toHaveLength(1);
    expect(steererWordingProblems('Well done, Steerer.', ['ADDRESS_STEERER'])).toEqual([]);
    expect(steererWordingProblems('{steerer} came back.', [])).toEqual([
      'names the steerer, so it needs an ADDRESS_STEERER or ABOUT_STEERER tag',
    ]);
    // Untagged lines about other people may use gendered words: Hild is Thorkel's daughter.
    expect(steererWordingProblems("Hild is Thorkel's daughter.", [])).toEqual([]);
  });

  it('passes on the real strings, and content lint rejects a deliberate violation', () => {
    expect(loadContent(files).issues).toEqual([]);
    const broken = structuredClone(files) as Record<string, unknown>;
    const strings = broken['strings'] as Record<string, { text: string; tags?: string[] }>;
    const found = strings['c_hild.bark.found.01'];
    if (found === undefined) throw new Error('missing c_hild.bark.found.01');
    found.text = '{steerer}! Up you get, lad.';
    strings['c_hild.bark.test.01'] = { text: 'Steady, {steerer}.' };
    const { issues } = loadContent(broken as typeof files);
    expect(issues).toEqual([
      {
        file: 'content/strings/en.json',
        path: 'c_hild.bark.found.01',
        reason: 'uses a gendered word for the steerer (lad); Book 8 section 03',
      },
      {
        file: 'content/strings/en.json',
        path: 'c_hild.bark.test.01',
        reason: 'names the steerer, so it needs an ADDRESS_STEERER or ABOUT_STEERER tag',
      },
    ]);
  });

  it('tags every line Hild says to the steerer in the opening', () => {
    const strings = files.strings as Record<string, { tags?: string[] }>;
    const lines = Object.keys(strings).filter((k) => k.startsWith('c_hild.bark.'));
    expect(lines.length).toBeGreaterThanOrEqual(6);
    for (const key of lines) expect(strings[key]?.tags, key).toContain('ADDRESS_STEERER');
  });
});

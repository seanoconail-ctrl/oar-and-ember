import { describe, expect, it } from 'vitest';
import {
  formatString,
  parseStringTable,
  STRING_KEY,
  stringVariables,
} from '../../src/content/strings.ts';
import { loadStrings } from '../../src/tools/art/loadTitleArt.ts';

describe('the string table (Book 8 section 10)', () => {
  const strings = loadStrings();

  it('has the keys the title and boot screens use', () => {
    for (const key of [
      'ui.title.name',
      'ui.title.build',
      'ui.title.screen_label',
      'ui.boot.webgl2_missing',
    ]) {
      expect(strings.has(key)).toBe(true);
    }
  });

  it('uses <speaker>.<context>.<id> keys', () => {
    for (const key of strings.keys()) expect(key).toMatch(STRING_KEY);
    expect('c_hild.bark.danger.03').toMatch(STRING_KEY);
    expect('title').not.toMatch(STRING_KEY);
  });

  it('fills variables and refuses missing ones', () => {
    expect(formatString(strings, 'ui.title.build', { build: '0.1.0+9d16de8' })).toBe(
      'Build 0.1.0+9d16de8',
    );
    expect(() => formatString(strings, 'ui.title.build')).toThrow(/\{build\}/);
    expect(() => formatString(strings, 'ui.nope.nope')).toThrow(/No string/);
    expect(stringVariables('Steer {ship} to {place}')).toEqual(['ship', 'place']);
  });

  it('rejects malformed tables', () => {
    expect(() => parseStringTable({ Title: { text: 'x' } }, 'f.json')).toThrow(/<speaker>/);
    expect(() => parseStringTable({ 'ui.a.b': { text: '' } }, 'f.json')).toThrow(/non-empty/);
    expect(() => parseStringTable({ 'ui.a.b': { text: 'x', tags: ['LOUD'] } }, 'f.json')).toThrow(
      /unknown tag/,
    );
  });
});

describe('captions (design addendum 2.3 section 10)', () => {
  it('tags every caption string SPEECH or INFO, and checks each kind', async () => {
    const { captionProblems } = await import('../../src/content/strings.ts');
    const entry = (text: string, tags: string[]) => ({ text, tags });
    expect(
      captionProblems('caption.format.subtitle', entry('{speaker}: {line}', ['SPEECH'])),
    ).toEqual([]);
    expect(captionProblems('caption.x.y', entry('Hild, calling', ['INFO']))).toEqual([]);
    expect(captionProblems('caption.x.y', entry('Surf breaking', []))).toHaveLength(1);
    expect(captionProblems('caption.x.y', entry('{line}', ['SPEECH']))).toHaveLength(1);
    expect(captionProblems('caption.x.y', entry('Music: drums', ['INFO']))).toHaveLength(1);
    expect(
      captionProblems(
        'caption.x.y',
        entry('A horn, far off to the north, again and again', ['INFO']),
      ),
    ).toHaveLength(1);
    expect(captionProblems('ui.x.y', entry('Anything: at all', []))).toEqual([]);
  });
});

describe('period speech (design addendum 2.3 section 2)', () => {
  it('finds modern moral words in dialogue and leaves interface text alone', async () => {
    const { isDialogueKey, modernMoralWordsIn } = await import('../../src/content/strings.ts');
    expect(modernMoralWordsIn('Those civilians had rights.')).toEqual(['rights', 'civilian']);
    expect(modernMoralWordsIn('He was innocent, and his kin will come.')).toEqual([]);
    expect(modernMoralWordsIn('A war  crime, they will call it.')).toEqual(['war crime']);
    expect(isDialogueKey('c_hild.bark.call.03')).toBe(true);
    expect(isDialogueKey('ui.household.values')).toBe(false);
  });
});

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

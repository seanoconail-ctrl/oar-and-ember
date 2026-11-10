import { describe, expect, it } from 'vitest';
import { ArtSourceError, parseArtSource, requireInt } from '../../src/render/artSource.ts';

describe('art source format', () => {
  it('reads headers and blocks, skipping comments and blank lines', () => {
    const source = parseArtSource(
      ['# a comment', 'sheet: test', 'rows: 2', '', 'glyph A', '#.', '.#', 'end'].join('\n'),
      'test.txt',
    );
    expect(source.header.get('sheet')?.value).toBe('test');
    expect(requireInt(source, 'rows')).toBe(2);
    expect(source.blocks).toEqual([{ kind: 'glyph', name: 'A', rows: ['#.', '.#'], line: 5 }]);
  });

  it.each([
    ['glyph A\n#.', 'test.txt:1: glyph "A" has no "end"'],
    ['glyph A\n#.\n\n.#\nend', 'test.txt:3: blank line inside glyph "A"'],
    ['glyph A\nend', 'test.txt:1: empty block'],
    ['rows: 1\nrows: 2', 'test.txt:2: duplicate header "rows"'],
    ['what is this', 'test.txt:1: cannot read line "what is this"'],
  ])('names the file, line and reason for a defect', (text, message) => {
    expect(() => parseArtSource(text, 'test.txt')).toThrow(message);
  });

  it('throws an ArtSourceError carrying file, line and reason', () => {
    try {
      parseArtSource('x', 'bad.txt');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ArtSourceError);
      expect(error).toMatchObject({ file: 'bad.txt', line: 1 });
    }
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { paletteIndex, parsePalette } from '../../src/render/palette.ts';
import { REPO_ROOT, TITLE_FILES } from '../../src/tools/art/loadTitleArt.ts';

const raw = JSON.parse(readFileSync(join(REPO_ROOT, TITLE_FILES.palette), 'utf8')) as unknown;
const book7 = readFileSync(join(REPO_ROOT, 'docs/07_ship_and_visual.md'), 'utf8');

describe('the Book 7 palette', () => {
  const palette = parsePalette(raw);

  it('holds the 24 colours of section 08 and the 4 blood reds of section 12', () => {
    // Book 7's 28 colours keep their places; the art-direction ramps follow (Book 7 section 14).
    expect(palette.entries).toHaveLength(254);
    expect(palette.entries.filter((e) => e.ramp === undefined)).toHaveLength(28);
    expect(palette.ramps.size).toBe(37);
    expect(palette.entries.filter((e) => e.group === 'blood')).toHaveLength(4);
  });

  it('matches the blood palette written in Book 7 section 12', () => {
    const line = book7.split('\n').find((l) => l.includes('| Blood palette |')) ?? '';
    const hexes = line.match(/#[0-9A-F]{6}/g) ?? [];
    expect(hexes).toHaveLength(4);
    const blood = palette.entries.filter((e) => e.group === 'blood').map((e) => e.hex);
    expect(blood).toEqual(hexes);
  });

  it('reserves exactly the four accents Book 7 section 08 names', () => {
    expect(palette.entries.filter((e) => e.reserved).map((e) => e.name)).toEqual([
      'Sea-light (Rán)',
      'Sídhe glamour',
      'Corpse-light',
      'Danger tell',
    ]);
  });

  it('decodes hex to RGB', () => {
    const ink = palette.entries[paletteIndex(palette, 'k')];
    expect(ink?.rgb).toEqual([0x22, 0x31, 0x3a]);
  });

  it('rejects bad entries with a reason', () => {
    const base = { name: 't', transparent: '.' };
    expect(() =>
      parsePalette({ ...base, entries: [{ code: 'a', name: 'x', hex: '#12345', group: 'g' }] }),
    ).toThrow(/hex/);
    expect(() =>
      parsePalette({
        ...base,
        entries: [
          { code: 'a', name: 'x', hex: '#123456', group: 'g' },
          { code: 'a', name: 'y', hex: '#654321', group: 'g' },
        ],
      }),
    ).toThrow(/duplicate code/);
    expect(() =>
      parsePalette({ ...base, entries: [{ code: '.', name: 'x', hex: '#123456', group: 'g' }] }),
    ).toThrow(/transparent/);
    expect(() => paletteIndex(palette, 'Z')).toThrow(/unknown code "Z"/);
  });
});

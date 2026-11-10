import { describe, expect, it } from 'vitest';
import { BUILD_ID_PATTERN } from '../../src/core/build.ts';
import {
  compileFont,
  drawText,
  getRamp,
  measureText,
  missingGlyphs,
  ROLE,
  scale2x,
  shadeMask,
} from '../../src/render/bitmapFont.ts';
import { createIndexedImage, NO_PIXEL } from '../../src/render/indexedImage.ts';
import { loadTitleArt } from '../../src/tools/art/loadTitleArt.ts';

const art = loadTitleArt();
const titleFont = art.fonts.get('font_title');
const smallFont = art.fonts.get('font_small');
if (titleFont === undefined || smallFont === undefined) throw new Error('fonts missing');

describe('Scale2x', () => {
  it('doubles a mask and rounds a diagonal step', () => {
    const out = scale2x([
      [true, false],
      [false, true],
    ]);
    expect(out).toHaveLength(4);
    expect(out[0]).toHaveLength(4);
    // The gap between the two diagonal pixels fills at the inner corners.
    expect(out[1]?.[2]).toBe(true);
    expect(out[2]?.[1]).toBe(true);
    // The outer corners stay empty.
    expect(out[0]?.[3]).toBe(false);
    expect(out[3]?.[0]).toBe(false);
  });

  it('leaves a solid block solid', () => {
    expect(scale2x([[true]])).toEqual([
      [true, true],
      [true, true],
    ]);
  });
});

describe('outline and shading (Book 7 section 11: ink outline, light from the upper left)', () => {
  const square = [
    [true, true, true],
    [true, true, true],
    [true, true, true],
  ];
  const at = (img: ReturnType<typeof shadeMask>, x: number, y: number) =>
    img.pixels[y * img.width + x];

  it('rings the body with a one-pixel outline', () => {
    const img = shadeMask(square, '4', 'upper-left');
    expect([img.width, img.height]).toEqual([5, 5]);
    expect(at(img, 2, 0)).toBe(ROLE.outline);
    expect(at(img, 0, 2)).toBe(ROLE.outline);
    // A 4-neighbour outline leaves the corners open; an 8-neighbour one closes them.
    expect(at(img, 0, 0)).toBe(NO_PIXEL);
    expect(at(shadeMask(square, '8', 'upper-left'), 0, 0)).toBe(ROLE.outline);
  });

  it('lights the top and left edges and shades the bottom and right', () => {
    const img = shadeMask(square, 'none', 'upper-left');
    expect(at(img, 1, 0)).toBe(ROLE.highlight);
    expect(at(img, 0, 1)).toBe(ROLE.highlight);
    expect(at(img, 1, 2)).toBe(ROLE.shadow);
    expect(at(img, 2, 1)).toBe(ROLE.shadow);
    expect(at(img, 1, 1)).toBe(ROLE.base);
  });
});

describe('font sources', () => {
  const header = [
    'sheet: t',
    'kind: font',
    'palette: book07',
    'rows: 2',
    'scale: 1',
    'outline: none',
    'shading: none',
    'space: 2',
    'ramp.one: w',
  ].join('\n');

  it('compiles a valid source', () => {
    const font = compileFont(`${header}\nglyph A\n##\n#.\nend\n`, 't.txt', art.palette);
    expect(font.glyphs.get('A')?.advance).toBe(3);
  });

  it.each([
    [`${header}\nglyph A\n#x\n#.\nend`, /t\.txt:11: column 2: "x"/],
    [`${header}\nglyph A\n##\nend`, /t\.txt:10: glyph "A" has 1 rows; the font has 2/],
    [`${header}\nglyph A\n##\n#\nend`, /t\.txt:12: row is 1 wide, not 2/],
    [header.replace('ramp.one: w', 'ramp.one: Z') + '\nglyph A\n##\n##\nend', /ramp code "Z"/],
    [header.replace('palette: book07', 'palette: other') + '\nglyph A\n##\n##\nend', /palette/],
  ])('rejects defects with file, line and reason', (text, message) => {
    expect(() => compileFont(text, 't.txt', art.palette)).toThrow(message);
  });
});

describe('the Stage 1 fonts', () => {
  it('the title lettering can draw the game name', () => {
    expect(missingGlyphs(titleFont, 'Oar and Ember')).toEqual([]);
  });

  it('the small lettering can draw "Build " and any build id', () => {
    const everyBuildChar = '0123456789.+abcdef';
    expect(missingGlyphs(smallFont, `Build ${everyBuildChar}`)).toEqual([]);
    for (const id of ['0.1.0+9d16de8', '12.30.7+abcdef0', '0.0.1+0000000']) {
      expect(id).toMatch(BUILD_ID_PATTERN);
      expect(missingGlyphs(smallFont, `Build ${id}`)).toEqual([]);
    }
  });

  it('every glyph of a font has the same height', () => {
    for (const font of [titleFont, smallFont]) {
      for (const glyph of font.glyphs.values()) expect(glyph.image.height).toBe(font.height);
    }
  });

  it('measureText agrees with what drawText covers', () => {
    for (const [font, text] of [
      [titleFont, 'Oar and Ember'],
      [smallFont, 'Build 0.1.0+9d16de8'],
    ] as const) {
      const img = createIndexedImage(800, font.height + 4);
      drawText(img, font, text, 2, 2, getRamp(font, [...font.ramps.keys()][0] ?? ''));
      let right = -1;
      let left = img.width;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          if (img.pixels[y * img.width + x] !== NO_PIXEL) {
            right = Math.max(right, x);
            left = Math.min(left, x);
          }
        }
      }
      expect(left).toBe(2);
      expect(right - left + 1).toBe(measureText(font, text));
    }
  });

  it('ramps use the ink outline and no reserved accent', () => {
    const ink = art.palette.indexOf.get('k');
    for (const font of [titleFont, smallFont]) {
      for (const ramp of font.ramps.values()) {
        for (const index of ramp) expect(art.palette.entries[index]?.reserved).toBe(false);
      }
    }
    for (const ramp of titleFont.ramps.values()) expect(ramp[ROLE.outline]).toBe(ink);
  });

  it('refuses text it has no glyph for', () => {
    const img = createIndexedImage(100, 40);
    expect(() => drawText(img, titleFont, 'Oz', 0, 0, getRamp(titleFont, 'wool'))).toThrow(
      /no glyph for "z"/,
    );
  });
});

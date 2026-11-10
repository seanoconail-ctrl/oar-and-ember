import { describe, expect, it } from 'vitest';
import { formatString } from '../../src/content/strings.ts';
import { ditherShowsNext, paintBands } from '../../src/render/backdrop.ts';
import { createIndexedImage, usedIndices } from '../../src/render/indexedImage.ts';
import { paletteIndex } from '../../src/render/palette.ts';
import { composeTitleFrame, parseTitleLayout, titleTextProblems } from '../../src/scenes/title.ts';
import { loadStrings, loadTitleArt } from '../../src/tools/art/loadTitleArt.ts';

const art = loadTitleArt();
const strings = loadStrings();
const text = {
  name: formatString(strings, 'ui.title.name'),
  buildLine: formatString(strings, 'ui.title.build', { build: '0.1.0+9d16de8' }),
};

describe('the title frame', () => {
  const frame = composeTitleFrame(art, text);
  const backdrop = new Set(art.layout.backdrop.map((b) => paletteIndex(art.palette, b.colour)));

  it('is 640 x 360 and reads "Oar and Ember" with the build line', () => {
    expect([frame.width, frame.height]).toEqual([640, 360]);
    expect(text.name).toBe('Oar and Ember');
    expect(text.buildLine).toBe('Build 0.1.0+9d16de8');
    expect(titleTextProblems(art, text)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(composeTitleFrame(art, text).pixels).toEqual(frame.pixels);
  });

  it('uses only palette colours and no reserved accent', () => {
    for (const index of usedIndices(frame)) {
      const entry = art.palette.entries[index];
      expect(entry).toBeDefined();
      expect(entry?.reserved).toBe(false);
    }
  });

  /** Columns and rows holding anything but backdrop, within rows [top, bottom). */
  function inkBox(top: number, bottom: number) {
    let left = 640;
    let right = -1;
    let first = 360;
    let last = -1;
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < 640; x++) {
        if (!backdrop.has(frame.pixels[y * 640 + x] ?? 0)) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          first = Math.min(first, y);
          last = Math.max(last, y);
        }
      }
    }
    return { left, right, first, last };
  }

  it('centres the name horizontally on the layout line', () => {
    const box = inkBox(0, 300);
    expect(Math.abs(box.left - (639 - box.right))).toBeLessThanOrEqual(1);
    expect(Math.abs((box.first + box.last) / 2 - art.layout.title.centreY)).toBeLessThanOrEqual(1);
    // Large enough to read as a title: at least a third of the frame wide.
    expect(box.right - box.left).toBeGreaterThan(640 / 3);
  });

  it('draws "Ember" in the hearth ramp and the rest in wool', () => {
    // Each ramp's shadow colour belongs to that ramp alone: shingle for wool, madder for hearth.
    const woolShadow = paletteIndex(art.palette, 's');
    const hearthShadow = paletteIndex(art.palette, 'r');
    const box = inkBox(0, 300);
    let woolRight = -1;
    let hearthLeft = 640;
    let hearthRight = -1;
    for (let y = box.first; y <= box.last; y++) {
      for (let x = box.left; x <= box.right; x++) {
        const v = frame.pixels[y * 640 + x];
        if (v === woolShadow) woolRight = Math.max(woolRight, x);
        if (v === hearthShadow) {
          hearthLeft = Math.min(hearthLeft, x);
          hearthRight = Math.max(hearthRight, x);
        }
      }
    }
    expect(woolRight).toBeGreaterThan(box.left);
    expect(woolRight).toBeLessThan(hearthLeft);
    expect(hearthRight).toBeGreaterThan(Math.floor((box.left + box.right) / 2));
  });

  it('puts the build line, centred, at the foot of the frame', () => {
    const box = inkBox(300, 360);
    expect(box.right).toBeGreaterThan(box.left);
    expect(Math.abs(box.left - (639 - box.right))).toBeLessThanOrEqual(1);
    expect(box.last).toBe(360 - art.layout.build.bottomMargin - 1);
    const muted = paletteIndex(art.palette, 'O');
    expect(frame.pixels[box.last * 640 + box.left]).toBe(muted);
  });

  it('refuses text the lettering cannot draw', () => {
    expect(() => composeTitleFrame(art, { ...text, name: 'Oar and Ember!' })).toThrow(
      /font_title lacks "!"/,
    );
  });
});

describe('backdrop bands (ordered dithering for sky and water)', () => {
  it('fills a single band', () => {
    const img = createIndexedImage(8, 4);
    paintBands(img, [{ index: 3 }]);
    expect(new Set(img.pixels)).toEqual(new Set([3]));
  });

  it('blends between bands with an ordered dither that grows row by row', () => {
    const img = createIndexedImage(16, 32);
    paintBands(img, [{ index: 1, toY: 16, blend: 8 }, { index: 2 }]);
    const counts = Array.from(
      { length: 32 },
      (_, y) =>
        Array.from({ length: 16 }, (_, x) => img.pixels[y * 16 + x]).filter((v) => v === 2).length,
    );
    expect(counts.slice(0, 12)).toEqual(new Array(12).fill(0));
    expect(counts.slice(20)).toEqual(new Array(12).fill(16));
    // Ordered dithering raises density over each 4-row Bayer cycle, not on every row.
    const sum = (from: number, to: number) => counts.slice(from, to).reduce((a, b) => a + b, 0);
    expect(sum(12, 16)).toBeLessThan(sum(16, 20));
    expect(sum(12, 20)).toBe(64);
    expect(ditherShowsNext(0, 0, 0)).toBe(false);
    expect(ditherShowsNext(3, 3, 1)).toBe(true);
  });

  it('rejects layouts whose bands do not run down the frame', () => {
    expect(() =>
      parseTitleLayout(
        {
          palette: 'book07',
          letterbox: 'k',
          backdrop: [{ colour: 'k', toY: 100 }, { colour: 'N', toY: 50 }, { colour: 'D' }],
          title: { font: 'f', wordRamps: ['a'], centreY: 1 },
          build: { font: 'f', ramp: 'a', bottomMargin: 1 },
        },
        'layout.json',
      ),
    ).toThrow(/down the frame/);
  });
});

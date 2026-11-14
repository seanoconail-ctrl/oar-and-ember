/**
 * Render-to-image check for Stage 1 art (Book 2 section 19): writes the title frame and every
 * glyph of both fonts at 1x and 4x to artifacts/ so they can be inspected.
 *
 *   npm run art:check [-- <build id>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatString } from '../../content/strings.ts';
import { drawText, measureText } from '../../render/bitmapFont.ts';
import type { BitmapFont } from '../../render/bitmapFont.ts';
import { createIndexedImage, toRgba } from '../../render/indexedImage.ts';
import type { IndexedImage } from '../../render/indexedImage.ts';
import { paletteIndex } from '../../render/palette.ts';
import { composeTitleFrame } from '../../scenes/title.ts';
import { loadStrings, loadTitleArt, REPO_ROOT } from './loadTitleArt.ts';
import { encodePng, scaleNearest } from './png.ts';

const buildId = process.argv[2] ?? '0.1.0+0123abc';
const art = loadTitleArt();
const strings = loadStrings();
const outDir = join(REPO_ROOT, 'artifacts');
mkdirSync(outDir, { recursive: true });

function write(name: string, image: IndexedImage): void {
  const rgba = { width: image.width, height: image.height, data: toRgba(image, art.palette) };
  for (const factor of [1, 4]) {
    const file = join(outDir, `${name}-${factor}x.png`);
    writeFileSync(file, encodePng(scaleNearest(rgba, factor)));
    console.log(`wrote ${file}`);
  }
}

/** Every glyph of a font, in every ramp, on the title background. */
function fontSheet(font: BitmapFont): IndexedImage {
  const chars = [...font.glyphs.keys()].join('');
  const pad = 4;
  const ramps = [...font.ramps.entries()];
  const width = measureText(font, chars) + pad * 2;
  const height = (font.height + pad) * ramps.length + pad;
  const sheet = createIndexedImage(width, height, paletteIndex(art.palette, 'N'));
  ramps.forEach(([, ramp], i) =>
    drawText(sheet, font, chars, pad, pad + i * (font.height + pad), ramp),
  );
  return sheet;
}

const frame = composeTitleFrame(art, {
  name: formatString(strings, 'ui.title.name'),
  buildLine: formatString(strings, 'ui.title.build', { build: buildId }),
});
write('title', frame);
for (const font of art.fonts.values()) write(font.name, fontSheet(font));

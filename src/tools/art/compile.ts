/**
 * The art compiler (Book 2 section 19): compiles every sheet in assets/art/sheets, packs it into
 * an atlas and writes assets/atlases/<sheet>.png and <sheet>.json.   npm run art:compile
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packSheet } from '../../render/atlas.ts';
import { toRgba } from '../../render/indexedImage.ts';
import { ATLAS_DIR, loadPalette, loadSheets } from './artFiles.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { encodePng } from './png.ts';

/** The atlas files the compiler would write, by repository path. */
export function compiledAtlases(): Map<string, Buffer | string> {
  const palette = loadPalette();
  const out = new Map<string, Buffer | string>();
  for (const sheet of loadSheets(palette)) {
    const { image, manifest } = packSheet(sheet);
    out.set(
      `${ATLAS_DIR}/${manifest.image}`,
      encodePng({ width: image.width, height: image.height, data: toRgba(image, palette) }),
    );
    out.set(`${ATLAS_DIR}/${sheet.name}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return out;
}

if (import.meta.filename === process.argv[1]) {
  for (const [path, data] of compiledAtlases()) {
    writeFileSync(join(REPO_ROOT, path), data);
    console.log(`wrote ${path}`);
  }
}

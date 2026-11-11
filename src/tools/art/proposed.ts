/**
 * Proposed art, staged for the user's approval before it replaces the game's (Book 3: a new or
 * redrawn character starts with rendered sheets and a GIF). Nothing here is read by the game.
 *
 *   node src/tools/art/proposed.ts
 *
 * - assets/art/proposed/maps/*.map.txt   material maps, generated to sheets as the game's are
 * - assets/art/proposed/sheets/*.txt      sheets (generated, or drawn directly)
 * - assets/art/proposed/atlases/          compiled atlases (png + json), for the preview renders
 * - assets/art/proposed/*.layers.json     a character's layer sheets and draw order per facing:
 *     { "name": "steerer_a", "layers": { "s": ["layer_cloak_..._a", "actor_p_steerer_a", ...],
 *       "n": [...], "e": [...], "w": [...] } }   first is drawn first (furthest back)
 * - docs/art/stage-06-rework/sheets/      every sheet's frames at 1x and 4x, and each character's
 *                                          layers composited, on a sand-coloured ground
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packSheet } from '../../render/atlas.ts';
import { NO_PIXEL, toRgba } from '../../render/indexedImage.ts';
import { compileSheet } from '../../render/sheet.ts';
import type { Sheet } from '../../render/sheet.ts';
import { loadPalette } from './artFiles.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { generateSheet } from './materials.ts';
import { encodePng } from './png.ts';
import type { RgbaImage } from './png.ts';

export const PROPOSED = 'assets/art/proposed';
const OUT = 'docs/art/stage-06-rework/sheets';
/** The ground behind the contact sheets: the strand's dry sand. */
const GROUND = [196, 176, 138];

function files(dir: string, suffix: string): string[] {
  const full = join(REPO_ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => `${dir}/${f}`);
}

function read(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

function write(path: string, data: string | Buffer): void {
  const full = join(REPO_ROOT, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, data);
}

/** Every proposed sheet, after generating maps. */
export function proposedSheets(): Sheet[] {
  const palette = loadPalette();
  for (const file of files(`${PROPOSED}/maps`, '.map.txt')) {
    const name = /^sheet: (\S+)$/m.exec(read(file))?.[1];
    if (name === undefined) throw new Error(`${file}: no "sheet:" header`);
    write(`${PROPOSED}/sheets/${name}.txt`, generateSheet(read(file), file, palette));
  }
  return files(`${PROPOSED}/sheets`, '.txt').map((f) => compileSheet(read(f), f, palette));
}

function scaled(img: RgbaImage, k: number): RgbaImage {
  const data = new Uint8Array(img.width * k * img.height * k * 4);
  for (let y = 0; y < img.height * k; y++)
    for (let x = 0; x < img.width * k; x++)
      for (let c = 0; c < 4; c++)
        data[(y * img.width * k + x) * 4 + c] =
          img.data[(Math.floor(y / k) * img.width + Math.floor(x / k)) * 4 + c] ?? 0;
  return { width: img.width * k, height: img.height * k, data };
}

/** A grid of frames (rows of keys) drawn over the ground, 2 px apart. */
function contact(
  rows: readonly (readonly string[])[],
  w: number,
  h: number,
  draw: (key: string, put: (x: number, y: number, rgba: ArrayLike<number>) => void) => void,
): RgbaImage {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const width = cols * (w + 2) + 2;
  const height = rows.length * (h + 2) + 2;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...GROUND, 255], i * 4);
  rows.forEach((row, j) => {
    row.forEach((key, i) => {
      const ox = 2 + i * (w + 2);
      const oy = 2 + j * (h + 2);
      draw(key, (x, y, rgba) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const at = ((oy + y) * width + ox + x) * 4;
        const a = (rgba[3] ?? 255) / 255;
        for (let c = 0; c < 3; c++)
          data[at + c] = Math.round((data[at + c] ?? 0) * (1 - a) + (rgba[c] ?? 0) * a);
      });
    });
  });
  return { width, height, data };
}

function frameRows(sheet: Sheet): string[][] {
  const rows: string[][] = [];
  for (const [state, anim] of Object.entries(sheet.anims))
    for (const facing of sheet.facings)
      rows.push(Array.from({ length: anim.frames }, (_, i) => `${state}/${facing}/${i}`));
  return rows;
}

if (import.meta.filename === process.argv[1]) {
  const palette = loadPalette();
  const sheets = proposedSheets();
  const byName = new Map(sheets.map((s) => [s.name, s]));
  const rgbaOf = (sheet: Sheet, key: string): Uint8Array | null => {
    const img = sheet.frames.get(key);
    return img === undefined ? null : toRgba(img, palette);
  };
  for (const sheet of sheets) {
    const { image, manifest } = packSheet(sheet);
    write(
      `${PROPOSED}/atlases/${manifest.image}`,
      encodePng({ width: image.width, height: image.height, data: toRgba(image, palette) }),
    );
    write(`${PROPOSED}/atlases/${sheet.name}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
    const img = contact(frameRows(sheet), sheet.width, sheet.height, (key, put) => {
      const px = rgbaOf(sheet, key);
      const raw = sheet.frames.get(key);
      if (px === null || raw === undefined) return;
      for (let i = 0; i < raw.pixels.length; i++)
        if ((raw.pixels[i] ?? NO_PIXEL) !== NO_PIXEL)
          put(i % sheet.width, Math.floor(i / sheet.width), px.subarray(i * 4, i * 4 + 4));
    });
    write(`${OUT}/${sheet.name}.png`, encodePng(img));
    write(`${OUT}/${sheet.name}@4x.png`, encodePng(scaled(img, 4)));
    console.log(`${sheet.name}: ${sheet.frames.size} frames`);
  }
  // Each character's layers composited in draw order.
  for (const file of files(PROPOSED, '.layers.json')) {
    const def = JSON.parse(read(file)) as {
      name: string;
      layers: Record<string, string[]>;
    };
    const firstName = Object.values(def.layers)[0]?.[0];
    const first = firstName === undefined ? undefined : byName.get(firstName);
    if (first === undefined) throw new Error(`${file}: no first layer sheet`);
    const rows = frameRows(first);
    const img = contact(rows, first.width, first.height, (key, put) => {
      const facing = key.split('/')[1] ?? 's';
      for (const name of def.layers[facing] ?? []) {
        const sheet = byName.get(name);
        if (sheet === undefined) throw new Error(`${file}: no sheet ${name}`);
        const raw = sheet.frames.get(key);
        const px = rgbaOf(sheet, key);
        if (raw === undefined || px === null) continue;
        // Layers share the body's anchor; a larger layer canvas is centred on it.
        const dx = first.pivot.x - sheet.pivot.x;
        const dy = first.pivot.y - sheet.pivot.y;
        for (let i = 0; i < raw.pixels.length; i++)
          if ((raw.pixels[i] ?? NO_PIXEL) !== NO_PIXEL)
            put(
              (i % sheet.width) + dx,
              Math.floor(i / sheet.width) + dy,
              px.subarray(i * 4, i * 4 + 4),
            );
      }
    });
    write(`${OUT}/composite_${def.name}.png`, encodePng(img));
    write(`${OUT}/composite_${def.name}@4x.png`, encodePng(scaled(img, 4)));
    console.log(`composite ${def.name}`);
  }
}

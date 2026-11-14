/** Where art sources, generated sheets and compiled atlases live. Node only. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePalette } from '../../render/palette.ts';
import type { Palette } from '../../render/palette.ts';
import { compileSheet } from '../../render/sheet.ts';
import type { Sheet } from '../../render/sheet.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { peopleLook } from '../../scenes/people.ts';
import type { PeopleLook } from '../../scenes/people.ts';

export const MAPS_DIR = 'assets/art/maps';
export const SHEETS_DIR = 'assets/art/sheets';
export const ATLAS_DIR = 'assets/atlases';
export const LAYERS_DIR = 'assets/art/layers';

export function readRepo(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

export function listFiles(dir: string, suffix: string): string[] {
  return readdirSync(join(REPO_ROOT, dir))
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => `${dir}/${f}`);
}

export function loadPalette(): Palette {
  return parsePalette(JSON.parse(readRepo('assets/palette/book07.json')) as unknown);
}

/** Every sheet in assets/art/sheets, compiled. */
export function loadSheets(palette: Palette = loadPalette()): Sheet[] {
  return listFiles(SHEETS_DIR, '.txt').map((file) => compileSheet(readRepo(file), file, palette));
}

/** Every person's layer sheets and draw order per facing (assets/art/layers/*.layers.json). */
export function loadLayerDefs(): { name: string; layers: Record<string, string[]> }[] {
  return listFiles(LAYERS_DIR, '.layers.json').map(
    (file) => JSON.parse(readRepo(file)) as { name: string; layers: Record<string, string[]> },
  );
}

/** The look of the steerer (body model A or B) and Hild, from the layer files on disk. */
export function loadPeopleLook(bodyModel: 'A' | 'B'): PeopleLook {
  return peopleLook(new Map(loadLayerDefs().map((f) => [f.name, f])), bodyModel);
}

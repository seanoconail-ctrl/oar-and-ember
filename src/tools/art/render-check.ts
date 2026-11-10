/**
 * Render-to-image check (Book 2 section 19): every sheet's preview and the Stage 4 test scenes,
 * drawn by the CPU reference renderer at 1x and 4x into artifacts/ for inspection.
 *
 *   npm run art:check     (also renders the title screen and fonts)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packSheet } from '../../render/atlas.ts';
import { renderSceneCpu } from '../../render/cpuRenderer.ts';
import { parseRenderStyle } from '../../render/scene.ts';
import type { RenderStyle } from '../../render/scene.ts';
import type { Sheet } from '../../render/sheet.ts';
import { ART_TEST_CASES, artTestScene, sheetPreviewScene } from '../../scenes/artTest.ts';
import { loadPalette, loadSheets, readRepo } from './artFiles.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { encodePng, scaleNearest } from './png.ts';

export function loadRenderStyle(): RenderStyle {
  return parseRenderStyle(JSON.parse(readRepo('assets/art/render.json')) as unknown);
}

/** The width and height of a sheet's preview: its atlas plus an 8-pixel margin. */
export function previewSize(sheet: Sheet): { width: number; height: number } {
  const { image } = packSheet(sheet);
  return { width: image.width + 16, height: image.height + 16 };
}

if (import.meta.filename === process.argv[1]) {
  const palette = loadPalette();
  const style = loadRenderStyle();
  const sheets = new Map(loadSheets(palette).map((s) => [s.name, s]));
  const out = join(REPO_ROOT, 'artifacts');
  mkdirSync(out, { recursive: true });
  const write = (name: string, width: number, height: number, data: Uint8Array): void => {
    for (const factor of [1, 4]) {
      const file = join(out, `${name}-${factor}x.png`);
      writeFileSync(file, encodePng(scaleNearest({ width, height, data }, factor)));
      console.log(`wrote ${file}`);
    }
  };
  for (const sheet of sheets.values()) {
    const { manifest } = packSheet(sheet);
    const { width, height } = previewSize(sheet);
    write(
      `sheet-${sheet.name}`,
      width,
      height,
      renderSceneCpu(
        sheetPreviewScene(sheet.name, sheet, manifest.frames),
        sheets,
        palette,
        style,
        width,
        height,
      ),
    );
  }
  for (const which of ART_TEST_CASES) {
    write(`scene-${which}`, 640, 360, renderSceneCpu(artTestScene(which), sheets, palette, style));
  }
}

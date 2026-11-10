/**
 * Stage 4 acceptance checks in the browser: the WebGL renderer draws the test scenes as the CPU
 * reference does (depth sorting, cutaway, lighting), pixel snapping holds at 1x, 2x and 3x, and
 * a sheet compiled from source renders identically to its preview image.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { packSheet } from '../../src/render/atlas.ts';
import { renderSceneCpu } from '../../src/render/cpuRenderer.ts';
import { computeViewport } from '../../src/render/viewport.ts';
import { ART_TEST_CASES, artTestScene, sheetPreviewScene } from '../../src/scenes/artTest.ts';
import { loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadRenderStyle, previewSize } from '../../src/tools/art/render-check.ts';
import { decodePng } from '../../src/tools/art/png.ts';

const palette = loadPalette();
const style = loadRenderStyle();
const sheets = new Map(loadSheets(palette).map((s) => [s.name, s]));

async function open(
  page: Page,
  query: string,
  width: number,
  height: number,
): Promise<ReturnType<typeof decodePng>> {
  await page.setViewportSize({ width, height });
  await page.goto(`./?${query}`);
  const canvas = page.locator('canvas#screen');
  try {
    await expect(canvas).toHaveAttribute('data-state', 'art', { timeout: 15_000 });
  } catch (cause) {
    const where = await canvas.evaluate((c: HTMLElement) =>
      Object.fromEntries(Object.entries(c.dataset)),
    );
    throw new Error(`art view not shown: ${JSON.stringify(where)}`, { cause });
  }
  return decodePng(await page.screenshot());
}

/**
 * Compares a screenshot with a logical frame scaled by the viewport's whole number. `tolerance`
 * allows for floating-point rounding in the light arithmetic. Returns the count of differing pixels.
 */
function compare(
  shot: ReturnType<typeof decodePng>,
  frame: Uint8Array,
  frameWidth: number,
  frameHeight: number,
  tolerance: number,
): { mismatched: number; first: string; blocksUniform: boolean } {
  const vp = computeViewport(shot.width, shot.height);
  let mismatched = 0;
  let first = '';
  let blocksUniform = true;
  for (let fy = 0; fy < frameHeight; fy++) {
    for (let fx = 0; fx < frameWidth; fx++) {
      const e = (fy * 640 + fx) * 4;
      for (let dy = 0; dy < vp.scale; dy++) {
        for (let dx = 0; dx < vp.scale; dx++) {
          const sx = vp.x + fx * vp.scale + dx;
          const sy = vp.y + fy * vp.scale + dy;
          const s = (sy * shot.width + sx) * 4;
          const diff = [0, 1, 2].map((c) =>
            Math.abs((shot.data[s + c] ?? 0) - (frame[e + c] ?? 0)),
          );
          if (diff.some((d) => d > tolerance)) {
            if (mismatched === 0) first = `(${fx}, ${fy}) diff ${diff.join(',')}`;
            mismatched++;
          }
          const corner = ((vp.y + fy * vp.scale) * shot.width + vp.x + fx * vp.scale) * 4;
          if ([0, 1, 2].some((c) => shot.data[s + c] !== shot.data[corner + c]))
            blocksUniform = false;
        }
      }
    }
  }
  return { mismatched, first, blocksUniform };
}

for (const which of ART_TEST_CASES) {
  test(`the WebGL renderer draws the "${which}" test scene as the CPU reference does`, async ({
    page,
  }) => {
    const shot = await open(page, `view=art-test&case=${which}`, 1280, 720);
    const reference = renderSceneCpu(artTestScene(which), sheets, palette, style);
    const result = compare(
      shot,
      reference,
      640,
      360,
      which === 'front' || which === 'behind' ? 0 : 2,
    );
    expect(result.mismatched, `first difference ${result.first}`).toBe(0);
    expect(result.blocksUniform).toBe(true);
  });
}

for (const [width, height] of [
  [640, 360],
  [1280, 720],
  [1920, 1080],
] as const) {
  test(`pixel snapping holds at ${width / 640}x: every logical pixel is one exact block`, async ({
    page,
  }) => {
    const shot = await open(page, 'view=art-test&case=front', width, height);
    const reference = renderSceneCpu(artTestScene('front'), sheets, palette, style);
    const result = compare(shot, reference, 640, 360, 0);
    expect(result.mismatched, `first difference ${result.first}`).toBe(0);
    expect(result.blocksUniform).toBe(true);
  });
}

test('a sheet compiled from source renders identically to its preview image', async ({ page }) => {
  const sheet = sheets.get('actor_p_steerer_a');
  if (sheet === undefined) throw new Error('steerer sheet missing');
  const { manifest } = packSheet(sheet);
  const { width, height } = previewSize(sheet);
  const preview = renderSceneCpu(
    sheetPreviewScene(sheet.name, sheet, manifest.frames),
    sheets,
    palette,
    style,
    width,
    height,
  );
  // Lay the preview into a 640-wide frame so it lines up with the screenshot.
  const frame = new Uint8Array(640 * 360 * 4);
  for (let y = 0; y < height; y++)
    frame.set(preview.subarray(y * width * 4, (y + 1) * width * 4), y * 640 * 4);
  const shot = await open(page, 'view=sheet&sheet=actor_p_steerer_a', 1280, 720);
  const result = compare(shot, frame, width, height, 0);
  expect(result.mismatched, `first difference ${result.first}`).toBe(0);
});

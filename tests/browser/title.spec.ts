/**
 * Stage 1 acceptance check 2: the title screen appears in Chromium, Firefox and WebKit (Safari's
 * engine), drawn at a whole-number scale with letterbox bars, pixel for pixel as composed.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { formatString } from '../../src/content/strings.ts';
import { toRgba } from '../../src/render/indexedImage.ts';
import { paletteIndex } from '../../src/render/palette.ts';
import { computeViewport, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../src/render/viewport.ts';
import { composeTitleFrame } from '../../src/scenes/title.ts';
import { loadStrings, loadTitleArt } from '../../src/tools/art/loadTitleArt.ts';
import { decodePng } from '../../src/tools/art/png.ts';

const BUILD_ID = /^\d+\.\d+\.\d+\+[0-9a-f]{7}$/;
/** Largest per-channel difference accepted, for colour handling between browsers. */
const TOLERANCE = 3;

const art = loadTitleArt();
const strings = loadStrings();

async function openTitle(page: Page): Promise<string> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  const canvas = page.locator('canvas#screen');
  await expect(canvas).toHaveAttribute('data-state', 'title', { timeout: 15_000 });
  expect(errors).toEqual([]);
  const build = (await canvas.getAttribute('data-build')) ?? '';
  expect(build).toMatch(BUILD_ID);
  return build;
}

const SIZES = [
  { label: 'exact fit at 2x', width: 1280, height: 720 },
  { label: 'letterboxed at 2x', width: 1500, height: 900 },
  { label: 'letterboxed at 1x', width: 900, height: 500 },
] as const;

for (const size of SIZES) {
  test(`title screen matches the composed frame, ${size.label}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const build = await openTitle(page);

    const name = formatString(strings, 'ui.title.name');
    await expect(page).toHaveTitle(name);
    await expect(page.locator('canvas#screen')).toHaveAttribute(
      'aria-label',
      formatString(strings, 'ui.title.screen_label', { build }),
    );

    const frame = toRgba(
      composeTitleFrame(art, {
        name,
        buildLine: formatString(strings, 'ui.title.build', { build }),
      }),
      art.palette,
    );
    const letterbox = art.palette.entries[paletteIndex(art.palette, art.layout.letterbox)]?.rgb;
    if (letterbox === undefined) throw new Error('letterbox colour missing');

    const shot = decodePng(await page.screenshot());
    const vp = computeViewport(shot.width, shot.height);
    expect(vp.scale).toBe(
      Math.min(Math.floor(size.width / LOGICAL_WIDTH), Math.floor(size.height / LOGICAL_HEIGHT)),
    );

    let mismatched = 0;
    let firstMismatch = '';
    for (let y = 0; y < shot.height; y++) {
      for (let x = 0; x < shot.width; x++) {
        const fx = Math.floor((x - vp.x) / vp.scale);
        const fy = Math.floor((y - vp.y) / vp.scale);
        const inFrame = x >= vp.x && y >= vp.y && fx < LOGICAL_WIDTH && fy < LOGICAL_HEIGHT;
        const e = (fy * LOGICAL_WIDTH + fx) * 4;
        const expected = inFrame
          ? [frame[e] ?? 0, frame[e + 1] ?? 0, frame[e + 2] ?? 0]
          : [letterbox[0], letterbox[1], letterbox[2]];
        const s = (y * shot.width + x) * 4;
        const actual = [shot.data[s] ?? 0, shot.data[s + 1] ?? 0, shot.data[s + 2] ?? 0];
        if (expected.some((v, c) => Math.abs(v - (actual[c] ?? 0)) > TOLERANCE)) {
          if (mismatched === 0) {
            firstMismatch = `(${x}, ${y}) expected ${expected.join(',')} got ${actual.join(',')}`;
          }
          mismatched++;
        }
      }
    }
    expect(mismatched, `pixels differing from the composed frame; first at ${firstMismatch}`).toBe(
      0,
    );
  });
}

test('without WebGL2 the page explains why in words', async ({ page }) => {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype;
    // A browser without WebGL2: getContext('webgl2') answers null; other contexts still work.
    proto.getContext = new Proxy(
      // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied below with the canvas as `this`
      proto.getContext,
      {
        apply(target, thisArg, args: unknown[]) {
          return args[0] === 'webgl2' ? null : (Reflect.apply(target, thisArg, args) as unknown);
        },
      },
    );
  });
  await page.goto('./');
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'no-webgl2');
  await expect(page.locator('#notice')).toHaveText(formatString(strings, 'ui.boot.webgl2_missing'));
});

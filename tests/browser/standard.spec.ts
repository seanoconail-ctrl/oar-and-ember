/**
 * The Book 7 standard in the browser (section 14): with the camera still on Wreck Strand, enough
 * of the screen keeps moving (water, wind, life, light), measured as the approved mockup was
 * (src/tools/art/motion.ts); reduced motion calms it but leaves the world alive; and the script's
 * share of each frame stays within the Book 2 budget.
 *
 * Measured in Chromium only: the renderer's output is the same in every browser (art.spec.ts),
 * and this check is about the art, not the browser.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  MOTION_THRESHOLD,
  REDUCED_MOTION_THRESHOLD,
  continuousMotion,
} from '../../src/tools/art/motion.ts';
import { decodePng } from '../../src/tools/art/png.ts';

/** Script time per frame allowed in the browser, ms (a third of a 60 fps frame). */
const FRAME_SCRIPT_MS = 5.5;

async function standStill(page: Page, query: string): Promise<void> {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`./${query}`);
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'title', {
    timeout: 15_000,
  });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ash');
  await page.locator('.oe-naming input').press('Enter');
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play');
  // Captions and prompts are interface, not the world: hide them for the measure.
  await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  await page.waitForTimeout(2500);
}

async function still(page: Page, frames: number): Promise<number> {
  const shots: Uint8Array[] = [];
  for (let i = 0; i < frames; i++) {
    shots.push(decodePng(await page.screenshot()).data);
    await page.waitForTimeout(120);
  }
  return continuousMotion(shots, 640, 360).share;
}

test.describe('the Book 7 standard on Wreck Strand', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'measured in Chromium');
  test.setTimeout(120_000);

  test(`with the camera still, at least ${MOTION_THRESHOLD * 100}% of the screen keeps moving`, async ({
    page,
  }) => {
    await standStill(page, '');
    const share = await still(page, 33);
    console.log(`continuous motion: ${(share * 100).toFixed(1)}%`);
    expect(share).toBeGreaterThanOrEqual(MOTION_THRESHOLD);
    const ms = Number(await page.locator('.oe-overlay').getAttribute('data-frame-ms'));
    console.log(`script per frame: ${ms.toFixed(2)} ms`);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(FRAME_SCRIPT_MS);
  });

  test('with reduced motion the world still moves, and the setting is honoured', async ({
    page,
  }) => {
    await standStill(page, '?motion=reduced');
    await expect(page.locator('.oe-overlay')).toHaveAttribute('data-motion', 'reduced');
    const share = await still(page, 25);
    console.log(`continuous motion, reduced: ${(share * 100).toFixed(1)}%`);
    expect(share).toBeGreaterThanOrEqual(REDUCED_MOTION_THRESHOLD);
  });
});

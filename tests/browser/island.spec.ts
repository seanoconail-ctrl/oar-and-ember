/**
 * Stage 14, work package A (decisions S14-30 to S14-49): each of the island's new scenes loads in
 * the browser (`?zone=`), the steerer in it, with no error; and, measured in Chromium as the
 * strand's standard is (tests/browser/standard.spec.ts), with the camera still at least 80% of the
 * screen keeps moving (Book 7 section 14): heather and grass in the wind, water, birds, the
 * passages' haze and the light off water.
 */
import { expect, test } from '@playwright/test';
import { MOTION_THRESHOLD, continuousMotion } from '../../src/tools/art/motion.ts';
import { decodePng } from '../../src/tools/art/png.ts';

/** Each new scene, and where the steerer stands in it (tiles). */
const ZONES: readonly (readonly [string, number, number])[] = [
  ['ZONE_SK_GEO', 64, 40],
  ['ZONE_SK_CLIFFS', 50, 14],
  ['ZONE_SK_ROOK', 48, 92],
  ['ZONE_SK_BOG', 40, 96],
  ['ZONE_SK_NAUST', 60, 18],
  ['ZONE_SK_SKERRY', 30, 62],
  ['ZONE_SK_SEALCAVE_DEEP', 28, 10],
  ['ZONE_SK_CAIRN_IN', 30, 14],
];

test.describe('the whole island: each new zone', () => {
  // Each zone draws thousands of swaying plants; with the other tests beside it in a software
  // renderer a run can take over two minutes.
  test.setTimeout(300_000);
  for (const [zone, x, y] of ZONES) {
    test(`${zone} loads with ?zone= and keeps at least ${MOTION_THRESHOLD * 100}% of the screen moving`, async ({
      page,
      browserName,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewportSize({ width: 640, height: 360 });
      await page.goto(
        `./?view=play&name=Ash&body=A&quality=full&camp=broch&crew=1&time=14:00&zone=${zone}&at=${x},${y}`,
      );
      await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
        timeout: 20_000,
      });
      await expect(page.locator('.oe-overlay')).toHaveAttribute('data-zone', zone);
      expect(errors).toEqual([]);
      test.skip(browserName !== 'chromium', 'motion is measured in Chromium, as the strand is');
      await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
      await page.waitForTimeout(3000);
      const shots: Uint8Array[] = [];
      for (let i = 0; i < 33; i++) {
        shots.push(decodePng(await page.screenshot()).data);
        await page.waitForTimeout(120);
      }
      const share = continuousMotion(shots, 640, 360).share;
      console.log(`continuous motion in ${zone}: ${(share * 100).toFixed(1)}%`);
      expect(share).toBeGreaterThanOrEqual(MOTION_THRESHOLD);
    });
  }
});

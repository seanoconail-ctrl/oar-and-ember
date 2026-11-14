/**
 * Stage 13, work package C (Book 6 section 19; Book 9 section 15; decisions S13-40 to S13-59): the
 * wreck on Sgeir Dhubh in the browser. The scene loads standalone (`wreck=1`: the household home,
 * a voyage to Carrick handed off to the wreck, src/scenes/seaWreck.ts): the reef is the zone in
 * view, the steerer on foot beside the boat; and, measured in Chromium as the strand's standard
 * is (tests/browser/standard.spec.ts), with the camera still at least 80% of the screen keeps
 * moving (the sea, the surf, spray, kelp, the boat afloat, the survivors shivering, the gulls).
 */
import { expect, test } from '@playwright/test';
import { MOTION_THRESHOLD, continuousMotion } from '../../src/tools/art/motion.ts';
import { decodePng } from '../../src/tools/art/png.ts';
import { attr, startPlay, step } from './strand.ts';

const WRECK = 'capture&camp=broch&crew=1&wreck=1&time=14:00';

test.describe('the wreck on Sgeir Dhubh', () => {
  test.setTimeout(120_000);

  test('the wreck scene loads standalone: the reef in view, the steerer ashore by the boat', async ({
    page,
  }) => {
    await startPlay(page, 'A', WRECK);
    await step(page, 3);
    expect(await attr(page, 'zone')).toBe('ZONE_SEA_WRECK');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await step(page, 10);
    expect(errors).toEqual([]);
    expect(await attr(page, 'zone')).toBe('ZONE_SEA_WRECK');
  });

  test(`with the camera still at the wreck, at least ${MOTION_THRESHOLD * 100}% of the screen keeps moving`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'measured in Chromium, as the strand is');
    await page.setViewportSize({ width: 640, height: 360 });
    await page.goto(
      './?view=play&name=Ash&body=A&quality=full&camp=broch&crew=1&wreck=1&time=14:00&at=16.5,18.6',
    );
    await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
      timeout: 15_000,
    });
    await expect(page.locator('.oe-overlay')).toHaveAttribute('data-zone', 'ZONE_SEA_WRECK');
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: test.info().outputPath('wreck.png') });
    await page.waitForTimeout(2500);
    const shots: Uint8Array[] = [];
    for (let i = 0; i < 33; i++) {
      shots.push(decodePng(await page.screenshot()).data);
      await page.waitForTimeout(120);
    }
    const share = continuousMotion(shots, 640, 360).share;
    console.log(`continuous motion at the wreck: ${(share * 100).toFixed(1)}%`);
    expect(share).toBeGreaterThanOrEqual(MOTION_THRESHOLD);
  });
});

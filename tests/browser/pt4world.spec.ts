/**
 * The user's fourth playtest's world and art in the browser (requests 15, 23, 24, 26; DH-100 to
 * DH-127): the reworked broch's interior keeps Book 7's 80% of the screen moving with the camera
 * still, by day and by night, before and after the shelter is finished; standing on the steerer's
 * bed after 18:00 shows the sleep prompt and a press sleeps; and a find shows its prompt and, used,
 * its story caption. Measured in Chromium only (the art is the same in every browser).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MOTION_THRESHOLD, continuousMotion } from '../../src/tools/art/motion.ts';
import { decodePng } from '../../src/tools/art/png.ts';
import { attr, reportPageErrors } from './strand.ts';

async function open(page: Page, query: string, hideText = true): Promise<void> {
  reportPageErrors(page);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`./?quality=full&view=play&name=Ash&body=A&${query}`);
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
    timeout: 30_000,
  });
  if (hideText)
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  await page.waitForTimeout(2500);
}

async function motion(page: Page, frames: number): Promise<number> {
  const shots: Uint8Array[] = [];
  for (let i = 0; i < frames; i++) {
    shots.push(decodePng(await page.screenshot()).data);
    await page.waitForTimeout(120);
  }
  return continuousMotion(shots, 640, 360).share;
}

test.describe("the broch's interior, reworked (the user's fourth playtest)", () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'measured in Chromium');
  test.describe.configure({ timeout: 150_000 });

  for (const [name, query] of [
    ['the lean-to by day', 'camp=broch&fire=lit&time=11:00&at=35.6,34.6'],
    ['the lean-to at night', 'camp=broch&fire=lit&time=21:30&at=35.6,34.6'],
    [
      'the finished shelter by day',
      'camp=broch&stage=S1&fire=lit&day=2&time=14:00&crew=1&at=35.6,34.6',
    ],
    [
      'under the finished shelter at night',
      'camp=broch&stage=S1&fire=lit&day=2&time=21:30&crew=1&at=35.6,32.2',
    ],
  ] as const)
    test(`${name}: with the camera still, at least ${MOTION_THRESHOLD * 100}% keeps moving`, async ({
      page,
    }) => {
      await open(page, query);
      const share = await motion(page, 30);
      console.log(`${name}: continuous motion ${(share * 100).toFixed(1)}%`);
      expect(share).toBeGreaterThanOrEqual(MOTION_THRESHOLD);
    });

  test("under the finished shelter at night, the household's things, smoke and lights stay within the frame budget @budget", async ({
    page,
  }) => {
    await open(page, 'camp=broch&stage=S1&fire=lit&day=2&time=21:30&crew=1&at=35.6,32.2');
    await motion(page, 33);
    const ms = Number(await page.locator('.oe-overlay').getAttribute('data-frame-ms'));
    console.log(`broch at night, script per frame: ${ms.toFixed(2)} ms`);
    expect(ms).toBeGreaterThan(0);
    // Book 2's browser budget (as standard.spec.ts): a third of a 60 fps frame.
    expect(ms).toBeLessThan(5.5);
  });

  test("standing on the steerer's bed after 18:00: the sleep prompt, and a press sleeps", async ({
    page,
  }) => {
    await open(page, 'camp=broch&stage=S1&fire=lit&day=2&time=21:30&crew=1&at=33.6,29.4', false);
    await expect.poll(() => attr(page, 'prompt'), { timeout: 10_000 }).toBe('sleep');
    await page.keyboard.press('e');
    await expect.poll(() => attr(page, 'sleeping'), { timeout: 10_000 }).toBe('true');
  });

  test('a find off the path: its prompt names it, and using it tells its story', async ({
    page,
  }) => {
    await open(page, 'camp=broch&crew=1&time=12:00&zone=ZONE_SK_MACHAIR&at=16.5,10.1', false);
    await expect.poll(() => attr(page, 'prompt'), { timeout: 10_000 }).toBe('find_look');
    const prompt = await page.locator('.oe-overlay [data-region=prompt]').textContent();
    expect(prompt ?? '').not.toMatch(/[A-Z]+_[A-Z_]+|[a-z]+_[a-z_]+/);
    await page.keyboard.press('e');
    await expect.poll(() => attr(page, 'found'), { timeout: 10_000 }).toBe('machair_carved_stone');
  });
});

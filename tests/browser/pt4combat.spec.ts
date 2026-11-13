/**
 * The user's fourth playtest, combat in the browser (request 16; decision DH-71): the steerer's
 * death plays a moment of collapse (the knees, the fall, a still beat while the sound drops away)
 * before the game-over screen, which then comes with its keys; the death is still game over at
 * once (nothing moves). Stepped (`capture`): the page advances only when the test steps it.
 */
import { expect, test } from '@playwright/test';
import { attr, overlay, startPlay, step, stepUntil } from './strand.ts';

const FIGHT = 'capture&kit=seax&camp=broch&time=10:00&zone=ZONE_SK_CAIRN';

test('the steerer’s death: the collapse first, then the game-over screen', async ({ page }) => {
  // Hurt to the edge (a test hook), running at the wreckers' backs at the fold.
  await startPlay(page, 'A', `${FIGHT}&at=24.5,35.6&vitality=1`);
  await step(page, 2);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  await step(page, 6);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ShiftLeft');
  await stepUntil(page, 'steerer-fight', 'dead', 40);
  expect(await attr(page, 'steerer-fight')).toBe('dead');
  const panel = overlay(page).locator('[data-region=gameover]');
  // The collapse: 1.4 s in, still no screen, and keys do nothing (no reload taken early).
  await step(page, 14);
  expect(await attr(page, 'game-over')).toBe('');
  await expect(panel).toBeEmpty();
  const px = await attr(page, 'px');
  await page.keyboard.press('KeyE');
  await step(page, 1);
  expect(await attr(page, 'steerer-fight')).toBe('dead');
  expect(await attr(page, 'px')).toBe(px);
  // Then the screen, by about Book 10's 1.8 s (the knees, the fall, the beat).
  await step(page, 6);
  expect(await attr(page, 'game-over')).not.toBe('');
  await expect(panel).toContainText('Ash has fallen.');
  // Its keys work once it shows: reload the latest save.
  await page.keyboard.press('KeyE');
  await step(page, 2);
  expect(await attr(page, 'game-over')).toBe('');
  expect(await attr(page, 'steerer-fight')).not.toBe('dead');
});

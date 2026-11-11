/**
 * Stage 5 in the browser (?view=shell): the safe rule with a test hostile, time stopping for menus
 * but never for the command ring, captions for cues, and a remapped key that survives a reload.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openShell(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./?view=shell');
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'shell', {
    timeout: 15_000,
  });
  await page.locator('canvas#screen').click();
}

const overlay = (page: Page) => page.locator('.oe-overlay');
const tick = async (page: Page): Promise<number> =>
  Number(await overlay(page).getAttribute('data-tick'));

test('menus refuse to open while a test hostile is aware, and time stops only when safe', async ({
  page,
}) => {
  await openShell(page);
  await page.keyboard.press('KeyH');
  await page.keyboard.press('KeyM');
  await expect(overlay(page)).toHaveAttribute('data-menu', '');
  await expect(overlay(page).locator('[data-region=prompt]')).toContainText('hostile aware');
  // The system menu still opens, as an overlay, and time keeps running.
  await page.keyboard.press('Escape');
  await expect(overlay(page)).toHaveAttribute('data-menu', 'system');
  await expect(overlay(page)).toHaveAttribute('data-time', 'running');
  const t0 = await tick(page);
  await page.waitForTimeout(400);
  expect(await tick(page)).toBeGreaterThan(t0);
  await page.keyboard.press('Escape');
  // Safe again: the map opens and time stops.
  await page.keyboard.press('KeyH');
  await page.keyboard.press('KeyM');
  await expect(overlay(page)).toHaveAttribute('data-menu', 'map');
  await expect(overlay(page)).toHaveAttribute('data-time', 'stopped');
  const t1 = await tick(page);
  await page.waitForTimeout(400);
  expect(await tick(page)).toBe(t1);
});

test('the command ring never stops time', async ({ page }) => {
  await openShell(page);
  await page.keyboard.down('Tab');
  await expect(overlay(page)).toHaveAttribute('data-ring', 'open');
  const t0 = await tick(page);
  await page.waitForTimeout(500);
  expect(await tick(page)).toBeGreaterThan(t0 + 10);
  await page.mouse.move(640, 200);
  await page.keyboard.up('Tab');
  await expect(overlay(page)).toHaveAttribute('data-ring', 'closed');
  await expect(overlay(page)).toHaveAttribute('data-order', 'FOLLOW');
  await page.keyboard.press('F6');
  await expect(overlay(page)).toHaveAttribute('data-order', 'WITHDRAW');
});

test('music states, stingers and effects each produce a caption', async ({ page }) => {
  await openShell(page);
  await page.keyboard.press('KeyK');
  await expect(overlay(page).locator('[data-region=captions]')).toContainText(
    'Horn from the north',
  );
  await page.keyboard.press('KeyP');
  await expect(overlay(page).locator('[data-region=captions]')).toContainText('theme');
  await page.keyboard.press('KeyO');
  await expect(overlay(page).locator('[data-region=captions]')).toContainText('A horn call');
});

test('a remapped key persists across a reload', async ({ page }) => {
  await openShell(page);
  await expect(overlay(page)).toHaveAttribute('data-interact', 'E, Pad 0');
  await page.keyboard.press('F9');
  await page.keyboard.press('KeyG');
  await expect(overlay(page)).toHaveAttribute('data-interact', 'G, Pad 0');
  await page.reload();
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'shell');
  await expect(overlay(page)).toHaveAttribute('data-interact', 'G, Pad 0');
});

/**
 * The user's third playtest in the browser, the interface (decisions DG-15 to DG-21; Book 2
 * section 23): the pause menu stops the world and is drawn as pixel art over its dimmed frame; a
 * save goes to a slot with its screenshot and loads back; saving is refused while an enemy is
 * aware; reset to the start of this day; fullscreen offered on the title and in the menu; the
 * intro's skip only once seen; the developer menu only with `?dev`. Stepped (DE-81): each frame is
 * advanced by the test.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, overlay, reportPageErrors, startPlay, step, stepUntil } from './strand.ts';

const pause = (page: Page) => page.locator('canvas.oe-pause');

async function press(page: Page, ...keys: string[]): Promise<void> {
  for (const k of keys) {
    await page.keyboard.press(k);
    await step(page, 1);
  }
}

/** The pause canvas's drawn pixels (non-transparent), to show it is drawn. */
async function drawnPixels(page: Page): Promise<number> {
  return pause(page).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    if (d !== undefined) for (let i = 3; i < d.length; i += 4) if ((d[i] ?? 0) > 0) n++;
    return n;
  });
}

test.describe('the pause menu (DG-15 to DG-18)', () => {
  test.setTimeout(180_000);

  test('Escape pauses the world under the safe rule; the menu is drawn over the dimmed frame', async ({
    page,
  }) => {
    await startPlay(page, 'A', 'capture');
    await step(page, 3);
    await press(page, 'Escape');
    await expect(overlay(page)).toHaveAttribute('data-pause', 'main');
    await expect(overlay(page)).toHaveAttribute('data-paused', '1');
    const tick = await attr(page, 'tick');
    await step(page, 20);
    expect(await attr(page, 'tick')).toBe(tick);
    await expect(pause(page)).toBeVisible();
    // Paused: the whole frame is the dimmed backdrop and the panel.
    expect(await drawnPixels(page)).toBe(640 * 360);
    // The menu's words for screen readers, out of sight.
    await expect(overlay(page).locator('[data-region=menu]')).toContainText('Fullscreen: off');
    await expect(overlay(page).locator('[data-region=menu]')).toContainText(
      'Reset to the start of this day',
    );
    // P closes it too (as Escape), and time runs again.
    await press(page, 'KeyP');
    await expect(overlay(page)).toHaveAttribute('data-pause', '');
    await step(page, 3);
    expect(Number(await attr(page, 'tick'))).toBeGreaterThan(Number(tick));
  });

  test('a save goes to a slot with its day, time, place and screenshot, and loads back', async ({
    page,
  }) => {
    await startPlay(page, 'A', 'capture');
    await step(page, 3);
    const px = await attr(page, 'px');
    // Escape, down to Save, Enter: the save page with Slot 1 chosen; Enter saves to it.
    await press(page, 'Escape', 'ArrowDown', 'Enter');
    await expect(overlay(page)).toHaveAttribute('data-pause', 'save');
    await press(page, 'Enter');
    await expect(overlay(page)).toHaveAttribute('data-pause-note', 'ui.save.saved');
    const slots = await attr(page, 'slots');
    const m1 = /MANUAL_1:(\d+)@(\d+)@([a-z._]+)@(\d+)/.exec(slots);
    expect(m1?.[1]).toBe('1');
    expect(m1?.[3]).toBe('place.name.sk_wreck_strand');
    // The screenshot: a PNG in base64 within Book 10's 24 KB.
    expect(Number(m1?.[4])).toBeGreaterThan(100);
    expect(Number(m1?.[4])).toBeLessThanOrEqual(24 * 1024);
    // Its card shows the screenshot.
    await expect(pause(page)).toHaveAttribute('data-thumbs', /^[1-9]/);
    // Back to play, walk away.
    await press(page, 'Escape', 'Escape');
    await page.keyboard.down('KeyA');
    await step(page, 10);
    await page.keyboard.up('KeyA');
    await step(page, 2);
    expect(await attr(page, 'px')).not.toBe(px);
    // Load: the autosave card first, then Slot 1 to its right; it asks once; Yes loads it.
    await press(page, 'Escape', 'ArrowDown', 'ArrowDown', 'Enter');
    await expect(overlay(page)).toHaveAttribute('data-pause', 'load');
    await press(page, 'ArrowRight', 'Enter');
    await expect(overlay(page)).toHaveAttribute('data-pause-confirm', 'ui.save.confirm_load');
    await press(page, 'ArrowLeft', 'Enter');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-pause', '');
    expect(Math.abs(Number(await attr(page, 'px')) - Number(px))).toBeLessThan(1);
  });

  test('saving is refused while an enemy is aware, with its reason; the world runs on', async ({
    page,
  }) => {
    await startPlay(
      page,
      'A',
      'capture&kit=seax&camp=broch&time=10:00&zone=ZONE_SK_CAIRN&at=21,35.6',
    );
    await step(page, 2);
    // Running up behind the scavengers is heard: the fight is on, and they are aware.
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyD');
    await stepUntil(page, 'battle', 'engaged', 8);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('ShiftLeft');
    expect(await attr(page, 'battle')).toBe('engaged');
    await press(page, 'Escape');
    await expect(overlay(page)).toHaveAttribute('data-pause', 'main');
    await expect(overlay(page)).toHaveAttribute('data-paused', '');
    const tick = Number(await attr(page, 'tick'));
    await press(page, 'ArrowDown', 'Enter');
    await expect(overlay(page)).toHaveAttribute('data-pause-note', 'ui.save.refused');
    await expect(overlay(page)).toHaveAttribute('data-pause', 'main');
    expect(Number(await attr(page, 'tick'))).toBeGreaterThan(tick);
    expect(await attr(page, 'saves')).not.toContain('manual');
  });

  test('reset to the start of this day goes back to the waking', async ({ page }) => {
    await startPlay(page, 'A', 'capture');
    await step(page, 3);
    const px = await attr(page, 'px');
    const clock = await attr(page, 'clock');
    await page.keyboard.down('KeyA');
    await step(page, 15);
    await page.keyboard.up('KeyA');
    await step(page, 2);
    expect(await attr(page, 'px')).not.toBe(px);
    // Down to "Reset to the start of this day" (the sixth item); it asks once; Yes resets.
    await press(page, 'Escape', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown');
    await expect(overlay(page)).toHaveAttribute('data-pause-cursor', '5');
    await press(page, 'Enter');
    await expect(overlay(page)).toHaveAttribute('data-pause-confirm', 'ui.save.confirm_reset');
    await press(page, 'ArrowLeft', 'Enter');
    await step(page, 2);
    expect(Math.abs(Number(await attr(page, 'px')) - Number(px))).toBeLessThan(1);
    expect(await attr(page, 'clock')).toBe(clock);
  });

  test('fullscreen is offered on the title screen and in the menu', async ({ page }) => {
    reportPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('./');
    await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'title', {
      timeout: 15_000,
    });
    const menu = page.locator('canvas.oe-title-menu');
    await expect(menu).toHaveAttribute('data-items', /fullscreen/);
    // Down to Fullscreen and choose it: the browser is asked (headless browsers may refuse).
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveAttribute('data-cursor', '4');
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('data-page', 'list');
    // And in the pause menu.
    await startPlay(page, 'A', 'capture');
    await step(page, 2);
    await press(page, 'Escape');
    await expect(overlay(page).locator('[data-region=menu]')).toContainText(/Fullscreen: (on|off)/);
  });

  test('the title’s menu leads to the naming screen with New game', async ({ page }) => {
    reportPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('./');
    await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'title', {
      timeout: 15_000,
    });
    await page.keyboard.press('Enter');
    await expect(page.locator('.oe-naming')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('canvas.oe-title-menu')).toHaveCount(0);
  });
});

test.describe('skipping the intro (DG-19)', () => {
  test.setTimeout(180_000);

  test('cannot be skipped before it has been seen; once seen, holding a key for a second skips it', async ({
    page,
  }) => {
    await startPlay(page, 'A', 'capture&opening=full');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-phase', 'COLD_OPEN');
    await page.keyboard.down('KeyX');
    await step(page, 15);
    await page.keyboard.up('KeyX');
    await step(page, 1);
    await expect(overlay(page)).toHaveAttribute('data-phase', 'COLD_OPEN');
    await expect(overlay(page)).toHaveAttribute('data-skip', '');
    // Seen once on this device: the button shows and a held key skips to the waking.
    await page.evaluate(() => {
      localStorage.setItem(
        'oar-and-ember:interface',
        JSON.stringify({ version: 1, introSeen: true }),
      );
    });
    await startPlay(page, 'A', 'capture&opening=full');
    await step(page, 12);
    await expect(overlay(page)).toHaveAttribute('data-phase', 'COLD_OPEN');
    await expect(overlay(page)).toHaveAttribute('data-skip', /^0/);
    await expect(page.locator('canvas.oe-skip')).toBeVisible();
    await page.keyboard.down('KeyX');
    await step(page, 6);
    await expect(overlay(page)).toHaveAttribute('data-phase', 'COLD_OPEN');
    await step(page, 6);
    await page.keyboard.up('KeyX');
    await step(page, 1);
    await expect(overlay(page)).toHaveAttribute('data-phase', /WAKING|PLAY/);
  });

  test('the title’s "Intro: skip" leaves it out of a new game', async ({ page }) => {
    reportPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('./');
    await page.evaluate(() => {
      localStorage.setItem(
        'oar-and-ember:interface',
        JSON.stringify({ version: 1, introSkip: true }),
      );
    });
    await startPlay(page, 'A', 'capture&opening=full');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-phase', /WAKING|PLAY/);
  });
});

test.describe('the developer menu (DG-21)', () => {
  test.setTimeout(180_000);

  test('is absent from a production page without ?dev: F3 does nothing of it', async ({ page }) => {
    await startPlay(page, 'A', 'capture');
    await step(page, 2);
    await press(page, 'F3');
    await expect(page.locator('.oe-dev')).toHaveCount(0);
    expect(await attr(page, 'dev')).toBe('');
  });

  test('with ?dev, F3 opens it; skip, teleport and kill work through commands', async ({
    page,
  }) => {
    await startPlay(
      page,
      'A',
      'capture&dev&kit=seax&camp=broch&time=10:00&zone=ZONE_SK_CAIRN&at=21,35.6',
    );
    await step(page, 2);
    await press(page, 'F3');
    await expect(page.locator('.oe-dev')).toBeVisible();
    expect(await attr(page, 'dev')).toBe('open');
    await expect(page.locator('.oe-dev')).toContainText('fps');
    await expect(page.locator('.oe-dev')).toContainText('ZONE_SK_CAIRN');
    // Skip 6 hours: 10:00 becomes 16:00.
    expect(await attr(page, 'clock')).toMatch(/^10:/);
    await page.locator('[data-dev-action=skip]').dispatchEvent('pointerdown');
    await step(page, 2);
    expect(await attr(page, 'clock')).toMatch(/^16:/);
    // Kill: the next click on an enemy.
    const fighters = await attr(page, 'fighters');
    const conn = /E_WRECKER_CONN:[a-z_]+:\d+:(-?\d+):(-?\d+)/.exec(fighters);
    expect(conn).not.toBeNull();
    const box = await page.locator('canvas#screen').boundingBox();
    if (box === null) throw new Error('no canvas');
    const cam = await page.evaluate(() => {
      const o = document.querySelector<HTMLElement>('.oe-overlay');
      return { x: Number(o?.dataset['camx'] ?? 'NaN'), y: Number(o?.dataset['camy'] ?? 'NaN') };
    });
    await page.locator('[data-dev-action=kill]').dispatchEvent('pointerdown');
    await expect(page.locator('.oe-dev')).toHaveAttribute('data-armed', 'kill');
    const sx = box.x + ((Number(conn?.[1]) - cam.x) / 640) * box.width;
    const sy = box.y + ((Number(conn?.[2]) - 14 - cam.y) / 360) * box.height;
    await page.mouse.click(sx, sy);
    await step(page, 2);
    await expect(page.locator('.oe-dev')).toHaveAttribute('data-last', 'kill:E_WRECKER_CONN');
    expect(await attr(page, 'fighters')).toMatch(/E_WRECKER_CONN:dead/);
    // Teleport: the next click on a tile.
    const px = await attr(page, 'px');
    await page.locator('[data-dev-action=teleport]').dispatchEvent('pointerdown');
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6);
    await step(page, 2);
    await expect(page.locator('.oe-dev')).toHaveAttribute('data-last', 'teleport');
    expect(await attr(page, 'px')).not.toBe(px);
  });
});

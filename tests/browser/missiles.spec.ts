/**
 * Starting weapons and missiles in the browser (the user's instructions B to E; Book 10 section
 * 21): the seax picked up from the wreck's debris with its tooltip, named for the keyboard, and
 * kept in the system menu's help page; and a loosed arrow seen as a projectile that moves across
 * several frames and then stays stuck where it landed. The arrow test steps the game a frame at a
 * time (`?capture`), so it holds on a slow machine.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { approach, attr, overlay, startPlay } from './strand.ts';

const onfoot = JSON.parse(readFileSync('content/onfoot.json', 'utf8')) as {
  pickups: { key: string; x: number; y: number }[];
};
const seax = onfoot.pickups.find((p) => p.key === 'wreck_seax') ?? { x: 0, y: 0 };

/** The page position of a world pixel: through the camera and the viewport's scale. */
async function pageAt(page: Page, wx: number, wy: number): Promise<{ x: number; y: number }> {
  const [cx = 0, cy = 0] = (await attr(page, 'camera')).split(',').map(Number);
  const box = await page.locator('.oe-overlay').boundingBox();
  if (box === null) throw new Error('no overlay');
  const scale = box.width / 640;
  return { x: box.x + (wx - cx) * scale, y: box.y + (wy - cy) * scale };
}

async function step(page: Page, frames = 1): Promise<void> {
  await page.evaluate((n) => {
    const w = window as unknown as { oeStep: (ms: number) => void };
    for (let i = 0; i < n; i++) w.oeStep(1000 / 60);
  }, frames);
}

test.describe('starting weapons and missiles', () => {
  test.setTimeout(180_000);

  test('wakes empty-handed; the seax is picked up with a tooltip, kept in the help page', async ({
    page,
  }) => {
    await startPlay(page);
    await expect(overlay(page)).toHaveAttribute('data-hotbar', /^,+$/);
    await expect(overlay(page)).toHaveAttribute('data-items', /wreck_seax/);
    await approach(page, seax.x * 24, seax.y * 24 + 6);
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'pick_up');
    await page.keyboard.press('KeyE');
    await expect(overlay(page)).toHaveAttribute('data-hotbar', /^ITEM_SEAX,/);
    await expect(overlay(page)).toHaveAttribute('data-tip', 'ITEM_SEAX');
    // Keyboard only: the tooltip names the keys, as bound.
    await expect(page.locator('[data-region=tip]')).toContainText('F strikes with the seax');
    await expect(overlay(page)).toHaveAttribute('data-tips-seen', 'ITEM_SEAX');
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveAttribute('data-menu', 'system');
    await page.keyboard.press('KeyH');
    await expect(overlay(page)).toHaveAttribute('data-help', '1');
    await expect(page.locator('[data-region=help]')).toContainText('Seax: F strikes');
  });

  test('a loosed arrow is a visible projectile that flies over several frames, then sticks', async ({
    page,
  }) => {
    await startPlay(page, 'A', 'kit=bow&capture');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-arrows', '6');
    const px = Number(await attr(page, 'px'));
    const py = Number(await attr(page, 'py'));
    // Aim at the shingle five tiles east, draw fully and let go.
    const at = await pageAt(page, px + 5 * 24, py);
    await page.mouse.move(at.x, at.y);
    await step(page, 2);
    await page.mouse.down();
    await step(page, 40);
    expect(Number(await attr(page, 'aim-held'))).toBeGreaterThanOrEqual(30);
    // The feet stay planted while drawn.
    expect(Number(await attr(page, 'px'))).toBe(px);
    await page.mouse.up();
    const seen: { frame: string; x: number; y: number }[] = [];
    for (let i = 0; i < 40; i++) {
      await step(page);
      const drawn = await attr(page, 'missiles');
      if (drawn === '') continue;
      const [frame = '', where = ''] = drawn.split(';')[0]?.split('@') ?? [];
      const [x = 0, y = 0] = where.split(',').map(Number);
      seen.push({ frame, x, y });
    }
    console.log(
      `arrow drawn on ${seen.length} frames: ${seen.map((s) => `${s.frame}@${s.x},${s.y}`).join(' ')}`,
    );
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen.every((s) => s.frame.startsWith('arrow/'))).toBe(true);
    // It travels east across the screen, frame by frame.
    for (let i = 1; i < seen.length; i++)
      expect(seen[i]?.x ?? 0).toBeGreaterThan(seen[i - 1]?.x ?? 0);
    await expect(overlay(page)).toHaveAttribute('data-missiles', '');
    await expect(overlay(page)).toHaveAttribute('data-arrows', '5');
    await expect(overlay(page)).toHaveAttribute('data-stuck', '1');
    await expect(overlay(page)).toHaveAttribute('data-stuck-drawn', '1');
  });
});

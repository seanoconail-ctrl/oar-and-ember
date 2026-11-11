/**
 * Stage 6 rework in the browser (Book 3 Stage 6 checks 5, 8 and 9): the hotbar chosen by number
 * keys and the wheel; a click beyond reach refused visibly without touching the simulation; the
 * rescue finished with the mouse (right-click to lift and to set down); Hild masked at her
 * waterline; and the camera's look-ahead, which never passes Book 10's cap and, with the cursor
 * held still, never steps a pixel back and forth.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseControlsBalance } from '../../src/content/balance.ts';
import { aboveTideLine, terrainAt } from '../../src/sim/land/zoneMap.ts';
import { findPath } from '../../src/tools/play/openingBot.ts';
import {
  approach,
  attr,
  here,
  hildSpawn,
  map,
  overlay,
  startPlay,
  wadeable,
  walkPath,
} from './strand.ts';

const controls = parseControlsBalance(
  JSON.parse(readFileSync('content/balance.json', 'utf8')) as unknown,
);

/** The page position of a world pixel: through the camera and the viewport's scale (720p: 2). */
async function pageAt(page: Page, wx: number, wy: number): Promise<{ x: number; y: number }> {
  const [cx = 0, cy = 0] = (await attr(page, 'camera')).split(',').map(Number);
  const box = await page.locator('.oe-overlay').boundingBox();
  if (box === null) throw new Error('no overlay');
  const scale = box.width / 640;
  return { x: box.x + (wx - cx) * scale, y: box.y + (wy - cy) * scale };
}

async function pointAt(page: Page, wx: number, wy: number): Promise<void> {
  const at = await pageAt(page, wx, wy);
  await page.mouse.move(at.x, at.y);
}

test.describe('the mouse-first controls', () => {
  test.setTimeout(180_000);

  test('the hotbar is chosen with the number keys and the wheel, its name shown briefly', async ({
    page,
  }) => {
    await startPlay(page);
    await expect(overlay(page)).toHaveAttribute('data-slot', '0');
    await expect(overlay(page)).toHaveAttribute('data-item', 'ITEM_BOW');
    await page.keyboard.press('Digit2');
    await expect(overlay(page)).toHaveAttribute('data-slot', '1');
    await expect(overlay(page)).toHaveAttribute('data-item', 'ITEM_SEAX');
    await expect(page.locator('[data-region=slot]')).toHaveText('Seax');
    await page.keyboard.press('Equal');
    await expect(overlay(page)).toHaveAttribute('data-slot', '11');
    await expect(overlay(page)).toHaveAttribute('data-item', '');
    await pointAt(page, Number(await attr(page, 'px')), Number(await attr(page, 'py')) - 60);
    await page.mouse.wheel(0, 100);
    await expect(overlay(page)).toHaveAttribute('data-slot', '0');
    await page.mouse.wheel(0, -100);
    await expect(overlay(page)).toHaveAttribute('data-slot', '11');
    await page.keyboard.press('Digit1');
    await expect(overlay(page)).toHaveAttribute('data-slot', '0');
  });

  test('a click beyond reach is refused in words and never moves the simulation', async ({
    page,
  }) => {
    await startPlay(page);
    const px = Number(await attr(page, 'px'));
    const py = Number(await attr(page, 'py'));
    await pointAt(page, px - 6 * 24, py - 3 * 24);
    await expect(overlay(page)).toHaveAttribute('data-reach', 'out');
    const sent = await attr(page, 'tile-commands');
    const at = await pageAt(page, px - 6 * 24, py - 3 * 24);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await expect(overlay(page)).toHaveAttribute('data-refusal', 'too_far');
    await expect(page.locator('[data-region=refusal]')).toHaveText('Too far');
    await page.keyboard.press('Digit2');
    await page.mouse.click(at.x, at.y);
    await expect(overlay(page)).toHaveAttribute('data-refusal', 'too_far');
    expect(await attr(page, 'tile-commands')).toBe(sent);
    expect(Number(await attr(page, 'px'))).toBe(px);
    expect(Number(await attr(page, 'py'))).toBe(py);
    expect(await attr(page, 'carrying')).toBe('');
  });

  test('the rescue is finished with the mouse: right-click Hild, then right-click dry ground', async ({
    page,
  }) => {
    await startPlay(page);
    // Hild stands in the shallows, cut at her waterline.
    expect(['12', '22']).toContain(await attr(page, 'hild-mask'));
    const hildAt = { tx: Math.floor(hildSpawn.x), ty: Math.floor(hildSpawn.y) };
    const toHild = findPath(
      map,
      false,
      await here(page),
      (t) => Math.abs(t.tx - hildAt.tx) + Math.abs(t.ty - hildAt.ty) === 1 && t.tx > hildAt.tx,
      wadeable,
    );
    if (toHild === null) throw new Error('no path to Hild');
    await walkPath(page, toHild);
    await approach(page, (hildAt.tx + 1.5) * 24, (hildAt.ty + 0.7) * 24);
    // Right-click on her body (the tile above her feet).
    const body = await pageAt(page, hildSpawn.x * 24, hildSpawn.y * 24 - 20);
    await page.mouse.move(body.x, body.y);
    await expect(overlay(page)).toHaveAttribute('data-reach', 'in');
    await page.mouse.click(body.x, body.y, { button: 'right' });
    await expect(overlay(page)).toHaveAttribute('data-carrying', 'C_HILD');
    const up = findPath(
      map,
      false,
      await here(page),
      (t) =>
        aboveTideLine(terrainAt(map, t.tx, t.ty)) && aboveTideLine(terrainAt(map, t.tx, t.ty - 1)),
      wadeable,
    );
    if (up === null) throw new Error('no dry ground');
    await walkPath(page, up);
    const me = await here(page);
    const dry = await pageAt(page, (me.tx + 0.5) * 24, (me.ty - 0.5) * 24);
    await page.mouse.click(dry.x, dry.y, { button: 'right' });
    await expect(overlay(page)).toHaveAttribute('data-hild', 'sit');
    await expect(overlay(page)).toHaveAttribute('data-beat', 'BEAT_1_WAKE');
  });

  test('the camera leads towards the cursor within the cap, and a still cursor holds it still', async ({
    page,
  }) => {
    await startPlay(page);
    const box = await page.locator('.oe-overlay').boundingBox();
    if (box === null) throw new Error('no overlay');
    const cap = controls.lookAheadMax * 24;
    // Far into a corner: the lead grows to the cap and no further.
    await page.mouse.move(box.x + 4, box.y + 4);
    let longest = 0;
    for (let i = 0; i < 20; i++) {
      const [lx = 0, ly = 0] = (await attr(page, 'lead')).split(',').map(Number);
      longest = Math.max(longest, Math.hypot(lx, ly));
      await page.waitForTimeout(100);
    }
    console.log(`look-ahead ${longest.toFixed(1)} px of ${cap} px`);
    expect(longest).toBeGreaterThan(cap * 0.5);
    expect(longest).toBeLessThanOrEqual(cap + 1);
    // Held still: over 10 s the drawn camera never steps back to a pixel it has left (no
    // jitter). On a machine fast enough to settle in the first seconds it does not move at all.
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4);
    await page.waitForTimeout(3000);
    const values: string[] = [await attr(page, 'camera')];
    const until = Date.now() + 10_000;
    while (Date.now() < until) {
      const now = await attr(page, 'camera');
      if (now !== values[values.length - 1]) values.push(now);
      await page.waitForTimeout(50);
    }
    console.log(`camera over 10 s: ${values.join(' ')}`);
    expect(new Set(values).size).toBe(values.length);
    // It only ever settles: at most a couple of single-pixel steps towards the goal.
    expect(values.length).toBeLessThanOrEqual(3);
  });
});

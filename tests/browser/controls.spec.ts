/**
 * Stage 6 rework in the browser (Book 3 Stage 6 checks 5, 8 and 9): the hotbar (with the bow and
 * seax already found) chosen by number keys and the wheel; a click beyond reach refused visibly without touching the simulation; the
 * rescue finished with the mouse (right-click to lift and to set down); Hild masked at her
 * waterline; and the camera's look-ahead, which never passes Book 10's cap and, with the cursor
 * held still, never steps a pixel back and forth. Every test plays stepped (`capture`): the game
 * advances a frame of fixed length at a time, so CI's slow software-rendered browsers play exactly
 * what a fast machine does, and a timed check (the slot name shown for 1.5 s, the camera held for
 * 10 s) is measured in game time.
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
  step,
  STEP_MS,
  stepUntil,
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

/**
 * Points the mouse at a world pixel and holds it there as a player does: the camera leads towards
 * the cursor, which moves the world under it, so the mouse follows its target until the view has
 * settled (a second of game time between looks; the camera's half-life is 0.18 s).
 */
async function pointAt(page: Page, wx: number, wy: number): Promise<{ x: number; y: number }> {
  let at = await pageAt(page, wx, wy);
  for (let look = 0; look < 5; look++) {
    await page.mouse.move(at.x, at.y);
    await step(page, 1000 / STEP_MS);
    const now = await pageAt(page, wx, wy);
    if (Math.round(now.x) === Math.round(at.x) && Math.round(now.y) === Math.round(at.y)) break;
    at = now;
  }
  return at;
}

test.describe('the mouse-first controls', () => {
  // Generous for CI's software-rendered browsers, which draw each stepped frame slowly.
  test.setTimeout(300_000);

  test('the hotbar is chosen with the number keys and the wheel, its name shown briefly', async ({
    page,
  }) => {
    // The bow and seax already found (they are picked up on the strand: tests/browser/missiles).
    await startPlay(page, 'A', 'kit=bow,seax&capture');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-slot', '0');
    await expect(overlay(page)).toHaveAttribute('data-item', 'ITEM_BOW');
    await page.keyboard.press('Digit2');
    await step(page);
    await expect(overlay(page)).toHaveAttribute('data-slot', '1');
    await expect(overlay(page)).toHaveAttribute('data-item', 'ITEM_SEAX');
    await expect(page.locator('[data-region=slot]')).toHaveText('Seax');
    // Shown briefly: gone after its second and a half.
    await step(page, Math.ceil(1600 / STEP_MS));
    await expect(page.locator('[data-region=slot]')).toHaveText('');
    await page.keyboard.press('Equal');
    await step(page);
    await expect(overlay(page)).toHaveAttribute('data-slot', '11');
    await expect(overlay(page)).toHaveAttribute('data-item', '');
    await pointAt(page, Number(await attr(page, 'px')), Number(await attr(page, 'py')) - 60);
    await page.mouse.wheel(0, 100);
    await step(page);
    await expect(overlay(page)).toHaveAttribute('data-slot', '0');
    await page.mouse.wheel(0, -100);
    await step(page);
    await expect(overlay(page)).toHaveAttribute('data-slot', '11');
    await page.keyboard.press('Digit1');
    await step(page);
    await expect(overlay(page)).toHaveAttribute('data-slot', '0');
  });

  test('a click beyond reach is refused in words and never moves the simulation', async ({
    page,
  }) => {
    await startPlay(page, 'A', 'kit=bow,seax&capture');
    await step(page, 2);
    const px = Number(await attr(page, 'px'));
    const py = Number(await attr(page, 'py'));
    const at = await pointAt(page, px - 6 * 24, py - 3 * 24);
    await expect(overlay(page)).toHaveAttribute('data-reach', 'out');
    const sent = await attr(page, 'tile-commands');
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await step(page);
    await expect(overlay(page)).toHaveAttribute('data-refusal', 'too_far');
    await expect(page.locator('[data-region=refusal]')).toHaveText('Too far');
    await page.keyboard.press('Digit2');
    await page.mouse.click(at.x, at.y);
    await step(page);
    await expect(overlay(page)).toHaveAttribute('data-refusal', 'too_far');
    expect(await attr(page, 'tile-commands')).toBe(sent);
    expect(Number(await attr(page, 'px'))).toBe(px);
    expect(Number(await attr(page, 'py'))).toBe(py);
    expect(await attr(page, 'carrying')).toBe('');
  });

  test('the rescue is finished with the mouse: right-click Hild, then right-click dry ground', async ({
    page,
  }) => {
    // Design addendum 2.4: the seax in hand (the net is cut with a held right-click).
    await startPlay(page, 'A', 'kit=seax&capture');
    await step(page, 2);
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
    const body = await pointAt(page, hildSpawn.x * 24, hildSpawn.y * 24 - 20);
    await expect(overlay(page)).toHaveAttribute('data-reach', 'in');
    await page.mouse.move(body.x, body.y);
    await page.mouse.down({ button: 'right' });
    await stepUntil(page, 'opening', /net_free/, 5);
    await page.mouse.up({ button: 'right' });
    await step(page, 2);
    await page.mouse.click(body.x, body.y, { button: 'right' });
    await step(page, 2);
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
    const dry = await pointAt(page, (me.tx + 0.5) * 24, (me.ty - 0.5) * 24);
    await page.mouse.click(dry.x, dry.y, { button: 'right' });
    await stepUntil(page, 'hild', 'sit', 5);
    await expect(overlay(page)).toHaveAttribute('data-hild', 'sit');
    await expect(overlay(page)).toHaveAttribute('data-beat', 'BEAT_1_WAKE');
  });

  test('the camera leads towards the cursor within the cap, and a still cursor holds it still', async ({
    page,
  }) => {
    await startPlay(page, 'A', 'capture');
    await step(page, 2);
    const box = await page.locator('.oe-overlay').boundingBox();
    if (box === null) throw new Error('no overlay');
    const cap = controls.lookAheadMax * 24;
    // Far into a corner: the lead grows to the cap and no further (two seconds, looked at every
    // tenth of a second).
    await page.mouse.move(box.x + 4, box.y + 4);
    let longest = 0;
    for (let i = 0; i < 20; i++) {
      const [lx = 0, ly = 0] = (await attr(page, 'lead')).split(',').map(Number);
      longest = Math.max(longest, Math.hypot(lx, ly));
      await step(page, 100 / STEP_MS);
    }
    console.log(`look-ahead ${longest.toFixed(1)} px of ${cap} px`);
    expect(longest).toBeGreaterThan(cap * 0.5);
    expect(longest).toBeLessThanOrEqual(cap + 1);
    // Held still: after three seconds, for 10 s the drawn camera never steps back to a pixel it
    // has left (no jitter); every frame is looked at.
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4);
    await step(page, 3000 / STEP_MS);
    const values = await page.evaluate(
      ({ frames, length }) => {
        const w = window as unknown as { oeStep: (ms: number) => void };
        const o = document.querySelector('.oe-overlay');
        const seen = [o?.getAttribute('data-camera') ?? ''];
        for (let i = 0; i < frames; i++) {
          w.oeStep(length);
          const now = o?.getAttribute('data-camera') ?? '';
          if (now !== seen[seen.length - 1]) seen.push(now);
        }
        return seen;
      },
      { frames: 10_000 / STEP_MS, length: STEP_MS },
    );
    console.log(`camera over 10 s: ${values.join(' ')}`);
    expect(new Set(values).size).toBe(values.length);
    // It only ever settles: at most a couple of single-pixel steps towards the goal.
    expect(values.length).toBeLessThanOrEqual(3);
  });
});

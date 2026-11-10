/**
 * Stage 6 in the browser: control within five seconds of the naming screen (check 1), and the
 * whole rescue played with real key presses, taught only by Hild's call, the prompt for the next
 * thing to do and the tide line's refusal, with no control list (check 2).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseZoneMap, aboveTideLine, terrainAt, tileOf } from '../../src/sim/land/zoneMap.ts';
import { findPath } from '../../src/tools/play/openingBot.ts';
import type { Tile } from '../../src/tools/play/openingBot.ts';

const map = parseZoneMap(
  JSON.parse(readFileSync('content/zones/zone_sk_strand.json', 'utf8')) as unknown,
  'content/zones/zone_sk_strand.json',
);
const overlay = (page: Page) => page.locator('.oe-overlay');
const attr = async (page: Page, name: string): Promise<string> =>
  (await overlay(page).getAttribute(`data-${name}`)) ?? '';

test('control within five seconds of the naming screen, with the chosen name and body', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'title', {
    timeout: 15_000,
  });
  await page.keyboard.press('Enter');
  const naming = page.locator('.oe-naming');
  await expect(naming).toBeVisible();
  const shown = Date.now();
  const steps: string[] = [];
  const lap = (name: string): void => {
    steps.push(`${name} ${Date.now() - shown}`);
  };
  // The two bodies are offered side by side with no visible label.
  const bodies = naming.locator('[role=radio]');
  await expect(bodies).toHaveCount(2);
  for (const body of await bodies.all()) expect((await body.innerText()).trim()).toBe('');
  lap('checked');
  await page.keyboard.type('Ash');
  lap('typed');
  await bodies.nth(1).click();
  lap('chose');
  await naming.locator('input').press('Enter');
  lap('woke');
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play');
  lap('play');
  await page.keyboard.down('KeyD');
  await expect(overlay(page)).toHaveAttribute('data-moving', 'true');
  const ms = Date.now() - shown;
  // Where the time went, for a slow machine: the test's steps, and the game's start-up marks
  // (ms since Wake: world, renderer, height field, first frames).
  console.log(
    `control in ${ms} ms; steps ${steps.join(', ')}; start-up ${(await overlay(page).getAttribute('data-startup')) ?? '?'}`,
  );
  await page.keyboard.up('KeyD');
  // Waking reused the renderer prepared behind the title (decision AP-18).
  expect(await overlay(page).getAttribute('data-startup')).toContain('"prepared":1');
  expect(ms).toBeLessThan(5000);
  await expect(overlay(page)).toHaveAttribute('data-steerer', 'Ash');
  await expect(overlay(page)).toHaveAttribute('data-body', 'B');
});

/** Holds the key for one axis until the steerer's feet reach `target` along it. */
async function walkAxis(page: Page, axis: 'x' | 'y', target: number): Promise<void> {
  const now = async (): Promise<number> => Number(await attr(page, axis === 'x' ? 'px' : 'py'));
  // A player who overshoots steps back: on a slow machine the key may be released late, so
  // correct up to a few times, each run shorter.
  for (let attempt = 0; attempt < 4; attempt++) {
    let at = await now();
    if (Math.abs(target - at) < 4) return;
    const forward = target > at;
    const key = axis === 'x' ? (forward ? 'KeyD' : 'KeyA') : forward ? 'KeyS' : 'KeyW';
    await page.keyboard.down(key);
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      at = await now();
      if (forward ? at >= target - 2 : at <= target + 2) break;
    }
    await page.keyboard.up(key);
    // Let the last frames land before checking again.
    await page.waitForTimeout(150);
  }
}

/** Walks a tile path by straight runs, the way a player steers with the keys. */
async function walkPath(page: Page, path: readonly Tile[]): Promise<void> {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const next = path[i + 1];
    if (a === undefined || b === undefined) continue;
    const axis = a.tx !== b.tx ? 'x' : 'y';
    const turns = next === undefined || (axis === 'x' ? next.ty !== b.ty : next.tx !== b.tx);
    if (!turns) continue;
    await walkAxis(page, axis, axis === 'x' ? (b.tx + 0.5) * 24 : (b.ty + 0.7) * 24);
  }
}

async function here(page: Page): Promise<Tile> {
  return tileOf(map, Number(await attr(page, 'px')), Number(await attr(page, 'py')));
}

test('the rescue, played with the keys and taught by the moment', async ({ page }) => {
  // The walk is 2.0 tiles a second since the art pass (AP-1), and software GL is slow: allow time.
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./?view=play&name=Ash&body=A');
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
    timeout: 15_000,
  });
  await page.locator('canvas#screen').click();
  const prompts = new Set<string>();
  const texts = new Set<string>();
  const watch = setInterval(() => {
    void overlay(page)
      .getAttribute('data-prompt')
      .then((p) => prompts.add(p ?? ''))
      .catch(() => undefined);
    void page
      .locator('[data-region=prompt]')
      .innerText()
      .then((t) => texts.add(t))
      .catch(() => undefined);
  }, 100);

  // Hild calls, and says where from.
  const captions = page.locator('[data-region=captions]');
  await expect(captions).toContainText('Hild, calling, west', { timeout: 5000 });
  await expect(captions).toContainText('past the rocks');

  // Walk to the voice.
  const hildAt = tileOf(map, 31.5 * 24, 37.6 * 24);
  const toHild = findPath(
    map,
    false,
    await here(page),
    (t) => Math.abs(t.tx - hildAt.tx) + Math.abs(t.ty - hildAt.ty) === 1 && t.tx > hildAt.tx,
  );
  if (toHild === null) throw new Error('no path to Hild');
  await walkPath(page, toHild);
  await expect(overlay(page)).toHaveAttribute('data-prompt', 'lift', { timeout: 5000 });
  await expect(page.locator('[data-region=prompt]')).toContainText('E  Lift Hild');
  await page.keyboard.press('KeyE');
  await expect(overlay(page)).toHaveAttribute('data-carrying', 'C_HILD');
  await expect(overlay(page)).toHaveAttribute('data-gait', 'carry');
  await expect(captions).toContainText('Get me up the beach');

  // On the wet stones the tide line refuses, and says why.
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(60);
  await page.keyboard.up('KeyS');
  await expect(overlay(page)).toHaveAttribute('data-prompt', 'below_tide');
  await page.keyboard.press('KeyE');
  await expect(page.locator('[data-region=prompt]')).toContainText('The tide comes this far');
  await expect(overlay(page)).toHaveAttribute('data-carrying', 'C_HILD');

  // Up past the weed line, facing up the beach, and set her down.
  const up = findPath(
    map,
    false,
    await here(page),
    (t) =>
      aboveTideLine(terrainAt(map, t.tx, t.ty)) && aboveTideLine(terrainAt(map, t.tx, t.ty - 1)),
  );
  if (up === null) throw new Error('no dry ground');
  await walkPath(page, up);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(60);
  await page.keyboard.up('KeyW');
  await expect(overlay(page)).toHaveAttribute('data-prompt', 'set_down');
  await page.keyboard.press('KeyE');
  await expect(overlay(page)).toHaveAttribute('data-hild', 'sit');
  await expect(overlay(page)).toHaveAttribute('data-beat', 'BEAT_1_WAKE');
  await expect(captions).toContainText("The sea's not having either of us today");
  clearInterval(watch);

  // Nothing but the next thing to do was ever shown: no list of controls.
  for (const p of prompts)
    expect(['', 'lift', 'set_down', 'below_tide', 'notice', 'move']).toContain(p);
  for (const t of texts) expect(t).not.toMatch(/Shift|Ctrl|Space|Tab|Mouse/);
  await expect(page.locator('[data-region=panel]')).toHaveCount(0);
});

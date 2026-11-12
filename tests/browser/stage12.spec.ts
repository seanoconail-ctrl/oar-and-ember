/**
 * Stage 12 in the browser (Book 3 Stage 12, the launch and the Build 1 gate): at the boat, its
 * words offer the launch, which opens the readiness screen with its point-of-no-return warning;
 * confirmed, the boat is named (free text, or a suggestion) and its sail marked; the scene plays
 * (the boat run down into the water, crewed, its sail set with the mark, rowed out); the sea map
 * shows the coast and the smoke at Carrick Landing; closing it ends Chapter 1 with its save, and
 * the timings show in the system menu.
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, by `oeStep`).
 * `camp=broch&crew=1&launch=open` starts with the searches done and the boat ready
 * (src/scenes/camp.ts); at 10:00 on day 1 the tide floats the boat.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { approach, attr, overlay, startPlay, step, stepUntil } from './strand.ts';

const T = 24;

/**
 * Looks the boat over and chooses to launch it. A resident walking past may take the prompt or
 * the talk first, so it waits in game time for the boat's own prompt and words, leaving any other
 * talk and trying again.
 */
async function askToLaunch(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await approach(page, 39.8 * T, 28.2 * T);
    await stepUntil(page, 'prompt', 'look_boat', 30);
    if ((await attr(page, 'prompt')) !== 'look_boat') continue;
    await page.keyboard.press('KeyE');
    await step(page, 2);
    if ((await attr(page, 'talk')) !== 'SHIP') {
      await page.keyboard.press('Space');
      await stepUntil(page, 'talk', '', 10);
      continue;
    }
    await stepUntil(page, 'talk-options', /p_steerer\.boat\.launch/, 30);
    const options = (await attr(page, 'talk-options')).split('|');
    await page.keyboard.press(`Digit${options.indexOf('p_steerer.boat.launch') + 1}`);
    await stepUntil(page, 'launch-ui', 'readiness', 5);
    return;
  }
  throw new Error('the boat could not be looked over');
}
const AT = 'capture&camp=broch&crew=1&time=10:00&zone=ZONE_SK_STRAND';
const OPEN = `${AT}&launch=open`;

test.describe('Stage 12: the launch and the Build 1 gate', () => {
  test.setTimeout(240_000);

  test('the launch: readiness, the name, the mark, the scene, the sea map and the chapter’s end', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${OPEN}&at=40.5,28.4`);
    await step(page, 2);
    await stepUntil(page, 'gate', 'OPEN', 5);
    expect(await attr(page, 'gate')).toBe('OPEN');
    await askToLaunch(page);
    // The readiness screen: its lines, the warning, and time stopped (the planning menu).
    const ready = page.locator('[data-panel=readiness]');
    await expect(ready).toBeVisible();
    expect(await attr(page, 'menu')).toBe('planning');
    await expect(ready.locator('tr')).toHaveCount(7);
    await expect(ready.locator('tr[data-measure=TIDE]')).toHaveAttribute('data-state', 'READY');
    await expect(ready.locator('.warning')).toContainText('no going back');
    const tick = await attr(page, 'tick');
    await step(page, 5);
    expect(await attr(page, 'tick')).toBe(tick);
    await ready.locator('[data-action=start]').click();
    await step(page, 1);
    // The name: a suggestion taken, then on to the sail.
    const naming = page.locator('[data-panel=naming]');
    await expect(naming).toBeVisible();
    await naming.locator('[data-suggestion=Skarfr]').click();
    await expect(naming.locator('input')).toHaveValue('Skarfr');
    await naming.locator('[data-action=next]').click();
    await step(page, 1);
    // The mark: a pattern and a dye, drawn on the boat in the preview.
    const mark = page.locator('[data-panel=mark]');
    await expect(mark).toBeVisible();
    await mark.locator('[data-pattern=raven]').click();
    await mark.locator('[data-dye=woad]').click();
    await expect(mark).toHaveAttribute('data-mark', 'raven:woad');
    await expect(mark.locator('[data-likeness]')).toContainText('raven');
    await mark.locator('[data-action=launch]').click();
    await step(page, 2);
    expect(await attr(page, 'gate')).toBe('STARTED');
    expect(await attr(page, 'ship-name')).toBe('Skarfr');
    expect(await attr(page, 'sail')).toBe('raven:woad');
    expect(await attr(page, 'saves')).toMatch(/checkpoint:launch/);
    // The scene: the household heaves, the boat runs down, floats, is crewed, sails and rows.
    await stepUntil(page, 'launch', 'BOARD', 120);
    await stepUntil(page, 'launch', 'ROW', 160);
    expect(await attr(page, 'music')).toBe('MUS_LAUNCH');
    // The sea map, drawn in place of the scene; read-only; the smoke appears as it is revealed.
    await stepUntil(page, 'launch', 'MAP', 200);
    await stepUntil(page, 'seamap', /^(0\.[5-9]\d|1\.00)$/, 30);
    expect(await attr(page, 'menu')).toBe('map');
    await expect(page.locator('[data-region=seamap] .label.smoke')).toBeVisible();
    expect(await attr(page, 'chapter')).toBe('CH_2_FIRST_RAID');
    await page.keyboard.press('KeyE');
    await step(page, 3);
    // Chapter 1 ends: its save, the card, and back to the island with the boat drawn up.
    await expect(page.locator('[data-panel=chapter]')).toBeVisible();
    expect(await attr(page, 'launch')).toBe('DONE');
    expect(await attr(page, 'saves')).toMatch(/checkpoint:chapter-1-end/);
    await page.locator('[data-panel=chapter] [data-action=close]').click();
    await step(page, 3);
    await expect(page.locator('[data-panel=chapter]')).toHaveCount(0);
    expect(await attr(page, 'seamap')).toBe('');
    const telemetry = JSON.parse(await attr(page, 'telemetry')) as {
      marks: Record<string, number>;
    };
    expect(telemetry.marks['chapter_end']).toBeGreaterThan(0);
    expect(telemetry.marks['launch']).toBeDefined();
  });

  test('Not yet leaves the readiness screen, and the gate stays open for later', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${OPEN}&at=40.5,28.4`);
    await step(page, 2);
    await askToLaunch(page);
    await expect(page.locator('[data-panel=readiness]')).toBeVisible();
    await page.locator('[data-panel=readiness] [data-action=back]').click();
    await step(page, 2);
    await expect(page.locator('[data-panel=readiness]')).toHaveCount(0);
    expect(await attr(page, 'gate')).toBe('OPEN');
  });

  test('a launch begun with no name asks for it (a checkpoint loaded part-way)', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${AT}&launch=naming&at=41.6,29.4`);
    await step(page, 2);
    const naming = page.locator('[data-panel=naming]');
    await expect(naming).toBeVisible();
    await naming.locator('input').fill('{steerer}!!');
    await naming.locator('input').press('Enter');
    await step(page, 1);
    await page.locator('[data-panel=mark] [data-pattern=plain]').click();
    await page.locator('[data-panel=mark] [data-action=launch]').click();
    await step(page, 3);
    // Braces and marks are never kept: the name is the letters typed.
    expect(await attr(page, 'ship-name')).toBe('steerer');
    expect(await attr(page, 'sail')).toBe('plain');
    await stepUntil(page, 'launch', 'HEAVE', 20);
  });

  test('the timings show in the system menu with T', async ({ page }) => {
    await startPlay(page, 'A', `${OPEN}&at=41.6,29.4`);
    await step(page, 5);
    await page.keyboard.press('Escape');
    await step(page, 1);
    await page.keyboard.press('KeyT');
    await step(page, 2);
    await expect(page.locator('[data-panel=timings]')).toBeVisible();
    await expect(page.locator('[data-panel=timings]')).toContainText('Played so far');
    expect(await overlay(page).getAttribute('data-telemetry')).toMatch(/"marks"/);
  });
});

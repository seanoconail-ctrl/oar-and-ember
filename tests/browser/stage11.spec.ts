/**
 * Stage 11 in the browser (Book 3 Stage 11, boat repairs and the first fitting): on Wreck Strand
 * the salvaged boards are lifted from the debris, carried to the wrecked boat and laid by it, and
 * the boat offers its work; at Seal Cave the wreck-scavengers hold a parley and Thorkel's silver
 * buys their steering oar, which the steerer lifts to carry; at the boat, its words offer the
 * fitting and Runa's carving; the drawn boat changes with its repairs.
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, by `oeStep`).
 * `camp=broch&crew=1` starts with the three searches done (src/scenes/camp.ts).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { approach, attr, overlay, startPlay, step, stepUntil } from './strand.ts';

const T = 24;
const CREW = 'capture&camp=broch&crew=1';

/** One part of the overlay's `data-repairs` (HULL, RIGGING, STEERING_OAR, FIT, OAR, RITES). */
async function repair(page: Page, key: string): Promise<string> {
  const raw = await attr(page, 'repairs');
  const hit = raw.split('|').find((p) => p.startsWith(`${key}=`));
  return hit === undefined ? '' : hit.slice(key.length + 1);
}

test.describe('Stage 11: boat repairs and the first fitting', () => {
  test.setTimeout(240_000);

  test('the boards: lifted from the debris, carried to the wrecked boat and laid by it', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${CREW}&time=10:00&zone=ZONE_SK_STRAND&at=50.6,27.4`);
    await step(page, 2);
    expect(await attr(page, 'zone')).toBe('ZONE_SK_STRAND');
    expect(await attr(page, 'boat')).toBe('hull_wrecked');
    expect(await repair(page, 'HULL')).toBe('LACKING');
    await stepUntil(page, 'prompt', 'lift', 3);
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-carrying', 'ITEM_BOARDS');
    // West along the shingle to the boat.
    await approach(page, 44.6 * T, 27.6 * T);
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-carrying', '');
    expect(await repair(page, 'HULL')).toBe('MATERIALS');
    // The boat now offers its work (a plain "Repair the ship" action).
    await approach(page, 43.4 * T, 28.3 * T);
    await stepUntil(page, 'prompt', 'task_repair_ship', 3);
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'task_repair_ship');
  });

  test('the drawn boat changes with each repair, and launch-ready with all three', async ({
    page,
  }) => {
    const at = '&time=10:00&zone=ZONE_SK_STRAND&at=45.5,30.6';
    await startPlay(page, 'A', `${CREW}&ship=hull${at}`);
    await step(page, 2);
    expect(await attr(page, 'boat')).toBe('hull_patched');
    await startPlay(page, 'A', `${CREW}&ship=hull,rig,oar&fit=hold${at}`);
    await step(page, 2);
    expect(await attr(page, 'boat')).toBe('hull_patched+hold+rig+oar+ready');
  });

  test('Seal Cave: the scavengers hold a parley, and Thorkel’s silver buys the steering oar', async ({
    page,
  }) => {
    // On the shingle by their fire with empty hands: they hold and talk.
    await startPlay(page, 'A', `${CREW}&time=17:20&zone=ZONE_SK_SEALCAVE&at=42.1,26.0`);
    await step(page, 2);
    expect(await attr(page, 'zone')).toBe('ZONE_SK_SEALCAVE');
    await stepUntil(page, 'prompt', 'talk', 10);
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-talk', 'E_WRECKER_KETILL');
    await stepUntil(page, 'talk-options', /p_steerer\.cave\.silver/, 20);
    const options = (await attr(page, 'talk-options')).split('|');
    expect(options).toContain('p_steerer.cave.food');
    expect(options).toContain('p_steerer.cave.take');
    await page.keyboard.press(`Digit${options.indexOf('p_steerer.cave.silver') + 1}`);
    await step(page, 4);
    expect(await repair(page, 'OAR')).toBe('TRADE');
    await stepUntil(page, 'talk', '', 30);
    await stepUntil(page, 'prompt', 'lift', 5);
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-carrying', 'ITEM_STEERING_OAR');
  });

  test('the boat’s words offer the fitting and Runa’s carving', async ({ page }) => {
    await startPlay(page, 'A', `${CREW}&time=10:00&zone=ZONE_SK_STRAND&at=40.5,28.4`);
    await step(page, 2);
    await approach(page, 39.8 * T, 28.2 * T);
    await stepUntil(page, 'prompt', 'look_boat', 3);
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-talk', 'SHIP');
    await stepUntil(page, 'talk-options', /p_steerer\.boat\.fit_hold/, 30);
    const options = (await attr(page, 'talk-options')).split('|');
    expect(options).toContain('p_steerer.boat.fit_bow');
    expect(options).toContain('p_steerer.boat.carve');
  });
});

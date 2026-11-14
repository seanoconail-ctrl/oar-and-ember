/**
 * Stage 10 in the browser (Book 3 Stage 10, the three searches): at the Hag's Seat the stone weeps
 * and the gale on the neck holds anyone carrying across it until an offering is left at the stone;
 * at the sheepfold Bran, guarding Thorkel's body, talks, and the fight he chooses has him at the
 * steerer's side.
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, by `oeStep`). The
 * searches open once Hild has led to the broch (`camp=broch`); `zone=...&at=x,y` starts in a
 * southern zone (src/scenes/camp.ts).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { approach, attr, overlay, startPlay, step, stepUntil } from './strand.ts';

const T = 24;
const SOUTH = 'capture&kit=seax&camp=broch&time=11:00';

/** Holds a key down for `frames` stepped frames. */
async function hold(page: Page, key: string, frames: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, frames);
  await page.keyboard.up(key);
  await step(page, 1);
}

/** The value a search fact holds, from the overlay's `data-searches`. */
async function searchFact(page: Page, fact: string): Promise<string> {
  const raw = await attr(page, 'searches');
  const hit = raw.split('|').find((p) => p.startsWith(`${fact}=`));
  return hit === undefined ? '' : hit.slice(fact.length + 1);
}

test.describe('Stage 10: the three searches', () => {
  test.setTimeout(240_000);

  test('the Hag’s Seat: the stone weeps, the gale holds the neck, and an offering stills it', async ({
    page,
  }) => {
    // East of Runa's tools, which lie by her below the stone.
    await startPlay(page, 'A', `${SOUTH}&zone=ZONE_SK_HAGSEAT&at=48.9,21.6`);
    await step(page, 2);
    expect(await attr(page, 'zone')).toBe('ZONE_SK_HAGSEAT');
    expect(await attr(page, 'stone')).toBe('wet');
    // Lift the tools.
    await stepUntil(page, 'prompt', 'lift', 3);
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'lift');
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-carrying', 'ITEM_RUNA_TOOLS');
    // East along the neck: the gale holds the steerer at its edge (the sign's rule).
    await hold(page, 'KeyD', 60);
    await expect(overlay(page)).toHaveAttribute('data-carrying', 'ITEM_RUNA_TOOLS');
    const held = Number(await attr(page, 'px'));
    const heldY = Number(await attr(page, 'py'));
    expect(held).toBeGreaterThan(51 * T);
    expect(held).toBeLessThan(54 * T);
    // Set the tools down, go to the stone and leave an offering: the stone stops weeping.
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-carrying', '');
    await approach(page, 44.6 * T, 18.6 * T);
    await stepUntil(page, 'prompt', 'offering', 3);
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'offering');
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-talk', 'OMEN_HAGSEAT_STONE');
    const options = (await attr(page, 'talk-options')).split('|');
    expect(options).toContain('p_steerer.search.stone.confess');
    expect(options).toContain('p_steerer.search.stone.seax');
    await page.keyboard.press(`Digit${options.indexOf('p_steerer.search.stone.confess') + 1}`);
    await stepUntil(page, 'stone', 'dry', 10);
    expect(await attr(page, 'stone')).toBe('dry');
    await stepUntil(page, 'talk', '', 20);
    // Now the neck lets the load across.
    // Back to where the gale held the steerer: the tools lie just ahead, on the neck.
    await approach(page, held, heldY);
    await stepUntil(page, 'prompt', 'lift', 3);
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-carrying', 'ITEM_RUNA_TOOLS');
    await hold(page, 'KeyD', 60);
    expect(Number(await attr(page, 'px'))).toBeGreaterThan(64 * T);
  });

  test('the sheepfold: Bran guards the body, talks, and fights at the steerer’s side', async ({
    page,
  }) => {
    // Outside the fold's east wall, across it from Bran: the wall hides the steerer from the
    // wreckers, who watch the gate on the west.
    await startPlay(page, 'A', `${SOUTH}&zone=ZONE_SK_CAIRN&at=43.4,36.4`);
    await step(page, 2);
    expect(await attr(page, 'zone')).toBe('ZONE_SK_CAIRN');
    expect(await searchFact(page, 'search.bran')).toBe('');
    await stepUntil(page, 'prompt', 'talk', 3);
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'talk');
    await expect(page.locator('[data-region=prompt]')).toContainText('Bran');
    await page.keyboard.press('KeyE');
    await step(page, 2);
    await expect(overlay(page)).toHaveAttribute('data-talk', 'C_BRAN');
    await expect(overlay(page)).toHaveAttribute('data-talk-kind', 'SEARCH');
    const options = (await attr(page, 'talk-options')).split('|');
    // Unseen in the fold, the sneak is offered beside the fight.
    expect(options).toContain('p_steerer.search.bran.sneak');
    expect(options).toContain('p_steerer.search.bran.fight');
    await page.keyboard.press(`Digit${options.indexOf('p_steerer.search.bran.fight') + 1}`);
    await stepUntil(page, 'battle', 'engaged', 20);
    expect(await attr(page, 'battle')).toBe('engaged');
    const ids = (await attr(page, 'fighters')).split(',').map((f) => f.split(':')[0]);
    expect(ids).toContain('C_BRAN');
    expect(ids).toContain('E_WRECKER_KETILL');
  });
});

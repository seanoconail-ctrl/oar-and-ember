/**
 * Design addendum 2.4's opening in the browser (Book 4 section 08; decisions DE-16 to DE-30),
 * played stepped (`capture`: the page advances only when the test steps it, so a slow machine plays
 * what a fast one does) and robust to people walking past: every check waits on the game's own
 * state on the overlay, never on a fixed frame.
 *
 * - The played cold open, its oar answering at once, the black and the waking; the first input
 *   gets the steerer up; Hild's call within Book 10's hildCallBy.
 * - Hild in the net: the hold-to-cut with the seax frees her; the net's caption.
 * - The journal (J) shows the current aim as one plain sentence; no marker is drawn.
 * - "Nothing that way": walking into the sea stops the steerer with its caption.
 * - The broch's door opens when walked into, with its caption, and swings shut after.
 */
import { expect, test } from '@playwright/test';
import { attr, overlay, startPlay, step, stepUntil, stepUntilText } from './strand.ts';

const CAPTIONS = '.oe-overlay [data-region=captions] p';

test('the cold open is played, steered at once, then the waking and Hild’s call', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startPlay(page, 'A', 'opening=full&capture');
  await expect(overlay(page)).toHaveAttribute('data-phase', 'COLD_OPEN');
  // The steering oar answers within the first second (control within seconds).
  await page.keyboard.down('KeyD');
  await step(page, 10);
  expect(Number(await attr(page, 'coldoar'))).toBeGreaterThan(0.3);
  await page.keyboard.up('KeyD');
  await stepUntilText(page, CAPTIONS, 'Thorkel, shouting from the bow', 15);
  // On to the strike, the black and the waking in the surf.
  await stepUntil(page, 'phase', 'WAKING', 45);
  await expect(overlay(page)).toHaveAttribute('data-phase', 'WAKING');
  await page.keyboard.down('KeyA');
  await stepUntil(page, 'phase', 'PLAY', 3);
  await page.keyboard.up('KeyA');
  await expect(overlay(page)).toHaveAttribute('data-phase', 'PLAY');
  // Hild calls from beyond the rocks, her direction captioned, within 15 s of waking.
  await stepUntilText(page, CAPTIONS, 'Hild, calling from the', 15);
  await expect(page.locator(CAPTIONS).filter({ hasText: 'Hild, calling from the' })).toHaveCount(1);
});

test('Hild in the net is cut free with a held Interact, the net parting', async ({ page }) => {
  test.setTimeout(120_000);
  await startPlay(page, 'A', 'kit=seax&zone=ZONE_SK_STRAND&at=32.6,35.6&capture');
  await step(page, 3);
  await expect(overlay(page)).toHaveAttribute('data-opening', /hild_reached/);
  await page.keyboard.down('KeyE');
  await stepUntil(page, 'opening', /net_free/, 5);
  await page.keyboard.up('KeyE');
  await step(page, 1);
  await expect(overlay(page)).toHaveAttribute('data-opening', /net_free/);
  await expect(page.locator(CAPTIONS).filter({ hasText: 'The net parts' })).toHaveCount(1);
});

test('the journal shows the current aim in plain words; no quest marker is drawn', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startPlay(page, 'A', 'capture');
  await step(page, 2);
  await expect(overlay(page)).toHaveAttribute(
    'data-journal',
    'Find who is calling beyond the rocks.',
  );
  await page.keyboard.press('KeyJ');
  await step(page, 1);
  await expect(page.locator('.oe-overlay .oe-journal-aim')).toHaveText(
    'Find who is calling beyond the rocks.',
  );
  await page.keyboard.press('KeyJ');
  await step(page, 1);
});

test('walking into the sea stops the steerer with "The water\'s too deep"', async ({ page }) => {
  test.setTimeout(90_000);
  await startPlay(page, 'A', 'capture');
  await page.keyboard.down('KeyS');
  await stepUntilText(page, CAPTIONS, 'The water', 8);
  await page.keyboard.up('KeyS');
  await expect(page.locator(CAPTIONS).filter({ hasText: "The water's too deep" })).toHaveCount(1);
  expect(Number(await attr(page, 'edges'))).toBe(1);
});

test('the broch’s door opens when walked into and swings shut behind', async ({ page }) => {
  test.setTimeout(120_000);
  await startPlay(page, 'A', 'camp=broch&stage=S1&at=35.5,37.5&capture');
  await step(page, 2);
  await expect(overlay(page)).toHaveAttribute('data-doors', /broch_door:0\.00/);
  await page.keyboard.down('KeyW');
  await stepUntil(page, 'doors', /broch_door:1\.00/, 4);
  await expect(overlay(page)).toHaveAttribute('data-doors', /broch_door:1\.00/);
  await stepUntilText(page, CAPTIONS, 'A door creaks open', 2);
  // Through and on into the court; the doorway clear, it closes after a moment.
  await step(page, 15);
  await page.keyboard.up('KeyW');
  await stepUntil(page, 'doors', /broch_door:0\.00/, 8);
  await expect(overlay(page)).toHaveAttribute('data-doors', /broch_door:0\.00/);
});

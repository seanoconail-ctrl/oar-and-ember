/**
 * The user's fourth playtest's story in the browser (decisions DH-4, DH-10, DH-11), played stepped
 * (`capture`: the page advances only when the test steps it): the prompt to raise the shelter shows
 * at its marked spot in the real game whenever the shelter can be worked, by day and by night, for
 * the frame, the sail and the second morning's finishing, and the key there does what it says.
 */
import { expect, test } from '@playwright/test';
import { attr, overlay, startPlay, step, stepUntil } from './strand.ts';

// The marked spot beside the lean-to's bed (Book 9 section 04; content rework.camp.mark).
const MARK = '35.0,29.65';

for (const [label, time] of [
  ['by day', '10:00'],
  ['at night, by the bed', '21:30'],
] as const) {
  test(`the frame’s prompt, then the sail’s, at the mark ${label}`, async ({ page }) => {
    test.setTimeout(240_000);
    await startPlay(page, 'A', `camp=broch&shelter=down&fire=lit&time=${time}&at=${MARK}&capture`);
    await step(page, 3);
    await expect(overlay(page)).toHaveAttribute('data-shelter', 'FOLDED');
    await expect(overlay(page)).toHaveAttribute('data-prompt', 'shelter_frame');
    await page.keyboard.press('KeyE');
    await stepUntil(page, 'shelter', 'FRAME', 8);
    await step(page, 3);
    expect(await attr(page, 'prompt')).toBe('shelter_sail');
    await page.keyboard.press('KeyE');
    await stepUntil(page, 'shelter', 'SAIL', 8);
  });
}

test('the second morning: the finishing’s prompt at its build site', async ({ page }) => {
  test.setTimeout(240_000);
  await startPlay(page, 'A', 'camp=broch&fire=lit&tended=1&day=2&time=07:00&at=32.4,30.45&capture');
  await step(page, 3);
  await expect(overlay(page)).toHaveAttribute('data-shelter', 'SAIL');
  await stepUntil(page, 'prompt', 'task_build', 10);
  expect(await attr(page, 'prompt')).toBe('task_build');
});

/**
 * A reason for the first raid in the browser (decisions DH-130 to DH-159), played stepped
 * (`capture`: the page advances only when the test steps it); every check waits on what the player
 * sees: the speech and caption lines and the talk panel.
 *
 * - The council at the fire: called from the circle round the fire, the household's counsel in
 *   their own voices, Hild's question, the four intents offered, the choice and their answers.
 * - The scavengers' skin boat in Seal Cave holds its Carrick goods; looked into, its words say so
 *   and read its mark against Thorkel's chart.
 * - The Hag's Seat on a clear day: Runa points out the smoke and the fields on the Irish coast.
 */
import { expect, test } from '@playwright/test';
import { startPlay, step, stepUntilText } from './strand.ts';

const CAPTIONS = '.oe-overlay [data-region=captions] p';
const TALK = '.oe-overlay [data-region=talk]';

test('the council at the fire: each one’s counsel, the four intents, the choice and the answers', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await startPlay(
    page,
    'A',
    'camp=broch&crew=1&ship=hull,rig,oar&launch=open&fire=lit&time=12:00&at=37.3,33.3&capture',
  );
  await step(page, 3);
  await page.keyboard.press('KeyE');
  await stepUntilText(page, CAPTIONS, 'not rowing out with no notion', 60);
  await stepUntilText(page, CAPTIONS, 'Kilbrecc. I still see a face.', 40);
  await stepUntilText(page, CAPTIONS, "However it's got.", 20);
  await stepUntilText(page, TALK, 'By night, quietly', 20);
  for (const intent of [
    'In daylight, armed',
    'We bargain first',
    'Anyone who stands in the way falls',
  ])
    await expect(page.locator(TALK)).toContainText(intent);
  await page.keyboard.press('Digit1');
  await stepUntilText(page, CAPTIONS, 'Nobody dies of a quiet night.', 20);
  await expect(
    page.locator(CAPTIONS).filter({ hasText: 'Nobody dies of a quiet night.' }),
  ).toHaveCount(1);
});

test('the skin boat in Seal Cave holds Carrick grain, nails and a net, and its mark is the chart’s', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startPlay(
    page,
    'A',
    'camp=broch&crew=1&time=17:40&zone=ZONE_SK_SEALCAVE&at=55.0,21.2&capture',
  );
  await page.evaluate(() => {
    const w = (window as unknown as { oeWorld: { facts: Record<string, unknown> } }).oeWorld;
    w.facts['ch1.chest_opened'] = true;
  });
  await step(page, 3);
  await page.keyboard.press('KeyE');
  await stepUntilText(page, TALK, 'A sack of barley', 20);
  await stepUntilText(page, TALK, "Thorkel's chart, at Carrick", 20);
  await stepUntilText(page, TALK, 'a mended net', 20);
  await stepUntilText(page, TALK, 'Take the grain, the nails and the net.', 20);
});

test('on a clear day at the Hag’s Seat, Runa points out the smoke and fields on the Irish coast', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startPlay(page, 'A', 'camp=broch&time=11:00&zone=ZONE_SK_HAGSEAT&at=43.4,21.6&capture');
  await page.evaluate(() => {
    const w = (window as unknown as { oeWorld: { powers: Record<string, unknown> } }).oeWorld;
    w.powers['POWER_CAILLEACH'] = { stone: 'DRY', offering: 'CONFESSION', day: 1, passedBy: false };
  });
  await stepUntilText(page, CAPTIONS, 'Folk over there. Fields, too.', 20);
  await expect(page.locator(CAPTIONS).filter({ hasText: 'far off to the south-west' })).toHaveCount(
    1,
  );
});

/**
 * The user's third playtest's story in the browser (decisions DG-12 to DG-14; Book 2 section 23),
 * played stepped (`capture`: the page advances only when the test steps it, so a slow machine plays
 * what a fast one does); every check waits on the game's own state on the overlay.
 *
 * - Hild, cut free and carried above the tide line, points up the bank to the old tower.
 * - The shelter's frame and sail are two actions at its place, Hild's word after each; on the
 *   second morning she asks for help finishing it, and the Build work finishes it.
 * - Thorkel taken by the sea: the bier set at the water, the three waves, the body under the
 *   second's foam, afloat, sinking under the water's mask for longer than Book 10's seaSink, then
 *   gone; Book 10's timings; the steerer held still and the cursor hidden while it plays.
 */
import { expect, test } from '@playwright/test';
import { attr, overlay, startPlay, step, stepUntil, stepUntilText, walkAxis } from './strand.ts';

const CAPTIONS = '.oe-overlay [data-region=captions] p';

test('Hild, set down above the tide line, points to the old tower on the bank', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startPlay(page, 'A', 'kit=seax&zone=ZONE_SK_STRAND&at=32.6,35.6&capture');
  await step(page, 3);
  await page.keyboard.down('KeyE');
  await stepUntil(page, 'opening', /net_free/, 6);
  await page.keyboard.up('KeyE');
  await step(page, 25);
  // Lift her, carry her up the shingle past the weed line, and set her down.
  await page.keyboard.press('KeyE');
  await step(page, 6);
  await walkAxis(page, 'y', 33.0 * 24);
  await walkAxis(page, 'x', 31.5 * 24);
  await page.keyboard.press('KeyE');
  await stepUntil(page, 'opening', /hild_safe/, 6);
  await stepUntilText(page, CAPTIONS, 'old tower up on the bank', 12);
  await expect(page.locator(CAPTIONS).filter({ hasText: 'Go and see if it' })).toHaveCount(1);
  await stepUntil(page, 'journal', 'Go up to the old tower to the north.', 4);
});

test('the shelter’s frame, then the sail over it, with Hild’s word after each', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startPlay(page, 'A', 'camp=broch&shelter=down&fire=lit&time=10:00&at=31.9,30.45&capture');
  await step(page, 3);
  await expect(overlay(page)).toHaveAttribute('data-shelter', 'FOLDED');
  await page.keyboard.press('KeyE');
  await stepUntil(page, 'shelter', 'FRAME', 8);
  await stepUntilText(page, CAPTIONS, 'Now the sail over the top', 4);
  await page.keyboard.press('KeyE');
  await stepUntil(page, 'shelter', 'SAIL', 8);
  await stepUntilText(page, CAPTIONS, 'A roof. Of sorts.', 4);
  await stepUntilText(page, CAPTIONS, 'a proper one in the morning', 8);
});

test('on the second morning Hild asks for help, and the work finishes the shelter', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await startPlay(page, 'A', 'camp=broch&fire=lit&tended=1&day=2&time=07:00&at=34.8,31.9&capture');
  await step(page, 3);
  await expect(overlay(page)).toHaveAttribute('data-shelter', 'SAIL');
  await stepUntilText(page, CAPTIONS, 'The lashings stretched in the wet', 8);
  // To the shelter's place, and the Build work until it is done (Hild works it too).
  await walkAxis(page, 'x', 33.2 * 24);
  await walkAxis(page, 'y', 30.9 * 24);
  for (let k = 0; k < 40 && (await attr(page, 'shelter')) === 'SAIL'; k++) {
    await page.keyboard.press('KeyE');
    await step(page, 30);
  }
  await expect(overlay(page)).toHaveAttribute('data-shelter', 'FINISHED');
});

test('Thorkel taken by the sea: three waves, under the foam, afloat, sunk and gone', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await startPlay(
    page,
    'A',
    'camp=broch&crew=1&ship=hull,rig,oar&time=17:45&rites=taken&zone=ZONE_SK_STRAND&at=33.0,33.2&capture',
  );
  await step(page, 1, 1000 / 60);
  await stepUntil(page, 'sea', /^BIER /, 3);
  // Sampled each tenth of a second: phase, seconds, frame, mask, wave; and where the steerer is.
  const seen: {
    phase: string;
    t: number;
    frame: string;
    mask: number;
    wave: number;
    at: string;
  }[] = [];
  await page.keyboard.down('KeyD');
  for (let i = 0; i < 400; i++) {
    await step(page, 1);
    const v = await attr(page, 'sea');
    if (v === '') break;
    const [phase = '', t = '0', frame = '', mask = '0', wave = '0'] = v.split(' ');
    const at = `${await attr(page, 'px')},${await attr(page, 'py')}`;
    seen.push({ phase, t: Number(t), frame, mask: Number(mask), wave: Number(wave), at });
    if (i === 60) expect(await attr(page, 'cursor')).toBe('hidden');
  }
  await page.keyboard.up('KeyD');
  // Walked down with the household, then held still at the edge with the key held (a scene
  // takes control).
  const still = new Set(seen.filter((s) => s.phase !== 'BIER').map((s) => s.at));
  expect(still.size).toBe(1);
  // In Book 10's order, at its times: the bier set after its carry (Book 10's 4 s, longer at the
  // bearers' pace down the flats), the waves 1.5 s after it and 2.6 s apart.
  const first = (pred: (s: (typeof seen)[number]) => boolean): number =>
    seen.find(pred)?.t ?? Number.NaN;
  const set = first((s) => s.phase === 'SET');
  expect(set).toBeGreaterThanOrEqual(4 - 0.11);
  expect(first((s) => s.wave === 1) - set).toBeCloseTo(1.5, 0);
  expect(first((s) => s.wave === 2) - set).toBeCloseTo(4.1, 0);
  expect(first((s) => s.wave === 3) - set).toBeCloseTo(6.7, 0);
  // Under the second wave's foam, then afloat and turning, then sinking.
  expect(seen.some((s) => s.wave === 2 && s.mask >= 10)).toBe(true);
  expect(seen.some((s) => s.frame.startsWith('float/'))).toBe(true);
  expect(seen.some((s) => s.frame.startsWith('tilt/'))).toBe(true);
  // Wholly under the water's mask for at least Book 10's seaSink before it is gone.
  const under = seen.filter((s) => s.mask >= 26).map((s) => s.t);
  expect(Math.max(...under) - Math.min(...under)).toBeGreaterThanOrEqual(2 - 0.11);
  // Gone, and control back about Book 10's seaLength after the bier was set down.
  const end = seen.at(-1)?.t ?? 0;
  expect(end - set).toBeGreaterThan(17 - 1);
  expect(end - set).toBeLessThan(17 + 3);
  await step(page, 3);
  expect(await attr(page, 'sea')).toBe('');
});

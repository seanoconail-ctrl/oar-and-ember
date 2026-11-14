/**
 * On-screen text in the browser, design addendum 2.5 section 2 (Book 2 section 18; Book 8 section
 * 10; Book 10 section 21, "On-screen text"; decisions DF-11 to DF-15), played stepped (DE-81: the
 * stepped helpers draw only their last frame) and waiting on the game's own state:
 *
 * - many messages at once leave at most two lines: one information line, one speech line;
 * - no stacking, and a repeat within 20 s is not shown;
 * - in a fight only speech and safety lines show; the story line waits and shows after;
 * - a tutorial prompt fades out while a speech line shows, comes back after, and goes once done;
 * - the mouse cursor is hidden through the cold open and the waking, and shows on a movement.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, overlay, startPlay, step, stepUntil } from './strand.ts';

const LIVE = '.oe-overlay [data-region=captions] p:not(.out)';

/** Sends game events into the page's simulation, as its own systems would. */
async function emit(page: Page, events: Record<string, unknown>[]): Promise<void> {
  await page.evaluate((list) => {
    const w = window as unknown as {
      oePlay: { sim: { events: { emit: (e: unknown) => void } } };
    };
    for (const e of list) w.oePlay.sim.events.emit(e);
  }, events);
}

/** The caption lines showing now (opacity above zero), as drawn. */
async function shown(page: Page): Promise<{ kind: string; text: string }[]> {
  return page.evaluate((css) => {
    return [...document.querySelectorAll<HTMLElement>(css)]
      .filter((p) => Number(p.style.opacity || '1') > 0)
      .map((p) => ({ kind: p.className, text: p.textContent }));
  }, LIVE);
}

const HILD = (n: number) => ({
  type: 'PERSON_SPOKE',
  person: 'C_HILD',
  lineKey: `c_hild.bark.broch.0${1 + (n % 3)}`,
});

test('a burst of messages leaves one information line and one speech line, never stacked', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await startPlay(page, 'A', 'camp=broch&time=13:00&capture');
  await step(page, 3);
  const burst: Record<string, unknown>[] = [];
  for (let i = 0; i < 8; i++)
    burst.push(
      { type: 'SEARCH_INFO', key: 'caption.search.chest_lost' },
      { type: 'EDGE_CAPTION', key: 'caption.edge.deep' },
      { type: 'WRECK', what: 'NET_CUT', key: 'caption.action.net_parts' },
      { type: 'WRECK', what: 'CHEST_HOME', key: 'caption.chest.settled' },
      { type: 'RESIDENT_APPROACHED', person: 'C_HILD' },
      { type: 'PERSON_SURRENDERED', person: 'E_WRECKER_KETILL' },
      HILD(i),
    );
  await emit(page, burst);
  // Every frame for two seconds: never more than two lines, one of each kind.
  for (let f = 0; f < 20; f++) {
    await step(page, 1);
    const lines = await shown(page);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.filter((l) => l.kind === 'info').length).toBeLessThanOrEqual(1);
    expect(lines.filter((l) => l.kind === 'speech').length).toBeLessThanOrEqual(1);
    for (const l of lines) {
      // The cut kinds never show.
      expect(l.text).not.toMatch(/The net parts|settles|coming over|kneels/);
    }
    if (f === 1) {
      // The safety line wins over the story line that arrived with it (infoPriority).
      expect(lines.map((l) => l.text)).toContain("The water's too deep");
      expect(lines.some((l) => l.text.startsWith('Hild: '))).toBe(true);
    }
  }
  // Captions sit at the bottom, within the lowest 16% of the view, clear of the action.
  const box = await page.locator('.oe-overlay [data-region=captions]').boundingBox();
  const view = await overlay(page).boundingBox();
  if (box !== null && view !== null && box.height > 0)
    expect(box.y).toBeGreaterThanOrEqual(view.y + view.height * 0.84 - 1);
});

test('a repeat within 20 s is suppressed; a new line replaces the old', async ({ page }) => {
  test.setTimeout(120_000);
  await startPlay(page, 'A', 'camp=broch&time=13:00&capture');
  await step(page, 3);
  await emit(page, [{ type: 'SEARCH_INFO', key: 'caption.search.chest_lost' }]);
  await step(page, 1);
  await expect(overlay(page)).toHaveAttribute('data-caption-info', /strongbox is gone/);
  // Gone after its hold and fade; the same line again 5 s later is not shown.
  await step(page, 40);
  await expect(overlay(page)).toHaveAttribute('data-caption-info', '');
  await emit(page, [{ type: 'SEARCH_INFO', key: 'caption.search.chest_lost' }]);
  await step(page, 1);
  await expect(overlay(page)).toHaveAttribute('data-caption-info', '');
  // A new speech line replaces the old one at once.
  await emit(page, [HILD(0)]);
  await step(page, 1);
  const first = await attr(page, 'caption-speech');
  await emit(page, [HILD(1)]);
  await step(page, 1);
  const second = await attr(page, 'caption-speech');
  expect(second).not.toBe(first);
  await step(page, 1);
  expect((await shown(page)).filter((l) => l.kind === 'speech')).toHaveLength(1);
});

test('in a fight only speech and safety lines show; a story line waits for its end', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await startPlay(page, 'A', 'camp=broch&time=13:00&capture');
  await step(page, 3);
  // A blow struck by the steerer: a fight for Book 10's 4 s.
  await emit(page, [{ type: 'SWING', who: 'P_STEERER', heavy: false, weapon: 'ITEM_SEAX' }]);
  await step(page, 1);
  await expect(overlay(page)).toHaveAttribute('data-fight', '1');
  await emit(page, [
    { type: 'PERSON_BROUGHT_HOME', person: 'C_ODDI' },
    { type: 'SEARCH_INFO', key: 'caption.search.chest_lost' },
    { type: 'PERSON_SPOKE', person: 'C_BRAN', lineKey: 'c_bran.bark.wound.01' },
  ]);
  await step(page, 1);
  await expect(overlay(page)).toHaveAttribute('data-caption-info', '');
  await expect(overlay(page)).toHaveAttribute('data-caption-speech', /^Bran: /);
  await expect(overlay(page)).toHaveAttribute('data-caption-held', /strongbox is gone/);
  // A safety line shows at once, fight or not.
  await emit(page, [{ type: 'EDGE_CAPTION', key: 'caption.edge.nothing' }]);
  await step(page, 1);
  await expect(overlay(page)).toHaveAttribute('data-caption-info', 'Nothing that way');
  // The fight ends 4 s after the blow; the held line shows a second later, still fresh.
  await stepUntil(page, 'fight', '', 6);
  await stepUntil(page, 'caption-info', /strongbox is gone/, 4);
  await expect(overlay(page)).toHaveAttribute('data-caption-info', /strongbox is gone/);
});

test('a tutorial prompt fades during a speech line, comes back after, and goes once done', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await startPlay(page, 'A', 'camp=broch&time=13:00&capture');
  // The move hint comes after a few seconds of standing still.
  await stepUntil(page, 'prompt', 'move', 14);
  await stepUntil(page, 'prompt-alpha', '1.00', 2);
  await expect(overlay(page)).toHaveAttribute('data-prompt-alpha', '1.00');
  // A speech line: the prompt fades out (0.5 s), never sitting alongside it.
  await emit(page, [HILD(2)]);
  await step(page, 6);
  await expect(overlay(page)).toHaveAttribute('data-prompt-alpha', '0.00');
  await expect(page.locator('.oe-overlay [data-region=prompt]')).toHaveText('');
  // The line goes; 2 s later the prompt fades back in.
  await stepUntil(page, 'caption-speech', '', 8);
  await step(page, 10);
  await expect(overlay(page)).toHaveAttribute('data-prompt-alpha', '0.00');
  await stepUntil(page, 'prompt-alpha', '1.00', 3);
  await expect(overlay(page)).toHaveAttribute('data-prompt-alpha', '1.00');
  // Walking 2 tiles does the thing: the prompt is gone for good.
  await page.keyboard.down('KeyD');
  await step(page, 30);
  await page.keyboard.up('KeyD');
  await step(page, 30);
  expect(await attr(page, 'prompt')).not.toBe('move');
  await expect(overlay(page)).not.toHaveAttribute('data-prompt', 'move');
});

test('the cursor is hidden through the cold open and the waking, and shows on a movement', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await startPlay(page, 'A', 'opening=full&capture');
  await step(page, 2);
  const cursor = () =>
    page.evaluate(
      () => getComputedStyle(document.querySelector('canvas#screen') ?? document.body).cursor,
    );
  await expect(overlay(page)).toHaveAttribute('data-cursor', 'hidden');
  expect(await cursor()).toBe('none');
  await page.mouse.move(300, 200);
  await page.mouse.move(340, 220);
  await step(page, 2);
  // Moving the mouse does not bring it back while the cold open plays.
  await expect(overlay(page)).toHaveAttribute('data-cursor', 'hidden');
  await stepUntil(page, 'phase', 'WAKING', 45);
  await step(page, 3);
  await expect(overlay(page)).toHaveAttribute('data-cursor', 'hidden');
  await page.keyboard.down('KeyA');
  await stepUntil(page, 'phase', 'PLAY', 3);
  await page.keyboard.up('KeyA');
  await step(page, 2);
  // Control is back, but the cursor stays hidden until the mouse moves.
  await expect(overlay(page)).toHaveAttribute('data-cursor', 'hidden');
  await page.mouse.move(360, 240);
  await step(page, 1);
  await expect(overlay(page)).toHaveAttribute('data-cursor', 'shown');
  expect(await cursor()).not.toBe('none');
});

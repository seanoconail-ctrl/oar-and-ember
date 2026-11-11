/**
 * Stage 6 in the browser: control within five seconds of the naming screen (check 1), and the
 * whole rescue played with real key presses, taught only by Hild's call, the prompt for the next
 * thing to do and the tide line's refusal, with no control list (check 2).
 */
import { expect, test } from '@playwright/test';
import { aboveTideLine, terrainAt, tileOf } from '../../src/sim/land/zoneMap.ts';
import { findPath } from '../../src/tools/play/openingBot.ts';
import { approach, attr, here, hildSpawn, map, overlay, wadeable, walkPath } from './strand.ts';

test('control within five seconds of the naming screen, with the chosen name and body', async ({
  page,
}) => {
  // Generous for a machine without a graphics card, which prepares slowly on the title; the
  // five seconds from the naming screen are checked below.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'title', {
    timeout: 15_000,
  });
  // The title prepares the play renderer behind itself (decision AP-18); like a player reading
  // the title, the test lets it finish. Its step costs are printed for slow machines.
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-prepared', 'ready', {
    timeout: 60_000,
  });
  console.log(
    `prepared ${(await page.locator('canvas#screen').getAttribute('data-prepare')) ?? '?'}`,
  );
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
  // Design addendum 2.3 section 10: the cue in italic, with no speaker, above Hild's words, which
  // are upright and named; the italic is a real face, never a synthesised slant.
  const info = captions.locator('p.info', { hasText: 'Hild, calling from the west' });
  await expect(info).toHaveCount(1, { timeout: 5000 });
  const speech = captions.locator('p.speech', { hasText: 'past the rocks' });
  await expect(speech).toContainText('Hild: ');
  // The captions are rebuilt every frame, so their styles are read in one step from the live page.
  const looks = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('.oe-overlay [data-region=captions] p')];
    const info = ps.find((p) => p.className === 'info');
    const speech = ps.find((p) => p.className === 'speech');
    if (info === undefined || speech === undefined) return null;
    const i = getComputedStyle(info);
    return {
      infoStyle: i.fontStyle,
      synthesis: i.getPropertyValue('font-synthesis'),
      speechStyle: getComputedStyle(speech).fontStyle,
      infoAbove: ps.indexOf(info) < ps.indexOf(speech),
    };
  });
  expect(looks).toEqual({
    infoStyle: 'italic',
    synthesis: expect.stringContaining('none') as unknown,
    speechStyle: 'normal',
    infoAbove: true,
  });

  // Hild stands in the shallows, knee to waist deep and masked at her waterline (Book 9).
  expect(['12', '22']).toContain(await attr(page, 'hild-mask'));
  await expect(overlay(page)).toHaveAttribute('data-hild-pose', 'call');

  // Walk to the voice, keeping out of deep water.
  const hildAt = tileOf(map, hildSpawn.x * 24, hildSpawn.y * 24);
  const toHild = findPath(
    map,
    false,
    await here(page),
    (t) => Math.abs(t.tx - hildAt.tx) + Math.abs(t.ty - hildAt.ty) === 1 && t.tx > hildAt.tx,
    wadeable,
  );
  if (toHild === null) throw new Error('no path to Hild');
  await walkPath(page, toHild);
  // A slow machine releases keys late: close the last few pixels to stand beside her.
  await approach(page, (hildAt.tx + 1.5) * 24, (hildAt.ty + 0.7) * 24);
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
    wadeable,
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

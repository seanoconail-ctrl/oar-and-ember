/**
 * Stage 9 in the browser (Book 3 Stage 9, combat v1): the wreck-scavengers notice
 * the steerer and come to fight; a seax swung at the cursor charges and strikes; the steerer's
 * death is game over, and game over reloads the latest save; the gore setting is changed from the
 * system menu; and no one moves while drawing a bow.
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, by `oeStep`), so a
 * slow machine plays exactly what a fast one does. The fight starts through the camp hooks:
 * `camp=broch` (Hild has led to the broch) with `zone=ZONE_SK_CAIRN&at=x,y` (src/scenes/camp.ts).
 * From Stage 10 the wreckers hold the sheepfold under the cairn, facing its gate to the east, where
 * the books put them (decision S9-11); every check is the same, played west of them at the fold.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, overlay, startPlay, step, stepUntil } from './strand.ts';

const FIGHT = 'capture&kit=seax&camp=broch&time=10:00&zone=ZONE_SK_CAIRN';

/** Each fighter in the zone as the page reports it: id to [state, vitality]. */
async function fighters(page: Page): Promise<Map<string, [string, number]>> {
  const raw = await attr(page, 'fighters');
  return new Map(
    raw
      .split(',')
      .filter((x) => x !== '')
      .map((x) => {
        const [id = '', state = '', vit = '0'] = x.split(':');
        return [id, [state, Number(vit)]];
      }),
  );
}

test.describe('Stage 9: combat v1', () => {
  test.setTimeout(180_000);

  test('the wreckers notice the steerer running at them, and a seax swung at the cursor charges and strikes', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${FIGHT}&at=21,35.6`);
    await step(page, 2);
    // The three scavengers are at the fold, unaware, their backs to the steerer.
    const before = await fighters(page);
    expect([...before.keys()].filter((id) => id.startsWith('E_WRECKER_')).sort()).toEqual([
      'E_WRECKER_CONN',
      'E_WRECKER_KETILL',
      'E_WRECKER_SVART',
    ]);
    expect(await attr(page, 'battle')).toBe('waiting');
    expect(await attr(page, 'saves')).toContain('checkpoint:wreckers');
    // Running up behind them is heard: the fight is on.
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyD');
    await stepUntil(page, 'battle', 'engaged', 8);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('ShiftLeft');
    expect(await attr(page, 'battle')).toBe('engaged');
    // The seax in hand: a press at the cursor (east of the steerer) starts the charge, facing it.
    const box = await page.locator('canvas#screen').boundingBox();
    if (box === null) throw new Error('no canvas');
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5);
    await page.mouse.down();
    await step(page, 1, 50);
    expect(await attr(page, 'steerer-fight')).toMatch(/^charge/);
    await page.mouse.up();
    await step(page, 1, 50);
    expect(await attr(page, 'steerer-fight')).toMatch(/^(light|heavy)/);
    // The fight goes on: blows land, on one side or the other, within a few seconds.
    const vitalities = async (): Promise<number> => {
      const f = await fighters(page);
      return (
        [...f.values()].reduce((sum, [, v]) => sum + v, 0) + Number(await attr(page, 'vitality'))
      );
    };
    const start = await vitalities();
    for (let i = 0; i < 80 && (await vitalities()) === start; i++) {
      await page.mouse.down();
      await step(page, 1, 50);
      await page.mouse.up();
      await step(page, 4, 100);
    }
    expect(await vitalities()).toBeLessThan(start);
  });

  test('the steerer’s death is game over, and game over reloads the latest save', async ({
    page,
  }) => {
    // Hurt to the edge (a test hook), at the wreckers' backs, without Second wind (the default).
    await startPlay(page, 'A', `${FIGHT}&at=24.5,35.6&vitality=1`);
    await step(page, 2);
    const saves = await attr(page, 'saves');
    expect(saves).toContain('autosave:WAKING');
    expect(saves).toContain('checkpoint:wreckers');
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyD');
    await step(page, 6);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('ShiftLeft');
    await stepUntil(page, 'game-over', /.+/, 40);
    expect(await attr(page, 'game-over')).not.toBe('');
    const panel = overlay(page).locator('[data-region=gameover]');
    await expect(panel).toContainText('Ash has fallen.');
    await expect(panel).toContainText('Reload the latest save');
    // Nothing moves after: the world is frozen behind the panel.
    const px = await attr(page, 'px');
    await page.keyboard.down('KeyA');
    await step(page, 5);
    await page.keyboard.up('KeyA');
    expect(await attr(page, 'px')).toBe(px);
    // Reload: the latest save (the checkpoint before the fight), the steerer standing again.
    await page.keyboard.press('KeyE');
    await step(page, 2);
    expect(await attr(page, 'game-over')).toBe('');
    await expect(panel).toBeEmpty();
    expect(await attr(page, 'zone')).toBe('ZONE_SK_CAIRN');
    expect(await attr(page, 'steerer-fight')).not.toBe('dead');
    await page.keyboard.down('KeyA');
    await step(page, 5);
    await page.keyboard.up('KeyA');
    expect(Number(await attr(page, 'px'))).toBeLessThan(Number(px));
  });

  test('the gore setting comes from the address and changes in the system menu', async ({
    page,
  }) => {
    await startPlay(page, 'A', `${FIGHT}&at=20,35.6&gore=off`);
    await step(page, 2);
    expect(await attr(page, 'gore')).toBe('0');
    await page.keyboard.press('Escape');
    await step(page, 1);
    await expect(overlay(page).locator('[data-region=menu]')).toContainText('Gore: off');
    await page.keyboard.press('KeyG');
    await step(page, 1);
    expect(await attr(page, 'gore')).toBe('2');
    await expect(overlay(page).locator('[data-region=menu]')).toContainText('Gore: full');
    await page.keyboard.press('KeyG');
    await step(page, 1);
    expect(await attr(page, 'gore')).toBe('1');
    await expect(overlay(page).locator('[data-region=menu]')).toContainText('Gore: low');
  });

  test('nobody moves while drawing: the steerer stands to draw the bow', async ({ page }) => {
    await startPlay(
      page,
      'A',
      'capture&kit=bow&camp=broch&time=10:00&zone=ZONE_SK_CAIRN&at=20,35.6',
    );
    await step(page, 2);
    const box = await page.locator('canvas#screen').boundingBox();
    if (box === null) throw new Error('no canvas');
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
    await page.mouse.down();
    await step(page, 2);
    expect(await attr(page, 'aim-held')).not.toBe('');
    const px = await attr(page, 'px');
    const py = await attr(page, 'py');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyS');
    await step(page, 8);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyS');
    expect(await attr(page, 'px')).toBe(px);
    expect(await attr(page, 'py')).toBe(py);
    await page.mouse.up();
    await step(page, 2);
  });
});

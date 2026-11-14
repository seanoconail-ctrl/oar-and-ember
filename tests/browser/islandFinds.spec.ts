/**
 * Stage 14 in the browser: a collectible found with Interact goes into the journal's Finds page
 * with its count and words, and the region map page inks in the scenes discovered and leaves the
 * rest blank vellum (Book 7 section 10; decisions S14-23 and S14-25). A screenshot of each page is
 * kept in docs/art/stage-14/ for the stage report.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, reportPageErrors } from './strand.ts';

async function open(page: Page, query: string): Promise<void> {
  reportPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`./?quality=full&view=play&name=Ash&body=A&${query}`);
  await expect(page.locator('canvas#screen')).toHaveAttribute('data-state', 'play', {
    timeout: 30_000,
  });
  await page.waitForTimeout(1500);
}

test.describe("the journal's finds and region map (Stage 14)", () => {
  test.describe.configure({ timeout: 120_000 });

  test('a lore find goes into the Finds page; the map page inks only what has been found', async ({
    page,
  }) => {
    await open(page, 'camp=broch&crew=1&time=12:00&zone=ZONE_SK_HAGSEAT&at=46.2,21.1');
    await expect.poll(() => attr(page, 'prompt'), { timeout: 10_000 }).toBe('find_look');
    await page.keyboard.press('e');
    await expect.poll(() => attr(page, 'found'), { timeout: 10_000 }).toBe('hagseat_wet_stone');
    // The journal: the aim page first, then the Finds page with the lore's count and words.
    await page.keyboard.press('j');
    await expect.poll(() => attr(page, 'journal-page'), { timeout: 10_000 }).toBe('aim');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => attr(page, 'journal-page'), { timeout: 10_000 }).toBe('finds');
    const report = page.locator('.oe-overlay [data-region=report]');
    await expect(report.locator('.oe-finds-kind[data-kind=LORE]')).toContainText('1 of 6');
    await expect(report).toContainText('The Hag\'s Seat stone is wet when nothing else is.');
    await expect(report).not.toContainText(/[A-Z]+_[A-Z_]+|[a-z]+\.[a-z_]+\.[a-z_]+/);
    mkdirSync('docs/art/stage-14', { recursive: true });
    writeFileSync('docs/art/stage-14/journal-finds.png', await page.screenshot());
    // The region map: the Hag's Seat walked into and named; Gull Geo still blank, unnamed.
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => attr(page, 'journal-page'), { timeout: 10_000 }).toBe('map');
    await expect(report.locator('.oe-region-map canvas')).toBeVisible();
    await expect(report.locator('.oe-map-label[data-zone=ZONE_SK_HAGSEAT]')).toHaveCount(1);
    await expect(report.locator('.oe-map-label[data-zone=ZONE_SK_GEO]')).toHaveCount(0);
    await page.waitForTimeout(1600);
    // Inked where found: the Hag's Seat's window is not the blank page; Gull Geo's still is.
    const inked = await page.evaluate(() => {
      const c = document.querySelector('.oe-region-map canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (ctx === null) return null;
      const at = (bx: number, by: number, bw: number, bh: number): number[] =>
        Array.from(ctx.getImageData(32 + bx * 12, -12 + by * 12, bw * 12, bh * 12).data);
      const dark = (px: number[]): number => {
        let n = 0;
        for (let i = 0; i < px.length; i += 4) if ((px[i] ?? 255) < 120) n++;
        return n;
      };
      return { hag: dark(at(0, 16, 12, 7)), geo: dark(at(4, 2, 10, 9)) };
    });
    expect(inked?.hag ?? 0).toBeGreaterThan(50);
    expect(inked?.geo ?? 1).toBe(0);
    writeFileSync('docs/art/stage-14/journal-map.png', await page.screenshot());
  });
});

/**
 * The user's third playtest's combat in the browser (decisions DG-2 to DG-11, DG-25): the
 * finish-or-let-go prompt at the screen's right edge on a beaten foe, let go with G (the shout and
 * the reply as speech, the foe running), the finisher held on V, the combat prompts in a first
 * fight and never in the caption area, Svart's guard turning a blow with the parry prompt, and the
 * first-sight line before any attack.
 *
 * Every test plays stepped (`capture`: the page advances only when stepped, DE-81). A moment of a
 * fight is staged through the page's world (`oeWorld`, capture mode only).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { attr, startPlay, step } from './strand.ts';

const DUSK = 'capture&kit=seax,bow&camp=broch&time=18:35&zone=ZONE_SK_STRAND';
const SVART = 'E_WRECKER_SVART';
const CONN = 'E_WRECKER_CONN';

interface W {
  tick: number;
  player: { vitality: number; teaching?: { fights: number } };
  ledger: { tag: string }[];
  spared?: unknown[];
  onFoot: {
    player: { x: number; y: number; fight?: { state: string } | null };
    battle: { engaged: boolean } | null;
    actors: Record<
      string,
      {
        x: number;
        y: number;
        pose: string;
        task?: string;
        fight?: {
          vitality: number;
          dead: unknown;
          turnedAt?: number;
          f: { state: string; since: number; recoveryEnd: number };
          ai: {
            home: { x: number; y: number };
            next: number;
            mode: string;
            aware: boolean;
            target: string | null;
            memory: unknown;
            awareness: { level: number; state: string; heard: number };
          };
        };
      }
    >;
  };
}

/**
 * One foe beaten (or alert), the steerer beside it facing it, the other held still: in the open
 * middle of the strand, where the camera centres the steerer (at the stern, the strand's east end,
 * the fighters stand under the prompts' box, and the prompts fade there, Book 10 promptClear).
 */
async function stage(
  page: Page,
  who: string,
  other: string,
  state: 'reel' | 'downed' | 'alert',
): Promise<void> {
  await page.evaluate(
    ([id, held, st]) => {
      const w = (window as unknown as { oeWorld: W }).oeWorld;
      const o = w.onFoot.actors[held];
      if (o?.fight !== undefined) {
        o.fight.ai.next = 1e12;
        o.x = 58 * 24;
      }
      const a = w.onFoot.actors[id];
      if (a?.fight === undefined) return;
      a.x = 70 * 24;
      a.y = 35.4 * 24;
      w.onFoot.player.x = a.x + 22;
      w.onFoot.player.y = a.y;
      a.fight.ai.awareness = { level: 100, state: 'ALERT', heard: w.tick };
      a.fight.ai.aware = true;
      a.fight.ai.target = 'P_STEERER';
      a.fight.ai.mode = 'FIGHT';
      a.fight.ai.memory = { x: a.x + 22, y: a.y, tick: w.tick, seen: true };
      delete a.task;
      a.pose = 'idle';
      // Their ground where they stand now, so the leash does not walk them back to their post.
      a.fight.ai.home = { ...a.fight.ai.home, x: a.x, y: a.y };
      if (w.onFoot.battle !== null) w.onFoot.battle.engaged = true;
      if (st !== 'alert') {
        a.fight.vitality = 15;
        a.fight.f.state = st;
        a.fight.f.since = w.tick;
        a.fight.f.recoveryEnd = w.tick + 600;
        a.fight.ai.next = 1e12;
      }
    },
    [who, other, state] as const,
  );
}

/** Faces the cursor at a point left of the steerer (the foe stands west). */
async function faceWest(page: Page): Promise<void> {
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas');
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.45);
  await step(page, 12);
}

test.describe('the user’s third playtest: finish or let go, prompts, the teaching foes', () => {
  // Stepped play waits on the page for each frame: a minute and a half for the longer fights.
  test.setTimeout(90_000);
  test('a beaten foe: the choice at the right edge; G lets go, with the shout, the reply and the run', async ({
    page,
  }) => {
    await startPlay(page, 'A', DUSK);
    await step(page, 10);
    await stage(page, SVART, CONN, 'downed');
    await faceWest(page);
    await step(page, 4);
    expect(await attr(page, 'combat-prompts')).toContain('FINISH_OR_SPARE');
    // At the right edge, in the band from 45% to 78% of the view's height, clear of the captions.
    const prompt = page.locator('.oe-overlay [data-region=combat] p').first();
    await expect(prompt).toBeVisible();
    const box = await prompt.boundingBox();
    const view = await page.locator('.oe-overlay').boundingBox();
    if (box === null || view === null) throw new Error('no box');
    expect(box.x + box.width).toBeGreaterThan(view.x + view.width * 0.9);
    expect(box.y).toBeGreaterThanOrEqual(view.y + view.height * 0.44);
    expect(box.y + box.height).toBeLessThanOrEqual(view.y + view.height * 0.79);
    await page.keyboard.down('KeyG');
    await step(page, 1);
    await page.keyboard.up('KeyG');
    // The shout, then the reply in the spared foe's own name (as the steerer knows it).
    const lines: string[] = [];
    for (let i = 0; i < 40; i++) {
      await step(page, 2);
      const line = await attr(page, 'caption-speech');
      if (line !== '' && lines.at(-1) !== line) lines.push(line);
    }
    const shout = lines.findIndex((l) => l.startsWith('Ash:'));
    expect(lines.join(' | ')).toContain('Ash:');
    expect(lines.slice(shout + 1).some((l) => !l.startsWith('Ash:'))).toBe(true);
    const after = await page.evaluate(() => {
      const w = (window as unknown as { oeWorld: W }).oeWorld;
      return { spared: w.spared?.length ?? 0, tag: w.ledger.at(-1)?.tag ?? '' };
    });
    expect(after).toEqual({ spared: 1, tag: 'SPARED' });
    await step(page, 60 * 12);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { oeWorld: W }).oeWorld.onFoot.actors['E_WRECKER_SVART'] ===
          undefined,
      ),
    ).toBe(true);
  });

  test('the finisher held on V: one blow after the hold, and the deed of a killing', async ({
    page,
  }) => {
    await startPlay(page, 'A', DUSK);
    await step(page, 10);
    await stage(page, SVART, CONN, 'reel');
    await faceWest(page);
    await page.keyboard.down('KeyV');
    let seen = false;
    for (let i = 0; i < 30 && !seen; i++) {
      await step(page, 1);
      seen = (await attr(page, 'steerer-fight')) === 'finisher';
    }
    await page.keyboard.up('KeyV');
    expect(seen).toBe(true);
    await step(page, 60);
    const end = await page.evaluate(() => {
      const w = (window as unknown as { oeWorld: W }).oeWorld;
      return {
        dead: w.onFoot.actors['E_WRECKER_SVART']?.fight?.dead != null,
        tag: w.ledger.at(-1)?.tag ?? '',
      };
    });
    expect(end).toEqual({ dead: true, tag: 'KILLING' });
  });

  test('Svart turns a blow outside his opening; the parry prompt shows at his telegraph', async ({
    page,
  }) => {
    await startPlay(page, 'A', DUSK);
    await step(page, 10);
    await stage(page, SVART, CONN, 'alert');
    await faceWest(page);
    let turned = false;
    let prompt = false;
    for (let i = 0; i < 60 * 10 && !(turned && prompt); i += 6) {
      // A blow now and then, never after a parry: each one is turned and he takes no harm.
      if (i % 30 === 0 && !turned) {
        // Beside him again (he steps back between blows), still facing west at him.
        await page.evaluate(() => {
          const w = (window as unknown as { oeWorld: W }).oeWorld;
          const a = w.onFoot.actors['E_WRECKER_SVART'];
          if (a !== undefined && a.fight?.f.state === 'idle') {
            w.onFoot.player.x = a.x + 22;
            w.onFoot.player.y = a.y;
          }
        });
        await page.mouse.down();
        await step(page, 1);
        await page.mouse.up();
      }
      await step(page, 6);
      const s = await page.evaluate(() => {
        const f = (window as unknown as { oeWorld: W }).oeWorld.onFoot.actors['E_WRECKER_SVART']
          ?.fight;
        return { v: f?.vitality ?? 0, turned: (f?.turnedAt ?? -1) >= 0 };
      });
      expect(s.v).toBe(68);
      if (s.turned) turned = true;
      if ((await attr(page, 'combat-prompts')).includes('TEACH_PARRY')) prompt = true;
      await page.evaluate(() => {
        (window as unknown as { oeWorld: W }).oeWorld.player.vitality = 100;
      });
    }
    expect(turned).toBe(true);
    expect(prompt).toBe(true);
  });

  test('the scavengers at the stern speak before any attack (first sight)', async ({ page }) => {
    await startPlay(page, 'A', `${DUSK}&at=80,35`);
    await step(page, 10);
    let spoke = -1;
    let attacked = -1;
    await page.keyboard.down('KeyD');
    for (let i = 0; i < 60 * 14; i += 6) {
      await step(page, 6);
      const s = await page.evaluate(() => {
        const w = (window as unknown as { oeWorld: W }).oeWorld;
        return Object.values(w.onFoot.actors).some((a) =>
          ['light1', 'heavyRelease', 'chargeL0', 'chargeL1', 'chargeL2'].includes(
            a.fight?.f.state ?? '',
          ),
        );
      });
      if (spoke < 0 && (await attr(page, 'caption-speech')) !== '') spoke = i;
      if (s && attacked < 0) attacked = i;
      if (spoke >= 0) await page.keyboard.up('KeyD');
    }
    await page.keyboard.up('KeyD');
    expect(spoke).toBeGreaterThanOrEqual(0);
    if (attacked >= 0) expect(attacked).toBeGreaterThan(spoke);
  });
});

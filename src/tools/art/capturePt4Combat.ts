/**
 * The user's fourth playtest's combat and AI clips, captured from the real game (decisions DH-70 to
 * DH-77; Book 7 sections 01 and 12):   npm run capture -- playtest-4-combat   writes
 * docs/art/playtest-4/combat/
 *
 * Played in capture mode as the earlier combat clips are (captureCombat2.ts: two ticks a frame,
 * every frame exact), the overlay shown (the game-over screen is part of the collapse's clip), the
 * view held still on the place (`camera=`). A moment is staged through the page's world, then played.
 * Each is a GIF at 1x of a 480 x 270 crop of the view (30 frames a second) and a still at 4x:
 *   death        the steerer's last blow at the fold: the knees, the fall, the still beat, then the
 *                game-over screen (DH-71)
 *   run-off      Svart let go at the stern: the shout, his reply, the spear dropped, and him running
 *                off along the strand out of sight (DH-75)
 *   guard-return the fold's band following the steerer out, breaking off past their gate's radius
 *                and running back to hold it, then coming out again as the steerer returns (DH-72)
 *   threat       Bran beside Svart and Ketill at the fold's gate; the steerer strikes Conn, and the
 *                two turn from Bran onto the steerer (DH-74)
 *   spear-reach  Svart thrusting south, then north, then east at the steerer at his full reach: the
 *                spear drawn to the ground it meets in every facing (DH-76)
 * Needs ffmpeg.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { Clip, FPS, screen, tick } from './captureCombat2.ts';
import { REPO_ROOT } from './loadTitleArt.ts';

const SVART = 'E_WRECKER_SVART';
const CONN = 'E_WRECKER_CONN';
const KETILL = 'E_WRECKER_KETILL';
const BRAN = 'C_BRAN';
const VIEW: readonly [number, number] = [480, 270];
const DUSK =
  '?capture&quality=full&view=play&name=Ash&body=A&camp=broch&kit=seax,bow&time=18:35&zone=ZONE_SK_STRAND';
const FOLD =
  '?capture&quality=full&view=play&name=Ash&body=A&camp=broch&kit=seax,bow&time=10:00&zone=ZONE_SK_CAIRN';

interface WA {
  x: number;
  y: number;
  facing: string;
  pose: string;
  task?: string;
  fight?: {
    f: { state: string; since: number; recoveryEnd: number; angle: number };
    vitality: number;
    maxVitality: number;
    able: boolean;
    dead: unknown;
    ai: {
      next: number;
      aware: boolean;
      target: string | null;
      mode: string;
      memory: unknown;
      back?: number;
      awareness: { level: number; state: string; heard: number };
      home: { x: number; y: number; facing: string };
    };
  };
}
interface WW {
  tick: number;
  player: { vitality: number };
  gameOver: unknown;
  onFoot: {
    player: { x: number; y: number; facing: string; fight?: { state: string } | null };
    actors: Record<string, WA>;
    battle: {
      engaged: boolean;
      sight?: { until: number } | null;
      groups: Record<string, { members: string[] }>;
    } | null;
  };
}

async function openAt(
  browser: Browser,
  base: string,
  at: [number, number],
  camera: [number, number],
  extra = '',
): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  await page.goto(
    `http://localhost:5289/${base}&at=${String(at[0])},${String(at[1])}&camera=${String(camera[0])},${String(camera[1])}${extra}`,
  );
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
  await tick(page, 30);
  return page;
}

/** Foes alert to the steerer and fighting, the first-sight pause over; `place` sets where. */
async function engage(
  page: Page,
  ids: string[],
  place: Record<string, [number, number]> = {},
): Promise<void> {
  await page.evaluate(
    ([who, xy]) => {
      const w = (window as unknown as { oeWorld: WW }).oeWorld;
      for (const id of who) {
        const a = w.onFoot.actors[id];
        if (a?.fight === undefined) continue;
        const p = xy[id];
        if (p !== undefined) {
          a.x = p[0] * 24;
          a.y = p[1] * 24;
        }
        a.fight.ai.next = w.tick;
        a.fight.ai.awareness = { level: 100, state: 'ALERT', heard: w.tick };
        a.fight.ai.aware = true;
        a.fight.ai.target = 'P_STEERER';
        a.fight.ai.memory = {
          x: w.onFoot.player.x,
          y: w.onFoot.player.y,
          tick: w.tick,
          seen: true,
        };
        delete a.task;
        a.pose = 'idle';
      }
      if (w.onFoot.battle !== null) w.onFoot.battle.engaged = true;
    },
    [ids, place] as const,
  );
  await tick(page, 4);
  await page.evaluate(() => {
    const b = (window as unknown as { oeWorld: WW }).oeWorld.onFoot.battle;
    if (b?.sight != null) b.sight.until = -1;
  });
}

async function remove(page: Page, ids: string[]): Promise<void> {
  await page.evaluate((gone) => {
    const w = (window as unknown as { oeWorld: WW }).oeWorld;
    for (const id of gone) {
      Reflect.deleteProperty(w.onFoot.actors, id);
      for (const g of Object.values(w.onFoot.battle?.groups ?? {}))
        g.members = g.members.filter((m) => m !== id);
    }
  }, ids);
}

async function heal(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { oeWorld: WW }).oeWorld.player.vitality = 100;
  });
}

async function actor(
  page: Page,
  id: string,
): Promise<{ x: number; y: number; target: string | null; back: boolean; state: string } | null> {
  return page.evaluate((who) => {
    const a = (window as unknown as { oeWorld: WW }).oeWorld.onFoot.actors[who];
    if (a === undefined) return null;
    return {
      x: a.x,
      y: a.y,
      target: a.fight?.ai.target ?? null,
      back: a.fight?.ai.back !== undefined,
      state: a.fight?.f.state ?? '',
    };
  }, id);
}

async function steerer(page: Page): Promise<{ x: number; y: number; state: string }> {
  return page.evaluate(() => {
    const p = (window as unknown as { oeWorld: WW }).oeWorld.onFoot.player;
    return { x: p.x, y: p.y, state: p.fight?.state ?? 'idle' };
  });
}

async function finish(
  clip: Clip,
  name: string,
  focus: { x: number; y: number },
  extra = '',
): Promise<string> {
  clip.focus = focus;
  const bytes = clip.write(0, VIEW, focus);
  return `${name}.gif ${(bytes / 1e6).toFixed(2)} MB${extra === '' ? '' : ` (${extra})`}`;
}

/** The steerer's last blow at the fold, the collapse, and the screen (DH-71). */
async function death(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, FOLD, [25.5, 35.6], [27, 35.6], '&vitality=1');
  await remove(page, [BRAN]);
  await engage(page, [SVART, KETILL], { [SVART]: [27.4, 35.4], [KETILL]: [27.4, 36.6] });
  const clip = new Clip(page, 'death', out);
  let dead = -1;
  for (let i = 0; i < FPS * 10 && (dead < 0 || i < dead + FPS * 3.5); i++) {
    await clip.frame(dead >= 0 && i === dead + 10);
    if (dead < 0 && (await steerer(page)).state === 'dead') dead = i;
    // Keep from running: the clip waits for a blow.
    if (dead < 0 && i > FPS * 8) break;
  }
  const me = await steerer(page);
  const line = await finish(
    clip,
    'death',
    await screen(page, me.x, me.y - 20),
    `died ${String(dead >= 0)}`,
  );
  await page.close();
  return line;
}

/** Svart let go at the stern, running off along the strand out of sight (DH-75). */
async function runOff(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, DUSK, [90.4, 35.4], [86, 35]);
  await remove(page, [CONN]);
  await engage(page, [SVART], { [SVART]: [89.4, 35.6] });
  await page.evaluate((who) => {
    const w = (window as unknown as { oeWorld: WW }).oeWorld;
    const a = w.onFoot.actors[who];
    if (a?.fight === undefined) return;
    a.fight.vitality = 16;
    a.fight.f.state = 'downed';
    a.fight.f.since = w.tick;
    a.fight.ai.next = 1e12;
  }, SVART);
  const s = await actor(page, SVART);
  if (s !== null) {
    const at = await screen(page, s.x, s.y - 18);
    await page.mouse.move(at.x, at.y);
  }
  await tick(page, 12);
  const clip = new Clip(page, 'run-off', out);
  for (let i = 0; i < FPS / 2; i++) await clip.frame();
  await page.keyboard.down('KeyG');
  await tick(page);
  await page.keyboard.up('KeyG');
  let gone = -1;
  for (let i = 0; i < FPS * 12 && (gone < 0 || i < gone + FPS); i++) {
    await clip.frame(i === FPS);
    if (gone < 0 && (await actor(page, SVART)) === null) gone = i;
  }
  const me = await steerer(page);
  const line = await finish(
    clip,
    'run-off',
    await screen(page, me.x - 120, me.y - 20),
    `gone ${String(gone >= 0)}`,
  );
  await page.close();
  return line;
}

/** The fold's band breaks off past its gate's radius and holds it; out again as the steerer returns. */
async function guardReturn(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, FOLD, [26, 35.8], [25, 35.8]);
  await remove(page, [BRAN, CONN]);
  await engage(page, [SVART, KETILL], { [SVART]: [28.5, 35.2], [KETILL]: [28.5, 36.6] });
  const clip = new Clip(page, 'guard-return', out);
  let back = -1;
  // The steerer walks away west, past the radius; waits; then walks back in.
  await page.keyboard.down('KeyA');
  for (let i = 0; i < FPS * 14; i++) {
    await heal(page);
    if (i === FPS * 3) await page.keyboard.up('KeyA');
    if (i === FPS * 9) await page.keyboard.down('KeyD');
    if (i === FPS * 11) await page.keyboard.up('KeyD');
    await clip.frame(back >= 0 && i === back + FPS);
    if (back < 0 && (await actor(page, SVART))?.back === true) back = i;
  }
  await page.keyboard.up('KeyD');
  const line = await finish(
    clip,
    'guard-return',
    await screen(page, 25 * 24, 35.8 * 24 - 16),
    `went back ${String(back >= 0)}`,
  );
  await page.close();
  return line;
}

/** Bran beside Svart and Ketill; the steerer strikes Conn; they turn on the steerer (DH-74). */
async function threat(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, FOLD, [25.2, 36.2], [28, 36]);
  await engage(page, [SVART, KETILL, CONN], {
    [SVART]: [30, 35.2],
    [KETILL]: [30, 37],
    [CONN]: [26.1, 36.2],
  });
  await page.evaluate(
    ([b, ids]) => {
      const w = (window as unknown as { oeWorld: WW }).oeWorld;
      const bran = w.onFoot.actors[b];
      if (bran !== undefined) {
        bran.x = 31.6 * 24;
        bran.y = 36.1 * 24;
      }
      for (const id of ids) {
        const a = w.onFoot.actors[id];
        if (a?.fight !== undefined) a.fight.ai.target = b;
      }
      // Conn holds still (his bow drawn on no one) for the blow.
      const c = w.onFoot.actors['E_WRECKER_CONN'];
      if (c?.fight !== undefined) c.fight.ai.next = 1e12;
    },
    [BRAN, [SVART, KETILL]] as const,
  );
  const c = await actor(page, CONN);
  if (c !== null) {
    const at = await screen(page, c.x, c.y - 18);
    await page.mouse.move(at.x, at.y);
  }
  const clip = new Clip(page, 'threat', out);
  for (let i = 0; i < FPS; i++) {
    await heal(page);
    await clip.frame();
  }
  await page.mouse.down();
  await tick(page);
  await page.mouse.up();
  let turned = -1;
  for (let i = 0; i < FPS * 5; i++) {
    await heal(page);
    await clip.frame(turned >= 0 && i === turned + 8);
    const s = await actor(page, SVART);
    const k = await actor(page, KETILL);
    if (turned < 0 && s?.target === 'P_STEERER' && k?.target === 'P_STEERER') turned = i;
  }
  const line = await finish(
    clip,
    'threat',
    await screen(page, 28.2 * 24, 36 * 24 - 16),
    `turned ${String(turned >= 0)}`,
  );
  await page.close();
  return line;
}

/** Svart thrusting at the steerer from the north, the south and the west at his full reach (DH-76). */
async function spearReach(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, DUSK, [80, 34.6], [80, 34]);
  await remove(page, [CONN]);
  const clip = new Clip(page, 'spear-reach', out);
  // The steerer 2 tiles south, then north, then east of him: he thrusts each way.
  for (const [dx, dy] of [
    [0, -2.05],
    [0, 2.05],
    [-2.05, 0],
  ] as const) {
    await engage(page, [SVART], { [SVART]: [80 + dx, 34.6 + dy] });
    let thrusts = 0;
    let was = '';
    for (let i = 0; i < FPS * 6 && thrusts < 2; i++) {
      await heal(page);
      // Hold him where he is (he would step back to his circle): the steerer at his reach.
      await page.evaluate(
        ([id, x, y]) => {
          const w = (window as unknown as { oeWorld: WW }).oeWorld;
          const a = w.onFoot.actors[id];
          if (a?.fight === undefined) return;
          if (a.fight.f.state === 'idle' || a.fight.f.state === 'block') {
            a.x = x * 24;
            a.y = y * 24;
          }
          const m = (a.fight.ai as unknown as { mind?: { state: string; patienceUntil: number } })
            .mind;
          if (m?.state === 'WAIT_FOR_OPENING') m.patienceUntil = 0;
        },
        [SVART, 80 + dx, 34.6 + dy] as const,
      );
      const s = await actor(page, SVART);
      const st = s?.state ?? '';
      if (st !== was && ['light1', 'light2', 'heavyRelease'].includes(st)) thrusts++;
      was = st;
      await clip.frame(thrusts === 1 && ['light1', 'light2', 'heavyRelease'].includes(st));
    }
  }
  const line = await finish(clip, 'spear-reach', await screen(page, 80 * 24, 34.6 * 24 - 16));
  await page.close();
  return line;
}

/** Captures every clip; returns a line for each. */
export async function pt4CombatCapture(browser: Browser): Promise<string> {
  const out = join(REPO_ROOT, 'docs/art/playtest-4/combat');
  mkdirSync(out, { recursive: true });
  const lines: string[] = [];
  const only = process.env['OE_CLIP'];
  const clips: [string, () => Promise<string>][] = [
    ['death', () => death(browser, out)],
    ['run-off', () => runOff(browser, out)],
    ['guard-return', () => guardReturn(browser, out)],
    ['threat', () => threat(browser, out)],
    ['spear-reach', () => spearReach(browser, out)],
  ];
  for (const [name, run] of clips)
    if (only === undefined || only.split(',').includes(name)) lines.push(await run());
  return lines.join('\n');
}

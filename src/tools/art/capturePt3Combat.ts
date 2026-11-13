/**
 * The user's third playtest's combat clips, captured from the real game (decisions DG-2 to DG-10;
 * Book 7 sections 01 and 12):   npm run capture -- playtest-3-combat   writes
 * docs/art/playtest-3/combat/
 *
 * Played in capture mode as the 2.5 clips are (captureCombat2.ts: two ticks a frame, every frame
 * exact), with the overlay shown (the speech lines and the prompts at the right edge are part of
 * what the clips show). A moment is staged through the page's world, then played with the keys,
 * reading the fighters' drawn state as a player reads it. Each is a GIF at 1x of the whole 640 x
 * 360 view (30 frames a second) and a still at 4x of its key moment:
 *   finisher     Svart beaten (the reel); the finisher held, then its one blow
 *   spare        Svart downed; let go: the shout, his reply, the spear dropped, him running
 *   warning      Conn alone at the stern turning alert: his warning, and the pause
 *   taunt        Svart and Conn together turning alert: the taunt, and the pause
 *   parry-only   Svart's guard turning every blow (sparks, his boast, the parry prompt), then a
 *                parry pressed in his wind-up and the riposte
 *   dodge-only   Ketill at the fold: the red blow (the red glint, the dodge prompt), dodged, and
 *                struck in its recovery
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
/** The clips' crop at 1x: the fighters, the prompts at the right edge and the speech line below. */
const VIEW: readonly [number, number] = [480, 270];
/** Book 10 "Parry": the press that centres the live ticks on the blow (wind-up 6 + 8 / 2). */
const PARRY_LEAD = 10;
/** Book 10 "Dodge": the middle of its invulnerable ticks (8 to 13). */
const DODGE_LEAD = 10;
const DUSK =
  '?capture&quality=full&view=play&name=Ash&body=A&camp=broch&kit=seax,bow&time=18:35&zone=ZONE_SK_STRAND';
const FOLD =
  '?capture&quality=full&view=play&name=Ash&body=A&camp=broch&kit=seax,bow&time=10:00&zone=ZONE_SK_CAIRN';

interface WF {
  state: string;
  since: number;
  activeAt: number;
  activeEnd: number;
  recoveryEnd: number;
  flashAt: number;
  move: string | null;
  missed: boolean;
  angle: number;
  facing: string;
  riposteUntil: number;
}
interface WA {
  x: number;
  y: number;
  facing: string;
  pose: string;
  task?: string;
  fight?: {
    f: WF;
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
      awareness: { level: number; state: string; heard: number };
      home: { x: number; y: number; facing: string };
      goal: unknown;
      mind: { state: string; patienceUntil: number };
    };
  };
}
interface WW {
  tick: number;
  player: { vitality: number };
  onFoot: {
    player: { x: number; y: number; facing: string; fight?: WF | null };
    actors: Record<string, WA>;
    battle: { engaged: boolean; groups: Record<string, { members: string[] }> } | null;
  };
}

async function openAt(
  browser: Browser,
  base: string,
  at: [number, number],
  camera: [number, number],
): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  await page.goto(
    `http://localhost:5287/${base}&at=${at[0]},${at[1]}&camera=${camera[0]},${camera[1]}`,
  );
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
  await tick(page, 30);
  return page;
}

/** Takes some of a band off (out of this clip), and holds others still at their work. */
async function only(page: Page, keep: string[], away: string[]): Promise<void> {
  await page.evaluate(
    ([k, gone]) => {
      const w = (window as unknown as { oeWorld: WW }).oeWorld;
      for (const id of gone) {
        Reflect.deleteProperty(w.onFoot.actors, id);
        for (const g of Object.values(w.onFoot.battle?.groups ?? {}))
          g.members = g.members.filter((m) => m !== id);
      }
      if (k.length < 0) throw new Error('never');
    },
    [keep, away] as const,
  );
}

/**
 * One of a band held still out of the way (choosing nothing): still counted with its band, so the
 * scavengers do not walk off as outmatched (Book 10 leaveIfStronger).
 */
async function holdAside(page: Page, id: string): Promise<void> {
  await page.evaluate((who) => {
    const w = (window as unknown as { oeWorld: WW }).oeWorld;
    const a = w.onFoot.actors[who];
    if (a?.fight === undefined) return;
    a.fight.ai.next = 1e12;
    a.fight.able = false;
    a.x = 84 * 24;
    a.y = 33.6 * 24;
    a.fight.ai.home = { ...a.fight.ai.home, x: a.x, y: a.y };
  }, id);
}

/** A foe placed, alert to the steerer and fighting, with its state set. */
async function engage(
  page: Page,
  id: string,
  at: [number, number] | null,
  set: { vitality?: number; state?: string; reel?: number } = {},
): Promise<void> {
  await page.evaluate(
    ([who, xy, s]) => {
      const w = (window as unknown as { oeWorld: WW }).oeWorld;
      const a = w.onFoot.actors[who];
      if (a?.fight === undefined) return;
      if (xy !== null) {
        a.x = xy[0] * 24;
        a.y = xy[1] * 24;
        a.fight.ai.home = { ...a.fight.ai.home, x: a.x, y: a.y };
      }
      a.fight.able = true;
      a.fight.ai.next = w.tick;
      a.fight.ai.awareness = { level: 100, state: 'ALERT', heard: w.tick };
      a.fight.ai.aware = true;
      a.fight.ai.target = 'P_STEERER';
      a.fight.ai.mode = 'FIGHT';
      a.fight.ai.memory = { x: w.onFoot.player.x, y: w.onFoot.player.y, tick: w.tick, seen: true };
      delete a.task;
      a.pose = 'idle';
      if (s.vitality !== undefined) a.fight.vitality = s.vitality;
      if (s.state !== undefined) {
        a.fight.f.state = s.state;
        a.fight.f.since = w.tick;
        a.fight.f.recoveryEnd = w.tick + (s.reel ?? 0);
        // Beaten: it chooses nothing more (no walking off) while the choice is made.
        a.fight.ai.next = 1e12;
      }
      if (w.onFoot.battle !== null) w.onFoot.battle.engaged = true;
    },
    [id, at, set] as const,
  );
}

async function foe(
  page: Page,
  id: string,
): Promise<{ f: WF | null; x: number; y: number; t: number; dead: boolean }> {
  return page.evaluate((who) => {
    const w = (window as unknown as { oeWorld: WW }).oeWorld;
    const a = w.onFoot.actors[who];
    return {
      f: a?.fight?.f ?? null,
      x: a?.x ?? 0,
      y: a?.y ?? 0,
      t: w.tick,
      dead: a === undefined || a.fight?.dead != null,
    };
  }, id);
}

async function steerer(page: Page): Promise<{ x: number; y: number; state: string }> {
  return page.evaluate(() => {
    const p = (window as unknown as { oeWorld: WW }).oeWorld.onFoot.player;
    return { x: p.x, y: p.y, state: p.fight?.state ?? 'idle' };
  });
}

async function heal(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { oeWorld: WW }).oeWorld.player.vitality = 100;
  });
}

/** Faces the cursor at a foe (the stance faces the cursor), so the strike arc holds it. */
async function faceFoe(page: Page, id: string): Promise<void> {
  const s = await foe(page, id);
  const at = await screen(page, s.x, s.y - 18);
  await page.mouse.move(at.x, at.y);
  await tick(page, 12);
}

async function lockOn(page: Page): Promise<void> {
  await page.keyboard.down('KeyZ');
  await tick(page);
  await page.keyboard.up('KeyZ');
  await tick(page);
}

async function strike(page: Page): Promise<void> {
  await page.mouse.down();
  await tick(page);
  await page.mouse.up();
}

async function done(clip: Clip, name: string, extra = '', from = 0): Promise<string> {
  // The still at 4x on the steerer (the fighters stand together); the GIF the lower right of the
  // view, where the stern and the fold stand, with the prompts and the captions.
  const me = await steerer(clip.page);
  const still = await screen(clip.page, me.x - 10, me.y - 20);
  clip.focus = { x: 400, y: 225 };
  const bytes = clip.write(from, VIEW, still);
  return `${name}.gif ${(bytes / 1e6).toFixed(2)} MB${extra === '' ? '' : ` (${extra})`}`;
}

async function finisher(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, DUSK, [90.6, 35.4], [90, 35]);
  await only(page, [SVART], [CONN]);
  await engage(page, SVART, [89.6, 35.4], { vitality: 18, state: 'reel', reel: 400 });
  await faceFoe(page, SVART);
  const clip = new Clip(page, 'finisher', out);
  for (let i = 0; i < FPS; i++) await clip.frame();
  await page.keyboard.down('KeyV');
  let landed = false;
  for (let i = 0; i < FPS * 3; i++) {
    const s = await foe(page, SVART);
    if (s.dead && !landed) landed = true;
    await clip.frame(landed);
    if (i === 20) await page.keyboard.up('KeyV');
  }
  await page.keyboard.up('KeyV');
  const line = await done(clip, 'finisher', `killed ${String(landed)}`);
  await page.close();
  return line;
}

async function spare(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, DUSK, [90.4, 35.4], [89, 35]);
  await only(page, [SVART], [CONN]);
  await engage(page, SVART, [89.4, 35.6], { vitality: 16, state: 'downed' });
  await faceFoe(page, SVART);
  const clip = new Clip(page, 'spare', out);
  for (let i = 0; i < FPS; i++) await clip.frame();
  await page.keyboard.down('KeyG');
  await tick(page);
  await page.keyboard.up('KeyG');
  for (let i = 0; i < FPS * 5; i++) await clip.frame(i === 6);
  const line = await done(clip, 'spare');
  await page.close();
  return line;
}

/** The steerer walks in on the stern from the west until the band turns alert, and speaks. */
async function approach(
  browser: Browser,
  out: string,
  name: string,
  away: string[],
): Promise<string> {
  const page = await openAt(browser, DUSK, [80.0, 35.0], [86, 35]);
  await only(page, [], away);
  const clip = new Clip(page, name, out);
  await page.keyboard.down('KeyD');
  let spoke = -1;
  for (let i = 0; i < FPS * 12 && (spoke < 0 || i < spoke + FPS * 3); i++) {
    const said = await page.evaluate(
      () => document.querySelector('.oe-overlay')?.getAttribute('data-caption-speech') ?? '',
    );
    if (said !== '' && spoke < 0) {
      spoke = i;
      await page.keyboard.up('KeyD');
    }
    await clip.frame(spoke >= 0 && i === spoke + 10);
  }
  await page.keyboard.up('KeyD');
  const line = await done(clip, name, spoke < 0 ? 'no line' : 'line spoken');
  await page.close();
  return line;
}

async function parryOnly(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, DUSK, [91.0, 35.4], [90, 35]);
  await holdAside(page, CONN);
  await engage(page, SVART, [89.4, 35.4]);
  await faceFoe(page, SVART);
  await lockOn(page);
  const clip = new Clip(page, 'parry-only', out);
  let turned = 0;
  let parried = false;
  let after = -1;
  for (let i = 0; i < FPS * 16 && (after < 0 || i < after + FPS * 2); i++) {
    const s = await foe(page, SVART);
    const me = await steerer(page);
    const f = s.f;
    // Two blows struck at his guard first (turned); then wait for his and parry it in its wind-up.
    if (
      turned < 2 &&
      me.state === 'idle' &&
      f?.state !== undefined &&
      !f.state.startsWith('charge')
    ) {
      const d = Math.hypot(s.x - me.x, s.y - me.y);
      if (d < 40 && i % 40 === 0) {
        await strike(page);
        turned++;
      }
    }
    if (f !== null && turned >= 2 && !parried) {
      const lands =
        ['light1', 'heavyRelease'].includes(f.state) && s.t < f.activeAt
          ? f.activeAt
          : f.state.startsWith('charge') && f.flashAt >= f.since
            ? f.flashAt + 28
            : null;
      const lead = lands === null ? -1 : lands - (s.t + 1);
      if (lead === PARRY_LEAD || lead === PARRY_LEAD + 1) {
        await page.keyboard.down('KeyQ');
        await tick(page);
        await page.keyboard.up('KeyQ');
      }
    }
    if (f?.state === 'parried' && !parried) {
      parried = true;
      await strike(page);
    }
    if (parried && (s.dead || f?.state === 'reel') && after < 0) after = i;
    await clip.frame(parried && f?.state === 'parried');
    await heal(page);
    if (i % 60 === 0)
      await page.evaluate((id) => {
        const m = (window as unknown as { oeWorld: WW }).oeWorld.onFoot.actors[id]?.fight?.ai.mind;
        if (m?.state === 'WAIT_FOR_OPENING') m.patienceUntil = 0;
      }, SVART);
  }
  const line = await done(clip, 'parry-only', `parried ${String(parried)}`);
  await page.close();
  return line;
}

async function dodgeOnly(browser: Browser, out: string): Promise<string> {
  const page = await openAt(browser, FOLD, [26.0, 33.0], [27, 34]);
  await only(page, [KETILL], [SVART, CONN]);
  await engage(page, KETILL, [28.4, 33.2]);
  await faceFoe(page, KETILL);
  await lockOn(page);
  const clip = new Clip(page, 'dodge-only', out);
  let dodged = 0;
  let hits = 0;
  let after = -1;
  let first = -1;
  for (let i = 0; i < FPS * 20 && (after < 0 || i < after); i++) {
    // Two red blows dodged and their recoveries struck at: the lesson shown; two seconds more.
    if (dodged >= 2 && after < 0) after = i + FPS * 2;
    const s = await foe(page, KETILL);
    const me = await steerer(page);
    const f = s.f;
    if (
      f !== null &&
      f.move === 'red' &&
      s.t < f.activeAt &&
      (f.activeAt - (s.t + 1) === DODGE_LEAD || f.activeAt - (s.t + 1) === DODGE_LEAD + 1)
    ) {
      // Across and a little past him, so his recovery is in reach (carefulFighter.ts).
      await page.keyboard.down('KeyS');
      await page.keyboard.down('Space');
      await tick(page);
      await page.keyboard.up('Space');
      await page.keyboard.up('KeyS');
      dodged++;
      if (first < 0) first = i;
    }
    const open = f !== null && f.move === 'red' && s.t >= f.activeEnd;
    if (open && me.state === 'idle') {
      const d = Math.hypot(s.x - me.x, s.y - me.y);
      // Walk in (held until in reach), then strike in his recovery.
      const keys = [
        s.x > me.x + 8 ? 'KeyD' : s.x < me.x - 8 ? 'KeyA' : '',
        s.y > me.y + 8 ? 'KeyS' : s.y < me.y - 8 ? 'KeyW' : '',
      ];
      if (d > 30)
        for (const k of keys)
          if (k !== '') await page.keyboard.down(k);
          else {
            for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) await page.keyboard.up(k);
            await strike(page);
            hits++;
          }
    } else for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) await page.keyboard.up(k);
    if (s.dead && after < 0) after = i + FPS * 2;
    await clip.frame(f !== null && f.move === 'red' && f.flashAt === s.t);
    await heal(page);
    if (i % 60 === 0)
      await page.evaluate((id) => {
        const m = (window as unknown as { oeWorld: WW }).oeWorld.onFoot.actors[id]?.fight?.ai.mind;
        if (m?.state === 'WAIT_FOR_OPENING') m.patienceUntil = 0;
      }, KETILL);
  }
  const line = await done(
    clip,
    'dodge-only',
    `dodged ${String(dodged)}, struck ${String(hits)}`,
    Math.max(0, first - FPS),
  );
  await page.close();
  return line;
}

/** Captures every clip; returns a line for each. */
export async function pt3CombatCapture(browser: Browser): Promise<string> {
  const out = join(REPO_ROOT, 'docs/art/playtest-3/combat');
  mkdirSync(out, { recursive: true });
  const lines: string[] = [];
  const only_ = process.env['OE_CLIP'];
  const clips: [string, () => Promise<string>][] = [
    ['finisher', () => finisher(browser, out)],
    ['spare', () => spare(browser, out)],
    ['warning', () => approach(browser, out, 'warning', [SVART])],
    ['taunt', () => approach(browser, out, 'taunt', [])],
    ['parry-only', () => parryOnly(browser, out)],
    ['dodge-only', () => dodgeOnly(browser, out)],
  ];
  for (const [name, run] of clips)
    if (only_ === undefined || only_.split(',').includes(name)) lines.push(await run());
  return lines.join('\n');
}

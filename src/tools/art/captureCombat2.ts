/**
 * Combat v2's clips, captured from the real game (design addendum 2.4 section 1; Book 7 sections
 * 12 and 14):   npm run capture -- rework-2.4-combat   writes docs/art/rework-2.4/combat/
 *
 * Each clip is played in capture mode (?capture: the page advances only when stepped, two ticks a
 * frame, so every frame is exact) at the stern on Wreck Strand at the first dusk, where Svart and
 * Conn strip the wreck. A moment is staged through the page's world (as the unit tests stage
 * it: a foe set where it is wanted, aware or not, held from choosing), and then played with the
 * keys and the mouse. Each is written as a GIF at 1x (the middle 320 x 180 of the view, 30 frames
 * a second) and a still at 4x of its key moment:
 *   parry-riposte    Svart's slow heavy parried (the spark, the long hitstop), and the riposte
 *   back-off         locked on to Svart, backing away and strafing while facing him
 *   hit-reactions    a light seax hit (flinch, knockback, flash, spray) then a charged heavy (the
 *                    stagger and the shake)
 *   hurt-backs-off   Svart, badly hurt, holding off further and calling for help
 *   arrow-blocked    an arrow stopped by Svart's raised shield (the thunk, the splinters)
 *   arrow-dodged     an aware Svart sidestepping an arrow after its tell
 *   backstab         a backstab on Svart at work, unaware
 * Needs ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { REPO_ROOT } from './loadTitleArt.ts';

const TICK = 1000 / 60;
/** Two ticks a frame: 30 frames a second. */
const FRAME_TICKS = 2;
export const FPS = 30;
const SVART = 'E_WRECKER_SVART';
const CONN = 'E_WRECKER_CONN';
const BASE =
  '?capture&quality=full&view=play&name=Ash&body=A&camp=broch&kit=seax,bow&time=18:35&zone=ZONE_SK_STRAND';

export async function tick(page: Page, n = 1): Promise<void> {
  await page.evaluate(
    ([k, ms]) => {
      const w = window as unknown as { oeStep: (ms: number) => void };
      for (let i = 0; i < k; i++) w.oeStep(ms);
    },
    [n, TICK] as const,
  );
}

export async function open(
  browser: Browser,
  at: [number, number],
  camera: [number, number],
): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  await page.goto(
    `http://localhost:5287/${BASE}&at=${at[0]},${at[1]}&camera=${camera[0]},${camera[1]}`,
  );
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 30_000 });
  await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
  await tick(page, 30);
  return page;
}

/**
 * Stages the foes through the page's world: `who` placed and set, Conn held at his work (he
 * chooses nothing, so he shoots no one), as the unit tests do.
 */
export async function stage(
  page: Page,
  who: {
    x?: number;
    y?: number;
    alert?: boolean;
    held?: boolean;
    able?: boolean;
    shield?: boolean;
    vitality?: number;
    heal?: boolean;
    angle?: number;
    engaged?: boolean;
  },
): Promise<void> {
  await page.evaluate(
    ([w, ids]) => {
      interface A {
        x: number;
        y: number;
        facing: string;
        pose: string;
        task?: string;
        intent?: unknown;
        walk?: unknown;
        fight?: {
          vitality: number;
          maxVitality: number;
          able: boolean;
          f: { shield: boolean; angle: number; facing: string };
          ai: {
            next: number;
            aware: boolean;
            target: string | null;
            memory: unknown;
            awareness: { level: number; state: string; heard: number };
            home: { x: number; y: number; facing: string };
            goal: unknown;
          };
        };
      }
      const world = (
        window as unknown as {
          oeWorld: {
            tick: number;
            onFoot: {
              player: { x: number; y: number };
              actors: Record<string, A>;
              battle: { engaged: boolean } | null;
            };
          };
        }
      ).oeWorld;
      const onFoot = world.onFoot;
      const conn = onFoot.actors[ids[1]];
      if (conn?.fight !== undefined) {
        conn.fight.ai.next = 1e12;
        conn.fight.able = false;
        // Out of the way, north-west at the dune's foot, and still.
        conn.x = 86.0 * 24;
        conn.y = 33.6 * 24;
        delete conn.intent;
        delete conn.walk;
        // His work is here now, so he does not walk back to the stern.
        conn.fight.ai.home = { ...conn.fight.ai.home, x: conn.x, y: conn.y };
        conn.fight.ai.goal = null;
      }
      const a = onFoot.actors[ids[0]];
      if (a?.fight === undefined) return;
      if (w.x !== undefined) a.x = w.x * 24;
      if (w.y !== undefined) a.y = w.y * 24;
      if (w.vitality !== undefined) a.fight.vitality = w.vitality;
      if (w.heal === true) a.fight.vitality = a.fight.maxVitality;
      if (w.shield !== undefined) a.fight.f.shield = w.shield;
      if (w.angle !== undefined) {
        a.fight.f.angle = w.angle;
        a.fight.f.facing =
          Math.abs(Math.cos(w.angle)) >= Math.abs(Math.sin(w.angle))
            ? Math.cos(w.angle) >= 0
              ? 'e'
              : 'w'
            : Math.sin(w.angle) > 0
              ? 's'
              : 'n';
        a.facing = a.fight.f.facing;
      }
      if (w.alert === true) {
        a.fight.ai.awareness = { level: 100, state: 'ALERT', heard: world.tick };
        a.fight.ai.aware = true;
        a.fight.ai.target = 'P_STEERER';
        a.fight.ai.memory = {
          x: onFoot.player.x,
          y: onFoot.player.y,
          tick: world.tick,
          seen: true,
        };
        delete a.task;
        a.pose = 'idle';
      }
      if (w.held === true) a.fight.ai.next = 1e12;
      if (w.able !== undefined) a.fight.able = w.able;
      if (w.engaged === true && onFoot.battle !== null) onFoot.battle.engaged = true;
    },
    [who, [SVART, CONN]] as const,
  );
}

/** Svart as the page reports him: state and ticks to his strike's active frames. */
export async function svart(
  page: Page,
): Promise<{ state: string; toActive: number; x: number; y: number }> {
  const raw = (await page.locator('.oe-overlay').getAttribute('data-fighters')) ?? '';
  const f = raw.split(',').find((s) => s.startsWith(`${SVART}:`)) ?? '';
  const [, state = '', , x = '0', y = '0', to = '-1'] = f.split(':');
  return { state, toActive: Number(to), x: Number(x), y: Number(y) };
}

/** The screen point of a world point (the camera is held: data-camera). */
export async function screen(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const cam = ((await page.locator('.oe-overlay').getAttribute('data-camera')) ?? '0,0')
    .split(',')
    .map(Number);
  return { x: x - (cam[0] ?? 0), y: y - (cam[1] ?? 0) };
}

/**
 * Turns to Svart (the stance faces the cursor) and locks on: the lock takes the foe nearest the
 * facing, and Conn stands behind at his work.
 */
export async function lockSvart(page: Page): Promise<void> {
  const s = await svart(page);
  const at = await screen(page, s.x, s.y - 18);
  await page.mouse.move(at.x, at.y);
  await tick(page, 20);
  await page.keyboard.down('KeyZ');
  await tick(page);
  await page.keyboard.up('KeyZ');
  await tick(page);
}

export class Clip {
  readonly #dir: string;
  #n = 0;
  #key: string | null = null;
  readonly page: Page;
  readonly name: string;
  readonly out: string;
  /** The crops' centre on the view (game pixels): between the steerer and Svart. */
  focus = { x: 320, y: 180 };
  constructor(page: Page, name: string, out: string) {
    this.page = page;
    this.name = name;
    this.out = out;
    this.#dir = join(out, `.${name}`);
    rmSync(this.#dir, { recursive: true, force: true });
    mkdirSync(this.#dir, { recursive: true });
  }

  /**
   * Centres the crops between the steerer and Svart (the stern lies at the strand's east edge,
   * where the camera stops short of centring on them).
   */
  async aim(): Promise<void> {
    const at = await this.page.evaluate((id) => {
      const o = (
        window as unknown as {
          oeWorld: {
            onFoot: {
              player: { x: number; y: number };
              actors: Record<string, { x: number; y: number }>;
            };
          };
        }
      ).oeWorld.onFoot;
      const a = o.actors[id] ?? o.player;
      return { x: (o.player.x + a.x) / 2, y: (o.player.y + a.y) / 2 - 16 };
    }, SVART);
    this.focus = await screen(this.page, at.x, at.y);
  }

  /** Steps a frame (two ticks) and records it. `key` marks it as the clip's key moment. */
  async frame(key = false): Promise<void> {
    await tick(this.page, FRAME_TICKS);
    const file = join(this.#dir, `${String(this.#n).padStart(4, '0')}.png`);
    writeFileSync(file, await this.page.screenshot());
    if (key && this.#key === null) this.#key = file;
    this.#n++;
  }

  get frames(): number {
    return this.#n;
  }

  /** Drops the frames from `to` on (a take that missed its moment), to record again from there. */
  rewind(to: number): void {
    for (let i = to; i < this.#n; i++)
      rmSync(join(this.#dir, `${String(i).padStart(4, '0')}.png`), { force: true });
    if (this.#key !== null && Number(/(\d+)\.png$/.exec(this.#key)?.[1] ?? 0) >= to)
      this.#key = null;
    this.#n = Math.min(this.#n, to);
  }

  /** The GIF at 1x (the middle 320 x 180) and the key moment at 4x; returns the GIF's bytes. */
  write(
    from = 0,
    size: readonly [number, number] = [320, 180],
    still: { readonly x: number; readonly y: number } = this.focus,
  ): number {
    const gif = join(this.out, `${this.name}.gif`);
    const crop = (w: number, h: number, at = this.focus): string => {
      const x = Math.round(Math.min(Math.max(at.x - w / 2, 0), 640 - w)) * 2;
      const y = Math.round(Math.min(Math.max(at.y - h / 2, 0), 360 - h)) * 2;
      return `crop=${String(w * 2)}:${String(h * 2)}:${String(x)}:${String(y)}`;
    };
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FPS),
      '-start_number',
      String(from),
      '-i',
      join(this.#dir, '%04d.png'),
      '-vf',
      `${crop(size[0], size[1])},scale=${String(size[0])}:${String(size[1])}:flags=neighbor,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none`,
      gif,
    ]);
    if (this.#key !== null)
      execFileSync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-i',
        this.#key,
        '-vf',
        `${crop(160, 90, still)},scale=640:360:flags=neighbor`,
        join(this.out, `${this.name}@4x.png`),
      ]);
    rmSync(this.#dir, { recursive: true, force: true });
    return statSync(gif).size;
  }
}

async function parryRiposte(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [92.3, 35.1], [93, 35]);
  await stage(page, { x: 93.9, y: 35.1, alert: true, engaged: true, angle: Math.PI });
  const clip = new Clip(page, 'parry-riposte', out);
  await clip.aim();
  await lockSvart(page);
  let parried = false;
  let riposted = 0;
  let landed = false;
  for (let i = 0; i < FPS * 12 && riposted < FPS * 1.5; i++) {
    const s = await svart(page);
    // His slow heavy for preference (the dusk fight's lesson); after four seconds any strike.
    const strike = s.state === 'heavyRelease' || (i > FPS * 4 && s.toActive >= 0);
    if (!parried && strike && s.toActive > 2 && s.toActive <= 6) {
      await page.keyboard.press('KeyQ');
      parried = true;
    }
    if (parried && s.state === 'parried' && riposted === 0) {
      const at = await screen(page, s.x, s.y - 18);
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await tick(page);
      await page.mouse.up();
      riposted = 1;
    }
    if (riposted > 0) riposted++;
    if (s.state === 'parried') landed = true;
    await clip.frame(parried && s.state === 'parried');
    await page.evaluate(() => {
      (window as unknown as { oeWorld: { player: { vitality: number } } }).oeWorld.player.vitality =
        100;
    });
  }
  const bytes = clip.write(Math.max(0, clip.frames - FPS * 4));
  await page.close();
  return `parry-riposte.gif ${(bytes / 1e6).toFixed(2)} MB (parry pressed ${String(parried)}, landed ${String(landed)})`;
}

async function backOff(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [91.6, 35.1], [92, 35]);
  await stage(page, {
    x: 93.8,
    y: 35.1,
    alert: true,
    held: true,
    able: false,
    engaged: true,
    angle: Math.PI,
  });
  const clip = new Clip(page, 'back-off', out);
  await clip.aim();
  await lockSvart(page);
  for (let i = 0; i < 10; i++) await clip.frame();
  await page.keyboard.down('KeyA');
  for (let i = 0; i < FPS * 1.6; i++) await clip.frame(i === 20);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyS');
  for (let i = 0; i < FPS * 1.2; i++) await clip.frame();
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyW');
  for (let i = 0; i < FPS * 1.2; i++) await clip.frame();
  await page.keyboard.up('KeyW');
  for (let i = 0; i < 10; i++) await clip.frame();
  const bytes = clip.write();
  await page.close();
  return `back-off.gif ${(bytes / 1e6).toFixed(2)} MB`;
}

async function hitReactions(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [92.8, 35.1], [93.3, 35]);
  await stage(page, {
    x: 93.8,
    y: 35.1,
    alert: true,
    held: true,
    able: false,
    engaged: true,
    vitality: 300,
    angle: Math.PI,
  });
  const clip = new Clip(page, 'hit-reactions', out);
  await clip.aim();
  const s = await svart(page);
  const at = await screen(page, s.x, s.y - 18);
  await page.mouse.move(at.x, at.y);
  for (let i = 0; i < 8; i++) await clip.frame();
  // A light hit: pressed and let go.
  await page.mouse.down();
  await tick(page);
  await page.mouse.up();
  for (let i = 0; i < FPS * 1.2; i++) await clip.frame(i === 4);
  // A charged heavy: held to level 2, then let go.
  await page.mouse.down();
  for (let i = 0; i < 24; i++) await clip.frame();
  await page.mouse.up();
  for (let i = 0; i < FPS * 1.6; i++) await clip.frame();
  const bytes = clip.write();
  await page.close();
  return `hit-reactions.gif ${(bytes / 1e6).toFixed(2)} MB`;
}

async function hurtBacksOff(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [91.4, 35.1], [92.5, 35]);
  await stage(page, { x: 93.4, y: 35.1, alert: true, engaged: true, vitality: 30, angle: Math.PI });
  const clip = new Clip(page, 'hurt-backs-off', out);
  await clip.aim();
  for (let i = 0; i < FPS * 5; i++) {
    if (i === 10) await page.keyboard.down('KeyD');
    if (i === FPS * 3) await page.keyboard.up('KeyD');
    await clip.frame(i === FPS * 2);
    await page.evaluate(() => {
      (window as unknown as { oeWorld: { player: { vitality: number } } }).oeWorld.player.vitality =
        100;
    });
  }
  const bytes = clip.write();
  await page.close();
  return `hurt-backs-off.gif ${(bytes / 1e6).toFixed(2)} MB`;
}

async function shootAt(page: Page): Promise<void> {
  const s = await svart(page);
  const at = await screen(page, s.x, s.y - 16);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
}

async function arrowBlocked(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [88.6, 35.1], [91.2, 35]);
  await stage(page, {
    x: 93.8,
    y: 35.1,
    alert: true,
    held: true,
    able: true,
    shield: true,
    angle: Math.PI,
  });
  await page.keyboard.press('Digit2');
  await tick(page, 2);
  const clip = new Clip(page, 'arrow-blocked', out);
  await clip.aim();
  for (let i = 0; i < 6; i++) await clip.frame();
  await shootAt(page);
  for (let i = 0; i < 18; i++) await clip.frame();
  await page.mouse.up();
  let thunk = false;
  for (let i = 0; i < FPS * 1.6; i++) {
    const before = thunk;
    const inShield = await page.evaluate(() =>
      (
        window as unknown as { oeWorld: { onFoot: { stuck: { in: string }[] } } }
      ).oeWorld.onFoot.stuck.some((x) => x.in === 'shield'),
    );
    thunk = thunk || inShield;
    await clip.frame(thunk && !before);
  }
  const bytes = clip.write();
  await page.close();
  return `arrow-blocked.gif ${(bytes / 1e6).toFixed(2)} MB`;
}

async function arrowDodged(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [88.6, 35.1], [91.2, 35]);
  const svartAt = {
    x: 93.8,
    y: 35.1,
    alert: true,
    held: true,
    // The fight already on, so drawing the bow does not start it and set him choosing again.
    engaged: true,
    able: true,
    shield: false,
    // Whole again for each take, so the shots he does not sidestep never fell him.
    heal: true,
    angle: Math.PI,
  };
  await stage(page, svartAt);
  await page.keyboard.press('Digit2');
  await tick(page, 2);
  const clip = new Clip(page, 'arrow-dodged', out);
  await clip.aim();
  // Shot after shot until he sidesteps one (Book 10's chance); each take that is not sidestepped
  // is dropped, so the clip is the one shot.
  let shot = 0;
  let dodged = false;
  for (; shot < 40 && !dodged; shot++) {
    clip.rewind(0);
    await stage(page, svartAt);
    for (let i = 0; i < 4; i++) await clip.frame();
    await shootAt(page);
    for (let i = 0; i < 18; i++) await clip.frame();
    await page.mouse.up();
    let since = -1;
    for (let i = 0; i < FPS * 1.2; i++) {
      const s = await svart(page);
      if (s.state === 'sidestep' && since < 0) since = 0;
      await clip.frame(since === 5);
      if (since >= 0) since++;
    }
    dodged = since >= 0;
    await page.evaluate(() => {
      const w = (
        window as unknown as { oeWorld: { player: { inventory: Record<string, number> } } }
      ).oeWorld;
      w.player.inventory['ITEM_ARROW'] = 6;
    });
  }
  const bytes = clip.write();
  await page.close();
  return `arrow-dodged.gif ${(bytes / 1e6).toFixed(2)} MB (${dodged ? `sidestepped at shot ${String(shot)}` : 'no sidestep in 40 shots'})`;
}

async function backstab(browser: Browser, out: string): Promise<string> {
  const page = await open(browser, [94.75, 35.15], [93.8, 35]);
  await stage(page, { x: 93.8, y: 35.1, angle: Math.PI });
  const clip = new Clip(page, 'backstab', out);
  await clip.aim();
  const s = await svart(page);
  const at = await screen(page, s.x, s.y - 18);
  await page.mouse.move(at.x, at.y);
  for (let i = 0; i < 12; i++) await clip.frame();
  await page.mouse.down();
  await tick(page);
  await page.mouse.up();
  for (let i = 0; i < FPS * 2.4; i++) await clip.frame(i === 9);
  const bytes = clip.write();
  await page.close();
  return `backstab.gif ${(bytes / 1e6).toFixed(2)} MB`;
}

/** Captures every clip; returns a line for each. */
export async function combat2Capture(browser: Browser): Promise<string> {
  const out = join(REPO_ROOT, 'docs/art/rework-2.4/combat');
  mkdirSync(out, { recursive: true });
  const lines: string[] = [];
  // OE_CLIP=<name>[,<name>] captures those clips alone (while working on them).
  const only = process.env['OE_CLIP'];
  for (const f of [
    parryRiposte,
    backOff,
    hitReactions,
    hurtBacksOff,
    arrowBlocked,
    arrowDodged,
    backstab,
  ])
    if (only === undefined || only.split(',').includes(f.name)) lines.push(await f(browser, out));
  return lines.join('\n');
}

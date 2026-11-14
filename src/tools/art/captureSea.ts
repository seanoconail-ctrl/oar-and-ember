/**
 * Stage 13's capture (`npm run capture -- stage-13`, after the strand's still in capture.ts): the
 * sea map's chart by day, in fog, in a storm and by night, each a still at 1x and 2x with its motion
 * with the camera still (the words hidden, as the measure of every place); with reduced motion; the
 * plotting screen and the rising weather's choice with their words; a 10-second clip of the boat
 * under way; and the wreck on its reef (work package C's scene) when it is there, skipped cleanly
 * when it is not. Written to docs/art/captures/stage-13/.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { REPO_ROOT } from './loadTitleArt.ts';
import { continuousMotion, MOTION_CELL } from './motion.ts';
import { decodePng, encodePng } from './png.ts';
import type { RgbaImage } from './png.ts';

const FPS = 25;
const STEP_MS = 1000 / FPS;
const AT =
  'capture&quality=full&view=play&name=Ash&body=A&camp=broch&crew=1&launch=done&zone=ZONE_SK_STRAND';

function half(img: RgbaImage): RgbaImage {
  const width = img.width / 2;
  const height = img.height / 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 4; c++)
        data[(y * width + x) * 4 + c] = img.data[(y * 2 * img.width + x * 2) * 4 + c] ?? 0;
  return { width, height, data };
}

function motionMap(still: RgbaImage, cells: readonly boolean[], cellsX: number): RgbaImage {
  const marked = { width: still.width, height: still.height, data: Uint8Array.from(still.data) };
  cells.forEach((moving, k) => {
    if (moving) return;
    const cx = (k % cellsX) * MOTION_CELL;
    const cy = Math.floor(k / cellsX) * MOTION_CELL;
    for (let y = cy; y < cy + MOTION_CELL; y++)
      for (let x = cx; x < cx + MOTION_CELL; x++) {
        const i = (y * still.width + x) * 4;
        marked.data[i] = Math.round((marked.data[i] ?? 0) * 0.3 + 140);
        marked.data[i + 1] = Math.round((marked.data[i + 1] ?? 0) * 0.3 + 28);
        marked.data[i + 2] = Math.round((marked.data[i + 2] ?? 0) * 0.3 + 28);
      }
  });
  return marked;
}

async function shot(page: Page): Promise<RgbaImage> {
  return decodePng(await page.screenshot());
}

async function step(page: Page, frames = 1, ms = STEP_MS): Promise<void> {
  await page.evaluate(
    ([n, d]) => {
      const w = window as unknown as { oeStep: (ms: number, draw?: boolean) => void };
      for (let i = 0; i < n; i++) w.oeStep(d, i === n - 1);
    },
    [frames, ms] as const,
  );
}

async function attr(page: Page, name: string): Promise<string> {
  return (await page.locator('.oe-overlay').getAttribute(`data-${name}`)) ?? '';
}

async function open(browser: Browser, port: number, query: string): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://localhost:${port}/?${query}`);
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 60_000 });
  await step(page, 4);
  return page;
}

async function openChart(page: Page): Promise<void> {
  await page.keyboard.press('KeyM');
  await step(page, 3);
}

export interface SeaView {
  readonly name: string;
  readonly what: string;
  readonly share: number;
}

export interface SeaCaptureResult {
  readonly views: readonly SeaView[];
  readonly screens: readonly { readonly name: string; readonly what: string }[];
  readonly clipSeconds: number;
  readonly wreck: SeaView | null;
  readonly frameMs: number;
}

/** A still at 1x and 2x and its motion over 41 frames (6.4 s), the words hidden. */
async function still(page: Page, out: string, name: string): Promise<number> {
  const style = await page.addStyleTag({
    content: '.oe-overlay { visibility: hidden !important; }',
  });
  await step(page, 10);
  const still2 = await shot(page);
  writeFileSync(join(out, `${name}@2x.png`), encodePng(still2));
  const still1 = half(still2);
  writeFileSync(join(out, `${name}.png`), encodePng(still1));
  const frames: Uint8Array[] = [still1.data];
  for (let i = 0; i < 40; i++) {
    await step(page, 4);
    frames.push(half(await shot(page)).data);
  }
  const m = continuousMotion(frames, 640, 360);
  writeFileSync(join(out, `${name}-motion.png`), encodePng(motionMap(still1, m.cells, m.cellsX)));
  await style.evaluate((el) => {
    (el as unknown as { remove: () => void }).remove();
  });
  return m.share;
}

export async function seaCapture(
  browser: Browser,
  out: string,
  port: number,
): Promise<SeaCaptureResult> {
  mkdirSync(out, { recursive: true });
  const views: SeaView[] = [];
  const charts = [
    {
      name: 'chart-day',
      query: `${AT}&time=10:00&weather=clear`,
      what: 'The chart by day, the wind fair from the south-west: the sea’s sheen, cloud shadows and gusts over the land, the painted route to Carrick, the weather’s marks',
    },
    {
      name: 'chart-fog',
      query: `${AT}&time=10:00&weather=fog`,
      what: 'The chart in fog: two layers drifting downwind at their own speeds, the token dimmed',
    },
    {
      name: 'chart-storm',
      query: `${AT}&time=10:00&weather=storm`,
      what: 'The chart in a storm: darkened, rain slanting downwind, lightning’s double flicker and bolt, low scud',
    },
    {
      name: 'chart-night',
      query: `${AT}&time=22:30&weather=clear`,
      what: 'The chart by night: the night grade, the moonlit sheen, clouds crossing it',
    },
    {
      name: 'chart-reduced',
      query: `${AT}&time=10:00&weather=fog&motion=reduced`,
      what: 'Reduced motion, in fog: the fog one still layer swelling softly, the sea and clouds slower',
    },
  ];
  for (const c of charts) {
    const page = await open(browser, port, c.query);
    await openChart(page);
    await page.locator('[data-panel=plot] [data-place=SITE_CARRICK]').click();
    await step(page, 2);
    views.push({ name: c.name, what: c.what, share: await still(page, out, c.name) });
    await page.close();
  }
  const screens: { name: string; what: string }[] = [];
  let clipSeconds: number;
  // The plotting screen with its words, and the choice.
  {
    const page = await open(browser, port, `${AT}&time=10:00&weather=clear&seamet=ENC_OPEN:wreck`);
    await openChart(page);
    await page.locator('[data-panel=plot] [data-place=SITE_CARRICK]').click();
    await step(page, 4);
    const img = await shot(page);
    writeFileSync(join(out, 'screen-plot@2x.png'), encodePng(img));
    writeFileSync(join(out, 'screen-plot.png'), encodePng(half(img)));
    screens.push({
      name: 'screen-plot',
      what: 'The plotting screen: Carrick Landing chosen, its course painted with a pin at its end; its watches, landfall, stores and the raid it begins; the weather in words beside its marks',
    });
    await page.close();
  }
  {
    const page = await open(browser, port, `${AT}&time=10:00&weather=rising&seamet=ENC_OPEN:wreck`);
    await openChart(page);
    await page.locator('[data-panel=plot] [data-place=SITE_CARRICK]').click();
    await step(page, 2);
    await page.locator('[data-panel=plot] [data-action=sail]').click();
    for (let i = 0; i < 20 && (await attr(page, 'sea')) !== 'choice'; i++) await step(page, 4);
    await step(page, 4);
    const img = await shot(page);
    writeFileSync(join(out, 'screen-choice@2x.png'), encodePng(img));
    writeFileSync(join(out, 'screen-choice.png'), encodePng(half(img)));
    screens.push({
      name: 'screen-choice',
      what: 'The sea map’s choice, weather rising: press on or shelter, each with what follows from it in words; the watches wait',
    });
    // The clip: pressing on, ten seconds under way (two and a half watches), the words shown.
    await page.keyboard.press('Digit1');
    const dir = join(out, '.clip');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let frames = 0;
    while (frames < FPS * 10) {
      await step(page);
      writeFileSync(join(dir, `${String(frames).padStart(4, '0')}.png`), await page.screenshot());
      frames++;
    }
    const img2 = await shot(page);
    writeFileSync(join(out, 'screen-sail@2x.png'), encodePng(img2));
    writeFileSync(join(out, 'screen-sail.png'), encodePng(half(img2)));
    screens.push({
      name: 'screen-sail',
      what: 'Under way: rowing into the rising south-westerly, the course marching towards its pin, the watch passing with the clock running on, the landfall in words',
    });
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FPS),
      '-i',
      join(dir, '%04d.png'),
      '-c:v',
      'libx264',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      join(out, 'voyage-clip.mp4'),
    ]);
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FPS),
      '-i',
      join(dir, '%04d.png'),
      '-vf',
      'fps=12.5,scale=640:360:flags=neighbor,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=none',
      join(out, 'voyage-clip.gif'),
    ]);
    rmSync(dir, { recursive: true, force: true });
    await page.close();
    clipSeconds = frames / FPS;
  }
  // The script's share of a chart frame, as the play view reads it.
  let frameMs: number;
  {
    const page = await open(browser, port, `${AT}&time=10:00&weather=storm`);
    await openChart(page);
    await step(page, 60);
    frameMs = Number(await attr(page, 'frame-ms'));
    await page.close();
  }
  // The wreck on its reef, if work package C's scene is there.
  let wreck: SeaView | null = null;
  if (existsSync(join(REPO_ROOT, 'content/zones/zone_sea_wreck.json'))) {
    try {
      const page = await open(
        browser,
        port,
        'capture&quality=full&view=play&name=Ash&body=A&camp=broch&crew=1&wreck=1',
      );
      const zone = await page.evaluate(
        () =>
          (window as unknown as { oeWorld: { onFoot: { zone: string } | null } }).oeWorld.onFoot
            ?.zone ?? '',
      );
      if (zone.includes('WRECK')) {
        await step(page, 30);
        wreck = {
          name: 'wreck',
          what: 'The wreck on its reef (work package C’s scene), on foot, handed off from the voyage',
          share: await still(page, out, 'wreck'),
        };
      }
      await page.close();
    } catch (e) {
      console.log(`the wreck was skipped: ${String(e)}`);
    }
  }
  return { views, screens, clipSeconds, wreck, frameMs };
}

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

export function seaReadme(
  label: string,
  strand: number,
  c: SeaCaptureResult,
  threshold: number,
  reduced: number,
): string {
  const inWorld = c.views.filter((v) => v.name !== 'chart-reduced');
  const red = c.views.find((v) => v.name === 'chart-reduced');
  return [
    `# Capture: ${label}`,
    '',
    'Made by `npm run capture -- ' +
      label +
      '` (src/tools/art/capture.ts and captureSea.ts). Compare with',
    '`docs/art/reference/` (Book 7 section 14) and the art in `docs/art/stage-13/`.',
    '',
    '| File | What it is |',
    '|---|---|',
    '| `still.png`, `still@2x.png`, `motion.png`, `compare.png` | Wreck Strand where the steerer gets up, its motion map and the reference beside it (unchanged by this stage) |',
    ...c.views.map((v) => `| \`${v.name}.png\` (and @2x, \`-motion.png\`) | ${v.what} |`),
    ...c.screens.map((s) => `| \`${s.name}.png\` (and @2x) | ${s.what} |`),
    `| \`voyage-clip.mp4\`, \`voyage-clip.gif\` | ${c.clipSeconds.toFixed(1)} s at 25 fps (the gif at 1x, 12.5 fps): pressing on from the choice, the boat under way with the words shown |`,
    ...(c.wreck === null
      ? ['| (the wreck) | Not captured: work package C’s scene was not there |']
      : [`| \`wreck.png\` (and @2x, \`-motion.png\`) | ${c.wreck.what} |`]),
    '',
    '## Motion with the camera still',
    '',
    '| View | Continuous motion |',
    '|---|---|',
    `| Wreck Strand | ${pct(strand)} |`,
    ...c.views.map((v) => `| ${v.name} | ${pct(v.share)} |`),
    ...(c.wreck === null ? [] : [`| wreck | ${pct(c.wreck.share)} |`]),
    `| Book 7 threshold | ${pct(threshold)} (reduced motion ${pct(reduced)}) |`,
    '',
    inWorld.every((v) => v.share >= threshold) && (red === undefined || red.share >= reduced)
      ? 'The chart meets the threshold in every weather, by real moving water, cloud and fog (no waiver).'
      : '**A view is below the threshold: the stage is not done.**',
    '',
    `The script's share of a chart frame in a storm as the stepped capture reads it: ${c.frameMs.toFixed(2)} ms (most stepped frames are not drawn). Book 2's limit is 5.5 ms.`,
    '',
  ].join('\n');
}

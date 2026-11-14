/**
 * Renders the pause menu and the title menu (Book 7 section 10; decisions DG-15 to DG-19) at 1x
 * and 4x into docs/art/playtest-3/interface/, over real frames of the game (the stage captures), so
 * the menu art can be inspected as it is drawn in play: the list paused over its dimmed frame, the
 * list as an overlay over a running world, the save page with two slots' screenshots and two empty
 * cards, the load page, the settings, the controls, a confirmation, and the title's menu.
 *
 *   node src/tools/art/render-menu.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatString } from '../../content/strings.ts';
import { parseInterfaceBalance } from '../../content/interfaceBalance.ts';
import { ACTIONS, DEFAULT_BINDINGS } from '../../input/actions.ts';
import { compileFont } from '../../render/bitmapFont.ts';
import { createIndexedImage, NO_PIXEL, toRgba } from '../../render/indexedImage.ts';
import type { IndexedImage } from '../../render/indexedImage.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../render/viewport.ts';
import type { SaveSlotView } from '../../persist/manager.ts';
import type { SaveHeader } from '../../persist/save.ts';
import { composeTitleFrame } from '../../scenes/title.ts';
import { composePauseMenu, composeTitleMenu, dimFrame } from '../../scenes/pauseMenuArt.ts';
import type { MenuFrame } from '../../scenes/pauseMenuArt.ts';
import { actionLabel, agoText, controlLabel, PauseMenu } from '../../ui/pauseMenu.ts';
import type { SlotView } from '../../ui/pauseMenu.ts';
import type { PauseEnv } from '../../ui/pauseMenu.ts';
import { makeThumbnail } from '../../ui/thumbnail.ts';
import type { Rgba } from '../../ui/thumbnail.ts';
import { loadBalanceJson } from '../content/loadBalance.ts';
import { loadPalette } from './artFiles.ts';
import { loadStrings, loadTitleArt, REPO_ROOT } from './loadTitleArt.ts';
import { decodePng, encodePng, scaleNearest } from './png.ts';

const palette = loadPalette();
const strings = loadStrings();
const ui = parseInterfaceBalance(loadBalanceJson());
const font = compileFont(
  readFileSync(join(REPO_ROOT, 'assets/art/ui/font_menu.txt'), 'utf8'),
  'assets/art/ui/font_menu.txt',
  palette,
);
const art = { palette, font };
const t = (key: string, vars: Readonly<Record<string, string>> = {}): string =>
  formatString(strings, key, vars);
const ago = (s: number): string => agoText(s, t);
const outDir = join(REPO_ROOT, 'docs/art/playtest-3/interface');
mkdirSync(outDir, { recursive: true });

function frameOf(file: string): Rgba {
  const img = decodePng(readFileSync(join(REPO_ROOT, file)));
  if (img.width !== LOGICAL_WIDTH || img.height !== LOGICAL_HEIGHT)
    throw new Error(`${file} is not a logical frame`);
  return img;
}

const camp = frameOf('docs/art/captures/stage-12/camp-sail.png');
const dusk = frameOf('docs/art/captures/stage-12/dusk-stern.png');
const night = frameOf('docs/art/captures/stage-07/broch-night.png');
const thumb = (f: Rgba): string => {
  const th = makeThumbnail(f, ui.menu.thumbnail, ui.menu.thumbnailBytes, (img) =>
    encodePng({ width: img.width, height: img.height, data: Uint8Array.from(img.data) }).toString(
      'base64',
    ),
  );
  if (th === null) throw new Error('the thumbnail does not fit');
  return th.data;
};

const header = (over: Partial<SaveHeader>): SaveHeader => ({
  schemaVersion: 14,
  build: 'render',
  seed: 'render',
  day: 1,
  chapter: 'CH_1_WRECK',
  stateHash: '0',
  kind: 'manual',
  slot: 'manual-1',
  sequence: 1,
  savedAt: '2026-11-13T10:00:00Z',
  ...over,
});

const slots: SaveSlotView[] = [
  {
    slot: 'AUTO',
    storeSlot: 'autosave-2',
    empty: false,
    header: header({
      kind: 'autosave',
      slot: 'autosave-2',
      day: 2,
      minuteOfDay: 6 * 60,
      season: 'Spring',
      zone: 'ZONE_SK_MACHAIR',
      placeKey: 'place.name.sk_machair',
    }),
    thumbnail: { w: 160, h: 90, format: 'png', data: thumb(night) },
    agoSeconds: 540,
  },
  {
    slot: 'MANUAL_1',
    storeSlot: 'manual-1',
    empty: false,
    header: header({
      day: 1,
      minuteOfDay: 20 * 60 + 41,
      season: 'Spring',
      zone: 'ZONE_SK_STRAND',
      placeKey: 'place.name.sk_wreck_strand',
    }),
    thumbnail: { w: 160, h: 90, format: 'png', data: thumb(dusk) },
    agoSeconds: 3700,
  },
  { slot: 'MANUAL_2', storeSlot: null, empty: true },
  { slot: 'MANUAL_3', storeSlot: null, empty: true },
];

const settings = [
  {
    id: 'motion',
    group: 'display',
    textKey: 'ui.settings.motion',
    vars: { state: t('ui.settings.off') },
  },
  {
    id: 'info',
    group: 'display',
    textKey: 'ui.settings.info',
    vars: { state: t('ui.settings.on') },
  },
  { id: 'gore', group: 'display', textKey: 'ui.settings.gore', vars: { level: t('ui.gore.full') } },
  {
    id: 'marks',
    group: 'display',
    textKey: 'ui.settings.marks',
    vars: { state: t('ui.settings.off') },
  },
  { id: 'master', group: 'audio', textKey: 'ui.settings.master', vars: { level: '100%' } },
  { id: 'music', group: 'audio', textKey: 'ui.settings.music', vars: { level: '80%' } },
  {
    id: 'mono',
    group: 'audio',
    textKey: 'ui.settings.mono',
    vars: { state: t('ui.settings.off') },
  },
  {
    id: 'secondWind',
    group: 'gameplay',
    textKey: 'ui.settings.second_wind',
    vars: { state: t('ui.settings.on') },
  },
  {
    id: 'ransMercy',
    group: 'gameplay',
    textKey: 'ui.settings.rans_mercy',
    vars: { state: t('ui.settings.off') },
  },
  { id: 'intro', group: 'intro', textKey: 'ui.settings.intro_play' },
] as const;

const env = (safe: boolean): PauseEnv => ({
  safe,
  fullscreen: false,
  slots,
  hasDayStart: true,
  lastSavedAgo: ago(540),
  settings,
  controlRows: ACTIONS.length,
});

const label = (a: string): string => {
  const l = actionLabel(a);
  return t(l.key, l.vars);
};
const controls = ACTIONS.map((a) => {
  const list = DEFAULT_BINDINGS[a];
  return {
    name: label(a),
    keys: list
      .filter((x) => x.device === 'key' || x.device === 'mouse' || x.device === 'wheel')
      .map(controlLabel)
      .join(', '),
    pad: list
      .filter((x) => x.device === 'pad' || x.device === 'axis')
      .map(controlLabel)
      .join(', '),
  };
});

/** The menu over a frame, with each slot's screenshot over its card. */
function composite(under: Rgba, menu: MenuFrame, slotList: readonly SlotView[]): Rgba {
  const out = Uint8Array.from(under.data);
  const rgba = toRgba(menu.image, palette);
  for (let i = 0; i < LOGICAL_WIDTH * LOGICAL_HEIGHT; i++)
    if ((menu.image.pixels[i] ?? NO_PIXEL) !== NO_PIXEL)
      out.set(rgba.subarray(i * 4, i * 4 + 4), i * 4);
  for (const th of menu.thumbs) {
    const data = slotList[th.row]?.thumbnail?.data;
    if (data === undefined) continue;
    const pic = decodePng(Buffer.from(data, 'base64'));
    for (let y = 0; y < pic.height; y++)
      for (let x = 0; x < pic.width; x++) {
        const k = (y * pic.width + x) * 4;
        const o = ((th.y + y) * LOGICAL_WIDTH + th.x + x) * 4;
        out.set(pic.data.subarray(k, k + 3), o);
        out[o + 3] = 255;
      }
  }
  return { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT, data: out };
}

function write(name: string, image: Rgba): void {
  const data = Uint8Array.from(image.data);
  for (const factor of [1, 4]) {
    const file = join(outDir, `${name}-${factor}x.png`);
    writeFileSync(
      file,
      encodePng(scaleNearest({ width: image.width, height: image.height, data }, factor)),
    );
    console.log(`wrote ${file}`);
  }
}

function page(name: string, setUp: (m: PauseMenu) => void, safe = true, under: Rgba = camp): void {
  const m = new PauseMenu();
  m.open();
  setUp(m);
  const e = env(safe);
  const frame = composePauseMenu(art, {
    menu: m,
    env: e,
    t,
    ago,
    running: !safe,
    backdrop: safe ? dimFrame(under, palette) : null,
    controls,
    controlsNote: t('ui.controls.change', { key: 'H' }),
  });
  write(name, composite(under, frame, e.slots));
}

page('pause-main', (m) => {
  m.cursor = 1;
});
page(
  'pause-overlay',
  (m) => {
    m.choose(1, env(false));
  },
  false,
  dusk,
);
page('pause-save', (m) => {
  m.choose(1, env(true));
  m.cursor = 1;
});
page('pause-load', (m) => {
  m.choose(2, env(true));
});
page('pause-settings', (m) => {
  m.choose(3, env(true));
  m.cursor = 5;
});
page('pause-controls', (m) => {
  m.choose(6, env(true));
  m.cursor = 6;
});
page('pause-confirm', (m) => {
  m.choose(5, env(true));
});

// The title: its frame, with the menu under the name.
const titleArt = loadTitleArt();
const titleFrame: IndexedImage = composeTitleFrame(titleArt, {
  name: t('ui.title.name'),
  buildLine: t('ui.title.build', { build: '0.12.0+c7ecdb6' }),
});
const titleImg = createIndexedImage(LOGICAL_WIDTH, LOGICAL_HEIGHT);
titleImg.pixels.set(titleFrame.pixels);
composeTitleMenu(art, titleImg, {
  items: [
    { text: t('ui.title.new_game'), enabled: true },
    { text: t('ui.title.continue'), enabled: true },
    { text: t('ui.title.load'), enabled: true },
    { text: t('ui.title.settings'), enabled: true },
    { text: t('ui.title.fullscreen_off'), enabled: true },
  ],
  cursor: 0,
  y: 206,
});
write('title-menu', {
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  data: toRgba(titleImg, palette),
});

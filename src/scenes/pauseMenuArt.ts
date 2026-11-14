/**
 * The pause menu and the title menu drawn (Book 7 section 10; decisions DG-15 to DG-18): a panel of
 * timber and wool in the interface's style, centred over the frame it paused, which is dimmed by two
 * palette steps (never blurred); its items a plain list in the menu lettering
 * (assets/art/ui/font_menu.txt); the save and load pages the autosave and the slots as cards, each
 * with its screenshot's place at 1x (160 x 90), the day, the time and the place beneath, an empty
 * slot a blank cloth card; a refused save's reason under the item; a confirmation over it all.
 *
 * Everything here is palette indices (640 x 360, NO_PIXEL where the frame shows through) and pure:
 * the screenshots themselves are PNGs drawn by the view into the places `thumbs` gives, since they
 * are pictures of the lit frame, not palette art. `hits` are the rectangles a pointer can choose.
 */
import { drawText, getRamp, measureText } from '../render/bitmapFont.ts';
import type { BitmapFont, Ramp } from '../render/bitmapFont.ts';
import { createIndexedImage, NO_PIXEL } from '../render/indexedImage.ts';
import type { IndexedImage } from '../render/indexedImage.ts';
import { paletteIndex } from '../render/palette.ts';
import type { Palette } from '../render/palette.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import { PAUSE_ITEMS } from '../ui/pauseMenu.ts';
import type { PauseEnv, PauseMenu, SlotView } from '../ui/pauseMenu.ts';

export interface MenuArt {
  readonly palette: Palette;
  readonly font: BitmapFont;
}

export type Words = (key: string, vars?: Readonly<Record<string, string>>) => string;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type Hit =
  | (Rect & { readonly kind: 'row'; readonly row: number })
  | (Rect & { readonly kind: 'yes' | 'no' | 'back' });

export interface MenuFrame {
  readonly image: IndexedImage;
  readonly hits: readonly Hit[];
  /** Where each slot's screenshot goes (its card's row), 160 x 90 at 1x. */
  readonly thumbs: readonly (Rect & { readonly row: number })[];
}

/** The panel's materials, by palette code (Book 7 section 10: timber and wool). */
const MATERIAL = {
  ink: 'k',
  /** The frame: tarred oak with a lit edge and pitch in its shadow. */
  frameDark: 'p',
  frame: 't',
  frameLit: 'n',
  /** Carved bone studs at the corners. */
  stud: 'w',
  /** The cloth field and its weave. */
  cloth: 'Ε',
  weave: 'Ζ',
  /** The highlighted row, and a blank card's cloth. */
  chosen: 'Ζ',
  blank: 'Η',
  /** The highlighted row's notch. */
  notch: 'Ķ',
} as const;

const ROW_H = 13;

function code(art: MenuArt, c: string): number {
  return paletteIndex(art.palette, c);
}

function fill(img: IndexedImage, r: Rect, index: number): void {
  for (let y = Math.max(0, r.y); y < Math.min(img.height, r.y + r.h); y++)
    for (let x = Math.max(0, r.x); x < Math.min(img.width, r.x + r.w); x++)
      img.pixels[y * img.width + x] = index;
}

/**
 * A panel: an ink edge, a two-pixel tarred-oak frame lit on its top and left, studs at the
 * corners, and a wool field with a faint weave every fourth pixel.
 */
export function drawPanel(art: MenuArt, img: IndexedImage, r: Rect): void {
  const c = (k: keyof typeof MATERIAL): number => code(art, MATERIAL[k]);
  fill(img, r, c('ink'));
  fill(img, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, c('frame'));
  fill(img, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: 1 }, c('frameLit'));
  fill(img, { x: r.x + 1, y: r.y + 1, w: 1, h: r.h - 2 }, c('frameLit'));
  fill(img, { x: r.x + 1, y: r.y + r.h - 2, w: r.w - 2, h: 1 }, c('frameDark'));
  fill(img, { x: r.x + r.w - 2, y: r.y + 1, w: 1, h: r.h - 2 }, c('frameDark'));
  const inner = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 };
  fill(img, inner, c('ink'));
  const field = { x: inner.x + 1, y: inner.y + 1, w: inner.w - 2, h: inner.h - 2 };
  fill(img, field, c('cloth'));
  const weave = c('weave');
  for (let y = field.y + 1; y < field.y + field.h - 1; y += 4)
    for (let x = field.x + 1 + ((y >> 2) & 1) * 2; x < field.x + field.w - 1; x += 4)
      img.pixels[y * img.width + x] = weave;
  // Bone studs at the corners, on the frame.
  for (const [sx, sy] of [
    [r.x + 1, r.y + 1],
    [r.x + r.w - 3, r.y + 1],
    [r.x + 1, r.y + r.h - 3],
    [r.x + r.w - 3, r.y + r.h - 3],
  ] as const)
    fill(img, { x: sx, y: sy, w: 2, h: 2 }, c('stud'));
}

function ramp(art: MenuArt, name: string): Ramp {
  return getRamp(art.font, name);
}

/** Text that fits `width`: cut with an ellipsis if it is longer. */
function fit(art: MenuArt, text: string, width: number): string {
  if (measureText(art.font, text) <= width) return text;
  let t = text;
  while (t.length > 1 && measureText(art.font, `${t}…`) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function centred(
  art: MenuArt,
  img: IndexedImage,
  text: string,
  cx: number,
  y: number,
  r: string,
): void {
  const w = measureText(art.font, text);
  drawText(img, art.font, text, Math.round(cx - w / 2), y, ramp(art, r));
}

/** A row of a list: highlighted with the chosen cloth and a notch, or dim when not offered. */
function listRow(
  art: MenuArt,
  img: IndexedImage,
  r: Rect,
  text: string,
  chosen: boolean,
  enabled: boolean,
): void {
  if (chosen) {
    fill(img, r, code(art, MATERIAL.chosen));
    const n = code(art, MATERIAL.notch);
    const my = r.y + Math.floor(r.h / 2);
    for (let i = 0; i < 3; i++) fill(img, { x: r.x + 3 + i, y: my - 2 + i, w: 1, h: 5 - i * 2 }, n);
  }
  drawText(
    img,
    art.font,
    fit(art, text, r.w - 16),
    r.x + 10,
    r.y + 2,
    ramp(art, !enabled ? 'dim' : chosen ? 'lit' : 'text'),
  );
}

/** The words of a main-list item. */
export function itemText(item: (typeof PAUSE_ITEMS)[number], env: PauseEnv, t: Words): string {
  switch (item) {
    case 'resume':
      return t('ui.pause.resume');
    case 'save':
      return t('ui.pause.save');
    case 'load':
      return t('ui.pause.load');
    case 'settings':
      return t('ui.pause.settings');
    case 'fullscreen':
      return t(env.fullscreen ? 'ui.pause.fullscreen_on' : 'ui.pause.fullscreen_off');
    case 'resetDay':
      return t('ui.pause.reset_day');
    case 'controls':
      return t('ui.pause.controls');
    case 'quit':
      return t('ui.pause.quit');
  }
}

/** The day, season and time a slot shows, and its place, from its header. */
export function slotLines(slot: SlotView, t: Words, ago: (s: number) => string): string[] {
  const h = slot.header;
  if (slot.empty || h === undefined) return [t('ui.save.empty')];
  const m = h.minuteOfDay;
  const time =
    m === undefined
      ? ''
      : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const season = h.season === undefined ? '' : t(`ui.season.${h.season.toLowerCase()}`);
  return [
    t('ui.save.when', { day: String(h.day), season, time }),
    h.placeKey === undefined ? '' : t(h.placeKey),
    slot.agoSeconds === undefined ? '' : t('ui.save.ago', { ago: ago(slot.agoSeconds) }),
  ];
}

/** The rows a list page shows at once, and the first shown, so the cursor stays in view. */
function window(cursor: number, rows: number, shown: number): number {
  if (rows <= shown) return 0;
  return Math.max(0, Math.min(rows - shown, cursor - Math.floor(shown / 2)));
}

export interface PauseDraw {
  readonly menu: PauseMenu;
  readonly env: PauseEnv;
  readonly t: Words;
  /** "3 minutes" for a number of seconds. */
  readonly ago: (seconds: number) => string;
  /** Time runs on behind the menu (a hostile aware): the title says so. */
  readonly running: boolean;
  /** The paused frame dimmed (dimFrame), drawn behind the panel; null over a running world. */
  readonly backdrop: IndexedImage | null;
  /** The controls page's rows: an action's name, its keys and its pad buttons. */
  readonly controls: readonly {
    readonly name: string;
    readonly keys: string;
    readonly pad: string;
  }[];
  /** A line under the controls (the binding being changed, or how to change one). */
  readonly controlsNote: string;
}

/** Composes the pause menu's frame (Book 7 section 10). Pure and deterministic. */
export function composePauseMenu(art: MenuArt, d: PauseDraw): MenuFrame {
  const img =
    d.backdrop === null
      ? createIndexedImage(LOGICAL_WIDTH, LOGICAL_HEIGHT)
      : { ...d.backdrop, pixels: Uint8Array.from(d.backdrop.pixels) };
  const hits: Hit[] = [];
  const thumbs: (Rect & { row: number })[] = [];
  const { menu, env, t } = d;
  const page = menu.page;
  if (page === 'main') {
    const w = 264;
    const h = 30 + PAUSE_ITEMS.length * ROW_H + 26;
    const r = {
      x: Math.round((LOGICAL_WIDTH - w) / 2),
      y: Math.round((LOGICAL_HEIGHT - h) / 2),
      w,
      h,
    };
    drawPanel(art, img, r);
    centred(art, img, t('ui.pause.title'), r.x + w / 2, r.y + 9, 'lit');
    PAUSE_ITEMS.forEach((item, i) => {
      const row = { x: r.x + 8, y: r.y + 24 + i * ROW_H, w: w - 16, h: ROW_H };
      listRow(art, img, row, itemText(item, env, t), menu.cursor === i, menu.enabled(i, env));
      hits.push({ ...row, kind: 'row', row: i });
    });
    const noteY = r.y + 24 + PAUSE_ITEMS.length * ROW_H + 6;
    noteLine(art, img, d, r, noteY);
  } else if (page === 'save' || page === 'load') {
    const cardW = 172;
    const cardH = 142;
    const w = 12 + (cardW + 12) * 2;
    const h = 26 + (cardH + 8) * 2 + 18;
    const r = {
      x: Math.round((LOGICAL_WIDTH - w) / 2),
      y: Math.round((LOGICAL_HEIGHT - h) / 2),
      w,
      h,
    };
    drawPanel(art, img, r);
    centred(
      art,
      img,
      t(page === 'save' ? 'ui.pause.save' : 'ui.pause.load'),
      r.x + w / 2,
      r.y + 9,
      'lit',
    );
    backButton(art, img, d, r, hits);
    env.slots.forEach((slot, i) => {
      const cx = r.x + 12 + (i % 2) * (cardW + 12);
      const cy = r.y + 24 + Math.floor(i / 2) * (cardH + 8);
      const card = { x: cx, y: cy, w: cardW, h: cardH };
      const chosen = menu.cursor === i;
      const enabled = menu.enabled(i, env);
      fill(img, card, code(art, chosen ? MATERIAL.notch : MATERIAL.ink));
      fill(
        img,
        { x: cx + 1, y: cy + 1, w: cardW - 2, h: cardH - 2 },
        code(art, chosen ? MATERIAL.chosen : MATERIAL.cloth),
      );
      const label =
        slot.slot === 'AUTO'
          ? t('ui.save.slot_auto')
          : t('ui.save.slot_manual', { count: slot.slot.slice('MANUAL_'.length) });
      drawText(
        img,
        art.font,
        label,
        cx + 6,
        cy + 3,
        ramp(art, !enabled ? 'dim' : chosen ? 'lit' : 'text'),
      );
      const pic = { x: cx + 6, y: cy + 14, w: 160, h: 90 };
      fill(
        img,
        { x: pic.x - 1, y: pic.y - 1, w: pic.w + 2, h: pic.h + 2 },
        code(art, MATERIAL.ink),
      );
      if (slot.empty) {
        // A blank cloth card.
        fill(img, pic, code(art, MATERIAL.blank));
        centred(art, img, t('ui.save.empty'), pic.x + pic.w / 2, pic.y + 40, 'ink');
      } else {
        fill(img, pic, code(art, MATERIAL.ink));
        if (slot.thumbnail !== undefined) thumbs.push({ ...pic, row: i });
      }
      slotLines(slot, t, d.ago)
        .slice(slot.empty ? 1 : 0)
        .forEach((line, k) => {
          drawText(
            img,
            art.font,
            fit(art, line, cardW - 12),
            cx + 6,
            pic.y + pic.h + 3 + k * 11,
            ramp(art, k === 0 && enabled ? 'text' : 'muted'),
          );
        });
      hits.push({ ...card, kind: 'row', row: i });
    });
    noteLine(art, img, d, r, r.y + h - 18);
  } else if (page === 'settings') {
    const groups = ['display', 'audio', 'gameplay', 'intro'] as const;
    const lines: ({ kind: 'group'; g: string } | { kind: 'row'; i: number })[] = [];
    for (const g of groups) {
      const rows = env.settings.map((s, i) => ({ s, i })).filter((x) => x.s.group === g);
      if (rows.length === 0) continue;
      lines.push({ kind: 'group', g });
      for (const x of rows) lines.push({ kind: 'row', i: x.i });
    }
    const w = 300;
    const h = 30 + lines.length * 12 + 14;
    const r = {
      x: Math.round((LOGICAL_WIDTH - w) / 2),
      y: Math.max(4, Math.round((LOGICAL_HEIGHT - h) / 2)),
      w,
      h,
    };
    drawPanel(art, img, r);
    centred(art, img, t('ui.pause.settings'), r.x + w / 2, r.y + 9, 'lit');
    backButton(art, img, d, r, hits);
    lines.forEach((line, k) => {
      const y = r.y + 24 + k * 12;
      if (line.kind === 'group') {
        drawText(
          img,
          art.font,
          t(`ui.settings.group.${line.g}`),
          r.x + 10,
          y + 2,
          ramp(art, 'muted'),
        );
        return;
      }
      const s = env.settings[line.i];
      if (s === undefined) return;
      const row = { x: r.x + 14, y, w: w - 22, h: 12 };
      listRow(art, img, row, t(s.textKey, s.vars), menu.cursor === line.i, true);
      hits.push({ ...row, kind: 'row', row: line.i });
    });
  } else {
    const shown = 19;
    const w = 440;
    const h = 42 + shown * 12 + 22;
    const r = {
      x: Math.round((LOGICAL_WIDTH - w) / 2),
      y: Math.round((LOGICAL_HEIGHT - h) / 2),
      w,
      h,
    };
    drawPanel(art, img, r);
    centred(art, img, t('ui.pause.controls'), r.x + w / 2, r.y + 9, 'lit');
    backButton(art, img, d, r, hits);
    const colKeys = r.x + 170;
    const colPad = r.x + 340;
    drawText(img, art.font, t('ui.controls.keys'), colKeys, r.y + 24, ramp(art, 'muted'));
    drawText(img, art.font, t('ui.controls.pad'), colPad, r.y + 24, ramp(art, 'muted'));
    const first = window(menu.cursor, d.controls.length, shown);
    d.controls.slice(first, first + shown).forEach((c, k) => {
      const i = first + k;
      const row = { x: r.x + 8, y: r.y + 36 + k * 12, w: w - 16, h: 12 };
      const chosen = menu.cursor === i;
      listRow(art, img, { ...row, w: 160 }, c.name, chosen, true);
      if (chosen)
        fill(
          img,
          { x: row.x + 160, y: row.y, w: row.w - 160, h: row.h },
          code(art, MATERIAL.chosen),
        );
      drawText(
        img,
        art.font,
        fit(art, c.keys, colPad - colKeys - 6),
        colKeys,
        row.y + 2,
        ramp(art, chosen ? 'lit' : 'text'),
      );
      drawText(
        img,
        art.font,
        fit(art, c.pad, r.x + w - 10 - colPad),
        colPad,
        row.y + 2,
        ramp(art, chosen ? 'lit' : 'text'),
      );
      hits.push({ ...row, kind: 'row', row: i });
    });
    drawText(
      img,
      art.font,
      fit(art, d.controlsNote, w - 20),
      r.x + 10,
      r.y + h - 18,
      ramp(art, 'muted'),
    );
  }
  if (menu.confirm !== null)
    confirmBox(art, img, t(menu.confirm.key, menu.confirm.vars), menu.confirm.yes, t, hits);
  return { image: img, hits, thumbs };
}

/** The information line under the list: a refusal's reason, "Saved", or the overlay's warning. */
function noteLine(art: MenuArt, img: IndexedImage, d: PauseDraw, r: Rect, y: number): void {
  const note = d.menu.note;
  if (note !== null)
    centred(
      art,
      img,
      fit(art, d.t(note.key, note.vars), r.w - 16),
      r.x + r.w / 2,
      y,
      note.refused ? 'refused' : 'muted',
    );
  else if (d.running)
    centred(art, img, fit(art, d.t('ui.pause.running'), r.w - 16), r.x + r.w / 2, y, 'refused');
}

function backButton(art: MenuArt, img: IndexedImage, d: PauseDraw, r: Rect, hits: Hit[]): void {
  const text = d.t('ui.pause.back');
  const w = measureText(art.font, text) + 10;
  const b = { x: r.x + 8, y: r.y + 7, w, h: 12 };
  fill(img, b, code(art, MATERIAL.ink));
  fill(img, { x: b.x + 1, y: b.y + 1, w: b.w - 2, h: b.h - 2 }, code(art, MATERIAL.frame));
  drawText(img, art.font, text, b.x + 5, b.y + 2, ramp(art, 'text'));
  hits.push({ ...b, kind: 'back' });
}

function confirmBox(
  art: MenuArt,
  img: IndexedImage,
  text: string,
  yes: boolean,
  t: Words,
  hits: Hit[],
): void {
  const w = Math.min(420, Math.max(200, measureText(art.font, text) + 28));
  const h = 54;
  const r = {
    x: Math.round((LOGICAL_WIDTH - w) / 2),
    y: Math.round((LOGICAL_HEIGHT - h) / 2),
    w,
    h,
  };
  drawPanel(art, img, r);
  centred(art, img, fit(art, text, w - 20), r.x + w / 2, r.y + 11, 'text');
  const words = [t('ui.save.yes'), t('ui.save.no')];
  words.forEach((word, i) => {
    const bw = 56;
    const b = { x: Math.round(r.x + w / 2 - bw - 6 + i * (bw + 12)), y: r.y + 30, w: bw, h: 14 };
    const chosen = (i === 0) === yes;
    fill(img, b, code(art, chosen ? MATERIAL.notch : MATERIAL.ink));
    fill(
      img,
      { x: b.x + 1, y: b.y + 1, w: b.w - 2, h: b.h - 2 },
      code(art, chosen ? MATERIAL.chosen : MATERIAL.frame),
    );
    centred(art, img, word, b.x + bw / 2, b.y + 3, chosen ? 'lit' : 'text');
    hits.push({ ...b, kind: i === 0 ? 'yes' : 'no' });
  });
}

/**
 * The paused frame dimmed by two palette steps (Book 7 section 10): each pixel of the lit frame
 * taken to its nearest ramp colour, then two steps down that ramp. Never blurred.
 */
export function dimFrame(
  frame: {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array | Uint8ClampedArray;
  },
  palette: Palette,
  steps = 2,
): IndexedImage {
  const ramps = [...palette.ramps.values()];
  const candidates: { index: number; to: number; rgb: readonly [number, number, number] }[] = [];
  for (const list of ramps)
    list.forEach((index, step) => {
      const e = palette.entries[index];
      if (e !== undefined)
        candidates.push({ index, to: list[Math.max(0, step - steps)] ?? index, rgb: e.rgb });
    });
  const cache = new Map<number, number>();
  const out = createIndexedImage(frame.width, frame.height);
  for (let i = 0; i < frame.width * frame.height; i++) {
    const r = frame.data[i * 4] ?? 0;
    const g = frame.data[i * 4 + 1] ?? 0;
    const b = frame.data[i * 4 + 2] ?? 0;
    const key = (r << 16) | (g << 8) | b;
    let to = cache.get(key);
    if (to === undefined) {
      let best = Infinity;
      to = NO_PIXEL;
      for (const c of candidates) {
        const dr = c.rgb[0] - r;
        const dg = c.rgb[1] - g;
        const db = c.rgb[2] - b;
        const dist = dr * dr * 3 + dg * dg * 4 + db * db * 2;
        if (dist < best) {
          best = dist;
          to = c.to;
        }
      }
      cache.set(key, to);
    }
    out.pixels[i] = to;
  }
  return out;
}

/** The title screen's menu (Book 7 section 10: the same panel's style). */
export interface TitleMenuDraw {
  readonly items: readonly { readonly text: string; readonly enabled: boolean }[];
  readonly cursor: number;
  /** Top of the panel (it sits below the name). */
  readonly y: number;
}

export function composeTitleMenu(art: MenuArt, img: IndexedImage, d: TitleMenuDraw): Hit[] {
  const hits: Hit[] = [];
  const w = 180;
  const h = 14 + d.items.length * ROW_H + 4;
  const r = { x: Math.round((LOGICAL_WIDTH - w) / 2), y: d.y, w, h };
  drawPanel(art, img, r);
  d.items.forEach((item, i) => {
    const row = { x: r.x + 8, y: r.y + 8 + i * ROW_H, w: w - 16, h: ROW_H };
    listRow(art, img, row, item.text, d.cursor === i, item.enabled);
    hits.push({ ...row, kind: 'row', row: i });
  });
  return hits;
}

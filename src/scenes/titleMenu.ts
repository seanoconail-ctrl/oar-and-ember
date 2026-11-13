/**
 * The title screen's menu (Book 2 section 21; Book 7 section 10; decision DG-18): New game,
 * Continue (the newest save), Load (the same slot cards as the pause menu), Settings (the intro:
 * play or skip) and Fullscreen, so fullscreen can be chosen before a game starts. Drawn in the
 * pause menu's panel style on its own canvas over the title frame; keys, the pad and the pointer.
 */
import type { Palette } from '../render/palette.ts';
import { toRgba } from '../render/indexedImage.ts';
import { createIndexedImage } from '../render/indexedImage.ts';
import type { Viewport } from '../render/viewport.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import type { SaveManager, SaveSlotView } from '../persist/manager.ts';
import { PauseMenu } from '../ui/pauseMenu.ts';
import type { PauseEnv, PauseNav, SettingRow } from '../ui/pauseMenu.ts';
import { agoText } from '../ui/pauseMenu.ts';
import { composePauseMenu, composeTitleMenu } from './pauseMenuArt.ts';
import type { Hit, MenuArt, Words } from './pauseMenuArt.ts';
import { menuFont } from './pauseMenuView.ts';

export const TITLE_ITEMS = ['newGame', 'continue', 'load', 'settings', 'fullscreen'] as const;
export type TitleItem = (typeof TITLE_ITEMS)[number];

/** The title menu's rows and which are offered (Continue and Load need a save). */
export function titleItems(
  t: Words,
  hasSave: boolean,
  fullscreen: boolean,
): { id: TitleItem; text: string; enabled: boolean }[] {
  return [
    { id: 'newGame', text: t('ui.title.new_game'), enabled: true },
    { id: 'continue', text: t('ui.title.continue'), enabled: hasSave },
    { id: 'load', text: t('ui.title.load'), enabled: hasSave },
    { id: 'settings', text: t('ui.title.settings'), enabled: true },
    {
      id: 'fullscreen',
      text: t(fullscreen ? 'ui.title.fullscreen_on' : 'ui.title.fullscreen_off'),
      enabled: true,
    },
  ];
}

export interface TitleMenuHost {
  readonly palette: Palette;
  readonly t: Words;
  readonly saves: SaveManager;
  readonly saveSlots: number;
  readonly fullscreen: () => boolean;
  readonly introSkip: () => boolean;
  readonly newGame: () => void;
  readonly load: (slot: string) => void;
  readonly toggleFullscreen: () => void;
  readonly toggleIntro: () => void;
  readonly click: () => void;
}

/** The menu's top, below the name (the title lettering's centre is 168). */
const MENU_Y = 206;

export class TitleMenuView {
  readonly canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #art: MenuArt;
  readonly #host: TitleMenuHost;
  /** The list, or a page of the pause menu's (load, settings). */
  #page: 'list' | 'load' | 'settings' = 'list';
  #cursor = 0;
  readonly #pages = new PauseMenu();
  #hits: readonly Hit[] = [];
  #closed = false;
  readonly #pictures = new Map<string, HTMLImageElement>();
  #padBefore: boolean[] = [];

  constructor(doc: Document, host: TitleMenuHost) {
    this.#host = host;
    this.#art = { palette: host.palette, font: menuFont(host.palette) };
    const canvas = doc.createElement('canvas');
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;
    canvas.className = 'oe-title-menu';
    Object.assign(canvas.style, {
      position: 'fixed',
      imageRendering: 'pixelated',
      zIndex: '3',
    });
    doc.body.append(canvas);
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('No 2D context for the title menu');
    ctx.imageSmoothingEnabled = false;
    this.#ctx = ctx;
    const logical = (e: MouseEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / Math.max(1, r.width)) * LOGICAL_WIDTH,
        y: ((e.clientY - r.top) / Math.max(1, r.height)) * LOGICAL_HEIGHT,
      };
    };
    const hitAt = (p: { x: number; y: number }): Hit | null =>
      [...this.#hits]
        .reverse()
        .find((h) => p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h) ?? null;
    canvas.addEventListener('pointermove', (e) => {
      const hit = hitAt(logical(e));
      if (hit?.kind !== 'row') return;
      if (this.#page === 'list' && hit.row !== this.#cursor) {
        this.#cursor = hit.row;
        this.draw();
      } else if (this.#page !== 'list' && hit.row !== this.#pages.cursor) {
        this.#pages.cursor = hit.row;
        this.draw();
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const hit = hitAt(logical(e));
      if (hit === null) return;
      if (hit.kind === 'back') this.nav('back');
      else if (hit.kind === 'row') {
        if (this.#page === 'list') this.#cursor = hit.row;
        else this.#pages.cursor = hit.row;
        this.nav('confirm');
      }
    });
    doc.addEventListener('keydown', (e) => {
      if (this.#closed || e.repeat) return;
      const nav: PauseNav | null =
        e.code === 'ArrowUp' || e.code === 'KeyW'
          ? 'up'
          : e.code === 'ArrowDown' || e.code === 'KeyS'
            ? 'down'
            : e.code === 'ArrowLeft' || e.code === 'KeyA'
              ? 'left'
              : e.code === 'ArrowRight' || e.code === 'KeyD'
                ? 'right'
                : e.code === 'Enter' ||
                    e.code === 'NumpadEnter' ||
                    e.code === 'Space' ||
                    e.code === 'KeyE'
                  ? 'confirm'
                  : e.code === 'Escape' || e.code === 'Backspace'
                    ? 'back'
                    : null;
      if (nav === null) return;
      e.preventDefault();
      this.nav(nav);
    });
  }

  get page(): string {
    return this.#page;
  }

  #env(): PauseEnv {
    const settings: SettingRow[] = [
      {
        id: 'intro',
        group: 'intro',
        textKey: this.#host.introSkip() ? 'ui.settings.intro_skip' : 'ui.settings.intro_play',
      },
      {
        id: 'fullscreen',
        group: 'display',
        textKey: 'ui.settings.fullscreen',
        vars: {
          state: this.#host.t(this.#host.fullscreen() ? 'ui.settings.on' : 'ui.settings.off'),
        },
      },
    ];
    return {
      safe: true,
      fullscreen: this.#host.fullscreen(),
      slots: this.#slots(),
      hasDayStart: false,
      lastSavedAgo: '',
      settings,
      controlRows: 0,
    };
  }

  #slots(): SaveSlotView[] {
    return this.#host.saves.slotViews(this.#host.saveSlots, Date.now());
  }

  /** A key, the pad or a click moved or chose. */
  nav(n: PauseNav): void {
    if (this.#closed) return;
    const host = this.#host;
    if (this.#page === 'list') {
      const items = titleItems(host.t, host.saves.newest() !== null, host.fullscreen());
      if (n === 'up' || n === 'down') {
        this.#cursor = (this.#cursor + (n === 'up' ? items.length - 1 : 1)) % items.length;
        host.click();
      } else if (n === 'confirm') {
        const item = items[this.#cursor];
        if (item === undefined) return;
        if (!item.enabled) return;
        host.click();
        if (item.id === 'newGame') {
          this.close();
          host.newGame();
          return;
        }
        if (item.id === 'continue') {
          const newest = host.saves.newest();
          if (newest !== null) {
            this.close();
            host.load(newest.slot);
          }
          return;
        }
        if (item.id === 'fullscreen') host.toggleFullscreen();
        else {
          this.#page = item.id;
          this.#pages.page = item.id;
          this.#pages.cursor = 0;
        }
      }
      this.draw();
      return;
    }
    const env = this.#env();
    if (n === 'back') {
      this.#page = 'list';
      host.click();
      this.draw();
      return;
    }
    if (this.#page === 'load' && n === 'confirm') {
      const slot = env.slots[this.#pages.cursor];
      if (slot === undefined || slot.empty || slot.storeSlot === null) return;
      host.click();
      this.close();
      host.load(slot.storeSlot);
      return;
    }
    for (const a of this.#pages.nav(n, env)) {
      if (a.kind === 'click') host.click();
      else if (a.kind === 'setting') {
        if (a.id === 'intro') host.toggleIntro();
        else if (a.id === 'fullscreen') host.toggleFullscreen();
      }
    }
    this.#pages.confirm = null;
    this.draw();
  }

  /** The pad, polled each frame: the d-pad and the stick move, A chooses, B goes back. */
  pollPad(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p !== null);
    if (pad == null) return;
    const now = pad.buttons.map((b) => b.pressed);
    const went = (i: number): boolean => now[i] === true && this.#padBefore[i] !== true;
    if (went(12)) this.nav('up');
    if (went(13)) this.nav('down');
    if (went(14)) this.nav('left');
    if (went(15)) this.nav('right');
    if (went(0)) this.nav('confirm');
    if (went(1)) this.nav('back');
    this.#padBefore = now;
  }

  close(): void {
    this.#closed = true;
    this.canvas.remove();
  }

  fit(vp: Viewport, dpr: number): void {
    Object.assign(this.canvas.style, {
      left: `${vp.x / dpr}px`,
      top: `${vp.y / dpr}px`,
      width: `${vp.width / dpr}px`,
      height: `${vp.height / dpr}px`,
    });
  }

  draw(): void {
    if (this.#closed) return;
    const host = this.#host;
    const t = host.t;
    let img = createIndexedImage(LOGICAL_WIDTH, LOGICAL_HEIGHT);
    let thumbs: { x: number; y: number; w: number; h: number; row: number }[] = [];
    const env = this.#env();
    if (this.#page === 'list') {
      const items = titleItems(t, host.saves.newest() !== null, host.fullscreen());
      this.#hits = composeTitleMenu(this.#art, img, {
        items,
        cursor: this.#cursor,
        y: MENU_Y,
      });
    } else {
      const frame = composePauseMenu(this.#art, {
        menu: this.#pages,
        env,
        t,
        ago: (s) => agoText(s, t),
        running: false,
        backdrop: null,
        controls: [],
        controlsNote: '',
      });
      img = frame.image;
      this.#hits = frame.hits;
      thumbs = [...frame.thumbs];
    }
    const rgba = toRgba(img, host.palette);
    this.#ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.#ctx.putImageData(
      new ImageData(Uint8ClampedArray.from(rgba), LOGICAL_WIDTH, LOGICAL_HEIGHT),
      0,
      0,
    );
    for (const th of thumbs) {
      const data = env.slots[th.row]?.thumbnail?.data;
      if (data === undefined) continue;
      let pic = this.#pictures.get(data);
      if (pic === undefined) {
        pic = new Image();
        pic.src = `data:image/png;base64,${data}`;
        this.#pictures.set(data, pic);
        pic.addEventListener('load', () => {
          this.draw();
        });
      }
      if (pic.complete && pic.naturalWidth > 0) this.#ctx.drawImage(pic, th.x, th.y, th.w, th.h);
    }
    this.canvas.dataset['page'] = this.#page;
    this.canvas.dataset['cursor'] = String(
      this.#page === 'list' ? this.#cursor : this.#pages.cursor,
    );
    this.canvas.dataset['items'] = titleItems(t, host.saves.newest() !== null, host.fullscreen())
      .map((i) => `${i.id}${i.enabled ? '' : '-'}`)
      .join(',');
  }
}

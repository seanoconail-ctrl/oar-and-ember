/**
 * The pause menu in the page (Book 2 sections 02, 20 and 21; Book 7 section 10; decisions DG-15 to
 * DG-18): its own 640 x 360 canvas laid exactly over the game's viewport like the HUD's, scaled by
 * the same whole number with no smoothing, drawn from the menu's palette art
 * (src/scenes/pauseMenuArt.ts) with each slot's screenshot over its card at 1x. It captures the last
 * frame drawn before it opened (for the dimmed backdrop and the save's thumbnail), takes the keys,
 * the pad and the pointer while it is open, and carries out the model's actions through its host.
 * The simulation never sees it: what it changes in the world goes through commands or a load.
 */
import { compileFont } from '../render/bitmapFont.ts';
import type { BitmapFont } from '../render/bitmapFont.ts';
import { toRgba } from '../render/indexedImage.ts';
import type { IndexedImage } from '../render/indexedImage.ts';
import type { Palette } from '../render/palette.ts';
import type { Viewport } from '../render/viewport.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import type { InputFrame } from '../input/inputState.ts';
import { PauseMenu } from '../ui/pauseMenu.ts';
import type { PauseAction, PauseEnv, PauseNav } from '../ui/pauseMenu.ts';
import type { Rgba, ThumbnailPng } from '../ui/thumbnail.ts';
import { makeThumbnail } from '../ui/thumbnail.ts';
import fontMenu from '../../assets/art/ui/font_menu.txt?raw';
import { composePauseMenu, dimFrame } from './pauseMenuArt.ts';
import type { Hit, MenuArt, MenuFrame, Words } from './pauseMenuArt.ts';

export function menuFont(palette: Palette): BitmapFont {
  return compileFont(fontMenu, 'assets/art/ui/font_menu.txt', palette);
}

/** The logical frame last drawn: the WebGL canvas read back through the viewport. */
export function readLogicalFrame(gl: WebGL2RenderingContext, vp: Viewport): Rgba {
  const W = gl.drawingBufferWidth;
  const H = gl.drawingBufferHeight;
  const all = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, all);
  return logicalFrom(all, W, H, vp);
}

/** The logical 640 x 360 frame out of a whole drawing buffer read back (rows bottom up). */
function logicalFrom(all: Uint8Array, W: number, H: number, vp: Viewport): Rgba {
  const out = new Uint8Array(LOGICAL_WIDTH * LOGICAL_HEIGHT * 4);
  for (let y = 0; y < LOGICAL_HEIGHT; y++) {
    const dy = Math.floor(vp.y + (y + 0.5) * vp.scale);
    const gy = H - 1 - dy;
    for (let x = 0; x < LOGICAL_WIDTH; x++) {
      const dx = Math.floor(vp.x + (x + 0.5) * vp.scale);
      const o = (y * LOGICAL_WIDTH + x) * 4;
      if (dx < 0 || dx >= W || gy < 0 || gy >= H) {
        out[o + 3] = 255;
        continue;
      }
      const k = (gy * W + dx) * 4;
      out[o] = all[k] ?? 0;
      out[o + 1] = all[k + 1] ?? 0;
      out[o + 2] = all[k + 2] ?? 0;
      out[o + 3] = 255;
    }
  }
  return { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT, data: out };
}

/**
 * The frame just drawn, read back without stalling it (an autosave's screenshot, DG-80; the user's
 * third playtest's integration pass, DG-93): the copy is queued into a pixel buffer behind the
 * frame's own drawing, and taken once a fence says the GPU has done it, a frame or more later.
 * A plain `readPixels` waits there and then for everything queued before it, which on the first
 * frame of play is every atlas upload and shader compile: about 0.4 s of one frame in Chromium's
 * software renderer. `poll()` returns the frame once it is ready, else null; after `patience`
 * polls it reads the buffer anyway (the read then waits, as before).
 */
export class FrameReadback {
  readonly #gl: WebGL2RenderingContext;
  readonly #vp: Viewport;
  readonly #W: number;
  readonly #H: number;
  #buffer: WebGLBuffer | null;
  #sync: WebGLSync | null;
  #polls = 0;
  readonly patience: number;

  constructor(gl: WebGL2RenderingContext, vp: Viewport, patience = 30) {
    this.patience = patience;
    this.#gl = gl;
    this.#vp = vp;
    this.#W = gl.drawingBufferWidth;
    this.#H = gl.drawingBufferHeight;
    this.#buffer = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.#buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, this.#W * this.#H * 4, gl.STREAM_READ);
    gl.readPixels(0, 0, this.#W, this.#H, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.#sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }

  /** The frame, once the GPU has copied it; null while it has not. */
  poll(): Rgba | null {
    const gl = this.#gl;
    if (this.#buffer === null) return null;
    this.#polls++;
    const ready =
      this.#sync === null ||
      gl.getSyncParameter(this.#sync, gl.SYNC_STATUS) === gl.SIGNALED ||
      this.#polls > this.patience;
    if (!ready) return null;
    const all = new Uint8Array(this.#W * this.#H * 4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.#buffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, all);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteBuffer(this.#buffer);
    this.#buffer = null;
    if (this.#sync !== null) gl.deleteSync(this.#sync);
    this.#sync = null;
    return logicalFrom(all, this.#W, this.#H, this.#vp);
  }
}

/** A PNG in base64 from RGBA, through a canvas (the browser's encoder). */
export function canvasPngBase64(doc: Document, image: Rgba): string {
  const c = doc.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext('2d');
  if (ctx === null) return '';
  ctx.putImageData(
    new ImageData(Uint8ClampedArray.from(image.data), image.width, image.height),
    0,
    0,
  );
  return c.toDataURL('image/png').slice('data:image/png;base64,'.length);
}

/** What the menu asks of the game. */
export interface PauseHost {
  readonly palette: Palette;
  readonly t: Words;
  readonly ago: (seconds: number) => string;
  /** The env for this frame (safety, slots, settings, controls). */
  env(): PauseEnv;
  /** Rows of the controls page, and the line under it. */
  controls(): { rows: { name: string; keys: string; pad: string }[]; note: string };
  /** Carries out an action other than close, click and remap (save, load, reset, quit...). */
  act(action: PauseAction, thumbnail: ThumbnailPng | null): void;
  /** Begins changing a binding (the controls page). */
  remap(row: number): void;
  /** The menu is closing (Resume, Back from the list). */
  close(): void;
  click(): void;
  /** Thumbnail size and bytes (Book 10). */
  readonly thumbnail: { readonly w: number; readonly h: number; readonly block: number };
  readonly thumbnailBytes: number;
}

export class PauseMenuView {
  readonly canvas: HTMLCanvasElement;
  readonly model = new PauseMenu();
  readonly #ctx: CanvasRenderingContext2D;
  readonly #art: MenuArt;
  readonly #host: PauseHost;
  readonly #doc: Document;
  #open = false;
  #captureDue = false;
  #frame: Rgba | null = null;
  #backdrop: IndexedImage | null = null;
  #hits: readonly Hit[] = [];
  #shownKey = '';
  readonly #pictures = new Map<string, HTMLImageElement>();
  /** Navigation waiting for the next frame (keys typed between frames). */
  readonly #queue: PauseNav[] = [];

  constructor(doc: Document, host: PauseHost) {
    this.#doc = doc;
    this.#host = host;
    this.#art = { palette: host.palette, font: menuFont(host.palette) };
    const canvas = doc.createElement('canvas');
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;
    canvas.className = 'oe-pause';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      pointerEvents: 'none',
      imageRendering: 'pixelated',
      visibility: 'hidden',
      zIndex: '4',
    });
    doc.body.append(canvas);
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('No 2D context for the pause menu');
    ctx.imageSmoothingEnabled = false;
    this.#ctx = ctx;
    const logical = (e: MouseEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / Math.max(1, r.width)) * LOGICAL_WIDTH,
        y: ((e.clientY - r.top) / Math.max(1, r.height)) * LOGICAL_HEIGHT,
      };
    };
    canvas.addEventListener('pointermove', (e) => {
      const hit = this.#hitAt(logical(e));
      if (hit?.kind === 'row' && this.model.confirm === null && hit.row !== this.model.cursor) {
        this.model.cursor = hit.row;
        this.#shownKey = '';
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const hit = this.#hitAt(logical(e));
      if (hit === null) return;
      const env = host.env();
      if (hit.kind === 'row') this.#run(this.model.choose(hit.row, env));
      else if (hit.kind === 'back') this.#run(this.model.back());
      else this.#run(this.model.answer(hit.kind === 'yes'));
    });
    doc.addEventListener('keydown', (e) => {
      if (!this.#open) return;
      const nav: PauseNav | null =
        e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space'
          ? 'confirm'
          : e.code === 'Backspace'
            ? 'back'
            : null;
      if (nav !== null) {
        e.preventDefault();
        this.#queue.push(nav);
      }
    });
  }

  get isOpen(): boolean {
    return this.#open;
  }

  /** The thumbnail of the frame captured as the menu opened (null if none or too large). */
  thumbnail(): ThumbnailPng | null {
    const frame = this.#frame;
    if (frame === null) return null;
    return makeThumbnail(frame, this.#host.thumbnail, this.#host.thumbnailBytes, (img) =>
      canvasPngBase64(this.#doc, img),
    );
  }

  /** Escape (or Start) while open: back a page; false when it should close the menu. */
  systemBack(): boolean {
    if (!this.#open) return false;
    const actions = this.model.back();
    const closes = actions.some((a) => a.kind === 'close');
    if (!closes) this.#run(actions);
    else this.#host.click();
    return !closes;
  }

  /** After the scene is drawn and before the browser composites it: the frame read back. */
  afterRender(gl: WebGL2RenderingContext, vp: Viewport, holdsTime: boolean): void {
    if (!this.#captureDue) return;
    this.#captureDue = false;
    this.#frame = readLogicalFrame(gl, vp);
    this.#backdrop = holdsTime ? dimFrame(this.#frame, this.#host.palette) : null;
    this.#shownKey = '';
  }

  /**
   * Each frame: open or close with the menu controller, take the pad's and keys' navigation from
   * the frame's input, and draw. `running` is true while time runs behind it (a hostile aware).
   */
  frame(
    open: boolean,
    running: boolean,
    input: InputFrame | null,
    vp: Viewport,
    dpr: number,
  ): void {
    if (open && !this.#open) {
      this.#open = true;
      this.model.open();
      this.#captureDue = true;
      this.#frame = null;
      this.#backdrop = null;
      this.canvas.style.visibility = '';
      this.canvas.style.pointerEvents = 'auto';
      this.canvas.setAttribute('aria-hidden', 'false');
    } else if (!open && this.#open) {
      this.#open = false;
      this.#queue.length = 0;
      this.canvas.style.visibility = 'hidden';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.#shownKey = '';
      return;
    }
    if (!this.#open) return;
    // Time runs again behind it (a hostile turned aware): the backdrop goes, the world shows.
    if (running && this.#backdrop !== null) {
      this.#backdrop = null;
      this.#shownKey = '';
    }
    if (input !== null) {
      const pressed = (a: Parameters<InputFrame['pressed']['has']>[0]): boolean =>
        input.pressed.has(a) && !input.byMouse.has(a);
      if (pressed('moveUp')) this.#queue.push('up');
      if (pressed('moveDown')) this.#queue.push('down');
      if (pressed('moveLeft')) this.#queue.push('left');
      if (pressed('moveRight')) this.#queue.push('right');
      if (pressed('interact') || pressed('useItem')) this.#queue.push('confirm');
      if (pressed('dodge') && input.pressed.has('dodge')) this.#queue.push('back');
    }
    const queued = this.#queue.splice(0);
    if (queued.length > 0) {
      const before = this.#host.env();
      for (const n of queued) this.#run(this.model.nav(n, before));
    }
    // What the slots hold now (a save just made shows at once).
    const env = this.#host.env();
    this.canvas.style.left = `${vp.x / dpr}px`;
    this.canvas.style.top = `${vp.y / dpr}px`;
    this.canvas.style.width = `${vp.width / dpr}px`;
    this.canvas.style.height = `${vp.height / dpr}px`;
    this.#draw(env, running);
  }

  #run(actions: readonly PauseAction[]): void {
    for (const a of actions) {
      this.#shownKey = '';
      if (a.kind === 'click') this.#host.click();
      else if (a.kind === 'close') this.#host.close();
      else if (a.kind === 'remap') this.#host.remap(a.row);
      else this.#host.act(a, a.kind === 'save' ? this.thumbnail() : null);
    }
  }

  #hitAt(p: { x: number; y: number }): Hit | null {
    // The confirmation's buttons first: they sit over everything.
    const order = [...this.#hits].reverse();
    return (
      order.find((h) => p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h) ?? null
    );
  }

  #draw(env: PauseEnv, running: boolean): void {
    const controls =
      this.model.page === 'controls' ? this.#host.controls() : { rows: [], note: '' };
    const key = JSON.stringify([
      this.model.page,
      this.model.cursor,
      this.model.confirm,
      this.model.note,
      running,
      this.#backdrop !== null,
      env.slots.map((s) => [
        s.storeSlot,
        s.header?.sequence,
        s.agoSeconds === undefined ? -1 : Math.floor(s.agoSeconds / 60),
      ]),
      env.settings.map((s) => [s.textKey, s.vars]),
      env.fullscreen,
      env.safe,
      controls,
    ]);
    if (key === this.#shownKey) return;
    this.#shownKey = key;
    const frame: MenuFrame = composePauseMenu(this.#art, {
      menu: this.model,
      env,
      t: this.#host.t,
      ago: this.#host.ago,
      running,
      backdrop: this.#backdrop,
      controls: controls.rows,
      controlsNote: controls.note,
    });
    this.#hits = frame.hits;
    const rgba = toRgba(frame.image, this.#host.palette);
    this.#ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.#ctx.putImageData(
      new ImageData(Uint8ClampedArray.from(rgba), LOGICAL_WIDTH, LOGICAL_HEIGHT),
      0,
      0,
    );
    for (const th of frame.thumbs) {
      const slot = env.slots[th.row];
      const data = slot?.thumbnail?.data;
      if (data === undefined) continue;
      let pic = this.#pictures.get(data);
      if (pic === undefined) {
        pic = new Image();
        pic.src = `data:image/png;base64,${data}`;
        this.#pictures.set(data, pic);
        pic.addEventListener('load', () => {
          this.#shownKey = '';
        });
      }
      if (pic.complete && pic.naturalWidth > 0) this.#ctx.drawImage(pic, th.x, th.y, th.w, th.h);
    }
    this.canvas.dataset['page'] = this.model.page;
    this.canvas.dataset['cursor'] = String(this.model.cursor);
    this.canvas.dataset['confirm'] = this.model.confirm?.key ?? '';
    this.canvas.dataset['note'] = this.model.note?.key ?? '';
    this.canvas.dataset['thumbs'] = String(frame.thumbs.length);
  }
}

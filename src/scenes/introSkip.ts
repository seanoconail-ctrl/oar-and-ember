/**
 * The cold open's Skip button (Book 7 section 10; decision DG-19): a small panel at the bottom
 * right in the menu's timber and wool, "Skip" and "Hold any key to skip" in the menu lettering, and
 * a ring of the hearth's ochre that fills as a key is held. Drawn on its own canvas over the
 * viewport, crisp, from palette indices; the logic is src/ui/introSkip.ts.
 */
import { drawText, getRamp, measureText } from '../render/bitmapFont.ts';
import { createIndexedImage, toRgba } from '../render/indexedImage.ts';
import { paletteIndex } from '../render/palette.ts';
import type { Viewport } from '../render/viewport.ts';
import { drawPanel } from './pauseMenuArt.ts';
import type { MenuArt } from './pauseMenuArt.ts';

const W = 150;
const H = 22;

export class IntroSkipView {
  readonly canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #art: MenuArt;
  readonly #words: { skip: string; hold: string };
  #drawn = -1;
  /** The button's place in logical pixels (bottom right). */
  readonly box = { x: 640 - W - 8, y: 360 - H - 8, w: W, h: H };

  constructor(
    doc: Document,
    art: MenuArt,
    words: { skip: string; hold: string },
    onClick: () => void,
  ) {
    this.#art = art;
    this.#words = words;
    const canvas = doc.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.className = 'oe-skip';
    Object.assign(canvas.style, {
      position: 'fixed',
      imageRendering: 'pixelated',
      zIndex: '5',
      opacity: '0',
      pointerEvents: 'none',
      cursor: 'pointer',
    });
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    doc.body.append(canvas);
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('No 2D context for the Skip button');
    this.#ctx = ctx;
  }

  /** Draws the button at `alpha` with its ring `ring` full, placed over the viewport. */
  update(alpha: number, ring: number, vp: Viewport, dpr: number): void {
    const s = vp.scale / dpr;
    Object.assign(this.canvas.style, {
      left: `${vp.x / dpr + this.box.x * s}px`,
      top: `${vp.y / dpr + this.box.y * s}px`,
      width: `${W * s}px`,
      height: `${H * s}px`,
      opacity: alpha.toFixed(2),
      pointerEvents: alpha > 0.05 ? 'auto' : 'none',
    });
    this.canvas.dataset['ring'] = ring.toFixed(2);
    const step = Math.round(ring * 16);
    if (step === this.#drawn) return;
    this.#drawn = step;
    const img = createIndexedImage(W, H);
    const art = this.#art;
    drawPanel(art, img, { x: 0, y: 0, w: W, h: H });
    // The ring: sixteen notches round a small circle, filled clockwise from the top.
    const cx = 12;
    const cy = 11;
    const lit = paletteIndex(art.palette, 'Ķ');
    const dim = paletteIndex(art.palette, 'Ζ');
    for (let k = 0; k < 16; k++) {
      const a = -Math.PI / 2 + (k / 16) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * 5);
      const y = Math.round(cy + Math.sin(a) * 5);
      img.pixels[y * W + x] = k < step ? lit : dim;
    }
    const skip = this.#words.skip;
    drawText(img, art.font, skip, 22, 6, getRamp(art.font, 'lit'));
    const hold = this.#words.hold;
    const x = 22 + measureText(art.font, skip) + 6;
    if (x + measureText(art.font, hold) < W - 4)
      drawText(img, art.font, hold, x, 6, getRamp(art.font, 'muted'));
    const rgba = toRgba(img, art.palette);
    this.#ctx.clearRect(0, 0, W, H);
    this.#ctx.putImageData(new ImageData(Uint8ClampedArray.from(rgba), W, H), 0, 0);
  }
}

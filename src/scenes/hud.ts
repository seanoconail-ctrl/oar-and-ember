/**
 * The pixel HUD (Book 7 section 10): the 12-slot hotbar, the target-tile cursor with the tool's
 * glyph or the broken red edge out of reach, the bow's aim line with its cross and the facing
 * arrow at the feet. Drawn from the compiled atlases (ui_hotbar, ui_icons, ui_digits, ui_cursor,
 * ui_cursor_glyph, ui_aim) on its own 640 x 360 canvas laid exactly over the game's viewport and
 * scaled by the same whole number with no smoothing: crisp, not lit by the post pass and not
 * filtered. Words (the slot's name, a refusal) go on the text overlay instead.
 */
import type { Viewport } from '../render/viewport.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import type { LoadedAtlas } from './atlases.ts';

export interface HudView {
  /** The camera's top-left in world pixels. */
  readonly camera: { readonly x: number; readonly y: number };
  readonly seconds: number;
  readonly hotbar: {
    readonly slots: readonly { readonly icon: string | null }[];
    readonly selected: number;
  };
  /** The target tile, or null when no cursor shows (aiming, a menu, carrying nothing to do). */
  readonly cursor: {
    readonly tx: number;
    readonly ty: number;
    readonly inReach: boolean;
    readonly glyph: string | null;
  } | null;
  /** The bow drawn: from the hand to the aim point, with the draw from 0 to 1. */
  readonly aim: {
    readonly from: { readonly x: number; readonly y: number };
    readonly to: { readonly x: number; readonly y: number };
    readonly draw: number;
  } | null;
  /** A small arrow at the steerer's feet showing the facing an attack or the draw takes. */
  readonly facingArrow: {
    readonly x: number;
    readonly y: number;
    readonly facing: 's' | 'n' | 'e' | 'w';
  } | null;
  readonly tile: number;
}

export interface Hud {
  readonly canvas: HTMLCanvasElement;
  fit(viewport: Viewport, devicePixelRatio: number): void;
  draw(view: HudView): void;
}

/** The hotbar's place: centred along the bottom edge, as approved (preview48.py). */
const SLOT_W = 22;
const HOTBAR_Y = LOGICAL_HEIGHT - 30;

export function createHud(doc: Document, atlases: ReadonlyMap<string, LoadedAtlas>): Hud {
  const canvas = doc.createElement('canvas');
  canvas.width = LOGICAL_WIDTH;
  canvas.height = LOGICAL_HEIGHT;
  canvas.className = 'oe-hud';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    pointerEvents: 'none',
    imageRendering: 'pixelated',
  });
  doc.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('No 2D context for the HUD');
  ctx.imageSmoothingEnabled = false;

  /** Draws a frame with its top-left corner at (x, y), whole pixels. */
  const put = (sheet: string, frame: string, x: number, y: number): void => {
    const atlas = atlases.get(sheet);
    const at = atlas?.manifest.frames[frame];
    if (atlas === undefined || at === undefined) return;
    const { width: w, height: h } = atlas.manifest;
    ctx.drawImage(atlas.image, at[0], at[1], w, h, Math.round(x), Math.round(y), w, h);
  };

  return {
    canvas,
    fit(viewport, dpr) {
      canvas.style.left = `${viewport.x / dpr}px`;
      canvas.style.top = `${viewport.y / dpr}px`;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
    },
    draw(view) {
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      const cam = view.camera;
      // The facing arrow at the feet.
      const arrow = view.facingArrow;
      if (arrow !== null) {
        const dx = { e: 12, w: -12, s: 0, n: 0 }[arrow.facing];
        const dy = { s: 8, n: -6, e: 0, w: 0 }[arrow.facing];
        put(
          'ui_aim',
          `facing_${arrow.facing}/-/0`,
          arrow.x - cam.x - 5 + dx,
          arrow.y - cam.y - 5 + dy,
        );
      }
      // The target tile: a rim with corner ticks and the tool's glyph, or a broken red edge.
      const c = view.cursor;
      if (c !== null) {
        const x = c.tx * view.tile - cam.x;
        const y = c.ty * view.tile - cam.y;
        const pulse = Math.floor(view.seconds * 2.5) % 2;
        put('ui_cursor', c.inReach ? `valid/-/${pulse}` : 'reach/-/0', x - 2, y - 2);
        if (c.inReach && c.glyph !== null) put('ui_cursor_glyph', `${c.glyph}/-/0`, x + 18, y - 4);
      }
      // The aim line: dots from the hand to the aim point, wider apart as the draw grows.
      const aim = view.aim;
      if (aim !== null) {
        const hx = aim.from.x - cam.x;
        const hy = aim.from.y - cam.y;
        const tx = aim.to.x - cam.x;
        const ty = aim.to.y - cam.y;
        const length = Math.hypot(tx - hx, ty - hy);
        const step = 5 + 5 * aim.draw;
        for (let d = step; d < length - 6; d += step) {
          const k = d < length * 0.3 ? 0 : d < length * 0.7 ? 1 : 2;
          put(
            'ui_aim',
            `dot/-/${k}`,
            hx + ((tx - hx) * d) / length - 5,
            hy + ((ty - hy) * d) / length - 5,
          );
        }
        put('ui_aim', `cross/-/${Math.floor(view.seconds * 4) % 2}`, tx - 5, ty - 5);
      }
      // The hotbar along the bottom edge: twelve slots between two caps.
      const n = view.hotbar.slots.length;
      const x0 = Math.floor((LOGICAL_WIDTH - SLOT_W * (n + 2)) / 2);
      put('ui_hotbar', 'cap_left/-/0', x0, HOTBAR_Y);
      view.hotbar.slots.forEach((slot, i) => {
        const x = x0 + SLOT_W * (i + 1);
        const selected = i === view.hotbar.selected;
        put('ui_hotbar', `${selected ? 'slot_selected' : 'slot'}/-/0`, x, HOTBAR_Y);
        const oy = HOTBAR_Y + (selected ? 0 : 4);
        if (slot.icon !== null) put('ui_icons', `${slot.icon}/-/0`, x + 3, oy + 5);
        put('ui_digits', `${selected ? 'key_selected' : 'key'}/-/${i}`, x, oy + 3);
      });
      put('ui_hotbar', 'cap_right/-/0', x0 + SLOT_W * (n + 1), HOTBAR_Y);
    },
  };
}

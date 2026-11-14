/**
 * The region map (Stage 14, decision S14-23; Book 7 section 10, "The region map"): a page of the
 * journal, Skarvholm drawn in brown ink on vellum as the household knows it. Composed on the CPU
 * the way the sea chart is (src/scenes/seaChart.ts: the same pixel atlases, every pixel an authored
 * palette colour, the run time only choosing which shows), from `ui_regionmap`'s two frames:
 *
 * - **vellum**: the blank page; **ink**: the same page with all of Skarvholm inked.
 * - A pixel shows the ink where its block of the island grid belongs to a scene the household has
 *   discovered (`RegionState.discoveredZones`), or to the sea round one; the interiors are inset
 *   sketches, inked once walked into. Nothing else is marked: no aim, collectible or secret.
 * - A newly inked scene is drawn in with a short pen stroke, a sweep across its window over
 *   INK_SECONDS; with reduced motion it appears at once.
 * - The steerer's place is a carved-bone pin (`ui_regionmap_pin`).
 *
 * Pure but for the pixels it is given, so the unit tests compose it from the atlases on disk.
 */
import type { Id } from '../core/ids.ts';
import type { ChartAtlases } from './seaChart.ts';

export const MAP_W = 640;
export const MAP_H = 360;
/** Pixels a block of the island grid on the page, and where block (0, 0) lies (as the art's). */
export const BLOCK_PX = 12;
export const MAP_OX = 32;
export const MAP_OY = -12;
/** Seconds the pen takes to ink a newly found scene (presentation only). */
export const INK_SECONDS = 1.2;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface RegionMapLayout {
  /** Each scene's window of the island grid, in blocks (Book 9 section 03). */
  readonly windows: Readonly<Record<string, Rect>>;
  /** The interiors' inset boxes on the page, in blocks. */
  readonly insets: Readonly<Record<string, Rect & { readonly from: string }>>;
  /** Where each scene's or area's name is written, in blocks. */
  readonly labels: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
}

export interface RegionMapScene {
  readonly discovered: readonly Id[];
  /** The scene the steerer is in and where, in tiles of that scene (null: no pin). */
  readonly here: { readonly zone: Id; readonly x: number; readonly y: number } | null;
  /** Scenes still being inked, with the presentation second their stroke began. */
  readonly inking: ReadonlyMap<Id, number>;
  readonly seconds: number;
  readonly reduced: boolean;
}

/** The page's pixel for a block. */
export const blockPx = (bx: number, by: number): { x: number; y: number } => ({
  x: MAP_OX + bx * BLOCK_PX,
  y: MAP_OY + by * BLOCK_PX,
});

export class RegionMap {
  readonly #vellum: Uint32Array;
  readonly #ink: Uint32Array;
  readonly #out = new Uint32Array(MAP_W * MAP_H);
  readonly #bytes = new Uint8Array(this.#out.buffer);
  /** Each page pixel's owner (an index into #owners, -1 for none): its scene or inset. */
  readonly #owner = new Int16Array(MAP_W * MAP_H).fill(-1);
  /** The page pixels near a scene's window but in none (the sea round it): its scenes, by bit. */
  readonly #near = new Uint32Array(MAP_W * MAP_H);
  readonly #owners: Id[] = [];
  readonly #rects: Rect[] = [];
  readonly #pin: { w: number; h: number; px: number; py: number; data: Uint32Array } | null;
  readonly #layout: RegionMapLayout;

  constructor(atlases: ChartAtlases, layout: RegionMapLayout) {
    this.#layout = layout;
    const read = (frame: string): Uint32Array => {
      const out = new Uint32Array(MAP_W * MAP_H);
      const a = atlases.get('ui_regionmap');
      const at = a?.manifest.frames[`${frame}/-/0`];
      if (a === undefined || at === undefined) return out;
      const src = new Uint32Array(a.rgba.buffer, a.rgba.byteOffset, a.rgba.byteLength >> 2);
      for (let y = 0; y < MAP_H; y++)
        out.set(
          src.subarray((at[1] + y) * a.width + at[0], (at[1] + y) * a.width + at[0] + MAP_W),
          y * MAP_W,
        );
      return out;
    };
    this.#vellum = read('vellum');
    this.#ink = read('ink');
    const p = atlases.get('ui_regionmap_pin');
    const pat = p?.manifest.frames['pin/-/0'];
    if (p === undefined || pat === undefined) this.#pin = null;
    else {
      const m = p.manifest;
      const src = new Uint32Array(p.rgba.buffer, p.rgba.byteOffset, p.rgba.byteLength >> 2);
      const data = new Uint32Array(m.width * m.height);
      for (let y = 0; y < m.height; y++)
        data.set(
          src.subarray((pat[1] + y) * p.width + pat[0], (pat[1] + y) * p.width + pat[0] + m.width),
          y * m.width,
        );
      this.#pin = { w: m.width, h: m.height, px: m.pivot.x, py: m.pivot.y, data };
    }
    const own = (id: Id, r: Rect): number => {
      this.#owners.push(id);
      this.#rects.push(r);
      return this.#owners.length - 1;
    };
    const fill = (k: number, r: Rect): void => {
      const a = blockPx(r.x, r.y);
      for (let y = Math.max(0, a.y); y < Math.min(MAP_H, a.y + r.h * BLOCK_PX); y++)
        for (let x = Math.max(0, a.x); x < Math.min(MAP_W, a.x + r.w * BLOCK_PX); x++)
          this.#owner[y * MAP_W + x] = k;
    };
    for (const [id, r] of Object.entries(layout.windows)) fill(own(id, r), r);
    // The sea round each window, a block wide, inks with the first of its scenes found.
    for (let k = 0; k < this.#owners.length; k++) {
      const r = this.#rects[k];
      if (r === undefined || k >= 31) continue;
      const a = blockPx(r.x - 1, r.y - 1);
      for (let y = Math.max(0, a.y); y < Math.min(MAP_H, a.y + (r.h + 2) * BLOCK_PX); y++)
        for (let x = Math.max(0, a.x); x < Math.min(MAP_W, a.x + (r.w + 2) * BLOCK_PX); x++) {
          const i = y * MAP_W + x;
          if (this.#owner[i] === -1) this.#near[i] = (this.#near[i] ?? 0) | (1 << k);
        }
    }
    for (const [id, r] of Object.entries(layout.insets)) {
      const k = own(id, r);
      fill(k, r);
      // An inset is its own: the sea round its parent never inks it.
      const a = blockPx(r.x, r.y);
      for (let y = Math.max(0, a.y); y < Math.min(MAP_H, a.y + r.h * BLOCK_PX); y++)
        for (let x = Math.max(0, a.x); x < Math.min(MAP_W, a.x + r.w * BLOCK_PX); x++)
          this.#near[y * MAP_W + x] = 0;
    }
  }

  /** Where a scene's tile lies on the page (null for an interior or an unknown scene). */
  pagePoint(zone: Id, tx: number, ty: number): { x: number; y: number } | null {
    const w = this.#layout.windows[zone];
    if (w !== undefined) {
      const a = blockPx(w.x, w.y);
      return { x: a.x + (tx / 8) * BLOCK_PX, y: a.y + (ty / 8) * BLOCK_PX };
    }
    const inset = this.#layout.insets[zone];
    if (inset === undefined) return null;
    const a = blockPx(inset.x, inset.y);
    return { x: a.x + (inset.w * BLOCK_PX) / 2, y: a.y + (inset.h * BLOCK_PX) / 2 };
  }

  /** Where a name is written on the page (null if not discovered or no place for it). */
  labelAt(id: Id): { x: number; y: number } | null {
    const l = this.#layout.labels[id];
    return l === undefined
      ? null
      : { x: MAP_OX + (l.x + 0.5) * BLOCK_PX, y: MAP_OY + (l.y + 0.5) * BLOCK_PX };
  }

  /** How far a scene's stroke has come, 0..1 (1: inked; reduced motion: at once). */
  #stroke(scene: RegionMapScene, id: Id): number {
    const since = scene.inking.get(id);
    if (since === undefined || scene.reduced) return 1;
    return Math.max(0, Math.min(1, (scene.seconds - since) / INK_SECONDS));
  }

  compose(scene: RegionMapScene): Uint8Array {
    const found = new Set(scene.discovered);
    const progress = this.#owners.map((id) => (found.has(id) ? this.#stroke(scene, id) : 0));
    const out = this.#out;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        const k = this.#owner[i] ?? -1;
        let p = 0;
        if (k >= 0) p = progress[k] ?? 0;
        else {
          const near = this.#near[i] ?? 0;
          if (near !== 0)
            for (let b = 0; b < progress.length && b < 31; b++)
              if ((near & (1 << b)) !== 0) p = Math.max(p, progress[b] ?? 0);
        }
        let inked = p >= 1;
        if (!inked && p > 0) {
          // The pen's sweep: across the window from its north-west corner.
          const r = k >= 0 ? this.#rects[k] : undefined;
          const a = r === undefined ? { x: 0, y: 0 } : blockPx(r.x, r.y);
          const span = r === undefined ? MAP_W + MAP_H : (r.w + r.h) * BLOCK_PX;
          inked = (x - a.x + (y - a.y)) / span < p;
        }
        out[i] = (inked ? this.#ink[i] : this.#vellum[i]) ?? 0;
      }
    }
    const pin = this.#pin;
    const at =
      scene.here === null ? null : this.pagePoint(scene.here.zone, scene.here.x, scene.here.y);
    if (pin !== null && at !== null && found.has(scene.here?.zone ?? '')) {
      const ox = Math.round(at.x) - pin.px;
      const oy = Math.round(at.y) - pin.py;
      for (let sy = 0; sy < pin.h; sy++)
        for (let sx = 0; sx < pin.w; sx++) {
          const v = pin.data[sy * pin.w + sx] ?? 0;
          const dx = ox + sx;
          const dy = oy + sy;
          if (v >>> 24 === 0 || dx < 0 || dy < 0 || dx >= MAP_W || dy >= MAP_H) continue;
          out[dy * MAP_W + dx] = v;
        }
    }
    return this.#bytes;
  }
}

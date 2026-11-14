/**
 * The sea map at the launch (Book 4 section 08, beat 8; Book 7 section 10; Stage 12): read-only.
 * The drawn chart of the Narrow Sea (`ui_seamap`), composed on the CPU each frame like the title:
 * the sea's sheen runs across it in bands and cloud shadows drift over land and water, the mist
 * clears outward from Skarvholm as the coast is revealed and Manannán's mist bank lies off the
 * Irish shore, the household's boat bobs off Wreck Strand under its own sail mark, and smoke
 * rises at Carrick Landing. Every pixel is one of the chart's palette colours: the frames only
 * choose, pixel by pixel, between the chart, its sheen, its shadow and the mist.
 *
 * Pure but for the canvas it draws its sprites with; it never touches the simulation.
 */
import type { LoadedAtlas } from './atlases.ts';

const W = 640;
const H = 360;
/** Seconds the mist takes to clear from Skarvholm out to the edges. */
export const REVEAL_SECONDS = 4.5;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);

/** A smooth periodic noise, 0..1, from a small table (no random: it is the same every run). */
function makeNoise(size: number, seed: number): Float32Array {
  const grid = new Float32Array(size * size);
  let h = seed >>> 0;
  for (let i = 0; i < grid.length; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    grid[i] = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  return grid;
}

function sample(grid: Float32Array, size: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (a: number, b: number): number =>
    grid[(((b % size) + size) % size) * size + (((a % size) + size) % size)] ?? 0;
  const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
  const bot = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
  return top + (bot - top) * sy;
}

export interface SeaMapPlaces {
  readonly home: { readonly x: number; readonly y: number };
  readonly smoke: { readonly x: number; readonly y: number };
  readonly mist: { readonly x: number; readonly y: number };
}

export interface SeaMapFrame {
  readonly rgba: Uint8Array;
  /** How far the reveal has come, 0 (all mist) to 1 (the coast shown). */
  readonly revealed: number;
}

/** Composes the read-only sea map. */
export class SeaMapView {
  readonly #chart: Uint8ClampedArray;
  readonly #lit: Uint8ClampedArray;
  readonly #shade: Uint8ClampedArray;
  readonly #fog: Uint8ClampedArray;
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #image: ImageData;
  readonly #atlases: ReadonlyMap<string, LoadedAtlas>;
  readonly #places: SeaMapPlaces;
  readonly #cloud = makeNoise(32, 1201);
  readonly #mist = makeNoise(16, 1202);

  constructor(doc: Document, atlases: ReadonlyMap<string, LoadedAtlas>, places: SeaMapPlaces) {
    this.#atlases = atlases;
    this.#places = places;
    this.#canvas = doc.createElement('canvas');
    this.#canvas.width = W;
    this.#canvas.height = H;
    const ctx = this.#canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) throw new Error('No 2D canvas for the sea map');
    this.#ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    const read = (frame: string): Uint8ClampedArray => {
      const a = atlases.get('ui_seamap');
      const at = a?.manifest.frames[`${frame}/-/0`];
      if (a === undefined || at === undefined) return new Uint8ClampedArray(W * H * 4);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(a.image, at[0], at[1], W, H, 0, 0, W, H);
      return ctx.getImageData(0, 0, W, H).data.slice();
    };
    this.#chart = read('chart');
    this.#lit = read('lit');
    this.#shade = read('shade');
    this.#fog = read('fog');
    this.#image = ctx.createImageData(W, H);
  }

  /**
   * The map at `seconds` since it opened. `revealFrom` is when the reveal began (null: already
   * revealed), `sail` the household's mark's token state (e.g. `raven_woad`).
   */
  frame(seconds: number, revealFrom: number | null, sail: string, reduced: boolean): SeaMapFrame {
    const out = this.#image.data;
    const t = reduced ? seconds * 0.35 : seconds;
    const revealed =
      revealFrom === null ? 1 : Math.max(0, Math.min(1, (seconds - revealFrom) / REVEAL_SECONDS));
    const home = this.#places.home;
    const mist = this.#places.mist;
    const maxR = Math.hypot(W, H) * 0.75;
    const radius = revealed * maxR;
    const chart = this.#chart;
    const lit = this.#lit;
    const shade = this.#shade;
    const fog = this.#fog;
    // The sheen and the clouds change in 2 x 2 blocks; the dither keeps their edges in pixels.
    for (let by = 0; by < H; by += 2) {
      for (let bx = 0; bx < W; bx += 2) {
        const cloud = sample(this.#cloud, 32, (bx + t * 9) / 46, (by + t * 3) / 46);
        const wave =
          Math.sin(bx * 0.11 + by * 0.06 - t * 1.6) + Math.sin(bx * 0.045 - by * 0.13 + t * 1.05);
        const dm = Math.hypot(bx - mist.x, (by - mist.y) * 1.6);
        const mistAmount =
          dm < 90 ? (1 - dm / 90) * 1.4 * sample(this.#mist, 16, (bx - t * 5) / 30, by / 30) : 0;
        const dh = Math.hypot(bx - home.x, (by - home.y) * 1.2);
        const edge = sample(this.#mist, 16, bx / 22 + 7, by / 22) * 60;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const x = bx + dx;
            const y = by + dy;
            const i = (y * W + x) * 4;
            const b = BAYER[(y % 4) * 4 + (x % 4)] ?? 0;
            let src = chart;
            if (cloud + b * 0.08 > 0.66) src = shade;
            else if (wave + b * 0.6 > 1.35) src = lit;
            if (mistAmount > 0.35 + b * 0.5) src = fog;
            if (dh + edge > radius + b * 24) src = fog;
            out[i] = src[i] ?? 0;
            out[i + 1] = src[i + 1] ?? 0;
            out[i + 2] = src[i + 2] ?? 0;
            out[i + 3] = 255;
          }
        }
      }
    }
    const ctx = this.#ctx;
    ctx.putImageData(this.#image, 0, 0);
    // The smoke at Carrick once the reveal has reached it, and the household's boat.
    const smoke = this.#places.smoke;
    if (Math.hypot(smoke.x - home.x, smoke.y - home.y) < radius) {
      const k = Math.floor((t * 6) % 6);
      this.#sprite('fx_seamap', `smoke/-/${k}`, smoke.x, smoke.y);
    }
    // The token redrawn at Stage 13 (eight headings, sail states): heading east, its sail set.
    const bob = Math.floor((t * 4) % 4);
    this.#sprite('token_t1', `set_${sail}/e/${bob}`, home.x, home.y + 16);
    const rgba = new Uint8Array(ctx.getImageData(0, 0, W, H).data.buffer);
    return { rgba, revealed };
  }

  #sprite(sheet: string, frame: string, x: number, y: number): void {
    const a = this.#atlases.get(sheet);
    const at = a?.manifest.frames[frame];
    if (a === undefined || at === undefined) return;
    const m = a.manifest;
    this.#ctx.drawImage(
      a.image,
      at[0],
      at[1],
      m.width,
      m.height,
      Math.round(x - m.pivot.x),
      Math.round(y - m.pivot.y),
      m.width,
      m.height,
    );
  }
}

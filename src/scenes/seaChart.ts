/**
 * The sea map's chart in the voyage's light (Stage 13; Book 7 sections 05, 10 and 14): composed on
 * the CPU each frame as the Stage 12 chart is (src/scenes/seaMap.ts), and pure but for the pixels
 * it is given, so the unit tests can compose it from the compiled atlases on disk.
 *
 * Every pixel is a palette colour from an authored frame: the frames of `ui_seamap` (the chart, its
 * sea's sheen, cloud shadow, the dense fog) and `ui_seavoyage` (a gust's sheen over the land, the
 * storm and its sheen, lightning, night and its moonlit sheen, the thin fog), drawn on the same
 * coast to the pixel; the run time only chooses, pixel by pixel, which one shows:
 *
 * - **Moving water**: the sea's sheen runs across the chart in three sets of crests; cloud
 *   shadows drift downwind over land and sea; the gusts' sheen runs over the heath and grass, faster
 *   the stronger the wind (Book 7 section 14, Wind: one wind drives everything).
 * - **Fog** drifts in two layers downwind at their own speeds and covers (Book 10 section 25, fog);
 *   haze is the thin layer alone, sparser.
 * - **Rain** slants downwind (Book 10 rain: its drops and slant), on storm days and when the wind is
 *   rising under a grey sky (decision S13-24).
 * - **Storms** darken the chart and flash lightning, a double flicker (Book 10 lightningFlash), with
 *   a forked bolt on the bright frames.
 * - **Reduced motion** (Book 7 section 14, Accessibility): the fog lies still and the rain is not
 *   drawn; the lightning becomes one soft swell of light (Book 10 lightningReduced), and the sea,
 *   clouds and gusts move at about a third of the speed.
 *
 * Over it: the painted routes (brush dabs along each route's path round the coast), the places'
 * pictograms, the hazards, the weather's marks, the course's pin, the token and its wake.
 */
import type { Manifest } from '../render/atlas.ts';
import type { StormBalance } from '../content/presentationBalance.ts';
import { flashProfile } from './storm.ts';

export const CHART_W = 640;
export const CHART_H = 360;
const W = CHART_W;
const H = CHART_H;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
/** Reduced motion: the sea, clouds and gusts at about a third of the speed (Stage 12's 0.35). */
export const REDUCED_PACE = 0.35;
/** Reduced motion: the fog's single soft swell, in and out, over this many seconds. */
const FOG_SWELL_SECONDS = 6;

/** An atlas's pixels (decoded once), with its manifest. */
export interface PixelAtlas {
  readonly manifest: Manifest;
  readonly width: number;
  readonly rgba: Uint8Array | Uint8ClampedArray;
}
export type ChartAtlases = ReadonlyMap<string, PixelAtlas>;

/** The eight headings, as the token's facings (clockwise from north). */
export const HEADINGS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type Heading = (typeof HEADINGS)[number];

/** The heading of a chart direction (screen x right, y down). */
export function headingOf(dx: number, dy: number): Heading {
  if (dx === 0 && dy === 0) return 'e';
  const a = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const i = ((Math.round(a / 45) % 8) + 8) % 8;
  return HEADINGS[i] ?? 'e';
}

export interface ChartWeather {
  /** Where the wind blows to, a unit vector on the chart (y down); null in a calm. */
  readonly windTo: { readonly x: number; readonly y: number } | null;
  /** 0 calm to 4 storm. */
  readonly strength: number;
  readonly visibility: 'CLEAR' | 'HAZE' | 'FOG' | 'NIGHT';
  /** A storm day: the chart darkens and lightning flashes. */
  readonly storm: boolean;
  readonly rain: boolean;
  /** Fog by night as well (night is the clock's; fog is the day's draw). */
  readonly fog: boolean;
}

/** A route painted on the chart: its path's points (x, y pairs, a pixel apart) and its ink. */
export interface ChartRoute {
  readonly points: Float32Array;
  readonly kind: 'known' | 'rumour' | 'course';
}

/** A mark drawn from `ui_seaicons` with its foot at (x, y). */
export interface ChartMark {
  readonly state: string;
  readonly x: number;
  readonly y: number;
}

export interface ChartToken {
  readonly x: number;
  readonly y: number;
  readonly heading: Heading;
  /** `furled`, `row`, `set_<mark>` or `reefed_<mark>`. */
  readonly state: string;
  readonly wake: boolean;
}

export interface ChartScene {
  readonly seconds: number;
  readonly reduced: boolean;
  readonly weather: ChartWeather;
  readonly routes: readonly ChartRoute[];
  readonly marks: readonly ChartMark[];
  readonly token: ChartToken | null;
}

export interface ChartFrame {
  readonly rgba: Uint8Array;
  /** The light of a lightning strike now, 0..1 (tests and audio). */
  readonly flash: number;
}

/** A sprite's pixels and its pivot. */
interface Cut {
  readonly w: number;
  readonly h: number;
  readonly px: number;
  readonly py: number;
  readonly data: Uint32Array;
}

/**
 * A smooth periodic noise texture, 256 x 256, 0..1: three octaves of value noise (64, 32 and
 * 16 px cells) stretched back to the full range, seeded (no Math.random).
 */
function noiseTexture(seed: number): Float32Array {
  const out = new Float32Array(256 * 256);
  let h = seed >>> 0;
  const next = (): number => {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  for (const [cellPx, weight] of [
    [64, 0.55],
    [32, 0.3],
    [16, 0.15],
  ] as const) {
    const G = 256 / cellPx;
    const grid = Float32Array.from({ length: G * G }, next);
    const at = (a: number, b: number): number => grid[(b % G) * G + (a % G)] ?? 0;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const gx = x / cellPx;
        const gy = y / cellPx;
        const xi = Math.floor(gx);
        const yi = Math.floor(gy);
        const fx = gx - xi;
        const fy = gy - yi;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
        const bot = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
        const i = y * 256 + x;
        out[i] = (out[i] ?? 0) + (top + (bot - top) * sy) * weight;
      }
    }
  }
  for (let i = 0; i < out.length; i++)
    out[i] = Math.max(0, Math.min(1, 0.5 + ((out[i] ?? 0) - 0.5) * 1.7));
  return out;
}

/** Samples a noise texture at a chart point, turned 30 degrees so no shape lines up with the grid. */
function sampleAt(tex: Float32Array, x: number, y: number, scale: number, off: number): number {
  const u = ((x * 0.866 - y * 0.5) * scale + off) & 255;
  const v = ((x * 0.5 + y * 0.866) * scale + off * 0.37) & 255;
  return tex[v * 256 + u] ?? 0;
}

/** A tiny seeded stream (the presentation's own, never the simulation's). */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** The chart's layers by name: ui_seamap's and ui_seavoyage's frames. */
const LAYERS = {
  chart: ['ui_seamap', 'chart'],
  lit: ['ui_seamap', 'lit'],
  shade: ['ui_seamap', 'shade'],
  fog: ['ui_seamap', 'fog'],
  landLit: ['ui_seavoyage', 'land_lit'],
  storm: ['ui_seavoyage', 'storm'],
  stormLit: ['ui_seavoyage', 'storm_lit'],
  flash: ['ui_seavoyage', 'flash'],
  night: ['ui_seavoyage', 'night'],
  nightLit: ['ui_seavoyage', 'night_lit'],
  fogThin: ['ui_seavoyage', 'fog_thin'],
} as const;
type Layer = keyof typeof LAYERS;

export class SeaChart {
  readonly #layers: Record<Layer, Uint32Array>;
  readonly #out = new Uint32Array(W * H);
  readonly #bytes: Uint8Array;
  readonly #atlases: ChartAtlases;
  readonly #cuts = new Map<string, Cut | null>();
  /** Per 2 x 2 block: 1 where the block holds open sea (the sheen shows), 2 land, 3 both. */
  readonly #blocks: Uint8Array;
  readonly #noise = noiseTexture(1301);
  readonly #noise2 = noiseTexture(1302);
  readonly #storm: StormBalance;
  readonly #strikes: number[] = [];

  constructor(atlases: ChartAtlases, storm: StormBalance) {
    this.#atlases = atlases;
    this.#storm = storm;
    this.#bytes = new Uint8Array(this.#out.buffer);
    const read = (sheet: string, frame: string): Uint32Array => {
      const a = atlases.get(sheet);
      const out = new Uint32Array(W * H);
      const at = a?.manifest.frames[`${frame}/-/0`];
      if (a === undefined || at === undefined) return out;
      const src = new Uint32Array(a.rgba.buffer, a.rgba.byteOffset, a.rgba.byteLength >> 2);
      for (let y = 0; y < H; y++)
        out.set(
          src.subarray((at[1] + y) * a.width + at[0], (at[1] + y) * a.width + at[0] + W),
          y * W,
        );
      return out;
    };
    const layers = {} as Record<Layer, Uint32Array>;
    for (const [name, [sheet, frame]] of Object.entries(LAYERS) as [
      Layer,
      readonly [string, string],
    ][])
      layers[name] = read(sheet, frame);
    this.#layers = layers;
    const blocks = new Uint8Array((W / 2) * (H / 2));
    for (let by = 0; by < H; by += 2)
      for (let bx = 0; bx < W; bx += 2) {
        let v = 0;
        for (let d = 0; d < 4; d++) {
          const i = (by + (d >> 1)) * W + bx + (d & 1);
          if (layers.lit[i] !== layers.chart[i]) v |= 1;
          if (layers.landLit[i] !== layers.chart[i]) v |= 2;
        }
        blocks[(by >> 1) * (W >> 1) + (bx >> 1)] = v;
      }
    this.#blocks = blocks;
  }

  /** Whether a chart pixel is land (the gust sheen shows there): for the routes' paths. */
  isLand(x: number, y: number): boolean {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return true;
    const i = yi * W + xi;
    return this.#layers.landLit[i] !== this.#layers.chart[i];
  }

  /** Lightning strike times (presentation seconds), drawn on the chart's own stream. */
  #strikeTimes(until: number): readonly number[] {
    const list = this.#strikes;
    const [lo, hi] = this.#storm.lightningEvery;
    let t = list.length === 0 ? 0 : (list[list.length - 1] ?? 0);
    while (t < until + hi) {
      t += lo + (hi - lo) * hash(list.length + 17);
      list.push(t);
    }
    return list;
  }

  /** The lightning's light now, 0..1, and the strike it is from. */
  flashAt(seconds: number, reduced: boolean): { light: number; strike: number } {
    let light = 0;
    let strike = -1;
    const times = this.#strikeTimes(seconds);
    for (let i = 0; i < times.length; i++) {
      const at = times[i] ?? 0;
      if (at > seconds) break;
      if (seconds - at > 2) continue;
      const v = flashProfile(seconds - at, this.#storm, reduced);
      if (v > light) {
        light = v;
        strike = i;
      }
    }
    return { light, strike };
  }

  #cut(sheet: string, key: string): Cut | null {
    const id = `${sheet}|${key}`;
    const known = this.#cuts.get(id);
    if (known !== undefined) return known;
    const a = this.#atlases.get(sheet);
    const at = a?.manifest.frames[key];
    let cut: Cut | null = null;
    if (a !== undefined && at !== undefined) {
      const m = a.manifest;
      const src = new Uint32Array(a.rgba.buffer, a.rgba.byteOffset, a.rgba.byteLength >> 2);
      const data = new Uint32Array(m.width * m.height);
      for (let y = 0; y < m.height; y++)
        data.set(
          src.subarray((at[1] + y) * a.width + at[0], (at[1] + y) * a.width + at[0] + m.width),
          y * m.width,
        );
      cut = { w: m.width, h: m.height, px: m.pivot.x, py: m.pivot.y, data };
    }
    this.#cuts.set(id, cut);
    return cut;
  }

  /** A frame of an animation by the seconds, at its manifest's ticks (60 a second). */
  frameOf(sheet: string, state: string, facing: string, seconds: number): string {
    const anim = this.#atlases.get(sheet)?.manifest.anims[state];
    const n = anim?.frames ?? 1;
    const ticks = anim?.ticks ?? 60;
    const k = Math.floor((seconds * 60) / Math.max(1, ticks)) % Math.max(1, n);
    return `${state}/${facing}/${k}`;
  }

  /** Draws a sprite with its pivot at (x, y); `dim` drops pixels on a Bayer threshold (fog). */
  #blit(cut: Cut | null, x: number, y: number, dim = 0): void {
    if (cut === null) return;
    const ox = Math.round(x) - cut.px;
    const oy = Math.round(y) - cut.py;
    const out = this.#out;
    for (let sy = 0; sy < cut.h; sy++) {
      const dy = oy + sy;
      if (dy < 0 || dy >= H) continue;
      for (let sx = 0; sx < cut.w; sx++) {
        const dx = ox + sx;
        if (dx < 0 || dx >= W) continue;
        const v = cut.data[sy * cut.w + sx] ?? 0;
        if (v >>> 24 === 0) continue;
        if (dim > 0 && (BAYER[(dy & 3) * 4 + (dx & 3)] ?? 0) < dim) continue;
        out[dy * W + dx] = v;
      }
    }
  }

  /** Composes the chart. */
  compose(scene: ChartScene): ChartFrame {
    const L = this.#layers;
    const out = this.#out;
    const w = scene.weather;
    const reduced = scene.reduced;
    const t = reduced ? scene.seconds * REDUCED_PACE : scene.seconds;
    const night = w.visibility === 'NIGHT';
    const { light: flash, strike } = w.storm
      ? this.flashAt(scene.seconds, reduced)
      : { light: 0, strike: -1 };
    // The light: day, storm or night, and what the sheen, the clouds and the gusts show.
    let base = L.chart;
    let sheen = L.lit;
    let cloud = L.shade;
    let gust = L.landLit;
    if (w.storm) {
      base = L.storm;
      sheen = L.stormLit;
      cloud = L.night;
      gust = L.shade;
    } else if (night) {
      base = L.night;
      sheen = L.nightLit;
      cloud = L.night;
      gust = L.storm;
    }
    // Lightning: the bright frames light the whole chart; a dim one or the reduced swell, a share.
    const flashShare = flash >= 0.99 ? 1 : flash;
    const wind = w.windTo ?? { x: 0.8, y: -0.6 };
    const strength = w.windTo === null ? 0.4 : Math.max(0.6, w.strength);
    // Downwind drift (pixels): the clouds slower, the gusts faster, by the wind's strength.
    const cloudX = wind.x * t * (5 + strength * 2.5);
    const cloudY = wind.y * t * (5 + strength * 2.5);
    const gustX = wind.x * t * (9 + strength * 5);
    const gustY = wind.y * t * (9 + strength * 5);
    const fogOn = w.fog || w.visibility === 'FOG';
    const haze = !fogOn && w.visibility === 'HAZE';
    const fogSpeed = this.#storm.fogSpeeds;
    const fogCover = this.#storm.fogCover;
    // The fog's layers: still with reduced motion (the fog lies; Book 7's single soft swell is the
    // lightning's), else drifting downwind at Book 10's speeds (tiles a second, 24 px a tile).
    const fogT = reduced ? 0 : scene.seconds;
    const f1x = wind.x * fogT * fogSpeed[0] * 24;
    const f1y = wind.y * fogT * fogSpeed[0] * 24;
    const f2x = wind.x * fogT * fogSpeed[1] * 24;
    const f2y = wind.y * fogT * fogSpeed[1] * 24;
    // With reduced motion the two drifting layers become one still layer whose cover swells
    // softly in and out (the single soft swell).
    const swell = reduced ? Math.sin((scene.seconds / FOG_SWELL_SECONDS) * Math.PI * 2) : 0;
    const lowCover = fogOn && !reduced ? fogCover[1] : 0;
    const highCover = fogOn
      ? reduced
        ? (fogCover[0] + fogCover[1]) * 0.5 + swell * (fogCover[1] - fogCover[0]) * 0.5
        : fogCover[0] + 0.15
      : haze
        ? fogCover[0] + 0.15
        : 0;
    const noise = this.#noise;
    const noise2 = this.#noise2;
    const blocks = this.#blocks;
    const bw = W >> 1;
    // The sheen's crests: three sets of waves; sin(a + b) from per-column and per-row parts.
    const colA = new Float32Array(bw * 6);
    for (let bx = 0; bx < bw; bx++) {
      const x = bx * 2;
      const a1 = x * 0.11 - t * 1.6;
      const a2 = x * 0.045 + t * 1.05;
      const a3 = x * 0.19 - t * 2.3;
      colA[bx * 6] = Math.sin(a1);
      colA[bx * 6 + 1] = Math.cos(a1);
      colA[bx * 6 + 2] = Math.sin(a2);
      colA[bx * 6 + 3] = Math.cos(a2);
      colA[bx * 6 + 4] = Math.sin(a3);
      colA[bx * 6 + 5] = Math.cos(a3);
    }
    for (let by = 0; by < H; by += 2) {
      const r1 = by * 0.06;
      const r2 = -by * 0.13;
      const r3 = by * 0.17;
      const s1 = Math.sin(r1);
      const c1 = Math.cos(r1);
      const s2 = Math.sin(r2);
      const c2 = Math.cos(r2);
      const s3 = Math.sin(r3);
      const c3 = Math.cos(r3);
      const brow = (by >> 1) * bw;
      for (let bx = 0; bx < W; bx += 2) {
        const cb = blocks[brow + (bx >> 1)] ?? 0;
        const k = (bx >> 1) * 6;
        let wave = 0;
        if ((cb & 1) !== 0)
          wave =
            (colA[k] ?? 0) * c1 +
            (colA[k + 1] ?? 0) * s1 +
            (colA[k + 2] ?? 0) * c2 +
            (colA[k + 3] ?? 0) * s2 +
            0.6 * ((colA[k + 4] ?? 0) * c3 + (colA[k + 5] ?? 0) * s3);
        const cl = sampleAt(noise, bx - cloudX, by - cloudY, 1.1, 0);
        const gu = (cb & 2) !== 0 ? sampleAt(noise2, bx - gustX, by - gustY, 3.2, 97) : 0;
        const lo = lowCover > 0 ? sampleAt(noise2, bx - f1x, by - f1y, 1.3, 41) : 0;
        const hi = highCover > 0 ? sampleAt(noise, bx - f2x, by - f2y, 1.9, 151) : 0;
        for (let d = 0; d < 4; d++) {
          const x = bx + (d & 1);
          const y = by + (d >> 1);
          const i = y * W + x;
          const b = BAYER[(y & 3) * 4 + (x & 3)] ?? 0;
          let src = base;
          if (cl + b * 0.08 > 0.64) src = cloud;
          else if (wave + b * 0.7 > 1.2) src = sheen;
          if ((cb & 2) !== 0 && gu + b * 0.1 > 0.62 && src === base) src = gust;
          if (flashShare > 0 && b < flashShare) src = L.flash;
          // The fog's layers: a share of the view covered, thinning out through a wide dither at
          // their edges; haze is the thin layer as a veil (every other pixel at most).
          if (lowCover > 0 && lo - (1 - lowCover) > b * 0.3) src = L.fog;
          if (highCover > 0 && hi - (1 - highCover) > b * (haze ? 0.9 : 0.3)) src = L.fogThin;
          out[i] = src[i] ?? 0;
        }
      }
    }
    // The painted routes, the marks and the token over the chart.
    for (const r of scene.routes) this.#route(r, scene.seconds, reduced);
    for (const m of scene.marks)
      this.#blit(
        this.#cut('ui_seaicons', this.frameOf('ui_seaicons', m.state, '-', scene.seconds)),
        m.x,
        m.y,
      );
    const tok = scene.token;
    const dim = fogOn ? 0.5 : haze ? 0.25 : 0;
    if (tok !== null) {
      if (tok.wake)
        this.#blit(
          this.#cut('fx_seawake', this.frameOf('fx_seawake', 'wake', tok.heading, scene.seconds)),
          tok.x,
          tok.y,
          dim,
        );
      this.#blit(
        this.#cut('token_t1', this.frameOf('token_t1', tok.state, tok.heading, scene.seconds)),
        tok.x,
        tok.y,
        dim,
      );
    }
    // Rain slanting downwind, over everything (Book 10 rain: its drops and slant).
    if (w.rain && !reduced) this.#rain(scene.seconds, wind.x >= 0 ? 1 : -1, w.storm);
    // The bolt on the bright frames, where this strike falls.
    if (flash >= 0.99 && strike >= 0 && !reduced) {
      const bx = 40 + hash(strike * 7 + 3) * (W - 80);
      const byy = 70 + hash(strike * 7 + 5) * (H - 120);
      this.#blit(this.#cut('fx_seabolt', 'bolt/-/0'), bx, byy);
    }
    return { rgba: this.#bytes, flash };
  }

  /** A route's brush dabs along its path: inked dashes, faint dots, or the course marching. */
  #route(r: ChartRoute, seconds: number, reduced: boolean): void {
    const pts = r.points;
    const n = pts.length >> 1;
    if (n < 2) return;
    const course = r.kind === 'course';
    const dash = course ? 7 : r.kind === 'known' ? 6 : 6;
    const gap = course ? 4 : r.kind === 'known' ? 4 : 0;
    const every = r.kind === 'rumour' ? 4 : 2;
    const period = dash + gap;
    // The plotted course marches slowly towards its end (none with reduced motion).
    const march = course && !reduced ? Math.floor(seconds * 6) % period : 0;
    const sheet = 'ui_seaicons';
    const dab = `dab_${r.kind}`;
    for (let i = 0; i < n; i += every) {
      const along = (i - march + period * 1000) % period;
      if (gap > 0 && along >= dash) continue;
      const shape = (i * 7) % 3;
      this.#blit(this.#cut(sheet, `${dab}/-/${shape}`), pts[i * 2] ?? 0, (pts[i * 2 + 1] ?? 0) + 7);
    }
    if (course) {
      // Chevrons along the course every 36 px, pointing on.
      for (let i = 18; i < n - 6; i += 36) {
        const j = Math.min(n - 1, i + 3);
        const h = headingOf(
          (pts[j * 2] ?? 0) - (pts[i * 2] ?? 0),
          (pts[j * 2 + 1] ?? 0) - (pts[i * 2 + 1] ?? 0),
        );
        this.#blit(this.#cut(sheet, `chev_${h}/-/0`), pts[i * 2] ?? 0, (pts[i * 2 + 1] ?? 0) + 7);
      }
    }
  }

  #rain(seconds: number, side: number, storm: boolean): void {
    const b = this.#storm;
    const drops = Math.round(storm ? b.rainDrops[1] : b.rainDrops[0]);
    const slant = (b.rainSlantDegrees * Math.PI) / 180;
    const dx = Math.sin(slant) * side;
    const dy = Math.cos(slant);
    const speed = 260;
    const out = this.#out;
    const pale = this.#layers.fogThin;
    const lit = this.#layers.lit;
    for (let i = 0; i < drops; i++) {
      const len = 4 + Math.floor(hash(i * 3 + 1) * 3);
      const phase = hash(i * 3 + 2);
      const run = ((seconds * speed + phase * (H + 40)) % (H + 40)) - 20;
      const x0 = hash(i * 3) * (W + 80) - 40 + run * dx;
      const y0 = run * dy;
      for (let k = 0; k < len; k++) {
        const x = Math.round(x0 + dx * k);
        const y = Math.round(y0 + dy * k);
        if (x < 5 || y < 5 || x >= W - 5 || y >= H - 5) continue;
        const idx = y * W + x;
        out[idx] = (k === len - 1 ? lit[idx] : pale[idx]) ?? 0;
      }
    }
  }
}

/**
 * The painted path of each route round the coast: the shortest way by open water on a 4 px grid
 * between its two ends (the ends may lie ashore), smoothed twice and spaced a pixel apart.
 */
export function routePath(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  isLand: (x: number, y: number) => boolean,
  seed: number,
): Float32Array {
  const C = 4;
  const gw = Math.ceil(W / C);
  const gh = Math.ceil(H / C);
  const cell = (x: number, y: number): number =>
    Math.max(0, Math.min(gh - 1, Math.round(y / C))) * gw +
    Math.max(0, Math.min(gw - 1, Math.round(x / C)));
  const blocked = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      let land = 0;
      for (let d = 0; d < 4; d++) if (isLand(gx * C + (d & 1) * 2, gy * C + (d >> 1) * 2)) land++;
      const x = gx * C;
      const y = gy * C;
      // The chart's frame and its edge are never sailed; land near either end is (the landing).
      const near = Math.hypot(x - from.x, y - from.y) < 14 || Math.hypot(x - to.x, y - to.y) < 14;
      blocked[gy * gw + gx] =
        x < 8 || y < 8 || x > W - 8 || y > H - 8 ? 1 : land >= 2 && !near ? 1 : 0;
    }
  // A* with a little per-route wobble in the cost, so neighbouring routes do not run together.
  const start = cell(from.x, from.y);
  const goal = cell(to.x, to.y);
  const g = new Float32Array(gw * gh).fill(Infinity);
  const came = new Int32Array(gw * gh).fill(-1);
  const open: number[] = [start];
  const fscore = new Float32Array(gw * gh).fill(Infinity);
  g[start] = 0;
  const hx = (i: number): number =>
    Math.hypot((i % gw) - (goal % gw), Math.floor(i / gw) - Math.floor(goal / gw));
  fscore[start] = hx(start);
  const inOpen = new Uint8Array(gw * gh);
  inOpen[start] = 1;
  while (open.length > 0) {
    let best = 0;
    for (let k = 1; k < open.length; k++)
      if ((fscore[open[k] ?? 0] ?? 0) < (fscore[open[best] ?? 0] ?? 0)) best = k;
    const cur = open[best] ?? 0;
    open.splice(best, 1);
    inOpen[cur] = 0;
    if (cur === goal) break;
    const cx = cur % gw;
    const cy = Math.floor(cur / gw);
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const ni = ny * gw + nx;
        if (blocked[ni] === 1 && ni !== goal) continue;
        const step = (ox !== 0 && oy !== 0 ? Math.SQRT2 : 1) * (1 + 0.15 * hash(ni * 31 + seed));
        const ng = (g[cur] ?? 0) + step;
        if (ng >= (g[ni] ?? Infinity)) continue;
        g[ni] = ng;
        came[ni] = cur;
        fscore[ni] = ng + hx(ni);
        if (inOpen[ni] === 0) {
          inOpen[ni] = 1;
          open.push(ni);
        }
      }
  }
  let pts: [number, number][] = [];
  if (came[goal] === -1 && goal !== start)
    pts = [
      [from.x, from.y],
      [to.x, to.y],
    ];
  else {
    for (let i = goal; i !== -1; i = came[i] ?? -1) {
      pts.unshift([(i % gw) * C, Math.floor(i / gw) * C]);
      if (i === start) break;
    }
    pts[0] = [from.x, from.y];
    pts[pts.length - 1] = [to.x, to.y];
  }
  // Chaikin's corner cutting, twice: a brush's curve, not a grid's steps.
  for (let pass = 0; pass < 3; pass++) {
    const next: [number, number][] = [pts[0] ?? [from.x, from.y]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] ?? [0, 0];
      const b = pts[i + 1] ?? [0, 0];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    next.push(pts[pts.length - 1] ?? [to.x, to.y]);
    pts = next;
  }
  // Spaced a pixel apart.
  const out: number[] = [];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] ?? [0, 0];
    const b = pts[i + 1] ?? [0, 0];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = carry;
    while (s <= len) {
      const f = len === 0 ? 0 : s / len;
      out.push(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      s += 1;
    }
    carry = s - len;
  }
  const last = pts[pts.length - 1] ?? [to.x, to.y];
  out.push(last[0], last[1]);
  return Float32Array.from(out);
}

/** A point a share of the way along a path, and the heading there. */
export function alongPath(
  points: Float32Array,
  share: number,
): { x: number; y: number; heading: Heading } {
  const n = points.length >> 1;
  if (n === 0) return { x: 0, y: 0, heading: 'e' };
  const f = Math.max(0, Math.min(1, share)) * (n - 1);
  const i = Math.floor(f);
  const j = Math.min(n - 1, i + 1);
  const k = f - i;
  const x = (points[i * 2] ?? 0) * (1 - k) + (points[j * 2] ?? 0) * k;
  const y = (points[i * 2 + 1] ?? 0) * (1 - k) + (points[j * 2 + 1] ?? 0) * k;
  const a = Math.max(0, i - 4);
  const b = Math.min(n - 1, i + 4);
  return {
    x,
    y,
    heading: headingOf(
      (points[b * 2] ?? 0) - (points[a * 2] ?? 0),
      (points[b * 2 + 1] ?? 0) - (points[a * 2 + 1] ?? 0),
    ),
  };
}

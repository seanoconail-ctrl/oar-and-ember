/**
 * The Wreck Strand art generator (Book 7 sections 11 and 14), deterministic and committed with
 * its output. It writes, in the approved palette:
 *
 * - tile_strand: the dual-grid autotiles of the zone (src/render/autotile.ts). Every visual tile
 *   the zone uses is painted pixel by pixel: the terrain from its corners, then that terrain's
 *   texture (ported from the approved mockup), then edge treatments read from how close the pixel
 *   is to a boundary: the grass lip and the dark undercut of the bank, shadow at the bank's foot,
 *   wet weedy rock bases, a damp line at the tide line. Textures repeat every PERIOD tiles, the
 *   same as the boundary noise, so tiles join without a seam.
 * - decal_strand: pebble clusters, shells, wrack, driftwood twigs and stones (flat decoration).
 * - plant_strand: grass, tussocks, marram, thrift, clover and trefoil, each in four variants and
 *   seven lean frames (-3 to +3 pixels) for the wind and for parting round walkers.
 * - fx_strand: particles, footprints and ripples.
 */
import {
  LAYERS,
  PERIOD,
  TILE,
  layerIndex,
  phaseOf,
  pixelInfo,
  tileState,
  visualCorners,
} from '../../render/autotile.ts';
import type { Layer } from '../../render/autotile.ts';
import { fbm, hash01, valueNoise } from '../../render/noise.ts';
import { rampCode } from '../../render/palette.ts';
import type { Palette } from '../../render/palette.ts';

const P = PERIOD * TILE;
const TAU = Math.PI * 2;

type Code = string;
type Grid = Code[][];

/** Pixels from the boundary above (a higher layer starting) or from its own lower edge. */
const PX = 20;

function paint(
  palette: Palette,
  corners: readonly Layer[],
  lx: number,
  ly: number,
  wx: number,
  wy: number,
): Code {
  const c = (ramp: string, step: number): Code => rampCode(palette, ramp, step);
  const px = pixelInfo(corners, lx, ly, wx, wy);
  const layer = LAYERS[px.layer] ?? '~';
  const tone = fbm(wx, wy, 40, 11, 2, P);
  const detail = valueNoise(wx, wy, 6, 12, P);
  const inside = (px.margins[px.layer] ?? 1) * PX; // px inside its own lower edge
  const nearAbove = (L: number): number => -(px.margins[L] ?? -1) * PX; // px to where L begins
  const underCode = LAYERS[px.under] ?? '~';
  const wetBelow = underCode === '~' || underCode === '-' || underCode === '_' || underCode === 'w';
  switch (layer) {
    case ',': {
      // Machair: cool grey-green with calm tonal patches; a lit grass lip over the bank's edge.
      if (inside < 1.6 && (underCode === 'b' || underCode === '.')) return c('grass', 8.6);
      const worn = valueNoise(wx, wy, 20, 13, P) > 0.78 ? -1.2 : 0;
      return c('grass', 5.1 + (tone - 0.5) * 2.4 + (detail - 0.5) * 0.9 + worn);
    }
    case 'b': {
      // The bank: a face of rock and earth in strata, ledges lit, cracks dark; the undercut below
      // the grass lip is the darkest part.
      const above = nearAbove(layerIndex(','));
      if (above < 3) return c('earth', 0.6 + above * 0.5);
      const strata = fbm(wx, wy, 10, 14, 2, P);
      const band = Math.floor((wy + strata * 4) / 3.5);
      const ledge = (wy + strata * 4) % 3.5 < 0.9 && band % 2 === 1;
      if (ledge) return c('stone', 7);
      if (valueNoise(wx, wy, 2, 15, P) > 0.82) return c('stone', 1);
      const foot = inside < 3 ? -1 : 0;
      return c('stone_warm', 3.4 + (band % 2) * 0.9 - (band % 3 === 0 ? 0.7 : 0) + foot);
    }
    case '.': {
      // Dry sand above the tide line, rippled by the west wind in patches; shadow at the bank's
      // foot and under the grass edge; a damp line where it meets the foreshore.
      const shade = Math.min(nearAbove(layerIndex('b')), nearAbove(layerIndex(',')));
      if (shade < 3.5) return c('sand', shade < 1.8 ? 1.2 : 2.2);
      if (inside < 1.4 && wetBelow) return c('sand', 2.3);
      // Wind ripples in patches: soft lit crests across the west wind, calm sand between.
      const amp = Math.max(0, Math.min(1, (valueNoise(wx, wy, 40, 16, P) - 0.5) * 3));
      const ripple = Math.sin(
        (TAU * (wx * 20)) / P +
          Math.sin((TAU * wy * 2) / P) * 2.2 +
          Math.sin((TAU * wy * 7) / P) * 0.9 +
          detail * 1.4,
      );
      const crest = ripple > 0.9 ? 0.6 * amp : 0;
      const speck = hash01(wx, wy, 24) < 0.03 ? (hash01(wx, wy, 25) < 0.5 ? -1 : 0.8) : 0;
      return c('sand', 3.6 + (tone - 0.5) * 1.2 + crest + speck);
    }
    case '_': {
      // The foreshore: wet sand, darker and cooler, with a sheen of sky in streaks.
      if (nearAbove(layerIndex('r')) < 2) return c('sand_wet', 0.4);
      const sheen = Math.sin((TAU * wx * 20) / P + detail * 6) > 0.88 && tone > 0.45;
      if (sheen) return c('sky', 2);
      return c('sand_wet', 2.4 + (tone - 0.5) * 1.0 + (detail > 0.7 ? 0.5 : 0));
    }
    case '-': {
      // The tidal flats: wet sand with the ripple marks the ebb leaves.
      if (nearAbove(layerIndex('r')) < 2) return c('sand_wet', 0.5);
      const r = Math.sin(TAU * ((wy * 8) / P + Math.sin((TAU * wx * 2) / P) * 0.3) + detail);
      return c('sand_wet', 3 + (r > 0.8 ? 1 : r < -0.85 ? -1 : 0) + (tone - 0.5) * 0.6);
    }
    case '~':
      return c('sand_wet', 0.5 + tone * 0.8);
    case 'w': {
      // The stream bed: stones and dark sand (the water itself is drawn by the water shader).
      const st = valueNoise(wx, wy, 4, 17, P);
      return st > 0.62 ? c('stone', 3 + (st > 0.75 ? 1 : 0)) : c('sand_wet', 1.4);
    }
    case 'r': {
      // Rock: a jumble of faceted boulders lit from the upper left; wet and weedy where the
      // water reaches it, dark at its foot elsewhere; lichen on lit faces.
      if (inside < 2.2) {
        if (wetBelow)
          return hash01(wx, wy >> 1, 18) < 0.4
            ? c('kelp', 2 + hash01(wx, wy, 19) * 3)
            : c('stone', 1.2);
        return c('stone', 1);
      }
      return boulderShade(c, wx, wy);
    }
  }
  return c('sand', 3);
}

/** Faceted boulders on a jittered lattice that repeats every P pixels. */
function boulderShade(c: (r: string, s: number) => Code, wx: number, wy: number): Code {
  const S = 15;
  const gi = Math.floor(wx / S);
  const gj = Math.floor(wy / S);
  let best = { d: 9, dx: 0, dy: 0, rad: 1, seed: 0 };
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const i = gi + di;
      const j = gj + dj;
      const wi = ((i % (P / S)) + P / S) % (P / S);
      const wj = ((j % (P / S)) + P / S) % (P / S);
      const cx = i * S + 3 + hash01(wi, wj, 21) * 9;
      const cy = j * S + 3 + hash01(wi, wj, 22) * 9;
      const rad = 6 + hash01(wi, wj, 23) * 5;
      const dx = (wx + 0.5 - cx) / rad;
      const dy = (wy + 0.5 - cy) / (rad * 0.75);
      const d = Math.hypot(dx, dy);
      if (d < best.d) best = { d, dx, dy, rad, seed: wi * 31 + wj };
    }
  }
  if (best.d > 1) return c('stone', 1);
  if (best.d > 0.9) return c('stone', 2);
  const a = Math.atan2(best.dy, best.dx);
  const facet = Math.round((a + Math.PI) / (Math.PI / 3)) * (Math.PI / 3) - Math.PI;
  const nz = Math.sqrt(Math.max(0, 1 - best.d * best.d));
  let shade = (-Math.cos(facet) * -0.6 - Math.sin(facet) * -0.8) * best.d + nz * 0.5;
  if (best.d < 0.4) shade = 0.65;
  const step = 5 + Math.round(shade * 3.6 - 0.9);
  if (step >= 6 && hash01(Math.floor(wx / 2), Math.floor(wy / 2), best.seed) < 0.12)
    return c('moss', 5 + (step > 6 ? 1 : 0));
  return c('stone', step);
}

function header(name: string, kind: string, w: number, h: number, pivot: string): string[] {
  return [
    `# Generated by src/tools/art/strandArt.ts. Do not edit by hand: change the generator and run`,
    '# npm run art:sheets.',
    `sheet: ${name}`,
    `kind: ${kind}`,
    'palette: book07',
    `size: ${w}x${h}`,
    `pivot: ${pivot}`,
    `footprint: ${w}x${h}`,
    'facings: -',
    'placeholder: false',
  ];
}

/** The autotile sheet for a zone's rows: every visual tile the zone uses. */
export function strandTiles(palette: Palette, rows: readonly string[]): string {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  const states = new Map<string, { corners: Layer[]; phase: number }>();
  for (let j = 0; j <= height; j++) {
    for (let i = 0; i <= width; i++) {
      const corners = visualCorners(rows, i, j);
      const phase = phaseOf(i, j);
      states.set(tileState(corners, phase), { corners, phase });
    }
  }
  const lines = header('tile_strand', 'tile', TILE, TILE, '0,0');
  lines.push('# Dual-grid autotiles: g_<corners TL TR BL BR>_<place in the 5 x 5 pattern>.');
  const blocks: string[] = [];
  for (const [state, { corners, phase }] of [...states].sort(([a], [b]) => (a < b ? -1 : 1))) {
    lines.push(`anim.${state}: frames 1, ticks 1`);
    const pi = phase % PERIOD;
    const pj = Math.floor(phase / PERIOD);
    const rowsOut: string[] = [];
    for (let ly = 0; ly < TILE; ly++) {
      let row = '';
      for (let lx = 0; lx < TILE; lx++) {
        const wx = (((pi * TILE - TILE / 2 + lx) % P) + P) % P;
        const wy = (((pj * TILE - TILE / 2 + ly) % P) + P) % P;
        row += paint(palette, corners, lx, ly, wx, wy);
      }
      rowsOut.push(row);
    }
    blocks.push('', `frame ${state} - 0`, ...rowsOut, 'end');
  }
  return `${[...lines, ...blocks].join('\n')}\n`;
}

// ------------------------------------------------------------------ small art
function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => new Array<Code>(w).fill('.'));
}

function put(g: Grid, x: number, y: number, code: Code): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  const row = g[yi];
  if (row !== undefined && xi >= 0 && xi < row.length) row[xi] = code;
}

function pebble(
  g: Grid,
  palette: Palette,
  cx: number,
  cy: number,
  rx: number,
  ramp: string,
  base: number,
): void {
  const c = (r: string, s: number): Code => rampCode(palette, r, s);
  const ry = Math.max(1, rx * 0.7);
  put(g, cx + 0.6, cy + ry + 0.4, c('stone', 1));
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const inside = (xx: number, yy: number): boolean =>
        ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1;
      if (!inside(x, y)) continue;
      const dark = !inside(x + 1, y + 1) || !inside(x, y + 1);
      const lit = !inside(x - 1, y - 1) || !inside(x, y - 1);
      put(g, x, y, c(ramp, base + (dark ? -2 : lit ? 1 : 0)));
    }
  }
}

function block(state: string, index: number, g: Grid): string[] {
  return ['', `frame ${state} - ${index}`, ...g.map((r) => r.join('')), 'end'];
}

/** Flat decoration: pebble clusters, shells, wrack, twigs and stones in grass. */
export function strandDecals(palette: Palette): string {
  const c = (r: string, s: number): Code => rampCode(palette, r, s);
  const lines = header('decal_strand', 'decal', 18, 12, '9,6');
  lines.push(
    'anim.pebbles: frames 10, ticks 1',
    'anim.shells: frames 4, ticks 1',
    'anim.wrack: frames 8, ticks 1',
    'anim.twigs: frames 3, ticks 1',
    'anim.stones: frames 4, ticks 1',
  );
  const out: string[] = [];
  const kinds: readonly (readonly [string, number])[] = [
    ['stone', 5],
    ['stone', 6],
    ['stone', 4],
    ['stone_warm', 3],
    ['stone', 7],
    ['sand', 2],
    ['stone_warm', 4],
  ];
  for (let k = 0; k < 10; k++) {
    const g = grid(18, 12);
    const n = 4 + Math.floor(hash01(k, 1) * 6);
    for (let p = 0; p < n; p++) {
      const rx = 0.9 + hash01(k, p, 2) * 2.2;
      const [ramp, base] = kinds[Math.floor(hash01(k, p, 3) * kinds.length)] ?? ['stone', 5];
      pebble(g, palette, 3 + hash01(k, p, 4) * 12, 2.5 + hash01(k, p, 5) * 7, rx, ramp, base);
    }
    out.push(...block('pebbles', k, g));
  }
  for (let k = 0; k < 4; k++) {
    const g = grid(18, 12);
    for (let p = 0; p < 3; p++) {
      const x = 4 + hash01(k, p, 6) * 10;
      const y = 3 + hash01(k, p, 7) * 6;
      const pink = hash01(k, p, 8) < 0.4;
      put(g, x, y, c(pink ? 'thrift' : 'wool', pink ? 4 : 6));
      put(g, x + 1, y, c(pink ? 'thrift' : 'wool', pink ? 3 : 5));
      put(g, x + 1, y + 1, c('stone', 2));
    }
    out.push(...block('shells', k, g));
  }
  for (let k = 0; k < 8; k++) {
    // A strand of washed-up kelp, wavy, with dark shadow and a few bladders.
    const g = grid(18, 12);
    const len = 9 + Math.floor(hash01(k, 9) * 8);
    const ang = (hash01(k, 10) - 0.5) * 0.7;
    for (let s = 0; s < len; s++) {
      const x = 1 + s;
      const y = 6 + Math.sin(s * 0.8 + k) * 1.2 + s * ang;
      put(g, x, y + 1, c('kelp', 0));
      put(g, x, y, c('kelp', 2 + (s % 4 === 0 ? 2 : s % 3 === 0 ? 1 : 0)));
      if (s % 5 === 2) put(g, x, y - 1, c('kelp', 5));
    }
    if (k % 3 === 0) for (let s = 0; s < 6; s++) put(g, 5 + s, 3 + s * 0.3, c('kelp', 3));
    out.push(...block('wrack', k, g));
  }
  for (let k = 0; k < 3; k++) {
    const g = grid(18, 12);
    const len = 7 + k * 2;
    for (let s = 0; s < len; s++) {
      put(g, 3 + s, 6 + s * 0.15 * (k - 1), c('driftwood', 5 - (s % 4 === 0 ? 1 : 0)));
      put(g, 3 + s, 7 + s * 0.15 * (k - 1), c('driftwood', 2));
    }
    out.push(...block('twigs', k, g));
  }
  for (let k = 0; k < 4; k++) {
    const g = grid(18, 12);
    pebble(g, palette, 8 + hash01(k, 11) * 2, 6, 2.2 + hash01(k, 12), 'stone', 5);
    if (k % 2 === 0) pebble(g, palette, 12, 7, 1.4, 'stone', 4);
    out.push(...block('stones', k, g));
  }
  return `${[...lines, ...out].join('\n')}\n`;
}

/** One plant at a lean, drawn with its foot at (8, 15) of a 16 x 16 canvas. */
function plantFrame(palette: Palette, kind: string, variant: number, lean: number): Grid {
  const c = (r: string, s: number): Code => rampCode(palette, r, s);
  const g = grid(16, 16);
  const x0 = 8;
  const y0 = 14;
  const h = (k: number): number => hash01(variant, k, kind.length);
  if (kind === 'thrift') {
    for (const dx of [-1, 0, 1]) put(g, x0 + dx, y0, c('moss', 2));
    put(g, x0, y0 - 1, c('moss', 3));
    for (let k = 0; k < 3; k++) {
      const hx = x0 + (k - 1) * 2 + lean * 0.6;
      const hy = y0 - 3 - (k % 2);
      put(g, hx, hy + 1, c('moss', 4));
      put(g, hx, hy, c('thrift', 3 + (k === 1 ? 1 : 0)));
      put(g, hx + 1, hy, c('thrift', 2));
    }
    return g;
  }
  if (kind === 'clover' || kind === 'trefoil') {
    const ramp = kind === 'clover' ? 'clover_white' : 'trefoil';
    const n = kind === 'clover' ? 4 : 5;
    for (let k = 0; k < 2 + (variant % 2); k++) {
      const fx = x0 + (k - 1) * 3 + (h(k) - 0.5) * 2;
      put(g, fx - 1, y0, c('grass', 4));
      put(g, fx + 1, y0, c('grass', 5));
      const stem = 2 + (variant % 2);
      for (let s = 0; s < stem; s++)
        put(g, fx + (lean * 0.45 * s) / stem, y0 - s, c('grass', 5 + s));
      const bx = fx + lean * 0.45;
      const top = y0 - stem;
      put(g, bx, top, c(ramp, n - 2));
      put(g, bx + 1, top, c(ramp, n - 3));
      put(g, bx, top - 1, c(ramp, n - 1));
    }
    return g;
  }
  const marram = kind === 'marram';
  const tall = marram ? 9 + variant * 1.5 : kind === 'tussock' ? 7 + variant : 4 + variant * 0.7;
  const blades = marram ? 6 : kind === 'tussock' ? 6 : 3;
  const ramp = marram ? 'marram' : 'grass';
  put(g, x0, y0 + 1, c(marram ? 'sand' : 'grass', 1));
  for (let b = 0; b < blades; b++) {
    const off = (b - (blades - 1) / 2) * (marram ? 1 : 0.9);
    const bh = tall * (0.7 + 0.3 * h(b));
    const steps = Math.max(2, Math.floor(bh));
    // Each blade has its own set and splays out from the clump, and neighbours alternate in
    // shade, so a clump reads as separate blades rather than a block (as in the approved mockup,
    // where every blade wobbled on its own).
    const own = (h(b + 10) - 0.5) * 1.6;
    const splay = off * (marram ? 0.7 : 0.55);
    const shade = b % 2 === 0 ? 0 : -1;
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      const bend = (lean + own + splay) * f * f;
      const idx = (marram ? 1.5 + f * 4.5 : 2.5 + f * 8) + shade;
      put(g, x0 + off + bend, y0 - s, c(ramp, idx));
    }
  }
  return g;
}

export const PLANT_LEANS = [-3, -2, -1, 0, 1, 2, 3] as const;

export function strandPlants(palette: Palette): string {
  const lines = [
    '# Generated by src/tools/art/strandArt.ts. Do not edit by hand: change the generator and run',
    '# npm run art:sheets.',
    '# Each state is one plant variant; its seven frames lean it from -3 to +3 pixels (frame 3 is',
    '# upright), so the renderer can bend it in the wind and part it round walkers.',
    'sheet: plant_strand',
    'kind: plant',
    'palette: book07',
    'size: 16x16',
    'pivot: 8,15',
    'footprint: 4x2',
    'facings: -',
    'placeholder: false',
  ];
  const out: string[] = [];
  for (const kind of ['grass', 'tussock', 'marram', 'thrift', 'clover', 'trefoil']) {
    for (let v = 0; v < 4; v++) {
      lines.push(`anim.${kind}${v}: frames 7, ticks 1`);
      PLANT_LEANS.forEach((lean, i) =>
        out.push(...block(`${kind}${v}`, i, plantFrame(palette, kind, v, lean))),
      );
    }
  }
  return `${[...lines, ...out].join('\n')}\n`;
}

/** Particles, footprints and ripples (visual only). */
export function strandFx(palette: Palette): string {
  const c = (r: string, s: number): Code => rampCode(palette, r, s);
  const lines = header('fx_strand', 'decal', 8, 8, '4,4');
  const states: [string, Grid[]][] = [];
  const one = (code: Code, w = 1, h = 1): Grid => {
    const g = grid(8, 8);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(g, 4 + x, 4 + y, code);
    return g;
  };
  states.push(['spray', [one(c('sea', 10)), one(c('sea', 9)), one(c('sea', 10), 2)]]);
  states.push(['sand', [one(c('sand', 6), 3), one(c('sand', 5), 4), one(c('sand', 6), 2)]]);
  const rain = (): Grid => {
    const g = grid(8, 8);
    for (let k = 0; k < 4; k++) put(g, 5 - k * 0.5, 1 + k * 2, c('sky', 5));
    return g;
  };
  states.push(['rain', [rain()]]);
  states.push(['dust', [one(c('sand', 6), 2), one(c('sand', 5)), one(c('sand', 4))]]);
  const print = (wet: boolean): Grid => {
    const g = grid(8, 8);
    put(g, 3, 4, c(wet ? 'sand_wet' : 'sand', wet ? 0.6 : 1.4));
    put(g, 4, 4, c(wet ? 'sand_wet' : 'sand', wet ? 0.6 : 1.4));
    put(g, 4, 3, c(wet ? 'sky' : 'sand', wet ? 2 : 2.2));
    return g;
  };
  states.push(['print_dry', [print(false)]]);
  states.push(['print_wet', [print(true)]]);
  const ring = (rad: number): Grid => {
    const g = grid(8, 8);
    for (let a = 0; a < 16; a++)
      put(
        g,
        4 + Math.cos((a / 16) * TAU) * rad,
        4 + Math.sin((a / 16) * TAU) * rad * 0.5,
        c('sea', 9),
      );
    return g;
  };
  states.push(['ripple', [ring(1), ring(2), ring(3)]]);
  // Midges over the machair by the stream on a still morning: a speck and its blur.
  states.push(['midge', [one(c('smoke', 0)), one(c('smoke', 1), 2)]]);
  for (const [state, frames] of states)
    lines.push(`anim.${state}: frames ${frames.length}, ticks 1`);
  const out = states.flatMap(([state, frames]) => frames.flatMap((g, i) => block(state, i, g)));
  return `${[...lines, ...out].join('\n')}\n`;
}

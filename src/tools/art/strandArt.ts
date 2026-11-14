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

/**
 * Which ground sheet a tile is painted for (Stage 14, decision S14-32): the strand's and the
 * moor's paint every shared terrain alike (rock, shingle, sea, foam), so the moor's scenes meet the
 * strand's without a seam; the caves paint rock as a passage's wet walls and the earth floor as
 * the cairn's.
 */
export type GroundSet = 'strand' | 'moor' | 'cave';

function paint(
  palette: Palette,
  corners: readonly Layer[],
  lx: number,
  ly: number,
  wx: number,
  wy: number,
  set: GroundSet = 'strand',
): Code {
  const c = (ramp: string, step: number): Code => rampCode(palette, ramp, step);
  const px = pixelInfo(corners, lx, ly, wx, wy);
  const layer = LAYERS[px.layer] ?? '~';
  const tone = fbm(wx, wy, 40, 11, 2, P);
  const detail = valueNoise(wx, wy, 6, 12, P);
  const inside = (px.margins[px.layer] ?? 1) * PX; // px inside its own lower edge
  const nearAbove = (L: number): number => -(px.margins[L] ?? -1) * PX; // px to where L begins
  const underCode = LAYERS[px.under] ?? '~';
  // Stage 14: the terrain under the pixel among those its corners really have (pixelInfo's
  // `under` can name a layer between two corners' that is in neither, which the strand's nine
  // never met but the moor's do: a cliff face over the sea would read as over a bog pool).
  let real = Math.min(...corners.map(layerIndex));
  for (const k of corners.map(layerIndex))
    if (k < px.layer && k > real && (px.margins[k] ?? -1) > 0) real = k;
  const realUnder = LAYERS[real] ?? '~';
  const realWet =
    realUnder === '~' ||
    realUnder === '-' ||
    realUnder === '_' ||
    realUnder === 'w' ||
    realUnder === 'o' ||
    realUnder === '=';
  const wetBelow =
    underCode === '~' ||
    underCode === '-' ||
    underCode === '_' ||
    underCode === 'w' ||
    underCode === 'o' ||
    underCode === '=';
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
    case '~': {
      // The sea bed, seen through the shallows: dark sand, stones and weed in patches.
      const st = valueNoise(wx, wy, 5, 26, P);
      if (st > 0.7) return c('stone', 1 + (st > 0.8 ? 1 : 0));
      if (valueNoise(wx, wy, 9, 27, P) > 0.72 && detail > 0.5) return c('kelp', 1);
      return c('sand_wet', 0.4 + tone * 1.2 + (detail - 0.5) * 0.8);
    }
    case 'w': {
      // The stream bed: stones and dark sand (the water itself is drawn by the water shader).
      const st = valueNoise(wx, wy, 4, 17, P);
      return st > 0.62 ? c('stone', 3 + (st > 0.75 ? 1 : 0)) : c('sand_wet', 1.4);
    }
    case 'h': {
      // Heather moor (Stage 14): a dark peaty floor between cushions of heather, olive and brown,
      // in clumps with calm patches; the odd drift of purple tips; grass where it meets the turf.
      const cushion = valueNoise(wx, wy, 5, 40, P);
      const clump = fbm(wx, wy, 24, 41, 2, P);
      if (inside < 1.4 && (realUnder === ',' || realUnder === '.'))
        return c('weld', 1.2 + detail * 0.6);
      if (cushion < 0.3) return c('earth', 1.3 + tone * 0.8);
      const brown = valueNoise(wx, wy, 14, 42, P) > 0.68;
      if (brown) return c('bracken', 1.4 + cushion * 1.4);
      const bloom = clump > 0.62 && hash01(wx, wy, 43) < 0.35 && cushion > 0.55;
      if (bloom) return c('violet', 1.4 + detail * 1.4);
      return c('weld', 1.8 + (cushion - 0.5) * 2.2 + (tone - 0.5) * 1.0);
    }
    case 'p': {
      // Peat (Stage 14): black-brown, crumbling, wet in its hollows where the sky shows; dark at
      // the foot of a bank and round a pool.
      const crumb = hash01(wx, wy, 44);
      if (inside < 1.8 && realUnder === 'o') return c('tar', 0.8);
      if (valueNoise(wx, wy, 8, 45, P) > 0.74 && detail > 0.5) return c('sky', 0.6);
      if (crumb < 0.05) return c('tar', 3 + (crumb < 0.02 ? 1 : 0));
      return c('earth', 1.3 + (tone - 0.5) * 1.6 + (detail - 0.5) * 0.9);
    }
    case 'o': {
      // A bog pool's bed (Stage 14), seen through still peat-dark water (drawn by the water
      // shader): black peat with drowned sphagnum and a pale stem or two.
      if (inside < 2) return c('moss', 2.2);
      if (valueNoise(wx, wy, 5, 46, P) > 0.7) return c('moss', 1.4);
      return c('tar', 0.8 + tone * 1.2);
    }
    case 'c': {
      // A cliff face (Stage 14): strata in bands, lit ledges and dark cracks, lichen on the upper
      // courses, the turf's lip and its undercut at the top, the foot dark, wet and weedy where
      // the sea reaches it; peat where a bank is cut in the bog.
      const peaty = realUnder === 'p' || realUnder === 'o';
      if (inside < 2.4) {
        if (realWet)
          return hash01(wx, wy >> 1, 47) < 0.45 ? c('kelp', 1 + detail * 3) : c('stone', 1);
        if (realUnder === 'h' || realUnder === ',')
          return inside < 1.2 ? c('weld', 1.6) : c('earth', 0.6);
        return c(peaty ? 'tar' : 'stone', 1);
      }
      const strata = fbm(wx, wy, 10, 48, 2, P);
      const band = Math.floor((wy + strata * 5) / 4);
      if (peaty) {
        // The cut face of a peat bank: spade marks, roots.
        if ((wx + Math.floor(strata * 4)) % 6 === 0) return c('tar', 0.6);
        if (hash01(wx, wy, 49) < 0.06) return c('bracken', 2.4);
        return c('tar', 1.8 + (band % 2) * 0.6 + (tone - 0.5));
      }
      const ledge =
        (wy + strata * 5) % 4 < 0.9 && band % 3 === 1 && valueNoise(wx, wy, 9, 65, P) > 0.4;
      if (ledge) return hash01(wx, wy, 50) < 0.25 ? c('wool', 5.0) : c('stone', 5.6);
      if (valueNoise(wx, wy, 2, 51, P) > 0.84) return c('stone', 1.1);
      if (valueNoise(wx, wy, 3, 52, P) > 0.78 && tone > 0.5) return c('trefoil', 1.3);
      return c('stone', 3.2 + (band % 2) * 0.8 - (band % 3 === 0 ? 0.6 : 0) + (tone - 0.5) * 0.8);
    }
    case '=': {
      // The causeway (Stage 14): weed-hung boulders laid close, wrack between them, barnacles.
      if (inside < 1.6) return c('kelp', 1.2);
      const weed = valueNoise(wx, wy, 4, 53, P);
      if (weed > 0.5) return c('kelp', 1.4 + detail * 2.6);
      if (hash01(wx >> 1, wy >> 1, 54) < 0.06) return c('wool', 3.2);
      const lump = valueNoise(wx, wy, 6, 64, P);
      return c('stone', 1.4 + lump * 2.4 + (detail > 0.7 ? 0.6 : 0));
    }
    case 'n': {
      // A cave's wet rock floor (Stage 14): dark, worn smooth, a film of water catching the light
      // in streaks, weed and small pools in its hollows; darker at the walls' foot.
      if (inside < 2.4) return c('kelp', 1.4);
      if (valueNoise(wx, wy, 7, 55, P) > 0.72) return c('sea', 2 + detail);
      const sheen = Math.sin((TAU * (wx * 3 + wy * 5)) / P + detail * 5) > 0.9 && tone > 0.5;
      if (sheen) return c('stone', 4.4);
      return c('stone', 2.2 + (tone - 0.5) * 1.4 + (detail - 0.5) * 1.0);
    }
    case 'd': {
      // Drystone walling (Stage 14, the Hollow Cairn): flat stones in courses of uneven height
      // and length, each its own tone, the joints dark; lit along the top of each course.
      const row = Math.floor((wy + fbm(wx, wy, 9, 56, 1, P) * 2) / 4);
      const h = hash01(row, 57);
      const width = 5 + Math.floor(h * 6);
      const off = Math.floor(h * 13);
      const k = Math.floor((wx + off) / width);
      const inRow = (wy + fbm(wx, wy, 9, 56, 1, P) * 2) % 4;
      if (inRow < 0.9 || (wx + off) % width === 0) return c('stone', 0.6);
      const t = hash01(row, k, 58);
      return c('stone_warm', 2.2 + t * 2.4 + (inRow < 1.9 ? 0.9 : 0));
    }
    case ':': {
      if (set === 'cave') {
        // A cave's dry earth floor (Stage 14, the cairn): packed and dusty, grit and small
        // stones, dark along the walls' foot.
        const wall = Math.min(nearAbove(layerIndex('r')), nearAbove(layerIndex('d')));
        if (wall < 3) return c('earth', 1.0 + wall * 0.3);
        const grit = hash01(wx, wy, 59);
        if (grit < 0.03) return c('stone', 3.6);
        return c('earth', 2.4 + (tone - 0.5) * 1.4 + (detail - 0.5) * 0.7);
      }
      // The broch's court (Stage 7): trodden earth, darker and mossy in the damp ring of shade
      // at the wall's foot, with small stones and grit; calm patches where people walk most.
      const wall = nearAbove(layerIndex('r'));
      if (wall < 2.5) return c('moss', 1.4 + wall * 0.4);
      if (wall < 6 && valueNoise(wx, wy, 3, 31, P) > 0.55)
        return c('moss', 2 + (detail > 0.6 ? 1 : 0));
      const grit = hash01(wx, wy, 32);
      if (grit < 0.025) return c('stone', 4 + (grit < 0.01 ? 1 : 0));
      if (grit > 0.985) return c('earth', 1);
      return c('earth', 2.6 + (tone - 0.5) * 1.6 + (detail - 0.5) * 0.7 + (wall < 9 ? -0.5 : 0));
    }
    case 'r': {
      if (set === 'cave') {
        // A passage's wet rock wall seen from above (Stage 14): dark, rough, glistening; a weed
        // line at its foot where the sea reaches.
        if (inside < 2.4) return realWet ? c('kelp', 1.6 + detail * 2) : c('stone', 0.6);
        const glint = hash01(wx, wy, 60) < 0.02;
        if (glint) return c('stone', 5);
        return c('stone', 0.6 + (tone - 0.5) * 1.0 + (detail > 0.72 ? 0.9 : 0));
      }
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

/**
 * The autotile sheet for Skarvholm's zones: every visual tile any of them uses (Wreck Strand, and
 * from Stage 7 the machair round the broch). A zone's origin is a multiple of the pattern's period
 * away from the strand's, so a tile's place in the pattern is the same in either zone.
 */
export function strandTiles(palette: Palette, zones: readonly (readonly string[])[]): string {
  return groundTiles(palette, zones, 'tile_strand', 'strand');
}

/**
 * A ground sheet (Stage 14, decision S14-32): every visual tile its zones use, painted for its
 * set. tile_strand for the strand's zones, tile_moor for the moor's and the coast's new scenes,
 * tile_cave for the interiors.
 */
export function groundTiles(
  palette: Palette,
  zones: readonly (readonly string[])[],
  name: string,
  set: GroundSet,
): string {
  const states = new Map<string, { corners: Layer[]; phase: number }>();
  for (const rows of zones) {
    const width = rows[0]?.length ?? 0;
    const height = rows.length;
    for (let j = 0; j <= height; j++) {
      for (let i = 0; i <= width; i++) {
        const corners = visualCorners(rows, i, j);
        const phase = phaseOf(i, j);
        states.set(tileState(corners, phase), { corners, phase });
      }
    }
  }
  const lines = header(name, 'tile', TILE, TILE, '0,0');
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
        row += paint(palette, corners, lx, ly, wx, wy, set);
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
    'anim.path: frames 4, ticks 1',
  );
  const out: string[] = [];
  const kinds: readonly (readonly [string, number])[] = [
    ['stone_warm', 5],
    ['stone', 6],
    ['stone_warm', 4],
    ['sand', 5],
    ['stone', 7],
    ['sand', 3],
    ['stone_warm', 6],
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
  for (let k = 0; k < 4; k++) {
    // A worn patch of footpath: bare earth, flattened grass at its edges, a stone or two.
    const g = grid(18, 12);
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 18; x++) {
        const dx = (x + 0.5 - 9) / (7.5 + hash01(k, y, 30) * 1.2);
        const dy = (y + 0.5 - 6) / 4.6;
        const d = Math.hypot(dx, dy);
        if (d > 1) continue;
        if (d > 0.78) {
          if (hash01(k, x, y, 31) < 0.55) put(g, x, y, c('grass', 3 + hash01(k, x, y, 32) * 1.5));
          continue;
        }
        const n = hash01(k, x, y, 33);
        // Flattened grass shows through the trodden earth.
        if (n < 0.28) put(g, x, y, c('grass', 3.5 + n * 4));
        else put(g, x, y, c('stone_warm', 2.6 + (n - 0.5) * 1.1 + (y < 4 ? 0.4 : 0)));
        if (n > 0.95) put(g, x, y, c('stone', 5));
      }
    }
    out.push(...block('path', k, g));
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
  if (kind === 'heather') {
    // Stage 14: a heather bush, a low dome of olive-brown sprigs, its tips purple in some
    // variants; the top bends with the lean, the woody foot stays put.
    const w = 2 + (variant % 2);
    const tall = 4 + (variant >> 1);
    const bloom = variant >= 2;
    put(g, x0, y0 + 1, c('earth', 0));
    for (let dy = 0; dy < tall; dy++) {
      const span = w * Math.sqrt(Math.max(0, 1 - (dy / tall) ** 2)) + 0.5;
      const bend = lean * (dy / tall) ** 1.2;
      for (let dx = -Math.floor(span); dx <= Math.floor(span); dx++) {
        if (hash01(variant, dx + 9, dy, 61) < 0.16) continue;
        const top = dy >= tall - 2 || Math.abs(dx) >= span - 1;
        let code = c('weld', 1.5 + (dy / tall) * 2.6 + (dx < 0 ? 0.6 : 0));
        if (bloom && top && hash01(variant, dx + 9, dy, 62) < 0.55)
          code =
            hash01(variant, dx + 9, dy, 63) < 0.7
              ? c('violet', 2 + hash01(dx, dy) * 2)
              : c('thrift', 2.5);
        put(g, x0 + dx + bend, y0 - dy, code);
      }
    }
    return g;
  }
  if (kind === 'cotton') {
    // Stage 14: bog cotton, thin stalks with white tufted heads that nod in the wind.
    for (let k = 0; k < 2 + (variant % 2); k++) {
      const sx = x0 + (k - 1) * 2;
      const hgt = 6 + ((k * 2 + variant) % 4);
      for (let s = 0; s < hgt; s++) {
        const f = s / hgt;
        put(g, sx + lean * f * f, y0 - s, c('grass', 3 + f * 3));
      }
      const hx = sx + lean;
      put(g, hx, y0 - hgt, c('wool', 6));
      put(g, hx + 1, y0 - hgt, c('wool', 5));
      put(g, hx, y0 - hgt - 1, c('wool', 6));
    }
    put(g, x0 - 1, y0, c('grass', 3));
    put(g, x0 + 1, y0, c('grass', 4));
    return g;
  }
  if (kind === 'bracken') {
    // Stage 14: a bracken frond, a stem with paired pinnae, its tip curling over with the lean;
    // the browner variants for the dying fronds.
    const ramp = variant >= 3 ? 'bracken' : 'fern';
    const n = 9 + (variant % 2) * 2;
    for (let j = 0; j < n; j++) {
      const f = j / n;
      const px = x0 + lean * f * f;
      const py = y0 - j;
      put(g, px, py, c(ramp, 1.5 + f * 2.5));
      if (j > 2 && j % 2 === 0) {
        const span = Math.floor(3 * (1 - f) + 1);
        for (let s = 1; s <= span; s++) {
          put(g, px - s, py + s * 0.4, c(ramp, 2 + f * 2));
          put(g, px + s, py + s * 0.4, c(ramp, 1 + f * 2));
        }
      }
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

/** The plants of a sheet: the strand's six, and from Stage 14 the moor's three after them. */
export const STRAND_PLANT_KINDS = ['grass', 'tussock', 'marram', 'thrift', 'clover', 'trefoil'];
export const MOOR_PLANT_KINDS = [...STRAND_PLANT_KINDS, 'heather', 'cotton', 'bracken'];

export function strandPlants(palette: Palette): string {
  return plantSheet(palette, 'plant_strand', STRAND_PLANT_KINDS);
}

/**
 * Stage 14 (decision S14-33): plant_moor holds the strand's plants and the moor's (heather, bog
 * cotton and bracken), drawn by the same hand, so a moor scene draws all its plants in one batch.
 */
export function moorPlants(palette: Palette): string {
  return plantSheet(palette, 'plant_moor', MOOR_PLANT_KINDS);
}

function plantSheet(palette: Palette, name: string, kinds: readonly string[]): string {
  const lines = [
    '# Generated by src/tools/art/strandArt.ts. Do not edit by hand: change the generator and run',
    '# npm run art:sheets.',
    '# Each state is one plant variant; its seven frames lean it from -3 to +3 pixels (frame 3 is',
    '# upright), so the renderer can bend it in the wind and part it round walkers.',
    `sheet: ${name}`,
    'kind: plant',
    'palette: book07',
    'size: 16x16',
    'pivot: 8,15',
    'footprint: 4x2',
    'facings: -',
    'placeholder: false',
  ];
  const out: string[] = [];
  for (const kind of kinds) {
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

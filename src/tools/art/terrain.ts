/**
 * The terrain generator (Book 7 section 11 allows deterministic generator scripts for tiles and
 * variations, committed with their output). A recipe in assets/art/terrain/<sheet>.json describes
 * each terrain in palette codes; this script draws every variant and writes the palette-coded
 * sheet the art compiler reads:
 *
 * - base tiles: a ground colour with specks, pebbles lit from the upper left, sand ripples,
 *   grass tufts, rounded boulders, and water dashes that sway over a looping animation;
 * - edge tiles: where a higher terrain meets a lower one (in the recipe's order), a ragged band of
 *   the higher terrain laps over the lower tile, with a rim: foam where it meets water, the weed
 *   and wrack of the high-tide line where dry shingle meets the wet foreshore.
 *
 * Terrain carries no ink outline (Book 7 section 11). Bands use a smooth function that repeats
 * every 24 pixels, so a band running along a row of tiles joins up without seams.
 */
import { cyrb53 } from '../../core/hash.ts';

const SIZE = 24;
export const EDGE_VARIANTS = 3;
export const EDGE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
export type EdgeDirection = (typeof EDGE_DIRECTIONS)[number];

interface Speck {
  readonly code: string;
  readonly density: number;
}

interface TerrainRecipe {
  readonly base: string;
  readonly water?: boolean;
  readonly specks?: readonly Speck[];
  /** Specks drawn over the stones (lichen on rock). */
  readonly overSpecks?: readonly Speck[];
  readonly dashes?: {
    readonly codes: readonly string[];
    readonly count: number;
    readonly length: readonly [number, number];
  };
  readonly flow?: {
    readonly codes: readonly string[];
    readonly count: number;
    readonly length: readonly [number, number];
  };
  readonly ripples?: { readonly code: string; readonly shadow: string; readonly spacing: number };
  /** Rounded stones lit from the upper left: [highlight, base, shadow] per kind. */
  readonly pebbles?: {
    readonly count: number;
    readonly size: readonly [number, number];
    readonly kinds: readonly (readonly string[])[];
    readonly drop?: string;
  };
  readonly tufts?: { readonly codes: readonly string[]; readonly count: number };
  /** Large rounded boulders packed over the base colour, which shows as the crevices. */
  readonly boulders?: {
    readonly count: number;
    readonly radius: readonly [number, number];
    readonly kinds: readonly (readonly string[])[];
  };
}

export interface TerrainSheetRecipe {
  readonly about: string;
  readonly sheet: string;
  readonly seed: string;
  readonly variants: number;
  readonly waterFrames: number;
  readonly waterTicks: number;
  readonly terrains: Readonly<Record<string, TerrainRecipe>>;
  readonly edges: {
    readonly order: readonly string[];
    readonly depth: readonly [number, number];
    readonly rims: Readonly<
      Record<
        string,
        {
          readonly water?: readonly string[];
          readonly land?: readonly string[];
          /** Rim width in pixels where it meets land (the wrack of the tide line is wider). */
          readonly landWidth?: number;
        }
      >
    >;
  };
}

type Grid = string[][];

function rand(...parts: (string | number)[]): number {
  return (cyrb53(parts.join('|')) % 1_000_003) / 1_000_003;
}

function pick<T>(list: readonly T[], r: number): T {
  const item = list[Math.min(list.length - 1, Math.floor(r * list.length))];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
}

function blank(code: string): Grid {
  return Array.from({ length: SIZE }, () => new Array<string>(SIZE).fill(code));
}

function put(grid: Grid, x: number, y: number, code: string): void {
  const row = grid[((y % SIZE) + SIZE) % SIZE];
  if (row !== undefined) row[((x % SIZE) + SIZE) % SIZE] = code;
}

/** A smooth value from 0 to 1 that repeats every 24 pixels along t. */
function periodic(seed: string, t: number): number {
  const a = rand(seed, 'a') * Math.PI * 2;
  const b = rand(seed, 'b') * Math.PI * 2;
  const c = rand(seed, 'c') * Math.PI * 2;
  const w = (Math.PI * 2 * t) / SIZE;
  const v = 0.5 + 0.28 * Math.sin(w + a) + 0.14 * Math.sin(3 * w + b) + 0.08 * Math.sin(5 * w + c);
  return Math.min(1, Math.max(0, v));
}

/** A filled ellipse lit from the upper left: highlight on its upper-left rim, shadow lower-right. */
function blob(
  grid: Grid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  [hi = 'w', base = 's', sh = 'n']: readonly string[],
): void {
  const inside = (x: number, y: number): boolean =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!inside(x, y)) continue;
      const dark = !inside(x + 1, y + 1) || !inside(x, y + 1);
      const lit = !inside(x - 1, y - 1) || !inside(x, y - 1);
      put(grid, x, y, dark ? sh : lit ? hi : base);
    }
  }
}

/** Draws one terrain tile: `variant` picks the layout, `frame` the step of the water's sway. */
export function drawTerrain(
  recipe: TerrainRecipe,
  seed: string,
  variant: number,
  frame: number,
  frames: number,
): Grid {
  const grid = blank(recipe.base);
  const key = (...p: (string | number)[]): number => rand(seed, variant, ...p);
  if (recipe.ripples !== undefined) {
    const { code, shadow, spacing } = recipe.ripples;
    const offset = Math.floor(key('ripple') * spacing);
    for (let y0 = offset; y0 < SIZE; y0 += spacing) {
      for (let x = 0; x < SIZE; x++) {
        const y = y0 + Math.round(Math.sin(((x + y0 * 3) / SIZE) * Math.PI * 4) * 0.8);
        if (key('gap', x, y0) < 0.18) continue;
        put(grid, x, y, code);
        put(grid, x, y + 1, shadow);
      }
    }
  }
  for (const speck of recipe.specks ?? []) {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (key('speck', speck.code, x, y) < speck.density) put(grid, x, y, speck.code);
  }
  if (recipe.tufts !== undefined) {
    const [light = 'G', dark = 'h'] = recipe.tufts.codes;
    for (let i = 0; i < recipe.tufts.count; i++) {
      const x = 1 + Math.floor(key('tuft x', i) * (SIZE - 2));
      const y = 2 + Math.floor(key('tuft y', i) * (SIZE - 3));
      put(grid, x, y, dark);
      put(grid, x - 1, y - 1, light);
      put(grid, x + 1, y - 1, light);
      put(grid, x, y - 2, light);
    }
  }
  if (recipe.boulders !== undefined) {
    const { count, radius, kinds } = recipe.boulders;
    for (let i = 0; i < count; i++) {
      const rx = radius[0] + key('boulder rx', i) * (radius[1] - radius[0]);
      const ry = rx * (0.7 + key('boulder ry', i) * 0.25);
      // Positions wrap round the tile, so stones cross its edges and no gutter shows.
      const cx = key('boulder x', i) * SIZE;
      const cy = key('boulder y', i) * SIZE;
      blob(grid, cx, cy, rx, ry, pick(kinds, key('boulder kind', i)));
    }
  }
  if (recipe.pebbles !== undefined) {
    const { count, size, kinds, drop } = recipe.pebbles;
    for (let i = 0; i < count; i++) {
      const rx = size[0] + key('pebble rx', i) * (size[1] - size[0]);
      const ry = Math.max(1, rx * 0.7);
      const cx = key('pebble x', i) * SIZE;
      const cy = key('pebble y', i) * SIZE;
      if (drop !== undefined) blob(grid, cx + 0.6, cy + 1, rx, ry, [drop, drop, drop]);
      blob(grid, cx, cy, rx, ry, pick(kinds, key('pebble kind', i)));
    }
  }
  for (const speck of recipe.overSpecks ?? []) {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (key('over', speck.code, x, y) < speck.density && grid[y]?.[x] !== recipe.base)
          put(grid, x, y, speck.code);
  }
  const sway = (i: number): number =>
    Math.round(1.4 * Math.sin(Math.PI * 2 * (frame / frames + key('phase', i))));
  if (recipe.dashes !== undefined) {
    const { codes, count, length } = recipe.dashes;
    for (let i = 0; i < count; i++) {
      const len = length[0] + Math.floor(key('dash len', i) * (length[1] - length[0] + 1));
      const x = Math.floor(key('dash x', i) * SIZE) + sway(i);
      const y = Math.floor(key('dash y', i) * SIZE);
      const code = pick(codes, key('dash code', i));
      for (let d = 0; d < len; d++) put(grid, x + d, y, code);
    }
  }
  if (recipe.flow !== undefined) {
    const { codes, count, length } = recipe.flow;
    for (let i = 0; i < count; i++) {
      const len = length[0] + Math.floor(key('flow len', i) * (length[1] - length[0] + 1));
      const x = Math.floor(key('flow x', i) * SIZE);
      const y = Math.floor(key('flow y', i) * SIZE) + sway(i);
      const code = pick(codes, key('flow code', i));
      for (let d = 0; d < len; d++) put(grid, x, y + d, code);
    }
  }
  return grid;
}

/** The band of an edge tile: which pixels the higher terrain covers. */
function bandMask(
  seed: string,
  dir: EdgeDirection,
  depth: readonly [number, number],
  variant: number,
): boolean[][] {
  const [lo, hi] = depth;
  // Every variant is at mid-depth at both tile corners, so any variant joins any other; between
  // them a few sine waves (zero at the corners) wander, so a long edge never repeats.
  const mid = (lo + hi) / 2;
  const amp = [(hi - lo) / 2, (hi - lo) / 4, (hi - lo) / 6];
  const coef = amp.map((a, k) => (rand(seed, variant, 'wave', k) - 0.5) * 2 * a);
  const d = (t: number): number => {
    let v = mid;
    coef.forEach((c, k) => {
      v += c * Math.sin(((k + 1) * Math.PI * (t + 0.5)) / SIZE);
    });
    return Math.round(Math.min(hi, Math.max(lo - 2, v)));
  };
  const mask: boolean[][] = [];
  for (let y = 0; y < SIZE; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < SIZE; x++) {
      let inside: boolean;
      switch (dir) {
        case 'n':
          inside = y < d(x);
          break;
        case 's':
          inside = y >= SIZE - d(x);
          break;
        case 'w':
          inside = x < d(y);
          break;
        case 'e':
          inside = x >= SIZE - d(y);
          break;
        default: {
          const cx = dir.includes('e') ? SIZE : 0;
          const cy = dir.includes('s') ? SIZE : 0;
          const angle = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
          const r =
            lo + 1 + (hi - lo) * periodic(`${seed}|${variant}`, ((angle + Math.PI) / Math.PI) * 12);
          inside = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r;
        }
      }
      row.push(inside);
    }
    mask.push(row);
  }
  return mask;
}

/** An edge tile: the higher terrain's band, its rim, and transparency elsewhere. */
export function drawEdge(
  sheet: TerrainSheetRecipe,
  upper: string,
  lowerIsWater: boolean,
  dir: EdgeDirection,
  variant: number,
): Grid {
  const recipe = sheet.terrains[upper];
  if (recipe === undefined) throw new Error(`no terrain "${upper}"`);
  const texture = drawTerrain(recipe, sheet.seed, 0, 0, 1);
  const mask = bandMask(`${sheet.seed}|${upper}`, dir, sheet.edges.depth, variant);
  const rims = sheet.edges.rims[upper];
  const rim = lowerIsWater ? rims?.water : rims?.land;
  const inside = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= SIZE || y >= SIZE ? true : (mask[y]?.[x] ?? false);
  // How far a pixel lies from the band's open edge (1 = on it), up to 3.
  const fromEdge = (x: number, y: number): number => {
    for (let r = 1; r <= 3; r++) {
      for (const [dx, dy] of [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ] as const) {
        if (!inside(x + dx, y + dy)) return r;
      }
    }
    return 4;
  };
  const grid = blank('.');
  const rimWidth = lowerIsWater ? 1 : (rims?.landWidth ?? 1);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!(mask[y]?.[x] ?? false)) continue;
      const e = fromEdge(x, y);
      let code = texture[y]?.[x] ?? recipe.base;
      if (rim !== undefined && e <= rimWidth) {
        code = pick(rim, rand(sheet.seed, upper, dir, 'rim', x, y));
      }
      put(grid, x, y, code);
    }
  }
  return grid;
}

export function edgeState(upper: string, lowerIsWater: boolean, dir: EdgeDirection): string {
  return `edge_${upper}_${lowerIsWater ? 'wet' : 'dry'}_${dir}`;
}

/** Generates the palette-coded sheet text from a terrain recipe. */
export function generateTerrainSheet(recipeJson: string, file: string): string {
  const sheet = JSON.parse(recipeJson) as TerrainSheetRecipe;
  const lines = [
    `# Generated by src/tools/art/terrain.ts from ${file}. Do not edit by hand:`,
    '# change the recipe and run npm run art:sheets.',
    `sheet: ${sheet.sheet}`,
    'kind: tile',
    'palette: book07',
    `size: ${SIZE}x${SIZE}`,
    'pivot: 0,0',
    `footprint: ${SIZE}x${SIZE}`,
    'facings: -',
    'placeholder: false',
  ];
  const blocks: string[] = [];
  const emit = (state: string, index: number, grid: Grid): void => {
    blocks.push('', `frame ${state} - ${index}`, ...grid.map((r) => r.join('')), 'end');
  };
  for (const [name, recipe] of Object.entries(sheet.terrains)) {
    const frames = recipe.water === true ? sheet.waterFrames : 1;
    for (let v = 0; v < sheet.variants; v++) {
      const state = `${name}${v}`;
      lines.push(
        `anim.${state}: frames ${frames}, ticks ${frames > 1 ? sheet.waterTicks : 1}${frames > 1 ? ', loop' : ''}`,
      );
      for (let f = 0; f < frames; f++)
        emit(state, f, drawTerrain(recipe, `${sheet.seed}|${name}`, v, f, frames));
    }
  }
  for (const upper of sheet.edges.order) {
    if (upper === sheet.edges.order[0]) continue;
    for (const wet of [false, true]) {
      for (const dir of EDGE_DIRECTIONS) {
        // An edge's frames are its variants, not an animation.
        const state = edgeState(upper, wet, dir);
        lines.push(`anim.${state}: frames ${EDGE_VARIANTS}, ticks 1`);
        for (let v = 0; v < EDGE_VARIANTS; v++) emit(state, v, drawEdge(sheet, upper, wet, dir, v));
      }
    }
  }
  return `${[...lines, ...blocks].join('\n')}\n`;
}

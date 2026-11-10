/**
 * The Book 7 terrain art standard (section 14), as checks a machine can run. Art lint runs them
 * on every zone and sheet (npm run lint, so on every build), and tests/unit/standard.test.ts
 * runs them again with their numbers reported.
 *
 * - Shadows: every actor and prop sheet declares its ground shadow (`shadow: WxH`).
 * - Transitions: no terrain boundary runs straight for more than two thirds of a tile; every boundary is
 *   an organic transition (the dual-grid tiles with noise), never a tile edge.
 * - Variants: every terrain that covers ground has at least MIN_VARIANTS distinct plain tiles.
 * - Decoration: grass carries at least MIN_GRASS_PLANTS plants a tile on average, and no patch of
 *   two by two grass tiles is bare.
 */
import {
  LAYERS,
  LETTER,
  pixelInfo,
  PERIOD,
  phaseOf,
  TILE,
  visualCorners,
} from '../../render/autotile.ts';
import type { Layer } from '../../render/autotile.ts';
import type { Sheet } from '../../render/sheet.ts';
import type { ZoneMap } from '../../content/zoneMap.ts';

/**
 * Longest straight run a terrain boundary may have, in pixels: two thirds of a tile, so no
 * boundary ever follows a tile edge (a short straight is natural; a tile-long one is a seam).
 */
export const MAX_STRAIGHT_RUN = (TILE * 2) / 3;
/** Fewest distinct plain tiles a terrain may have. */
export const MIN_VARIANTS = 8;
/** A terrain needs MIN_VARIANTS once it has at least this many plain tiles in a zone. */
export const VARIANTS_FROM_TILES = 30;
/** Fewest plants a grass tile carries, on average over the zone's grass. */
export const MIN_GRASS_PLANTS = 6;
/** Fewest plants and decals in any two by two block of grass tiles. */
export const MIN_GRASS_BLOCK = 3;

export interface StandardProblem {
  readonly where: string;
  readonly problem: string;
}

/** Sheets that stand on the ground and so need a contact shadow. */
export function needsShadow(sheet: Sheet): boolean {
  return /^(actor|prop)_/.test(sheet.name);
}

export function shadowProblems(sheets: readonly Sheet[]): StandardProblem[] {
  return sheets
    .filter((s) => needsShadow(s) && s.shadow === null)
    .map((s) => ({
      where: s.name,
      problem: 'declares no ground shadow (`shadow: WxH`, Book 7 section 14)',
    }));
}

/** The longest straight boundary run inside one visual tile, in pixels. */
export function longestStraightRun(corners: readonly Layer[], phase: number): number {
  const P = PERIOD * TILE;
  const pi = phase % PERIOD;
  const pj = Math.floor(phase / PERIOD);
  const layer: number[] = [];
  for (let ly = 0; ly < TILE; ly++) {
    for (let lx = 0; lx < TILE; lx++) {
      const wx = (((pi * TILE - TILE / 2 + lx) % P) + P) % P;
      const wy = (((pj * TILE - TILE / 2 + ly) % P) + P) % P;
      layer.push(pixelInfo(corners, lx, ly, wx, wy).layer);
    }
  }
  const at = (x: number, y: number): number => layer[y * TILE + x] ?? -1;
  let longest = 0;
  // Boundaries between rows (horizontal runs) and between columns (vertical runs).
  for (let y = 0; y < TILE - 1; y++) {
    let run = 0;
    for (let x = 0; x < TILE; x++) {
      run = at(x, y) !== at(x, y + 1) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  for (let x = 0; x < TILE - 1; x++) {
    let run = 0;
    for (let y = 0; y < TILE; y++) {
      run = at(x, y) !== at(x + 1, y) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  return longest;
}

/** The visual tiles a zone uses: corners and place in the pattern, by frame state. */
export function zoneTiles(
  rows: readonly string[],
): Map<string, { corners: Layer[]; phase: number }> {
  const out = new Map<string, { corners: Layer[]; phase: number }>();
  const width = rows[0]?.length ?? 0;
  for (let j = 0; j <= rows.length; j++) {
    for (let i = 0; i <= width; i++) {
      const corners = visualCorners(rows, i, j);
      const phase = phaseOf(i, j);
      out.set(`g_${corners.map((c) => LETTER[c]).join('')}_${phase}`, { corners, phase });
    }
  }
  return out;
}

export function transitionProblems(map: ZoneMap): StandardProblem[] {
  const problems: StandardProblem[] = [];
  for (const [state, { corners, phase }] of zoneTiles(map.rows)) {
    if (corners.every((c) => c === corners[0])) continue;
    const run = longestStraightRun(corners, phase);
    if (run > MAX_STRAIGHT_RUN)
      problems.push({
        where: `${map.zone} ${state}`,
        problem: `a terrain boundary runs straight for ${run} px (at most ${MAX_STRAIGHT_RUN})`,
      });
  }
  return problems;
}

/** Distinct plain tiles per terrain in a tile sheet, and how many plain tiles the zone has. */
export function variantCounts(
  map: ZoneMap,
  tiles: Sheet,
): Map<Layer, { variants: number; tiles: number }> {
  const out = new Map<Layer, { variants: number; tiles: number }>();
  const width = map.rows[0]?.length ?? 0;
  for (const layer of LAYERS) {
    const letter = LETTER[layer];
    const plain = `g_${letter.repeat(4)}_`;
    const seen = new Set<string>();
    for (const [key, image] of tiles.frames) {
      if (key.startsWith(plain)) seen.add(Array.from(image.pixels).join(','));
    }
    let count = 0;
    for (let j = 0; j <= map.rows.length; j++)
      for (let i = 0; i <= width; i++)
        if (visualCorners(map.rows, i, j).every((c) => c === layer)) count++;
    out.set(layer, { variants: seen.size, tiles: count });
  }
  return out;
}

export function variantProblems(map: ZoneMap, tiles: Sheet): StandardProblem[] {
  const problems: StandardProblem[] = [];
  for (const [layer, { variants, tiles: n }] of variantCounts(map, tiles)) {
    if (n >= VARIANTS_FROM_TILES && variants < MIN_VARIANTS)
      problems.push({
        where: `${tiles.name} ${layer}`,
        problem: `has ${variants} distinct plain tiles over ${n} tiles (at least ${MIN_VARIANTS})`,
      });
  }
  return problems;
}

/** Plants per grass tile on average, and the barest two by two block of grass. */
export function grassDensity(map: ZoneMap): { perTile: number; barestBlock: number } {
  const T = map.tile;
  const count = new Map<string, number>();
  const add = (x: number, y: number): void => {
    const k = `${Math.floor(x / T)},${Math.floor(y / T)}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  };
  for (const [, x, y] of map.plants) add(x, y);
  for (const [, x, y] of map.decals) add(x, y);
  let grass = 0;
  let plantsOnGrass = 0;
  const isGrass = (tx: number, ty: number): boolean => map.rows[ty]?.[tx] === ',';
  for (const [, x, y] of map.plants)
    if (isGrass(Math.floor(x / T), Math.floor(y / T))) plantsOnGrass++;
  for (let ty = 0; ty < map.height; ty++)
    for (let tx = 0; tx < map.width; tx++) if (isGrass(tx, ty)) grass++;
  let barest = Number.POSITIVE_INFINITY;
  for (let ty = 0; ty + 1 < map.height; ty++) {
    for (let tx = 0; tx + 1 < map.width; tx++) {
      if (!(
        isGrass(tx, ty) &&
        isGrass(tx + 1, ty) &&
        isGrass(tx, ty + 1) &&
        isGrass(tx + 1, ty + 1)
      ))
        continue;
      let n = 0;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const)
        n += count.get(`${tx + dx},${ty + dy}`) ?? 0;
      barest = Math.min(barest, n);
    }
  }
  return { perTile: grass === 0 ? 0 : plantsOnGrass / grass, barestBlock: barest };
}

export function densityProblems(map: ZoneMap): StandardProblem[] {
  const { perTile, barestBlock } = grassDensity(map);
  const problems: StandardProblem[] = [];
  if (perTile < MIN_GRASS_PLANTS)
    problems.push({
      where: map.zone,
      problem: `grass carries ${perTile.toFixed(1)} plants a tile (at least ${MIN_GRASS_PLANTS})`,
    });
  if (barestBlock < MIN_GRASS_BLOCK)
    problems.push({
      where: map.zone,
      problem: `a two by two block of grass has only ${barestBlock} plants and decals (at least ${MIN_GRASS_BLOCK})`,
    });
  return problems;
}

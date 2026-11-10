/**
 * The zone expander (Book 9 section 03: each zone is a streamed scene of about 96 x 64 tiles).
 * Book 9 draws Skarvholm only at block scale (one character per 8 x 8 tiles). This deterministic
 * generator, committed with its output like the art generators (Book 7 section 11), turns a window
 * of the block grid into a tile plan:
 *
 * - each tile reads the block under it through a smooth warp of a few tiles, so coasts and field
 *   edges wander instead of following the block lines;
 * - rock blocks become irregular skerries in the sea;
 * - a stream block becomes a two-tile channel that runs on south over the shore to the water;
 * - shingle within a few tiles of the tidal flats or the sea lies below the high-tide line;
 * - the plan file adds authored features (rock outcrops) and the spawns.
 *
 * Tile codes in the output: ~ sea, - tidal flats, _ shingle below the tide line, . shingle above
 * it, , machair, w stream, r rock.
 */
import { cyrb53 } from '../../core/hash.ts';

export const TILE_CODES = ['~', '-', '_', '.', ',', 'w', 'r'] as const;
export type TileCode = (typeof TILE_CODES)[number];

export interface ZonePlan {
  readonly zone: string;
  readonly about: string;
  readonly seed: string;
  /** The window of the block grid, in blocks. */
  readonly blocks: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  readonly warpTiles: number;
  readonly tideLineTiles: number;
  readonly outcrops: readonly {
    readonly x: number;
    readonly y: number;
    readonly rx: number;
    readonly ry: number;
  }[];
  readonly spawns: Readonly<
    Record<string, { readonly x: number; readonly y: number; readonly facing: string }>
  >;
  /** Scenery sprites, in tiles at their foot anchor. */
  readonly props: readonly ZoneProp[];
}

export interface ZoneProp {
  readonly sheet: string;
  readonly frame: string;
  readonly x: number;
  readonly y: number;
}

export interface ZoneMap {
  readonly zone: string;
  readonly about: string;
  readonly tile: number;
  readonly width: number;
  readonly height: number;
  /** The zone's north-west corner on the island, in tiles. */
  readonly origin: { readonly x: number; readonly y: number };
  readonly rows: readonly string[];
  /** Spawns in tiles (fractions allowed): where people start, and the facing they start in. */
  readonly spawns: ZonePlan['spawns'];
  readonly props: readonly ZoneProp[];
}

const BLOCK = 8;

/** Value noise in [0, 1) on a grid of `cell` tiles, smoothly interpolated. */
function noise(seed: number, x: number, y: number, cell: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const at = (i: number, j: number): number => (cyrb53(`${i},${j}`, seed) % 10007) / 10007;
  const s = (t: number): number => t * t * (3 - 2 * t);
  const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * s(fx);
  const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * s(fx);
  return top + (bottom - top) * s(fy);
}

export function parseBlockGrid(text: string): string[] {
  // Rows look like "  7 ~~~##..."; the two header lines carry column numbers only.
  return text
    .split('\n')
    .filter((line) => /^\s*\d+ \S/.test(line))
    .map((line) => line.replace(/^\s*\d+ /, ''));
}

function blockToTile(ch: string): TileCode {
  switch (ch) {
    case '~':
      return '~';
    case '-':
    case '=':
      return '-';
    case '.':
    case 'N':
      return '.';
    case 'r':
    case 'W':
      return 'r';
    case 'w':
      return 'w';
    default:
      return ',';
  }
}

export function expandZone(plan: ZonePlan, grid: readonly string[]): ZoneMap {
  const seed = cyrb53(plan.seed);
  const width = plan.blocks.w * BLOCK;
  const height = plan.blocks.h * BLOCK;
  const ox = plan.blocks.x * BLOCK;
  const oy = plan.blocks.y * BLOCK;
  const block = (bx: number, by: number): string => grid[by]?.[bx] ?? '~';
  const tiles: TileCode[][] = [];
  for (let ty = 0; ty < height; ty++) {
    const row: TileCode[] = [];
    for (let tx = 0; tx < width; tx++) {
      const x = ox + tx;
      const y = oy + ty;
      const wx = (noise(seed, x, y, 7) - 0.5) * 2 * plan.warpTiles;
      const wy = (noise(seed + 1, x, y, 7) - 0.5) * 2 * plan.warpTiles;
      const ch = block(Math.floor((x + 0.5 + wx) / BLOCK), Math.floor((y + 0.5 + wy) / BLOCK));
      let code = blockToTile(ch);
      // Skerries: rock only where a second noise rises, so they break up into stacks.
      if (code === 'r' && noise(seed + 2, x, y, 3) < 0.42) code = '~';
      // A stream block is grass with a channel through it.
      if (code === 'w') code = ',';
      row.push(code);
    }
    tiles.push(row);
  }
  const at = (tx: number, ty: number): TileCode | undefined => tiles[ty]?.[tx];
  const set = (tx: number, ty: number, code: TileCode): void => {
    const row = tiles[ty];
    if (row !== undefined && tx >= 0 && tx < width) row[tx] = code;
  };

  // Streams: a two-tile channel down each stream column of blocks, then on to the water.
  for (let bx = plan.blocks.x; bx < plan.blocks.x + plan.blocks.w; bx++) {
    let flowing = false;
    for (let ty = 0; ty < height; ty++) {
      const by = Math.floor((oy + ty) / BLOCK);
      if (block(bx, by) === 'w') flowing = true;
      if (!flowing) continue;
      const centre =
        (bx - plan.blocks.x) * BLOCK + 3.5 + (noise(seed + 3, bx * 100, oy + ty, 6) - 0.5) * 4;
      const left = Math.floor(centre);
      const under = at(left, ty);
      if (under === '~' || under === '-') break;
      set(left, ty, 'w');
      set(left + 1, ty, 'w');
    }
  }

  // Authored rock outcrops (the rocks Hild calls from beyond, Book 4 section 08).
  for (const o of plan.outcrops) {
    for (let ty = Math.floor(o.y - o.ry - 2); ty <= o.y + o.ry + 2; ty++) {
      for (let tx = Math.floor(o.x - o.rx - 2); tx <= o.x + o.rx + 2; tx++) {
        const d = Math.hypot((tx + 0.5 - o.x) / o.rx, (ty + 0.5 - o.y) / o.ry);
        if (d + (noise(seed + 4, tx, ty, 2) - 0.5) * 0.5 < 1) set(tx, ty, 'r');
      }
    }
  }

  // The high-tide line: shingle near the flats or the sea is foreshore, under water at high tide.
  const reach = plan.tideLineTiles;
  const wet: [number, number][] = [];
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (at(tx, ty) !== '.') continue;
      const limit = reach + noise(seed + 5, tx, ty, 4) * 1.5;
      let near = false;
      for (let dy = -4; dy <= 4 && !near; dy++) {
        for (let dx = -4; dx <= 4 && !near; dx++) {
          const c = at(tx + dx, ty + dy);
          if ((c === '-' || c === '~') && Math.hypot(dx, dy) <= limit) near = true;
        }
      }
      if (near) wet.push([tx, ty]);
    }
  }
  for (const [tx, ty] of wet) set(tx, ty, '_');

  return {
    zone: plan.zone,
    about: plan.about,
    tile: 24,
    width,
    height,
    origin: { x: ox, y: oy },
    rows: tiles.map((r) => r.join('')),
    spawns: plan.spawns,
    props: plan.props,
  };
}

/** The generated map as committed: stable key order, one row per line. */
export function zoneMapText(map: ZoneMap): string {
  const { rows, ...rest } = map;
  const head = JSON.stringify(rest, null, 2).replace(/\n}$/, '');
  return `${head},\n  "rows": [\n${rows.map((r) => `    "${r}"`).join(',\n')}\n  ]\n}\n`;
}

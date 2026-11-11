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
 * - where the machair meets the beach it ends in a low bank (b: a cliff face a tile high, which
 *   blocks movement), broken by the plan's cuts where a path climbs it (Book 7 section 14);
 * - then the zone is furnished (Book 7 section 14): pebble clusters with calm sand between them,
 *   shells, the wrack line along the tide line, grass in tussocks and as a sward everywhere, flower
 *   drifts, marram on the dunes under the bank, and the plan's props and wildlife.
 *
 * - a broch (Stage 7, the machair round the steading): its wall a ring of rock tiles (blocking),
 *   its court trodden earth (`:`), with the door and the breach left open; footpaths from the plan.
 *
 * Tile codes in the output: ~ sea, - tidal flats, _ shingle below the tide line, . shingle above
 * it, , machair, b the bank, w stream, r rock, : the broch's court.
 *
 * Neighbouring zones share one terrain: a plan's `terrainSeed` (the strand's for the machair) seeds
 * the warp and the stream, which read island coordinates, so the ground runs on across the edge
 * where the zones meet (their `links`).
 */
import { cyrb53 } from '../../core/hash.ts';

export const TILE_CODES = ['~', '-', '_', '.', ',', 'b', 'w', 'r', ':'] as const;
export type TileCode = (typeof TILE_CODES)[number];

export interface ZonePlan {
  readonly zone: string;
  readonly about: string;
  readonly seed: string;
  /** The seed of the island's terrain (warp, stream, skerries), if not `seed`. */
  readonly terrainSeed?: string;
  /**
   * The share of the sward's places that grow a grass tuft (0.42 by default, the strand's): the
   * steading's grazed turf is thicker (Stage 7 mockup; decision S7-23).
   */
  readonly sward?: number;
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
  /** Columns (in tiles, inclusive) where a path cuts through the bank. */
  readonly cuts: readonly (readonly [number, number])[];
  /** Wildlife, drawn by the renderer only (never simulated). */
  readonly life: readonly ZoneLife[];
  /** A broch: centre (tiles), the wall's inner and outer radius (tiles), and openings. */
  readonly broch?: {
    readonly x: number;
    readonly y: number;
    readonly inner: number;
    readonly outer: number;
    /** Tiles of the wall left open (offsets from the centre tile): the door and the breach. */
    readonly openings: readonly (readonly [number, number])[];
    /**
     * The trodden earth in the court round the fire (centre and radius, tiles), and a trodden way
     * from it to the door; the rest of the court is turf (the Stage 7 mockup). Without it, the
     * whole court is trodden earth.
     */
    readonly trodden?: { readonly x: number; readonly y: number; readonly r: number };
  };
  /** Worn footpaths, as polylines in tiles. */
  readonly paths?: readonly (readonly (readonly [number, number])[])[];
  /** Edges where the steerer walks on into a neighbouring zone (Book 2 section 10, FootLink). */
  readonly links?: readonly ZoneLink[];
}

/** A zone edge that leads on to the zone beyond it (the whole edge; positions by island tiles). */
export interface ZoneLink {
  readonly edge: 'n' | 's' | 'e' | 'w';
  readonly to: string;
}

export interface ZoneLife {
  readonly kind: 'gull' | 'gull_standing' | 'cormorant' | 'seal' | 'crab' | 'sheep';
  /** In tiles. */
  readonly x: number;
  readonly y: number;
  /** For circling gulls: the radius of the circle, in tiles. */
  readonly r?: number;
}

/** Decoration placements: [frame index into `decalFrames`, x, y] in pixels. */
export type DecalPlacement = readonly [number, number, number];
/** Plant placements: [kind index into PLANT_KINDS, x, y, variant] in pixels. */
export type PlantPlacement = readonly [number, number, number, number];
export const PLANT_KINDS = ['grass', 'tussock', 'marram', 'thrift', 'clover', 'trefoil'] as const;

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
  readonly life: readonly ZoneLife[];
  readonly links?: readonly ZoneLink[];
  readonly broch?: ZonePlan['broch'];
  /** Sheet and frame of each decoration index ("decal_strand pebbles/-/3"). */
  readonly decalFrames: readonly string[];
  readonly decals: readonly DecalPlacement[];
  readonly plants: readonly PlantPlacement[];
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
  const seed = cyrb53(plan.terrainSeed ?? plan.seed);
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

  // A broch: the wall's ring blocks, the court is trodden earth, the door and breach are open.
  const broch = plan.broch;
  if (broch !== undefined) {
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const r = Math.hypot(tx + 0.5 - broch.x, ty + 0.5 - broch.y);
        if (r > broch.outer) continue;
        if (r >= broch.inner) {
          set(tx, ty, 'r');
          continue;
        }
        const t = broch.trodden;
        if (t === undefined) {
          set(tx, ty, ':');
          continue;
        }
        // Trodden round the fire, ragged at the edge, and along the way to the door (south).
        const near =
          Math.hypot(tx + 0.5 - t.x, ty + 0.5 - t.y) + (noise(seed + 9, tx, ty, 2) - 0.5);
        const door = Math.abs(tx + 0.5 - broch.x) < 0.9 && ty + 0.5 > t.y;
        set(tx, ty, near < t.r || door ? ':' : ',');
      }
    }
    for (const [dx, dy] of broch.openings)
      set(Math.floor(broch.x + dx), Math.floor(broch.y + dy), ':');
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

  // The bank: the last machair tile above the beach becomes a cliff face, except at the cuts and
  // beside the stream.
  const inCut = (tx: number): boolean => plan.cuts.some(([a, b]) => tx >= a && tx <= b);
  for (let tx = 0; tx < width; tx++) {
    if (inCut(tx)) continue;
    for (let ty = 1; ty < height; ty++) {
      if (at(tx, ty - 1) !== ',' || at(tx, ty) !== '.') continue;
      const nearStream = [-2, -1, 0, 1, 2].some(
        (d) => at(tx + d, ty) === 'w' || at(tx + d, ty - 1) === 'w',
      );
      if (!nearStream) set(tx, ty - 1, 'b');
    }
  }

  const rows = tiles.map((r) => r.join(''));
  const furnished = furnish(
    rows,
    width,
    height,
    cyrb53(plan.seed),
    plan.cuts,
    plan.paths ?? [],
    plan.sward ?? 0.42,
  );
  return {
    zone: plan.zone,
    about: plan.about,
    tile: 24,
    width,
    height,
    origin: { x: ox, y: oy },
    rows,
    spawns: plan.spawns,
    props: [...plan.props, ...furnished.props],
    life: plan.life,
    ...(plan.links === undefined ? {} : { links: plan.links }),
    ...(plan.broch === undefined ? {} : { broch: plan.broch }),
    decalFrames: DECAL_FRAMES,
    decals: furnished.decals,
    plants: furnished.plants,
  };
}

/** The decoration frames placed by `furnish` (sheet decal_strand). */
export const DECAL_FRAMES: readonly string[] = [
  ...Array.from({ length: 10 }, (_, k) => `decal_strand pebbles/-/${k}`),
  ...Array.from({ length: 4 }, (_, k) => `decal_strand shells/-/${k}`),
  ...Array.from({ length: 8 }, (_, k) => `decal_strand wrack/-/${k}`),
  ...Array.from({ length: 3 }, (_, k) => `decal_strand twigs/-/${k}`),
  ...Array.from({ length: 4 }, (_, k) => `decal_strand stones/-/${k}`),
  ...Array.from({ length: 4 }, (_, k) => `decal_strand path/-/${k}`),
];
const DECAL_START = { pebbles: 0, shells: 10, wrack: 14, twigs: 22, stones: 25, path: 29 } as const;

/**
 * Furnishing (Book 7 section 14): clusters, never uniform speckle, and calm ground between them
 * so people stay readable; but grass everywhere has at least a sward that moves in the wind.
 */
function furnish(
  rows: readonly string[],
  width: number,
  height: number,
  seed: number,
  cuts: readonly (readonly [number, number])[],
  polylines: readonly (readonly (readonly [number, number])[])[] = [],
  sward = 0.42,
): { decals: DecalPlacement[]; plants: PlantPlacement[]; props: ZoneProp[] } {
  const T = 24;
  const code = (px: number, py: number): string =>
    rows[Math.floor(py / T)]?.[Math.floor(px / T)] ?? '~';
  const r = (k: number, x: number, y: number): number =>
    (cyrb53(`${k}:${x}:${y}`, seed) % 100003) / 100003;
  const decals: DecalPlacement[] = [];
  const plants: PlantPlacement[] = [];
  const props: ZoneProp[] = [];
  const W = width * T;
  const H = height * T;
  // Distance (in tiles) from each tile to the nearest bank or machair, for dunes and the tide line.
  const nearBank = (px: number, py: number, reach: number): boolean => {
    for (let d = 1; d <= reach; d++) {
      const c = code(px, py - d * T);
      if (c === 'b' || c === ',') return true;
    }
    return false;
  };
  const tideLine = (px: number, py: number): boolean =>
    code(px, py) === '.' &&
    (code(px, py + 6) === '_' || code(px + 6, py) === '_' || code(px - 6, py) === '_');
  // Footpaths: from each cut in the bank, a worn path winds north across the machair.
  const paths = cuts.map(
    ([a, b], k) =>
      (py: number): number =>
        ((a + b + 1) / 2) * T + Math.sin(py / 90 + k * 2.1) * 30 + Math.sin(py / 37 + k) * 12,
  );
  // The plan's own footpaths: points every 5 px along each polyline, a little wavy.
  const trail: [number, number][] = [];
  polylines.forEach((line, k) => {
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax = 0, ay = 0] = line[i] ?? [];
      const [bx = 0, by = 0] = line[i + 1] ?? [];
      const n = Math.max(1, Math.round((Math.hypot(bx - ax, by - ay) * T) / 5));
      for (let s = 0; s < n; s++) {
        const t = s / n;
        const x = (ax + (bx - ax) * t) * T;
        const y = (ay + (by - ay) * t) * T;
        trail.push([x + Math.sin(y / 37 + k) * 4, y + Math.sin(x / 41 + k) * 3]);
      }
    }
  });
  const nearTrail = (px: number, py: number, reach: number): boolean =>
    trail.some(([x, y]) => Math.abs(px - x) < reach && Math.abs(py - y) < reach);
  const onPath = (px: number, py: number, reach: number): boolean =>
    paths.some((f) => Math.abs(px - f(py)) < reach) || nearTrail(px, py, reach);
  for (const f of paths) {
    for (let py = 2; py < H; py += 5) {
      const px = Math.round(f(py));
      if (code(px, py) !== ',') continue;
      decals.push([DECAL_START.path + Math.floor(r(13, px, py) * 4), px, py]);
    }
  }
  for (const [x, y] of trail) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (code(px, py) !== ',') continue;
    decals.push([DECAL_START.path + Math.floor(r(14, px, py) * 4), px, py]);
  }
  // Pebble clusters on the beach: one cluster per few tiles where the cluster noise is high.
  for (let y = 4; y < H; y += 7) {
    for (let x = 4; x < W; x += 7) {
      const px = x + Math.floor(r(1, x, y) * 6);
      const py = y + Math.floor(r(2, x, y) * 6);
      const c = code(px, py);
      const cluster = noise(seed + 20, px / T, py / T, 3);
      // Clusters with calm sand between them (Book 7 section 14: no even sprinkle).
      if (c === '.' && cluster > 0.64 && r(3, x, y) < (cluster - 0.64) * 2.2) {
        decals.push([DECAL_START.pebbles + Math.floor(r(4, x, y) * 10), px, py]);
      } else if ((c === '_' || c === '-') && r(5, x, y) < 0.012) {
        decals.push([DECAL_START.shells + Math.floor(r(6, x, y) * 4), px, py]);
      } else if (c === ',' && r(7, x, y) < 0.006) {
        decals.push([DECAL_START.stones + Math.floor(r(8, x, y) * 4), px, py]);
      }
      if (tideLine(px, py) && r(9, x, y) < 0.75) {
        decals.push([DECAL_START.wrack + Math.floor(r(10, x, y) * 8), px, py + 4]);
        if (r(11, x, y) < 0.12)
          decals.push([DECAL_START.twigs + Math.floor(r(12, x, y) * 3), px + 3, py + 5]);
      }
    }
  }
  // Plants: a sward over all the machair, tussocks in clumps, flowers in drifts, thrift on the
  // bank's lip, marram on the dunes below the bank.
  for (let y = 2; y < H; y += 5) {
    for (let x = 2; x < W; x += 5) {
      const px = x + Math.floor(r(20, x, y) * 5);
      const py = y + Math.floor(r(21, x, y) * 5);
      const c = code(px, py);
      const v = Math.floor(r(22, x, y) * 4);
      if (c === ',' && onPath(px, py, 7)) {
        // Trodden: the sward thins to the odd tuft at the path's edge.
        if (!onPath(px, py, 5) && r(29, x, y) < 0.3) plants.push([0, px, py, v]);
      } else if (c === ',') {
        const tussock = noise(seed + 30, px / T, py / T, 2.2);
        const drift = noise(seed + 31, px / T, py / T, 3.5);
        const lip = code(px, py + T) === 'b' || code(px, py + T) === '.';
        if (lip && r(23, x, y) < 0.35) plants.push([3, px, py, v]);
        else if (tussock > 0.55 && r(24, x, y) < (tussock - 0.5) * 2.2) plants.push([1, px, py, v]);
        else if (drift > 0.62 && r(25, x, y) < (drift - 0.6) * 3)
          plants.push([drift > 0.7 ? 4 : 5, px, py, v]);
        else if (r(26, x, y) < sward) plants.push([0, px, py, v]);
      } else if (c === '.' && nearBank(px, py, 4)) {
        // Marram in clumps on the dunes under the bank, sand showing between them.
        const clump = noise(seed + 32, px / T, py / T, 1.6);
        if (clump > 0.5 && r(27, x, y) < (clump - 0.45) * 1.6) plants.push([2, px, py, v]);
      } else if (c === '.' && r(28, x, y) < 0.02) {
        plants.push([2, px, py, v]);
      }
    }
  }
  // Small stones scattered round the rock outcrops and skerries, on the beach side.
  for (let y = 0; y < H; y += 9) {
    for (let x = 0; x < W; x += 9) {
      const px = x + Math.floor(r(40, x, y) * 8);
      const py = y + Math.floor(r(41, x, y) * 8);
      const c = code(px, py);
      if (
        (c === '_' || c === '-') &&
        (code(px + 14, py) === 'r' || code(px - 14, py) === 'r' || code(px, py - 14) === 'r') &&
        r(42, x, y) < 0.5
      ) {
        props.push({
          sheet: 'prop_stones',
          frame: `small/-/${Math.floor(r(43, x, y) * 4)}`,
          x: px / T,
          y: py / T,
        });
      }
    }
  }
  return { decals, plants, props };
}

/** The generated map as committed: stable key order, one row per line, placements packed. */
export function zoneMapText(map: ZoneMap): string {
  const { rows, decals, plants, ...rest } = map;
  const head = JSON.stringify(rest, null, 2).replace(/\n}$/, '');
  const packed = (list: readonly (readonly number[])[]): string => {
    const lines: string[] = [];
    for (let i = 0; i < list.length; i += 24) {
      lines.push(
        `    ${list
          .slice(i, i + 24)
          .map((e) => JSON.stringify(e))
          .join(',')}`,
      );
    }
    return lines.join(',\n');
  };
  return (
    `${head},\n  "decals": [\n${packed(decals)}\n  ],\n  "plants": [\n${packed(plants)}\n  ],\n` +
    `  "rows": [\n${rows.map((r) => `    "${r}"`).join(',\n')}\n  ]\n}\n`
  );
}

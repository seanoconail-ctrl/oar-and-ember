/**
 * The data shape of a zone's tile plan (Book 2 section 10: scenes are tilemaps from Book 9's
 * layouts), validated at load. The plan is generated from Book 9 by src/tools/levels/zones.ts;
 * src/sim/land/zoneMap.ts adds collision and the tide line.
 */
import type { Id } from '../core/ids.ts';

export const TERRAIN = {
  '~': 'sea',
  '-': 'flats',
  _: 'foreshore',
  '.': 'shingle',
  ',': 'machair',
  b: 'bank',
  w: 'stream',
  r: 'rock',
  /** The broch's court: trodden earth inside its wall (Stage 7). */
  ':': 'floor',
} as const;
export type TerrainCode = keyof typeof TERRAIN;
export type Terrain = (typeof TERRAIN)[TerrainCode];

export type Facing = 's' | 'n' | 'e' | 'w';
export const FACINGS: readonly Facing[] = ['s', 'n', 'e', 'w'];

export interface ZoneProp {
  readonly sheet: string;
  readonly frame: string;
  /** Foot anchor, in tiles. */
  readonly x: number;
  readonly y: number;
}

/** Wildlife the renderer draws (never simulated). */
export interface ZoneLife {
  readonly kind: 'gull' | 'gull_standing' | 'cormorant' | 'seal' | 'crab' | 'sheep';
  readonly x: number;
  readonly y: number;
  readonly r?: number;
}

export const PLANT_KINDS = ['grass', 'tussock', 'marram', 'thrift', 'clover', 'trefoil'] as const;
export type PlantKind = (typeof PLANT_KINDS)[number];

export interface ZoneMap {
  readonly zone: Id;
  readonly tile: number;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly string[];
  readonly spawns: Readonly<
    Record<Id, { readonly x: number; readonly y: number; readonly facing: Facing }>
  >;
  readonly props: readonly ZoneProp[];
  readonly life: readonly ZoneLife[];
  /** The zone's north-west corner on the island, in tiles (neighbouring zones line up by it). */
  readonly origin?: { readonly x: number; readonly y: number };
  /** Edges that lead on to a neighbouring zone (Book 2 section 10, FootLink). */
  readonly links?: readonly { readonly edge: 'n' | 's' | 'e' | 'w'; readonly to: Id }[];
  /** The broch, where the zone has one: centre and wall radii in tiles (Stage 7). */
  readonly broch?: {
    readonly x: number;
    readonly y: number;
    readonly inner: number;
    readonly outer: number;
  };
  /** "sheet state/facing/index" for each decoration index. */
  readonly decalFrames: readonly string[];
  /** [frame index, x, y] in pixels: flat decoration on the ground. */
  readonly decals: readonly (readonly [number, number, number])[];
  /**
   * [kind index, x, y, variant] in pixels: plants that move in the wind. A fifth number, where
   * given, is the y the plant is sorted at (Stage 10: grass on the cairn's mound sorts with it).
   */
  readonly plants: readonly (
    | readonly [number, number, number, number]
    | readonly [number, number, number, number, number]
  )[];
  /**
   * Tiles that block movement and sight though their ground is drawn as it is (Stage 10): built
   * things standing on the turf, a drystone wall, the cairn's mound, a standing stone, [x, y].
   */
  readonly solid?: readonly (readonly [number, number])[];
  /** How hard the place's wind blows, against the strand's (Stage 10: the Hag's Seat, the windiest). */
  readonly wind?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates a zone map file; returns the reasons it is unusable (empty when it is fine). */
export function checkZoneMap(json: unknown): { map: ZoneMap | null; problems: string[] } {
  const problems: string[] = [];
  if (!isRecord(json)) return { map: null, problems: ['expected an object'] };
  const { zone, tile, width, height, rows, spawns, props, decals, plants, decalFrames, life } =
    json;
  if (typeof zone !== 'string' || !zone.startsWith('ZONE_'))
    problems.push('zone must be a ZONE_ ID');
  if (tile !== 24) problems.push('tile must be 24 (Book 9 section 01)');
  if (!Number.isInteger(width) || !Number.isInteger(height))
    problems.push('width and height must be whole numbers');
  if (!Array.isArray(rows) || rows.length !== height)
    problems.push(`rows must be ${String(height)} long`);
  else {
    rows.forEach((row: unknown, y) => {
      if (typeof row !== 'string' || row.length !== width) {
        problems.push(`rows[${y}] must be ${String(width)} characters`);
        return;
      }
      const bad = Array.from(row).find((c) => !(c in TERRAIN));
      if (bad !== undefined) problems.push(`rows[${y}] has unknown terrain "${bad}"`);
    });
  }
  if (!isRecord(spawns)) problems.push('spawns must be an object');
  else {
    for (const [id, s] of Object.entries(spawns)) {
      const ok =
        isRecord(s) &&
        typeof s['x'] === 'number' &&
        typeof s['y'] === 'number' &&
        FACINGS.includes(s['facing'] as Facing);
      if (!ok) problems.push(`spawns.${id} needs x, y and a facing`);
    }
  }
  if (!Array.isArray(props)) problems.push('props must be a list');
  else {
    props.forEach((p: unknown, i) => {
      const ok =
        isRecord(p) &&
        typeof p['sheet'] === 'string' &&
        typeof p['frame'] === 'string' &&
        typeof p['x'] === 'number' &&
        typeof p['y'] === 'number';
      if (!ok) problems.push(`props[${i}] needs sheet, frame, x and y`);
    });
  }
  if (!Array.isArray(decalFrames) || !decalFrames.every((f) => typeof f === 'string'))
    problems.push('decalFrames must be a list of frame names');
  const triples = (list: unknown, n: number, m = n): boolean =>
    Array.isArray(list) &&
    list.every(
      (e) => Array.isArray(e) && e.length >= n && e.length <= m && e.every(Number.isInteger),
    );
  if (!triples(decals, 3)) problems.push('decals must be [frame, x, y] triples');
  if (!triples(plants, 4, 5)) problems.push('plants must be [kind, x, y, variant, sort?] entries');
  const solid = (json as Record<string, unknown>)['solid'];
  if (solid !== undefined && !triples(solid, 2)) problems.push('solid must be [x, y] tiles');
  if (!Array.isArray(life)) problems.push('life must be a list');
  return { map: problems.length === 0 ? (json as unknown as ZoneMap) : null, problems };
}

export function parseZoneMap(json: unknown, file: string): ZoneMap {
  const { map, problems } = checkZoneMap(json);
  if (map === null) throw new Error(`${file}: ${problems.join('; ')}`);
  return map;
}

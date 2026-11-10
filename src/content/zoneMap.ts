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
  w: 'stream',
  r: 'rock',
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates a zone map file; returns the reasons it is unusable (empty when it is fine). */
export function checkZoneMap(json: unknown): { map: ZoneMap | null; problems: string[] } {
  const problems: string[] = [];
  if (!isRecord(json)) return { map: null, problems: ['expected an object'] };
  const { zone, tile, width, height, rows, spawns, props } = json;
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
  return { map: problems.length === 0 ? (json as unknown as ZoneMap) : null, problems };
}

export function parseZoneMap(json: unknown, file: string): ZoneMap {
  const { map, problems } = checkZoneMap(json);
  if (map === null) throw new Error(`${file}: ${problems.join('; ')}`);
  return map;
}

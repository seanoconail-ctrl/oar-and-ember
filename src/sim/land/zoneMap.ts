/**
 * A zone's tile plan at runtime. Collision comes from terrain (Book 9 section 01): sea and rock
 * always block; the tidal flats block unless the tidal ground is open (Book 10: low tide only).
 */
import { TERRAIN } from '../../content/zoneMap.ts';
import type { Terrain, TerrainCode, ZoneMap } from '../../content/zoneMap.ts';

export { FACINGS, TERRAIN, checkZoneMap, parseZoneMap } from '../../content/zoneMap.ts';
export type { Facing, Terrain, TerrainCode, ZoneMap, ZoneProp } from '../../content/zoneMap.ts';

/** The terrain of tile (tx, ty); outside the zone is sea. */
export function terrainAt(map: ZoneMap, tx: number, ty: number): Terrain {
  const code = map.rows[ty]?.[tx];
  return code === undefined ? 'sea' : TERRAIN[code as TerrainCode];
}

export function blocksMovement(terrain: Terrain, tidalGroundOpen: boolean): boolean {
  return terrain === 'sea' || terrain === 'rock' || (terrain === 'flats' && !tidalGroundOpen);
}

/**
 * Dry ground the high tide never reaches: the upper shingle and the machair. (The stream is
 * running water, and where it crosses the shore it is below the tide line too.)
 */
export function aboveTideLine(terrain: Terrain): boolean {
  return terrain === 'shingle' || terrain === 'machair';
}

/** The tile under a point given in logical pixels. */
export function tileOf(map: ZoneMap, px: number, py: number): { tx: number; ty: number } {
  return { tx: Math.floor(px / map.tile), ty: Math.floor(py / map.tile) };
}

/**
 * Every tile reachable on foot from (tx, ty) under the given tide (Book 2 section 10's
 * reachability flood fill), as a set of "x,y" keys.
 */
export function reachable(
  map: ZoneMap,
  from: { readonly tx: number; readonly ty: number },
  tidalGroundOpen: boolean,
): Set<string> {
  const seen = new Set<string>();
  const queue: [number, number][] = [[from.tx, from.ty]];
  while (queue.length > 0) {
    const next = queue.pop();
    if (next === undefined) break;
    const [x, y] = next;
    const key = `${x},${y}`;
    if (seen.has(key) || x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (blocksMovement(terrainAt(map, x, y), tidalGroundOpen)) continue;
    seen.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

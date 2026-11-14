/**
 * A zone's tile plan at runtime. Collision comes from terrain (Book 9 section 01): sea and rock
 * always block; the tidal flats block unless the tidal ground is open (Book 10: low tide only).
 * Stage 14 (decision S14-31): cliff faces and drystone always block (a marked climb is the
 * movement verbs' business, read from the zone's `traverse` marks); the Skerry's causeway and the
 * caves' wet rock floor are open only on a spring-tide day inside the tidal ground window
 * (`springOpen`); a bog pool is waded.
 */
import { TERRAIN } from '../../content/zoneMap.ts';
import type { Terrain, TerrainCode, ZoneMap } from '../../content/zoneMap.ts';

export { FACINGS, TERRAIN, checkZoneMap, parseZoneMap } from '../../content/zoneMap.ts';
export type {
  DoorDef,
  Facing,
  Terrain,
  TerrainCode,
  ZoneMap,
  ZoneProp,
} from '../../content/zoneMap.ts';

const solidCache = new WeakMap<ZoneMap, Set<number>>();

/** Whether a built thing on the turf (a wall, the mound, a standing stone) fills tile (tx, ty). */
export function solidAt(map: ZoneMap, tx: number, ty: number): boolean {
  if (map.solid === undefined) return false;
  let set = solidCache.get(map);
  if (set === undefined) {
    set = new Set(map.solid.map(([x, y]) => y * map.width + x));
    solidCache.set(map, set);
  }
  return set.has(ty * map.width + tx);
}

/** Whether tile (tx, ty) blocks movement under the tide: its terrain, or a built thing on it. */
export function tileBlocks(
  map: ZoneMap,
  tx: number,
  ty: number,
  tidalGroundOpen: boolean,
  springOpen = false,
): boolean {
  return (
    blocksMovement(terrainAt(map, tx, ty), tidalGroundOpen, springOpen) || solidAt(map, tx, ty)
  );
}

/** The terrain of tile (tx, ty); outside the zone is sea. */
export function terrainAt(map: ZoneMap, tx: number, ty: number): Terrain {
  const code = map.rows[ty]?.[tx];
  return code === undefined ? 'sea' : TERRAIN[code as TerrainCode];
}

export function blocksMovement(
  terrain: Terrain,
  tidalGroundOpen: boolean,
  springOpen = false,
): boolean {
  return (
    terrain === 'sea' ||
    terrain === 'rock' ||
    terrain === 'bank' ||
    terrain === 'cliff' ||
    terrain === 'drystone' ||
    (terrain === 'flats' && !tidalGroundOpen) ||
    ((terrain === 'causeway' || terrain === 'springfloor') && !(tidalGroundOpen && springOpen))
  );
}

/** Ground that only a spring-tide day's low water opens (Book 10 springLowExtra). */
export function springGround(terrain: Terrain): boolean {
  return terrain === 'causeway' || terrain === 'springfloor';
}

/**
 * Dry ground the high tide never reaches: the upper shingle and the machair. (The stream is
 * running water, and where it crosses the shore it is below the tide line too.)
 */
export function aboveTideLine(terrain: Terrain): boolean {
  return (
    terrain === 'shingle' ||
    terrain === 'machair' ||
    terrain === 'floor' ||
    terrain === 'heather' ||
    terrain === 'peat'
  );
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
  springOpen = false,
): Set<string> {
  const seen = new Set<string>();
  const queue: [number, number][] = [[from.tx, from.ty]];
  while (queue.length > 0) {
    const next = queue.pop();
    if (next === undefined) break;
    const [x, y] = next;
    const key = `${x},${y}`;
    if (seen.has(key) || x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (tileBlocks(map, x, y, tidalGroundOpen, springOpen)) continue;
    seen.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

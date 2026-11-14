/**
 * Stage 14: the tide as each zone's ground feels it, and the links that are not edges (decisions
 * S14-110 to S14-113; Book 2 section 10, "Water depth bands" and FootLink; Book 9 sections 03 and
 * 16).
 *
 * - **Spring ground.** The Skerry's causeway and the caves' wet rock floor open only on a
 *   spring-tide day inside the tidal ground window (decision S14-31, `springOpen`).
 * - **Wades.** A plan's `wades` set the band of the water inside them (stream and pool tiles) that
 *   the height field cannot give: the falls' pool, the bog's pools, the deep passage's pool and
 *   lowest point.
 * - **The deep passage** (decision S14-9; C's `passageWater`): in the zones that open with it (the
 *   passage and the cairn's tidal passage), the floor stays open while the passage floods, closing
 *   last, and its pool and lowest point take the passage's bands now (`passage: 'POOL'|'LOWEST'`).
 * - **Portals** (decision S14-36): walking into a portal's exit, while its condition holds, leads
 *   to its zone at its entry. Leaving a passage zone by a portal is never refused once the
 *   passage is not open: whoever is still in it wades out (Book 2 section 10, "No trap").
 *
 * Pure and deterministic: the calendar and the world's facts only.
 */
import type { DepthBand } from '../../content/balance.ts';
import type { ZonePortal } from '../../content/zoneMap.ts';
import type { Id } from '../../core/ids.ts';
import type { TideNow } from './onFoot.ts';
import type { PassageWater } from './islandConditions.ts';
import type { WadeAt } from './water.ts';
import { terrainAt } from './zoneMap.ts';
import type { ZoneMap } from './zoneMap.ts';

/** A plan's wade: a rectangle of tiles waded at a band (or the passage's band now). */
export interface WadeMark {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly band: 'ANKLE' | 'KNEE' | 'WAIST';
  /** In a passage zone: the pool or the lowest point, whose band follows the tide. */
  readonly passage?: 'POOL' | 'LOWEST';
}

const NONE: readonly WadeMark[] = [];

/** The zone's wades (its plan's `traverse.wades`). */
export function wadeMarks(map: ZoneMap): readonly WadeMark[] {
  const t = map.traverse as { readonly wades?: readonly WadeMark[] } | undefined;
  return t?.wades ?? NONE;
}

/** The deep passage as the zones that open with it read it. */
export interface PassageNow {
  readonly water: PassageWater;
  /** The zones whose spring floor follows the passage (the passage and the cairn's tidal passage). */
  readonly floors: readonly Id[];
}

/** The calendar's tide as the zone tide needs it. */
export interface TideFacts {
  readonly tidalGroundOpen: boolean;
  readonly springTide: boolean;
}

/** Whether a zone's spring ground follows the deep passage. */
export function passageZone(passage: PassageNow | null, zone: Id): boolean {
  return passage !== null && passage.floors.includes(zone);
}

/**
 * The tide in a zone: whether its tidal ground and its spring ground are open, the still water
 * level, and the bands its plan sets.
 */
export function zoneTide(
  map: ZoneMap,
  tide: TideFacts,
  level: number,
  passage: PassageNow | null,
): TideNow & { readonly spring: boolean } {
  const inPassage = passageZone(passage, map.zone);
  const floorOpen = inPassage && passage !== null ? passage.water.floorOpen : false;
  const open = inPassage ? floorOpen : tide.tidalGroundOpen;
  const spring = inPassage ? floorOpen : tide.springTide;
  const marks = wadeMarks(map);
  if (marks.length === 0) return { open, spring, level };
  const T = map.tile;
  const water = inPassage ? (passage?.water ?? null) : null;
  const wade: WadeAt = (x, y) => {
    const tx = Math.floor(x / T);
    const ty = Math.floor((y - 0.001) / T);
    // A wade sets the band of the water inside it, not of the dry ground round its pools.
    const ground = terrainAt(map, tx, ty);
    if (ground !== 'stream' && ground !== 'pool') return null;
    for (const m of marks) {
      if (tx < m.x || ty < m.y || tx >= m.x + m.w || ty >= m.y + m.h) continue;
      const band: DepthBand =
        water !== null && m.passage === 'POOL'
          ? water.pool
          : water !== null && m.passage === 'LOWEST'
            ? water.lowest
            : m.band;
      return band;
    }
    return null;
  };
  return { open, spring, level, wade };
}

// ---------------------------------------------------------------------------- portals

/** A world fact store, as the portal's condition reads it. */
type Facts = Readonly<Record<string, string | number | boolean>>;

/** Whether a portal may be walked through now from its zone. */
export function portalOpen(
  portal: ZonePortal,
  from: Id,
  tide: TideFacts,
  passage: PassageNow | null,
  facts: Facts,
): boolean {
  const when = portal.when;
  if (when === undefined) return true;
  if ('fact' in when) return facts[when.fact] === true;
  // A spring low: the window open on a spring-tide day. Out of a passage zone the way out is never
  // shut on anyone still in it once the passage is not open (they wade out; no trap).
  if (passageZone(passage, from)) return true;
  return tide.tidalGroundOpen && tide.springTide;
}

const inRect = (r: ZonePortal['exit'], tx: number, ty: number): boolean =>
  tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h;

/**
 * The portal walked into: the feet's tile inside its exit, or the way the steerer presses (the
 * larger part of the intent) leading from the feet's tile into it (a door in solid ground).
 */
export function portalWalkedInto(
  map: ZoneMap,
  feet: { readonly x: number; readonly y: number },
  intent: { readonly x: number; readonly y: number },
): ZonePortal | null {
  const T = map.tile;
  const tx = Math.floor(feet.x / T);
  const ty = Math.floor((feet.y - 0.001) / T);
  const ax = Math.abs(intent.x);
  const ay = Math.abs(intent.y);
  const step: readonly [number, number] | null =
    Math.max(ax, ay) < 0.3 ? null : ax > ay ? [Math.sign(intent.x), 0] : [0, Math.sign(intent.y)];
  for (const p of map.portals ?? []) {
    if (inRect(p.exit, tx, ty)) return p;
    if (step !== null && inRect(p.exit, tx + step[0], ty + step[1])) return p;
  }
  return null;
}

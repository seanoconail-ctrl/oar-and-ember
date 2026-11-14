/**
 * Discovery on Skarvholm (Stage 14, decision S14-23; Book 2 section 10, "Discovery"; Book 9
 * section 02): `RegionState.discoveredZones` is what the region map inks in.
 *
 * - **Walking into a scene** discovers it (walking a link draws the scene it leads into); Gull Geo,
 *   Seal Cave and the interiors are drawn only this way.
 * - **An area** (`AreaDef`: the Kelda, the Grey Men) is discovered by standing inside it.
 * - **A view point** (`ViewPoint`: Rook Hill's summit) discovers every scene and area its
 *   `reveals` names, standing inside its `at`.
 *
 * Areas and view points are the zone plan's marks where the zone file carries them (`areas`,
 * `viewPoints`, work package A's), and `content/island.json`'s until then. Pure and deterministic.
 */
import type { AreaDef, ViewPointDef } from '../../content/islandSchema.ts';
import type { Id } from '../../core/ids.ts';
import type { WorldState } from '../world.ts';
import { regionOf } from './islandConditions.ts';
import type { IslandContext } from './islandConditions.ts';

export interface DiscoveryEvent {
  readonly type: 'ZONE_DISCOVERED';
  readonly zone: Id;
  readonly by: 'WALK' | 'AREA' | 'VIEW';
}

/** The zone plan's own marks, where its file carries them. */
interface MarkedMap {
  readonly areas?: readonly AreaDef[];
  readonly viewPoints?: readonly ViewPointDef[];
}

/** The areas of a scene: its zone file's, else content/island.json's. */
export function areasOf(ctx: Pick<IslandContext, 'island' | 'maps'>, zone: Id): readonly AreaDef[] {
  const own = (ctx.maps.get(zone) as MarkedMap | undefined)?.areas;
  return own !== undefined && own.length > 0 ? own : ctx.island.areas.filter((a) => a.scene === zone);
}

/** The view points of a scene: its zone file's, else content/island.json's. */
export function viewPointsOf(
  ctx: Pick<IslandContext, 'island' | 'maps'>,
  zone: Id,
): readonly ViewPointDef[] {
  const own = (ctx.maps.get(zone) as MarkedMap | undefined)?.viewPoints;
  return own !== undefined && own.length > 0
    ? own
    : ctx.island.viewPoints.filter((v) => v.scene === zone);
}

const inside = (
  r: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  x: number,
  y: number,
): boolean => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Marks what the steerer has found this tick. */
export function stepDiscovery(
  world: WorldState,
  ctx: IslandContext,
  emit: (e: DiscoveryEvent) => void,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null || !ctx.maps.has(onFoot.zone)) return;
  const region = regionOf(world, ctx);
  const found = region.discoveredZones;
  const add = (zone: Id, by: DiscoveryEvent['by']): void => {
    if (found.includes(zone)) return;
    found.push(zone);
    emit({ type: 'ZONE_DISCOVERED', zone, by });
  };
  add(onFoot.zone, 'WALK');
  const tile = ctx.maps.get(onFoot.zone)?.tile ?? 24;
  const x = onFoot.player.x / tile;
  const y = onFoot.player.y / tile;
  for (const a of areasOf(ctx, onFoot.zone)) if (inside(a.rect, x, y)) add(a.id, 'AREA');
  for (const v of viewPointsOf(ctx, onFoot.zone))
    if (inside(v.at, x, y)) for (const z of v.reveals) add(z, 'VIEW');
}

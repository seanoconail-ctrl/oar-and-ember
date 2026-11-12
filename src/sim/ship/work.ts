/**
 * Work at the boat (Stage 11): what a worker would do there now, read from the world state only, so
 * the household's jobs (sim/people) can ask without the narrative.
 */
import type { Id } from '../../core/ids.ts';
import type { WorldState } from '../world.ts';
import { FLAGSHIP, REPAIRS } from './ship.ts';
import type { RepairKind, ShipInstance } from './ship.ts';

/** How the steering oar was come by: FIGHT, THEFT, TRADE, FOUND (an empty skiff) or CARVED. */
export const FACT_OAR = 'repair.oar';
/** Who is carving a new steering oar (Runa), once asked. */
export const FACT_CARVING = 'repair.carving';

/** The household's boat, if it has one yet. */
export function boatOf(world: WorldState): ShipInstance | null {
  return world.ships[FLAGSHIP] ?? null;
}

/**
 * What a worker would work on at the boat now: a repair whose material is by the boat, a fitting
 * under way, or (the carver only, once asked) a new steering oar. Null: nothing to do there.
 */
export function shipWorkFor(world: WorldState, who: Id): RepairKind | 'FIT' | 'CARVE' | null {
  const ship = boatOf(world);
  if (ship === null) return null;
  if (
    world.facts[FACT_CARVING] === who &&
    ship.repairs.STEERING_OAR.stage === 'LACKING' &&
    world.facts[FACT_OAR] === undefined
  )
    return 'CARVE';
  for (const r of REPAIRS) if (ship.repairs[r].stage === 'MATERIALS') return r;
  if (ship.fitting !== null) return 'FIT';
  return null;
}

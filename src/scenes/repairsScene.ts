/**
 * What the scene draws of Chapter 1's repairs (Stage 11; Book 7 sections 03 to 05): the boat on
 * Wreck Strand as its repairs and fitting stand, each part a layer over its hull; the loads laid
 * by it; the rigging still fouled on the wreck; the scavengers' skiff with or without its steering
 * oar; and Thorkel's ship of stones as it goes up. Read from the world; nothing here changes it.
 */
import type { RepairsDef } from '../content/registry.ts';
import type { Id } from '../core/ids.ts';
import { boatOf, oarInSkiff, riggingOnWreck } from '../sim/narrative/repairs.ts';
import type { RepairsContext } from '../sim/narrative/repairs.ts';
import { ritesView } from '../sim/narrative/repairs.ts';
import type { WorldState } from '../sim/world.ts';

export interface RepairProp {
  readonly sheet: string;
  readonly frame: string;
  readonly x: number;
  readonly y: number;
  readonly after?: number;
}

/** Where a laid load lies by the boat (tiles from its foot), by the repair it is for. */
const LAID: Readonly<Record<string, { sheet: string; dx: number; dy: number }>> = {
  HULL: { sheet: 'prop_boards', dx: 3.3, dy: 1.2 },
  RIGGING: { sheet: 'prop_rigging', dx: -3.4, dy: 1.3 },
  STEERING_OAR: { sheet: 'prop_steering_oar', dx: -0.4, dy: 1.5 },
};

/** The boat's drawn layers now: hull, then rigging, oar, fitting and launch-ready over it. */
export function boatLayers(world: WorldState): { sheet: string; frame: string }[] {
  const ship = boatOf(world);
  if (ship === null) return [];
  const r = ship.repairs;
  const out = [
    {
      sheet: 'ship_t1',
      frame: r.HULL.stage === 'DONE' ? 'hull_patched/-/0' : 'hull_wrecked/-/0',
    },
  ];
  const fitted = Object.values(ship.fittings);
  if (fitted.includes('FIT_EXTENDED_HOLD')) out.push({ sheet: 'ship_t1_parts', frame: 'hold/-/0' });
  if (r.RIGGING.stage === 'DONE') out.push({ sheet: 'ship_t1_parts', frame: 'rig/-/0' });
  if (fitted.includes('FIT_RAISED_BOW_PLATFORM'))
    out.push({ sheet: 'ship_t1_parts', frame: 'bow/-/0' });
  if (r.STEERING_OAR.stage === 'DONE') out.push({ sheet: 'ship_t1_parts', frame: 'oar/-/0' });
  if (r.HULL.stage === 'DONE' && r.RIGGING.stage === 'DONE' && r.STEERING_OAR.stage === 'DONE')
    out.push({ sheet: 'ship_t1_parts', frame: 'ready/-/0' });
  return out;
}

/** Every repair prop in a zone now, in tiles at the foot. */
export function repairProps(
  world: WorldState,
  ctx: Pick<RepairsContext, 'def'> | { readonly def: RepairsDef },
  zone: Id,
): RepairProp[] {
  const d = ctx.def;
  const out: RepairProp[] = [];
  const ship = boatOf(world);
  if (ship !== null && ship.lies.zone === zone) {
    boatLayers(world).forEach((layer, k) => {
      out.push({ ...layer, x: ship.lies.x, y: ship.lies.y, ...(k > 0 ? { after: 0.01 * k } : {}) });
    });
    for (const [repair, laid] of Object.entries(LAID)) {
      const rep = ship.repairs[repair as keyof typeof ship.repairs];
      if (rep.stage !== 'MATERIALS') continue;
      out.push({
        sheet: laid.sheet,
        frame: 'down/s/0',
        x: ship.lies.x + laid.dx,
        y: ship.lies.y + laid.dy,
      });
    }
  }
  if (zone === d.rigging.zone && riggingOnWreck(world))
    out.push({
      sheet: 'prop_rigging_tangle',
      frame: 'fouled/-/0',
      x: d.rigging.tangle.x,
      y: d.rigging.tangle.y,
    });
  if (zone === d.oar.zone)
    out.push({
      sheet: 'prop_skiff',
      frame: oarInSkiff(world) ? 'oar/-/0' : 'bare/-/0',
      x: d.oar.skiff.x,
      y: d.oar.skiff.y,
    });
  const rites = ritesView(world, { def: d } as RepairsContext);
  if (rites !== null && rites.zone === zone)
    out.push({ sheet: 'prop_shipsetting', frame: `${rites.frame}/-/0`, x: rites.x, y: rites.y });
  return out;
}

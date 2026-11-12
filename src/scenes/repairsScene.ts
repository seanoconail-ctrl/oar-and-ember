/**
 * What the scene draws of Chapter 1's repairs (Stage 11; Book 7 sections 03 to 05): the boat on
 * Wreck Strand as its repairs and fitting stand, each part a layer over its hull; the loads laid
 * by it; the rigging still fouled on the wreck; the scavengers' skiff with or without its steering
 * oar; and Thorkel's ship of stones as it goes up. Read from the world; nothing here changes it.
 */
import type { LaunchDef, RepairsDef } from '../content/registry.ts';
import { launchView } from '../sim/narrative/launch.ts';
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
  readonly fixed?: boolean;
}

/** A layer of the boat: its sheet and frame, and (Stage 12) where along the hull, and a held frame. */
export interface BoatLayer {
  readonly sheet: string;
  readonly frame: string;
  /** Pixels along the hull from its pivot (the crew at their seats). */
  readonly dx?: number;
  readonly fixed?: boolean;
}

/**
 * The seats of the household aboard and the steering oar's place, as fractions of the hull from
 * stern to stem, and the hull's ends in its canvas (assets/art/authoring/stage12_art.py: SEATS, and
 * stage11_art.py: X0, X1, PX).
 */
const SEATS = [0.31, 0.43, 0.57, 0.69] as const;
const HELM = 0.13;
const HULL = { x0: 20, x1: 188, px: 104 } as const;
const along = (t: number): number => Math.round(HULL.x0 + (HULL.x1 - HULL.x0) * t) - HULL.px;
/** Who rows in the crew sheet, by person. */
const ROWERS: Readonly<Record<string, string>> = {
  C_HILD: 'hild',
  C_ODDI: 'oddi',
  C_RUNA: 'runa',
  C_BRAN: 'bran',
};

/**
 * The boat's layers during the launch (Stage 12; Book 7 section 05, launching): afloat, the mast
 * standing, the steering oar's blade under water, the yard going up and the sail dropping and
 * set with its mark, the household rowing at their seats and the steerer at the steering oar.
 */
function launchLayers(world: WorldState, def: LaunchDef): BoatLayer[] | null {
  const view = launchView(world, { def });
  const ship = boatOf(world);
  if (view === null || ship === null || !view.afloat) return null;
  const out: BoatLayer[] = [{ sheet: 'ship_t1_launch', frame: 'afloat/-/0' }];
  const fitted = Object.values(ship.fittings);
  if (fitted.includes('FIT_EXTENDED_HOLD')) out.push({ sheet: 'ship_t1_parts', frame: 'hold/-/0' });
  if (fitted.includes('FIT_RAISED_BOW_PLATFORM'))
    out.push({ sheet: 'ship_t1_parts', frame: 'bow/-/0' });
  out.push({ sheet: 'ship_t1_launch', frame: 'mast/-/0' });
  out.push({ sheet: 'ship_t1_launch', frame: 'oar/-/0' });
  view.aboard.forEach((id, i) => {
    const who = ROWERS[id];
    const seat = SEATS[i];
    if (who === undefined || seat === undefined) return;
    out.push({
      sheet: 'ship_t1_crew',
      frame: `${who}_${i}/-/0`,
      dx: along(seat),
      fixed: !view.rowing,
    });
  });
  if (view.steererAboard)
    out.push({
      sheet: 'ship_t1_crew',
      frame: `helm_${world.player.bodyModel === 'B' ? 'b' : 'a'}/-/0`,
      dx: along(HELM),
    });
  const mark = (view.mark ?? 'plain').replace(':', '_');
  if (view.sail.state === 'HOIST') {
    const at = view.sail.at;
    if (at < 0.55)
      out.push({
        sheet: 'ship_t1_sail',
        frame: `hoist/-/${Math.min(3, Math.floor((at / 0.55) * 4))}`,
        fixed: true,
      });
    else
      out.push({
        sheet: 'ship_t1_sail',
        frame: `drop_${mark}/-/${Math.min(2, Math.floor(((at - 0.55) / 0.45) * 3))}`,
        fixed: true,
      });
  } else if (view.sail.state === 'SET')
    out.push({ sheet: 'ship_t1_sail', frame: `set_${mark}/-/0` });
  return out;
}

/** Where a laid load lies by the boat (tiles from its foot), by the repair it is for. */
const LAID: Readonly<Record<string, { sheet: string; dx: number; dy: number }>> = {
  HULL: { sheet: 'prop_boards', dx: 3.3, dy: 1.2 },
  RIGGING: { sheet: 'prop_rigging', dx: -3.4, dy: 1.3 },
  STEERING_OAR: { sheet: 'prop_steering_oar', dx: -0.4, dy: 1.5 },
};

/** The boat's drawn layers now: hull, then rigging, oar, fitting and launch-ready over it. */
export function boatLayers(world: WorldState, launch: LaunchDef | null = null): BoatLayer[] {
  const ship = boatOf(world);
  if (ship === null) return [];
  const afloat = launch === null ? null : launchLayers(world, launch);
  if (afloat !== null) return afloat;
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
  launch: LaunchDef | null = null,
): RepairProp[] {
  const d = ctx.def;
  const out: RepairProp[] = [];
  const ship = boatOf(world);
  if (ship !== null && ship.lies.zone === zone) {
    boatLayers(world, launch).forEach((layer, k) => {
      out.push({
        sheet: layer.sheet,
        frame: layer.frame,
        x: ship.lies.x + (layer.dx ?? 0) / 24,
        y: ship.lies.y,
        ...(k > 0 ? { after: 0.01 * k } : {}),
        ...(layer.fixed === true ? { fixed: true } : {}),
      });
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

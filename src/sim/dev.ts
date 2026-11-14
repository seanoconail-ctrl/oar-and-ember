/**
 * The developer menu's commands (Book 2 section 21; Book 10 section 21, "Developer menu"; decision
 * DG-21): skip game hours, teleport the steerer to a tile, kill an enemy. Each is a command stamped
 * with its tick like any other, so a replay stays exact; each marks the world (`dev.used`), so
 * every later save carries the dev mark and the chapter's telemetry stops counting the run. Only a
 * debug build or an address with `?dev` ever sends them (src/scenes/devMenu.ts). Pure.
 */
import type { Id } from '../core/ids.ts';
import { setFact } from './ledger/ledger.ts';
import type { FightWorld } from './land/fight.ts';
import { hurt } from './land/fight.ts';
import { footprintClear } from './land/onFoot.ts';
import type { LandContext } from './land/onFoot.ts';
import type { WorldState } from './world.ts';

/** The fact every developer command sets (src/persist/save.ts reads it for the header's mark). */
export const FACT_DEV = 'dev.used';

export type DevCommand =
  /** Skip `minutes` of game time (Book 10 devSkipHours, as minutes). */
  | { readonly type: 'DEV_SKIP'; readonly minutes: number }
  /** Teleport to a tile, or the nearest clear tile within `within` tiles (Book 10 devTeleport). */
  | {
      readonly type: 'DEV_TELEPORT';
      readonly tile: { readonly tx: number; readonly ty: number };
      readonly within: number;
    }
  /** Kill a hostile at once; no deed is written (Book 10 devKill). */
  | { readonly type: 'DEV_KILL'; readonly target: Id }
  /** Stage 13: every sea route and place known (src/sim/sea/chart.ts), so every edge is reachable. */
  | { readonly type: 'DEV_SEA_CHART' };

export type DevResult = 'DONE' | 'BUSY' | 'NOTHING_THERE';

/** Whether a fight is under way in the zone (a skip waits for it to end). */
export function fightUnderWay(world: WorldState): boolean {
  const battle = world.onFoot?.battle;
  return battle != null && battle.engaged && !battle.over;
}

export interface DevHooks {
  /** Runs game minutes through the low-detail steps (the simulation's advanceBy). */
  readonly advanceBy: (minutes: number) => void;
  readonly land: Pick<LandContext, 'maps' | 'rules'> | null;
  readonly tidalGroundOpen: boolean;
  readonly fightWorld: () => FightWorld | null;
}

export function applyDev(world: WorldState, command: DevCommand, hooks: DevHooks): DevResult {
  switch (command.type) {
    case 'DEV_SKIP': {
      // Refused while a fight is under way or a scene or talk has control.
      if (fightUnderWay(world) || world.talk !== null) return 'BUSY';
      setFact(world, FACT_DEV, true);
      hooks.advanceBy(Math.max(0, Math.round(command.minutes)));
      return 'DONE';
    }
    case 'DEV_TELEPORT': {
      const onFoot = world.onFoot;
      const map = onFoot === null ? undefined : hooks.land?.maps.get(onFoot.zone);
      if (onFoot === null || map === undefined || hooks.land === null) return 'NOTHING_THERE';
      const rules = hooks.land.rules;
      const t = map.tile;
      // The tile's foot point, then the nearest clear tile within `within`, nearest first.
      const spots: { tx: number; ty: number; d: number }[] = [];
      const r = Math.max(0, Math.floor(command.within));
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          spots.push({ tx: command.tile.tx + dx, ty: command.tile.ty + dy, d: dx * dx + dy * dy });
      spots.sort((a, b) => a.d - b.d || a.ty - b.ty || a.tx - b.tx);
      for (const s of spots) {
        if (s.d > r * r) continue;
        const x = (s.tx + 0.5) * t;
        const y = (s.ty + 0.75) * t;
        if (!footprintClear(map, rules, x, y, hooks.tidalGroundOpen)) continue;
        setFact(world, FACT_DEV, true);
        const p = onFoot.player;
        p.x = x;
        p.y = y;
        p.vel = { x: 0, y: 0 };
        // A carried person comes too.
        const carried = onFoot.carrying === null ? undefined : onFoot.actors[onFoot.carrying];
        if (carried !== undefined) {
          carried.x = x;
          carried.y = y;
        }
        return 'DONE';
      }
      return 'NOTHING_THERE';
    }
    case 'DEV_KILL': {
      const fw = hooks.fightWorld();
      const a = world.onFoot?.actors[command.target];
      const fa = a?.fight;
      if (fw === null || fa?.side !== 'ENEMY' || fa.dead !== null) return 'NOTHING_THERE';
      setFact(world, FACT_DEV, true);
      // Struck down by itself: no one of the household did it, so no deed is written.
      hurt(fw, command.target, fa.vitality + 1e6, command.target, {
        heavyKill: false,
        weapon: null,
        dx: 0,
        dy: 1,
      });
      return 'DONE';
    }
    // The sea's chart is applied by the simulation's sea commands (src/sim/sea/chart.ts).
    case 'DEV_SEA_CHART':
      return 'NOTHING_THERE';
  }
}

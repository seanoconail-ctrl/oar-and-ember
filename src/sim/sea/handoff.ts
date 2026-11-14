/**
 * Handoffs (Book 2 section 09): an encounter's playable scene or a landing takes the steerer off
 * the sea map, and its result comes back to the voyage. The contract:
 *
 * - The simulation emits `SEA_HANDOFF` with a `HandoffState` (kind, scenario, place, edge); the
 *   voyage waits (`status: 'HANDOFF'`) and `SEA_WATCH` is refused until the result comes.
 * - `currentHandoff(world)` gives the scene its `HandoffRequest`: the handoff and the voyage.
 * - An `ON_FOOT` scene is put in place with `beginHandoffScene(world, scene)`: the steerer is on
 *   foot in it (`world.onFoot`), the home's scene stays kept in `sea.stash`, and the land step and
 *   the on-foot clock run as on foot; the home passes the time through the away step.
 * - The scene ends with `endHandoffScene(world)` (the steerer back aboard, `onFoot` null) and the
 *   command `SEA_HANDOFF_RETURN` with its `HandoffResult`: the outcome (go on, or turn for home),
 *   the facts it sets, who came aboard (survivors taken off) or left, and the stores' change.
 *
 * Carrick Landing's arrival hands off to `SCN_CARRICK` with `landing: true`, a stub until Stage 16
 * (`stubUntilStage`): its result leaves the boat lying at Carrick, or turns it for home.
 */
import type { WorldState } from '../world.ts';
import type { OnFootState } from '../land/onFoot.ts';
import type { HandoffRequest, HandoffResult } from './types.ts';

/** The handoff waiting for its scene, with the voyage it interrupts; null if none. */
export function currentHandoff(world: WorldState): HandoffRequest | null {
  const v = world.sea.voyage;
  if (v === null || v.handoff === null) return null;
  return { ...v.handoff, voyage: v };
}

/** Whether the steerer is at sea (on the sea map, not in a handed-off scene). */
export function atSea(world: WorldState): boolean {
  return world.sea.voyage !== null && world.onFoot === null;
}

/** Whether the steerer is in a handed-off scene on foot while the voyage waits. */
export function inHandoffScene(world: WorldState): boolean {
  return world.sea.voyage?.handoff?.kind === 'ON_FOOT' && world.onFoot !== null;
}

/** Puts an `ON_FOOT` handoff's scene in place (the home's stays kept). False if none is waiting. */
export function beginHandoffScene(world: WorldState, scene: OnFootState): boolean {
  if (world.sea.voyage?.handoff?.kind !== 'ON_FOOT') return false;
  world.onFoot = scene;
  return true;
}

/** Ends the handoff's scene: the steerer is back aboard. Returns the scene as it ended. */
export function endHandoffScene(world: WorldState): OnFootState | null {
  if (world.sea.voyage === null) return null;
  const scene = world.onFoot;
  world.onFoot = null;
  return scene;
}

/** A result that changes nothing and goes on (the dev menu's, and the Stage 16 stub's). */
export function plainResult(outcome: HandoffResult['outcome'] = 'CONTINUE'): HandoffResult {
  return { outcome, facts: {}, aboardChanges: { join: [], leave: [] }, storesDelta: 0 };
}

/**
 * The only ways to change the ledger, evidence, facts and one-shots (Book 2 sections 05 and 15).
 * The ledger and evidence are append-only: entries are frozen when added and nothing removes them.
 * A one-shot is recorded before its effect runs, so a save made mid-effect never repeats it.
 */
import type { Id } from '../../core/ids.ts';
import type { Deed, Evidence, FactValue, WorldState } from '../world.ts';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

export function appendDeed(world: WorldState, deed: Deed): void {
  if (world.ledger.some((d) => d.id === deed.id))
    throw new Error(`Deed ${deed.id} is already in the ledger`);
  world.ledger.push(deepFreeze(structuredClone(deed)));
}

export function appendEvidence(world: WorldState, evidence: Evidence): void {
  if (world.evidence.some((e) => e.id === evidence.id))
    throw new Error(`Evidence ${evidence.id} is already recorded`);
  world.evidence.push(deepFreeze(structuredClone(evidence)));
}

/** Supersedes a fact's value. Facts are never deleted. */
export function setFact(world: WorldState, key: string, value: FactValue): void {
  world.facts[key] = value;
}

/**
 * Runs `effect` once per campaign for `id`. Returns false, without running it, if the one-shot
 * has fired before (in this session or any save it was loaded from).
 */
export function fireOneShot(world: WorldState, id: Id, effect: () => void): boolean {
  if (Object.hasOwn(world.oneShots, id)) return false;
  world.oneShots[id] = world.calendar.day;
  effect();
  return true;
}

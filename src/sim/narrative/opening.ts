/**
 * Chapter 1 beat 1 (Book 4 section 08): wake on Wreck Strand, control in seconds; Hild is calling
 * beyond the rocks; carry her above the tide line. Nothing here is a control list: her calls give
 * a direction to walk in, finding her offers the lift, and the tide line refuses a wet set-down
 * with its reason (Book 3 Stage 6 check 2). The beat's one-shot fires when she is safe.
 */
import type { OpeningDef } from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';
import { fireOneShot, setFact } from '../ledger/ledger.ts';
import { compass, TICKS_PER_SECOND } from '../land/onFoot.ts';
import type { WorldState } from '../world.ts';

export const FACT_HILD_FOUND = 'ch1.hild_found';
export const FACT_HILD_SAFE = 'ch1.hild_safe';

export type OpeningEvent =
  | {
      readonly type: 'PERSON_CALLED';
      readonly person: Id;
      readonly lineKey: string;
      readonly direction: ReturnType<typeof compass>;
      readonly distanceTiles: number;
    }
  | { readonly type: 'PERSON_SPOKE'; readonly person: Id; readonly lineKey: string }
  | { readonly type: 'BEAT_COMPLETED'; readonly beat: Id };

/** Hild's call schedule: while she is down and not yet found, she calls every few seconds. */
export function stepOpening(
  world: WorldState,
  opening: OpeningDef,
  tile: number,
  emit: (event: OpeningEvent) => void,
): void {
  const onFoot = world.onFoot;
  if (onFoot?.zone !== opening.zone) return;
  const caller = onFoot.actors[opening.caller];
  if (caller?.pose !== 'down' || world.facts[FACT_HILD_FOUND] === true) return;
  const first = opening.firstCallSeconds * TICKS_PER_SECOND;
  const every = opening.callEverySeconds * TICKS_PER_SECOND;
  if (world.tick < first || (world.tick - first) % every !== 0) return;
  const n = (world.tick - first) / every;
  const lineKey = opening.callLines[n % opening.callLines.length] ?? '';
  const p = onFoot.player;
  emit({
    type: 'PERSON_CALLED',
    person: opening.caller,
    lineKey,
    direction: compass(p, caller),
    distanceTiles: Math.round(Math.hypot(caller.x - p.x, caller.y - p.y) / tile),
  });
}

/** The steerer lifted someone: finding Hild is a fact, and she speaks. */
export function onLifted(
  world: WorldState,
  opening: OpeningDef,
  person: Id,
  emit: (event: OpeningEvent) => void,
): void {
  if (person !== opening.caller || world.facts[FACT_HILD_FOUND] === true) return;
  setFact(world, FACT_HILD_FOUND, true);
  const record = world.people[person];
  if (record !== undefined) record.status = 'wounded';
  emit({ type: 'PERSON_SPOKE', person, lineKey: opening.foundLine });
}

/** A set-down was refused below the tide line: Hild says why, once per refusal. */
export function onTideRefusal(
  opening: OpeningDef,
  person: Id,
  emit: (event: OpeningEvent) => void,
): void {
  if (person === opening.caller)
    emit({ type: 'PERSON_SPOKE', person, lineKey: opening.refusedLine });
}

/** Set down above the tide line: Hild is safe, joins the household, and the beat completes. */
export function onSetDown(
  world: WorldState,
  opening: OpeningDef,
  person: Id,
  emit: (event: OpeningEvent) => void,
): void {
  if (person !== opening.caller) return;
  fireOneShot(world, opening.beat, () => {
    setFact(world, FACT_HILD_SAFE, true);
    if (!world.household.residents.includes(person)) world.household.residents.push(person);
    emit({ type: 'PERSON_SPOKE', person, lineKey: opening.safeLine });
    emit({ type: 'BEAT_COMPLETED', beat: opening.beat });
  });
}

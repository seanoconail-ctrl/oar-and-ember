/**
 * Chapter 1 beats 7 to 9 at the camp in the old broch (Book 4 section 08): Hild's lines at the
 * camp as they come due (off to her work, the first evening), and the beat that completes once
 * the fire is lit and her leg is tended.
 *
 * Before design addendum 2.4 Hild led the steerer here after naming the bow (decision S7-11). She
 * no longer leads: the camp opens when the steerer first reaches it and she walks up when the
 * first fire is lit (decision DE-16; src/sim/narrative/wreck.ts). `FACT_LEAD_STARTED` is kept only
 * as older saves wrote it.
 */
import type { OpeningDef } from '../../content/registry.ts';
import { fireOneShot, setFact } from '../ledger/ledger.ts';
import type { CampContext } from '../home/camp.ts';
import { FACT_ARRIVED_SAID, FACT_FIRE_LIT, FACT_HILD_TENDED } from '../home/camp.ts';
import type { LandContext } from '../land/onFoot.ts';
import { findActor } from '../land/zoneLinks.ts';
import type { WorldState } from '../world.ts';
import { FACT_HILD_SAFE } from './opening.ts';
import type { OpeningEvent } from './opening.ts';

export const FACT_LEAD_STARTED = 'ch1.lead_started';
const FACT_FISHING_SAID = 'ch1.fishing_said';
const FACT_EVENING_SAID = 'ch1.evening_said';

/** One tick at the camp: Hild's lines as they come due. `emit` speaks in her voice. */
export function stepBroch(
  world: WorldState,
  ctx: CampContext,
  opening: OpeningDef,
  _land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  _tidalGroundOpen: boolean,
  emit: (event: OpeningEvent) => void,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null || world.facts[FACT_HILD_SAFE] !== true) return;
  const id = opening.caller;
  const say = (lineKey: string | undefined): void => {
    if (lineKey !== undefined) emit({ type: 'PERSON_SPOKE', person: id, lineKey });
  };
  const found = findActor(onFoot, id);
  if (found === null) return;
  const p = onFoot.player;
  const tile = 24;
  const now = found;
  // Design addendum 2.4 (decision DE-16): Hild no longer leads to the broch; she walks up when the
  // first fire is lit (src/sim/narrative/wreck.ts), and her walking up stands for her arrival.
  if (
    world.facts[FACT_ARRIVED_SAID] !== true &&
    world.facts['ch1.hild_walked_up'] === true &&
    (world.facts[FACT_HILD_TENDED] === true || world.calendar.day > 1)
  )
    setFact(world, FACT_ARRIVED_SAID, true);
  // The first time she goes off to work, in the steerer's hearing.
  if (
    world.facts[FACT_ARRIVED_SAID] === true &&
    world.facts[FACT_FISHING_SAID] !== true &&
    now.visible &&
    world.people[id]?.life.activity === 'WORK' &&
    Math.hypot(now.actor.x - p.x, now.actor.y - p.y) < 8 * tile
  ) {
    setFact(world, FACT_FISHING_SAID, true);
    say(ctx.def.lines['fishing']);
  }
  // The first evening at the camp: she offers to keep the fire in.
  if (
    world.facts[FACT_EVENING_SAID] !== true &&
    world.facts[FACT_FIRE_LIT] === true &&
    now.visible &&
    now.actor.pose === 'sit' &&
    world.calendar.minuteOfDay >= ctx.time.sleepAfter &&
    Math.hypot(now.actor.x - p.x, now.actor.y - p.y) < 4 * tile
  ) {
    setFact(world, FACT_EVENING_SAID, true);
    say(ctx.def.lines['evening']);
  }
  // The beat is done once the fire is lit and her leg is tended.
  if (world.facts[FACT_FIRE_LIT] === true && world.facts[FACT_HILD_TENDED] === true)
    fireOneShot(world, ctx.def.beat, () => {
      emit({ type: 'BEAT_COMPLETED', beat: ctx.def.beat });
    });
}

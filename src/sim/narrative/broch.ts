/**
 * Chapter 1 beat 2 (Book 4 section 08): Hild leads to the old broch. Gather driftwood, light a
 * fire, treat her injury. Warmth, food, a conversation.
 *
 * - A few seconds after she names the bow, Hild gets up and leads: over the shingle, up the cut and
 *   north across the machair to the broch, waiting whenever the steerer falls behind.
 * - At the broch she sits by the fire ring and says what is needed; from then the household's day
 *   (src/sim/people, Stage 8) moves her: she goes to her work at once, wound or no wound.
 * - The beat completes once the fire is lit and her leg is tended.
 */
import type { OpeningDef } from '../../content/registry.ts';
import { TILE } from '../../content/terrain/autotile.ts';
import type { Id } from '../../core/ids.ts';
import { fireOneShot, setFact } from '../ledger/ledger.ts';
import type { CampContext } from '../home/camp.ts';
import { FACT_ARRIVED_SAID, FACT_AT_BROCH, FACT_FIRE_LIT, FACT_HILD_TENDED } from '../home/camp.ts';
import type { LandContext } from '../land/onFoot.ts';
import { TICKS_PER_SECOND } from '../land/onFoot.ts';
import { findActor, translate } from '../land/zoneLinks.ts';
import { stepResident } from '../people/residents.ts';
import type { ResidentPlace } from '../people/residents.ts';
import type { WorldState } from '../world.ts';
import { FACT_BOW_NAMED, FACT_HILD_SAFE, FACT_HILD_SAFE_AT } from './opening.ts';
import type { OpeningEvent } from './opening.ts';

export const FACT_LEAD_STARTED = 'ch1.lead_started';
const FACT_LEAD_WAITED = 'ch1.lead_waited';
const FACT_FISHING_SAID = 'ch1.fishing_said';
const FACT_EVENING_SAID = 'ch1.evening_said';

/** Where Hild leads to: her place by the fire ring. */
export function leadPlace(ctx: CampContext, id: Id): ResidentPlace | null {
  const plan = ctx.def.people[id];
  if (plan === undefined) return null;
  return {
    zone: ctx.def.zone,
    x: plan.camp.x * TILE,
    y: plan.camp.y * TILE,
    facing: plan.camp.facing,
    pose: 'sit',
  };
}

/** Whether Hild is leading the steerer to the broch (the lead started, the broch not reached). */
export function leading(world: WorldState): boolean {
  return world.facts[FACT_LEAD_STARTED] === true && world.facts[FACT_AT_BROCH] !== true;
}

/**
 * One tick of beat 2. While she leads, Hild walks to the broch, waiting when the steerer falls
 * behind; afterwards she says the camp's lines as they come due. `emit` speaks in her voice.
 */
export function stepBroch(
  world: WorldState,
  ctx: CampContext,
  opening: OpeningDef,
  land: Pick<LandContext, 'rules' | 'movement' | 'maps'>,
  tidalGroundOpen: boolean,
  emit: (event: OpeningEvent) => void,
): void {
  const onFoot = world.onFoot;
  if (onFoot === null || world.facts[FACT_HILD_SAFE] !== true) return;
  const id = opening.caller;
  const say = (lineKey: string | undefined): void => {
    if (lineKey !== undefined) emit({ type: 'PERSON_SPOKE', person: id, lineKey });
  };
  // The lead begins a few seconds after she names the bow.
  if (world.facts[FACT_LEAD_STARTED] !== true) {
    const at = world.facts[FACT_HILD_SAFE_AT];
    const since = typeof at === 'number' ? world.tick - at : 0;
    const due = (opening.bowLineSeconds + ctx.def.leadAfterSeconds) * TICKS_PER_SECOND;
    if (world.facts[FACT_BOW_NAMED] !== true || since < due) return;
    setFact(world, FACT_LEAD_STARTED, true);
    say(ctx.def.lines['lead']);
  }
  const place = leadPlace(ctx, id);
  const found = findActor(onFoot, id);
  if (place === null || found === null) return;
  const plan = ctx.def.people[id];
  const p = onFoot.player;
  const tile = land.maps.get(found.zone)?.tile ?? 24;
  if (leading(world)) {
    // She waits whenever the steerer, in view, is far behind her (further from the broch).
    const here = land.maps.get(found.zone);
    const there = land.maps.get(place.zone);
    const goal =
      here === undefined || there === undefined ? place : translate(there, here, place.x, place.y);
    const far =
      found.visible &&
      Math.hypot(found.actor.x - p.x, found.actor.y - p.y) > (plan?.leadWaitTiles ?? 7) * tile &&
      Math.hypot(goal.x - p.x, goal.y - p.y) >
        Math.hypot(goal.x - found.actor.x, goal.y - found.actor.y);
    if (far && world.facts[FACT_LEAD_WAITED] !== true) {
      setFact(world, FACT_LEAD_WAITED, true);
      say(ctx.def.lines['wait']);
    }
    stepResident(onFoot, id, place, land.maps, land, tidalGroundOpen, far);
    const now = findActor(onFoot, id);
    // Arrived: she sits by the fire ring.
    if (
      now !== null &&
      now.zone === place.zone &&
      Math.hypot(now.actor.x - place.x, now.actor.y - place.y) < 1
    )
      setFact(world, FACT_AT_BROCH, true);
    return;
  }
  const now = found;
  // At the broch: she says what is needed once the steerer is there.
  if (
    world.facts[FACT_AT_BROCH] === true &&
    world.facts[FACT_ARRIVED_SAID] !== true &&
    now.visible &&
    Math.hypot(now.actor.x - p.x, now.actor.y - p.y) < 6 * tile
  ) {
    setFact(world, FACT_ARRIVED_SAID, true);
    say(ctx.def.lines['arrived']);
  }
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

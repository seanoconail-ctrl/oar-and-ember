/**
 * The wreck on Sgeir Dhubh, standalone (Stage 13, work package C; decision S13-56): tests and
 * captures only. `?wreck=1` (with `camp=broch&crew=1`, the household home) puts the steerer on the
 * reef as the voyage's handoff would: a voyage to Carrick Landing under way on the Skarvholm to
 * Carrick route, its wreck met and handed off (`HANDOFF`, `SCN_SEA_WRECK`), the home's scene kept
 * in `sea.stash`, and the wreck's scene in place (src/sim/sea/wreck.ts `beginWreck`). The voyage
 * is set as the sea simulation leaves it at a handoff, so the scene's result can be returned with
 * `SEA_HANDOFF_RETURN` and the voyage goes on.
 */
import type { Content } from '../content/registry.ts';
import type { SimWorldContext } from '../sim/simulation.ts';
import { beginWreck, seaWreckContext } from '../sim/sea/wreck.ts';
import type { VoyageState } from '../sim/sea/types.ts';
import type { WorldState } from '../sim/world.ts';

/** The voyage as the sea simulation leaves it at the wreck's handoff, halfway over the route. */
export function wreckVoyage(world: WorldState, content: Pick<Content, 'wreck'>): VoyageState {
  const def = content.wreck;
  if (def === null) throw new Error('content/wreck.json did not load');
  const aboard = world.household.residents.filter((id) => {
    const s = world.people[id]?.status;
    return s !== 'dead' && s !== 'missing' && s !== 'captive';
  });
  const minutes = 720;
  return {
    id: world.sea.governor.voyages + 1,
    from: 'ISLE_SKARV',
    to: 'SITE_CARRICK',
    at: 'ISLE_SKARV',
    arrivedBy: null,
    route: [def.edge],
    leg: {
      edge: def.edge,
      from: 'ISLE_SKARV',
      to: 'SITE_CARRICK',
      bearing: 'SW',
      pointOfSail: 'BEAM',
      speed: 2.4,
      rowing: false,
      exposure: 2,
      minutes,
      done: minutes / 2,
      encounter: {
        table: 'ENC_OPEN',
        key: 'wreck',
        textKey: 'sea.enc.open.wreck',
        supernatural: false,
        story: true,
        scene: { kind: 'ON_FOOT', scenario: def.scenario },
      },
      encounterAt: minutes / 2,
      fired: true,
      ransReach: true,
    },
    status: 'HANDOFF',
    hold: null,
    choice: null,
    pressed: [],
    handoff: {
      kind: 'ON_FOOT',
      scenarioId: def.scenario,
      placeId: null,
      edgeId: def.edge,
      landing: false,
      stubUntilStage: null,
    },
    aboard,
    stores: { RES_SALTED_FISH: 4 * (aboard.length + 1) },
    shortWatches: 0,
    shortRd: 0,
    minutes: minutes / 2,
    legs: 0,
    met: ['ENC_OPEN:wreck'],
    gate: null,
  };
}

/** `?wreck=1`: the steerer on the reef, the voyage waiting for the scene's result. */
export function wreckHooks(
  world: WorldState,
  content: Pick<Content, 'wreck' | 'hulls' | 'fittings' | 'balance'>,
  land: SimWorldContext,
  params: URLSearchParams,
): void {
  if (params.get('wreck') !== '1' || world.sea.voyage !== null) return;
  const ctx = seaWreckContext(content, land.people ?? null);
  const map = ctx === null ? undefined : land.maps.get(ctx.def.zone);
  if (ctx === null || map === undefined) return;
  world.sea.voyage = wreckVoyage(world, content);
  world.sea.stash = world.onFoot;
  world.onFoot = null;
  world.talk = null;
  beginWreck(world, ctx, map);
}

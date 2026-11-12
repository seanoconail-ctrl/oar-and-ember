/**
 * The version 10 to 11 migration's part for design addendum 2.4's opening (Book 2 section 05,
 * "Versions"; decisions DE-16 to DE-30). An older save gains the Chapter 1 state it would have had:
 *
 * - the aims' state (`aims`), and every home's `placed` list;
 * - the chest by Oddi, which was "Thorkel's chest" before the rework, is the ship's silver in its
 *   strongbox now (decision DE-17): its actor is renamed wherever it lies;
 * - with the bow already owned, Thorkel's chest stands opened at its home by the shelter (the bow
 *   came from it); every door closed (none is saved, so each starts closed);
 * - the opening's facts that follow from what the save had done: Hild found and safe means she was
 *   reached and cut free and named the chest; the broch reached means she walked up; the lean-to is
 *   up (it was always drawn up before the rework); the searches open means the dusk and the first
 *   night's fire are past.
 */
type State = Record<string, unknown>;

const SHIP_SILVER = 'ITEM_SHIP_SILVER';
const THORKEL_CHEST = 'ITEM_THORKEL_CHEST';
/** Book 9 section 04: the chest's home by the shelter, in the machair zone's tiles. */
const CHEST_HOME = { zone: 'ZONE_SK_MACHAIR', x: 32.2, y: 31.4 };

function renameActor(
  actors: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (actors === undefined || !(THORKEL_CHEST in actors)) return actors;
  return Object.fromEntries(
    Object.entries(actors).map(([k, v]) => [k === THORKEL_CHEST ? SHIP_SILVER : k, v]),
  );
}

export function migrateOpening(state: State): State {
  const facts = { ...((state['facts'] ?? {}) as Record<string, unknown>) };
  const player = (state['player'] ?? {}) as { hotbar?: { slots?: (string | null)[] } };
  const bowOwned = player.hotbar?.slots?.includes('ITEM_BOW') === true;
  // The strongbox's actor, wherever it lies.
  let onFoot = state['onFoot'] as Record<string, unknown> | null | undefined;
  if (onFoot != null) {
    onFoot = structuredClone(onFoot);
    onFoot['actors'] = renameActor(onFoot['actors'] as Record<string, unknown>) ?? {};
    if (onFoot['carrying'] === THORKEL_CHEST) onFoot['carrying'] = SHIP_SILVER;
    const elsewhere = (onFoot['elsewhere'] ?? {}) as Record<string, Record<string, unknown>>;
    for (const rest of Object.values(elsewhere))
      rest['actors'] = renameActor(rest['actors'] as Record<string, unknown>) ?? {};
  }
  // The homes' placed lists, and Thorkel's chest at its home if the bow came from it.
  const homes = structuredClone((state['homes'] ?? {}) as Record<string, Record<string, unknown>>);
  for (const home of Object.values(homes)) home['placed'] ??= [];
  if (bowOwned && onFoot != null) {
    const chest = {
      x: CHEST_HOME.x * 24,
      y: CHEST_HOME.y * 24,
      facing: 'e',
      pose: 'idle',
    };
    if (onFoot['zone'] === CHEST_HOME.zone)
      (onFoot['actors'] as Record<string, unknown>)[THORKEL_CHEST] = chest;
    else {
      const elsewhere = (onFoot['elsewhere'] ??= {}) as Record<string, Record<string, unknown>>;
      const rest = (elsewhere[CHEST_HOME.zone] ??= { actors: {}, items: [], stuck: [] });
      (rest['actors'] as Record<string, unknown>)[THORKEL_CHEST] = chest;
    }
    const home = homes['ISLE_SKARV'];
    if (home !== undefined) (home['placed'] as string[]).push(THORKEL_CHEST);
    facts['ch1.chest_placed'] = true;
    facts['ch1.chest_home'] = true;
    facts['ch1.chest_opened'] = true;
    facts['ch1.key'] = 'BODY';
  }
  // The opening's facts that follow from what the save had done.
  facts['ch1.phase'] = 'PLAY';
  facts['ch1.woke_at'] ??= 0;
  if (facts['ch1.hild_safe'] === true) {
    facts['ch1.hild_reached'] = true;
    facts['ch1.net_free'] = true;
    facts['ch1.chest_named'] = true;
  }
  if (facts['ch1.at_broch'] === true) facts['ch1.hild_walked_up'] = true;
  facts['ch1.shelter_raised'] = true;
  if (facts['search.open'] === true) {
    facts['ch1.searches_placed'] = true;
    facts['ch1.dusk_over'] = true;
    facts['ch1.fire_scene'] = true;
  }
  const tick = typeof state['tick'] === 'number' ? state['tick'] : 0;
  return {
    ...state,
    facts,
    homes,
    ...(onFoot === undefined ? {} : { onFoot }),
    aims: { current: null, since: tick, hintsGiven: 0, reached: [] },
  };
}

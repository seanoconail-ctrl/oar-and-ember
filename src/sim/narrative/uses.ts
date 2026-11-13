/**
 * Everything the steerer can do with Interact in the zone in view, in one list (the user's fourth
 * playtest, decision DH-10). The simulation acts on this list when Interact is pressed, and the
 * play view names the nearest of the same list as its prompt, so a prompt is always shown for what
 * the key will do. Before DH-10 the view built its own list and left out the opening's uses
 * (Thorkel's key, his chest and the shelter's two stages): the shelter could be raised with the
 * key, but no prompt ever showed for it (the user: "the prompt to raise the shelter doesn't seem to
 * appear"; DH-4).
 */
import type { CampContext, PlacedUse } from '../home/camp.ts';
import { campUses } from '../home/camp.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import type { WorldState } from '../world.ts';
import { bodyRemarkUses } from './remarks.ts';
import type { RemarksContext } from './remarks.ts';
import { repairPlacedUses } from './repairs.ts';
import type { RepairsContext } from './repairs.ts';
import { searchPlacedUses } from './searches.ts';
import type { SearchContext } from './searches.ts';
import { wreckPlacedUses } from './wreck.ts';
import type { WreckContext } from './wreck.ts';

/** The contexts whose uses are offered (any may be absent in a test world). */
export interface UseSources {
  readonly camp?: CampContext | null;
  readonly wreck?: WreckContext | null;
  readonly searches?: SearchContext | null;
  readonly repairs?: RepairsContext | null;
  readonly remarks?: RemarksContext | null;
}

/**
 * The uses in the zone `map` now: the opening's first (they stand on tiles the camp's sites share),
 * then the camp's sites and people, the searches' words, the repairs and the rites, and last the
 * steerer's word over a body (DH-24).
 */
export function placedUsesHere(world: WorldState, src: UseSources, map: ZoneMap): PlacedUse[] {
  const onFoot = world.onFoot;
  if (onFoot === null) return [];
  const camp = src.camp ?? null;
  const uses = camp === null ? [] : campUses(world, camp, map, onFoot.actors);
  // Design addendum 2.4: Thorkel's key and chest, and the shelter's stages (before others on a tile).
  if (src.wreck != null) uses.unshift(...wreckPlacedUses(world, src.wreck, map, camp));
  // Stage 10: a search's words to open (Bran, Ketill, Runa, the stone).
  if (src.searches != null) uses.push(...searchPlacedUses(world, src.searches, map));
  // Stage 11: the boat, the wreck's rigging, the skiff's oar, the words at the cave and the bier.
  if (src.repairs != null) uses.push(...repairPlacedUses(world, src.repairs, map));
  // The user's fourth playtest: a word from the steerer over a body (DH-24).
  if (src.remarks != null) uses.push(...bodyRemarkUses(world, src.remarks, map));
  return uses;
}

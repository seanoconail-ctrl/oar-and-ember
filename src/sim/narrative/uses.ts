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
import { findPlacedUses } from './finds.ts';
import type { FindsContext } from './finds.ts';
import { bodyRemarkUses } from './remarks.ts';
import type { RemarksContext } from './remarks.ts';
import { campFire, raidPlacedUses } from './raid.ts';
import type { RaidContext } from './raid.ts';
import { repairPlacedUses } from './repairs.ts';
import type { RepairsContext } from './repairs.ts';
import { searchPlacedUses } from './searches.ts';
import type { SearchContext } from './searches.ts';
import { wreckPlacedUses } from './wreck.ts';
import type { WreckContext } from './wreck.ts';

/** The contexts whose uses are offered (any may be absent in a test world). */
export interface UseSources {
  readonly camp?: CampContext | null | undefined;
  readonly wreck?: WreckContext | null | undefined;
  readonly searches?: SearchContext | null | undefined;
  readonly repairs?: RepairsContext | null | undefined;
  readonly remarks?: RemarksContext | null | undefined;
  /** The small finds off the paths (the user's fourth playtest, DH-115). */
  readonly finds?: FindsContext | null | undefined;
  /** A reason for the first raid (DH-130 to DH-159): the skin boat, asking, the council's call. */
  readonly raid?: RaidContext | null;
}

/**
 * The uses in the zone `map` now: the opening's first (they stand on tiles the camp's sites share),
 * then the camp's sites and people, the searches' words, the steerer's word over a body (DH-24),
 * the repairs and the rites, and the small finds.
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
  // The user's fourth playtest: a word from the steerer over a body (DH-24), before the rites'
  // words at Thorkel's bier (those are Hild's to start now, DH-22, and come back at the bier once
  // his lines are said).
  if (src.remarks != null) uses.push(...bodyRemarkUses(world, src.remarks, map));
  // Stage 11: the boat, the wreck's rigging, the skiff's oar, the words at the cave and the bier.
  if (src.repairs != null) uses.push(...repairPlacedUses(world, src.repairs, map));
  // The user's fourth playtest: the small finds off the paths (DH-115).
  if (src.finds != null) uses.push(...findPlacedUses(world, src.finds, map));
  // A reason for the first raid: the skin boat, a beaten scavenger to ask, the council's call.
  if (src.raid != null) uses.push(...raidPlacedUses(world, src.raid, map, campFire(camp)));
  return uses;
}

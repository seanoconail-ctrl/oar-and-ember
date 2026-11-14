/**
 * Skarvholm's collectibles (Stage 14, decisions S14-16, S14-17 and S14-70; Book 1 section 11;
 * Book 2 section 10, `CollectibleDef`; Book 9 section 03, "Collectibles on Skarvholm"): shells,
 * carved stones, the hermit's psalter pages, the names of the dead and lore for each power. Interact
 * within reach looks (LOOK), takes (TAKE) or, for the drowned, talks (TALK); the collectible is kept
 * in `RegionState.collected` in the order found, its sound plays and its information caption shows
 * (the FIND_MADE event the Chapter 1 finds use), and the journal's Finds page shows its words.
 *
 * A collectible is there only under its conditions (the tide, a puzzle's state, the drowned's
 * turn); a taken one leaves its taken frame; none adds collision. The three Chapter 1 finds that
 * count (the cowries, the machair's carved stone, the kerbstone) stay finds (src/sim/narrative/
 * finds.ts) and are counted here once found. Pure and deterministic.
 */
import type { CollectibleDef, CollectibleKind } from '../../content/islandSchema.ts';
import type { Id } from '../../core/ids.ts';
import type { FindEvent } from '../narrative/finds.ts';
import { findFact } from '../narrative/finds.ts';
import type { WorldState } from '../world.ts';
import { collectedList, drownedDue, holds, regionOf } from './islandConditions.ts';
import type { IslandContext } from './islandConditions.ts';
import { speakDrowned, thorkelHere } from './puzzles.ts';
import type { PuzzleEmit } from './puzzles.ts';

export function collectible(
  ctx: Pick<IslandContext, 'collectibles'>,
  key: string,
): CollectibleDef | undefined {
  return ctx.collectibles.find((c) => c.key === key);
}

/** Whether it is there now (its conditions) and not yet taken or spoken with. */
export function collectibleHere(world: WorldState, ctx: IslandContext, c: CollectibleDef): boolean {
  if (c.find !== undefined) return false;
  if (c.use !== 'LOOK' && collectedList(world, ctx).includes(c.key)) return false;
  return (c.conditions ?? []).every((x) => holds(world, ctx, x));
}

/** Records a collectible found, once, in order. Returns whether it was the first time. */
function record(world: WorldState, ctx: IslandContext, key: string): boolean {
  const region = regionOf(world, ctx);
  const list = (region.collected ??= []);
  if (list.includes(key)) return false;
  list.push(key);
  return true;
}

/**
 * Interact with a collectible: its words, its sound and caption, and (the first time) its place in
 * the journal. TALK speaks with the drowned whose turn it is. Returns false if it is not there.
 */
export function collect(
  world: WorldState,
  ctx: IslandContext,
  key: string,
  emit: (e: FindEvent) => void,
  speak: PuzzleEmit,
): boolean {
  const c = collectible(ctx, key);
  if (c === undefined || !collectibleHere(world, ctx, c)) return false;
  if (c.use === 'TALK') {
    const who = drownedDue(world, ctx);
    if (who === null || !speakDrowned(world, ctx, who, speak)) return false;
  }
  const first = record(world, ctx, c.key);
  emit({
    type: 'FIND_MADE',
    key: c.key,
    sound: c.sound,
    captionKey: c.captionKey,
    first,
    food: 0,
    silver: 0,
    collectible: first ? 1 : 0,
    x: c.pos.x,
    y: c.pos.y,
  });
  return true;
}

/** The Chapter 1 finds that count as collectibles, recorded once they have been found. */
export function syncFinds(world: WorldState, ctx: IslandContext): void {
  for (const c of ctx.collectibles)
    if (c.find !== undefined && world.facts[findFact(c.find)] === true) record(world, ctx, c.key);
}

/** The collectibles of a scene drawn now (tiles, at the foot): each in its frame, once a place. */
export function collectibleProps(
  world: WorldState,
  ctx: IslandContext,
  zone: Id,
): { sheet: string; frame: string; x: number; y: number }[] {
  const out: { sheet: string; frame: string; x: number; y: number }[] = [];
  const taken = collectedList(world, ctx);
  const seen = new Set<string>();
  for (const c of ctx.collectibles) {
    // Drawn by its scene's plan (the cross on the cell's slab, the cup-and-ring stone): not again.
    if (c.scene !== zone || c.find !== undefined || c.sheet !== 'prop_collectibles') continue;
    const at = `${c.pos.x},${c.pos.y}`;
    if (seen.has(at)) continue;
    let frame: string | undefined;
    if (c.use === 'TALK') {
      // The drowned's place: wet rock while one of them stands there.
      if (drownedDue(world, ctx) !== null || thorkelHere(world, ctx)) frame = c.frame;
    } else if (c.use === 'TAKE' && taken.includes(c.key)) frame = c.takenFrame;
    else if ((c.conditions ?? []).every((x) => holds(world, ctx, x))) frame = c.frame;
    if (frame === undefined) continue;
    seen.add(at);
    out.push({ sheet: c.sheet, frame, x: c.pos.x, y: c.pos.y });
  }
  return out;
}

/** How many of each kind have been found, against Book 10's counts on Skarvholm. */
export function collectedCounts(
  world: WorldState,
  ctx: IslandContext,
): { kind: CollectibleKind; found: number; total: number; keys: string[] }[] {
  const n = ctx.ib.counts;
  const totals: Record<CollectibleKind, number> = {
    SHELL: n.shells,
    CARVED_STONE: n.carvedStones,
    PSALTER_PAGE: n.psalterPages,
    NAME_OF_THE_DEAD: n.namesOfTheDead,
    SONG: n.songs,
    LORE: n.lore,
  };
  const list = collectedList(world, ctx);
  return (Object.keys(totals) as CollectibleKind[]).map((kind) => {
    const keys = list.filter((k) => collectible(ctx, k)?.kind === kind);
    return { kind, found: keys.length, total: totals[kind], keys };
  });
}

/**
 * Chapter 1's small finds off the paths (the user's fourth playtest, request 24; decisions DH-115
 * to DH-121; Book 9 section 03, "Chapter 1 finds"; Book 10 section 20): each is a camp use in its
 * zone (Interact within reach, the prompt "Look at" or "Take"), and using one plays its sound,
 * shows its caption and gives what Book 10 says. What has been found is world state as facts
 * (`find.<key>`), so it saves and loads with no change to the state's shape. Pure and deterministic.
 */
import type { FindDef, FindsDef } from '../../content/findsSchema.ts';
import { parseFindsBalance } from '../../content/findsBalance.ts';
import type { FindReward } from '../../content/findsBalance.ts';
import { seasonOf } from '../calendar/calendar.ts';
import type { PlacedUse } from '../home/camp.ts';
import type { ZoneMap } from '../land/zoneMap.ts';
import type { WorldState } from '../world.ts';

export interface FindsContext {
  readonly def: FindsDef;
  readonly rewards: ReadonlyMap<string, FindReward>;
}

export function findsContext(def: FindsDef, balance: unknown): FindsContext {
  const rewards = parseFindsBalance(balance);
  for (const f of def.finds)
    if (!rewards.has(f.balanceKey))
      throw new Error(
        `content/finds.json: ${f.key} names Book 10 row "${f.balanceKey}", not there`,
      );
  return { def, rewards };
}

export interface FindEvent {
  readonly type: 'FIND_MADE';
  readonly key: string;
  /** Its sound event (content/audio.json) and caption string. */
  readonly sound: string;
  readonly captionKey: string;
  /** Whether this was the first time (a reward is given only then). */
  readonly first: boolean;
  /** What it gave: ration-days of food, ounces of silver, collectibles (0 for a story). */
  readonly food: number;
  readonly silver: number;
  readonly collectible: number;
  readonly x: number;
  readonly y: number;
}

/** The fact a find sets once found. */
export const findFact = (key: string): string => `find.${key}`;

export function found(world: WorldState, key: string): boolean {
  return world.facts[findFact(key)] === true;
}

/** How many collectibles the steerer has found (shells and the like, Book 1 section 11). */
export function collectiblesFound(world: WorldState, ctx: FindsContext): number {
  let n = 0;
  for (const f of ctx.def.finds) {
    const r = ctx.rewards.get(f.balanceKey);
    if (r?.kind === 'COLLECTIBLE' && found(world, f.key)) n += r.count;
  }
  return n;
}

/** The finds of a zone. */
export function findsIn(ctx: FindsContext, zone: string): FindDef[] {
  return ctx.def.finds.filter((f) => f.zone === zone);
}

/** The frame a find is drawn with now (a TAKE's taken frame once taken). */
export function findFrame(world: WorldState, f: FindDef): string {
  return f.kind === 'TAKE' && found(world, f.key) ? (f.takenFrame ?? f.frame) : f.frame;
}

/** The finds that can be used here now: a READ always, a TAKE until taken. */
export function findPlacedUses(world: WorldState, ctx: FindsContext, map: ZoneMap): PlacedUse[] {
  if (world.onFoot === null || world.onFoot.carrying !== null || world.talk !== null) return [];
  const out: PlacedUse[] = [];
  for (const f of findsIn(ctx, map.zone)) {
    if (f.kind === 'TAKE' && found(world, f.key)) continue;
    out.push({
      use: { kind: 'FIND', site: f.key, take: f.kind === 'TAKE', nameKey: f.nameKey },
      x: f.x * map.tile,
      y: f.y * map.tile,
    });
  }
  return out;
}

/** Uses a find: the first time, its reward; every time, its sound and caption. */
export function useFind(
  world: WorldState,
  ctx: FindsContext,
  key: string,
  emit: (e: FindEvent) => void,
): void {
  const f = ctx.def.finds.find((x) => x.key === key);
  if (f === undefined) return;
  if (f.kind === 'TAKE' && found(world, key)) return;
  const first = !found(world, key);
  world.facts[findFact(key)] = true;
  let food = 0;
  let silver = 0;
  let collectible = 0;
  const reward = ctx.rewards.get(f.balanceKey);
  const home = world.homes['ISLE_SKARV'];
  if (first && reward !== undefined && home !== undefined) {
    switch (reward.kind) {
      case 'FOOD':
        // Eggs only in their seasons; out of them the nest is empty (Book 10 "Chapter 1 finds").
        if (reward.seasons.includes(seasonOf(world.calendar.day))) {
          home.fresh.push({ rd: reward.rd, day: world.calendar.day });
          food = reward.rd;
        }
        break;
      case 'SILVER':
        home.stores['RES_SILVER'] = (home.stores['RES_SILVER'] ?? 0) + reward.oz;
        silver = reward.oz;
        break;
      case 'COLLECTIBLE':
        collectible = reward.count;
        break;
      case 'STORY':
        break;
    }
  }
  emit({
    type: 'FIND_MADE',
    key,
    sound: f.sound,
    captionKey: f.captionKey,
    first,
    food,
    silver,
    collectible,
    x: f.x,
    y: f.y,
  });
}

/** The finds drawn in a zone (tiles, at the foot): each in its frame now (Book 7 section 15). */
export function findProps(
  world: WorldState,
  ctx: FindsContext,
  zone: string,
): { sheet: string; frame: string; x: number; y: number }[] {
  return findsIn(ctx, zone).map((f) => ({
    sheet: ctx.def.sheet,
    frame: findFrame(world, f),
    x: f.x,
    y: f.y,
  }));
}

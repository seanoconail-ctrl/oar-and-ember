/**
 * Skarvholm's puzzles and secrets (Stage 14; Book 2 section 10, `PuzzleDef`; Book 9 sections 03,
 * 09 and 16; Book 10 section 20; decisions S14-8 to S14-12, S14-18, S14-22, S14-26 and S14-74 to
 * S14-82), from `content/puzzles.json`. Each puzzle is a state machine over world conditions (tide,
 * time, season, objects moved, things found, words spoken) with at least one in-world hint and a
 * solved fact; none slides tiles. Its state is `RegionState.puzzles`; its solved fact a world fact.
 *
 * Besides the machines, here: the places Interact looks at or takes something that is not a
 * collectible (the bog's cauldron, the cairn's Door of Three Truths, the Cup and the grave goods),
 * the drowned on the Skerry (one each spring tides, in Book 9's order), the Grey Men's foggy
 * feast morning, the deep passage's warning sounds, and the hill-folk's turning (S14-9).
 *
 * Pure and deterministic: no random stream is drawn.
 */
import type { IslandEffect, PuzzleUse } from '../../content/islandSchema.ts';
import type { Id } from '../../core/ids.ts';
import { appendDeed } from '../ledger/ledger.ts';
import type { WorldState } from '../world.ts';
import {
  drownedDue,
  holds,
  passageWater,
  puzzleState,
  regionOf,
  springTidesOf,
} from './islandConditions.ts';
import type { IslandContext, PassageState } from './islandConditions.ts';
import { tideAt } from '../calendar/calendar.ts';

export type PuzzleEvent =
  | {
      readonly type: 'PUZZLE_STATE';
      readonly puzzle: Id;
      readonly from: string;
      readonly to: string;
    }
  | { readonly type: 'PUZZLE_SOLVED'; readonly puzzle: Id; readonly fact: string }
  /** An information line (its string key) and the sound event played with it, if any. */
  | { readonly type: 'ISLAND_INFO'; readonly key: string; readonly sound?: string }
  /** A line spoken by someone who is not a person of the household (the drowned). */
  | {
      readonly type: 'ISLAND_SPOKE';
      readonly speakerKey: string;
      readonly lineKey: string;
      readonly order: number;
    }
  /** A resident's line (as aims' PERSON_SPOKE). */
  | {
      readonly type: 'PERSON_SPOKE';
      readonly person: Id;
      readonly lineKey: string;
      readonly bark?: string;
    }
  | { readonly type: 'TURNED_OUT'; readonly zone: Id; readonly x: number; readonly y: number };

export type PuzzleEmit = (e: PuzzleEvent) => void;

/** Applies a transition's or a use's effects. */
export function applyEffects(
  world: WorldState,
  effects: readonly IslandEffect[],
  emit: PuzzleEmit,
  place: Id,
): void {
  let info: string | null = null;
  let sound: string | undefined;
  for (const e of effects) {
    if ('set' in e) world.facts[e.set] = e.value ?? true;
    else if ('info' in e) info = e.info;
    else if ('sound' in e) sound = e.sound;
    else if ('item' in e)
      world.player.inventory[e.item] = (world.player.inventory[e.item] ?? 0) + 1;
    else if ('deed' in e)
      appendDeed(world, {
        id: `DEED_${world.ledger.length + 1}`,
        tag: e.deed,
        day: world.calendar.day,
        placeId: place,
        doer: 'HOUSEHOLD',
        context: {},
        victims: [],
        witnesses: [],
        identification: 0,
        marksSeen: [],
      });
  }
  if (info !== null)
    emit({ type: 'ISLAND_INFO', key: info, ...(sound === undefined ? {} : { sound }) });
}

/** Runs each puzzle's transitions that hold now, one step each tick; solved facts once. */
export function stepPuzzles(world: WorldState, ctx: IslandContext, emit: PuzzleEmit): void {
  const region = regionOf(world, ctx);
  for (const p of ctx.puzzles.puzzles) {
    const now = puzzleState(world, ctx, p.id);
    const t = p.transitions.find(
      (x) => x.from === now && x.when.every((c) => holds(world, ctx, c)),
    );
    if (t === undefined) continue;
    region.puzzles[p.id] = t.to;
    emit({ type: 'PUZZLE_STATE', puzzle: p.id, from: t.from, to: t.to });
    applyEffects(world, t.effects, emit, world.onFoot?.zone ?? ctx.region);
    if (world.facts[p.solvedFact] === true && world.facts[`solved.${p.id}`] !== true) {
      world.facts[`solved.${p.id}`] = true;
      emit({ type: 'PUZZLE_SOLVED', puzzle: p.id, fact: p.solvedFact });
    }
  }
}

/** The puzzle uses that can be used now in a scene (their conditions hold). */
export function puzzleUsesIn(world: WorldState, ctx: IslandContext, zone: Id): PuzzleUse[] {
  return ctx.puzzles.uses.filter(
    (u) => u.scene === zone && u.when.every((c) => holds(world, ctx, c)),
  );
}

/** Uses a puzzle place: its effects (a fact, its information line and sound, a deed, an item). */
export function usePuzzle(
  world: WorldState,
  ctx: IslandContext,
  key: string,
  emit: PuzzleEmit,
): boolean {
  const u = ctx.puzzles.uses.find((x) => x.key === key);
  if (!u?.when.every((c) => holds(world, ctx, c))) return false;
  applyEffects(world, u.effects, emit, u.scene);
  if (u.verb === 'TAKE') world.facts[`use.${u.key}`] = true;
  return true;
}

/** The puzzle places drawn in a scene (tiles, at the foot). */
export function puzzleProps(
  world: WorldState,
  ctx: IslandContext,
  zone: Id,
): { frame: string; x: number; y: number }[] {
  const out: { frame: string; x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const u of ctx.puzzles.uses) {
    if (u.scene !== zone || u.frame === undefined) continue;
    const at = `${u.x},${u.y}`;
    if (seen.has(at)) continue;
    const live = u.when.every((c) => holds(world, ctx, c));
    const done = world.facts[`use.${u.key}`] === true;
    const frame = done ? u.frameAfter : live ? u.frame : undefined;
    if (frame === undefined) continue;
    seen.add(at);
    out.push({ frame, x: u.x, y: u.y });
  }
  return out;
}

// ---------------------------------------------------------------------------- the drowned

/** The drowned's two lines, spoken: the first as "Drowned", the second by name (Book 8). */
export function speakDrowned(
  world: WorldState,
  ctx: IslandContext,
  key: string,
  emit: PuzzleEmit,
): boolean {
  if (drownedDue(world, ctx) !== key) return false;
  const d = ctx.puzzles.drowned;
  const who = d.order.find((x) => x.key === key);
  if (who === undefined) return false;
  const period = springTidesOf(world.calendar.day, ctx.b) ?? '';
  const inPeriod =
    world.facts['skerry.drowned.period'] === period
      ? Number(world.facts['skerry.drowned.inPeriod'] ?? 0)
      : 0;
  world.facts['skerry.drowned.period'] = period;
  world.facts['skerry.drowned.inPeriod'] = inPeriod + 1;
  world.facts['skerry.drowned.count'] = Number(world.facts['skerry.drowned.count'] ?? 0) + 1;
  world.facts[`skerry.drowned.${key}`] = world.calendar.day;
  world.facts['skerry.drowned.met'] = true;
  who.lines.forEach((lineKey, i) => {
    emit({
      type: 'ISLAND_SPOKE',
      speakerKey: i === 0 ? d.unmetKey : who.shortKey,
      lineKey,
      order: i,
    });
  });
  return true;
}

/** Whether Thorkel stands among the drowned now (his rites never given; after the launch). */
export function thorkelHere(world: WorldState, ctx: IslandContext): boolean {
  const t = ctx.puzzles.drowned.thorkel;
  return (
    world.facts['skerry.thorkel.spoken'] !== true &&
    holds(world, ctx, { tide: 'SPRING_LOW' }) &&
    t.requires.every((c) => holds(world, ctx, c))
  );
}

export function speakThorkel(world: WorldState, ctx: IslandContext, emit: PuzzleEmit): boolean {
  if (!thorkelHere(world, ctx)) return false;
  const t = ctx.puzzles.drowned.thorkel;
  world.facts['skerry.thorkel.spoken'] = world.calendar.day;
  t.lines.forEach((lineKey, i) => {
    emit({ type: 'ISLAND_SPOKE', speakerKey: t.shortKey, lineKey, order: i });
  });
  return true;
}

// ---------------------------------------------------------------------------- the passage and the door

/**
 * The deep passage's warnings (Book 9 section 16, signs; Book 8 section 07): as the window closes
 * the passage grows loud, and as the pool rises, water rising; told once each, to whoever is in
 * the passage or the cave's chamber.
 */
export function stepPassage(world: WorldState, ctx: IslandContext, emit: PuzzleEmit): void {
  const zone = world.onFoot?.zone;
  const p = ctx.puzzles.passage;
  const water = passageWater(world.calendar, ctx.b, ctx.ib);
  const was = (world.facts['passage.state'] as PassageState | undefined) ?? 'CLOSED';
  if (was !== water.state) world.facts['passage.state'] = water.state;
  if (zone !== p.zone && zone !== p.from) return;
  // The turn itself (decision S14-115): as the spring tide turns at low water, the passage grows
  // loud, once each spring low, for whoever is in it or the chamber: the caption, and the event
  // PASSAGE_LOUD that names the passage's roar (AMB_PASSAGE_ROAR), whose ambience rises from it.
  const tide = tideAt(world.calendar, ctx.b);
  const turned =
    water.state === 'OPEN' && tide.minutesSinceLowWater < tide.minutesToLowWater;
  // Which low water: the day and the hour it fell at.
  const lowAt = (world.calendar.minuteOfDay - tide.minutesSinceLowWater + 1440) % 1440;
  const turnKey = `${world.calendar.day}:${String(Math.round(lowAt / 60))}`;
  if (turned && world.facts['passage.loud'] !== turnKey && p.loudKey !== undefined) {
    world.facts['passage.loud'] = turnKey;
    emit({ type: 'ISLAND_INFO', key: p.loudKey, sound: 'PASSAGE_LOUD' });
  }
  const rising = water.state === 'FLOODING' && water.pool !== 'KNEE';
  if (rising && world.facts['passage.rising'] !== world.calendar.day && zone === p.zone) {
    world.facts['passage.rising'] = world.calendar.day;
    emit({ type: 'ISLAND_INFO', key: p.risingKey });
  }
}

/**
 * A foggy feast morning at the cairn's door (Book 9 section 03, "Fair to the player"): the door's
 * spiral stays unlit, and the nearest resident says the sun did not come, once that morning.
 */
export function stepFoggyFeast(
  world: WorldState,
  ctx: IslandContext,
  nearestResident: (ids: readonly Id[]) => Id | null,
  emit: PuzzleEmit,
): void {
  if (world.facts['cairn.door.open'] === true) return;
  if (!holds(world, ctx, { festivalDawn: true }) || !holds(world, ctx, { weather: 'FOG' })) return;
  if (!holds(world, ctx, { atDoor: true })) return;
  const key = `greymen.fog.${world.calendar.day}`;
  if (world.facts[key] === true) return;
  const lines = ctx.puzzles.alignment.fogLines;
  const who = nearestResident(Object.keys(lines));
  if (who === null) return;
  world.facts[key] = true;
  const line = lines[who];
  if (line !== undefined) emit({ type: 'PERSON_SPOKE', person: who, lineKey: line });
}

/**
 * The hill-folk's turning (decision S14-9): whoever wakes, from sleep or a collapse, on the cairn
 * side of the deep passage's lowest point once it has gone deep, wakes on the cairn mound outside.
 * Returns where to put them, or null. The caller moves them (leaving any load where they slept),
 * adds the Cold reason and lets the first resident met speak (Book 8 section 07).
 */
export function turningWake(
  world: WorldState,
  ctx: IslandContext,
): { zone: Id; x: number; y: number; facing: 'n' | 's' | 'e' | 'w' } | null {
  const onFoot = world.onFoot;
  if (onFoot === null) return null;
  const t = ctx.puzzles.turning;
  const tile = ctx.maps.get(onFoot.zone)?.tile ?? 24;
  const tx = onFoot.player.x / tile;
  const ty = onFoot.player.y / tile;
  const cut = t.cutOff.some(
    (r) => r.zone === onFoot.zone && tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h,
  );
  // Still open (the passage open at the waking hour): the way back is there, nobody is put out.
  if (!cut || passageWater(world.calendar, ctx.b, ctx.ib).state === 'OPEN') return null;
  return { ...t.wake };
}

/** The line the first resident met says after the turning (Runa's, else Hild's). */
export function turnedOutLine(
  ctx: IslandContext,
  residents: readonly Id[],
): { person: Id; lineKey: string } | null {
  for (const [person, lineKey] of Object.entries(ctx.puzzles.turning.lines))
    if (residents.includes(person)) return { person, lineKey };
  return null;
}

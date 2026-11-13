/**
 * The household's deeds as its own people see them (Book 2 sections 06 and 15; Book 10 section
 * 08): a deed goes into the ledger, and every resident who saw it remembers it and moves their
 * friendship and fear by their culture, values and traits.
 */
import type { Id } from '../../core/ids.ts';
import { appendDeed } from '../ledger/ledger.ts';
import type { WorldState } from '../world.ts';
import type { PeopleContext } from './context.ts';
import { checkFeelings } from './day.ts';
import type { Emit } from './day.ts';
import { clampMeasures, effectsOf, friendshipDelta } from './measures.ts';
import type { DeedReading } from './measures.ts';

/** Records a household deed and its witnesses' judgement of it. Returns the deed's ID. */
export function householdDeed(
  world: WorldState,
  ctx: PeopleContext,
  deed: DeedReading & {
    readonly placeId: Id;
    readonly victims?: readonly Id[];
    /** What the deed's context records (SPARED's `how`, decision DG-5). */
    readonly context?: Readonly<Record<string, string>>;
  },
  witnesses: readonly Id[],
  emit: Emit,
): Id {
  const id = `DEED_${world.ledger.length + 1}`;
  appendDeed(world, {
    id,
    tag: deed.tag,
    day: world.calendar.day,
    placeId: deed.placeId,
    doer: 'HOUSEHOLD',
    context: { ...(deed.context ?? {}) },
    victims: [...(deed.victims ?? [])],
    witnesses: witnesses.map((person) => ({ person, escaped: false })),
    identification: 1,
    marksSeen: [],
  });
  for (const w of witnesses) {
    const p = world.people[w];
    if (p === undefined) continue;
    p.memories.push({
      day: world.calendar.day,
      kind: 'DEED',
      about: deed.tag,
      source: 'SAW',
      deedId: id,
    });
    p.friendship += friendshipDelta(ctx.b, p, deed, 'present', effectsOf(ctx.b, p).devotion);
    clampMeasures(p);
    checkFeelings(world, ctx, p, emit);
  }
  return id;
}

/** Tending a wound is care (Book 10 "Friendship from care and time"), and remembered. */
export function tended(world: WorldState, ctx: PeopleContext, id: Id, emit: Emit): void {
  const p = world.people[id];
  if (p === undefined) return;
  p.friendship += ctx.b.care.tending;
  clampMeasures(p);
  p.memories.push({ day: world.calendar.day, kind: 'CARE', about: 'TENDED', source: 'SAW' });
  checkFeelings(world, ctx, p, emit);
}

/** An event the residents at home remember (the first fire, the shelter raised, the first fish). */
export function remember(world: WorldState, ids: readonly Id[], about: string): void {
  for (const id of ids) {
    const p = world.people[id];
    if (p === undefined || p.memories.some((m) => m.kind === 'EVENT' && m.about === about))
      continue;
    p.memories.push({ day: world.calendar.day, kind: 'EVENT', about, source: 'SAW' });
  }
}

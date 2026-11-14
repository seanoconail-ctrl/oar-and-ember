/**
 * Encounters and the governor (Book 2 section 09; Book 10 section 02, "Encounters", "Exposure" and
 * "Encounter weights"; decision S13-3). Each leg is offered to the governor once, as it starts: the
 * eventful credit (+ eventfulShare a leg, - 1 an eventful leg) times the exposure's factor is the
 * chance the leg is eventful, so over many legs two are quiet for each eventful one. The entry is
 * drawn by weight from the edge's table, filtered by edge, season, chapter, wind, visibility,
 * facts and the ledger. A story entry placed on an edge (the wreck) comes first when it applies,
 * counted the same way. Supernatural entries come only by the supernatural credit (+ 1 /
 * supernaturalEvery a voyage, - 1 each), about once in three or four voyages. Draws are on the
 * `encounters` stream.
 */
import { nextFloat } from '../../core/rng.ts';
import type { RngState } from '../../core/rng.ts';
import type { Id } from '../../core/ids.ts';
import type { Season } from '../../content/balance.ts';
import type { SeaBalance } from '../../content/seaBalance.ts';
import type { FactValue } from '../world.ts';
import type { EncounterEntry, SeaEdge } from './context.ts';
import type { EncounterRef, SeaGovernor, Visibility, WindStrength } from './types.ts';

/** What an entry's needs are tested against. */
export interface EncounterWhen {
  readonly season: Season;
  readonly chapter: Id | null;
  readonly strength: WindStrength;
  readonly visibility: Visibility;
  readonly facts: Readonly<Record<string, FactValue>>;
  /** Deed tags in the ledger. */
  readonly deeds: ReadonlySet<string>;
  /** Encounters that happen once and have happened (table:key). */
  readonly once: Readonly<Record<string, number>>;
}

export const onceKey = (table: Id, key: string): string => `${table}:${key}`;

const set = (v: FactValue | undefined): boolean => v !== undefined && v !== false;

/** Whether an entry applies on this edge now. */
export function applies(entry: EncounterEntry, table: Id, edge: Id, when: EncounterWhen): boolean {
  if (entry.weight <= 0) return false;
  if (entry.oneShot === true && when.once[onceKey(table, entry.key)] !== undefined) return false;
  if (entry.edges !== undefined && !entry.edges.includes(edge)) return false;
  if (entry.seasons !== undefined && !entry.seasons.includes(when.season)) return false;
  if (entry.chapters !== undefined && (when.chapter === null || !entry.chapters.includes(when.chapter)))
    return false;
  if (entry.minStrength !== undefined && when.strength < entry.minStrength) return false;
  if (entry.visibility !== undefined && !entry.visibility.includes(when.visibility)) return false;
  if ((entry.needsFacts ?? []).some((f) => !set(when.facts[f]))) return false;
  if ((entry.withoutFacts ?? []).some((f) => set(when.facts[f]))) return false;
  if ((entry.ledgerHas ?? []).some((t) => !when.deeds.has(t))) return false;
  if ((entry.ledgerLacks ?? []).some((t) => when.deeds.has(t))) return false;
  return true;
}

function pickWeighted(rng: RngState, entries: readonly EncounterEntry[]): EncounterEntry | null {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return null;
  let at = nextFloat(rng) * total;
  for (const e of entries) {
    at -= e.weight;
    if (at < 0) return e;
  }
  return entries[entries.length - 1] ?? null;
}

function refOf(table: Id, e: EncounterEntry): EncounterRef {
  return {
    table,
    key: e.key,
    textKey: e.textKey,
    supernatural: e.supernatural === true,
    story: e.story === true,
    scene: e.scene === undefined ? null : { kind: e.scene.kind, scenario: e.scene.scenario },
  };
}

/** A new voyage (a course set and sailed): the supernatural credit grows. */
export function governorVoyage(g: SeaGovernor, b: SeaBalance): void {
  g.voyages++;
  g.superCredit += 1 / b.governor.supernaturalEvery;
}

/**
 * Offers a leg to the governor: the encounter it holds, or null for a quiet leg. Always draws
 * once for the leg (and once more for an entry), so a leg's draws depend only on the state.
 */
export function offerLeg(
  g: SeaGovernor,
  rng: RngState,
  b: SeaBalance,
  edge: Pick<SeaEdge, 'id' | 'exposure' | 'encounterTable'>,
  entries: readonly EncounterEntry[],
  when: EncounterWhen,
): EncounterRef | null {
  g.legs++;
  g.credit += b.governor.eventfulShare;
  const table = edge.encounterTable;
  const ok = entries.filter((e) => applies(e, table, edge.id, when));
  const story = ok.find((e) => e.story === true && e.supernatural !== true);
  const roll = nextFloat(rng);
  if (story !== undefined) {
    g.eventful++;
    g.credit -= 1;
    return refOf(table, story);
  }
  const chance = Math.min(1, Math.max(0, g.credit * (b.governor.exposureFactor[edge.exposure] ?? 1)));
  if (roll >= chance) return null;
  const supers = ok.filter((e) => e.supernatural === true);
  const plain = ok.filter((e) => e.supernatural !== true && e.story !== true);
  let pick: EncounterEntry | null = null;
  if (g.superCredit >= 1 && supers.length > 0) {
    pick = pickWeighted(rng, supers);
    if (pick !== null) {
      g.superCredit -= 1;
      g.supernatural++;
    }
  }
  pick ??= pickWeighted(rng, plain);
  if (pick === null) return null;
  g.eventful++;
  g.credit -= 1;
  return refOf(table, pick);
}

/** The share of eventful legs so far (0 before any). */
export function eventfulShare(g: SeaGovernor): number {
  return g.legs === 0 ? 0 : g.eventful / g.legs;
}

/**
 * The combat part of world state version 13 (the user's third playtest; decision DG-23; Book 2
 * section 05): what the campaign has taught (`player.teaching`) and the spared (`spared`). An older
 * save's fights count as Book 10's promptFights already had (three), so no combat prompt comes back
 * in the middle of a campaign; nothing else has been taught; no one spared before has a record or a
 * fate (their SPARED deeds stay in the ledger as they were).
 */
import { freshTeaching } from '../sim/world.ts';

/** The fights an older save is counted as having had (Book 10 promptFights; decision DG-23). */
export const MIGRATED_FIGHTS = 3;

export function migrateCombat13(state: Record<string, unknown>): Record<string, unknown> {
  const player = (state['player'] ?? {}) as Record<string, unknown>;
  return {
    ...state,
    player: { ...player, teaching: player['teaching'] ?? freshTeaching(MIGRATED_FIGHTS) },
    spared: state['spared'] ?? [],
  };
}

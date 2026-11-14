/**
 * Which save a simulation event calls for (Book 2 section 20; decision DE-12): a labelled
 * checkpoint before each set-piece fight (an encounter with a checkpoint in content, the
 * scavengers at dusk among them), an autosave on reaching camp the first time in a day, and on
 * waking. The interface writes it between ticks.
 */
import type { AutosaveReason } from './save.ts';

export type SaveCall =
  | { readonly kind: 'checkpoint'; readonly label: string }
  | { readonly kind: 'autosave'; readonly reason: AutosaveReason };

export function saveFor(e: { readonly type: string } & Record<string, unknown>): SaveCall | null {
  switch (e.type) {
    case 'ENCOUNTER_STARTED':
      return typeof e['checkpoint'] === 'string'
        ? { kind: 'checkpoint', label: e['checkpoint'] }
        : null;
    case 'CAMP_REACHED':
      return { kind: 'autosave', reason: 'CAMP' };
    case 'WOKE':
      return { kind: 'autosave', reason: 'WAKING' };
    default:
      return null;
  }
}

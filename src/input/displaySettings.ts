/**
 * Display settings (Book 2 section 21: reduced shake and flashes). Reduced motion turns off camera
 * shake and lightning flashes, calms the sway of plants and halves the blown sand and midges; the
 * world still moves (water, wind and life), only more gently. It starts from the system's
 * "reduce motion" preference, a `?motion=reduced` (or `?motion=full`) address overrides it, and
 * the choice made in the system menu is remembered.
 */
import type { KeyValueStore } from './settingsStore.ts';

export const DISPLAY_KEY = 'oar-and-ember:display';

export interface DisplaySettings {
  readonly reducedMotion: boolean;
}

export function parseDisplaySettings(text: string | null, systemPrefers: boolean): DisplaySettings {
  if (text !== null) {
    try {
      const raw = JSON.parse(text) as { reducedMotion?: unknown } | null;
      if (typeof raw?.reducedMotion === 'boolean') return { reducedMotion: raw.reducedMotion };
    } catch {
      // A damaged setting falls back to the system preference.
    }
  }
  return { reducedMotion: systemPrefers };
}

/** The setting in force: the address first, then the saved choice, then the system preference. */
export function resolveDisplaySettings(
  store: KeyValueStore,
  query: string,
  systemPrefers: boolean,
): DisplaySettings {
  const motion = new URLSearchParams(query).get('motion');
  if (motion === 'reduced') return { reducedMotion: true };
  if (motion === 'full') return { reducedMotion: false };
  try {
    return parseDisplaySettings(store.getItem(DISPLAY_KEY), systemPrefers);
  } catch {
    return { reducedMotion: systemPrefers };
  }
}

export function saveDisplaySettings(store: KeyValueStore, settings: DisplaySettings): boolean {
  try {
    store.setItem(DISPLAY_KEY, JSON.stringify({ version: 1, ...settings }));
    return true;
  } catch {
    return false;
  }
}

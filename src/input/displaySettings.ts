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
  /** Information captions (sounds, directions) shown, apart from speech subtitles (addendum 2.3). */
  readonly infoCaptions: boolean;
  /**
   * The gore setting (Book 7 section 12; Stage 9): 2 full, 1 low (no dismemberment, fewer and
   * darker decals, corpses fade after a minute), 0 off (no blood, hit flashes only, corpses fade).
   * Presentation only: the simulation never reads it.
   */
  readonly gore: 0 | 1 | 2;
  /**
   * Combat v2 (Book 10 marks, decision DE-9): the "?" and "!" over a suspicious or alerted enemy;
   * off by default since design addendum 2.5 (decision DF-9: awareness shows by barks and body
   * language), `?marks=on` turns them on. A choice saved before 2.5 (setting version 1, when
   * every save carried the old default) is not kept.
   */
  readonly marks: boolean;
}

const GORE_WORDS: Readonly<Record<string, 0 | 1 | 2>> = { off: 0, low: 1, full: 2 };

export function parseDisplaySettings(text: string | null, systemPrefers: boolean): DisplaySettings {
  if (text !== null) {
    try {
      const raw = JSON.parse(text) as {
        reducedMotion?: unknown;
        infoCaptions?: unknown;
        gore?: unknown;
        marks?: unknown;
        version?: unknown;
      } | null;
      if (typeof raw?.reducedMotion === 'boolean')
        return {
          reducedMotion: raw.reducedMotion,
          infoCaptions: typeof raw.infoCaptions === 'boolean' ? raw.infoCaptions : true,
          gore: raw.gore === 0 || raw.gore === 1 || raw.gore === 2 ? raw.gore : 2,
          marks:
            typeof raw.marks === 'boolean' && typeof raw.version === 'number' && raw.version >= 2
              ? raw.marks
              : false,
        };
    } catch {
      // A damaged setting falls back to the system preference.
    }
  }
  return { reducedMotion: systemPrefers, infoCaptions: true, gore: 2, marks: false };
}

/** The setting in force: the address first, then the saved choice, then the system preference. */
export function resolveDisplaySettings(
  store: KeyValueStore,
  query: string,
  systemPrefers: boolean,
): DisplaySettings {
  let saved: DisplaySettings;
  try {
    saved = parseDisplaySettings(store.getItem(DISPLAY_KEY), systemPrefers);
  } catch {
    saved = { reducedMotion: systemPrefers, infoCaptions: true, gore: 2, marks: false };
  }
  const params = new URLSearchParams(query);
  const gore = GORE_WORDS[params.get('gore') ?? ''];
  if (gore !== undefined) saved = { ...saved, gore };
  const marks = params.get('marks');
  if (marks === 'off' || marks === 'on') saved = { ...saved, marks: marks === 'on' };
  const motion = params.get('motion');
  if (motion === 'reduced') return { ...saved, reducedMotion: true };
  if (motion === 'full') return { ...saved, reducedMotion: false };
  return saved;
}

export function saveDisplaySettings(store: KeyValueStore, settings: DisplaySettings): boolean {
  try {
    store.setItem(DISPLAY_KEY, JSON.stringify({ version: 2, ...settings }));
    return true;
  } catch {
    return false;
  }
}

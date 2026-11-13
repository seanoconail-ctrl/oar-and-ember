/**
 * The per-viewer settings of the user's third playtest (Book 2 section 21; decisions DG-18 and
 * DG-19), stored on this device beside the display options and never in the world: whether the
 * cold open has been seen to its end (`introSeen`, HelpRecord), whether a new game leaves it out
 * (the title's "Intro: skip"), the sound's mix (Book 11's sliders and mono), and fullscreen as last
 * chosen. A damaged or missing setting falls back to its default.
 */
import type { KeyValueStore } from './settingsStore.ts';

export const INTERFACE_KEY = 'oar-and-ember:interface';

export const MIX_BUSES = ['master', 'music', 'ambience', 'effects', 'voice', 'tells'] as const;
export type MixBus = (typeof MIX_BUSES)[number];

export interface InterfaceSettings {
  /** The cold open has been played to its end once on this device (HelpRecord.introSeen). */
  readonly introSeen: boolean;
  /** "Intro: skip": every new game on this device starts at the waking. */
  readonly introSkip: boolean;
  /** Each bus's level, 0 to 100 percent of its own default. */
  readonly mix: Readonly<Record<MixBus, number>>;
  readonly mono: boolean;
  /** Fullscreen as last chosen (a display setting; the browser asks again on each visit). */
  readonly fullscreen: boolean;
}

export const DEFAULT_INTERFACE: InterfaceSettings = {
  introSeen: false,
  introSkip: false,
  mix: { master: 100, music: 100, ambience: 100, effects: 100, voice: 100, tells: 100 },
  mono: false,
  fullscreen: false,
};

const percent = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : d;

export function parseInterfaceSettings(text: string | null): InterfaceSettings {
  if (text === null) return DEFAULT_INTERFACE;
  try {
    const raw = JSON.parse(text) as Record<string, unknown> | null;
    if (raw === null || typeof raw !== 'object') return DEFAULT_INTERFACE;
    const mix = (raw['mix'] ?? {}) as Record<string, unknown>;
    return {
      introSeen: raw['introSeen'] === true,
      introSkip: raw['introSkip'] === true,
      mix: {
        master: percent(mix['master'], 100),
        music: percent(mix['music'], 100),
        ambience: percent(mix['ambience'], 100),
        effects: percent(mix['effects'], 100),
        voice: percent(mix['voice'], 100),
        tells: percent(mix['tells'], 100),
      },
      mono: raw['mono'] === true,
      fullscreen: raw['fullscreen'] === true,
    };
  } catch {
    return DEFAULT_INTERFACE;
  }
}

export function loadInterfaceSettings(store: KeyValueStore): InterfaceSettings {
  try {
    return parseInterfaceSettings(store.getItem(INTERFACE_KEY));
  } catch {
    return DEFAULT_INTERFACE;
  }
}

export function saveInterfaceSettings(store: KeyValueStore, s: InterfaceSettings): boolean {
  try {
    store.setItem(INTERFACE_KEY, JSON.stringify({ version: 1, ...s }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the cold open may be skipped now (Book 10 "The intro", skipAfter): only once it has
 * been seen to its end on this device; before that only the title's setting leaves it out.
 */
export function introSkippable(s: InterfaceSettings): boolean {
  return s.introSeen;
}

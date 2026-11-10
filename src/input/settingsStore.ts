/**
 * Saving and loading control settings: the bindings and which hold actions are toggles. Stored as
 * JSON in a key-value store (localStorage in the browser). A damaged or unknown setting falls back
 * to the default for that action, never to nothing.
 */
import { ACTIONS, DEFAULT_BINDINGS, TOGGLEABLE } from './actions.ts';
import type { Action, Binding, Bindings } from './actions.ts';

export const SETTINGS_KEY = 'oar-and-ember:controls';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ControlSettings {
  readonly bindings: Bindings;
  readonly toggle: readonly Action[];
}

function isBinding(value: unknown): value is Binding {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Record<string, unknown>;
  switch (b['device']) {
    case 'key':
      return typeof b['code'] === 'string' && b['code'] !== '';
    case 'mouse':
    case 'pad':
      return Number.isInteger(b['button']) && (b['button'] as number) >= 0;
    case 'axis':
      return Number.isInteger(b['axis']) && (b['dir'] === 1 || b['dir'] === -1);
    default:
      return false;
  }
}

export function defaultSettings(): ControlSettings {
  return { bindings: DEFAULT_BINDINGS, toggle: [] };
}

export function parseSettings(text: string | null): ControlSettings {
  if (text === null) return defaultSettings();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return defaultSettings();
  }
  const saved = (raw as { bindings?: Record<string, unknown>; toggle?: unknown } | null) ?? {};
  const bindings = {} as Record<Action, readonly Binding[]>;
  for (const action of ACTIONS) {
    const list = saved.bindings?.[action];
    bindings[action] =
      Array.isArray(list) && list.every(isBinding) ? list : DEFAULT_BINDINGS[action];
  }
  const toggle = Array.isArray(saved.toggle)
    ? (saved.toggle as unknown[]).filter(
        (a): a is Action => typeof a === 'string' && (TOGGLEABLE as readonly string[]).includes(a),
      )
    : [];
  return { bindings, toggle };
}

export function loadSettings(store: KeyValueStore): ControlSettings {
  try {
    return parseSettings(store.getItem(SETTINGS_KEY));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(store: KeyValueStore, settings: ControlSettings): boolean {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, ...settings }));
    return true;
  } catch {
    return false;
  }
}

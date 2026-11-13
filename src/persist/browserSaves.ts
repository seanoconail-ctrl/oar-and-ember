/**
 * The game's save slots in this browser (Book 2 section 20; decision DG-16): one store for the
 * device, so the title's Continue and Load and the pause menu see the same three manual slots, the
 * rotating autosaves and checkpoints, and the day-start save. Storage that is blocked falls back to
 * memory for the session.
 */
import { LocalStorageStore, MemoryStore, SaveManager } from './manager.ts';
import type { SaveStore } from './manager.ts';

export const SLOTS_PREFIX = 'oar-and-ember:slots:';

export function browserSaveStore(): SaveStore {
  try {
    localStorage.setItem('oar-and-ember:probe', '1');
    localStorage.removeItem('oar-and-ember:probe');
    return new LocalStorageStore(SLOTS_PREFIX);
  } catch {
    return new MemoryStore();
  }
}

export function browserSaves(build: string, store: SaveStore = browserSaveStore()): SaveManager {
  return new SaveManager(store, build);
}

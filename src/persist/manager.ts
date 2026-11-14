/**
 * Save slots (Book 2 section 20): manual slots allowed only under the safe rule, three rotating
 * autosaves (on waking, before departure, before landing) and labelled checkpoints before major
 * danger. Game over offers the latest autosave or checkpoint.
 */
import type { Simulation } from '../sim/simulation.ts';
import type { WorldState } from '../sim/world.ts';
import { readSave, writeSave } from './save.ts';
import type { AutosaveReason, ReadOptions, SaveFile, SaveHeader, Thumbnail } from './save.ts';

/** Where save files live. Values are the save files as JSON text. */
export interface SaveStore {
  get(slot: string): string | null;
  set(slot: string, text: string): void;
  delete(slot: string): void;
  slots(): string[];
}

export class MemoryStore implements SaveStore {
  readonly #data = new Map<string, string>();
  get(slot: string): string | null {
    return this.#data.get(slot) ?? null;
  }
  set(slot: string, text: string): void {
    this.#data.set(slot, text);
  }
  delete(slot: string): void {
    this.#data.delete(slot);
  }
  slots(): string[] {
    return [...this.#data.keys()];
  }
}

/** The browser's localStorage, under a prefix. Every access is guarded: storage can be blocked. */
export class LocalStorageStore implements SaveStore {
  readonly #prefix: string;
  constructor(prefix = 'oar-and-ember:save:') {
    this.#prefix = prefix;
  }
  get(slot: string): string | null {
    try {
      return localStorage.getItem(this.#prefix + slot);
    } catch {
      return null;
    }
  }
  set(slot: string, text: string): void {
    localStorage.setItem(this.#prefix + slot, text);
  }
  delete(slot: string): void {
    try {
      localStorage.removeItem(this.#prefix + slot);
    } catch {
      // Nothing to remove if storage is unavailable.
    }
  }
  slots(): string[] {
    try {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.#prefix) === true) out.push(key.slice(this.#prefix.length));
      }
      return out;
    } catch {
      return [];
    }
  }
}

/** What the safe rule needs to know (Book 2 section 02: threat.awareHostiles == 0). */
export interface Safety {
  readonly awareHostiles: number;
}

export type SaveResult =
  | { readonly ok: true; readonly header: SaveHeader }
  | { readonly ok: false; readonly reason: 'NOT_SAFE' | 'STORAGE_FAILED'; readonly detail: string };

export const AUTOSAVE_SLOTS = ['autosave-1', 'autosave-2', 'autosave-3'] as const;
export const MANUAL_SLOT_PATTERN = /^manual-[1-9]$/;
/** The save "Reset to the start of this day" loads (Book 2 section 20; decision DG-17). */
export const DAY_START_SLOT = 'day-start';

/**
 * What the pause menu's save and load pages show of a slot (Book 2 section 20, SaveSlotView):
 * read from the save's header and thumbnail without unpacking the world.
 */
export interface SaveSlotView {
  readonly slot: 'AUTO' | `MANUAL_${number}`;
  /** The store's slot the view reads (`manual-1`, or the newest autosave's or checkpoint's). */
  readonly storeSlot: string | null;
  readonly empty: boolean;
  readonly header?: SaveHeader;
  readonly thumbnail?: Thumbnail;
  /** Real seconds since it was saved, from the header's wall clock. */
  readonly agoSeconds?: number;
}

export class SaveManager {
  readonly #store: SaveStore;
  readonly #build: string;
  readonly #now: () => string;

  /** Automatic saves (autosaves, checkpoints, the day-start) written without a screenshot yet. */
  readonly unpictured: string[] = [];

  /** `now` returns wall-clock time for headers; persist/ may read it, sim/ never does. */
  constructor(store: SaveStore, build: string, now: () => string = () => new Date().toISOString()) {
    this.#store = store;
    this.#build = build;
    this.#now = now;
  }

  headers(): SaveHeader[] {
    return this.#store
      .slots()
      .flatMap((slot) => {
        const text = this.#store.get(slot);
        if (text === null) return [];
        try {
          return [(JSON.parse(text) as SaveFile).header];
        } catch {
          return [];
        }
      })
      .sort((a, b) => a.sequence - b.sequence);
  }

  #nextSequence(): number {
    return (this.headers().at(-1)?.sequence ?? 0) + 1;
  }

  #write(
    world: WorldState,
    kind: SaveHeader['kind'],
    slot: string,
    extra: { label?: string; reason?: AutosaveReason; thumbnail?: Thumbnail },
  ): SaveResult {
    const file = writeSave(world, {
      build: this.#build,
      kind,
      slot,
      sequence: this.#nextSequence(),
      savedAt: this.#now(),
      ...extra,
    });
    try {
      this.#store.set(slot, JSON.stringify(file));
    } catch (error) {
      return { ok: false, reason: 'STORAGE_FAILED', detail: (error as Error).message };
    }
    if (kind !== 'manual' && extra.thumbnail === undefined && !this.unpictured.includes(slot))
      this.unpictured.push(slot);
    return { ok: true, header: file.header };
  }

  /**
   * Puts a screenshot beside a save already written (an autosave or checkpoint, made between
   * frames: its picture is the next frame drawn). The world data and its hash are untouched.
   */
  attachThumbnail(slot: string, thumbnail: Thumbnail): boolean {
    const text = this.#store.get(slot);
    if (text === null) return false;
    try {
      const file = JSON.parse(text) as SaveFile;
      this.#store.set(slot, JSON.stringify({ ...file, thumbnail }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * A save the player asks for, with the slot's screenshot. Refused while any hostile is aware of
   * the player (the safe rule, Book 2 section 02).
   */
  manualSave(world: WorldState, slot: string, safety: Safety, thumbnail?: Thumbnail): SaveResult {
    if (!MANUAL_SLOT_PATTERN.test(slot))
      throw new Error(`"${slot}" is not a manual slot (manual-1 to manual-9)`);
    if (safety.awareHostiles > 0) {
      return {
        ok: false,
        reason: 'NOT_SAFE',
        detail: `${safety.awareHostiles} hostile(s) aware of you`,
      };
    }
    return this.#write(world, 'manual', slot, thumbnail === undefined ? {} : { thumbnail });
  }

  /**
   * The start of the day (decision DG-17): written at every waking, to its own slot, kept until
   * the next waking writes over it; never rotated, never offered as the autosave.
   */
  dayStart(world: WorldState): SaveResult {
    return this.#write(world, 'day-start', DAY_START_SLOT, {});
  }

  /** The day-start save's header, if one has been written. */
  dayStartHeader(): SaveHeader | null {
    return this.headers().find((h) => h.slot === DAY_START_SLOT) ?? null;
  }

  /** The newest save of any kind but the day-start: what the title's Continue loads. */
  newest(): SaveHeader | null {
    return (
      this.headers()
        .filter((h) => h.kind !== 'day-start')
        .at(-1) ?? null
    );
  }

  /**
   * The autosave slot and the manual slots as the pause menu shows them (Book 2 section 20): the
   * autosave is the newest of the rotating autosaves and checkpoints. `nowMs` is wall-clock time.
   */
  slotViews(manualSlots: number, nowMs: number): SaveSlotView[] {
    const files = new Map<string, SaveFile>();
    for (const slot of this.#store.slots()) {
      const text = this.#store.get(slot);
      if (text === null) continue;
      try {
        files.set(slot, JSON.parse(text) as SaveFile);
      } catch {
        // A damaged slot shows as empty.
      }
    }
    const view = (slot: SaveSlotView['slot'], file: SaveFile | undefined): SaveSlotView => {
      if (file === undefined) return { slot, storeSlot: null, empty: true };
      const at = Date.parse(file.header.savedAt);
      return {
        slot,
        storeSlot: file.header.slot,
        empty: false,
        header: file.header,
        ...(file.thumbnail === undefined ? {} : { thumbnail: file.thumbnail }),
        ...(Number.isFinite(at)
          ? { agoSeconds: Math.max(0, Math.round((nowMs - at) / 1000)) }
          : {}),
      };
    };
    const auto = [...files.values()]
      .filter((f) => f.header.kind === 'autosave' || f.header.kind === 'checkpoint')
      .sort((a, b) => a.header.sequence - b.header.sequence)
      .at(-1);
    const out = [view('AUTO', auto)];
    for (let i = 1; i <= manualSlots; i++) out.push(view(`MANUAL_${i}`, files.get(`manual-${i}`)));
    return out;
  }

  /** An automatic save into the oldest of the three rotating slots. */
  autosave(world: WorldState, reason: AutosaveReason): SaveResult {
    const used = new Map(
      this.headers()
        .filter((h) => h.kind === 'autosave')
        .map((h) => [h.slot, h.sequence]),
    );
    const slot =
      AUTOSAVE_SLOTS.find((s) => !used.has(s)) ??
      [...AUTOSAVE_SLOTS].sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0))[0] ??
      AUTOSAVE_SLOTS[0];
    return this.#write(world, 'autosave', slot, { reason });
  }

  /** A labelled checkpoint before major danger; the same label overwrites its earlier checkpoint. */
  checkpoint(world: WorldState, label: string): SaveResult {
    return this.#write(world, 'checkpoint', `checkpoint:${label}`, { label });
  }

  /** The newest autosave or checkpoint: what game over offers to reload. */
  latestRestorePoint(): SaveHeader | null {
    return (
      this.headers()
        .filter((h) => h.kind === 'autosave' || h.kind === 'checkpoint')
        .at(-1) ?? null
    );
  }

  load(slot: string, options?: ReadOptions): ReturnType<typeof readSave> {
    const text = this.#store.get(slot);
    if (text === null) throw new Error(`No save in slot "${slot}"`);
    return readSave(JSON.parse(text), options);
  }
}

/**
 * Autosaves on waking, before the morning report (Book 2 section 20), and the day-start save
 * written with it (decision DG-17). Returns an unsubscribe.
 */
export function attachWakingAutosave(sim: Simulation, saves: SaveManager): () => void {
  return sim.events.on('WOKE', () => {
    saves.autosave(sim.state, 'WAKING');
    saves.dayStart(sim.state);
  });
}

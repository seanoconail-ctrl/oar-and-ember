/**
 * The pause menu (Book 2 sections 02, 20 and 21; Book 7 section 10; decisions DG-15 to DG-18): a
 * plain list (Resume, Save, Load, Settings, Fullscreen, Reset to the start of this day, Controls,
 * Quit to title), the save and load pages with the autosave and the manual slots as cards, the
 * settings in four groups, and the controls. This is the menu's state and its rules only, pure and
 * without the DOM: the view draws it (src/scenes/pauseMenuArt.ts) and carries out the actions it
 * returns. Whether time stops is the MenuController's (src/ui/menus.ts): the menu holds time under
 * the safe rule and is an overlay over a running world while a hostile is aware.
 *
 * Saving is refused, with its reason in one information line, unless the safe rule holds. Saving
 * over a used slot, loading, resetting to the start of the day and quitting each ask once.
 */

/**
 * A slot as the menu shows it (persist's SaveSlotView has this shape; ui/ reads it without
 * importing persist, Book 2 section 02): read from a save's header and thumbnail.
 */
export interface SlotView {
  readonly slot: 'AUTO' | `MANUAL_${number}`;
  readonly storeSlot: string | null;
  readonly empty: boolean;
  readonly header?: {
    readonly day: number;
    readonly sequence: number;
    readonly minuteOfDay?: number;
    readonly season?: string;
    readonly placeKey?: string;
  };
  readonly thumbnail?: { readonly data: string };
  readonly agoSeconds?: number;
}

export const PAUSE_ITEMS = [
  'resume',
  'save',
  'load',
  'settings',
  'fullscreen',
  'resetDay',
  'controls',
  'quit',
] as const;
export type PauseItem = (typeof PAUSE_ITEMS)[number];

export type PausePage = 'main' | 'save' | 'load' | 'settings' | 'controls';

/** A row of the settings page: its group, and its words (a string key and its values). */
export interface SettingRow {
  readonly id: string;
  readonly group: 'display' | 'audio' | 'gameplay' | 'intro';
  readonly textKey: string;
  readonly vars?: Readonly<Record<string, string>>;
}

/** What the menu reads each time it is used: the world's safety and what the slots hold. */
export interface PauseEnv {
  /** The safe rule holds: no hostile is aware of the steerer (Book 2 section 02). */
  readonly safe: boolean;
  readonly fullscreen: boolean;
  /** The autosave first, then the manual slots (SaveManager.slotViews). */
  readonly slots: readonly SlotView[];
  /** A day-start save exists to reset to. */
  readonly hasDayStart: boolean;
  /** How long ago the newest save was made, in words ("3 minutes"), for the confirmations. */
  readonly lastSavedAgo: string;
  readonly settings: readonly SettingRow[];
  /** Rows of the controls page (one per action). */
  readonly controlRows: number;
}

export type PauseAction =
  | { readonly kind: 'close' }
  | { readonly kind: 'save'; readonly slot: number }
  | { readonly kind: 'load'; readonly storeSlot: string }
  | { readonly kind: 'fullscreen' }
  | { readonly kind: 'resetDay' }
  | { readonly kind: 'quit' }
  | { readonly kind: 'setting'; readonly id: string; readonly dir: 1 | -1 }
  | { readonly kind: 'remap'; readonly row: number }
  /** A move or choice was made (the menu's click, SFX_MENU_CLICK). */
  | { readonly kind: 'click' };

export type PauseNav = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/** One information line under the list: a reason refused, or "Saved". */
export interface PauseNote {
  readonly key: string;
  readonly vars?: Readonly<Record<string, string>>;
  readonly refused: boolean;
}

export interface PauseConfirm {
  readonly action: PauseAction;
  readonly key: string;
  readonly vars?: Readonly<Record<string, string>>;
  /** Yes highlighted (No is, when it opens). */
  yes: boolean;
}

export class PauseMenu {
  page: PausePage = 'main';
  /** The highlighted row of the page. */
  cursor = 0;
  confirm: PauseConfirm | null = null;
  note: PauseNote | null = null;

  /** Opens on the main page with Resume highlighted. */
  open(): void {
    this.page = 'main';
    this.cursor = 0;
    this.confirm = null;
    this.note = null;
  }

  /** How many rows the page has. */
  rows(env: PauseEnv): number {
    switch (this.page) {
      case 'main':
        return PAUSE_ITEMS.length;
      case 'save':
      case 'load':
        return env.slots.length;
      case 'settings':
        return env.settings.length;
      case 'controls':
        return env.controlRows;
    }
  }

  /** Whether a row can be chosen: an empty slot cannot be loaded; the autosave cannot be saved to. */
  enabled(row: number, env: PauseEnv): boolean {
    if (this.page === 'main') {
      const item = PAUSE_ITEMS[row];
      if (item === 'resetDay') return env.hasDayStart;
      return true;
    }
    const slot = env.slots[row];
    if (this.page === 'save') return slot !== undefined && slot.slot !== 'AUTO';
    if (this.page === 'load') return slot !== undefined && !slot.empty && slot.storeSlot !== null;
    return true;
  }

  /** A key, the pad or the wheel moved or chose. Returns what the view is to do. */
  nav(n: PauseNav, env: PauseEnv): PauseAction[] {
    if (this.confirm !== null) return this.#navConfirm(n);
    const rows = this.rows(env);
    if (n === 'up' || n === 'down') {
      if (rows === 0) return [];
      this.cursor = (this.cursor + (n === 'up' ? rows - 1 : 1)) % rows;
      return [{ kind: 'click' }];
    }
    if (n === 'back') return this.back();
    if (this.page === 'settings' && (n === 'left' || n === 'right')) {
      const row = env.settings[this.cursor];
      return row === undefined
        ? []
        : [{ kind: 'click' }, { kind: 'setting', id: row.id, dir: n === 'left' ? -1 : 1 }];
    }
    if ((this.page === 'save' || this.page === 'load') && (n === 'left' || n === 'right')) {
      // The cards sit two by two: left and right move along a row.
      if (rows === 0) return [];
      this.cursor = (this.cursor + (n === 'left' ? rows - 1 : 1)) % rows;
      return [{ kind: 'click' }];
    }
    if (n === 'confirm') return this.choose(this.cursor, env);
    return [];
  }

  /** Back: from a page to the list, from the list closed. */
  back(): PauseAction[] {
    if (this.confirm !== null) {
      this.confirm = null;
      return [{ kind: 'click' }];
    }
    if (this.page === 'main') return [{ kind: 'close' }];
    const from = this.page;
    this.page = 'main';
    this.cursor = PAUSE_ITEMS.indexOf(from === 'controls' ? 'controls' : from);
    this.note = null;
    return [{ kind: 'click' }];
  }

  /** Row `row` chosen (a click, or confirm on the highlighted row). */
  choose(row: number, env: PauseEnv): PauseAction[] {
    if (this.confirm !== null) return [];
    this.cursor = row;
    const click: PauseAction = { kind: 'click' };
    if (this.page === 'main') {
      const item = PAUSE_ITEMS[row];
      this.note = null;
      switch (item) {
        case 'resume':
          return [click, { kind: 'close' }];
        case 'save':
          if (!env.safe) {
            this.note = { key: 'ui.save.refused', refused: true };
            return [click];
          }
          return [click, ...this.#to('save', 1)];
        case 'load':
          return [click, ...this.#to('load', 0)];
        case 'settings':
          return [click, ...this.#to('settings', 0)];
        case 'controls':
          return [click, ...this.#to('controls', 0)];
        case 'fullscreen':
          return [click, { kind: 'fullscreen' }];
        case 'resetDay':
          if (!env.hasDayStart) return [];
          this.confirm = { action: { kind: 'resetDay' }, key: 'ui.save.confirm_reset', yes: false };
          return [click];
        case 'quit':
          this.confirm = {
            action: { kind: 'quit' },
            key: 'ui.save.confirm_quit',
            vars: { ago: env.lastSavedAgo },
            yes: false,
          };
          return [click];
        case undefined:
          return [];
      }
    }
    if (this.page === 'save') {
      const slot = env.slots[row];
      if (slot === undefined || slot.slot === 'AUTO') return [];
      if (!env.safe) {
        this.note = { key: 'ui.save.refused', refused: true };
        return [click];
      }
      const n = Number(slot.slot.slice('MANUAL_'.length));
      const action: PauseAction = { kind: 'save', slot: n };
      if (slot.empty) return [click, action];
      this.confirm = { action, key: 'ui.save.confirm_overwrite', yes: false };
      return [click];
    }
    if (this.page === 'load') {
      const slot = env.slots[row];
      if (slot === undefined || slot.empty || slot.storeSlot === null) return [];
      this.confirm = {
        action: { kind: 'load', storeSlot: slot.storeSlot },
        key: 'ui.save.confirm_load',
        vars: { ago: env.lastSavedAgo },
        yes: false,
      };
      return [click];
    }
    if (this.page === 'settings') {
      const s = env.settings[row];
      return s === undefined ? [] : [click, { kind: 'setting', id: s.id, dir: 1 }];
    }
    return row < env.controlRows ? [click, { kind: 'remap', row }] : [];
  }

  /** The answer to the confirmation (a click on Yes or No). */
  answer(yes: boolean): PauseAction[] {
    const c = this.confirm;
    if (c === null) return [];
    this.confirm = null;
    return yes ? [{ kind: 'click' }, c.action] : [{ kind: 'click' }];
  }

  /** The note after a save: "Saved", or why it was not. */
  saved(ok: boolean, refused = false): void {
    this.note = ok
      ? { key: 'ui.save.saved', refused: false }
      : { key: refused ? 'ui.save.refused' : 'ui.save.failed', refused: true };
  }

  #to(page: PausePage, cursor: number): PauseAction[] {
    this.page = page;
    this.cursor = cursor;
    this.note = null;
    return [];
  }

  #navConfirm(n: PauseNav): PauseAction[] {
    const c = this.confirm;
    if (c === null) return [];
    if (n === 'left' || n === 'right' || n === 'up' || n === 'down') {
      c.yes = !c.yes;
      return [{ kind: 'click' }];
    }
    if (n === 'back') return this.answer(false);
    return this.answer(c.yes);
  }
}

/** An action's name string on the controls page ("ui.action.move_up", "Hotbar slot 3"). */
export function actionLabel(action: string): { key: string; vars: Record<string, string> } {
  const slot = /^slot(\d+)$/.exec(action);
  if (slot !== null) return { key: 'ui.action.slot', vars: { count: slot[1] ?? '' } };
  const quick = /^quick(\d)$/.exec(action);
  if (quick !== null) return { key: 'ui.action.quick', vars: { count: quick[1] ?? '' } };
  return { key: `ui.action.${action.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`, vars: {} };
}

const PAD_BUTTONS = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'Back',
  'Start',
  'L3',
  'R3',
  'D-pad ↑',
  'D-pad ↓',
  'D-pad ←',
  'D-pad →',
];
const ARROWS: Readonly<Record<string, string>> = { Up: '↑', Down: '↓', Left: '←', Right: '→' };

/**
 * A binding as the controls page writes it: keys by their printed name ("W", "↑", "Shift",
 * "Escape"), the mouse's buttons, the pad's buttons by the standard layout's names and its sticks
 * by their way.
 */
export function controlLabel(b: import('../input/actions.ts').Binding): string {
  switch (b.device) {
    case 'key': {
      const arrow = /^Arrow(Up|Down|Left|Right)$/.exec(b.code);
      if (arrow !== null) return ARROWS[arrow[1] ?? ''] ?? b.code;
      return b.code
        .replace(/^Key/, '')
        .replace(/^Digit/, '')
        .replace(/^(Shift|Control|Alt|Meta)(Left|Right)$/, '$1')
        .replace(/^BracketLeft$/, '[')
        .replace(/^BracketRight$/, ']')
        .replace(/^Minus$/, '-')
        .replace(/^Equal$/, '=');
    }
    case 'mouse':
      return b.button === 0 ? 'Left click' : b.button === 2 ? 'Right click' : 'Middle click';
    case 'wheel':
      return b.dir < 0 ? 'Wheel up' : 'Wheel down';
    case 'pad':
      return PAD_BUTTONS[b.button] ?? `Pad ${b.button}`;
    case 'axis': {
      const stick = b.axis < 2 ? 'Left stick' : 'Right stick';
      const way = b.axis % 2 === 0 ? (b.dir < 0 ? '←' : '→') : b.dir < 0 ? '↑' : '↓';
      return `${stick} ${way}`;
    }
  }
}

/** How long ago, in words, for a slot and the confirmations ("moments", "a minute", "3 hours"). */
export function agoText(
  seconds: number,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(seconds / 3600);
  const days = Math.round(seconds / 86400);
  if (seconds < 60) return t('ui.save.ago_moments');
  if (minutes === 1) return t('ui.save.ago_minute');
  if (seconds < 3600) return t('ui.save.ago_minutes', { count: String(minutes) });
  if (hours === 1) return t('ui.save.ago_hour');
  if (seconds < 86400) return t('ui.save.ago_hours', { count: String(hours) });
  if (days === 1) return t('ui.save.ago_day');
  return t('ui.save.ago_days', { count: String(days) });
}

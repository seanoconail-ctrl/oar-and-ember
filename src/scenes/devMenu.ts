/**
 * The developer menu (Book 2 section 21; Book 7 section 10; Book 10 section 21, "Developer menu";
 * decision DG-21). Only in a debug build (`import.meta.env.DEV`) or with `?dev` in the address: it
 * is never built into a player's page otherwise, and never named in player-facing text. F3 toggles
 * it (in developer mode F3 is no longer quick command 3, DG-22). Plain text on the overlay, top left
 * under the bars: the current aim's journal line, the day and the time, the frames per second
 * averaged over a second with the slowest frame, the zone and the steerer's tile; and three
 * actions, each sent as a simulation command (DEV_SKIP, DEV_TELEPORT, DEV_KILL) so replays stay
 * exact: skip the hours, teleport to the next clicked tile, kill the next clicked enemy.
 */
import type { Id } from '../core/ids.ts';
import type { Command } from '../sim/simulation.ts';

/** Whether developer mode is on: a debug build (`import.meta.env.DEV`), or `?dev` in the address. */
export function devModeOn(search: string, debugBuild: boolean): boolean {
  return debugBuild || new URLSearchParams(search).has('dev');
}

export interface DevReadout {
  readonly aim: string;
  readonly day: number;
  readonly time: string;
  readonly zone: string;
  readonly tile: { readonly tx: number; readonly ty: number };
}

export interface DevHost {
  readonly t: (key: string, vars?: Record<string, string>) => string;
  readonly submit: (command: Command) => void;
  /** The world point under a page point, or null off the frame. */
  readonly worldAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** The enemy nearest a world point (within reach of a click), or null. */
  readonly enemyAt: (x: number, y: number) => Id | null;
  readonly tileSize: () => number;
  /** Book 10: devSkipHours (as minutes) and the teleport's search radius in tiles. */
  readonly skipMinutes: number;
  readonly teleportTiles: number;
  readonly fpsSeconds: number;
}

type Armed = 'teleport' | 'kill' | null;

export class DevMenu {
  readonly root: HTMLElement;
  open = false;
  #armed: Armed = null;
  readonly #host: DevHost;
  readonly #lines: HTMLElement;
  readonly #actions: Record<'skip' | 'teleport' | 'kill', HTMLElement>;
  #frames: number[] = [];
  #last = -1;
  /** What the last action did, for the tests and the developer. */
  last = '';

  constructor(doc: Document, host: DevHost) {
    this.#host = host;
    const root = doc.createElement('div');
    root.className = 'oe-dev';
    root.dataset['dev'] = 'closed';
    Object.assign(root.style, {
      position: 'fixed',
      left: '8px',
      top: '72px',
      zIndex: '30',
      font: '12px/1.35 ui-monospace, monospace',
      color: '#f4efe4',
      background: 'rgba(34, 49, 58, 0.85)',
      padding: '6px 8px',
      display: 'none',
      pointerEvents: 'auto',
      whiteSpace: 'pre',
    });
    const title = doc.createElement('div');
    title.textContent = host.t('ui.dev.title');
    const lines = doc.createElement('div');
    const action = (key: string, name: 'skip' | 'teleport' | 'kill'): HTMLElement => {
      const a = doc.createElement('div');
      a.textContent = host.t(key);
      a.dataset['devAction'] = name;
      a.style.cursor = 'pointer';
      a.style.textDecoration = 'underline';
      a.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.choose(name);
      });
      return a;
    };
    this.#actions = {
      skip: action('ui.dev.skip', 'skip'),
      teleport: action('ui.dev.teleport', 'teleport'),
      kill: action('ui.dev.kill', 'kill'),
    };
    root.append(title, lines, this.#actions.skip, this.#actions.teleport, this.#actions.kill);
    doc.body.append(root);
    this.root = root;
    this.#lines = lines;
    doc.addEventListener('keydown', (e) => {
      if (e.code !== 'F3') return;
      e.preventDefault();
      this.toggle();
    });
    // An armed action takes the next click on the frame (before the game sees it).
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.open || this.#armed === null || root.contains(e.target as Node)) return;
        const at = host.worldAt(e.clientX, e.clientY);
        if (at === null) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.click(at);
      },
      { capture: true },
    );
  }

  toggle(): void {
    this.open = !this.open;
    this.#armed = null;
    this.root.style.display = this.open ? 'block' : 'none';
    this.root.dataset['dev'] = this.open ? 'open' : 'closed';
  }

  /** An action chosen: the skip is sent at once; teleport and kill wait for a click. */
  choose(name: 'skip' | 'teleport' | 'kill'): void {
    if (name === 'skip') {
      this.#host.submit({ type: 'DEV_SKIP', minutes: this.#host.skipMinutes });
      this.last = 'skip';
      this.#armed = null;
    } else this.#armed = this.#armed === name ? null : name;
    this.root.dataset['armed'] = this.#armed ?? '';
  }

  /** A click on the frame while an action is armed. */
  click(at: { x: number; y: number }): void {
    const tile = this.#host.tileSize();
    if (this.#armed === 'teleport') {
      this.#host.submit({
        type: 'DEV_TELEPORT',
        tile: { tx: Math.floor(at.x / tile), ty: Math.floor(at.y / tile) },
        within: this.#host.teleportTiles,
      });
      this.last = 'teleport';
    } else if (this.#armed === 'kill') {
      const target = this.#host.enemyAt(at.x, at.y);
      if (target !== null) this.#host.submit({ type: 'DEV_KILL', target });
      this.last = target === null ? 'kill:none' : `kill:${target}`;
    }
    this.#armed = null;
    this.root.dataset['armed'] = '';
    this.root.dataset['last'] = this.last;
  }

  /** Each frame: the frame time, and the readout while open. */
  frame(now: number, r: DevReadout): void {
    if (this.#last >= 0) this.#frames.push(now - this.#last);
    this.#last = now;
    let sum = this.#frames.reduce((a, b) => a + b, 0);
    while (this.#frames.length > 1 && sum > this.#host.fpsSeconds * 1000) {
      sum -= this.#frames.shift() ?? 0;
    }
    if (!this.open) return;
    const fps = sum > 0 ? Math.round((this.#frames.length * 1000) / sum) : 0;
    const slowest = this.#frames.length === 0 ? 0 : Math.max(...this.#frames);
    const t = this.#host.t;
    const text = [
      t('ui.dev.aim', { aim: r.aim }),
      t('ui.dev.time', { day: String(r.day), time: r.time }),
      t('ui.dev.fps', { fps: String(fps), ms: slowest.toFixed(1) }),
      t('ui.dev.where', { zone: r.zone, x: String(r.tile.tx), y: String(r.tile.ty) }),
    ].join('\n');
    if (this.#lines.textContent !== text) this.#lines.textContent = text;
    this.root.dataset['fps'] = String(fps);
  }
}

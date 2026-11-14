/**
 * Menus and the safe rule (Book 2 section 02). A menu or planning screen opens only when no
 * hostile is aware of the player; while it is open, simulation time stops. The system menu always
 * opens, but while hostiles are aware it is an overlay and time keeps running. There is no
 * tactical pause.
 */

export const MENUS = ['map', 'inventory', 'build', 'report', 'planning', 'system'] as const;
export type MenuId = (typeof MENUS)[number];

/** What the safe rule reads: how many hostile actors are aware of the player. */
export interface ThreatView {
  awareHostiles(): number;
}

export type OpenResult =
  | { readonly ok: true; readonly menu: MenuId; readonly timeStopped: boolean }
  | {
      readonly ok: false;
      readonly menu: MenuId;
      readonly reason: 'HOSTILES_AWARE';
      readonly aware: number;
    };

export class MenuController {
  readonly #threat: ThreatView;
  #open: MenuId | null = null;
  #timeStopped = false;

  constructor(threat: ThreatView) {
    this.#threat = threat;
  }

  get open(): MenuId | null {
    return this.#open;
  }

  /** True while an open menu has stopped simulation time. */
  get timeStopped(): boolean {
    return this.#timeStopped;
  }

  request(menu: MenuId): OpenResult {
    const aware = this.#threat.awareHostiles();
    if (aware > 0 && menu !== 'system') return { ok: false, menu, reason: 'HOSTILES_AWARE', aware };
    this.#open = menu;
    this.#timeStopped = aware === 0;
    return { ok: true, menu, timeStopped: this.#timeStopped };
  }

  close(): void {
    this.#open = null;
    this.#timeStopped = false;
  }

  /**
   * Re-checks the rule every frame: if a hostile becomes aware while a menu is open, the menu
   * closes (the system menu stays, as an overlay), so danger can never be paused away.
   */
  update(): void {
    if (this.#open === null) return;
    if (this.#threat.awareHostiles() > 0) {
      if (this.#open === 'system') this.#timeStopped = false;
      else this.close();
    }
  }
}

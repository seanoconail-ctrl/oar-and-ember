/**
 * Crew commands (Book 2 section 12): FOLLOW, HOLD, ATTACK, PROTECT, CARRY and WITHDRAW, on the
 * quick keys 1 to 6 and on a command ring that opens while its button is held. The ring is not a
 * menu: it never stops time (Book 1 section 15, Book 2 section 21). Its centre heals (decisions
 * DE-3, DE-45; design addendum 2.5, DF-21): let go with the stick (or pointer) at rest in the
 * middle, the steerer binds a wound or eats, as H does on the keyboard.
 */
import type { InputFrame } from './inputState.ts';

export const CREW_ORDERS = ['FOLLOW', 'HOLD', 'ATTACK', 'PROTECT', 'CARRY', 'WITHDRAW'] as const;
export type CrewOrder = (typeof CREW_ORDERS)[number];

const QUICK = ['quick1', 'quick2', 'quick3', 'quick4', 'quick5', 'quick6'] as const;

/** Pointer or stick deflection below this, while the ring is open, selects nothing. */
export const RING_DEAD_ZONE = 0.3;

export interface RingState {
  readonly open: boolean;
  /** The highlighted order, or null when the pointer is in the centre. */
  readonly selected: CrewOrder | null;
}

/** The order at a direction: six segments, FOLLOW straight up, then clockwise. */
export function orderAt(dx: number, dy: number): CrewOrder | null {
  if (Math.hypot(dx, dy) < RING_DEAD_ZONE) return null;
  const angle = (Math.atan2(dx, -dy) + 2 * Math.PI + Math.PI / 6) % (2 * Math.PI);
  return CREW_ORDERS[Math.floor(angle / (Math.PI / 3)) % 6] ?? null;
}

export class CommandRing {
  #open = false;
  #selected: CrewOrder | null = null;
  #heal = false;

  /** Whether the ring was let go at its centre since the last call (heal), once. */
  takeHeal(): boolean {
    const h = this.#heal;
    this.#heal = false;
    return h;
  }

  get state(): RingState {
    return { open: this.#open, selected: this.#selected };
  }

  /**
   * Advances the ring for this frame. `aim` is the pointer or stick direction relative to the ring's
   * centre. Returns the orders issued this frame (from quick keys, or the ring on release).
   */
  update(frame: InputFrame, aim: { readonly x: number; readonly y: number }): CrewOrder[] {
    const issued: CrewOrder[] = [];
    QUICK.forEach((action, i) => {
      const order = CREW_ORDERS[i];
      if (frame.pressed.has(action) && order !== undefined) issued.push(order);
    });
    if (frame.held.has('commandRing')) {
      this.#open = true;
      this.#selected = orderAt(aim.x, aim.y);
    } else if (this.#open) {
      if (this.#selected !== null) issued.push(this.#selected);
      else this.#heal = true;
      this.#open = false;
      this.#selected = null;
    }
    return issued;
  }
}

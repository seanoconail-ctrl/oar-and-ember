/**
 * Turns raw device input into action states once per frame: held, pressed this frame and released
 * this frame, with the movement vector. Hold actions set to toggle flip on each press instead
 * (the hold-or-toggle option, Book 2 section 21). Pure: the browser adapter feeds it events.
 */
import { ACTIONS, TOGGLEABLE } from './actions.ts';
import type { Action, Binding, Bindings } from './actions.ts';

export interface InputFrame {
  readonly held: ReadonlySet<Action>;
  readonly pressed: ReadonlySet<Action>;
  readonly released: ReadonlySet<Action>;
  /** Movement from -1 to 1 on each axis; length at most 1. */
  readonly move: { readonly x: number; readonly y: number };
}

/** Stick deflection below this counts as centred. */
export const STICK_DEAD_ZONE = 0.25;

export class InputMapper {
  #bindings: Bindings;
  #toggle: Set<Action>;
  readonly #keys = new Set<string>();
  readonly #mouse = new Set<number>();
  /** Keys and buttons pressed since the last sample, so a tap shorter than a frame still counts. */
  readonly #tappedKeys = new Set<string>();
  readonly #tappedMouse = new Set<number>();
  #padButtons: readonly boolean[] = [];
  #padAxes: readonly number[] = [];
  readonly #toggled = new Set<Action>();
  #physicalBefore = new Set<Action>();
  #heldBefore = new Set<Action>();

  constructor(bindings: Bindings, toggle: Iterable<Action> = []) {
    this.#bindings = bindings;
    this.#toggle = new Set([...toggle].filter((a) => TOGGLEABLE.includes(a)));
  }

  setBindings(bindings: Bindings): void {
    this.#bindings = bindings;
  }

  setToggle(toggle: Iterable<Action>): void {
    this.#toggle = new Set([...toggle].filter((a) => TOGGLEABLE.includes(a)));
    this.#toggled.clear();
  }

  keyDown(code: string): void {
    // Auto-repeat sends more key-downs while the key is held; only a new press counts.
    if (this.#keys.has(code)) return;
    this.#keys.add(code);
    this.#tappedKeys.add(code);
  }
  keyUp(code: string): void {
    this.#keys.delete(code);
  }
  mouseDown(button: number): void {
    if (this.#mouse.has(button)) return;
    this.#mouse.add(button);
    this.#tappedMouse.add(button);
  }
  mouseUp(button: number): void {
    this.#mouse.delete(button);
  }
  pad(buttons: readonly boolean[], axes: readonly number[]): void {
    this.#padButtons = buttons;
    this.#padAxes = axes;
  }
  /** The window lost focus: let go of everything, so no key sticks down. */
  releaseAll(): void {
    this.#keys.clear();
    this.#mouse.clear();
    this.#tappedKeys.clear();
    this.#tappedMouse.clear();
    this.#padButtons = [];
    this.#padAxes = [];
    this.#toggled.clear();
  }

  #down(binding: Binding): boolean {
    switch (binding.device) {
      case 'key':
        return this.#keys.has(binding.code) || this.#tappedKeys.has(binding.code);
      case 'mouse':
        return this.#mouse.has(binding.button) || this.#tappedMouse.has(binding.button);
      case 'pad':
        return this.#padButtons[binding.button] === true;
      case 'axis':
        return (this.#padAxes[binding.axis] ?? 0) * binding.dir > STICK_DEAD_ZONE;
    }
  }

  /** The action states for this frame. Call once per frame. */
  sample(): InputFrame {
    const physical = new Set<Action>();
    for (const action of ACTIONS)
      if (this.#bindings[action].some((b) => this.#down(b))) physical.add(action);
    // A key let go and pressed again between two samples is a new press, though it looks held.
    const fresh = new Set<Action>();
    for (const action of ACTIONS) {
      const retapped = this.#bindings[action].some(
        (b) =>
          (b.device === 'key' && this.#tappedKeys.has(b.code)) ||
          (b.device === 'mouse' && this.#tappedMouse.has(b.button)),
      );
      if (retapped) fresh.add(action);
    }
    const held = new Set<Action>();
    for (const action of ACTIONS) {
      if (this.#toggle.has(action)) {
        if (physical.has(action) && (!this.#physicalBefore.has(action) || fresh.has(action))) {
          if (this.#toggled.has(action)) this.#toggled.delete(action);
          else this.#toggled.add(action);
        }
        if (this.#toggled.has(action)) held.add(action);
      } else if (physical.has(action)) {
        held.add(action);
      }
    }
    this.#tappedKeys.clear();
    this.#tappedMouse.clear();
    const pressed = new Set(
      [...held].filter((a) => !this.#heldBefore.has(a) || (fresh.has(a) && !this.#toggle.has(a))),
    );
    const released = new Set([...this.#heldBefore].filter((a) => !held.has(a)));
    this.#physicalBefore = physical;
    this.#heldBefore = held;

    // Movement: analogue from the stick when it is deflected, else digital from the move actions.
    const sx = this.#padAxes[0] ?? 0;
    const sy = this.#padAxes[1] ?? 0;
    let x: number;
    let y: number;
    if (Math.hypot(sx, sy) > STICK_DEAD_ZONE) {
      x = sx;
      y = sy;
    } else {
      x = (held.has('moveRight') ? 1 : 0) - (held.has('moveLeft') ? 1 : 0);
      y = (held.has('moveDown') ? 1 : 0) - (held.has('moveUp') ? 1 : 0);
    }
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { held, pressed, released, move: { x, y } };
  }
}

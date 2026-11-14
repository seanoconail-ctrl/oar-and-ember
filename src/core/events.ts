/**
 * A typed event bus (Book 2 section 02: sim systems handle commands and emit events; render,
 * audio and UI listen). Events are delivered in the order they were emitted.
 */

export interface Typed {
  readonly type: string;
}

export type Listener<E> = (event: E) => void;

export class EventBus<E extends Typed> {
  readonly #listeners = new Map<string, Set<Listener<E>>>();
  readonly #any = new Set<Listener<E>>();

  /** Listens for one event type. Returns a function that stops listening. */
  on<T extends E['type']>(type: T, listener: Listener<Extract<E, { type: T }>>): () => void {
    let set = this.#listeners.get(type);
    if (set === undefined) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    const wrapped = listener as Listener<E>;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  /** Listens for every event. Returns a function that stops listening. */
  onAny(listener: Listener<E>): () => void {
    this.#any.add(listener);
    return () => this.#any.delete(listener);
  }

  emit(event: E): void {
    for (const listener of this.#listeners.get(event.type) ?? []) listener(event);
    for (const listener of this.#any) listener(event);
  }
}

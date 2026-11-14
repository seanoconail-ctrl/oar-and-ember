/**
 * Bran and the scavengers talking at the fold (the user's third playtest; decision DG-26; Book 8
 * section 07; Book 10 section 07, "At the fold"). While the fold's encounter waits and none of them
 * is aware of the steerer, they are in the middle of an exchange: shown as speech (with its blips)
 * within overhearRange of the speaker, a murmur of blips with no words out to its edge. The
 * exchanges play in a shuffled order drawn at each arrival on the presentation's own seeded stream
 * (no exchange twice in a row, absent speakers left out), lineGap after a line's subtitle ends and
 * exchangeGap between exchanges; the moment any of them turns suspicious or alert, the talk stops
 * for good in that visit and their first-sight lines take over.
 *
 * Presentation of their idle state only (Book 2 section 13, "Overheard talk"): pure, on the frame's
 * clock (seconds); the simulation never reads it.
 */
import { nextFloat, seedStream } from '../core/rng.ts';
import type { RngState } from '../core/rng.ts';
import type { Pt3Balance } from '../content/pt3Balance.ts';

export interface TalkExchange {
  readonly id: string;
  readonly lines: readonly { readonly person: string; readonly key: string }[];
  readonly needs?: readonly string[];
  /** The user's fourth playtest (DH-15): heard only while this fact is set (to `is`, if given). */
  readonly fact?: string;
  readonly is?: string;
  /** Heard only while this fact is not set. */
  readonly unless?: string;
}

/** What the frame tells the talk about the fold now. */
export interface FoldView {
  readonly now: number;
  /** The steerer is in the fold's zone, the encounter there waiting (not begun, not over). */
  readonly waiting: boolean;
  /** Any of them suspicious or alert to the steerer. */
  readonly aware: boolean;
  /** Who of the speakers is there (alive, not held, not gone). */
  readonly present: (person: string) => boolean;
  /** The steerer's distance from a speaker, in tiles. */
  readonly tiles: (person: string) => number;
  /** How long a line's subtitle shows, in seconds (Book 10 speechHold). */
  readonly hold: (key: string) => number;
  /** A story fact's value (the world's facts; DH-15). */
  readonly fact?: (key: string) => unknown;
}

/** A line to give: shown as speech, or only its murmur of blips. */
export interface FoldLine {
  readonly person: string;
  readonly key: string;
  readonly murmur: boolean;
}

/** Whether an exchange's story fact holds (DH-15: who took the silver), as the view reads it. */
function factsHold(e: TalkExchange, v: FoldView): boolean {
  const read = v.fact ?? ((): unknown => undefined);
  if (e.unless !== undefined && read(e.unless) !== undefined) return false;
  if (e.fact === undefined) return true;
  const value = read(e.fact);
  return e.is === undefined ? value !== undefined : value === e.is;
}

export class FoldTalk {
  readonly #ex: readonly TalkExchange[];
  readonly #b: Pt3Balance['fold'];
  readonly #seed: string;
  #rng: RngState | null = null;
  #arrivals = 0;
  #here = false;
  #stopped = false;
  #order: TalkExchange[] = [];
  #at = 0;
  #line = 0;
  #next = 0;
  #last: string | null = null;

  constructor(exchanges: readonly TalkExchange[], b: Pt3Balance['fold'], seed: string) {
    this.#ex = exchanges;
    this.#b = b;
    this.#seed = seed;
  }

  /** The talk has stopped for good in this visit. */
  get stopped(): boolean {
    return this.#stopped;
  }

  /** The exchange heard last (none yet: null). */
  get lastExchange(): string | null {
    return this.#last;
  }

  #shuffle(v: FoldView): void {
    this.#rng ??= seedStream(`${this.#seed}/fold/${String(this.#arrivals)}`, 'generation');
    const rng = this.#rng;
    const can = this.#ex.filter(
      (e) =>
        [...e.lines.map((l) => l.person), ...(e.needs ?? [])].every((p) => v.present(p)) &&
        factsHold(e, v),
    );
    const order = [...can];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(nextFloat(rng) * (i + 1));
      const a = order[i];
      const b = order[j];
      if (a === undefined || b === undefined) continue;
      order[i] = b;
      order[j] = a;
    }
    // Never the one just heard first.
    if (order.length > 1 && order[0]?.id === this.#last) {
      const first = order.shift();
      if (first !== undefined) order.push(first);
    }
    this.#order = order;
    this.#at = 0;
    this.#line = 0;
  }

  /** One frame: the line to give now, if any. */
  update(v: FoldView): FoldLine | null {
    if (!v.waiting) {
      // Left the fold (or the fight began): the next arrival starts afresh.
      if (this.#here) {
        this.#here = false;
        this.#stopped = false;
      }
      return null;
    }
    if (!this.#here) {
      this.#here = true;
      this.#arrivals++;
      this.#rng = null;
      this.#shuffle(v);
      this.#next = v.now;
    }
    if (this.#stopped) return null;
    if (v.aware) {
      this.#stopped = true;
      return null;
    }
    if (v.now < this.#next) return null;
    let ex = this.#order[this.#at];
    // A speaker gone since the order was drawn: that exchange is left out.
    while (ex !== undefined && this.#line === 0 && !ex.lines.every((l) => v.present(l.person))) {
      this.#at++;
      ex = this.#order[this.#at];
    }
    if (ex === undefined) {
      this.#shuffle(v);
      ex = this.#order[0];
      if (ex === undefined) return null;
    }
    const line = ex.lines[this.#line];
    if (line === undefined) return null;
    const d = v.tiles(line.person);
    const hold = v.hold(line.key);
    this.#line++;
    if (this.#line >= ex.lines.length) {
      this.#last = ex.id;
      this.#at++;
      this.#line = 0;
      this.#next = v.now + hold + this.#b.exchangeGapSeconds;
    } else this.#next = v.now + hold + this.#b.lineGapSeconds;
    if (d > this.#b.murmurTiles) return null;
    return { person: line.person, key: line.key, murmur: d > this.#b.overhearTiles };
  }
}

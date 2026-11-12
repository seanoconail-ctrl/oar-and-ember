/**
 * The caption view (Book 2 section 18, `CaptionView`; design addendum 2.5 section 2; decisions
 * DF-11 to DF-13): at most one information line and one speech line on screen. Presentation only,
 * pure and on the frame's clock, so it is tested headless.
 *
 * - **One of each, never stacked.** A new line replaces the shown line of its kind at once, cross-
 *   fading over Book 10's captionReplace; lines never stack or queue. Lines offered in the same
 *   frame "arrive together": the highest class shows (infoPriority).
 * - **Repeats suppressed.** The same line is not shown again within captionRepeat.
 * - **Holds and fades.** Information holds infoHold, speech 1 s + 0.05 s a character (2 to 5 s);
 *   each fades in over captionFadeIn and out over 0.4 s.
 * - **A lower class never cuts a higher one short**: a sound or story line offered while a safety
 *   line is still holding is dropped (DF-50).
 * - **Fights.** While Book 10's inFight holds, only speech and SAFETY lines show; the newest of the
 *   most important other line is held, and shown heldAfterFight after the fight if still fresh.
 * - Information lines can be turned off apart from speech (Book 2 section 21).
 */
import type { TextBalance } from '../content/presentationBalance.ts';
import { CLASS_RANK } from './textAudit.ts';
import type { InfoClass } from './textAudit.ts';

export interface CaptionShown {
  readonly kind: 'speech' | 'info';
  readonly text: string;
  readonly cls: InfoClass | null;
  /** 0..1 opacity now. */
  readonly alpha: number;
}

interface Live {
  readonly kind: 'speech' | 'info';
  readonly text: string;
  readonly cls: InfoClass | null;
  readonly from: number;
  readonly until: number;
}

interface Outgoing {
  readonly line: Live;
  readonly at: number;
  readonly alpha: number;
}

interface Offer {
  readonly text: string;
  readonly cls: InfoClass;
  readonly at: number;
}

export interface CaptionFrame {
  readonly info: CaptionShown | null;
  readonly speech: CaptionShown | null;
  /** Lines being replaced, fading out over the cross-fade where the new line now sits. */
  readonly outgoing: readonly CaptionShown[];
  /** The line held through a fight, if any (tests). */
  readonly held: string | null;
}

export class CaptionDirector {
  readonly #b: TextBalance;
  #info: Live | null = null;
  #speech: Live | null = null;
  #outgoing: Outgoing[] = [];
  #held: Offer | null = null;
  #pendingInfo: Offer[] = [];
  #pendingSpeech: { text: string; at: number }[] = [];
  readonly #lastShown = new Map<string, number>();
  #fight = false;
  #fightEndedAt = -Infinity;
  /** Information captions shown (the display setting). */
  showInfo = true;

  constructor(balance: TextBalance) {
    this.#b = balance;
  }

  /** Offers an information line of a class (seconds on the frame's clock). */
  info(text: string, cls: InfoClass, now: number): void {
    if (text === '') return;
    this.#pendingInfo.push({ text, cls, at: now });
  }

  /** Offers a speech line ("Name: words"). */
  speech(text: string, now: number): void {
    if (text === '') return;
    this.#pendingSpeech.push({ text, at: now });
  }

  /** Clears everything (a reload). */
  clear(): void {
    this.#info = null;
    this.#speech = null;
    this.#outgoing = [];
    this.#held = null;
    this.#pendingInfo = [];
    this.#pendingSpeech = [];
  }

  #repeated(text: string, now: number): boolean {
    const at = this.#lastShown.get(text);
    return at !== undefined && now - at < this.#b.repeatSeconds;
  }

  #alpha(l: Live, now: number): number {
    const b = this.#b;
    const fadeIn = b.fadeInSeconds <= 0 ? 1 : Math.min(1, (now - l.from) / b.fadeInSeconds);
    const fadeOut = now <= l.until ? 1 : Math.max(0, 1 - (now - l.until) / b.fadeOutSeconds);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  #gone(l: Live | null, now: number): boolean {
    return l === null || now >= l.until + this.#b.fadeOutSeconds;
  }

  #replace(kind: 'speech' | 'info', next: Live, now: number): void {
    const old = kind === 'info' ? this.#info : this.#speech;
    if (old !== null && !this.#gone(old, now))
      this.#outgoing.push({ line: old, at: now, alpha: this.#alpha(old, now) });
    if (kind === 'info') this.#info = next;
    else this.#speech = next;
    this.#lastShown.set(next.text, now);
  }

  #speechHold(text: string): number {
    const h = this.#b.speechHold;
    return Math.max(h.min, Math.min(h.max, h.base + h.perChar * text.length));
  }

  #showInfo(o: Offer, now: number): void {
    const cur = this.#info;
    // A lower class does not cut a higher one short while it holds.
    if (
      cur !== null &&
      now < cur.until &&
      cur.cls !== null &&
      CLASS_RANK[cur.cls] > CLASS_RANK[o.cls]
    )
      return;
    this.#replace(
      'info',
      { kind: 'info', text: o.text, cls: o.cls, from: now, until: now + this.#b.infoHoldSeconds },
      now,
    );
  }

  /** Resolves the frame's offers and returns what shows (seconds; `fight`: Book 10 inFight). */
  update(now: number, fight: boolean): CaptionFrame {
    const b = this.#b;
    if (this.#fight && !fight) this.#fightEndedAt = now;
    this.#fight = fight;
    // Speech: the newest offer this frame, unless it repeats a line shown lately.
    const speech = this.#pendingSpeech.filter((s) => !this.#repeated(s.text, now));
    this.#pendingSpeech = [];
    const said = speech[speech.length - 1];
    if (said !== undefined) {
      this.#replace(
        'speech',
        {
          kind: 'speech',
          text: said.text,
          cls: null,
          from: now,
          until: now + this.#speechHold(said.text),
        },
        now,
      );
    }
    // Information: the highest class offered this frame (the newest of equals).
    const offers = this.#pendingInfo.filter((o) => !this.#repeated(o.text, now));
    this.#pendingInfo = [];
    if (this.showInfo) {
      let best: Offer | null = null;
      for (const o of offers)
        if (best === null || CLASS_RANK[o.cls] >= CLASS_RANK[best.cls]) best = o;
      if (best !== null) {
        if (fight && best.cls !== 'SAFETY') {
          // Held for after the fight: the newest of the most important.
          if (this.#held === null || CLASS_RANK[best.cls] >= CLASS_RANK[this.#held.cls])
            this.#held = best;
        } else this.#showInfo(best, now);
      }
      // In a fight a shown line that is not a safety line goes at once.
      if (
        fight &&
        this.#info !== null &&
        this.#info.cls !== 'SAFETY' &&
        !this.#gone(this.#info, now)
      ) {
        this.#outgoing.push({ line: this.#info, at: now, alpha: this.#alpha(this.#info, now) });
        this.#info = null;
      }
      // After the fight, the held line, if still fresh.
      const held = this.#held;
      if (!fight && held !== null && now - this.#fightEndedAt >= b.heldDelaySeconds) {
        this.#held = null;
        if (now - held.at < b.heldMaxAgeSeconds && !this.#repeated(held.text, now))
          this.#showInfo(held, now);
      }
    } else {
      this.#held = null;
      if (this.#info !== null) {
        this.#info = null;
      }
    }
    if (this.#gone(this.#info, now)) this.#info = null;
    if (this.#gone(this.#speech, now)) this.#speech = null;
    this.#outgoing = this.#outgoing.filter((o) => now - o.at < b.crossFadeSeconds);
    const shown = (l: Live | null): CaptionShown | null =>
      l === null ? null : { kind: l.kind, text: l.text, cls: l.cls, alpha: this.#alpha(l, now) };
    return {
      info: shown(this.#info),
      speech: shown(this.#speech),
      outgoing: this.#outgoing.map((o) => ({
        kind: o.line.kind,
        text: o.line.text,
        cls: o.line.cls,
        alpha: o.alpha * Math.max(0, 1 - (now - o.at) / Math.max(1e-6, b.crossFadeSeconds)),
      })),
      held: this.#held?.text ?? null,
    };
  }
}

/**
 * Book 10's inFight: any hostile alert to the steerer within `tiles`, or a blow struck or taken by
 * the steerer within the last `blowSeconds` (real seconds on the frame's clock).
 */
export function inFight(
  hostiles: readonly { readonly alert: boolean; readonly tiles: number }[],
  sinceBlow: number,
  b: Pick<TextBalance, 'fightTiles' | 'fightBlowSeconds'>,
): boolean {
  return hostiles.some((h) => h.alert && h.tiles <= b.fightTiles) || sinceBlow < b.fightBlowSeconds;
}

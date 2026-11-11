/**
 * The music state machine (Book 11 section 03). Pure: give it the time, it says what to start,
 * stop and mix, and when.
 *
 * - A state change lands on the next bar line of the playing cue.
 * - Intensity (0 to 1) mixes the stems: it rises within one bar and falls over four, so the
 *   music never flickers.
 * - A stinger ducks the music under it for its length.
 */
import type { CueDef } from '../content/registry.ts';

export interface MusicCue {
  readonly id: string;
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly stems: readonly string[];
}

export function barSeconds(cue: MusicCue): number {
  return (cue.beatsPerBar * 60) / cue.bpm;
}

/** The first bar line at or after `now` for a cue that started at `startedAt`. */
export function nextBarLine(startedAt: number, now: number, bar: number): number {
  if (now <= startedAt) return startedAt;
  const bars = Math.ceil((now - startedAt) / bar - 1e-9);
  return startedAt + bars * bar;
}

/** Moves intensity towards its target: a full rise takes one bar, a full fall four. */
export function approachIntensity(
  current: number,
  target: number,
  dt: number,
  bar: number,
): number {
  if (target > current) return Math.min(target, current + dt / bar);
  return Math.max(target, current - dt / (4 * bar));
}

/**
 * Stem gains for an intensity: the bed always plays; each later stem fades in across its share
 * of the intensity range.
 */
export function stemGains(stems: number, intensity: number): number[] {
  if (stems <= 1) return [1];
  return Array.from({ length: stems }, (_, i) => {
    if (i === 0) return 1;
    const share = 1 / (stems - 1);
    return Math.min(1, Math.max(0, (intensity - (i - 1) * share) / share));
  });
}

export type MusicAction =
  | { readonly type: 'start'; readonly cue: string; readonly at: number }
  | { readonly type: 'stop'; readonly cue: string; readonly at: number }
  | {
      readonly type: 'gains';
      readonly cue: string;
      readonly gains: readonly number[];
      readonly at: number;
    }
  | {
      readonly type: 'duck';
      readonly level: number;
      readonly from: number;
      readonly until: number;
    };

export class MusicDirector {
  readonly #cues: ReadonlyMap<string, MusicCue>;
  #playing: { cue: MusicCue; startedAt: number } | null = null;
  #pending: { cue: MusicCue; at: number } | null = null;
  /** When the playing cue is to stop (a bar line), for silence. */
  #stopAt: number | null = null;
  #intensity = 0;
  #target = 0;
  #lastUpdate: number | null = null;

  constructor(cues: Iterable<MusicCue>) {
    this.#cues = new Map([...cues].map((c) => [c.id, c]));
  }

  /** The cue playing now (or due to start). */
  get state(): string | null {
    if (this.#pending !== null) return this.#pending.cue.id;
    return this.#stopAt === null ? (this.#playing?.cue.id ?? null) : null;
  }

  get intensity(): number {
    return this.#intensity;
  }

  /** Asks for a new state. Returns the time it will start: now, or the next bar line. */
  request(id: string, now: number): number {
    const cue = this.#cues.get(id);
    if (cue === undefined) throw new Error(`No music cue "${id}"`);
    if (this.#stopAt !== null && this.#pending === null && this.#playing?.cue.id === id) {
      // Asked back before its stop landed: it simply plays on.
      this.#stopAt = null;
      return this.#playing.startedAt;
    }
    if (this.state === id) return this.#pending?.at ?? this.#playing?.startedAt ?? now;
    const at =
      this.#playing === null
        ? now
        : nextBarLine(this.#playing.startedAt, now, barSeconds(this.#playing.cue));
    this.#pending = { cue, at };
    this.#stopAt = null;
    return at;
  }

  /** Asks for silence: whatever plays stops on its next bar line (nothing pending starts). */
  silence(now: number): void {
    this.#pending = null;
    if (this.#playing === null || this.#stopAt !== null) return;
    this.#stopAt = nextBarLine(this.#playing.startedAt, now, barSeconds(this.#playing.cue));
  }

  setIntensity(target: number): void {
    this.#target = Math.min(1, Math.max(0, target));
  }

  /** A stinger of `beats` beats at the current tempo ducks the music to `level`. */
  stinger(beats: number, level: number, now: number): MusicAction {
    const cue = this.#playing?.cue ?? this.#pending?.cue;
    const beat = cue === undefined ? 0.5 : 60 / cue.bpm;
    return { type: 'duck', level, from: now, until: now + beats * beat };
  }

  /** Advances to `now` and returns what the audio engine should do. */
  update(now: number): MusicAction[] {
    const actions: MusicAction[] = [];
    if (this.#stopAt !== null && this.#playing !== null && now >= this.#stopAt - 0.25) {
      actions.push({ type: 'stop', cue: this.#playing.cue.id, at: this.#stopAt });
      this.#playing = null;
      this.#stopAt = null;
    }
    if (this.#pending !== null && now >= this.#pending.at - 0.25) {
      // Schedule slightly ahead so the switch lands exactly on the bar line.
      const { cue, at } = this.#pending;
      if (this.#playing !== null) actions.push({ type: 'stop', cue: this.#playing.cue.id, at });
      actions.push({ type: 'start', cue: cue.id, at });
      this.#playing = { cue, startedAt: at };
      this.#pending = null;
    }
    if (this.#playing !== null) {
      const dt = this.#lastUpdate === null ? 0 : Math.max(0, now - this.#lastUpdate);
      this.#intensity = approachIntensity(
        this.#intensity,
        this.#target,
        dt,
        barSeconds(this.#playing.cue),
      );
      actions.push({
        type: 'gains',
        cue: this.#playing.cue.id,
        gains: stemGains(this.#playing.cue.stems.length, this.#intensity),
        at: now,
      });
    }
    this.#lastUpdate = now;
    return actions;
  }
}

/** The music cues of an audio table. */
export function musicCues(cues: Iterable<CueDef>): MusicCue[] {
  return [...cues].flatMap((c) =>
    c.kind === 'music' &&
    c.bpm !== undefined &&
    c.beatsPerBar !== undefined &&
    c.stems !== undefined
      ? [{ id: c.id, bpm: c.bpm, beatsPerBar: c.beatsPerBar, stems: c.stems }]
      : [],
  );
}

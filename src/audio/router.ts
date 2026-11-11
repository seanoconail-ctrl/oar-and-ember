/**
 * Routes audio: game events to cues through the content table (Book 11 section 10), cues to the
 * music director, effects and ambience, and every gameplay-relevant sound to a caption (Book 11
 * section 09). The sound itself goes to an `AudioSink`: Web Audio in the browser, a recorder in
 * tests. Audio never reads hidden truth: it hears only the events it is given.
 */
import type { AudioTable, CueDef } from '../content/registry.ts';
import { formatString } from '../content/strings.ts';
import type { StringTable } from '../content/strings.ts';
import { MusicDirector, musicCues } from './music.ts';
import type { MusicAction } from './music.ts';

export type Bus = 'master' | 'music' | 'ambience' | 'effects' | 'voice' | 'tells';
export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface AudioSink {
  music(action: MusicAction): void;
  oneShot(cue: CueDef, at: number, pan: number): void;
  ambience(cues: readonly CueDef[], at: number): void;
  setVolume(bus: Bus, level: number): void;
}

export interface Caption {
  readonly text: string;
  /** Sound captions are information, never speech (design addendum 2.3 section 10). */
  readonly kind: 'info';
  readonly cue: string;
  readonly until: number;
}

export class AudioRouter {
  readonly #table: AudioTable;
  readonly #cues: ReadonlyMap<string, CueDef>;
  readonly #strings: StringTable;
  readonly #sink: AudioSink;
  readonly director: MusicDirector;
  #captions: Caption[] = [];
  #ambience: string[] = [];

  constructor(table: AudioTable, strings: StringTable, sink: AudioSink) {
    this.#table = table;
    this.#cues = new Map(table.cues.map((c) => [c.id, c]));
    this.#strings = strings;
    this.#sink = sink;
    this.director = new MusicDirector(musicCues(table.cues));
  }

  #caption(cue: CueDef, now: number, direction?: Direction): void {
    if (cue.captionKey === undefined) return;
    let text = formatString(this.#strings, cue.captionKey);
    if (direction !== undefined) {
      text = formatString(this.#strings, 'caption.format.with_direction', {
        caption: text,
        direction: formatString(this.#strings, `caption.direction.${direction}`),
      });
    }
    this.#captions = this.#captions.filter((c) => c.cue !== cue.id || c.text !== text);
    this.#captions.push({
      text,
      kind: 'info',
      cue: cue.id,
      until: now + this.#table.captionSeconds,
    });
  }

  #cue(id: string): CueDef {
    const cue = this.#cues.get(id);
    if (cue === undefined) throw new Error(`No audio cue "${id}"`);
    return cue;
  }

  /** Plays a cue by ID: music changes state on the next bar, stingers duck the music. */
  play(id: string, now: number, options: { direction?: Direction; pan?: number } = {}): void {
    const cue = this.#cue(id);
    switch (cue.kind) {
      case 'music':
        this.director.request(id, now);
        break;
      case 'stinger':
        this.#sink.music(this.director.stinger(cue.lengthBeats ?? 4, this.#table.stingerDuck, now));
        this.#sink.oneShot(cue, now, 0);
        break;
      case 'sfx':
        this.#sink.oneShot(cue, now, options.pan ?? 0);
        break;
      case 'ambience':
        return;
    }
    this.#caption(cue, now, options.direction);
  }

  /** Lets the music end on its next bar line, leaving ambience only (Book 11 section 03). */
  silence(now: number): void {
    this.director.silence(now);
  }

  /** A game event, mapped through the content table. Returns the cue it played, if any. */
  event(
    name: string,
    now: number,
    options: { direction?: Direction; pan?: number } = {},
  ): string | null {
    const id = this.#table.events[name];
    if (id === undefined) return null;
    this.play(id, now, options);
    return id;
  }

  /** The ambience layers for a zone and time of day (Book 11 section 07). */
  setPlace(zone: string, phase: 'dawn' | 'day' | 'dusk' | 'night', now: number): readonly string[] {
    const layers = this.#table.cues.filter(
      (c) =>
        c.kind === 'ambience' &&
        (c.zones?.includes(zone) ?? false) &&
        (c.phases === undefined || c.phases.includes(phase)),
    );
    const ids = layers.map((c) => c.id);
    if (ids.join() !== this.#ambience.join()) {
      this.#ambience = ids;
      this.#sink.ambience(layers, now);
    }
    return ids;
  }

  /** Advances music and captions; returns the captions showing at `now`. */
  update(now: number): readonly Caption[] {
    for (const action of this.director.update(now)) this.#sink.music(action);
    this.#captions = this.#captions.filter((c) => c.until > now);
    return this.#captions;
  }
}

/**
 * The sequencer (Book 11 section 03): plays a piece's layers on the synthesiser, looping
 * seamlessly, and makes every change on a bar line: a layer switched on or off, a variant
 * (season), a stop. Notes are scheduled a little ahead of the audio clock, so timing does not
 * depend on the frame rate; an offline render schedules everything at once.
 */
import type { SynthEngine } from './engine.ts';
import { modeClasses, parseLayer, stepSeconds, stepUp } from './notation.ts';
import type { ParsedNote, Piece, Variant } from './notation.ts';
import { rng } from './samples.ts';
import { layerJoinAt } from '../music.ts';

interface LiveLayer {
  readonly id: string;
  readonly instrument: string;
  readonly group: string | undefined;
  readonly echo: number;
  readonly gain: GainNode;
  readonly level: number;
  notes: readonly ParsedNote[];
  on: boolean;
  /** Bars (1-based) in which it rests in the current variant. */
  rest: ReadonlySet<number>;
}

export class PiecePlayer {
  readonly piece: Piece;
  readonly #engine: SynthEngine;
  readonly #out: GainNode;
  #layers: LiveLayer[] = [];
  #variant: Variant | null = null;
  #tempo: number;
  #classes: Set<number>;
  #start = 0;
  /** Absolute bar index from which the current settings hold, and the time it starts. */
  #anchorBar = 0;
  #anchorTime = 0;
  #nextBar = 0;
  #stopped = false;
  /** Design addendum 2.4 (DE-29): when a fade-out ends, and the bar each layer joins at. */
  #fadeEnd: number | null = null;
  #joinBar = new Map<string, number>();
  #pending: (() => void)[] = [];
  readonly #jitter = rng(77);

  constructor(engine: SynthEngine, piece: Piece, variant: string | null = null) {
    this.piece = piece;
    this.#engine = engine;
    this.#out = engine.ctx.createGain();
    this.#out.connect(engine.buses.music);
    this.#tempo = piece.tempo;
    this.#classes = modeClasses(piece.mode);
    for (const layer of piece.layers) {
      const g = engine.ctx.createGain();
      g.gain.value = layer.on === false ? 0 : layer.gain;
      g.connect(this.#out);
      this.#layers.push({
        id: layer.id,
        instrument: layer.instrument,
        group: layer.group,
        echo: layer.echo,
        gain: g,
        level: layer.gain,
        notes: [],
        on: layer.on !== false,
        rest: new Set(),
      });
    }
    this.#applyVariant(variant);
  }

  get barSeconds(): number {
    return stepSeconds(this.piece, this.#tempo) * this.piece.beatsPerBar * this.piece.stepsPerBeat;
  }

  #applyVariant(id: string | null): void {
    const v = id === null ? null : (this.piece.variants?.find((x) => x.id === id) ?? null);
    this.#variant = v;
    this.#tempo = v?.tempo ?? this.piece.tempo;
    this.#classes = modeClasses(v?.mode ?? this.piece.mode);
    for (const live of this.#layers) {
      const def = this.piece.layers.find((l) => l.id === live.id);
      if (def === undefined) continue;
      live.notes = parseLayer(this.piece, def, v?.map ?? {}).notes;
      live.rest = new Set(v?.rest?.[live.id] ?? []);
      const want = v?.layers?.[live.id];
      if (want !== undefined) live.on = want;
    }
    this.#engine.setEcho({ ...this.piece.echo, ...(v?.echo ?? {}) });
  }

  /** The time the next bar line falls (changes made now take effect there). */
  nextBarTime(): number {
    return this.#anchorTime + (this.#nextBar - this.#anchorBar) * this.barSeconds;
  }

  /**
   * Starts at `at`. With a fade (decision DE-29) the piece rises from silence over `fadeIn` seconds
   * and begins with one layer, the others joining one at a time on bar lines over `layersJoin`.
   */
  start(at: number, fadeIn = 0, layersJoin = 0): void {
    // Layers switched before the start (a cue's own layers) land at the start, so the one layer
    // that begins alone and the order the rest join in are the cue's, not the whole piece's
    // (decision S13-64).
    const before = this.#pending;
    this.#pending = [];
    for (const f of before) f();
    this.#start = at;
    this.#anchorBar = 0;
    this.#anchorTime = at;
    this.#nextBar = 0;
    this.#stopped = false;
    this.#fadeEnd = null;
    const g = this.#out.gain;
    g.setValueAtTime(fadeIn > 0 ? 0 : 1, at);
    if (fadeIn > 0) g.linearRampToValueAtTime(1, at + fadeIn);
    this.#joinBar.clear();
    const on = this.#layers.filter((l) => l.on);
    on.forEach((l, i) => {
      const t = layerJoinAt(i, on.length, layersJoin, this.barSeconds);
      this.#joinBar.set(l.id, Math.round(t / this.barSeconds));
    });
    for (const l of this.#layers) l.gain.gain.setValueAtTime(this.#playing(l, 0) ? l.level : 0, at);
  }

  /** Whether a layer sounds in bar `bar` (on, and joined). */
  #playing(l: LiveLayer, bar: number): boolean {
    return l.on && bar >= (this.#joinBar.get(l.id) ?? 0);
  }

  /** Switches a layer (or every layer of a group) on or off at the next bar line. */
  setLayer(idOrGroup: string, on: boolean): void {
    this.#pending.push(() => {
      for (const l of this.#layers) if (l.id === idOrGroup || l.group === idOrGroup) l.on = on;
    });
  }

  isOn(id: string): boolean {
    return this.#layers.find((l) => l.id === id)?.on ?? false;
  }

  /** Changes variant (a season) at the next bar line. */
  setVariant(id: string | null): void {
    this.#pending.push(() => {
      // Keep the bar grid continuous through the tempo change.
      const t = this.nextBarTime();
      this.#anchorBar = this.#nextBar;
      this.#anchorTime = t;
      this.#applyVariant(id);
    });
  }

  /**
   * Stops at the next bar line, letting the last notes ring; with a fade (decision DE-29) it
   * plays on while it fades out over `fadeOut` seconds.
   */
  stop(fadeOut = 0): void {
    this.#pending.push(() => {
      const t = this.nextBarTime();
      if (fadeOut > 0) {
        const g = this.#out.gain;
        g.setValueAtTime(1, t);
        g.linearRampToValueAtTime(0, t + fadeOut);
        this.#fadeEnd = t + fadeOut;
        return;
      }
      this.#stopped = true;
      this.#out.gain.setTargetAtTime(0, t, 0.4);
    });
  }

  /** Whether a stop has landed (on a bar line). */
  get stopped(): boolean {
    return this.#stopped;
  }

  /** The variant playing (a season), or null for the piece as written. */
  get variant(): string | null {
    return this.#variant?.id ?? null;
  }

  get startTime(): number {
    return this.#start;
  }

  /** Schedules every bar that starts before `until`. Call often (live) or once (offline). */
  schedule(until: number): void {
    const perBar = this.piece.beatsPerBar * this.piece.stepsPerBeat;
    while (!this.#stopped) {
      const barTime = this.nextBarTime();
      if (barTime >= until) break;
      // Changes asked for since the last bar land on this bar line.
      if (this.#pending.length > 0) {
        const todo = this.#pending;
        this.#pending = [];
        for (const f of todo) f();
        if (this.stopped) break;
      }
      const t0 = this.nextBarTime();
      // Faded out: it stops here.
      if (this.#fadeEnd !== null && t0 >= this.#fadeEnd) {
        this.#stopped = true;
        break;
      }
      for (const l of this.#layers) {
        l.gain.gain.setTargetAtTime(this.#playing(l, this.#nextBar) ? l.level : 0, t0, 0.05);
      }
      const barInPiece = this.#nextBar % this.piece.bars;
      const step = stepSeconds(this.piece, this.#tempo);
      const from = barInPiece * perBar;
      for (const l of this.#layers) {
        if (!this.#playing(l, this.#nextBar) || l.rest.has(barInPiece + 1)) continue;
        for (const n of l.notes) {
          if (n.step < from || n.step >= from + perBar) continue;
          // A little human looseness on plucked and struck notes (a few milliseconds).
          const loose =
            l.instrument === 'lyre' || l.instrument === 'harp' ? (this.#jitter() - 0.5) * 0.012 : 0;
          const at = t0 + (n.step - from) * step + Math.max(0, loose);
          const seconds = n.length * step * 0.96;
          if (n.cut) {
            const grace = Math.min(0.055, step * 0.3);
            this.#engine.playNote(
              l.instrument,
              stepUp(n.midi, this.#classes),
              at,
              grace,
              n.velocity * 0.8,
              l.gain,
              l.echo,
            );
            this.#engine.playNote(
              l.instrument,
              n.midi,
              at + grace,
              seconds - grace,
              n.velocity,
              l.gain,
              l.echo,
            );
          } else
            this.#engine.playNote(l.instrument, n.midi, at, seconds, n.velocity, l.gain, l.echo);
        }
      }
      this.#nextBar++;
    }
  }

  /** Seconds for one pass of the piece at the current tempo. */
  get loopSeconds(): number {
    return this.barSeconds * this.piece.bars;
  }
}

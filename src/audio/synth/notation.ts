/**
 * Music as note data (Book 11 section 10, generated audio). A piece is tempo, metre, mode and
 * layers; each layer is one instrument playing a line written as text, bar by bar:
 *
 *   "D5:2 A4 B4:2 A4 | ~G4:2 E4 D4:3 | [D3 A3]:6 | r:6"
 *
 * - A note is a pitch (C4, F#3, Bb2), an optional length in steps after a colon (default 1),
 *   and optional marks: `!` accented, `,` soft, and a leading `~` for a cut (a quick grace note
 *   one scale step above, as a Celtic whistle or harp ornament does).
 * - `[D3 A3]` is a chord (one voice per note); `r` is a rest; `|` marks a bar line and every
 *   bar must add up to the metre (a note may tie over a bar line by being longer than the
 *   steps left in its bar, then the bars it covers are written as `-`).
 *
 * Parsing is pure, so tests can check every piece: bar lengths, the mode, the voice count.
 */

export interface ParsedNote {
  /** Start, in steps from the beginning of the piece. */
  readonly step: number;
  /** Length in steps. */
  readonly length: number;
  /** MIDI note number. */
  readonly midi: number;
  readonly velocity: number;
  /** A grace note before it (a cut), as a MIDI note, or null. */
  readonly cut: boolean;
}

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly instrument: string;
  readonly gain: number;
  readonly pan: number;
  /** Send to the shared echo, 0..1. */
  readonly echo: number;
  /** Bar-by-bar text, joined with bar lines. */
  readonly bars: readonly string[];
  /** Layers in a group switch together (e.g. "alarm"). */
  readonly group?: string;
  /** On when the piece starts. */
  readonly on?: boolean;
}

export interface Variant {
  readonly id: string;
  readonly name: string;
  readonly tempo?: number;
  readonly mode?: string;
  /** Pitch-class changes, e.g. { "F#": "F" } to turn Dorian into Aeolian. */
  readonly map?: Readonly<Record<string, string>>;
  /** Layers on (true) or off (false) in this variant. */
  readonly layers?: Readonly<Record<string, boolean>>;
  /** Bars (1-based) in which a layer rests. */
  readonly rest?: Readonly<Record<string, readonly number[]>>;
  /** Echo overrides. */
  readonly echo?: Partial<Echo>;
}

export interface Echo {
  /** Seconds. */
  readonly delay: number;
  readonly feedback: number;
  /** Wet level 0..1. */
  readonly mix: number;
  /** Low-pass in the loop, Hz. */
  readonly tone: number;
}

export interface Piece {
  readonly id: string;
  readonly title: string;
  readonly about: string;
  /** e.g. "D dorian". */
  readonly mode: string;
  /** Beats a minute. */
  readonly tempo: number;
  readonly beatsPerBar: number;
  readonly stepsPerBeat: number;
  readonly bars: number;
  readonly echo: Echo;
  readonly layers: readonly Layer[];
  readonly variants?: readonly Variant[];
}

const NAMES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** MIDI number of a pitch name such as F#4 or Bb2. */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (m === null) throw new Error(`not a pitch: "${name}"`);
  const base = NAMES[m[1] ?? 'C'] ?? 0;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

export function pitchClass(midi: number): string {
  return SHARP[((midi % 12) + 12) % 12] ?? 'C';
}

const MODES: Readonly<Record<string, readonly number[]>> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

/** The pitch classes (0..11) of a mode such as "D dorian". */
export function modeClasses(mode: string): Set<number> {
  const [tonic = 'C', name = 'ionian'] = mode.split(' ');
  const root = midiOf(`${tonic}4`) % 12;
  const steps = MODES[name];
  if (steps === undefined) throw new Error(`unknown mode "${mode}"`);
  return new Set(steps.map((s) => (root + s) % 12));
}

/** The next note up in the mode from `midi` (for a cut). */
export function stepUp(midi: number, classes: ReadonlySet<number>): number {
  for (let m = midi + 1; m < midi + 13; m++) if (classes.has(((m % 12) + 12) % 12)) return m;
  return midi + 2;
}

export interface ParsedLayer {
  readonly notes: readonly ParsedNote[];
  readonly totalSteps: number;
  readonly problems: readonly string[];
}

/** Parses one layer's text. `map` changes pitch classes (a seasonal mode change). */
export function parseLayer(
  piece: Pick<Piece, 'beatsPerBar' | 'stepsPerBeat' | 'bars'>,
  layer: Pick<Layer, 'id' | 'bars'>,
  map: Readonly<Record<string, string>> = {},
): ParsedLayer {
  const perBar = piece.beatsPerBar * piece.stepsPerBeat;
  const notes: ParsedNote[] = [];
  const problems: string[] = [];
  let step = 0;
  let carry = 0; // steps of a tied note still to cover in the following bars
  const text = layer.bars.join(' | ');
  const bars = text.split('|').map((b) => b.trim());
  bars.forEach((bar, b) => {
    if (bar === '-') {
      // A bar covered by a note tied from an earlier bar (the step count already includes it).
      if (carry < perBar) problems.push(`${layer.id} bar ${b + 1}: "-" with no tied note`);
      carry = Math.max(0, carry - perBar);
      return;
    }
    if (carry > 0) {
      problems.push(`${layer.id} bar ${b + 1}: a tied note still sounds; write "-"`);
      step += carry;
      carry = 0;
    }
    const barStart = step;
    for (const token of bar.split(/\s+/).filter((t) => t !== '')) {
      const m = /^(~)?(\[[^\]]+\]|r|[A-G](?:#|b)?-?\d)(?::(\d+))?([!,])?$/.exec(token);
      if (m === null) {
        problems.push(`${layer.id} bar ${b + 1}: cannot read "${token}"`);
        continue;
      }
      const length = Number(m[3] ?? 1);
      const velocity = m[4] === '!' ? 1 : m[4] === ',' ? 0.55 : 0.8;
      const body = m[2] ?? 'r';
      if (body !== 'r') {
        const pitches = body.startsWith('[') ? body.slice(1, -1).split(/\s+/) : [body];
        for (const p of pitches) {
          let midi: number;
          try {
            midi = midiOf(p);
          } catch {
            problems.push(`${layer.id} bar ${b + 1}: not a pitch "${p}"`);
            continue;
          }
          const to = map[pitchClass(midi)];
          if (to !== undefined) {
            const delta = (midiOf(`${to}4`) - midiOf(`${pitchClass(midi)}4`) + 18) % 12;
            midi += delta - 6;
          }
          notes.push({ step, length, midi, velocity, cut: m[1] === '~' });
        }
      }
      step += length;
    }
    const used = step - barStart;
    if (used < perBar) {
      problems.push(`${layer.id} bar ${b + 1}: ${used} steps, the metre needs ${perBar}`);
      step = barStart + perBar;
    } else if (used > perBar) {
      const over = used - perBar;
      if (over % perBar !== 0)
        problems.push(`${layer.id} bar ${b + 1}: ${used} steps; a tie must cover whole bars`);
      // The step count already runs past this bar; the covered bars are written "-".
      carry = over;
    }
  });
  if (carry > 0) problems.push(`${layer.id}: a tied note runs past the end`);
  const totalSteps = piece.bars * perBar;
  if (step !== totalSteps)
    problems.push(`${layer.id}: ${step / perBar} bars written, the piece has ${piece.bars}`);
  return { notes, totalSteps, problems };
}

/** Seconds per step at a tempo. */
export function stepSeconds(piece: Pick<Piece, 'stepsPerBeat'>, tempo: number): number {
  return 60 / tempo / piece.stepsPerBeat;
}

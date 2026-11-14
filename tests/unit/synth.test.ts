/**
 * Generated audio (Book 11 audio standard): the music's note data, the instrument samples, the
 * voice blips and the captions, checked without a sound card. Rendering and timing are checked
 * in the browser (tests/browser/sound.spec.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, MUSIC_VOICES } from '../../src/audio/synth/engine.ts';
import { midiOf, modeClasses, parseLayer, stepSeconds } from '../../src/audio/synth/notation.ts';
import type { Piece } from '../../src/audio/synth/notation.ts';
import { makeSamples, SAMPLE_RATE } from '../../src/audio/synth/samples.ts';
import { COMBAT, TELLS } from '../../src/audio/synth/sfx.ts';
import { syllables, VOICES } from '../../src/audio/synth/voice.ts';
import { parseStringTable } from '../../src/content/strings.ts';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';

const piece = (name: string): Piece =>
  JSON.parse(readFileSync(join(REPO_ROOT, 'content/music', `${name}.json`), 'utf8')) as Piece;
const PIECES = ['hearth', 'skarvholm', 'raid', 'combat'].map(piece);
const UNPITCHED = new Set(['drum', 'knock', 'gull']);
const strings = parseStringTable(
  JSON.parse(readFileSync(join(REPO_ROOT, 'content/strings/en.json'), 'utf8')) as unknown,
  'en.json',
);

describe('the music as note data', () => {
  it('writes every bar to its metre and every layer to the length of its piece', () => {
    for (const p of PIECES)
      for (const l of p.layers) expect(parseLayer(p, l).problems, `${p.id} ${l.id}`).toEqual([]);
  });

  it('catches a bar that does not fit the metre', () => {
    const p = { beatsPerBar: 2, stepsPerBeat: 3, bars: 1 };
    expect(parseLayer(p, { id: 'x', bars: ['D4:5'] }).problems[0]).toMatch(/5 steps/);
    expect(parseLayer(p, { id: 'x', bars: ['D4:6'] }).problems).toEqual([]);
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#3')).toBe(54);
  });

  it('keeps every pitched note in its mode, in every season', () => {
    for (const p of PIECES) {
      const versions = [
        { mode: p.mode, map: {} },
        ...(p.variants ?? []).map((v) => ({ mode: v.mode ?? p.mode, map: v.map ?? {} })),
      ];
      for (const { mode, map } of versions) {
        const classes = modeClasses(mode);
        for (const l of p.layers) {
          if (UNPITCHED.has(l.instrument)) continue;
          const out = parseLayer(p, l, map).notes.filter((n) => !classes.has(n.midi % 12));
          expect(
            out.map((n) => n.midi),
            `${p.id} ${mode} ${l.id}`,
          ).toEqual([]);
        }
      }
    }
  });

  it('uses Dorian and Aeolian, as the standard asks', () => {
    expect(PIECES.map((p) => p.mode)).toEqual(['D dorian', 'A dorian', 'E aeolian', 'D aeolian']);
    expect(piece('skarvholm').variants?.find((v) => v.id === 'winter')?.mode).toBe('A aeolian');
  });

  it(`never needs more than ${MUSIC_VOICES} voices at once (SNES-like limits)`, () => {
    for (const p of PIECES) {
      const versions: (Record<string, boolean> | undefined)[] = [
        undefined,
        { alarm: true, calm: false },
      ];
      for (const on of versions) {
        const step = stepSeconds(p, p.tempo);
        const spans: [number, number][] = [];
        for (const l of p.layers) {
          const active = on?.[l.group ?? l.id] ?? on?.[l.id] ?? l.on !== false;
          if (!active) continue;
          const def = INSTRUMENTS[l.instrument];
          const ring = def?.ring ?? 0;
          for (const n of parseLayer(p, l).notes) {
            const start = n.step * step;
            // A one-shot (a call, a click) sounds its whole sample, about half a second.
            const length =
              def?.oneShot === true ? Math.max(0.6, n.length * step) : n.length * step + ring;
            spans.push([start, start + length]);
          }
        }
        let most = 0;
        for (const [s] of spans)
          most = Math.max(most, spans.filter(([a, b]) => a <= s + 1e-6 && b > s + 1e-6).length);
        expect(most, `${p.id}${on === undefined ? '' : ' with the alarm'}`).toBeLessThanOrEqual(
          MUSIC_VOICES,
        );
      }
    }
  });

  it('gives the hearth theme its growth layers and a pass of about thirty seconds or more', () => {
    const h = piece('hearth');
    expect(h.layers.map((l) => l.id)).toEqual(['drone', 'lyre', 'melody', 'voice', 'harp', 'drum']);
    const seconds = h.bars * h.beatsPerBar * (60 / h.tempo);
    expect(seconds).toBeGreaterThan(30);
    expect(seconds).toBeLessThan(45);
  });
});

describe('the generated instruments', () => {
  const a = makeSamples();
  const b = makeSamples();

  it('are deterministic (the same build always sounds the same)', () => {
    for (const name of Object.keys(a) as (keyof typeof a)[])
      expect(Array.from(a[name].data.slice(0, 4000)), name).toEqual(
        Array.from(b[name].data.slice(0, 4000)),
      );
  });

  it('never clip, and loop without a click', () => {
    for (const [name, s] of Object.entries(a)) {
      let peak = 0;
      for (const v of s.data) peak = Math.max(peak, Math.abs(v));
      expect(peak, name).toBeLessThanOrEqual(1);
      if (s.loop === null) continue;
      const start = Math.round(s.loop.start * SAMPLE_RATE);
      const end = Math.round(s.loop.end * SAMPLE_RATE) - 1;
      // The sample just before the loop start and the loop's last sample are neighbours in time.
      const jump = Math.abs((s.data[end] ?? 0) - (s.data[start - 1] ?? 0));
      expect(jump, name).toBeLessThan(0.12);
    }
  });

  it('cover the instruments the standard names', () => {
    expect(Object.keys(INSTRUMENTS).sort()).toEqual([
      'bells',
      'drone',
      'drum',
      'flute',
      'gull',
      'harp',
      'horn',
      'knock',
      'lyre',
      'pad',
      'whistle',
    ]);
  });
});

describe('sounds, tells and voices', () => {
  it('captions every combat sound and tell', () => {
    for (const d of [...COMBAT, ...TELLS])
      expect(strings.has(d.captionKey), d.captionKey).toBe(true);
    expect(COMBAT.map((d) => d.id)).toEqual([
      'SFX_HIT_LIGHT',
      'SFX_CHARGE_LEVEL_1',
      'SFX_CHARGE_LEVEL_2',
      'SFX_PARRY',
      'SFX_BLOCK',
      'SFX_GUARD_BREAK',
    ]);
    expect(TELLS.map((d) => d.id)).toEqual([
      'SFX_TELL_RAN',
      'SFX_TELL_MANANNAN',
      'SFX_TELL_DRAUGR',
    ]);
  });

  it('gives each speaker a voice of their own, and the steerer none', () => {
    const ids = Object.keys(VOICES);
    // Stage 8: every resident of Book 5 section 17 (the first four as the sound test first had them).
    expect(ids.slice(0, 4)).toEqual(['C_HILD', 'C_BRAN', 'C_RUNA', 'C_ODDI']);
    expect(ids).toHaveLength(17);
    expect(ids.some((id) => id.includes('STEERER'))).toBe(false);
    const pitches = new Set(Object.values(VOICES).map((v) => v.pitch));
    expect(pitches.size).toBe(ids.length);
  });

  it('speaks one blip a syllable, pausing at punctuation', () => {
    const s = syllables("Over here! I'd come to you.");
    expect(s.length).toBe(7);
    expect(s[2]?.pause).toBeGreaterThan(0.1);
    expect(s.at(-1)?.end).toBe('.');
  });
});

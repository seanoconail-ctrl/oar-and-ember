/**
 * The Book 3 audio acceptance check, for every stage (decision AU-11): every sound event in the
 * content files has a generated implementation and a caption, and every cue has its sound.
 */
import { describe, expect, it } from 'vitest';
import { AMBIENCES, PIECES, SOUNDS } from '../../src/audio/synth/cues.ts';
import { SURFACES } from '../../src/audio/synth/footsteps.ts';
import { VOICES } from '../../src/audio/synth/voice.ts';
import { loadContent } from '../../src/content/registry.ts';
import { readContentFiles } from '../../src/tools/content/loadContentFiles.ts';
import { repoFile } from './books.ts';

const { content, issues } = loadContent(readContentFiles());
const table = content.audio;

describe('audio coverage (Book 11 section 12; every stage, Book 3)', () => {
  it('loads the audio table', () => {
    expect(issues).toEqual([]);
    expect(table).not.toBeNull();
  });

  it('gives every cue a generated implementation', () => {
    const missing = (table?.cues ?? [])
      .filter((cue) => {
        switch (cue.kind) {
          case 'music':
            return cue.piece === undefined || PIECES[cue.piece] === undefined;
          case 'sfx':
          case 'stinger':
            return !SOUNDS.has(cue.id);
          case 'ambience':
            return AMBIENCES[cue.id] === undefined;
        }
        return true;
      })
      .map((cue) => cue.id);
    expect(missing).toEqual([]);
  });

  it('maps every sound event to a cue with a caption that exists', () => {
    const cues = new Map((table?.cues ?? []).map((c) => [c.id, c]));
    for (const [event, id] of Object.entries(table?.events ?? {})) {
      const cue = cues.get(id);
      expect(cue, event).toBeDefined();
      expect(cue?.captionKey, event).toBeDefined();
      expect(content.strings.has(cue?.captionKey ?? ''), event).toBe(true);
    }
  });

  it('captions every generated one-shot', () => {
    for (const def of SOUNDS.values())
      expect(content.strings.has(def.captionKey), def.id).toBe(true);
  });

  it('keeps each music cue in time with its piece, so changes land on its bar lines', () => {
    for (const cue of table?.cues ?? []) {
      if (cue.kind !== 'music' || cue.piece === undefined) continue;
      const piece = PIECES[cue.piece];
      expect(cue.bpm, cue.id).toBe(piece?.tempo);
      expect(cue.beatsPerBar, cue.id).toBe(piece?.beatsPerBar);
      for (const layer of Object.keys(cue.layers ?? {}))
        expect(
          piece?.layers.some((l) => l.id === layer || l.group === layer),
          `${cue.id} ${layer}`,
        ).toBe(true);
    }
  });

  it('has a footstep for every surface the game can step on', () => {
    const surfaces = /export type Surface = ([^;]+);/.exec(
      repoFile('src/scenes/zoneVisuals.ts'),
    )?.[1];
    const named = [...(surfaces ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(0);
    for (const s of named) expect(SURFACES as readonly string[], s).toContain(s);
  });

  it('gives every person who speaks in the opening a voice', () => {
    const caller = content.opening?.caller ?? '';
    expect(VOICES[caller], caller).toBeDefined();
  });
});

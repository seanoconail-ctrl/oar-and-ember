/**
 * Stage 7 acceptance check 7 (in part): home music by time of day keeps at least a third of home
 * time ambience only (Book 11 sections 03 and 12), changes land on bar lines, the island theme
 * plays away from the steading, and every home sound is generated and captioned.
 */
import { describe, expect, it } from 'vitest';
import { barSeconds, MusicDirector, musicCues } from '../../src/audio/music.ts';
import { homeCue, ISLAND_CUE, PlaceMusic, restShare } from '../../src/audio/placeMusic.ts';
import type { Place } from '../../src/audio/placeMusic.ts';
import { AudioRouter } from '../../src/audio/router.ts';
import { AMBIENCES, HOME_LIFE, SOUNDS } from '../../src/audio/synth/cues.ts';
import { HOME } from '../../src/audio/synth/home.ts';
import type { HomePhase } from '../../src/audio/synth/home.ts';
import { RecordingSink } from '../../src/audio/webAudio.ts';
import { loadContent } from '../../src/content/registry.ts';
import { readContentFiles } from '../../src/tools/content/loadContentFiles.ts';

const { content } = loadContent(readContentFiles());
const loaded = content.audio;
if (loaded === null) throw new Error('content/audio.json did not load');
const table = loaded;
const home = table.home;
if (home === undefined) throw new Error('content/audio.json has no home settings');
const plan = home;

/** Plays a stretch of home time through the planner and the director, sampled every 0.25 s. */
function homeTime(
  seconds: number,
  phaseAt: (t: number) => HomePhase,
  first = 0,
): { silent: number; starts: { cue: string; at: number }[]; stops: { at: number }[] } {
  const music = new PlaceMusic(plan);
  const director = new MusicDirector(musicCues(table.cues));
  let silent = 0;
  const starts: { cue: string; at: number }[] = [];
  const stops: { at: number }[] = [];
  for (let t = first; t < first + seconds; t += 0.25) {
    const place: Place = { allowed: true, home: true, phase: phaseAt(t) };
    const want = music.want(t, place);
    if (want === null) director.silence(t);
    else if (director.state !== want) director.request(want, t);
    for (const a of director.update(t)) {
      if (a.type === 'start') starts.push({ cue: a.cue, at: a.at });
      if (a.type === 'stop') stops.push({ at: a.at });
    }
    if (director.state === null) silent += 0.25;
  }
  return { silent, starts, stops };
}

describe('home music (Book 11 sections 03 and 12; Stage 7)', () => {
  it('keeps at least a third of home time ambience only, through every part of the day', () => {
    expect(restShare(plan)).toBeGreaterThanOrEqual(1 / 3);
    const phases: HomePhase[] = ['dawn', 'day', 'dusk', 'night'];
    // Two hours of real time at home, the part of the day turning every 7 minutes.
    const r = homeTime(7200, (t) => phases[Math.floor(t / 420) % 4] ?? 'day');
    expect(r.silent / 7200).toBeGreaterThanOrEqual(1 / 3);
    // And it is not all silence: the hearth theme does play.
    expect(r.silent / 7200).toBeLessThan(0.6);
    expect(new Set(r.starts.map((s) => s.cue))).toEqual(new Set(phases.map(homeCue)));
  });

  it('starts each visit with ambience only, and the first fire brings the music in', () => {
    const music = new PlaceMusic(plan);
    const home: Place = { allowed: true, home: true, phase: 'dusk' };
    expect(music.want(0, home)).toBeNull();
    expect(music.want(plan.restSeconds - 1, home)).toBeNull();
    expect(music.want(plan.restSeconds + 1, home)).toBe('MUS_HOME_DUSK');
    const again = new PlaceMusic(plan);
    expect(again.want(5, home)).toBeNull();
    again.begin(6);
    expect(again.want(6, home)).toBe('MUS_HOME_DUSK');
  });

  it('plays nothing in the opening, and the island theme away from the steading', () => {
    const music = new PlaceMusic(plan);
    expect(music.want(0, { allowed: false, home: false, phase: 'day' })).toBeNull();
    expect(music.want(1, { allowed: true, home: false, phase: 'day' })).toBe(ISLAND_CUE);
    expect(table.cues.find((c) => c.id === ISLAND_CUE)?.piece).toBe('skarvholm');
  });

  it('plays the hearth theme for every part of the day, sparse at night', () => {
    const layersOn = (id: string): string[] =>
      Object.entries(table.cues.find((c) => c.id === id)?.layers ?? {})
        .filter(([, on]) => on)
        .map(([l]) => l);
    for (const p of ['dawn', 'day', 'dusk', 'night'] as const) {
      const cue = table.cues.find((c) => c.id === homeCue(p));
      expect(cue?.piece, p).toBe('hearth');
      expect(layersOn(homeCue(p))).toContain('lyre');
    }
    expect(layersOn('MUS_HOME_NIGHT').length).toBeLessThan(layersOn('MUS_HOME_DAY').length);
  });

  it('lands every start and stop on a bar line of the playing cue', () => {
    const r = homeTime(1800, (t) => (t < 900 ? 'day' : 'dusk'));
    expect(r.stops.length).toBeGreaterThan(0);
    const bar = barSeconds({ id: 'x', bpm: 54, beatsPerBar: 2, stems: [] });
    const first = r.starts[0];
    if (first === undefined) throw new Error('no music started');
    for (const s of r.stops) {
      const into = (s.at - first.at) / bar;
      expect(Math.abs(into - Math.round(into))).toBeLessThan(1e-6);
    }
  });

  it('silences the music through the router on the next bar line', () => {
    const sink = new RecordingSink();
    const router = new AudioRouter(table, content.strings, sink);
    router.play('MUS_HOME_DAY', 0);
    router.update(0);
    router.silence(1);
    expect(router.director.state).toBeNull();
    router.update(barSeconds({ id: 'x', bpm: 54, beatsPerBar: 2, stems: [] }));
    const stop = sink.calls.find(
      (c) => c.kind === 'music' && (c.detail as { type: string }).type === 'stop',
    );
    expect((stop?.detail as { at: number }).at).toBeCloseTo(60 / 54 * 2);
  });
});

describe('home sounds (Book 11 sections 07, 09 and 12; Stage 7)', () => {
  it('has a generated, captioned sound for every task, the fire, a good stroke and sleep', () => {
    for (const event of [
      'TASK_DRIFTWOOD',
      'TASK_FISH',
      'FISH_LANDED',
      'TASK_TEND',
      'TASK_COOK',
      'TASK_BUILD',
      'FIRE_LIT',
      'FIRE_FED',
      'FIRE_OUT',
      'TIMING_GOOD',
      'SLEEP',
    ]) {
      const id = table.events[event];
      expect(id, event).toBeDefined();
      const cue = table.cues.find((c) => c.id === id);
      expect(cue?.captionKey, event).toBeDefined();
      expect(content.strings.has(cue?.captionKey ?? ''), event).toBe(true);
      expect(SOUNDS.get(id ?? '')?.captionKey, event).toBe(cue?.captionKey);
    }
    // Every camp task's sound is an event in the table.
    for (const [task, def] of Object.entries(content.camp?.tasks ?? {}))
      expect(table.events[def.sound], task).toBeDefined();
    expect(HOME.length).toBe(11);
  });

  it("has the steading's life for dawn, day, dusk and night, and the hearth at any hour", () => {
    for (const p of ['dawn', 'day', 'dusk', 'night'] as const) {
      const id = `AMB_HOME_${p.toUpperCase()}`;
      expect(AMBIENCES[id]).toBe('home');
      expect(HOME_LIFE[id]).toBe(p);
      expect(table.cues.find((c) => c.id === id)?.phases).toEqual([p]);
      expect(content.strings.has(`caption.amb.home_${p}`)).toBe(true);
    }
    expect(table.cues.find((c) => c.id === 'AMB_HEARTH')?.phases).toBeUndefined();
    expect(plan.fireSilentTiles).toBeGreaterThan(plan.fireFullTiles);
  });
});

/** Stage 5 acceptance check 3: music switches on bar boundaries; every test cue produces a caption. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  approachIntensity,
  barSeconds,
  MusicDirector,
  nextBarLine,
  stemGains,
} from '../../src/audio/music.ts';
import { AudioRouter } from '../../src/audio/router.ts';
import { RecordingSink } from '../../src/audio/webAudio.ts';
import { formatString } from '../../src/content/strings.ts';
import { loadContent } from '../../src/content/registry.ts';
import { readContentFiles } from '../../src/tools/content/loadContentFiles.ts';

const files = readContentFiles();
const { content } = loadContent(files);
const table = content.audio;
if (table === null) throw new Error('content/audio.json did not load');

const A = { id: 'A', bpm: 120, beatsPerBar: 4, stems: ['bed', 'rhythm', 'melody'] };
const B = { id: 'B', bpm: 90, beatsPerBar: 3, stems: ['bed', 'danger'] };

describe('the music state machine (Book 11 section 03)', () => {
  it('finds the next bar line', () => {
    expect(barSeconds(A)).toBe(2);
    expect(nextBarLine(0, 0, 2)).toBe(0);
    expect(nextBarLine(0, 3.1, 2)).toBe(4);
    expect(nextBarLine(1, 5, 2)).toBe(5);
    expect(nextBarLine(10, 4, 2)).toBe(10);
  });

  it('switches state on the next bar line of the playing cue', () => {
    const director = new MusicDirector([A, B]);
    expect(director.request('A', 0)).toBe(0);
    expect(director.update(0)).toContainEqual({ type: 'start', cue: 'A', at: 0 });
    expect(director.request('B', 3.1)).toBe(4);
    expect(director.update(3.5).filter((a) => a.type !== 'gains')).toEqual([]);
    expect(director.update(3.8).filter((a) => a.type !== 'gains')).toEqual([
      { type: 'stop', cue: 'A', at: 4 },
      { type: 'start', cue: 'B', at: 4 },
    ]);
    expect(director.state).toBe('B');
  });

  it('always lands a requested change on a bar line within one bar', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 500, noNaN: true }), (t) => {
        const director = new MusicDirector([A, B]);
        director.request('A', 0);
        director.update(0);
        const at = director.request('B', t);
        const bars = at / barSeconds(A);
        expect(Math.abs(bars - Math.round(bars))).toBeLessThan(1e-9);
        expect(at).toBeGreaterThanOrEqual(t - 1e-9);
        expect(at - t).toBeLessThan(barSeconds(A) + 1e-9);
      }),
      { numRuns: 300, seed: 5 },
    );
  });

  it('raises intensity within one bar and lowers it over four', () => {
    let v = 0;
    for (let t = 0; t < 2; t += 0.1) v = approachIntensity(v, 1, 0.1, 2);
    expect(v).toBeCloseTo(1, 5);
    for (let t = 0; t < 6; t += 0.1) v = approachIntensity(v, 0, 0.1, 2);
    expect(v).toBeGreaterThan(0.2);
    for (let t = 0; t < 2.2; t += 0.1) v = approachIntensity(v, 0, 0.1, 2);
    expect(v).toBe(0);
  });

  it('mixes stems by intensity, the bed always playing', () => {
    expect(stemGains(3, 0)).toEqual([1, 0, 0]);
    expect(stemGains(3, 0.5)).toEqual([1, 1, 0]);
    expect(stemGains(3, 1)).toEqual([1, 1, 1]);
    expect(stemGains(5, 0.125)).toEqual([1, 0.5, 0, 0, 0]);
  });
});

describe('cues and captions (Book 11 sections 07, 09 and 10)', () => {
  const caption = (key: string) => formatString(content.strings, key);

  it('every test cue produces its caption', () => {
    const gameplay = table.cues.filter((c) => c.kind !== 'ambience');
    expect(gameplay.length).toBeGreaterThan(10);
    for (const cue of gameplay) {
      const router = new AudioRouter(table, content.strings, new RecordingSink());
      router.play(cue.id, 1);
      const shown = router.update(1).map((c) => c.text);
      expect(shown, cue.id).toContain(caption(cue.captionKey ?? ''));
    }
  });

  it('maps game events to cues through the content table, with direction where it helps', () => {
    const sink = new RecordingSink();
    const router = new AudioRouter(table, content.strings, sink);
    expect(router.event('HORN_BLOWN', 2, { direction: 'n' })).toBe('SFX_HORN');
    expect(router.update(2).map((c) => c.text)).toContain('Horn, north');
    expect(router.event('NOT_AN_EVENT', 2)).toBeNull();
    expect(sink.calls).toContainEqual({
      kind: 'oneShot',
      detail: { cue: 'SFX_HORN', at: 2, pan: 0 },
    });
  });

  it('ducks the music under a stinger for its length, and clears captions after their time', () => {
    const sink = new RecordingSink();
    const router = new AudioRouter(table, content.strings, sink);
    router.play('MUS_HOME_DAY', 0);
    router.update(0);
    router.play('MUS_STINGER_HORN', 10);
    const duck = sink.calls.find(
      (c) => c.kind === 'music' && (c.detail as { type: string }).type === 'duck',
    );
    expect(duck?.detail).toEqual({
      type: 'duck',
      level: table.stingerDuck,
      from: 10,
      until: 10 + 4 * (60 / 84),
    });
    expect(router.update(10 + table.captionSeconds + 0.1)).toEqual([]);
  });

  it('chooses ambience layers by zone and time of day', () => {
    const router = new AudioRouter(table, content.strings, new RecordingSink());
    expect(router.setPlace('ZONE_SK_STRAND', 'day', 0)).toEqual(['AMB_SURF_SHINGLE']);
    expect(router.setPlace('ZONE_SK_MACHAIR', 'night', 0)).toEqual([
      'AMB_WIND_HEATHER',
      'AMB_HEARTH',
    ]);
    expect(router.setPlace('ZONE_SK_MACHAIR', 'day', 0)).toEqual(['AMB_WIND_HEATHER']);
  });

  it('lint refuses a gameplay sound without a caption, and flags every cue as temporary', () => {
    const broken = structuredClone(files) as Record<string, unknown>;
    const audio = broken['audio'] as { cues: Record<string, unknown>[] };
    const sfx = audio.cues.find((c) => c['kind'] === 'sfx');
    if (sfx !== undefined) delete sfx['captionKey'];
    const { issues } = loadContent(broken as typeof files);
    expect(issues.map((i) => i.reason)).toContain('sfx cues need a caption (Book 11 section 09)');
    expect(table.cues.every((c) => c.temporary)).toBe(true);
  });
});

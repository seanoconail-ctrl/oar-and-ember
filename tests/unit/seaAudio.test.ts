/**
 * Stage 13, acceptance check 5 (Book 11 sections 03, 07 and 12; decisions S13-60 to S13-79): the
 * sea music by weather and the wreck's sounds. The three sea pieces as note data (metre, mode,
 * at most eight voices as the engine counts them, one layer first, a loop without a seam), the
 * pure routing from the weather and the voyage to the music and the sea's ambience, and the
 * sounds and voices of the sea and the wreck with their captions.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hzOf, INSTRUMENTS, MUSIC_VOICES } from '../../src/audio/synth/engine.ts';
import { modeClasses, parseLayer, stepSeconds } from '../../src/audio/synth/notation.ts';
import type { Piece } from '../../src/audio/synth/notation.ts';
import { makeSamples, SAMPLE_RATE } from '../../src/audio/synth/samples.ts';
import { layerJoinAt } from '../../src/audio/music.ts';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';
import { MusicDirector, musicCues } from '../../src/audio/music.ts';
import {
  SEA_AMBIENCE,
  SEA_MUSIC,
  SEA_SOUND_EVENTS,
  seaAmbience,
  seaBed,
  seaEventSounds,
  seaMusic,
  seaSoundRules,
  seaStrokeSeconds,
} from '../../src/audio/seaAudio.ts';
import type { SeaSoundInput } from '../../src/audio/seaAudio.ts';
import { AMBIENCES, SOUNDS } from '../../src/audio/synth/cues.ts';
import { SEA_SOUNDS } from '../../src/audio/synth/sea.ts';
import {
  OTHER_VOICES,
  SEA_VOICES,
  SURVIVOR_VOICE_KEYS,
  voiceOf,
  VOICES,
} from '../../src/audio/synth/voice.ts';
import { loadContent } from '../../src/content/registry.ts';
import { formatString } from '../../src/content/strings.ts';
import type { PointOfSail, SeaEvent, Visibility, VoyageStatus } from '../../src/sim/sea/types.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { readContentFiles } from '../../src/tools/content/loadContentFiles.ts';
import { auditInfo } from '../../src/ui/textAudit.ts';

const { content } = loadContent(readContentFiles());

const piece = JSON.parse(readFileSync(join(REPO_ROOT, 'content/music/sea.json'), 'utf8')) as Piece;
const audioJson = JSON.parse(readFileSync(join(REPO_ROOT, 'content/audio.json'), 'utf8')) as {
  cues: { id: string; kind: string; piece?: string; layers?: Record<string, boolean> }[];
};
const SEA_CUES = ['MUS_SEA_CALM', 'MUS_SEA_WIND', 'MUS_SEA_STORM'] as const;
const cueLayers = (id: string): string[] => {
  const cue = audioJson.cues.find((c) => c.id === id);
  return Object.entries(cue?.layers ?? {})
    .filter(([, on]) => on)
    .map(([l]) => l);
};
const UNPITCHED = new Set(['drum', 'knock', 'gull']);
const samples = makeSamples();

/**
 * The most music voices a set of layers sounds at once, as the engine counts them (engine.ts
 * playNote): a voice is busy from its start until its sample's held length and its release are
 * over, and the notes of the pass before ring on over the loop's seam.
 */
function mostVoices(p: Piece, layers: readonly string[]): number {
  const step = stepSeconds(p, p.tempo);
  const loop = p.bars * p.beatsPerBar * p.stepsPerBeat * step;
  const spans: [number, number][] = [];
  for (const l of p.layers) {
    if (!layers.includes(l.id)) continue;
    const def = INSTRUMENTS[l.instrument];
    if (def === undefined) throw new Error(l.instrument);
    const s = samples[def.sample];
    for (const n of parseLayer(p, l).notes) {
      const seconds = n.length * step * 0.96;
      const sampleLen = s.data.length / SAMPLE_RATE / (hzOf(n.midi) / s.baseHz);
      const held =
        def.oneShot === true
          ? sampleLen
          : s.loop === null
            ? Math.min(sampleLen, seconds + def.ring)
            : seconds + def.ring;
      const start = n.step * step;
      for (const pass of [0, 1])
        spans.push([start + pass * loop, start + pass * loop + held + def.release]);
    }
  }
  let most = 0;
  for (const [s] of spans)
    if (s >= loop)
      most = Math.max(most, spans.filter(([a, b]) => a <= s + 1e-6 && b > s + 1e-6).length);
  return most;
}

describe('the sea music (Book 11 section 03, MUS_SEA_CALM/WIND/STORM; S13-60 to S13-65)', () => {
  it('writes every bar to its metre, in D Aeolian, with no note outside the mode', () => {
    expect(piece.mode).toBe('D aeolian');
    const classes = modeClasses(piece.mode);
    for (const l of piece.layers) {
      const parsed = parseLayer(piece, l);
      expect(parsed.problems, l.id).toEqual([]);
      if (UNPITCHED.has(l.instrument)) continue;
      expect(
        parsed.notes.filter((n) => !classes.has(n.midi % 12)).map((n) => n.midi),
        l.id,
      ).toEqual([]);
    }
  });

  it('has three pieces of the sea piece, each naming only layers it has', () => {
    for (const id of SEA_CUES) {
      const cue = audioJson.cues.find((c) => c.id === id);
      expect(cue, id).toEqual(expect.objectContaining({ kind: 'music', piece: 'sea' }));
      for (const l of Object.keys(cue?.layers ?? {}))
        expect(
          piece.layers.some((x) => x.id === l),
          `${id} ${l}`,
        ).toBe(true);
    }
  });

  it(`never needs more than ${MUSIC_VOICES} voices in any of the three, counting releases and the seam`, () => {
    for (const id of SEA_CUES) {
      const most = mostVoices(piece, cueLayers(id));
      expect(most, id).toBeLessThanOrEqual(MUSIC_VOICES);
      expect(most, id).toBeGreaterThan(1);
    }
  });

  it('calm and wind keep the rowing pulse; the storm has drones and drums and no tune', () => {
    const calm = cueLayers('MUS_SEA_CALM');
    const wind = cueLayers('MUS_SEA_WIND');
    const storm = cueLayers('MUS_SEA_STORM');
    for (const l of [calm, wind]) expect(l).toEqual(expect.arrayContaining(['stroke', 'creak']));
    const inst = (ids: string[]) =>
      ids.map((i) => piece.layers.find((l) => l.id === i)?.instrument ?? '');
    expect(inst(storm).filter((i) => i === 'drone').length).toBeGreaterThanOrEqual(2);
    expect(inst(storm).filter((i) => i === 'drum').length).toBeGreaterThanOrEqual(2);
    expect(inst(storm)).not.toEqual(expect.arrayContaining(['harp']));
    expect(inst(storm)).not.toEqual(expect.arrayContaining(['flute']));
    // A rowing stroke every two beats, as the crew pull: one on each half of the bar.
    const stroke = piece.layers.find((l) => l.id === 'stroke');
    if (stroke === undefined) throw new Error('no stroke');
    const perBar = piece.beatsPerBar * piece.stepsPerBeat;
    const firstBar = parseLayer(piece, stroke).notes.filter((n) => n.step < perBar);
    expect(firstBar.map((n) => n.step)).toEqual([0, perBar / 2]);
  });

  it('starts each from the drone alone, its other layers joining one at a time on bar lines', () => {
    const bar = (piece.beatsPerBar * 60) / piece.tempo;
    for (const id of SEA_CUES) {
      const on = piece.layers.filter((l) => cueLayers(id).includes(l.id));
      expect(on[0]?.id, id).toBe('drone');
      const joins = on.map((_, i) => layerJoinAt(i, on.length, 25, bar));
      expect(joins[0]).toBe(0);
      for (let i = 1; i < joins.length; i++) {
        expect(joins[i] ?? 0, `${id} layer ${i}`).toBeGreaterThan(joins[i - 1] ?? 0);
        expect(((joins[i] ?? 0) / bar) % 1, `${id} layer ${i}`).toBeCloseTo(0, 6);
      }
    }
  });

  it('loops without a seam: the drone is re-struck before the last one fades, and at the loop', () => {
    const drone = piece.layers.find((l) => l.id === 'drone');
    if (drone === undefined) throw new Error('no drone');
    const step = stepSeconds(piece, piece.tempo);
    const loop = piece.bars * piece.beatsPerBar * piece.stepsPerBeat * step;
    const def = INSTRUMENTS['drone'];
    const notes = parseLayer(piece, drone).notes;
    expect(notes[0]?.step).toBe(0);
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n === undefined || def === undefined) continue;
      const fadesBy = n.step * step + n.length * step * 0.96 + def.release;
      const next = notes[i + 1]?.step;
      const nextAt = next === undefined ? loop : next * step;
      expect(fadesBy, `drone note ${i}`).toBeGreaterThan(nextAt);
    }
    // A pass is about a minute, long enough not to tire.
    expect(loop).toBeGreaterThan(50);
    expect(loop).toBeLessThan(75);
  });
});

// ------------------------------------------------------------------------------ the routing

const rules = seaSoundRules(loadBalanceJson());
const at = (
  strength: number,
  visibility: Visibility = 'CLEAR',
  status: VoyageStatus | null = 'SAILING',
  rowing = false,
): SeaSoundInput => ({ strength, visibility, status, rowing });

describe('the sea music by weather: a pure routing (S13-60 to S13-62)', () => {
  it("reads Book 10's numbers: the wind piece from strength 2, the storm from stormFrom", () => {
    expect(rules).toEqual({ windFrom: 2, stormFrom: 4 });
  });

  it('plays the calm below windFrom, the wind from it, the storm from stormFrom', () => {
    expect([0, 1, 2, 3, 4].map((s) => seaMusic(at(s), rules))).toEqual([
      'MUS_SEA_CALM',
      'MUS_SEA_CALM',
      'MUS_SEA_WIND',
      'MUS_SEA_WIND',
      'MUS_SEA_STORM',
    ]);
    // Haze and night change nothing; the rowing or the sail does not choose the piece.
    expect(seaMusic(at(1, 'HAZE', 'SAILING', true), rules)).toBe('MUS_SEA_CALM');
    expect(seaMusic(at(3, 'NIGHT'), rules)).toBe('MUS_SEA_WIND');
  });

  it('falls silent in fog, the dead quiet of fog, unless it is a storm', () => {
    expect(seaMusic(at(1, 'FOG'), rules)).toBeNull();
    expect(seaMusic(at(3, 'FOG'), rules)).toBeNull();
    expect(seaMusic(at(4, 'FOG'), rules)).toBe('MUS_SEA_STORM');
    expect(seaAmbience(seaBed(at(1, 'FOG'), rules))).toEqual(['AMB_FOG_QUIET']);
    expect(seaAmbience(seaBed(at(1), rules))).toEqual(['AMB_WIND_RIGGING']);
    expect(seaBed(at(4, 'FOG'), rules)?.fog).toBe(false);
  });

  it('plays only while under way: a choice keeps it; held, at anchor or handed off it stops', () => {
    expect(seaMusic(at(2, 'CLEAR', 'CHOICE'), rules)).toBe('MUS_SEA_WIND');
    for (const status of ['HELD', 'ANCHORED', 'HANDOFF', null] as const)
      expect(seaMusic(at(2, 'CLEAR', status), rules), String(status)).toBeNull();
    // The bed plays held or at anchor (lying still), but not in a scene or with no voyage.
    expect(seaBed(at(2, 'CLEAR', 'HELD', true), rules)).toEqual(
      expect.objectContaining({ moving: false, rowing: false }),
    );
    expect(seaBed(at(2, 'CLEAR', 'HANDOFF'), rules)).toBeNull();
    expect(seaBed(at(2, 'CLEAR', null), rules)).toBeNull();
  });

  it('raises the wind in the rigging and the sea with the strength, and rows when the leg is rowed', () => {
    const beds = [0, 1, 2, 3, 4].map((s) => seaBed(at(s, 'CLEAR', 'SAILING', s === 0), rules));
    expect(beds.map((b) => b?.wind)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(beds.map((b) => b?.storm)).toEqual([false, false, false, false, true]);
    expect(beds.map((b) => b?.rowing)).toEqual([true, false, false, false, false]);
  });

  it('lands a change of weather on the bar line and cross-fades, starting the new piece alone', () => {
    const table = content.audio;
    if (table == null) throw new Error('no audio');
    const director = new MusicDirector(musicCues(table.cues), {
      fadeIn: 8,
      fadeOut: 6,
      layersJoin: 25,
    });
    const bar = (piece.beatsPerBar * 60) / piece.tempo;
    director.request(seaMusic(at(1), rules) ?? '', 0);
    director.update(0);
    // The wind rises half-way through the third bar.
    const asked = 2.5 * bar;
    const lands = director.request(seaMusic(at(2), rules) ?? '', asked);
    expect(lands).toBeCloseTo(3 * bar, 9);
    const actions = director.update(lands - 0.1);
    expect(actions).toEqual(
      expect.arrayContaining([
        { type: 'stop', cue: 'MUS_SEA_CALM', at: lands, fadeOut: 6 },
        { type: 'start', cue: 'MUS_SEA_WIND', at: lands, fadeIn: 8, layersJoin: 25 },
      ]),
    );
  });
});

describe('the sea-map events make their sounds (S13-66 to S13-69)', () => {
  const leg = (pointOfSail: PointOfSail): SeaEvent => ({
    type: 'SEA_LEG_STARTED',
    edge: 'SEA_SKARV_CARRICK',
    pointOfSail,
    speed: 1,
    minutes: 60,
  });
  const sounds = (e: SeaEvent, input = at(2)) =>
    seaEventSounds(e, input, rules).map((s) => s.event);

  it('sets, luffs or strains the sail by the point of sail and the wind; the oars when rowed', () => {
    expect(sounds(leg('BROAD_REACH'), at(1))).toEqual(['SAIL_SET']);
    expect(sounds(leg('RUNNING'), at(3))).toEqual(['SAIL_STRAIN']);
    expect(sounds(leg('CLOSE_HAULED'))).toEqual(['SAIL_LUFFING']);
    expect(sounds(leg('AGAINST'))).toEqual(['OAR_STROKE']);
    expect(sounds(leg('CALM'), at(0))).toEqual(['OAR_STROKE']);
    expect(sounds(leg('BEAM'), at(1, 'CLEAR', 'SAILING', true))).toEqual(['OAR_STROKE']);
  });

  it('reefs to press on, groans under storm damage, takes a sea in a storm, and hears the wreck', () => {
    expect(sounds({ type: 'SEA_CHOSEN', option: 'PRESS_ON' })).toEqual(['SAIL_REEFED']);
    expect(sounds({ type: 'SEA_CHOSEN', option: 'SHELTER' })).toEqual([]);
    expect(
      sounds({ type: 'SEA_WATCH', minutes: 180, edge: null, done: 1, of: 2, storm: true }),
    ).toEqual(['WAVE_HULL']);
    expect(
      sounds({ type: 'SEA_WATCH', minutes: 180, edge: null, done: 1, of: 2, storm: false }),
    ).toEqual([]);
    expect(sounds({ type: 'SEA_STORM_DAMAGE', textKey: 'x', integrity: 80 })).toEqual([
      'HULL_GROAN',
    ]);
    const encounter = (scenario: string | null): SeaEvent => ({
      type: 'SEA_ENCOUNTER',
      edge: 'SEA_SKARV_CARRICK',
      encounter: {
        table: 'ENC_OPEN',
        key: 'wreck',
        textKey: 'sea.enc.open.wreck',
        supernatural: false,
        story: true,
        scene: scenario === null ? null : { kind: 'ON_FOOT', scenario },
      },
    });
    expect(sounds(encounter('SCN_SEA_WRECK'))).toEqual(['WRECK_CRIES']);
    expect(sounds(encounter(null))).toEqual([]);
  });

  it('maps every sea sound event to a cue of the audio table with a sound and a caption', () => {
    const table = content.audio;
    for (const name of Object.values(SEA_SOUND_EVENTS)) {
      const id = table?.events[name];
      expect(id, name).toBeDefined();
      expect(SOUNDS.has(id ?? ''), name).toBe(true);
      const cue = content.cues.get(id ?? '');
      expect(content.strings.has(cue?.captionKey ?? ''), name).toBe(true);
    }
    for (const id of Object.values(SEA_MUSIC)) expect(content.cues.get(id)?.piece).toBe('sea');
    for (const id of Object.values(SEA_AMBIENCE)) expect(AMBIENCES[id], id).toBeDefined();
    expect(seaStrokeSeconds(piece.tempo)).toBeCloseTo(1.875, 9);
  });
});

describe('the sea and the wreck heard and captioned (S13-66 to S13-73)', () => {
  it('captions every sea and wreck sound, and keeps only what the picture does not show', () => {
    for (const def of SEA_SOUNDS) expect(content.strings.has(def.captionKey), def.id).toBe(true);
    const verdict = (k: string): string => {
      const v = auditInfo(k);
      return v.show ? `${v.cls}${v.unseenOnly === true ? ' unseen' : ''}` : v.why;
    };
    // Cries from the wreck, with their direction in the game's caption format (Book 8 section 10).
    expect(verdict('caption.sea.wreck_cries')).toBe('DIRECTION');
    expect(
      formatString(content.strings, 'caption.format.with_direction', {
        caption: formatString(content.strings, 'caption.sea.wreck_cries'),
        direction: formatString(content.strings, 'caption.direction.e'),
      }),
    ).toBe('Cries for help from the east');
    // The hull groaning: the sea map does not draw the hull.
    expect(verdict('caption.sea.hull_groan')).toBe('SOUND');
    expect(formatString(content.strings, 'caption.sea.hull_groan')).toBe('Timber groaning');
    // The wreck's timber, only while the wreck is out of view.
    expect(verdict('caption.sea.wreck_break')).toBe('SOUND unseen');
    expect(verdict('caption.sea.wreck_grind')).toBe('SOUND unseen');
    // The sail and the oars, the music and the bed: shown on the sea map, or mood.
    for (const k of [
      'caption.sfx.sail_reef',
      'caption.sfx.sail_luff',
      'caption.sfx.sail_strain',
      'caption.music.sea_calm',
      'caption.music.sea_wind',
      'caption.music.sea_storm',
      'caption.amb.wind_rigging',
      'caption.amb.fog_quiet',
      'caption.amb.sea_wreck',
    ])
      expect(verdict(k), k).toBe('CUT');
    // No combat sound among them (DF-80).
    for (const def of SEA_SOUNDS) expect(content.cues.get(def.id)?.drawn, def.id).toBeUndefined();
  });

  it('gives the survivors voices of their own: two or three adults, none sharing a pitch', () => {
    const keys = SURVIVOR_VOICE_KEYS;
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys.length).toBeLessThanOrEqual(3);
    const others = [...Object.values(VOICES), ...Object.values(OTHER_VOICES)].map((v) => v.pitch);
    const pitches = keys.map((k) => SEA_VOICES[k]?.pitch ?? 0);
    expect(new Set(pitches).size).toBe(keys.length);
    for (const p of pitches) {
      expect(others).not.toContain(p);
      // Adults: in the range of the household's grown voices.
      expect(p).toBeGreaterThanOrEqual(98);
      expect(p).toBeLessThanOrEqual(262);
    }
    for (const k of keys) expect(voiceOf(k), k).toBe(SEA_VOICES[k]);
    // The steerer never has one (Book 8 section 03).
    expect(keys.some((k) => k.includes('STEERER') || k.startsWith('P_'))).toBe(false);
  });

  it('makes the same sounds every time: each is generated, never a recording', () => {
    expect(SEA_SOUNDS.map((d) => d.id)).toEqual([
      'SFX_SAIL_REEF',
      'SFX_SAIL_LUFF',
      'SFX_SAIL_STRAIN',
      'SFX_HULL_GROAN',
      'SFX_WRECK_BREAK',
      'SFX_WRECK_GRIND',
      'SFX_WRECK_CRIES',
    ]);
    const src = readFileSync(join(REPO_ROOT, 'src/audio/synth/sea.ts'), 'utf8');
    expect(src).not.toMatch(/\.(wav|mp3|ogg|flac)\b|fetch\(|decodeAudioData/);
  });
});

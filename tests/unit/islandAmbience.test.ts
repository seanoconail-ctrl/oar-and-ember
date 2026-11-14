/**
 * Stage 14's island ambience (Book 11 sections 07, 09 and 12; decisions S14-100 to S14-109): which
 * layers play in every scene and area by season and hour, the surf by the sea's distance over the
 * whole island, the stream and the falls, the deep passage's roar by the tide, the drowned's tell
 * at the spring lows; every island cue with its sound, its caption and its audit verdict.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  areaAt,
  directionOf,
  islandMix,
  reachLevel,
  roarLevel,
  ruleFor,
  SoundField,
} from '../../src/audio/islandAmbience.ts';
import type { IslandQuery, IslandRules } from '../../src/audio/islandAmbience.ts';
import { AudioRouter } from '../../src/audio/router.ts';
import { AMBIENCES, SOUNDS } from '../../src/audio/synth/cues.ts';
import { RecordingSink } from '../../src/audio/webAudio.ts';
import { SEASONS } from '../../src/content/balance.ts';
import { bakeElevation } from '../../src/content/terrain/elevation.ts';
import { loadContent } from '../../src/content/registry.ts';
import { IslandAudio, islandZone } from '../../src/scenes/islandAmbAudio.ts';
import { ISLAND_LISTENS } from '../../src/scenes/islandAmbTest.ts';
import { zoneFlow } from '../../src/scenes/islandLook.ts';
import { auditInfo } from '../../src/ui/textAudit.ts';
import { loadZoneMaps } from '../../src/tools/art/lint.ts';
import { REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';
import { readContentFiles } from '../../src/tools/content/loadContentFiles.ts';

/** The value, or a thrown error naming what was missing. */
function must<T>(v: T | null | undefined, what = 'value'): T {
  if (v === null || v === undefined) throw new Error(`no ${what}`);
  return v;
}

const { content, issues } = loadContent(readContentFiles());
const table = must(content.audio, 'audio table');
const rules = table.island as IslandRules;
const maps = loadZoneMaps();
const mapOf = (zone: string) => maps.find((m) => m.zone === zone);

const ISLAND_SCENES = [...content.zones.values()]
  .filter((z) => z.id.startsWith('ZONE_SK_') && !z.terrain.includes('an area of'))
  .map((z) => z.id);
const AREAS = [...content.zones.values()]
  .filter((z) => z.id.startsWith('ZONE_SK_') && z.terrain.includes('an area of'))
  .map((z) => z.id);

const at = (tiles: number, pan = 0) => ({ tiles, pan, x: 0, y: 0 });
function query(over: Partial<IslandQuery> = {}): IslandQuery {
  return {
    zone: 'ZONE_SK_STRAND',
    area: null,
    season: 'Spring',
    daylight: true,
    tide: {
      springTide: false,
      tidalGroundOpen: false,
      minutesSinceLowWater: 300,
      minutesToLowWater: 420,
      windowMinutes: 180,
    },
    placeWind: 1,
    sea: at(5),
    stream: null,
    falls: null,
    roarAt: null,
    drownedAt: null,
    ...over,
  };
}

describe("the island's ambience (Stage 14)", () => {
  it('loads its rules with the audio table', () => {
    expect(
      issues.filter((i) => i.file === 'content/audio.json' && i.path.startsWith('island')),
    ).toEqual([]);
    expect(rules).toBeDefined();
    for (const z of Object.keys(rules.zones)) expect(content.zones.has(z), z).toBe(true);
    for (const a of Object.keys(rules.areas)) expect(AREAS, a).toContain(a);
  });

  it('gives every scene of the island an ambience, from its cues and its rule', () => {
    expect(ISLAND_SCENES.length).toBeGreaterThanOrEqual(13);
    const router = new AudioRouter(table, content.strings, new RecordingSink());
    for (const zone of ISLAND_SCENES) {
      expect(islandZone(rules, zone), zone).toBe(true);
      for (const phase of ['day', 'night'] as const)
        expect(router.setPlace(zone, phase, 0).length, `${zone} ${phase}`).toBeGreaterThan(0);
      const mix = islandMix(rules, query({ zone, sea: at(20) }));
      const heard = mix.wind + mix.surf.level + mix.cave + mix.gulls + mix.quiet + mix.stream.level;
      expect(heard, zone).toBeGreaterThan(0);
    }
  });

  it('plays each layer only in a scene whose cues include it', () => {
    const cueOf = (id: string) => table.cues.find((c) => c.id === id);
    const listed = (id: string, zone: string) => cueOf(id)?.zones?.includes(zone) === true;
    for (const zone of ISLAND_SCENES)
      for (const season of SEASONS)
        for (const daylight of [true, false]) {
          const m = islandMix(
            rules,
            query({ zone, season, daylight, stream: at(1), falls: at(1), roarAt: at(1) }),
          );
          if (m.birds.colony.level > 0) expect(listed('AMB_BIRD_COLONY', zone), zone).toBe(true);
          if (m.birds.skylark.level > 0) expect(listed('AMB_SKYLARK', zone), zone).toBe(true);
          if (m.birds.curlew.level > 0) expect(listed('AMB_CURLEW', zone), zone).toBe(true);
          if (m.cave > 0) expect(listed('AMB_CAVE_DRIP', zone), zone).toBe(true);
          if (m.roar.level > 0) expect(listed('AMB_PASSAGE_ROAR', zone), zone).toBe(true);
          if (m.quiet > 0) expect(listed('AMB_BOG_QUIET', zone), zone).toBe(true);
        }
  });

  it('puts the birds where and when they belong', () => {
    const cliffs = (season: (typeof SEASONS)[number], daylight = true) =>
      islandMix(rules, query({ zone: 'ZONE_SK_CLIFFS', season, daylight })).birds;
    expect(cliffs('Summer').colony.level).toBeGreaterThan(0);
    expect(cliffs('Winter').colony.level).toBe(0);
    const rook = (season: (typeof SEASONS)[number], daylight: boolean) =>
      islandMix(rules, query({ zone: 'ZONE_SK_ROOK', season, daylight })).birds.skylark.level;
    expect(rook('Spring', true)).toBeGreaterThan(0);
    expect(rook('Spring', false)).toBe(0);
    expect(rook('Winter', true)).toBe(0);
    const bog = (season: (typeof SEASONS)[number], daylight: boolean) =>
      islandMix(rules, query({ zone: 'ZONE_SK_BOG', season, daylight })).birds.curlew.level;
    expect(bog('Autumn', false)).toBeGreaterThan(0);
    expect(bog('Autumn', false)).toBeLessThan(bog('Autumn', true));
    expect(bog('Winter', true)).toBe(0);
  });

  it('lets an area change its zone: the Grey Men quieter than the bog, the Kelda sheltered', () => {
    const bog = islandMix(rules, query({ zone: 'ZONE_SK_BOG' }));
    const ring = islandMix(rules, query({ zone: 'ZONE_SK_BOG', area: 'ZONE_SK_GREYMEN' }));
    expect(ring.quiet).toBeGreaterThan(bog.quiet);
    expect(ring.wind).toBeLessThan(bog.wind);
    expect(ring.birds.curlew.level).toBe(0);
    expect(ruleFor(rules, 'ZONE_SK_MACHAIR', 'ZONE_SK_KELDA').wind).toBeLessThan(1);
    // The island's marks put the Kelda's pool in its area and the steading outside it.
    const areas = content.island?.areas ?? [];
    expect(areaAt(areas, 'ZONE_SK_MACHAIR', 58, 11)).toBe('ZONE_SK_KELDA');
    expect(areaAt(areas, 'ZONE_SK_MACHAIR', 35, 31)).toBeNull();
  });

  it('blows hardest on the high ground and headlands, and harder in winter', () => {
    const wind = (zone: string, season: (typeof SEASONS)[number] = 'Spring') =>
      islandMix(rules, query({ zone, season })).wind;
    const strand = wind('ZONE_SK_STRAND');
    for (const z of ['ZONE_SK_ROOK', 'ZONE_SK_CLIFFS', 'ZONE_SK_HAGSEAT'])
      expect(wind(z), z).toBeGreaterThan(strand);
    expect(wind('ZONE_SK_ROOK', 'Winter')).toBeGreaterThan(wind('ZONE_SK_ROOK', 'Summer'));
    expect(wind('ZONE_SK_SEALCAVE_DEEP')).toBe(0);
  });

  it('hears the surf by its distance, from its side', () => {
    const near = islandMix(rules, query({ sea: at(3, 0.6) }));
    const far = islandMix(rules, query({ sea: at(40, 0.6) }));
    expect(near.surf.level).toBeGreaterThan(far.surf.level);
    expect(near.surfNear).toBe(1);
    expect(near.surf.pan).toBeCloseTo(0.6);
    expect(reachLevel(rules.reach.sea, rules.reach.sea.silentTiles + 1)).toBe(0);
    // Inland the sea is still heard faintly (the floor), never louder than at the shore.
    const inland = islandMix(rules, query({ zone: 'ZONE_SK_ROOK', sea: null }));
    expect(inland.surf.level).toBeGreaterThan(0);
    expect(inland.surf.level).toBeLessThan(near.surf.level);
  });

  it('runs the stream and the falls by their distance, dry in summer and iced in winter', () => {
    const rook = (season: (typeof SEASONS)[number]) =>
      islandMix(rules, query({ zone: 'ZONE_SK_ROOK', season, stream: at(3), falls: at(6) }));
    expect(rook('Spring').stream.level).toBeGreaterThan(0);
    expect(rook('Summer').stream.level).toBe(0);
    expect(rook('Summer').falls.level).toBeLessThan(rook('Spring').falls.level);
    expect(rook('Winter').falls.level).toBeLessThan(rook('Spring').falls.level);
    const kelda = islandMix(
      rules,
      query({ zone: 'ZONE_SK_MACHAIR', season: 'Summer', stream: at(3) }),
    );
    expect(kelda.stream.level).toBeGreaterThan(0);
    const far = islandMix(rules, query({ zone: 'ZONE_SK_ROOK', stream: at(30), falls: at(60) }));
    expect(far.stream.level).toBe(0);
    expect(far.falls.level).toBe(0);
  });

  it('raises the deep passage’s roar from the turn of a spring tide to the window’s close', () => {
    const tide = (sinceLow: number, toLow: number, open: boolean, spring = true) => ({
      springTide: spring,
      tidalGroundOpen: open,
      minutesSinceLowWater: sinceLow,
      minutesToLowWater: toLow,
      windowMinutes: 180,
    });
    expect(roarLevel(tide(700, 30, true))).toBe(0);
    expect(roarLevel(tide(20, 700, true))).toBeGreaterThan(0);
    expect(roarLevel(tide(80, 640, true))).toBeGreaterThan(roarLevel(tide(20, 700, true)));
    expect(roarLevel(tide(95, 625, false))).toBe(1);
    const passage = (t: ReturnType<typeof tide>) =>
      islandMix(rules, query({ zone: 'ZONE_SK_SEALCAVE_DEEP', tide: t, roarAt: at(10) })).roar
        .level;
    expect(passage(tide(80, 640, true))).toBeGreaterThan(passage(tide(10, 710, true)));
    // Elsewhere there is no roar.
    expect(islandMix(rules, query({ tide: tide(80, 640, true), roarAt: at(1) })).roar.level).toBe(
      0,
    );
  });

  it('sounds the drowned’s tell on the Skerry at the spring lows only', () => {
    const skerry = (spring: boolean, open: boolean) =>
      islandMix(
        rules,
        query({
          zone: 'ZONE_SK_SKERRY',
          drownedAt: at(8, 0.3),
          tide: {
            springTide: spring,
            tidalGroundOpen: open,
            minutesSinceLowWater: 10,
            minutesToLowWater: 710,
            windowMinutes: 180,
          },
        }),
      ).drowned.level;
    expect(skerry(true, true)).toBeGreaterThan(0);
    expect(skerry(false, true)).toBe(0);
    expect(skerry(true, false)).toBe(0);
  });

  it('measures the island from every zone: the machair hears the strand’s sea and its stream', () => {
    const machair = mapOf('ZONE_SK_MACHAIR');
    if (machair === undefined) throw new Error('no machair');
    const flow = zoneFlow(machair, bakeElevation(machair.rows));
    const alone = new SoundField(machair, [machair], flow);
    const all = new SoundField(machair, maps, flow);
    expect(alone.sea(50, 38, 60)).toBeNull();
    const sea = all.sea(50, 38, 60);
    expect(sea).not.toBeNull();
    expect(must(sea).tiles).toBeGreaterThan(5);
    const stream = all.stream(56, 20, 14);
    expect(stream).not.toBeNull();
    expect(must(stream).tiles).toBeLessThan(4);
    expect(all.falls(56, 20, 36)).toBeNull();
    expect(directionOf(0, -5)).toBe('n');
    expect(directionOf(5, 5)).toBe('se');
  });

  it('captions an unseen stream once, with its direction, and plays the tell with its caption', () => {
    const router = new AudioRouter(table, content.strings, new RecordingSink());
    const machair = must(mapOf('ZONE_SK_MACHAIR'));
    const flow = zoneFlow(machair, bakeElevation(machair.rows));
    const ia = new IslandAudio(rules, maps, content.island?.areas ?? []);
    const hear = (now: number, view: { x: number; y: number }) =>
      ia.update(
        {
          map: machair,
          flow,
          x: 50.5 * 24,
          y: 20 * 24,
          view: { ...view, w: 640, h: 360 },
          season: 'Spring',
          daylight: true,
          tide: {
            springTide: false,
            tidalGroundOpen: false,
            minutesSinceLowWater: 300,
            minutesToLowWater: 420,
          },
          windowMinutes: 180,
          now,
        },
        router,
      );
    // In view: no caption.
    expect(hear(0, { x: 50 * 24 - 320, y: 20 * 24 - 180 })?.stream.level).toBeGreaterThan(0.5);
    expect(router.takeCaptions()).toEqual([]);
    // Looking away (the view held elsewhere): captioned once, then not again for a while.
    hear(1, { x: 0, y: 0 });
    const said = router.takeCaptions();
    expect(said.map((c) => c.key)).toEqual(['caption.water.stream']);
    expect(said[0]?.text).toMatch(/^Running water from the /);
    hear(2, { x: 0, y: 0 });
    expect(router.takeCaptions()).toEqual([]);
    hear(2 + rules.captionAgainSeconds, { x: 0, y: 0 });
    expect(router.takeCaptions()).toHaveLength(1);
  });

  it('gives every island cue its sound, and the captions their audit verdicts', () => {
    for (const id of [
      'AMB_WIND_HIGH',
      'AMB_BIRD_COLONY',
      'AMB_SKYLARK',
      'AMB_CURLEW',
      'AMB_STREAM',
      'AMB_WATERFALL',
      'AMB_CAVE_DRIP',
      'AMB_PASSAGE_ROAR',
      'AMB_BOG_QUIET',
    ])
      expect(AMBIENCES[id], id).toBe('island');
    expect(SOUNDS.get('SFX_TELL_DROWNED')?.bus).toBe('tells');
    expect(auditInfo('caption.tell.drowned')).toEqual({ show: true, cls: 'SAFETY' });
    for (const key of ['caption.water.stream', 'caption.water.falls']) {
      expect(auditInfo(key)).toEqual({ show: true, cls: 'SOUND', unseenOnly: true });
      expect(content.strings.has(key), key).toBe(true);
    }
    // The birds, wind, drips and the quiet are not gameplay information: no caption in play.
    for (const id of ['AMB_BIRD_COLONY', 'AMB_SKYLARK', 'AMB_CURLEW', 'AMB_BOG_QUIET'])
      expect(table.cues.find((c) => c.id === id)?.captionKey, id).toBeUndefined();
  });

  it('renders every listen for listening back (npm run audio:render)', () => {
    const render = readFileSync(join(REPO_ROOT, 'src/tools/audio/render.ts'), 'utf8');
    for (const l of ISLAND_LISTENS) expect(render, l.id).toContain(`'${l.id}'`);
    expect(render).toContain('island:SFX_TELL_DROWNED');
    for (const l of ISLAND_LISTENS) {
      expect(content.strings.has(l.label), l.label).toBe(true);
      expect(content.strings.has(l.caption), l.caption).toBe(true);
    }
  });
});

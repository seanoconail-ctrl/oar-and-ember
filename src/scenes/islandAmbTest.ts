/**
 * Stage 14's listens for the sound test page and `npm run audio:render` (Book 11 section 12): the
 * island's ambience in each scene at a chosen season and hour, from the same rules and engine as
 * play (src/audio/islandAmbience.ts, src/audio/synth/islandAmb.ts), with the sea, the stream, the
 * falls and the sources at set distances; and the drowned's tell on its own.
 */
import audioJson from '../../content/audio.json';
import { islandMix } from '../audio/islandAmbience.ts';
import type { Distance, IslandQuery, IslandRules } from '../audio/islandAmbience.ts';
import { StrandAmbience } from '../audio/synth/ambience.ts';
import type { SynthEngine } from '../audio/synth/engine.ts';
import { IslandLayers, ISLAND_SOUNDS } from '../audio/synth/islandAmb.ts';
import type { Season } from '../content/balance.ts';
import { gustAt, STRAND_WIND } from '../render/wind.ts';

export const ISLAND_RULES = (audioJson as unknown as { island: IslandRules }).island;

/** A source at `tiles`, on side `pan`. */
const at = (tiles: number, pan: number): Distance => ({ tiles, pan, x: 0, y: 0 });

interface Listen {
  readonly id: string;
  readonly label: string;
  readonly caption: string;
  readonly zone: string;
  readonly area?: string;
  readonly season: Season;
  readonly daylight?: boolean;
  /** The tide's drawn height, and the tide state for the roar and the tell. */
  readonly tide: number;
  readonly springLow?: 'before' | 'turning' | 'late';
  readonly sea?: Distance;
  readonly stream?: Distance;
  readonly falls?: Distance;
  readonly roarAt?: Distance;
  readonly drownedAt?: Distance;
}

/** Each scene once, at the season and hour it is most itself in (Book 9 section 03). */
export const ISLAND_LISTENS: readonly Listen[] = [
  {
    id: 'strand',
    label: 'ui.sound.island.strand',
    caption: 'caption.amb.strand',
    zone: 'ZONE_SK_STRAND',
    season: 'Spring',
    tide: 0.7,
    sea: at(4, 0),
    stream: at(6, -0.5),
  },
  {
    id: 'machair',
    label: 'ui.sound.island.machair',
    caption: 'caption.amb.skylark',
    zone: 'ZONE_SK_MACHAIR',
    area: 'ZONE_SK_KELDA',
    season: 'Spring',
    tide: 0.5,
    sea: at(48, 0.2),
    stream: at(3, 0.4),
  },
  {
    id: 'rook-falls',
    label: 'ui.sound.island.rook_falls',
    caption: 'caption.amb.waterfall',
    zone: 'ZONE_SK_ROOK',
    season: 'Spring',
    tide: 0.5,
    sea: at(58, -0.6),
    stream: at(4, 0.3),
    falls: at(8, 0.5),
  },
  {
    id: 'rook-winter',
    label: 'ui.sound.island.rook_winter',
    caption: 'caption.amb.wind_high',
    zone: 'ZONE_SK_ROOK',
    season: 'Winter',
    tide: 0.5,
    sea: at(58, -0.6),
    stream: at(4, 0.3),
    falls: at(8, 0.5),
  },
  {
    id: 'rook-summer',
    label: 'ui.sound.island.rook_summer',
    caption: 'caption.amb.skylark',
    zone: 'ZONE_SK_ROOK',
    season: 'Summer',
    tide: 0.5,
    sea: at(58, -0.6),
    stream: at(4, 0.3),
    falls: at(8, 0.5),
  },
  {
    id: 'cliffs',
    label: 'ui.sound.island.cliffs',
    caption: 'caption.amb.colony',
    zone: 'ZONE_SK_CLIFFS',
    season: 'Summer',
    tide: 0.6,
    sea: at(6, -0.7),
  },
  {
    id: 'geo',
    label: 'ui.sound.island.geo',
    caption: 'caption.amb.colony',
    zone: 'ZONE_SK_GEO',
    season: 'Summer',
    tide: 0.6,
    sea: at(5, 0.1),
  },
  {
    id: 'hagseat',
    label: 'ui.sound.island.hagseat',
    caption: 'caption.amb.hagseat',
    zone: 'ZONE_SK_HAGSEAT',
    season: 'Spring',
    tide: 0.5,
    sea: at(10, -0.6),
  },
  {
    id: 'bog',
    label: 'ui.sound.island.bog',
    caption: 'caption.amb.curlew',
    zone: 'ZONE_SK_BOG',
    season: 'Spring',
    tide: 0.5,
    sea: at(40, 0.6),
  },
  {
    id: 'greymen',
    label: 'ui.sound.island.greymen',
    caption: 'caption.amb.bog_quiet',
    zone: 'ZONE_SK_BOG',
    area: 'ZONE_SK_GREYMEN',
    season: 'Autumn',
    daylight: false,
    tide: 0.5,
    sea: at(44, 0.6),
  },
  {
    id: 'cairn',
    label: 'ui.sound.island.cairn',
    caption: 'caption.amb.cairn',
    zone: 'ZONE_SK_CAIRN',
    season: 'Spring',
    tide: 0.5,
    sea: at(20, 0.7),
  },
  {
    id: 'naust',
    label: 'ui.sound.island.naust',
    caption: 'caption.amb.strand',
    zone: 'ZONE_SK_NAUST',
    season: 'Autumn',
    tide: 0.8,
    sea: at(5, 0.2),
  },
  {
    id: 'sealcave',
    label: 'ui.sound.island.sealcave',
    caption: 'caption.amb.sealcave',
    zone: 'ZONE_SK_SEALCAVE',
    season: 'Spring',
    tide: 0.5,
    sea: at(6, 0),
  },
  {
    id: 'skerry',
    label: 'ui.sound.island.skerry',
    caption: 'caption.tell.drowned',
    zone: 'ZONE_SK_SKERRY',
    season: 'Spring',
    tide: 0.01,
    springLow: 'turning',
    sea: at(3, 0.3),
    drownedAt: at(10, 0.4),
  },
  {
    id: 'passage',
    label: 'ui.sound.island.passage',
    caption: 'caption.amb.passage_roar',
    zone: 'ZONE_SK_SEALCAVE_DEEP',
    season: 'Spring',
    tide: 0.01,
    springLow: 'late',
    sea: at(30, 0.6),
    roarAt: at(12, -0.5),
  },
  {
    id: 'cairn-in',
    label: 'ui.sound.island.cairn_in',
    caption: 'caption.amb.cave_drip',
    zone: 'ZONE_SK_CAIRN_IN',
    season: 'Spring',
    tide: 0.5,
  },
];

/** The rules' query for a listen. */
export function listenQuery(l: Listen): IslandQuery {
  const window = 180;
  const since = l.springLow === 'late' ? 80 : l.springLow === 'turning' ? 10 : 400;
  return {
    zone: l.zone,
    area: l.area ?? null,
    season: l.season,
    daylight: l.daylight ?? true,
    tide: {
      springTide: l.springLow !== undefined,
      tidalGroundOpen: l.springLow !== undefined,
      minutesSinceLowWater: since,
      minutesToLowWater: 720 - since,
      windowMinutes: window,
    },
    placeWind: 1,
    sea: l.sea ?? null,
    stream: l.stream ?? null,
    falls: l.falls ?? null,
    roarAt: l.roarAt ?? null,
    drownedAt: l.drownedAt ?? null,
  };
}

/** Starts a listen (`island:<id>`, or `island:SFX_TELL_DROWNED`) on an engine at `at`. */
export function startIslandItem(
  e: SynthEngine,
  id: string,
  at: number,
): { schedule: (until: number, now: number) => void; stop: (at: number) => void } {
  const tell = ISLAND_SOUNDS.find((d) => d.id === id);
  if (tell !== undefined) {
    tell.play(e, at, 0.3, { gore: 2 });
    return { schedule: () => undefined, stop: () => undefined };
  }
  const l = ISLAND_LISTENS.find((x) => x.id === id);
  if (l === undefined) throw new Error(`no island listen ${id}`);
  const mix = islandMix(ISLAND_RULES, listenQuery(l));
  const core = new StrandAmbience(e);
  core.setTide(l.tide * mix.surfNear, at);
  core.setSurf(mix.surf.level, mix.surf.pan, at);
  core.setGulls(mix.gulls);
  core.start(at);
  const layers = new IslandLayers(e);
  layers.start(at);
  layers.set(mix, at);
  const strength = Math.min(1, STRAND_WIND.strength * mix.wind * (1 - 0.25 * mix.quiet));
  let nextTell = at + 2;
  return {
    schedule: (until, now) => {
      for (let t = Math.max(at, now); t < until; t += 0.25)
        core.setWind(strength, gustAt(STRAND_WIND, 640, 900, t - at), -STRAND_WIND.dirX, t);
      core.schedule(until);
      layers.schedule(until);
      while (mix.drowned.level > 0 && nextTell < until) {
        ISLAND_SOUNDS[0]?.play(e, nextTell, mix.drowned.pan, { gore: 2 });
        nextTell += ISLAND_RULES.tellLeastSeconds;
      }
    },
    stop: (t) => {
      core.stop(t);
      layers.stop(t);
    },
  };
}

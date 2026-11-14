/**
 * The island's seasons and running water on screen (Stage 14; Book 7 sections 13 and 14, Book 9
 * sections 01 and 03; decisions S14-90 to S14-99). Presentation only: it reads the calendar's day
 * and the zone's plan, never changes the simulation, and its data is assets/art/seasons.json.
 *
 * - The season's colours: the ground, decal and plant sheets recoloured step to step along the
 *   palette's ramps (spring is the art as drawn), and the heather in bloom in late summer.
 * - The land in the water pass: snow on high ground in winter, frozen still pools, the upper
 *   stream shrunk to its pools in summer, a calmer flow with reduced motion.
 * - Wildlife by season: a share of each kind kept, the rest away (fewer gulls in winter).
 * - Each zone's flow: its streams' way to the sea, foam and waterfalls (content/terrain/flow.ts).
 *
 * Rules are per zone with a default, so a scene added later changes with the seasons at once.
 */
import seasonsJson from '../../assets/art/seasons.json';
import { SEASONS } from '../content/balance.ts';
import type { Season } from '../content/balance.ts';
import { seasonDay, seasonOf } from '../sim/calendar/calendar.ts';
import type { ZoneLife, ZoneMap } from '../content/zoneMap.ts';
import { bakeFlow } from '../content/terrain/flow.ts';
import type { FallDef, Flow, FlowOptions } from '../content/terrain/flow.ts';
import type { Elevation } from '../content/terrain/elevation.ts';
import type { Palette } from '../render/palette.ts';
import type { LandLook, Recolour } from '../render/scene.ts';
import { hash01 } from '../render/noise.ts';

const SEASON_ORDER: readonly Season[] = SEASONS;
/** One block of the island grid, in tiles (Book 9 section 01). */
const BLOCK = 8;

interface ZoneRule {
  readonly snow?: number;
  readonly freeze?: boolean;
  readonly shrink?: readonly string[];
  readonly fog?: Readonly<Partial<Record<string, number>>>;
  readonly anemones?: readonly string[];
}

export interface SeasonArt {
  readonly sheets: readonly string[];
  readonly ramps: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly bloom: {
    readonly from: { readonly season: string; readonly day: number };
    readonly to: { readonly season: string; readonly day: number };
    readonly ramps: Readonly<Record<string, string>>;
  };
  readonly default: ZoneRule;
  readonly zones: Readonly<Record<string, ZoneRule>>;
  readonly life: Readonly<Record<string, Readonly<Partial<Record<string, number>>>>>;
  readonly zoneLife: Readonly<
    Record<string, Readonly<Record<string, Readonly<Partial<Record<string, number>>>>>>
  >;
  readonly falls: Readonly<
    Record<
      string,
      readonly {
        readonly block: readonly number[];
        readonly width: number;
        readonly drop: number;
      }[]
    >
  >;
  readonly mouths: Readonly<Record<string, string>>;
  readonly seasonless: Readonly<Record<string, string>>;
}

export const SEASON_ART: SeasonArt = seasonsJson;

/** The season of a calendar day and its day within the season (1 to 30). */
export function seasonOfDay(day: number): { season: Season; day: number } {
  return { season: seasonOf(day), day: seasonDay(day) };
}

/** Whether the heather is in bloom on this day (late summer into early autumn). */
export function inBloom(day: number, art: SeasonArt = SEASON_ART): boolean {
  const at = (s: string, d: number): number => SEASON_ORDER.indexOf(s as Season) * 100 + d;
  const { season, day: sd } = seasonOfDay(day);
  const now = at(season, sd);
  return (
    now >= at(art.bloom.from.season, art.bloom.from.day) &&
    now <= at(art.bloom.to.season, art.bloom.to.day)
  );
}

function ruleOf(zone: string, art: SeasonArt): ZoneRule {
  return { ...art.default, ...(art.zones[zone] ?? {}) };
}

/** A ramp step ("grass 5") to its palette index, or throws naming it. */
function stepIndex(palette: Palette, step: string): number {
  const [ramp = '', n = ''] = step.split(' ');
  const i = palette.ramps.get(ramp)?.[Number(n)];
  if (i === undefined) throw new Error(`seasons.json: no palette step "${step}"`);
  return i;
}

/** Every ramp step the season data names, checked against the palette (for the tests). */
export function seasonSteps(art: SeasonArt = SEASON_ART): string[] {
  const all = [...Object.values(art.ramps), art.bloom.ramps].flatMap((m) =>
    Object.entries(m).flat(),
  );
  return [...new Set(all)];
}

const recolours = new Map<string, Recolour>();

/** The season's recolouring for these sheets, or undefined in spring outside the bloom. */
export function seasonRecolour(
  palette: Palette,
  day: number,
  sheetNames: Iterable<string>,
  art: SeasonArt = SEASON_ART,
): Recolour | undefined {
  const { season } = seasonOfDay(day);
  const bloom = inBloom(day, art);
  const key = `${season}${bloom ? '+bloom' : ''}`;
  const map = { ...(art.ramps[season] ?? {}), ...(bloom ? art.bloom.ramps : {}) };
  if (Object.keys(map).length === 0) return undefined;
  const hit = recolours.get(key);
  if (hit !== undefined) return hit;
  const index = new Uint8Array(256);
  for (let i = 0; i < 256; i++) index[i] = i;
  for (const [from, to] of Object.entries(map))
    index[stepIndex(palette, from)] = stepIndex(palette, to);
  const sheets = new Set<string>();
  for (const name of sheetNames)
    if (art.sheets.some((p) => (p.endsWith('_') ? name.startsWith(p) : name === p)))
      sheets.add(name);
  const out: Recolour = { key, sheets, index };
  recolours.set(key, out);
  return out;
}

/** The land in the water pass for this zone and day. */
export function landLook(
  zone: string,
  day: number,
  reducedMotion: boolean,
  art: SeasonArt = SEASON_ART,
): LandLook {
  const { season } = seasonOfDay(day);
  const rule = ruleOf(zone, art);
  return {
    snow: season === 'Winter' ? (rule.snow ?? 0) : 0,
    freeze: season === 'Winter' && rule.freeze === true,
    shrink: rule.shrink?.includes(season) === true,
    calm: reducedMotion,
    anemones: rule.anemones?.includes(season) === true,
  };
}

/** Mist the season lays in this zone (the deep passage's steam in winter), 0 to 1. */
export function seasonFog(zone: string, day: number, art: SeasonArt = SEASON_ART): number {
  return ruleOf(zone, art).fog?.[seasonOfDay(day).season] ?? 0;
}

const lifeCache = new WeakMap<readonly ZoneLife[], Map<string, readonly ZoneLife[]>>();

/** The wildlife present this season: a stable share of each kind (by its place, not chance). */
export function seasonalLife(
  zone: string,
  life: readonly ZoneLife[],
  day: number,
  art: SeasonArt = SEASON_ART,
): readonly ZoneLife[] {
  const { season } = seasonOfDay(day);
  let byKey = lifeCache.get(life);
  if (byKey === undefined) {
    byKey = new Map();
    lifeCache.set(life, byKey);
  }
  const key = `${zone}:${season}`;
  const hit = byKey.get(key);
  if (hit !== undefined) return hit;
  const out = life.filter((l) => {
    const share = art.zoneLife[zone]?.[l.kind]?.[season] ?? art.life[l.kind]?.[season] ?? 1;
    return hash01(Math.round(l.x * 10), Math.round(l.y * 10), 41) < share;
  });
  byKey.set(key, out);
  return out;
}

/** A zone's flow options: Book 9's waterfalls on its stream, and the edge it leaves by. */
export function flowOptions(map: ZoneMap, art: SeasonArt = SEASON_ART): FlowOptions {
  const origin = map.origin ?? { x: 0, y: 0 };
  // A zone plan's own falls (zone tiles) come first; then Book 9's, by island block.
  const own = (map as { readonly falls?: readonly FallDef[] }).falls ?? [];
  const fromBook = (art.falls[map.zone] ?? []).map((f): FallDef => ({
    x: (f.block[0] ?? 0) * BLOCK + BLOCK / 2 - origin.x,
    y: (f.block[1] ?? 0) * BLOCK + BLOCK / 2 - origin.y,
    width: f.width,
    drop: f.drop,
  }));
  const mouth = art.mouths[map.zone];
  return {
    ...(mouth === 'n' || mouth === 's' || mouth === 'e' || mouth === 'w' ? { mouth } : {}),
    falls: own.length > 0 ? own : fromBook.filter((f) => f.x >= 0 && f.y >= 0),
  };
}

/** The zone's flow (cached with its height field). */
export function zoneFlow(map: ZoneMap, elevation: Elevation, art: SeasonArt = SEASON_ART): Flow {
  return bakeFlow(map.rows, elevation, flowOptions(map, art));
}

/** Scenes the books keep the same in every season, with the reason (for the season test). */
export function seasonless(zone: string, art: SeasonArt = SEASON_ART): string | null {
  return art.seasonless[zone] ?? null;
}

/** What the season adds to a frame: the visual view's land and mist, the life, the colours. */
export interface IslandFrame<V> {
  readonly view: V;
  readonly life: readonly ZoneLife[];
  readonly recolour: Recolour | undefined;
}

/**
 * The season on a zone's frame (Stage 14): the land and the season's mist laid into the visual
 * view's water and effects, this season's wildlife, and the season's colours for the scene.
 */
export function islandFrame<
  V extends {
    readonly effects: {
      readonly water: {
        readonly zone: string;
        readonly tide: number;
        readonly wetTo: number;
      } | null;
      readonly fog: number;
    } | null;
  },
>(
  view: V,
  map: ZoneMap,
  day: number,
  reducedMotion: boolean,
  palette: Palette,
  sheetNames: Iterable<string>,
  art: SeasonArt = SEASON_ART,
): IslandFrame<V> {
  const fx = view.effects;
  const land = landLook(map.zone, day, reducedMotion, art);
  const fog = seasonFog(map.zone, day, art);
  const out =
    fx === null
      ? view
      : {
          ...view,
          effects: {
            ...fx,
            water: fx.water === null ? null : { ...fx.water, land },
            fog: Math.max(fx.fog, fog),
          },
        };
  return {
    view: out,
    life: seasonalLife(map.zone, map.life, day, art),
    recolour: seasonRecolour(palette, day, sheetNames, art),
  };
}

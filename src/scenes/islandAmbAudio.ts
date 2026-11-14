/**
 * The island's ambience in play (Stage 14; decisions S14-100 to S14-109): four times a second it
 * asks the rules (src/audio/islandAmbience.ts) what the steerer hears where they stand, gives the
 * mix to the engine, captions a stream or waterfall heard but out of view, and sounds the
 * drowned's tell now and then while it holds. Presentation only: it reads the calendar, the zone's
 * tiles and the steerer's place.
 */
import { areaAt, directionOf, islandMix, SoundField } from '../audio/islandAmbience.ts';
import type { AreaMark, Distance, IslandRules } from '../audio/islandAmbience.ts';
import type { AudioRouter } from '../audio/router.ts';
import type { Season } from '../content/balance.ts';
import type { Flow } from '../content/terrain/flow.ts';
import type { ZoneMap } from '../content/zoneMap.ts';

export interface IslandHearing {
  readonly map: ZoneMap;
  readonly flow: Flow | null;
  /** The steerer, in world pixels, and the view's top-left and size. */
  readonly x: number;
  readonly y: number;
  readonly view: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly season: Season;
  readonly daylight: boolean;
  readonly tide: {
    readonly springTide: boolean;
    readonly tidalGroundOpen: boolean;
    readonly minutesSinceLowWater: number;
    readonly minutesToLowWater: number;
  };
  readonly windowMinutes: number;
  /** The audio clock, seconds. */
  readonly now: number;
}

/** Whether a zone is one of the island's (its rules, or a scene of Skarvholm). */
export function islandZone(rules: IslandRules, zone: string): boolean {
  return rules.zones[zone] !== undefined || zone.startsWith('ZONE_SK_');
}

export class IslandAudio {
  readonly #rules: IslandRules;
  readonly #maps: readonly ZoneMap[];
  readonly #areas: readonly AreaMark[];
  #field: SoundField | null = null;
  readonly #said = new Map<string, number>();
  #nextTell = -1;
  #seed = 7;

  constructor(rules: IslandRules, maps: Iterable<ZoneMap>, areas: readonly AreaMark[]) {
    this.#rules = rules;
    this.#maps = [...maps];
    this.#areas = areas;
  }

  /** The mix for now (null off the island), with its captions and tells sent to the router. */
  update(h: IslandHearing, router: AudioRouter | null) {
    const rules = this.#rules;
    const map = h.map;
    if (!islandZone(rules, map.zone)) return null;
    if (this.#field?.map !== map) {
      this.#field = new SoundField(map, this.#maps, h.flow);
      this.#nextTell = -1;
    }
    const f = this.#field;
    const tx = h.x / map.tile;
    const ty = h.y / map.tile;
    // The zone file's own areas win over the island's marks (content/island.json).
    const own = (map as { readonly areas?: readonly AreaMark[] }).areas;
    const area = areaAt(own ?? this.#areas, map.zone, tx, ty);
    const rule = { ...rules.zones[map.zone], ...(area === null ? {} : rules.areas[area]) };
    const mix = islandMix(rules, {
      zone: map.zone,
      area,
      season: h.season,
      daylight: h.daylight,
      tide: { ...h.tide, windowMinutes: h.windowMinutes },
      placeWind: map.wind ?? 1,
      sea: f.sea(tx, ty, rules.reach.sea.silentTiles),
      stream: f.stream(tx, ty, rules.reach.stream.silentTiles),
      falls: f.falls(tx, ty, rules.reach.falls.silentTiles),
      roarAt: f.point(rule.roar, tx, ty),
      drownedAt: f.point(rule.drowned, tx, ty),
    });
    if (router === null) return mix;
    // A stream or a fall heard but not seen: its caption, with its direction, once a while.
    const unseen = (id: string, level: number, at: Distance | null, from: number): void => {
      if (at === null || level < from) return;
      const v = h.view;
      if (at.x >= v.x && at.y >= v.y && at.x < v.x + v.w && at.y < v.y + v.h) return;
      const last = this.#said.get(id) ?? -Infinity;
      if (h.now - last < rules.captionAgainSeconds) return;
      this.#said.set(id, h.now);
      router.announce(id, h.now, { direction: directionOf(at.x - h.x, at.y - h.y) });
    };
    unseen('AMB_WATERFALL', mix.falls.level, f.falls(tx, ty, rules.reach.falls.silentTiles), 0.3);
    unseen('AMB_STREAM', mix.stream.level, f.stream(tx, ty, rules.reach.stream.silentTiles), 0.5);
    // The drowned's tell, every so often while they stand on the Skerry.
    if (mix.drowned.level > 0) {
      if (this.#nextTell < 0) this.#nextTell = h.now + 2;
      if (h.now >= this.#nextTell) {
        const at = f.point(rule.drowned, tx, ty);
        router.play('SFX_TELL_DROWNED', h.now, {
          pan: mix.drowned.pan,
          ...(at === null ? {} : { direction: directionOf(at.x - h.x, at.y - h.y) }),
        });
        // A steady, seeded spread between the least and the most wait (no Math.random in play).
        this.#seed = (this.#seed * 1103515245 + 12345) % 2147483648;
        const u = this.#seed / 2147483648;
        this.#nextTell =
          h.now + rules.tellLeastSeconds + u * (rules.tellMostSeconds - rules.tellLeastSeconds);
      }
    } else this.#nextTell = -1;
    return mix;
  }
}

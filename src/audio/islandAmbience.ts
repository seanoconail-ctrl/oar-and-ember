/**
 * The island's ambience by rule (Stage 14; Book 11 sections 07, 09 and 12; decisions S14-100 to
 * S14-109): which layers play, how loud and from which side, for every zone and area, season and
 * hour, from `content/audio.json` `island`. Pure and cheap: the play view asks four times a
 * second, never per frame. Audio is presentation only: it reads the calendar, the zone's own
 * tiles and the steerer's place, never hidden truth.
 *
 * Layers: the surf by the distance to the sea (over every zone of the island, not only this one),
 * the wind (strongest on the high ground and headlands), the birds (the cliff colony, the skylark
 * over the moor, the curlew on the bog) by season and by day, the stream and the waterfall by
 * their distance, the cave's drip and echo, the deep passage's roar rising as the tide turns
 * towards the flood, the drowned's tell on the Skerry at a spring low, and the bog's quiet.
 *
 * Rules: the zone's rule over the default, the area's over the zone's; the season's and the
 * night's scales over both. A zone with no rule of its own still gets its surf, wind, stream and
 * falls from its tiles, so a scene added later is heard at once.
 */
import type { Season } from '../content/balance.ts';
import { BIRD_KINDS } from '../content/islandAudioSchema.ts';
import type {
  BirdKind,
  IslandRule,
  IslandRules,
  Reach,
  Scale,
  SoundPoint,
} from '../content/islandAudioSchema.ts';
import { ELEVATION_CELL } from '../content/terrain/elevation.ts';
import type { Flow } from '../content/terrain/flow.ts';
import type { ZoneMap } from '../content/zoneMap.ts';

export type {
  BirdKind,
  BirdRule,
  IslandRule,
  IslandRules,
  Reach,
  Scale,
  SoundPoint,
} from '../content/islandAudioSchema.ts';
export { BIRD_KINDS } from '../content/islandAudioSchema.ts';

/** An area (Book 9 section 01): a named rectangle of a scene, in its tiles. */
export interface AreaMark {
  readonly id: string;
  readonly scene: string;
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

/** A sound from a place: how loud (0 to 1) and from which side (-1 left to 1 right). */
export interface Voice {
  readonly level: number;
  readonly pan: number;
}

export interface IslandMix {
  readonly zone: string;
  readonly area: string | null;
  /** The wind's strength against the place's own (the strand's is 1). */
  readonly wind: number;
  /** The sea: how loud, from which side, and how near its waves break (0 far .. 1 at the shore). */
  readonly surf: Voice;
  readonly surfNear: number;
  readonly gulls: number;
  readonly birds: Readonly<Record<BirdKind, Voice>>;
  readonly stream: Voice;
  readonly falls: Voice;
  readonly cave: number;
  readonly roar: Voice;
  readonly drowned: Voice;
  readonly quiet: number;
}

/** What the mix is asked about: the place, the time, the tide and where the steerer stands. */
export interface IslandQuery {
  readonly zone: string;
  readonly area: string | null;
  readonly season: Season;
  readonly daylight: boolean;
  readonly tide: {
    readonly springTide: boolean;
    readonly tidalGroundOpen: boolean;
    readonly minutesSinceLowWater: number;
    readonly minutesToLowWater: number;
    /** Book 10 tidalGroundWindow, game minutes. */
    readonly windowMinutes: number;
  };
  /** The place's own wind against the strand's (the zone plan's `wind`, 1 if none). */
  readonly placeWind: number;
  readonly sea: Distance | null;
  readonly stream: Distance | null;
  readonly falls: Distance | null;
  /** Point sources of this zone's rules, measured from the listener. */
  readonly roarAt: Distance | null;
  readonly drownedAt: Distance | null;
}

/** How far a sound's nearest source is (tiles) and the side it lies on (-1 .. 1). */
export interface Distance {
  readonly tiles: number;
  readonly pan: number;
  /** World pixels of the source (for captions: is it on screen?). */
  readonly x: number;
  readonly y: number;
}

const SILENT: Voice = { level: 0, pan: 0 };

/** The rule for a zone and area: the default, then the zone's, then the area's. */
export function ruleFor(rules: IslandRules, zone: string, area: string | null): IslandRule {
  return {
    ...rules.default,
    ...(rules.zones[zone] ?? {}),
    ...(area === null ? {} : (rules.areas[area] ?? {})),
  };
}

/** 1 within `fullTiles`, 0 from `silentTiles`, linear between. */
export function reachLevel(reach: Reach, tiles: number): number {
  const span = Math.max(0.001, reach.silentTiles - reach.fullTiles);
  return Math.max(0, Math.min(1, (reach.silentTiles - tiles) / span));
}

/**
 * The deep passage's roar, 0 to 1 (Book 9 section 16: "the passage grows loud as the tide turns";
 * Book 10 tidalGroundWindow): on a spring-tide day it is quiet before low water and rises from the
 * turn to the window's close, when the lowest point goes deep; then it is the flood, full.
 */
export function roarLevel(tide: IslandQuery['tide']): number {
  // Off the spring tides the passage lies under the sea: only the sea's slop in the cleft.
  if (!tide.springTide) return 0.3;
  const half = tide.windowMinutes / 2;
  if (!tide.tidalGroundOpen) return tide.minutesSinceLowWater < tide.minutesToLowWater ? 1 : 0.2;
  if (tide.minutesToLowWater <= half && tide.minutesToLowWater < tide.minutesSinceLowWater)
    return 0;
  return Math.max(0, Math.min(1, tide.minutesSinceLowWater / Math.max(1, half)));
}

/** The island's ambience for a moment (see the module comment). */
export function islandMix(rules: IslandRules, q: IslandQuery): IslandMix {
  const rule = ruleFor(rules, q.zone, q.area);
  const season = rules.seasons[q.season] ?? {};
  const night = q.daylight ? {} : rules.night;
  const k = (key: keyof Scale): number => (season[key] ?? 1) * (night[key] ?? 1);
  const near = q.sea === null ? 0 : reachLevel(rules.reach.sea, q.sea.tiles);
  const surfLevel = (rule.surf ?? 1) * Math.max(rule.surfFloor ?? 0, near) * k('surf');
  const birds = Object.fromEntries(BIRD_KINDS.map((b) => [b, SILENT])) as Record<BirdKind, Voice>;
  for (const b of rule.birds ?? []) {
    if (b.seasons !== undefined && !b.seasons.includes(q.season)) continue;
    if (b.day === true && !q.daylight) continue;
    // Birds call from either side; the pan is chosen per call by the synthesiser.
    birds[b.kind] = { level: Math.min(2, b.rate * k('birds')), pan: 0 };
  }
  const running = rule.dry?.includes(q.season) !== true;
  const stream =
    q.stream === null || !running
      ? SILENT
      : {
          level: (rule.stream ?? 1) * reachLevel(rules.reach.stream, q.stream.tiles),
          pan: q.stream.pan,
        };
  // In a dry summer only a thread falls; frozen, it is hung with ice and barely runs.
  const fallsScale = !running ? 0.25 : rule.frozen?.includes(q.season) === true ? 0.3 : 1;
  const falls =
    q.falls === null
      ? SILENT
      : {
          level: (rule.falls ?? 1) * fallsScale * reachLevel(rules.reach.falls, q.falls.tiles),
          pan: q.falls.pan,
        };
  const roar =
    rule.roar === undefined || q.roarAt === null
      ? SILENT
      : {
          level: roarLevel(q.tide) * (0.55 + 0.45 * reachLevel(rules.reach.falls, q.roarAt.tiles)),
          pan: q.roarAt.pan,
        };
  // The drowned stand on the Skerry at the spring lows only (Book 4 section 02).
  const drowned =
    rule.drowned === undefined ||
    q.drownedAt === null ||
    !q.tide.springTide ||
    !q.tide.tidalGroundOpen
      ? SILENT
      : { level: reachLevel(rules.reach.tell, q.drownedAt.tiles), pan: q.drownedAt.pan };
  return {
    zone: q.zone,
    area: q.area,
    wind: (rule.wind ?? q.placeWind) * k('wind'),
    surf: { level: surfLevel, pan: q.sea?.pan ?? 0 },
    surfNear: near,
    gulls: (rule.gulls ?? 1) * k('gulls'),
    birds,
    stream,
    falls,
    cave: rule.cave ?? 0,
    roar,
    drowned,
    quiet: rule.quiet ?? 0,
  };
}

/** The area of the scene the point (zone tiles) lies in, if any. */
export function areaAt(
  areas: readonly AreaMark[],
  zone: string,
  x: number,
  y: number,
): string | null {
  for (const a of areas)
    if (
      a.scene === zone &&
      x >= a.rect.x &&
      y >= a.rect.y &&
      x < a.rect.x + a.rect.w &&
      y < a.rect.y + a.rect.h
    )
      return a.id;
  return null;
}

/** The side a point lies on from the listener, -1 (left) to 1 (right), never hard over. */
export function panOf(dx: number, dy: number): number {
  const d = Math.hypot(dx, dy);
  return d < 0.5 ? 0 : Math.max(-0.8, Math.min(0.8, dx / d));
}

/**
 * A zone's sound field (built once per zone): the sea's tiles over the whole island (every zone
 * with its place on the island, so the machair hears the strand's surf), the stream's running
 * samples and the waterfalls. Queries scan a small window, four times a second.
 */
export class SoundField {
  readonly map: ZoneMap;
  readonly #sea: Int16Array;
  readonly #stream: Float32Array;
  readonly #falls: readonly { readonly x: number; readonly y: number }[];

  constructor(map: ZoneMap, allMaps: Iterable<ZoneMap>, flow: Flow | null) {
    this.map = map;
    // Sea tiles every other tile, in this zone's tiles (other zones placed by their origins).
    const sea: number[] = [];
    const o = map.origin;
    for (const m of allMaps) {
      if (m !== map && (o === undefined || m.origin === undefined)) continue;
      const ox = m === map ? 0 : (m.origin?.x ?? 0) - (o?.x ?? 0);
      const oy = m === map ? 0 : (m.origin?.y ?? 0) - (o?.y ?? 0);
      // Only zones near enough to be heard.
      if (Math.abs(ox) > map.width + 64 || Math.abs(oy) > map.height + 64) continue;
      for (let y = 0; y < m.height; y += 2) {
        const row = m.rows[y] ?? '';
        for (let x = 0; x < m.width; x += 2) if (row[x] === '~') sea.push(x + ox, y + oy);
      }
    }
    this.#sea = Int16Array.from(sea);
    // The stream's running water (a pool is quiet), every few samples, in tiles.
    const stream: number[] = [];
    if (flow !== null) {
      const per = map.tile / ELEVATION_CELL;
      for (let j = 0; j < flow.height; j += 3)
        for (let i = 0; i < flow.width; i += 3) {
          const k = j * flow.width + i;
          const s = flow.speed[k] ?? 0;
          if (s > 0.25 || (flow.fall[k] ?? 0) !== 0)
            stream.push((i + 0.5) / per, (j + 0.5) / per, s);
        }
    }
    this.#stream = Float32Array.from(stream);
    this.#falls = (flow?.falls ?? []).map((f) => ({
      x: f.x / map.tile,
      y: (f.lipY + f.footY) / 2 / map.tile,
    }));
  }

  #nearest(
    points: ArrayLike<number>,
    step: number,
    x: number,
    y: number,
    max: number,
  ): Distance | null {
    let best = Infinity;
    let bx = 0;
    let by = 0;
    // A broad source (the sea) is heard from where most of it lies: the near part, weighted.
    let wx = 0;
    let wy = 0;
    let ws = 0;
    for (let i = 0; i + 1 < points.length; i += step) {
      const dx = (points[i] ?? 0) - x;
      const dy = (points[i + 1] ?? 0) - y;
      if (Math.abs(dx) > max || Math.abs(dy) > max) continue;
      const d = Math.hypot(dx, dy);
      if (d < best) {
        best = d;
        bx = dx;
        by = dy;
      }
      const w = 1 / (1 + d * d);
      wx += dx * w;
      wy += dy * w;
      ws += w;
    }
    if (!Number.isFinite(best)) return null;
    const pan = ws > 0 ? panOf(wx / ws, wy / ws) : panOf(bx, by);
    return { tiles: best, pan, x: (x + bx) * this.map.tile, y: (y + by) * this.map.tile };
  }

  /** The sea nearest the listener (zone tiles), within `max` tiles. */
  sea(x: number, y: number, max: number): Distance | null {
    return this.#nearest(this.#sea, 2, x, y, max);
  }

  /** The running stream nearest the listener, within `max` tiles. */
  stream(x: number, y: number, max: number): Distance | null {
    return this.#nearest(this.#stream, 3, x, y, max);
  }

  /** The waterfall nearest the listener, within `max` tiles. */
  falls(x: number, y: number, max: number): Distance | null {
    const flat = this.#falls.flatMap((f) => [f.x, f.y]);
    return this.#nearest(flat, 2, x, y, max);
  }

  /** A rule's point (zone tiles or island blocks), measured from the listener. */
  point(p: SoundPoint | undefined, x: number, y: number): Distance | null {
    if (p === undefined) return null;
    const o = this.map.origin ?? { x: 0, y: 0 };
    const at =
      p.tiles !== undefined
        ? { x: p.tiles[0] ?? 0, y: p.tiles[1] ?? 0 }
        : p.block !== undefined
          ? { x: (p.block[0] ?? 0) * 8 + 4 - o.x, y: (p.block[1] ?? 0) * 8 + 4 - o.y }
          : null;
    if (at === null) return null;
    return {
      tiles: Math.hypot(at.x - x, at.y - y),
      pan: panOf(at.x - x, at.y - y),
      x: at.x * this.map.tile,
      y: at.y * this.map.tile,
    };
  }
}

/** The eight ways a sound can lie from the listener, for its caption (Book 11 section 09). */
export function directionOf(
  dx: number,
  dy: number,
): 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' {
  const a = Math.atan2(dy, dx);
  const ways = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
  return ways[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8] ?? 'n';
}

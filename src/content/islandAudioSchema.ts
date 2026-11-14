/**
 * Stage 14 (decisions S14-100 to S14-109): the shape of `content/audio.json` `island`, the
 * island's ambience by zone, area, season and hour (src/audio/islandAmbience.ts reads it).
 * Presentation numbers like the table's `home` and `south`, validated at load.
 */
import { SEASONS } from './balance.ts';
import { arrayOf, bool, object, oneOf, recordOf, ref, text } from './schema.ts';
import type { Check } from './schema.ts';
import type { Season } from './balance.ts';

export type BirdKind = 'colony' | 'skylark' | 'curlew';
export const BIRD_KINDS: readonly BirdKind[] = ['colony', 'skylark', 'curlew'];

export interface BirdRule {
  readonly kind: BirdKind;
  readonly rate: number;
  readonly seasons?: readonly Season[];
  /** Sings by day only (the skylark); the curlew and the colony call at night too, fewer. */
  readonly day?: boolean;
}

/** A point on the island: zone tiles, or island blocks (Book 9's grid), for a sound's source. */
export interface SoundPoint {
  readonly tiles?: readonly number[];
  readonly block?: readonly number[];
}

export interface IslandRule {
  readonly wind?: number;
  readonly surf?: number;
  /** The sea is heard at least this much anywhere in the zone (a small island). */
  readonly surfFloor?: number;
  readonly gulls?: number;
  readonly birds?: readonly BirdRule[];
  readonly stream?: number;
  readonly falls?: number;
  readonly cave?: number;
  readonly quiet?: number;
  /** The deep passage's roar, from its lowest point. */
  readonly roar?: SoundPoint;
  /** The drowned's tell on the Skerry, from the skerry's rock. */
  readonly drowned?: SoundPoint;
  /** Seasons the zone's stream falls silent in (the upper stream shrunk to pools, S14-5). */
  readonly dry?: readonly Season[];
  /** Seasons its still water freezes in (the bog pools in winter). */
  readonly frozen?: readonly Season[];
}

export interface Scale {
  readonly wind?: number;
  readonly gulls?: number;
  readonly birds?: number;
  readonly surf?: number;
}

export interface Reach {
  readonly fullTiles: number;
  readonly silentTiles: number;
}

export interface IslandRules {
  readonly reach: {
    readonly sea: Reach;
    readonly stream: Reach;
    readonly falls: Reach;
    readonly tell: Reach;
  };
  readonly captionAgainSeconds: number;
  readonly tellLeastSeconds: number;
  readonly tellMostSeconds: number;
  /** The roar's level at which its caption shows (*The passage grows loud*). */
  readonly roarCaptionAt: number;
  readonly default: IslandRule;
  readonly zones: Readonly<Record<string, IslandRule>>;
  readonly areas: Readonly<Record<string, IslandRule>>;
  readonly seasons: Readonly<Partial<Record<Season, Scale>>>;
  readonly night: Scale;
}

const amount =
  (max: number): Check<number> =>
  (v, path, ctx) =>
    typeof v === 'number' && v >= 0 && v <= max
      ? v
      : (ctx.issues.push({ file: ctx.file, path, reason: `expected a number from 0 to ${max}` }),
        null);

const point = object({ tiles: arrayOf(amount(512)), block: arrayOf(amount(64)) }, [
  'tiles',
  'block',
]);
const seasons = arrayOf(oneOf(SEASONS));
const bird = object(
  {
    kind: oneOf(['colony', 'skylark', 'curlew'] as const),
    rate: amount(3),
    seasons,
    day: bool,
  },
  ['seasons', 'day'],
);
const rule = object(
  {
    wind: amount(3),
    surf: amount(2),
    surfFloor: amount(1),
    gulls: amount(3),
    birds: arrayOf(bird),
    stream: amount(2),
    falls: amount(2),
    cave: amount(2),
    quiet: amount(2),
    roar: point,
    drowned: point,
    dry: seasons,
    frozen: seasons,
  },
  [
    'wind',
    'surf',
    'surfFloor',
    'gulls',
    'birds',
    'stream',
    'falls',
    'cave',
    'quiet',
    'roar',
    'drowned',
    'dry',
    'frozen',
  ],
);
const scale = object({ wind: amount(3), gulls: amount(3), birds: amount(3), surf: amount(3) }, [
  'wind',
  'gulls',
  'birds',
  'surf',
]);
const reach = object({ fullTiles: amount(200), silentTiles: amount(400) });

export const islandAudioCheck: Check<IslandRules & { readonly about: string }> = object({
  about: text,
  reach: object({ sea: reach, stream: reach, falls: reach, tell: reach }),
  captionAgainSeconds: amount(600),
  tellLeastSeconds: amount(600),
  tellMostSeconds: amount(600),
  roarCaptionAt: amount(1),
  default: rule,
  zones: recordOf(ref('zone'), rule),
  areas: recordOf(ref('zone'), rule),
  seasons: recordOf(oneOf(SEASONS), scale),
  night: scale,
}) as unknown as Check<IslandRules & { readonly about: string }>;

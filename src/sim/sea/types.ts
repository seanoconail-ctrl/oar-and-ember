/**
 * The sea map's types (Book 2 section 09; Stage 13). Everything the sea-map screen, the wreck
 * scene and the sea's audio read or send is declared here, so they can be built beside the
 * simulation: the weather and forecast, a plotted course, the voyage under way, its hold, its
 * choice and its handoff, the events the simulation emits and the commands it takes.
 *
 * All of it is plain data saved in the world state (`world.sea`, version 15).
 */
import type { Id } from '../../core/ids.ts';
import type { Point8 } from '../../content/seaBalance.ts';
import type { FactValue } from '../world.ts';
import type { OnFootState } from '../land/onFoot.ts';

export type { Point8 };

/** Wind strength: 0 a calm (the boat rows) to 4 a storm (Book 10 stormFrom). */
export type WindStrength = 0 | 1 | 2 | 3 | 4;
/** What is drawn for a day; NIGHT is the clock's (Book 10 Daylight), never drawn. */
export type DayVisibility = 'CLEAR' | 'HAZE' | 'FOG';
export type Visibility = DayVisibility | 'NIGHT';
/** Book 10 section 11's named storms. */
export type NamedStorm = 'FIRST_STORM' | 'AUTUMN_STORM' | 'CAILLEACH';

/** One day's weather, drawn at the day's start on the weather stream. */
export interface DayWeather {
  readonly day: number;
  readonly windFrom: Point8;
  readonly strength: WindStrength;
  readonly visibility: DayVisibility;
  /** A named storm's day (always strength 4), or null. */
  readonly named: NamedStorm | null;
  /** A winter calm-window day: winter-closed crossings open (Book 10 calmWindowDays). */
  readonly calm: boolean;
}

/** The household's one-day forecast of a day (Book 10 forecastAccuracy). */
export interface Forecast {
  readonly day: number;
  readonly windFrom: Point8;
  readonly strength: WindStrength;
  readonly visibility: DayVisibility;
  readonly storm: boolean;
  readonly calm: boolean;
}

/** A year's named storm days, drawn on the year's first day. */
export interface StormYear {
  readonly year: number;
  readonly firstStorm: number;
  readonly autumn: readonly number[];
  /** The Cailleach's washing: winter closure begins on this day of the year. */
  readonly washing: number;
}

export interface WeatherState {
  /** The last day drawn (tomorrow, once today has begun); 0 before any. */
  rolledTo: number;
  /** Yesterday, today and tomorrow, by day. */
  days: Record<number, DayWeather>;
  /** The household's forecast for each drawn day after the first, by day. */
  forecasts: Record<number, Forecast>;
  /** The named storms of the years drawn so far. */
  years: Record<number, StormYear>;
  /** Days left in the calm window under way (after the one drawn last). */
  calmLeft: number;
}

/** Book 10 section 02, "Encounters": the governor's tallies (Book 2 section 09). */
export interface SeaGovernor {
  /** Legs offered to the governor, and how many were eventful. */
  legs: number;
  eventful: number;
  /** The eventful credit: + eventfulShare a leg, - 1 an eventful leg. */
  credit: number;
  /** Voyages (courses set and sailed), and supernatural encounters met. */
  voyages: number;
  supernatural: number;
  /** The supernatural credit: + 1 / supernaturalEvery a voyage, - 1 a supernatural encounter. */
  superCredit: number;
}

export type PointOfSail = 'RUNNING' | 'BROAD_REACH' | 'BEAM' | 'CLOSE_HAULED' | 'AGAINST' | 'CALM';

/** One leg of a course: an edge crossed in one direction. */
export interface LegPlan {
  readonly edge: Id;
  readonly from: Id;
  readonly to: Id;
  readonly bearing: Point8;
  readonly pointOfSail: PointOfSail;
  /** Effective speed (the larger of sail and rowing), and whether it is rowing. */
  readonly speed: number;
  readonly rowing: boolean;
  /** Whole game minutes under way. */
  readonly minutes: number;
  readonly exposure: 0 | 1 | 2 | 3;
  /** Game minutes the boat must wait at the leg's end for slack water to go on (plans only). */
  readonly waitMinutes: number;
  /** Campaign minute the leg is expected to start (plans only). */
  readonly startsAt: number;
}

/** A plotted course (Book 2 section 09, plotting). */
export interface SeaPlan {
  readonly from: Id;
  readonly to: Id;
  readonly legs: readonly LegPlan[];
  /** Total game minutes, waits included, and in watches (minutes / 360). */
  readonly minutes: number;
  readonly watches: number;
  /** Ration-days the crew of the plan will eat on the way. */
  readonly storesRd: number;
  /** The campaign minute it was plotted at. */
  readonly plottedAt: number;
  /** Whether a story gate starts on setting out (the Carrick raid). */
  readonly gate: Id | null;
}

/** Why a course cannot be plotted or sailed: each said in words (content/sea.json `words`). */
export type SeaRefusal =
  | 'UNKNOWN_PLACE'
  | 'HERE'
  | 'INLAND'
  | 'NO_KNOWN_ROUTE'
  | 'WINTER'
  | 'NO_WAY'
  | 'NOT_READY'
  | 'AT_SEA'
  | 'NOT_AT_SEA'
  | 'FIXED_NIGHT'
  | 'NO_PLAN'
  | 'NO_CREW'
  | 'NOT_SAFE'
  | 'BUSY';

export type PlotResult =
  | { readonly ok: true; readonly plan: SeaPlan }
  | {
      readonly ok: false;
      readonly reason: SeaRefusal;
      readonly textKey: string;
      readonly vars: Readonly<Record<string, string | number>>;
    };

/** A reference to an encounter table's entry. */
export interface EncounterRef {
  readonly table: Id;
  readonly key: string;
  readonly textKey: string;
  readonly supernatural: boolean;
  readonly story: boolean;
  /** A playable scene it hands off to, or null for a sight said in words. */
  readonly scene: { readonly kind: HandoffKind; readonly scenario: Id } | null;
}

/** The leg under way. */
export interface ActiveLeg {
  readonly edge: Id;
  readonly from: Id;
  readonly to: Id;
  readonly bearing: Point8;
  readonly pointOfSail: PointOfSail;
  readonly speed: number;
  readonly rowing: boolean;
  readonly exposure: 0 | 1 | 2 | 3;
  readonly minutes: number;
  /** Minutes of it sailed. */
  done: number;
  /** The governor's word: an encounter, and the minute of the leg it falls at (null: quiet). */
  readonly encounter: EncounterRef | null;
  readonly encounterAt: number | null;
  fired: boolean;
  /** Whether it passes Rán's Reach (storms fiercer). */
  readonly ransReach: boolean;
}

export type HoldReason = 'TIDE' | 'WINTER' | 'SHELTER';

export interface SeaHold {
  readonly reason: HoldReason;
  /** The campaign minute the hold ends at (the next slack, the shelter's hour), or null (winter). */
  readonly until: number | null;
  readonly textKey: string;
}

/** The sea map's one choice (decision S13-10): weather rising, press on or shelter. */
export interface SeaChoice {
  readonly kind: 'WEATHER_RISING';
  readonly edge: Id;
  readonly textKey: string;
  readonly options: readonly { readonly option: SeaOption; readonly textKey: string }[];
}
export type SeaOption = 'PRESS_ON' | 'SHELTER';

export type HandoffKind = 'ON_FOOT' | 'SEA_BATTLE';

/** A handoff waiting for its scene's result (stored in the voyage). */
export interface HandoffState {
  readonly kind: HandoffKind;
  readonly scenarioId: Id;
  readonly placeId: Id | null;
  readonly edgeId: Id | null;
  /** Arriving at a landing (Carrick), not an interruption on the way. */
  readonly landing: boolean;
  /** The stage that builds the scene, while it is a stub (Carrick: 16). */
  readonly stubUntilStage: number | null;
}

/** What a scene is handed (Book 2 section 09): the handoff and the voyage it interrupts. */
export interface HandoffRequest extends HandoffState {
  readonly voyage: Readonly<VoyageState>;
}

/** What a scene hands back (`SEA_HANDOFF_RETURN`). */
export interface HandoffResult {
  /** Go on with the voyage (or lie at the landing), or turn for home. */
  readonly outcome: 'CONTINUE' | 'TURN_BACK';
  /** Facts the scene sets (superseding, never deleting). */
  readonly facts: Readonly<Record<string, FactValue>>;
  /** People who came aboard (survivors taken off) and who left the boat. */
  readonly aboardChanges: { readonly join: readonly Id[]; readonly leave: readonly Id[] };
  /** Ration-days added to (or taken from) the ship's stores; they never fall below zero. */
  readonly storesDelta: number;
}

export type VoyageStatus = 'SAILING' | 'HELD' | 'CHOICE' | 'HANDOFF' | 'ANCHORED';

/** The voyage under way (Book 2 section 09): from setting out to coming home. */
export interface VoyageState {
  /** The voyage's number in the campaign (the governor's count). */
  readonly id: number;
  /** Where it set out from (home), the course's end, and the node last reached. */
  readonly from: Id;
  to: Id;
  at: Id;
  /** The edge it arrived at `at` by (turning back along it needs no slack). */
  arrivedBy: Id | null;
  /** The course's edges still to sail, in order (the leg under way first). */
  route: Id[];
  leg: ActiveLeg | null;
  status: VoyageStatus;
  hold: SeaHold | null;
  choice: SeaChoice | null;
  /** Edges whose rising-weather choice was answered PRESS_ON for this course. */
  pressed: Id[];
  handoff: HandoffState | null;
  /** Residents aboard (the steerer is always aboard). */
  aboard: Id[];
  /** The ship's stores by RES_ id, in ration-days. */
  stores: Record<string, number>;
  /** Watches with a shortage, and the ration-days short in all. */
  shortWatches: number;
  shortRd: number;
  /** Game minutes at sea, legs sailed, and the encounters met (table:key). */
  minutes: number;
  legs: number;
  met: string[];
  /** The story gate started by this course, if any. */
  gate: Id | null;
}

/** The sea's part of the world state (`world.sea`, version 15). */
export interface SeaState {
  weather: WeatherState;
  governor: SeaGovernor;
  /** The course plotted on the sea map and not yet sailed. */
  plan: SeaPlan | null;
  voyage: VoyageState | null;
  /** The home's on-foot scene, kept while the steerer is at sea (decision S13-17). */
  stash: OnFootState | null;
  /** Encounters that happen once, by table:key, and the day they happened. */
  once: Record<string, number>;
}

/** Routes known (`world.knowledge.routes`): rumoured or sailed. */
export type RouteKnowledge = 'RUMOURED' | 'KNOWN';

/** The sea map's events (part of SimEvent). */
export type SeaEvent =
  | { readonly type: 'SEA_PLOTTED'; readonly plan: SeaPlan }
  | {
      readonly type: 'SEA_REFUSED';
      readonly reason: SeaRefusal;
      readonly textKey: string;
      readonly vars: Readonly<Record<string, string | number>>;
    }
  /** Set sail: `autosave` is Book 2 section 20's departure autosave. */
  | {
      readonly type: 'SEA_DEPARTED';
      readonly voyage: number;
      readonly from: Id;
      readonly to: Id;
      readonly autosave: 'DEPARTURE';
    }
  | {
      readonly type: 'SEA_LEG_STARTED';
      readonly edge: Id;
      readonly pointOfSail: PointOfSail;
      readonly speed: number;
      readonly minutes: number;
    }
  /** A watch (or the part of one up to a node, an encounter or a hold's end) has passed. */
  | {
      readonly type: 'SEA_WATCH';
      readonly minutes: number;
      readonly edge: Id | null;
      readonly done: number;
      readonly of: number;
      readonly storm: boolean;
    }
  | { readonly type: 'SEA_HELD'; readonly reason: HoldReason; readonly textKey: string; readonly until: number | null }
  | { readonly type: 'SEA_CHOICE'; readonly choice: SeaChoice }
  | { readonly type: 'SEA_CHOSEN'; readonly option: SeaOption }
  | {
      readonly type: 'SEA_ENCOUNTER';
      readonly encounter: EncounterRef;
      readonly edge: Id;
    }
  | { readonly type: 'SEA_HANDOFF'; readonly handoff: HandoffState }
  | { readonly type: 'SEA_HANDOFF_RETURNED'; readonly outcome: HandoffResult['outcome'] }
  | { readonly type: 'SEA_STORES_SHORT'; readonly textKey: string; readonly shortRd: number }
  | { readonly type: 'SEA_STORM_DAMAGE'; readonly textKey: string; readonly integrity: number }
  | { readonly type: 'SEA_ARRIVED'; readonly node: Id; readonly place: boolean; readonly textKey: string | null }
  | { readonly type: 'SEA_ROUTE_KNOWN'; readonly edge: Id; readonly known: RouteKnowledge }
  | { readonly type: 'SEA_HOME'; readonly textKey: string; readonly storesBack: number }
  | { readonly type: 'WEATHER_DAY'; readonly weather: DayWeather; readonly forecast: Forecast | null };

/** The sea map's commands (part of Command). */
export type SeaCommand =
  /** Plot a course to a place from where the boat lies. */
  | { readonly type: 'SEA_PLOT'; readonly to: Id }
  /** Set sail on the plotted course (from home: who goes aboard; default the whole household). */
  | { readonly type: 'SEA_DEPART'; readonly crew?: readonly Id[] }
  /** Resolve one watch (sent once per Book 10 seaWatchAnimSeconds by the sea map). */
  | { readonly type: 'SEA_WATCH' }
  | { readonly type: 'SEA_CHOOSE'; readonly option: SeaOption }
  /** Turn for home from a place, a hold or an anchorage. */
  | { readonly type: 'SEA_TURN_BACK' }
  | { readonly type: 'SEA_HANDOFF_RETURN'; readonly result: HandoffResult };

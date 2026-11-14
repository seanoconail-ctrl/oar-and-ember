/**
 * The sea map's plotting and voyage screen (Stage 13; Book 1 section 08; Book 2 section 09; Book 7
 * sections 05, 10 and 14). It wraps the Stage 12 chart (src/scenes/seaMap.ts keeps the launch's
 * read-only reveal) with the voyage: the chart composed in the voyage's light (src/scenes/seaChart.ts),
 * the painted routes, the places, the weather's marks and the token; and the words beside them
 * (src/ui/seaPanels.ts).
 *
 * - **Plotting** (at home, the map key; at an anchorage): the player picks a place, sees the course
 *   painted on the chart, its watches and landfall, the stores, or the refusal in words. Setting sail
 *   sends `SEA_PLOT` and `SEA_DEPART` (setting out for Carrick starts its raid gate there, through the
 *   gate state and its checkpoint, decision S13-11).
 * - **Under way**: a watch is resolved (`SEA_WATCH`) once every Book 10 `seaWatchAnimSeconds` of real
 *   time, and the token sails the watch's share of the leg over those seconds. Real time with no
 *   tactical pause: the watches run on by themselves; only the pause menu (when safe) holds them.
 * - **The choice** ("weather rising: press on or shelter") holds the watches until it is answered:
 *   a planning screen under the safe rule (Book 2 section 02), never under a threat at sea
 *   (decision S13-21).
 * - **Handoffs**: a landing whose scene is a stub (Carrick, until Stage 16) says in words that the
 *   boat beaches at the landing, with a developer's note; an interruption with an on-foot scene
 *   (the wreck) is put in place by its builder (`HANDOFF_SCENES`) and the play view runs it on foot;
 *   when the scene hands its result back the chart returns.
 *
 * Nothing here is drawn while the steerer is on foot: the play view asks `active()` once a frame.
 */
import type { Id } from '../core/ids.ts';
import type { Content } from '../content/registry.ts';
import { parseTimeBalance } from '../content/balance.ts';
import type { TimeBalance } from '../content/balance.ts';
import { parseStormBalance } from '../content/presentationBalance.ts';
import { clockText, minutesToSlack, tideAt } from '../sim/calendar/calendar.ts';
import type { Command, SimEvent, Simulation, SimWorldContext } from '../sim/simulation.ts';
import type { WorldState } from '../sim/world.ts';
import type { OnFootState } from '../sim/land/onFoot.ts';
import {
  beginHandoffScene,
  boatAt,
  calendarAt,
  currentHandoff,
  forecastTomorrow,
  homeCrew,
  minuteOf,
  otherEnd,
  planLeg,
  plainResult,
  plotCourse,
  routeKnown,
  shipStats,
  storesCapacity,
  storesRd,
  visibilityNow,
  weatherToday,
  isStormDay,
  SEA_STORES,
} from '../sim/sea/index.ts';
import type {
  HandoffRequest,
  PlotResult,
  SeaContext,
  SeaEdge,
  SeaEvent,
  SeaPlan,
  VoyageState,
} from '../sim/sea/index.ts';
import {
  cartoucheLayout,
  choicePanel,
  forecastWords,
  labelLayout,
  landingPanel,
  legWords,
  panelBox,
  panelSide,
  plotPanel,
  SEA_PANEL_STYLE,
  tideWords,
  visibilityWords,
  voyagePanel,
  watchesWords,
  windWords,
} from '../ui/seaPanels.ts';
import type { ChoiceModel, CourseModel, Point, SeaWords, WeatherModel } from '../ui/seaPanels.ts';
import { alongPath, CHART_H, CHART_W, routePath, SeaChart } from './seaChart.ts';
import type {
  ChartMark,
  ChartRoute,
  ChartToken,
  ChartWeather,
  Heading,
  PixelAtlas,
} from './seaChart.ts';
import type { LoadedAtlas } from './atlases.ts';

/**
 * Builders for the on-foot scenes a voyage hands off to, by scenario (the wreck, SCN_SEA_WRECK, is
 * work package C's). A builder returns the scene to put in place, or null if it cannot yet.
 * Adapter (decision S13-29): the sea's simulation has no command to begin a handed-off scene, so the
 * screen puts it in place between ticks with `beginHandoffScene`.
 */
export type HandoffSceneBuilder = (
  world: WorldState,
  land: SimWorldContext,
  request: HandoffRequest,
) => OnFootState | null;
export const HANDOFF_SCENES = new Map<Id, HandoffSceneBuilder>();

/** Which pictogram each place is drawn with (Book 4 section 01: what kind of place it is). */
const PICTOGRAM: Readonly<Record<string, string>> = {
  ISLE_SKARV: 'hall',
  SITE_CARRICK: 'landing',
  TOWN_ARDCARN: 'hall',
  ABBEY_KILBRECC: 'abbey',
  FORT_DUNFIACH: 'fort',
  TOWN_SALTVIK: 'harbour',
  GLEN_ARRA: 'hall',
  CAMP_CROWWICK: 'camp',
  ISLE_INISRON: 'stone',
  ISLE_KALDNESS: 'seat',
};
const HAZARD_MARK: Readonly<Record<string, string>> = {
  HAZ_CAULDRON: 'haz_cauldron',
  HAZ_BLUEMEN: 'haz_bluemen',
};
const POINT_VEC: Readonly<Record<Point, readonly [number, number]>> = {
  N: [0, -1],
  NE: [Math.SQRT1_2, -Math.SQRT1_2],
  E: [1, 0],
  SE: [Math.SQRT1_2, Math.SQRT1_2],
  S: [0, 1],
  SW: [-Math.SQRT1_2, Math.SQRT1_2],
  W: [-1, 0],
  NW: [-Math.SQRT1_2, -Math.SQRT1_2],
};
const OPPOSITE: Readonly<Record<Point, Point>> = {
  N: 'S',
  NE: 'SW',
  E: 'W',
  SE: 'NW',
  S: 'N',
  SW: 'NE',
  W: 'E',
  NW: 'SE',
};

/** Decodes an atlas image's pixels once (the browser's canvas; tests decode the PNG). */
export function pixelAtlas(doc: Document, a: LoadedAtlas): PixelAtlas {
  const c = doc.createElement('canvas');
  c.width = a.image.width;
  c.height = a.image.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('No 2D canvas for the sea map');
  ctx.drawImage(a.image, 0, 0);
  return {
    manifest: a.manifest,
    width: c.width,
    rgba: ctx.getImageData(0, 0, c.width, c.height).data,
  };
}

/** What the screen is showing (the overlay's `data-sea`, for tests and captures). */
export type SeaScreen = '' | 'plot' | 'sail' | 'held' | 'choice' | 'landing' | 'scene' | 'anchored';

export interface SeaVoyageHost {
  readonly doc: Document;
  readonly sim: Simulation;
  readonly land: SimWorldContext;
  readonly content: Content;
  readonly atlases: ReadonlyMap<string, LoadedAtlas>;
  /** The overlay's sea-map region and its root (for the screen's data attributes). */
  readonly region: () => HTMLElement;
  readonly root: HTMLElement;
  readonly t: (key: string, vars?: Record<string, string>) => string;
  /** The interact key's name as bound now (setting sail). */
  readonly interactKey: () => string;
  /** The menus: the plotting screen at home is the map menu (time held, Book 2 section 02). */
  readonly menus: { readonly open: string | null; readonly timeStopped: boolean; close(): void };
  readonly reduced: () => boolean;
  readonly devOpen: () => boolean;
  readonly devMode: boolean;
  readonly autosave: (reason: 'DEPARTURE' | 'LANDING') => void;
  readonly present: (rgba: Uint8Array) => void;
}

interface Shown {
  readonly edge: Id | null;
  /** The node the edge is sailed from. */
  readonly from: Id | null;
  readonly share: number;
}
const NOWHERE: Shown = { edge: null, from: null, share: 0 };

/** The sea map's plotting and voyage screen. */
export class SeaVoyage {
  readonly #h: SeaVoyageHost;
  readonly #ctx: SeaContext;
  readonly #time: TimeBalance;
  #chart: SeaChart | null = null;
  readonly #paths = new Map<Id, Float32Array>();
  /** The place picked on the plotting screen, and its plot (pure, for the preview). */
  #chosen: Id | null = null;
  #preview: { key: string; result: PlotResult } | null = null;
  /** A refusal the simulation gave (SEA_REFUSED) to show in words. */
  #refused: { textKey: string; vars: Record<string, string> } | null = null;
  /** Setting sail was asked for: the chart stays up until the voyage begins or is refused. */
  #departing = false;
  /** The watch's animation: the token's share of the leg from and to, and when it began. */
  #from: Shown = NOWHERE;
  #to: Shown = NOWHERE;
  #lastNow = -1;
  #animAt = -1;
  #clockFrom = 0;
  #clockTo = 0;
  /** Real milliseconds when the next watch is due, and whether one was sent and not yet resolved. */
  #nextAt = -1;
  #sent = false;
  /** Watches resolved since the page opened (tests). */
  watches = 0;
  /** The words of what happened at sea, newest last (encounters, holds, arrivals). */
  #log: string[] = [];
  /** The screen's words as last built (the panel and the labels); '' to build them again. */
  #labelsKey = '';
  #started = -1;
  #landingSaved = false;

  constructor(host: SeaVoyageHost, ctx: SeaContext) {
    this.#h = host;
    this.#ctx = ctx;
    this.#time = parseTimeBalance(host.content.balance);
    const style = host.doc.createElement('style');
    style.textContent = SEA_PANEL_STYLE;
    host.doc.head.append(style);
    host.sim.events.onAny((e) => {
      this.#event(e);
    });
    host.doc.addEventListener('keydown', (e) => {
      this.#key(e);
    });
  }

  /** Whether the chart is up: at sea, plotting from home, or setting out. */
  active(plotting: boolean): boolean {
    const w = this.#h.sim.state;
    const atSea = w.sea.voyage !== null && w.onFoot === null;
    return atSea || this.#departing || plotting;
  }

  get #world(): WorldState {
    return this.#h.sim.state;
  }

  #words(): SeaWords {
    return {
      t: (key, vars) => this.#h.t(key, vars ?? {}),
      place: (id) => this.#h.t(`place.name.${id.toLowerCase()}`),
    };
  }

  #chartNow(): SeaChart {
    if (this.#chart !== null) return this.#chart;
    const pixels = new Map<string, PixelAtlas>();
    for (const name of [
      'ui_seamap',
      'ui_seavoyage',
      'ui_seaicons',
      'token_t1',
      'fx_seawake',
      'fx_seabolt',
      'fx_seamap',
    ]) {
      const a = this.#h.atlases.get(name);
      if (a !== undefined) pixels.set(name, pixelAtlas(this.#h.doc, a));
    }
    this.#chart = new SeaChart(pixels, parseStormBalance(this.#h.content.balance));
    return this.#chart;
  }

  /** A route's painted path, from its `a` end to its `b` end (computed once). */
  #path(edge: SeaEdge): Float32Array {
    const known = this.#paths.get(edge.id);
    if (known !== undefined) return known;
    const chart = this.#chartNow();
    const a = this.#ctx.nodes.get(edge.a)?.pos ?? { x: 0, y: 0 };
    const b = this.#ctx.nodes.get(edge.b)?.pos ?? { x: 0, y: 0 };
    let seed = 0;
    for (const ch of edge.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const p = routePath(a, b, (x, y) => chart.isLand(x, y), seed);
    this.#paths.set(edge.id, p);
    return p;
  }

  /** A point a share of the way along an edge sailed from `from`. */
  #along(edgeId: Id, from: Id, share: number): { x: number; y: number; heading: Heading } {
    const edge = this.#ctx.edges.get(edgeId);
    if (edge === undefined) return { x: 0, y: 0, heading: 'e' };
    const p = this.#path(edge);
    const s = edge.a === from ? share : 1 - share;
    const at = alongPath(p, s);
    if (edge.a === from) return at;
    // Sailed from b to a: the heading turned about.
    const back = alongPath(p, Math.max(0, s - 0.02));
    const flip = alongPath(p, Math.min(1, s + 0.02));
    const dx = back.x - flip.x;
    const dy = back.y - flip.y;
    return { x: at.x, y: at.y, heading: headingFrom(dx, dy, at.heading) };
  }

  // ------------------------------------------------------------------------- the simulation
  #submit(c: Command): void {
    this.#h.sim.submit(c);
  }

  #event(e: SimEvent): void {
    if (!('type' in e) || typeof e.type !== 'string' || !e.type.startsWith('SEA_')) return;
    const ev = e as SeaEvent;
    const w = this.#words();
    switch (ev.type) {
      case 'SEA_REFUSED':
        this.#refused = {
          textKey: ev.textKey,
          vars: Object.fromEntries(Object.entries(ev.vars).map(([k, v]) => [k, String(v)])),
        };
        this.#departing = false;
        this.#labelsKey = '';
        return;
      case 'SEA_DEPARTED':
        this.#departing = false;
        this.#refused = null;
        this.#chosen = null;
        this.#log = [];
        this.#sent = false;
        this.#nextAt = -1;
        this.#landingSaved = false;
        this.#h.autosave('DEPARTURE');
        this.#labelsKey = '';
        return;
      case 'SEA_WATCH':
        this.#sent = false;
        this.watches++;
        this.#animAt = -2;
        return;
      case 'SEA_ENCOUNTER':
        this.#say(w.t(ev.encounter.textKey));
        return;
      case 'SEA_HELD':
        this.#say(this.#holdWords(ev.textKey, ev.until));
        return;
      case 'SEA_STORES_SHORT':
      case 'SEA_STORM_DAMAGE':
        this.#say(w.t(ev.textKey));
        return;
      case 'SEA_ARRIVED':
        if (ev.textKey !== null) this.#say(w.t(ev.textKey));
        return;
      case 'SEA_ROUTE_KNOWN': {
        const edge = this.#ctx.edges.get(ev.edge);
        if (edge !== undefined && ev.known === 'KNOWN')
          this.#say(w.t('ui.sea.log.route', { from: w.place(edge.a), to: w.place(edge.b) }));
        return;
      }
      case 'SEA_HOME':
        this.#log = [];
        this.#labelsKey = '';
        return;
      case 'SEA_HANDOFF_RETURNED':
        this.#labelsKey = '';
        this.#nextAt = -1;
        return;
      default:
        return;
    }
  }

  #say(line: string): void {
    if (this.#log[this.#log.length - 1] === line) return;
    this.#log = [...this.#log, line].slice(-3);
    this.#labelsKey = '';
  }

  #holdWords(textKey: string, until: number | null): string {
    const time = until === null ? '' : clockText(calendarAt(until, this.#time).minuteOfDay);
    return this.#h.t(textKey, { time });
  }

  #key(e: KeyboardEvent): void {
    const w = this.#world;
    const v = w.sea.voyage;
    const plotting = this.#h.menus.open === 'map' && v === null;
    if (v !== null && w.onFoot === null && v.status === 'CHOICE') {
      if (e.code === 'Digit1') this.#choose('PRESS_ON');
      else if (e.code === 'Digit2') this.#choose('SHELTER');
      return;
    }
    const interact = this.#h.interactKey();
    const isInteract =
      e.code === 'Enter' || e.code === `Key${interact}` || e.key.toUpperCase() === interact;
    if ((plotting || (v?.status === 'ANCHORED' && w.onFoot === null)) && isInteract) this.#sail();
  }

  #choose(option: 'PRESS_ON' | 'SHELTER'): void {
    this.#submit({ type: 'SEA_CHOOSE', option });
    this.#labelsKey = '';
  }

  /** Set sail on the chosen course: plotted and set out on the next tick (the menu let go). */
  #sail(): void {
    const to = this.#chosen;
    if (to === null) return;
    const plot = this.#plot(to);
    if (!plot.ok) return;
    this.#submit({ type: 'SEA_PLOT', to });
    this.#submit({ type: 'SEA_DEPART' });
    this.#departing = true;
    if (this.#h.menus.open === 'map') this.#h.menus.close();
    this.#labelsKey = '';
  }

  #plot(to: Id): PlotResult {
    const w = this.#world;
    const key = `${to}|${w.calendar.day}|${w.calendar.minuteOfDay}|${w.sea.voyage?.at ?? ''}|${Object.keys(w.knowledge.routes).length}`;
    if (this.#preview?.key === key) return this.#preview.result;
    const result = plotCourse(w, this.#ctx, to);
    this.#preview = { key, result };
    return result;
  }

  /** The world's next due watch: once a watch's seconds have passed since the last. */
  #tickWatches(now: number): void {
    const w = this.#world;
    const v = w.sea.voyage;
    const dt = this.#lastNow < 0 ? 0 : now - this.#lastNow;
    this.#lastNow = now;
    if (v === null || w.onFoot !== null) return;
    if (this.#h.menus.timeStopped) {
      // The pause menu holds the watches (and their animation): they go on where they were.
      if (this.#nextAt >= 0) this.#nextAt += dt;
      if (this.#animAt >= 0) this.#animAt += dt;
      return;
    }
    const going = v.status === 'SAILING' || v.status === 'HELD';
    if (!going || this.#sent) return;
    if (this.#nextAt < 0) this.#nextAt = now;
    if (now >= this.#nextAt) {
      this.#submit({ type: 'SEA_WATCH' });
      this.#sent = true;
      this.#nextAt = now + this.#time.seaWatchAnimSeconds * 1000;
    }
  }

  /** Where the boat is on the chart: its leg's share sailed, or the end of the edge it came by. */
  #shownNow(v: VoyageState | null): Shown {
    if (v === null) return NOWHERE;
    if (v.leg !== null)
      return {
        edge: v.leg.edge,
        from: v.leg.from,
        share: v.leg.minutes <= 0 ? 1 : v.leg.done / v.leg.minutes,
      };
    if (v.arrivedBy !== null)
      return { edge: v.arrivedBy, from: otherEndOf(this.#ctx, v.arrivedBy, v.at), share: 1 };
    return NOWHERE;
  }

  /** After each watch the token sails from where it was shown to where the boat is, and the clock
   * runs on with it, over Book 10's seaWatchAnimSeconds. */
  #animate(now: number): void {
    const target = this.#shownNow(this.#world.sea.voyage);
    const minute = minuteOf(this.#world.calendar, this.#time);
    if (this.#animAt === -2) {
      this.#from = this.#to;
      this.#to = target;
      this.#animAt = now;
      this.#clockFrom = this.#clockTo;
      this.#clockTo = minute;
    } else if (
      this.#animAt === -1 ||
      this.#to.edge !== target.edge ||
      this.#to.share !== target.share
    ) {
      // Not animating (or the voyage changed by a command, not a watch): shown as it is.
      if (this.#animAt === -1 || this.#animProgress(now) >= 1) {
        this.#from = target;
        this.#to = target;
        this.#clockFrom = minute;
        this.#clockTo = minute;
        this.#animAt = -1;
      }
    }
  }

  #animProgress(now: number): number {
    if (this.#animAt < 0) return 1;
    return Math.min(1, (now - this.#animAt) / (this.#time.seaWatchAnimSeconds * 1000));
  }

  /** Where the token is shown now. */
  #tokenAt(now: number): { x: number; y: number; heading: Heading } {
    const ctx = this.#ctx;
    const home = ctx.nodes.get(ctx.home)?.pos ?? { x: 0, y: 0 };
    const to = this.#to;
    if (to.edge === null || to.from === null) return { x: home.x, y: home.y + 16, heading: 'e' };
    const k = this.#animProgress(now);
    const from = this.#from.edge === to.edge && this.#from.from === to.from ? this.#from.share : 0;
    const share = from + (to.share - from) * k;
    return this.#along(to.edge, to.from, Math.min(0.96, Math.max(0.04, share)));
  }

  /** The clock shown on the chart: run on with the token over the watch's seconds. */
  #clockShown(now: number): number {
    if (this.#animAt < 0) return minuteOf(this.#world.calendar, this.#time);
    const k = this.#animProgress(now);
    return Math.round(this.#clockFrom + (this.#clockTo - this.#clockFrom) * k);
  }

  // ------------------------------------------------------------------------- the frame
  /** One frame of the screen: the watches, the chart and its words. */
  frame(now: number, draw: boolean, plotting: boolean): void {
    if (this.#started < 0) this.#started = now;
    const w = this.#world;
    const v = w.sea.voyage;
    // A handed-off on-foot scene waiting to be put in place.
    if (
      v !== null &&
      w.onFoot === null &&
      v.status === 'HANDOFF' &&
      v.handoff?.kind === 'ON_FOOT'
    ) {
      const req = currentHandoff(w);
      const build = req === null ? undefined : HANDOFF_SCENES.get(req.scenarioId);
      if (req !== null && build !== undefined && !req.landing) {
        const scene = build(w, this.#h.land, req);
        if (scene !== null) {
          beginHandoffScene(w, scene);
          this.#labelsKey = '';
          return;
        }
      }
      if (req !== null && req.landing && !this.#landingSaved) {
        this.#landingSaved = true;
        this.#h.autosave('LANDING');
      }
    }
    // At sea the map menu is not a menu: the chart is the screen.
    if (v !== null && this.#h.menus.open === 'map') this.#h.menus.close();
    this.#tickWatches(now);
    this.#animate(now);
    const seconds = (now - this.#started) / 1000;
    const weather = this.#weatherModel(now);
    const scene = this.#scene(now, seconds, plotting, weather);
    if (draw) {
      const f = this.#chartNow().compose(scene);
      this.#h.present(f.rgba);
    }
    this.#panels(plotting, weather, scene);
    const root = this.#h.root;
    root.dataset['sea'] = this.#screen(plotting);
    root.dataset['seaWatches'] = String(this.watches);
    root.dataset['seaAt'] = v?.at ?? '';
    root.dataset['seaStatus'] = v?.status ?? '';
    root.dataset['seaChosen'] = this.#chosen ?? '';
    root.dataset['seaToken'] =
      scene.token === null
        ? ''
        : `${Math.round(scene.token.x)},${Math.round(scene.token.y)},${scene.token.heading},${scene.token.state}`;
    root.dataset['seaWeather'] =
      `${scene.weather.visibility}:${scene.weather.strength}:${scene.weather.storm ? 1 : 0}:${scene.weather.rain ? 1 : 0}`;
  }

  /** Clears the screen's words when the chart goes down. */
  leave(): void {
    const region = this.#h.region();
    if (region.dataset['sea'] !== undefined && region.dataset['sea'] !== '') {
      region.replaceChildren();
      region.dataset['sea'] = '';
    }
    this.#h.root.dataset['sea'] = '';
    this.#labelsKey = '';
    this.#labelsKey = '';
    if (this.#world.sea.voyage === null) this.#chosen = null;
  }

  #screen(plotting: boolean): SeaScreen {
    const w = this.#world;
    const v = w.sea.voyage;
    if (v === null) return plotting || this.#departing ? 'plot' : '';
    if (w.onFoot !== null) return 'scene';
    switch (v.status) {
      case 'SAILING':
        return 'sail';
      case 'HELD':
        return 'held';
      case 'CHOICE':
        return 'choice';
      case 'HANDOFF':
        return 'landing';
      case 'ANCHORED':
        return 'anchored';
    }
  }

  #weatherModel(now: number): WeatherModel & { readonly chart: ChartWeather } {
    const w = this.#world;
    const today = weatherToday(w);
    const tomorrow = forecastTomorrow(w);
    const minute = this.#clockShown(now);
    const cal = calendarAt(minute, this.#time);
    const vis = visibilityNow({ ...w, calendar: cal }, this.#time);
    const tide = tideAt(cal, this.#time);
    const slackIn = minutesToSlack(cal, this.#time, this.#ctx.b.slackWindowMinutes);
    const slackAt = clockText(calendarAt(minute + slackIn, this.#time).minuteOfDay);
    const from = (today?.windFrom ?? 'SW');
    const strength = today?.strength ?? 0;
    const storm = today !== null && isStormDay(w.sea, this.#ctx.b, today.day);
    const vec = POINT_VEC[OPPOSITE[from]];
    return {
      windFrom: from,
      strength,
      visibility: vis,
      tide: tide.phase,
      slackIn,
      slackAt,
      forecast:
        tomorrow === null
          ? null
          : {
              windFrom: tomorrow.windFrom,
              strength: tomorrow.strength,
              visibility: tomorrow.visibility,
              storm: tomorrow.storm,
              calm: tomorrow.calm,
            },
      day: cal.day,
      time: clockText(cal.minuteOfDay),
      chart: {
        windTo: strength <= 0 ? null : { x: vec[0], y: vec[1] },
        strength,
        visibility: vis,
        storm,
        // Rain (decision S13-24): on a storm day, and with the wind rising under haze or fog.
        rain:
          storm ||
          (strength >= this.#ctx.b.risingStrength && (today?.visibility ?? 'CLEAR') !== 'CLEAR'),
        fog: (today?.visibility ?? 'CLEAR') === 'FOG',
      },
    };
  }

  #mark(): string {
    return (this.#world.ships['flagship']?.marks.sail ?? 'plain').replace(':', '_');
  }

  #scene(
    now: number,
    seconds: number,
    plotting: boolean,
    weather: WeatherModel & { readonly chart: ChartWeather },
  ): {
    seconds: number;
    reduced: boolean;
    weather: ChartWeather;
    routes: ChartRoute[];
    marks: ChartMark[];
    token: ChartToken | null;
  } {
    const w = this.#world;
    const ctx = this.#ctx;
    const v = w.sea.voyage;
    const routes: ChartRoute[] = [];
    for (const edge of ctx.edges.values()) {
      if (routeKnown(w, edge)) routes.push({ points: this.#path(edge), kind: 'known' });
      else if (w.knowledge.routes[edge.id] === 'RUMOURED')
        routes.push({ points: this.#path(edge), kind: 'rumour' });
    }
    // The course: the plotted preview, or what is left of the voyage's.
    const course = this.#courseEdges(plotting);
    for (const c of course) routes.push({ points: this.#segment(c.edge, c.from), kind: 'course' });
    const marks: ChartMark[] = [];
    for (const node of ctx.nodes.values()) {
      if (node.kind === 'HAZARD') {
        const mark = HAZARD_MARK[node.id];
        const seen = (ctx.byNode.get(node.id) ?? []).some(
          (e) => routeKnown(w, e) || w.knowledge.routes[e.id] !== undefined,
        );
        if (mark !== undefined && seen)
          marks.push({ state: mark, x: node.pos.x, y: node.pos.y + 8 });
        continue;
      }
      const known = node.id === ctx.home ? 'KNOWN' : w.knowledge.places[node.id];
      if (known === undefined) continue;
      const pict = PICTOGRAM[node.id] ?? 'hall';
      marks.push({
        state: known === 'KNOWN' ? `place_${pict}` : `place_${pict}_faint`,
        x: node.pos.x,
        y: node.pos.y + 7,
      });
    }
    const last = course[course.length - 1];
    if (last !== undefined) {
      const end = ctx.nodes.get(otherEndOf(ctx, last.edge, last.from))?.pos;
      if (end !== undefined) marks.push({ state: 'pin', x: end.x + 9, y: end.y - 2 });
    }
    // The weather's cartouche.
    const lay = cartoucheLayout();
    const strength = weather.strength;
    for (const m of lay.marks) {
      let state = 'watch';
      if (m.kind === 'wind')
        state =
          strength <= 0
            ? 'wind_calm'
            : `wind_${OPPOSITE[weather.windFrom].toLowerCase()}_${Math.min(4, Math.max(1, strength))}`;
      else if (m.kind === 'tide')
        state = weather.slackIn <= 0 ? 'tide_slack' : `tide_${weather.tide.toLowerCase()}`;
      else if (m.kind === 'vis') state = `vis_${weather.visibility.toLowerCase()}`;
      else if (m.kind === 'forecast')
        state =
          weather.forecast === null
            ? 'watch'
            : weather.forecast.strength <= 0
              ? 'wind_calm'
              : `wind_${OPPOSITE[weather.forecast.windFrom].toLowerCase()}_${Math.min(4, Math.max(1, weather.forecast.strength))}`;
      else if (m.kind === 'stores') state = 'stores';
      marks.push({ state, x: m.x, y: m.y });
    }
    // The token: lying to at home or a node, or sailing its leg.
    const at = this.#tokenAt(now);
    let state = 'furled';
    const leg = v?.leg ?? null;
    if (v !== null && leg !== null && v.status === 'SAILING') {
      if (leg.rowing) state = 'row';
      else state = `${weather.strength >= ctx.b.risingStrength ? 'reefed' : 'set'}_${this.#mark()}`;
    }
    const token: ChartToken = {
      x: at.x,
      y: at.y,
      heading: at.heading,
      state,
      wake: v !== null && leg !== null && v.status === 'SAILING',
    };
    return {
      seconds,
      reduced: this.#h.reduced(),
      weather: weather.chart,
      routes,
      marks,
      token,
    };
  }

  /** The course's edges still to sail, each with the node it is sailed from. */
  #courseEdges(plotting: boolean): { edge: Id; from: Id; share: number }[] {
    const w = this.#world;
    const v = w.sea.voyage;
    if (v === null || v.status === 'ANCHORED') {
      if (!plotting && v === null) return [];
      if (this.#chosen === null) return [];
      const plot = this.#plot(this.#chosen);
      if (!plot.ok) return [];
      return plot.plan.legs.map((l) => ({ edge: l.edge, from: l.from, share: 0 }));
    }
    const out: { edge: Id; from: Id; share: number }[] = [];
    let at = v.leg?.from ?? v.at;
    for (const id of v.route) {
      out.push({ edge: id, from: at, share: 0 });
      at = otherEndOf(this.#ctx, id, at);
    }
    return out;
  }

  /** An edge's path as sailed from `from` (reversed when from its `b` end). */
  #segment(edgeId: Id, from: Id): Float32Array {
    const edge = this.#ctx.edges.get(edgeId);
    if (edge === undefined) return new Float32Array(0);
    const p = this.#path(edge);
    if (edge.a === from) return p;
    const n = p.length >> 1;
    const out = new Float32Array(p.length);
    for (let i = 0; i < n; i++) {
      out[i * 2] = p[(n - 1 - i) * 2] ?? 0;
      out[i * 2 + 1] = p[(n - 1 - i) * 2 + 1] ?? 0;
    }
    return out;
  }

  // ------------------------------------------------------------------------- the words
  #courseModel(plan: SeaPlan): CourseModel {
    const w = this.#world;
    const ctx = this.#ctx;
    const words = this.#words();
    const v = w.sea.voyage;
    const crew = v?.aboard ?? homeCrew(w);
    const mouths = crew.length + 1;
    const perDay = ctx.b.storesPerPersonPerWatch * (1440 / (this.#time.watchHours * 60));
    let aboardRd: number;
    if (v !== null) aboardRd = storesRd(v);
    else {
      const home = w.homes[ctx.home];
      const have = SEA_STORES.reduce((s, k) => s + (home?.stores[k] ?? 0), 0);
      aboardRd = Math.min(have, storesCapacity(w, ctx, mouths));
    }
    const end = calendarAt(plan.plottedAt + plan.minutes, this.#time);
    const via = plan.legs
      .slice(0, -1)
      .map((l) => l.to)
      .filter((id) => ctx.nodes.get(id)?.kind === 'PLACE')
      .map((id) => words.place(id));
    return {
      from: words.place(plan.from),
      to: words.place(plan.to),
      via,
      watches: plan.watches,
      arriveDay: end.day,
      arriveTime: clockText(end.minuteOfDay),
      waitMinutes: plan.legs.reduce((s, l) => s + l.waitMinutes, 0),
      eatRd: plan.storesRd,
      aboardRd,
      mouths,
      perDay,
      gate: plan.gate !== null,
    };
  }

  #choiceModel(v: VoyageState): ChoiceModel | null {
    const choice = v.choice;
    if (choice === null) return null;
    const w = this.#world;
    const ctx = this.#ctx;
    const edge = ctx.edges.get(choice.edge);
    const stats = shipStats(w, ctx, v.aboard.length + 1);
    const now = minuteOf(w.calendar, this.#time);
    const leg =
      edge === undefined || stats === null ? null : planLeg(w, ctx, stats, edge, v.at, now, 0);
    const today = weatherToday(w);
    const tomorrow = forecastTomorrow(w);
    const into = (ctx.b.shelterUntil - this.#time.dayStart + 1440) % 1440;
    const dayStartAt = now - (now % 1440);
    let until = dayStartAt + into;
    if (until <= now) until += 1440;
    const waitWatches = (until - now) / (this.#time.watchHours * 60);
    const perWatchDays = this.#time.watchHours / 24;
    return {
      questionKey: choice.textKey,
      pressOn: {
        textKey:
          choice.options.find((o) => o.option === 'PRESS_ON')?.textKey ?? 'sea.choice.press_on',
        watches: leg === null ? 0 : leg.minutes / (this.#time.watchHours * 60),
        strength: Math.max(today?.strength ?? 0, tomorrow?.strength ?? 0),
        storm:
          (today !== null && isStormDay(w.sea, ctx.b, today.day)) || (tomorrow?.storm ?? false),
        arriveTime:
          leg === null ? '' : clockText(calendarAt(now + leg.minutes, this.#time).minuteOfDay),
      },
      shelter: {
        textKey:
          choice.options.find((o) => o.option === 'SHELTER')?.textKey ?? 'sea.choice.shelter',
        untilTime: clockText(calendarAt(until, this.#time).minuteOfDay),
        watches: waitWatches,
        eatDays: Math.round(waitWatches * perWatchDays * 2) / 2,
      },
    };
  }

  #panels(
    plotting: boolean,
    weather: WeatherModel,
    scene: { token: ChartToken | null; routes: readonly ChartRoute[] },
  ): void {
    const h = this.#h;
    const region = h.region();
    const w = this.#world;
    const v = w.sea.voyage;
    const words = this.#words();
    const screen = this.#screen(plotting);
    const side = panelSide(
      [
        ...(scene.token === null ? [] : [scene.token]),
        ...scene.routes
          .filter((r) => r.kind === 'course')
          .flatMap((r) => [{ x: r.points[0] ?? 0 }, { x: r.points[r.points.length - 2] ?? 0 }]),
      ],
      CHART_W,
    );
    // The panel, rebuilt only when what it says changes.
    const key = [
      screen,
      side,
      this.#chosen ?? '',
      v?.status ?? '',
      v?.at ?? '',
      v?.leg?.edge ?? '',
      this.#log.join('|'),
      this.#refused?.textKey ?? '',
      w.calendar.day,
      Math.floor(w.calendar.minuteOfDay / 30),
      h.devOpen() ? 1 : 0,
      h.interactKey(),
    ].join('#');
    const cart = cartoucheLayout();
    const lines: Record<string, string> = {
      watch: h.t('ui.sea.clock', { day: String(weather.day), time: weather.time }),
      wind: windWords(weather.windFrom, weather.strength, words),
      tide: tideWords(weather, words),
      vis: visibilityWords(weather.visibility, words),
      forecast: forecastWords(weather.forecast, words),
      stores:
        v === null
          ? ''
          : h.t('ui.sea.stores', {
              days: String(
                Math.floor(
                  (storesRd(v) /
                    Math.max(
                      1e-9,
                      (v.aboard.length + 1) *
                        this.#ctx.b.storesPerPersonPerWatch *
                        (24 / this.#time.watchHours),
                    )) *
                    2,
                ) / 2,
              ),
            }),
    };
    // The structure (the panel, the labels) is rebuilt when what it says changes; the weather's
    // words are updated in place (the clock runs on through each watch's animation).
    const structure = `${key}|${Object.keys(w.knowledge.places).length}|${Object.keys(w.knowledge.routes).length}`;
    if (structure === this.#labelsKey && region.querySelector('.oe-sea-words') !== null) {
      for (const el of region.querySelectorAll<HTMLElement>('[data-words]')) {
        const text = lines[el.dataset['words'] ?? ''] ?? '';
        if (el.textContent !== text) el.textContent = text;
      }
      return;
    }
    this.#labelsKey = structure;
    const parts: HTMLElement[] = [];
    const at = (x: number, y: number, text: string, cls: string): HTMLElement => {
      const l = h.doc.createElement('div');
      l.className = cls;
      l.style.left = `${(x / CHART_W) * 100}%`;
      l.style.top = `${(y / CHART_H) * 100}%`;
      l.textContent = text;
      return l;
    };
    for (const wd of cart.words) {
      const el = at(wd.x, wd.y, lines[wd.kind] ?? '', 'oe-sea-words');
      el.dataset['words'] = wd.kind;
      parts.push(el);
    }
    // The places' names beside their pictograms, clear of each other and of the panel.
    const avoid = [cart.box, panelBox(side, CHART_W, CHART_H)];
    const labels = [...this.#ctx.nodes.values()]
      .filter(
        (n) =>
          n.kind === 'PLACE' && (n.id === this.#ctx.home || w.knowledge.places[n.id] !== undefined),
      )
      .map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y + 8, text: words.place(n.id) }));
    for (const l of labelLayout(labels, CHART_W, CHART_H, avoid)) {
      const rumour = l.id !== this.#ctx.home && w.knowledge.places[l.id] === 'RUMOURED';
      const el = at(l.lx, l.ly, l.text, `oe-sea-label${rumour ? ' rumour' : ''}`);
      el.dataset['place'] = l.id;
      parts.push(el);
    }
    const panel = this.#panel(screen, side, words);
    if (panel !== null) parts.push(panel);
    region.replaceChildren(...parts);
    region.dataset['sea'] = screen;
  }

  #panel(screen: SeaScreen, side: 'left' | 'right', words: SeaWords): HTMLElement | null {
    const h = this.#h;
    const w = this.#world;
    const v = w.sea.voyage;
    const ctx = this.#ctx;
    const dev = h.devOpen() ? this.#devEdges(words) : null;
    const withDev = (p: HTMLElement): HTMLElement => {
      if (dev !== null) p.append(dev);
      return p;
    };
    if (screen === 'plot' || screen === 'anchored') {
      const from = boatAt(w, ctx);
      const places = [...ctx.nodes.values()]
        .filter(
          (n) => n.kind === 'PLACE' && n.id !== from && w.knowledge.places[n.id] !== undefined,
        )
        .map((n) => ({ id: n.id, known: w.knowledge.places[n.id] === 'KNOWN' }));
      if (from !== ctx.home) places.unshift({ id: ctx.home, known: true });
      const plot = this.#chosen === null ? null : this.#plot(this.#chosen);
      const refusal =
        plot !== null && !plot.ok
          ? {
              textKey: plot.textKey,
              vars: Object.fromEntries(Object.entries(plot.vars).map(([k, x]) => [k, String(x)])),
            }
          : this.#refused;
      return withDev(
        plotPanel(
          h.doc,
          words,
          {
            side,
            at: words.place(from),
            places,
            chosen: this.#chosen,
            course: plot?.ok === true ? this.#courseModel(plot.plan) : null,
            refusal,
            atSea: v !== null,
            keys: { sail: h.interactKey(), back: 'Esc' },
          },
          {
            choose: (id) => {
              this.#chosen = id;
              this.#refused = null;
              this.#labelsKey = '';
            },
            sail: () => {
              this.#sail();
            },
            back: () => {
              h.menus.close();
            },
            ...(v !== null
              ? {
                  home: () => {
                    this.#submit({ type: 'SEA_TURN_BACK' });
                    this.#labelsKey = '';
                  },
                }
              : {}),
          },
        ),
      );
    }
    if (v === null) return null;
    if (screen === 'choice') {
      const c = this.#choiceModel(v);
      if (c === null) return null;
      return withDev(
        choicePanel(
          h.doc,
          words,
          side,
          c,
          { pressOn: '1', shelter: '2' },
          {
            choose: (o) => {
              this.#choose(o);
            },
          },
        ),
      );
    }
    if (screen === 'landing') {
      const req = currentHandoff(w);
      if (req === null) return null;
      const lines: string[] = [];
      if (req.landing) {
        const landing = ctx.landings.get(req.placeId ?? '');
        if (landing !== undefined) lines.push(h.t(landing.textKey));
        lines.push(h.t('ui.sea.land.beach', { place: words.place(req.placeId ?? ctx.home) }));
      } else {
        for (const l of this.#log.slice(-1)) lines.push(l);
      }
      const devNote = h.devMode
        ? h.t(req.stubUntilStage !== null ? 'ui.dev.sea.stub' : 'ui.dev.sea.no_scene', {
            stage: String(req.stubUntilStage ?? ''),
          })
        : null;
      return withDev(
        landingPanel(
          h.doc,
          words,
          {
            side,
            lines,
            dev: devNote,
            stay: h.t(req.landing ? 'ui.sea.land.stay' : 'ui.sea.land.sail_on'),
            home: h.t('ui.sea.at.turn_back'),
          },
          {
            stay: () => {
              this.#submit({ type: 'SEA_HANDOFF_RETURN', result: plainResult('CONTINUE') });
              this.#labelsKey = '';
            },
            home: () => {
              this.#submit({ type: 'SEA_HANDOFF_RETURN', result: plainResult('TURN_BACK') });
              this.#labelsKey = '';
            },
          },
        ),
      );
    }
    // Under way or held: how the boat goes, the next landfall, and the log.
    const lines: string[] = [];
    const leg = v.leg;
    if (leg !== null) {
      lines.push(
        legWords(
          {
            pointOfSail: leg.pointOfSail,
            rowing: leg.rowing,
            from: words.place(leg.from),
            to: words.place(leg.to),
          },
          words,
        ),
      );
      const left = leg.minutes - leg.done;
      const at = calendarAt(minuteOf(w.calendar, this.#time) + left, this.#time);
      lines.push(
        h.t('ui.sea.at.landfall', {
          place: words.place(leg.to),
          watches: watchesWords(left / (this.#time.watchHours * 60), words),
          time: clockText(at.minuteOfDay),
        }),
      );
    } else if (v.hold !== null) lines.push(this.#holdWords(v.hold.textKey, v.hold.until));
    else lines.push(h.t('ui.sea.at.lying', { place: words.place(v.at) }));
    if (v.to !== v.at) lines.push(h.t('ui.sea.at.bound', { place: words.place(v.to) }));
    return withDev(
      voyagePanel(h.doc, words, {
        side,
        status: v.status,
        lines,
        log: this.#log,
        watchShare: 0,
      }),
    );
  }

  /** The developer menu's edges (F3 open, `?dev`): sail any edge from where the boat lies. */
  #devEdges(words: SeaWords): HTMLElement {
    const h = this.#h;
    const ctx = this.#ctx;
    const box = h.doc.createElement('div');
    box.className = 'dev';
    box.dataset['dev'] = 'edges';
    const title = h.doc.createElement('p');
    title.textContent = h.t('ui.dev.sea.edges');
    box.append(title);
    const chart = h.doc.createElement('button');
    chart.textContent = h.t('ui.dev.sea.chart');
    chart.dataset['action'] = 'dev-chart';
    chart.addEventListener('click', () => {
      this.#submit({ type: 'DEV_SEA_CHART' });
      if (h.menus.open === 'map') h.menus.close();
      this.#labelsKey = '';
    });
    box.append(chart);
    for (const edge of ctx.edges.values()) {
      const b = h.doc.createElement('button');
      b.textContent = h.t('ui.dev.sea.edge', {
        from: devName(ctx, edge.a, words),
        to: devName(ctx, edge.b, words),
      });
      b.dataset['edge'] = edge.id;
      b.addEventListener('click', () => {
        this.#devSail(edge);
      });
      box.append(b);
    }
    return box;
  }

  /** Plots a course over an edge: to its far place (through a hazard to the place beyond). */
  #devSail(edge: SeaEdge): void {
    const w = this.#world;
    const ctx = this.#ctx;
    const at = boatAt(w, ctx);
    const near = edge.a === at ? edge.a : edge.b === at ? edge.b : edge.a;
    let far = otherEnd(edge, near);
    if (ctx.nodes.get(far)?.kind === 'HAZARD') {
      const on = (ctx.byNode.get(far) ?? []).find((e) => e.id !== edge.id);
      if (on !== undefined) far = otherEnd(on, far);
    }
    this.#chosen = near === at ? far : near;
    this.#refused = null;
    this.#labelsKey = '';
  }
}

function otherEndOf(ctx: SeaContext, edgeId: Id | null, node: Id): Id {
  const e = edgeId === null ? undefined : ctx.edges.get(edgeId);
  return e === undefined ? node : otherEnd(e, node);
}

function headingFrom(dx: number, dy: number, fallback: Heading): Heading {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return fallback;
  const a = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const i = ((Math.round(a / 45) % 8) + 8) % 8;
  return (['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const)[i] ?? fallback;
}

function devName(ctx: SeaContext, id: Id, words: SeaWords): string {
  // Hazards have no place name; the developer's menu names them by their place in Book 4.
  return ctx.nodes.get(id)?.kind === 'HAZARD'
    ? words.t(`ui.dev.sea.hazard.${id.toLowerCase()}`)
    : words.place(id);
}

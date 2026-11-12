/**
 * Play on foot (Stage 6): the steerer on Wreck Strand under the camera, Hild calling beyond the
 * rocks, and the rescue. The overlay carries only what the moment needs: Hild's words as subtitles
 * with the direction of her voice, the prompt for the nearest thing to do, and a refusal's reason.
 * There is no control list (Book 3 Stage 6 check 2); the only control text is a single movement
 * hint if the steerer has not moved after a few seconds, and the tooltip each kind of item shows the
 * first time it is picked up (Book 10 section 21, pickupTooltip), kept afterwards in the system
 * menu's help page.
 *
 * The overlay root carries data-* attributes the browser tests read.
 */
import renderJson from '../../assets/art/render.json';
import buildingsJson from '../../assets/art/buildings.json';
import { AudioRouter } from '../audio/router.ts';
import { PlaceMusic } from '../audio/placeMusic.ts';
import { WebAudioEngine } from '../audio/webAudio.ts';
import { parsePeopleBasics, parseTimeBalance } from '../content/balance.ts';
import type { Content } from '../content/registry.ts';
import { formatString } from '../content/strings.ts';
import type { StringTable } from '../content/strings.ts';
import { bindingLabel } from '../input/actions.ts';
import type { Action } from '../input/actions.ts';
import { attachBrowserInput } from '../input/browserInput.ts';
import { InputMapper } from '../input/inputState.ts';
import { browserStorage, loadSettings } from '../input/settingsStore.ts';
import { resolveDisplaySettings, saveDisplaySettings } from '../input/displaySettings.ts';
import { bakeElevation } from '../render/elevation.ts';
import type { Elevation } from '../render/elevation.ts';
import { createSceneRenderer } from '../render/glRenderer.ts';
import type { SceneRenderer } from '../render/glRenderer.ts';
import type { Palette } from '../render/palette.ts';
import type { Presenter } from '../render/presenter.ts';
import { buildDrawList, parseRenderStyle } from '../render/scene.ts';
import { gustAt, STRAND_WIND } from '../render/wind.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import { clockText, seasonOf, tideAt } from '../sim/calendar/calendar.ts';
import { landContext } from '../sim/land/context.ts';
import { interactionNow } from '../sim/land/onFoot.ts';
import { parseStartingWeapons } from '../content/balance.ts';
import type { Id } from '../core/ids.ts';
import { steererOwns, withOwned } from './people.ts';
import type { PeopleLook } from './people.ts';
import { helpLines, tipText } from './tips.ts';
import type { TipContext } from './tips.ts';
import { MISSILE_SHEET } from './zoneScene.ts';
import { tileOf } from '../sim/land/zoneMap.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import { campUseNear, campUses, driftwoodPieces, isTimed } from '../sim/home/camp.ts';
import { boatLayers, repairProps } from './repairsScene.ts';
import { boatOf, repairPlacedUses } from '../sim/narrative/repairs.ts';
import { staminaView } from '../sim/home/stamina.ts';
import { FACT_HILD_SAFE } from '../sim/narrative/opening.ts';
import { createSimulation } from '../sim/simulation.ts';
import { striking } from '../sim/combat/fighter.ts';
import { parseCombatBalance } from '../content/combatBalance.ts';
import { finisherTarget, hostilesAware } from '../sim/land/fight.ts';
import type { FightContext } from '../sim/land/fight.ts';
import {
  attachWakingAutosave,
  LocalStorageStore,
  MemoryStore,
  SaveManager,
} from '../persist/manager.ts';
import type { SaveStore } from '../persist/manager.ts';
import type { SimEvent } from '../sim/simulation.ts';
import { newCampaign } from '../sim/world.ts';
import { createOverlay, showCaptions } from '../ui/overlay.ts';
import type { LoadedAtlas } from './atlases.ts';
import { homePhase, lightPhase } from './lightPhase.ts';
import type { NamingChoice } from './namingView.ts';
import { bundledLayerFiles } from './bundledLayers.ts';
import { createHud } from './hud.ts';
import type { HudView } from './hud.ts';
import { peopleLook } from './people.ts';
import { Session } from './session.ts';
import { zoneScene } from './zoneScene.ts';
import type { CampScene } from './zoneScene.ts';
import { campHooks, campUseLabel, interactionPoint, reportSentences } from './camp.ts';
import { visualTuning, ZoneVisuals } from './zoneVisuals.ts';
import type { CameraLead } from './zoneVisuals.ts';
import { AIM_DIRECTIONS } from '../sim/simulation.ts';
import { talkOptions } from '../sim/people/talk.ts';
import {
  FACT_BODY,
  FACT_BRAN,
  FACT_CHEST,
  FACT_ODDI,
  FACT_RUNA,
  FACT_WRECKERS,
  searchPlacedUses,
  stoneWeeps,
} from '../sim/narrative/searches.ts';
import { activityOf } from '../sim/people/schedule.ts';
import {
  cleanShipName,
  FACT_SMOKE,
  GATE_LAUNCH,
  launchPhase,
  launchView,
  readinessView,
} from '../sim/narrative/launch.ts';
import { telemetryReport } from '../sim/narrative/telemetry.ts';
import { activeChapter } from '../sim/world.ts';
import {
  chapterPanel,
  markPanel,
  namingPanel,
  PANEL_STYLE,
  readinessPanel,
  timingsPanel,
} from './launchPanels.ts';
import type { PanelWords } from './launchPanels.ts';
import { SeaMapView } from './seaMap.ts';
import type { BodyModel } from '../sim/world.ts';

/** The nearest of the four facings from the steerer towards the pointer. */
function facingTowards(
  p: { x: number; y: number; facing: 's' | 'n' | 'e' | 'w' },
  pointer: { x: number; y: number } | null,
): 's' | 'n' | 'e' | 'w' {
  if (pointer === null) return p.facing;
  const dx = pointer.x - p.x;
  const dy = pointer.y - (p.y - 20);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'e' : 'w';
  return dy > 0 ? 's' : 'n';
}

export interface PlayOptions {
  readonly seed: string;
  /** performance.now() when the player pressed Wake, to measure the time to control. */
  readonly wokeAt: number;
  /** The renderer prepared while the title showed (preparePlay), if it is ready. */
  readonly prepared?: PreparedPlay | null;
}

/** The scene renderer for a zone, with every atlas and the zone's height field registered. */
export interface PreparedPlay {
  readonly zone: string;
  readonly renderer: SceneRenderer;
  readonly geometry: ReadonlyMap<string, LoadedAtlas['manifest']>;
  readonly elevation: Elevation;
}

function playRenderer(
  presenter: Presenter,
  palette: Palette,
  atlases: ReadonlyMap<string, LoadedAtlas>,
  map: ZoneMap,
): PreparedPlay {
  const renderer = createSceneRenderer(presenter, palette, parseRenderStyle(renderJson));
  const geometry = new Map<string, LoadedAtlas['manifest']>();
  for (const { manifest, image } of atlases.values()) {
    renderer.addAtlas(manifest, image);
    geometry.set(manifest.sheet, manifest);
  }
  const elevation = bakeElevation(map.rows);
  renderer.addElevation(map.zone, elevation);
  return { zone: map.zone, renderer, geometry, elevation };
}

/** The effect detail a session starts at: ?quality=full|lite|low, else low (AP-16). */
function startDetail(): 0 | 1 | 2 {
  const forced = new URLSearchParams(window.location.search).get('quality');
  return forced === 'full' ? 2 : forced === 'lite' ? 1 : 0;
}

/**
 * Prepares play while the title shows (decision AP-18). A browser compiles shaders and uploads
 * textures for real only when they are first used, which takes seconds on a machine without a
 * graphics card. So the renderer is built, its programs linked and the opening frame drawn once
 * with each body, one step per task so the title still answers keys between steps; each step
 * waits for the graphics to finish (reading one pixel), so its cost is measured and none of it is
 * left for the first frame. The caller presents the title again after every step that draws, in
 * the same task, so no hidden frame is ever seen. Waking reuses the renderer.
 *
 * A generator: each `next()` runs one step and yields its name; the return value is the result.
 */
export function* preparePlay(
  presenter: Presenter,
  palette: Palette,
  content: Content,
  atlases: ReadonlyMap<string, LoadedAtlas>,
  choice: NamingChoice,
): Generator<string, PreparedPlay | null> {
  const gl = presenter.gl;
  const pixel = new Uint8Array(4);
  const finish = (): void => {
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  };
  const b = parseTimeBalance(content.balance);
  const world = newCampaign('prepare', b, parsePeopleBasics(content.balance), content, choice);
  const land = landContext(content, content.balance);
  const map = world.onFoot === null ? undefined : land.maps.get(world.onFoot.zone);
  if (map === undefined) return null;
  const sim = createSimulation(b, world, land);
  const prepared = playRenderer(presenter, palette, atlases, map);
  finish();
  yield 'renderer';
  const detail = startDetail();
  prepared.renderer.compile(detail, 'water');
  finish();
  yield 'water';
  prepared.renderer.compile(detail, 'post');
  finish();
  yield 'post';
  const anims = new Map([...prepared.geometry].map(([name, m]) => [name, m.anims]));
  const shadows = new Map([...prepared.geometry].map(([name, m]) => [name, m.shadow]));
  const visuals = new ZoneVisuals(
    map,
    prepared.elevation,
    false,
    visualTuning(content.balance, palette),
  );
  visuals.detail = detail;
  const onFoot = sim.state.onFoot;
  if (onFoot === null) return null;
  const style = parseRenderStyle(renderJson);
  const layerFiles = bundledLayerFiles();
  for (const body of ['A', 'B'] as BodyModel[]) {
    const full = peopleLook(layerFiles, body);
    const look = {
      ...full,
      steerer: withOwned(full.steerer, (item) => steererOwns(sim.state.player, item)),
    };
    const tide = tideAt(sim.state.calendar, b);
    const scene = zoneScene({
      map,
      onFoot,
      tick: sim.state.tick,
      tideOpen: tide.tidalGroundOpen,
      phase: lightPhase(sim.state.calendar, b),
      look,
      anims,
      shadows,
      highlight: null,
      stoneWeeps: stoneWeeps(sim.state),
      visual: visuals.view({
        dt: 1 / 60,
        tick: sim.state.tick,
        onFoot,
        tide,
        sky: {
          minuteOfDay: sim.state.calendar.minuteOfDay,
          ...b.daylight[seasonOf(sim.state.calendar.day)],
        },
        anims,
        steererSheet: look.steerer.body,
      }),
    });
    prepared.renderer.render(scene, buildDrawList(scene, prepared.geometry, style.cutawayFade));
    finish();
    yield `draw${body}`;
  }
  return prepared;
}

/**
 * Whether WebGL is drawn in software (no graphics card, as on CI machines and some virtual
 * desktops): the game then starts at low effect detail rather than discovering it frame by frame.
 */
export function softwareRenderer(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(
    gl.getParameter(info === null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL) ?? '',
  );
  return /swiftshader|llvmpipe|softpipe|software|basic render|warp/i.test(name);
}

export function startPlay(
  canvas: HTMLCanvasElement,
  presenter: Presenter,
  palette: Palette,
  strings: StringTable,
  content: Content,
  atlases: ReadonlyMap<string, LoadedAtlas>,
  choice: NamingChoice,
  options: PlayOptions,
): void {
  const t = (key: string, vars: Record<string, string> = {}): string =>
    formatString(strings, key, vars);
  const b = parseTimeBalance(content.balance);
  // Start-up timings (ms since Wake), for diagnosing slow machines: data-startup on the overlay.
  const marks: Record<string, number> = { start: Math.round(performance.now() - options.wokeAt) };
  const mark = (name: string): void => {
    marks[name] = Math.round(performance.now() - options.wokeAt);
  };
  const world = newCampaign(options.seed, b, parsePeopleBasics(content.balance), content, choice);
  const land = landContext(content, content.balance);
  const opening = content.opening;
  if (opening === null || world.onFoot === null) throw new Error('No opening to play');
  const startMap = land.maps.get(world.onFoot.zone);
  if (startMap === undefined) throw new Error(`No map for ${world.onFoot.zone}`);
  /** The zone in view: replaced when the steerer walks on into another (Book 2 section 10). */
  let map = startMap;
  // Tests and captures only (`?kit=bow,seax`): start with these items in hand, the bow with Book
  // 10's starting arrows, their tooltips already seen, and the items gone from the strand.
  const kit = (new URLSearchParams(window.location.search).get('kit') ?? '')
    .split(',')
    .filter((k) => k !== '')
    .map((k) => `ITEM_${k.toUpperCase()}`);
  kit.forEach((item, i) => {
    if (content.onFoot?.items[item] === undefined || world.onFoot === null) return;
    world.player.hotbar.slots[i] = item;
    world.player.tipsSeen.push(item);
    world.onFoot.items = world.onFoot.items.filter((g) => g.item !== item);
    if (item === 'ITEM_BOW') {
      world.player.inventory['ITEM_ARROW'] = parseStartingWeapons(content.balance).startingArrows;
      world.player.tipsSeen.push('ITEM_ARROW');
    }
  });
  // Tests and captures only (`?camp=broch&time=19:00&fire=lit&stage=S1&wood=4`): start at the
  // broch after beat 2's lead, at a time, with the camp as given.
  campHooks(world, content, land, new URLSearchParams(window.location.search));
  const sim = createSimulation(b, world, land);
  // Saves (Book 2 section 20; Stage 9): the rotating autosaves and the checkpoints game over
  // reloads, kept under this campaign's own name. The first is written as the steerer wakes on
  // the strand (decision S9-20); storage that is blocked falls back to memory for the session.
  const saveStore = ((): SaveStore => {
    try {
      localStorage.setItem('oar-and-ember:probe', '1');
      localStorage.removeItem('oar-and-ember:probe');
      return new LocalStorageStore(`oar-and-ember:save:${options.seed}:`);
    } catch {
      return new MemoryStore();
    }
  })();
  const saves = new SaveManager(saveStore, canvas.dataset['build'] ?? 'dev');
  saves.autosave(sim.state, 'WAKING');
  attachWakingAutosave(sim, saves);
  /** A checkpoint asked for while the simulation stepped, written once the frame's steps end. */
  let checkpointDue: string | null = null;
  const fightCtx: FightContext | null = land.fight ?? null;
  const combatB = parseCombatBalance(content.balance);
  const steererVitality = parsePeopleBasics(content.balance).vitality;

  const settings = loadSettings(browserStorage());
  const input = new InputMapper(settings.bindings, settings.toggle);
  const session = new Session(
    sim,
    input,
    { awareHostiles: () => hostilesAware(sim.state.onFoot) },
    { map, controls: land.controls, rules: land.rules },
  );
  session.people = land.people ?? null;
  session.searches = land.searches ?? null;
  const style = parseRenderStyle(renderJson);
  const missileLook = {
    releaseHeight: land.rules.releaseHeightPx,
    icons: Object.fromEntries(
      Object.entries(content.onFoot?.items ?? {}).map(([id, d]) => [id, d.icon]),
    ),
  };
  mark('world');
  // Waking may have been moved by the test hooks (`?camp=`): the zone's map is the one in view.
  const viewMap = land.maps.get(world.onFoot.zone);
  if (viewMap !== undefined) map = viewMap;
  const prepared =
    options.prepared?.zone === map.zone
      ? options.prepared
      : playRenderer(presenter, palette, atlases, map);
  if (prepared === options.prepared) marks['prepared'] = 1;
  const { renderer, geometry, elevation } = prepared;
  const anims = new Map([...geometry].map(([name, m]) => [name, m.anims]));
  const shadows = new Map([...geometry].map(([name, m]) => [name, m.shadow]));
  mark('renderer');
  const store = browserStorage();
  let display = resolveDisplaySettings(
    store,
    window.location.search,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  mark('elevation');
  const tuning = visualTuning(content.balance, palette);
  // Each zone's height field, registered with the renderer the first time the zone is seen.
  const elevations = new Map([[map.zone, elevation]]);
  const elevationFor = (zone: ZoneMap): Elevation => {
    let e = elevations.get(zone.zone);
    if (e === undefined) {
      e = bakeElevation(zone.rows);
      renderer.addElevation(zone.zone, e);
      elevations.set(zone.zone, e);
    }
    return e;
  };
  let visuals = new ZoneVisuals(map, elevation, display.reducedMotion, tuning);
  // Reduced motion can be changed from the system menu with M (Book 2 section 21).
  window.addEventListener('keydown', (e) => {
    // Game over (Stage 9): reload the latest save, or begin again.
    if (sim.state.gameOver !== null) {
      if (e.code === 'Enter' || keyCodes('interact').includes(e.code)) reloadLatest();
      else if (e.code === 'KeyN') window.location.reload();
      return;
    }
    if (session.menus.open !== 'system') return;
    if (e.code === 'KeyG') {
      // The gore setting (Book 7 section 12): full, low, off, and round again.
      const gore = display.gore === 2 ? 1 : display.gore === 1 ? 0 : 2;
      display = { ...display, gore };
      visuals.gore = gore;
      engine.setGore(gore);
      saveDisplaySettings(store, display);
      return;
    }
    if (e.code === 'KeyK') {
      sim.submit({ type: 'SET_OPTIONS', secondWind: !sim.state.options.secondWind });
      return;
    }
    if (e.code === 'KeyH') {
      helpOpen = !helpOpen;
      return;
    }
    if (e.code === 'KeyI') {
      display = { ...display, infoCaptions: !display.infoCaptions };
      saveDisplaySettings(store, display);
      return;
    }
    if (e.code !== 'KeyM') return;
    display = { ...display, reducedMotion: !display.reducedMotion };
    visuals.reducedMotion = display.reducedMotion;
    saveDisplaySettings(store, display);
  });
  const fullLook = peopleLook(bundledLayerFiles(), choice.bodyModel);
  // The steerer's bow and seax are drawn only once picked up (decisions DD-6 and S9-19).
  let lookOwns: string | null = null;
  let look: PeopleLook = fullLook;
  const currentLook = (): PeopleLook => {
    const owns = ['ITEM_BOW', 'ITEM_SEAX']
      .map((item) => (steererOwns(sim.state.player, item) ? '1' : '0'))
      .join('');
    if (owns !== lookOwns) {
      lookOwns = owns;
      look = {
        ...fullLook,
        steerer: withOwned(fullLook.steerer, (item) => steererOwns(sim.state.player, item)),
      };
    }
    return look;
  };
  currentLook();
  // Capture only: `?actors=none` leaves people out and `?camera=tx,ty` holds the view centred on a
  // tile, for preview backgrounds (src/tools/art/preview48.ts).
  const captureParams = new URLSearchParams(window.location.search);
  const hidePeople = captureParams.get('actors') === 'none';
  const cameraParam = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(
    captureParams.get('camera') ?? '',
  );
  if (cameraParam !== null)
    visuals.cameraAt = {
      x: Math.round(Number(cameraParam[1]) * map.tile - 320),
      y: Math.round(Number(cameraParam[2]) * map.tile - 180),
    };

  const audioTable = content.audio;
  WebAudioEngine.prepare();
  const engine = new WebAudioEngine(audioTable?.cues ?? []);
  engine.setGore(display.gore);
  const audio = audioTable === null ? null : new AudioRouter(audioTable, strings, engine);
  const captionMs = (audioTable?.captionSeconds ?? 3) * 1000;
  const wireVisuals = (v: ZoneVisuals): void => {
    // Stage 9: the gore setting and how long stains last (content/combat.json gore).
    v.gore = display.gore;
    if (content.combat !== null) v.stainSeconds = content.combat.gore.stainSeconds;
    v.onStep = (surface, x) => {
      if (engine.unlocked)
        engine.footstep(
          surface,
          (x - (sim.state.onFoot?.player.x ?? x)) / 200,
          sim.state.onFoot?.player.gait ?? 'walk',
        );
    };
    v.onSplash = (x) => {
      if (audio !== null && engine.unlocked)
        audio.event('WADE_SPLASH', engine.now, {
          pan: (x - (sim.state.onFoot?.player.x ?? x)) / 200,
        });
    };
  };
  wireVisuals(visuals);
  // The pixel HUD under the text overlay: the hotbar, the target tile and the aim line.
  const hud = createHud(document, atlases);
  const overlay = createOverlay(document);
  const root = overlay.root;
  const items = content.onFoot?.items ?? {};
  const itemOf = (id: string | null) => (id === null ? undefined : items[id]);
  /** The slot's name shows briefly above the hotbar after a change (Book 7 section 10). */
  let slotShown = -1;
  let slotNameUntil = 0;
  /** A short refusal word beside the target tile: "Too far", "Nothing to cut". */
  let refusal: { key: string; text: string; tx: number; ty: number; until: number } | null = null;
  const refuse = (key: string, text: string, tx: number, ty: number, now: number): void => {
    refusal = { key, text, tx, ty, until: now + 1200 };
  };
  let lastTarget = { tx: 0, ty: 0 };
  let viewCamera = { x: 0, y: 0 };
  /** A refusal said over the steerer's head (no arrows, a full quiver). */
  const refuseHere = (key: string, text: string, now: number): void => {
    const p = sim.state.onFoot?.player;
    if (p === undefined) return;
    const at = tileOf(map, p.x, p.y);
    refuse(key, text, at.tx - 1, at.ty - 1, now);
  };
  // Pickup tooltips: shown once per item kind, one after another; the help page keeps them.
  const tipSeconds = content.onFoot?.tipSeconds ?? 10;
  let tipQueue: Id[] = [];
  let tip: { item: Id; until: number } | null = null;
  let helpOpen = false;
  let lastDevice: 'mouse' | 'key' | 'pad' = 'key';
  const tipContext = (item: Id): TipContext => ({
    bindings: settings.bindings,
    device: lastDevice,
    slot: ((): number | null => {
      const i = sim.state.player.hotbar.slots.indexOf(item === 'ITEM_ARROW' ? 'ITEM_BOW' : item);
      return i < 0 ? null : i;
    })(),
    arrows: sim.state.player.inventory['ITEM_ARROW'] ?? 0,
  });
  const has = (key: string): boolean => strings.has(key);
  const renderTip = (): void => {
    const region = overlay.region('tip');
    const def = tip === null ? undefined : itemOf(tip.item);
    if (tip === null || def?.tipKey === undefined) {
      region.replaceChildren();
      root.dataset['tip'] = '';
      return;
    }
    const title = document.createElement('strong');
    title.textContent = t(def.nameKey);
    const body = document.createElement('span');
    body.textContent = tipText(def.tipKey, tipContext(tip.item), t, has);
    region.replaceChildren(title, body);
    root.dataset['tip'] = tip.item;
  };

  // Book 8 section 01: patronymics in formal speech only; barks and prompts use the short name.
  const nameOf = (id: string): string => {
    const short = `person.short.${id.toLowerCase()}`;
    if (strings.has(short)) return t(short);
    const key = world.people[id]?.nameKey;
    return key === undefined ? id : t(key);
  };
  // Stage 12: the boat's name, once given, in the lines that speak of it ({ship}, Book 8).
  const line = (key: string): string =>
    t(key, { steerer: world.player.name, ship: sim.state.ships['flagship']?.name ?? '' });
  let subtitles: { text: string; kind: 'speech' | 'info'; until: number }[] = [];
  const say = (text: string, now: number, kind: 'speech' | 'info' = 'speech'): void => {
    subtitles = subtitles.filter((s) => s.text !== text);
    subtitles.push({ text, kind, until: now + captionMs });
    if (subtitles.length > 3) subtitles.shift();
  };
  let notice: { text: string; until: number } | null = null;
  /** Barks heard this session (Stage 8; the browser tests read it). */
  let barksHeard = 0;
  let beat = '';
  /** Where a person is, left or right of the steerer, as a stereo pan. */
  const panOf = (person: string): number => {
    const onFoot = sim.state.onFoot;
    const actor = onFoot?.actors[person];
    if (onFoot === null || actor === undefined) return 0;
    return Math.max(-1, Math.min(1, (actor.x - onFoot.player.x) / 200));
  };
  let lastAmbienceAt = -1;
  // Home audio (Stage 7): which music a place wants, in turns with ambience only at home, and how
  // near a lit fire the steerer is.
  const homeAudio = audioTable?.home;
  const placeMusic = homeAudio === undefined ? null : new PlaceMusic(homeAudio);
  /**
   * How hard the fight is, for the combat music's layers (Book 11 section 03): the rhythm with
   * the first foe aware, the melody with a second or a wound, the voice and the horn when the
   * steerer is outnumbered, bloodied or down (decision S9-21).
   */
  const fightIntensity = (): number => {
    const aware = hostilesAware(sim.state.onFoot);
    const p = sim.state.onFoot?.player;
    const down = p?.fight?.state === 'downed';
    return Math.min(1, 0.15 + 0.25 * aware + (steererBloodied() ? 0.25 : 0) + (down ? 0.4 : 0));
  };
  const steererBloodied = (): boolean =>
    sim.state.player.vitality < steererVitality * combatB.bloodiedBelow;
  const placeAudio = (): void => {
    if (audio === null) return;
    const phase = homePhase(sim.state.calendar, b);
    audio.setPlace(map.zone, phase, engine.now);
    const atHome = campDef !== null && map.zone === campDef.zone;
    // Stage 9: a fight under way has the combat music, its layers by how hard the fight is.
    const battle = sim.state.onFoot?.battle;
    const inFight = battle != null && battle.engaged && !battle.over && sim.state.gameOver === null;
    audio.director.setIntensity(inFight ? fightIntensity() : 0);
    // Stage 12: the Ship theme from the heave to the sea map (Book 11 section 04).
    const phaseNow = launchPhase(sim.state);
    const launching =
      mapMode === 'reveal' ||
      (phaseNow !== null && phaseNow !== 'NAMING' && phaseNow !== 'DONE');
    const want =
      sim.state.gameOver !== null
        ? null
        : launching
          ? 'MUS_LAUNCH'
          : inFight
          ? 'MUS_COMBAT_1'
          : (placeMusic?.want(engine.now, {
              allowed: sim.state.facts[FACT_HILD_SAFE] === true,
              home: atHome,
              phase,
            }) ?? null);
    if (want === null) {
      if (audio.director.state !== null) audio.silence(engine.now);
    } else if (audio.director.state !== want) audio.play(want, engine.now);
    const onFoot = sim.state.onFoot;
    const home = campDef === null ? undefined : sim.state.homes[campDef.home];
    const fire = campDef?.sites.find((x) => x.kind === 'FIRE' && x.zone === map.zone);
    let level = 0;
    if (
      onFoot !== null &&
      fire !== undefined &&
      home?.fire.lit === true &&
      homeAudio !== undefined
    ) {
      const d = Math.hypot(
        onFoot.player.x / map.tile - fire.x,
        onFoot.player.y / map.tile - fire.y,
      );
      const span = Math.max(1, homeAudio.fireSilentTiles - homeAudio.fireFullTiles);
      level = Math.max(0, Math.min(1, (homeAudio.fireSilentTiles - d) / span));
    }
    engine.setHearth(level);
    // Stage 10: the Kelda Spring, louder as the steerer nears its pool.
    const south = audioTable?.south;
    let spring = 0;
    const springAt = south?.spring.zone === map.zone ? south.spring : undefined;
    if (onFoot !== null && springAt !== undefined) {
      const d = Math.hypot(
        onFoot.player.x / map.tile - springAt.x,
        onFoot.player.y / map.tile - springAt.y,
      );
      const span = Math.max(1, springAt.silentTiles - springAt.fullTiles);
      spring = Math.max(0, Math.min(1, (springAt.silentTiles - d) / span));
    }
    engine.setSpring(spring);
    // The Hag's Seat's tell while her stone weeps and the steerer is on the headland: hail on the
    // stone, now and then, from where the stone stands (Book 11 section 12: every sign its tell).
    const searchDef = content.searches;
    if (
      south !== undefined &&
      searchDef != null &&
      onFoot !== null &&
      map.zone === searchDef.runa.zone &&
      stoneWeeps(sim.state) &&
      engine.unlocked
    ) {
      const lo = south.tellLeast;
      const hi = Math.max(lo, south.tellMost);
      // The first soon after arriving: within the least wait.
      nextTell ??= engine.now + lo * 0.4;
      if (engine.now >= nextTell) {
        const dx = searchDef.runa.stone.x - onFoot.player.x / map.tile;
        audio.event('SIGN_CAILLEACH', engine.now, { pan: Math.max(-1, Math.min(1, dx / 12)) });
        nextTell = engine.now + lo + (((sim.state.tick * 7919) % 1000) / 1000) * (hi - lo);
      }
    } else nextTell = null;
  };
  /** When the Hag's Seat's tell next sounds (audio clock), while it is due. */
  let nextTell: number | null = null;
  // The frame's clock: events arrive while a frame steps the simulation, and their captions and
  // notices must expire on the clock the frame tests them against (stepped play runs ahead of
  // the wall clock).
  let frameNow = performance.now();
  // The camp at home (Stage 7): what the scene draws of it, and the day's report.
  const campDef = content.camp;
  const broch = (buildingsJson as Record<string, unknown>)['bld_broch'] as
    | {
        band: number;
        top: number;
        bands: number;
        boxes?: [number, number, number, number][][];
        tufts?: [number, number, number, number][];
      }
    | undefined;
  const loops: Record<string, string> = Object.fromEntries(
    Object.entries(campDef?.tasks ?? {}).map(([id, def]) => [id, def.workLoop]),
  );
  const campScene = (): CampScene | undefined => {
    if (campDef === null) return undefined;
    const home = sim.state.homes[campDef.home];
    if (home === undefined) return undefined;
    const here = map.zone === campDef.zone;
    const fireSite = campDef.sites.find((s) => s.kind === 'FIRE' && s.zone === map.zone);
    const stageProps = home.stage === 'S1' ? campDef.props.S1 : campDef.props.S0;
    // Stage 11: the boat and its repairs, the wreck's rigging, the skiff, the ship of stones.
    const repairDef = content.repairs;
    const extra =
      repairDef === null
        ? []
        : repairProps(sim.state, { def: repairDef }, map.zone, content.launch);
    return {
      props: [...(here ? stageProps : []), ...extra],
      stage: home.stage,
      fire:
        fireSite === undefined
          ? null
          : { x: fireSite.x, y: fireSite.y, lit: home.fire.lit, fuel: home.fire.fuel },
      woodpile: here
        ? { ...campDef.woodpile, loads: Math.floor(home.stores['RES_DRIFTWOOD'] ?? 0) }
        : null,
      // The pieces of driftwood lying in this zone (decision PT-2).
      driftwood: driftwoodPieces(sim.state, { def: campDef }, map.zone),
      loops,
      building: broch ?? null,
      light: style.fire ?? null,
    };
  };
  /** The morning report, shown in Report mode until closed (Book 2 section 02). */
  let reportShown: string[] | null = null;
  /** The fade in from dark on waking and on entering a zone (frame clock, ms). */
  let fadeInFrom = -1;
  let workCue: { since: number; ticks: number; mark: number | null } | null = null;
  /** Stage 9: a crew order's icon over the one who took it, for a moment (frame clock). */
  const ordersShown: Record<string, { order: string; until: number }> = {};
  /** A pan for a point in the world, left or right of the steerer. */
  const panAt = (x: number): number =>
    Math.max(-1, Math.min(1, (x - (sim.state.onFoot?.player.x ?? x)) / 200));
  /** A fight sound by its event, from where the person is (Book 11 section 07). */
  const fightSound = (event: string, person: string | undefined, delay = 0): void => {
    if (audio === null || !engine.unlocked) return;
    audio.event(event, engine.now + delay, {
      pan: person === undefined || person === 'P_STEERER' ? 0 : panOf(person),
    });
  };
  // ---- Stage 12: the launch's screens, the sea map and the chapter's end.
  const launchDef = content.launch;
  const launchCtx = land.launch ?? null;
  const panelStyle = document.createElement('style');
  panelStyle.textContent = PANEL_STYLE;
  document.head.append(panelStyle);
  /** Which launch screen is up: the readiness screen, the name, the mark, the chapter's end. */
  let launchUi: 'none' | 'readiness' | 'naming' | 'mark' | 'chapter' = 'none';
  let launchShown = '';
  let pendingName = '';
  /** The sea map: being revealed at the launch, or looked at again (M) afterwards. */
  let mapMode: 'reveal' | 'view' | null = null;
  let mapOpenedAt = 0;
  let seaMap: SeaMapView | null = null;
  let mapClosedAt = -1;
  /** Real milliseconds a menu has held the game since time last ran (telemetry, S12-12). */
  let heldMs = 0;
  let timingsOpen = new URLSearchParams(window.location.search).has('timings');
  let timingsShown = '';
  /** The chapter's figures when it ended (played seconds and the first fight's). */
  let chapterEnd: { played: number; fight: number | null } | null = null;
  const words: PanelWords = {
    t: (key, vars) => t(key, vars ?? {}),
    person: (id) => nameOf(id),
    item: (id) => {
      const def = itemOf(id);
      return def === undefined ? id : t(def.nameKey);
    },
    fitting: (id) => t(`fitting.name.${id.toLowerCase()}`),
  };
  const openLaunch = (ui: typeof launchUi): void => {
    launchUi = ui;
    launchShown = '';
  };
  const seaMapView = (): SeaMapView | null => {
    if (seaMap !== null || launchDef === null) return seaMap;
    const sm = launchDef.seaMap;
    const home = sm.places[sm.home];
    const smoke = sm.places[sm.smoke];
    const mist = sm.hazards['HAZ_MIST'];
    if (home === undefined || smoke === undefined || mist === undefined) return null;
    seaMap = new SeaMapView(document, atlases, { home, smoke, mist });
    return seaMap;
  };
  /** The token's state for the household's mark (Book 7 section 05: a sail in its colours). */
  const markState = (): string =>
    (sim.state.ships['flagship']?.marks.sail ?? 'plain').replace(':', '_');
  const onEvent = (e: SimEvent): void => {
    const now = frameNow;
    switch (e.type) {
      case 'PERSON_CALLED':
        say(
          t('caption.format.with_direction', {
            caption: t('caption.voice.hild_calling'),
            direction: t(`caption.direction.${e.direction}`),
          }),
          now,
          'info',
        );
        say(
          t('caption.format.subtitle', { speaker: nameOf(e.person), line: line(e.lineKey) }),
          now,
        );
        // Her call in voice blips, from the side she calls from (Book 11 section 08).
        engine.voice(e.person, line(e.lineKey), panOf(e.person));
        return;
      case 'PERSON_SPOKE':
        say(
          t('caption.format.subtitle', { speaker: nameOf(e.person), line: line(e.lineKey) }),
          now,
        );
        engine.voice(e.person, line(e.lineKey), panOf(e.person));
        if (e.bark !== undefined) barksHeard++;
        return;
      case 'TALK_INFO':
      case 'SEARCH_INFO':
        say(t(e.key), now, 'info');
        return;
      // Stage 10: a checkpoint before a search's danger (Book 2 section 20).
      case 'CHECKPOINT':
        checkpointDue = e.label;
        return;
      case 'RESIDENT_APPROACHED':
        say(t('caption.voice.approach', { name: nameOf(e.person) }), now, 'info');
        return;
      case 'DISPUTE_RAISED':
      case 'JUDGEMENT_GIVEN':
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        return;
      case 'JOB_REFUSED':
        notice = {
          text: t(`ui.reason.${e.reason.toLowerCase()}`, { name: nameOf(e.person) }),
          until: now + captionMs,
        };
        return;
      case 'COMMAND_REFUSED':
        if (e.reason === 'NO_ARROWS') {
          refuseHere('no_arrows', t('ui.refusal.no_arrows'), now);
          if (audio !== null && engine.unlocked)
            audio.event('QUIVER_EMPTY', engine.now, { pan: 0 });
        }
        if (e.reason === 'QUIVER_FULL') refuseHere('quiver_full', t('ui.refusal.quiver_full'), now);
        if (e.reason === 'HOTBAR_FULL') refuseHere('hotbar_full', t('ui.refusal.hotbar_full'), now);
        if (e.reason === 'OUT_OF_REACH')
          refuse('too_far', t('ui.refusal.too_far'), lastTarget.tx, lastTarget.ty, now);
        if (e.reason === 'NOTHING_THERE')
          refuse('nothing_there', t('ui.refusal.nothing_there'), lastTarget.tx, lastTarget.ty, now);
        if (e.reason === 'NOTHING_TO_USE_ON') {
          const key = itemOf(e.detail)?.refusalKey ?? 'ui.refusal.nothing_there';
          refuse('nothing_to_use_on', t(key), lastTarget.tx, lastTarget.ty, now);
        }
        if (e.reason === 'NO_WATER') refuseHere('no_water', t('ui.refusal.no_water'), now);
        if (e.reason === 'TOO_EARLY_TO_SLEEP')
          refuseHere('too_early', t('ui.refusal.too_early'), now);
        if (e.reason === 'NO_DRIFTWOOD')
          refuseHere('no_driftwood', t('ui.refusal.no_driftwood'), now);
        if (e.reason === 'NO_FOOD') refuseHere('no_food', t('ui.refusal.no_food'), now);
        if (e.reason === 'TOO_TIRED') refuseHere('too_tired', t('ui.refusal.too_tired'), now);
        if (e.reason === 'BELOW_TIDE_LINE' || e.reason === 'NO_ROOM') {
          const key = e.reason === 'BELOW_TIDE_LINE' ? 'ui.prompt.below_tide' : 'ui.prompt.no_room';
          notice = { text: t(key, { name: nameOf(e.detail) }), until: now + captionMs };
        }
        return;
      case 'BOW_DRAWN':
      case 'BOW_LOOSED':
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        return;
      case 'MISSILE_LOOSED':
        if (audio !== null && engine.unlocked)
          audio.event(e.kind === 'spear' ? 'SPEAR_THROWN' : 'ARROW_FLIGHT', engine.now + 0.05, {
            pan: panOf(e.shooter),
          });
        return;
      case 'MISSILE_STRUCK': {
        visuals.missileStruck(e.strike, e.x, e.y);
        const cue = {
          ground: 'ARROW_EARTH',
          wood: 'ARROW_WOOD',
          stone: 'ARROW_STONE',
          shield: 'ARROW_SHIELD',
          body: 'ARROW_BODY',
          water: 'ARROW_WATER',
        }[e.strike];
        const pan = panAt(e.x);
        if (audio !== null && engine.unlocked) {
          audio.event(cue, engine.now, { pan });
          // Stage 9: a body struck is wet under the thud, by the gore setting (Book 11 section 07).
          if (e.strike === 'body' && display.gore > 0)
            audio.event('GORE_WET', engine.now + 0.02, { pan });
        }
        if (e.strike === 'body' && e.target !== undefined) {
          const t = sim.state.onFoot?.actors[e.target];
          visuals.blood(e.x, e.y - 20, t === undefined ? 1 : t.x - e.x, 0, false);
        }
        return;
      }
      case 'ITEM_PICKED_UP':
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        if (e.first && itemOf(e.item)?.tipKey !== undefined) tipQueue.push(e.item);
        return;
      case 'SHOVED':
        visuals.shove();
        return;
      case 'WORK_STARTED':
        workCue = { since: sim.state.tick, ticks: e.ticks, mark: e.markTick };
        if (audio !== null && engine.unlocked) {
          const sound = campDef?.tasks[e.task]?.sound;
          if (sound !== undefined) audio.event(sound, engine.now, { pan: 0 });
        }
        return;
      case 'WORK_PRESSED':
        if (e.quality > 0.5 && audio !== null && engine.unlocked)
          audio.event('TIMING_GOOD', engine.now, { pan: 0 });
        return;
      case 'WORK_DONE':
        workCue = null;
        return;
      case 'WORK_CANCELLED':
        workCue = null;
        return;
      case 'FISH_LANDED':
        if (e.by === 'P_STEERER' && audio !== null && engine.unlocked)
          audio.event('FISH_LANDED', engine.now, { pan: 0 });
        return;
      case 'FIRE_FED':
        if (audio !== null && engine.unlocked) audio.event('FIRE_FED', engine.now, { pan: 0 });
        return;
      case 'FIRE_OUT':
        if (audio !== null && engine.unlocked) audio.event('FIRE_OUT', engine.now, { pan: 0 });
        return;
      case 'FELL_ASLEEP':
        if (audio !== null && engine.unlocked) audio.event('SLEEP', engine.now, { pan: 0 });
        return;
      // ---- Stage 11: every repair and its task has its sound (Book 11 section 12).
      case 'MATERIAL_LAID':
      case 'RIGGING_CUT':
      case 'OAR_TAKEN':
      case 'REPAIR_DONE':
      case 'BOAT_READY':
      case 'FITTING_DONE':
      case 'FITTING_UNSHIPPED':
      case 'OAR_CARVED':
      case 'RITES_STONES':
      case 'RITES_BEGAN':
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        return;
      case 'RITES_DONE':
        if (audio !== null && engine.unlocked)
          audio.event(`RITES_DONE_${e.form}`, engine.now, { pan: 0 });
        return;
      // ---- Stage 12: the launch (its gate, its scene, the sea map and the chapter's end).
      case 'READINESS_ASKED':
        if (session.menus.request('planning').ok) openLaunch('readiness');
        return;
      case 'LAUNCH_GATHERED':
        fadeInFrom = now;
        return;
      case 'LAUNCH_SLIDE':
      case 'LAUNCH_AFLOAT':
      case 'SAIL_HOISTED':
      case 'SAIL_SET':
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        return;
      case 'CREW_ABOARD':
        if (audio !== null && engine.unlocked)
          audio.event('CREW_ABOARD', engine.now, {
            pan: e.person === 'P_STEERER' ? 0 : panOf(e.person),
          });
        return;
      case 'OAR_STROKE': {
        // In time with the drawn stroke: the blades bite at the catch, creak on the recovery.
        if (audio === null || !engine.unlocked) return;
        const catchIn = ((60 - (sim.state.tick % 60)) % 60) / 60;
        audio.event('OAR_STROKE', engine.now + catchIn, { pan: 0 });
        audio.event('OAR_CREAK', engine.now + catchIn + 0.75, { pan: 0 });
        return;
      }
      case 'SEA_MAP_REVEALED':
        if (session.menus.request('map').ok) {
          mapMode = 'reveal';
          mapOpenedAt = now;
        }
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now + 2.5, { pan: 0 });
        return;
      case 'CHAPTER_ENDED': {
        checkpointDue = e.save;
        const rep = telemetryReport(sim.state);
        chapterEnd = {
          played: rep.now,
          fight: rep.marks.find((m) => m.key === 'first_combat')?.seconds ?? null,
        };
        reportShown = null;
        if (session.menus.request('report').ok) openLaunch('chapter');
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        return;
      }
      case 'MORNING_REPORT_DUE': {
        const report = sim.state.report;
        if (report !== null) {
          reportShown = reportSentences(report, t, nameOf);
          session.menus.request('report');
        }
        fadeInFrom = now;
        return;
      }
      case 'ZONE_ENTERED':
        fadeInFrom = now;
        return;
      case 'BEAT_COMPLETED':
        // The island theme enters once Hild is safe (placeAudio): the opening has no music.
        beat = e.beat;
        return;
      case 'FIRE_LIT':
        // The hearth theme starts at the first fire (Book 11 section 04).
        placeMusic?.begin(engine.now);
        return;
      // ---- Stage 9: the fight's sounds, sprays and words (Book 11 section 07, Book 7 section 12).
      case 'ENCOUNTER_STARTED':
        checkpointDue = e.checkpoint;
        return;
      case 'CHARGE_LEVEL':
        fightSound(e.level === 1 ? 'CHARGE_LEVEL_1' : 'HEAVY_CHARGE_LEVEL_2', e.who);
        return;
      case 'SWING':
        fightSound(e.heavy ? 'SWING_HEAVY' : 'SWING_LIGHT', e.who);
        return;
      case 'BLOW': {
        const who = e.defender;
        if (e.outcome === 'PARRIED') {
          fightSound('PARRY', who);
          visuals.shake(1);
        } else if (e.outcome === 'BLOCKED') fightSound('BLOCKED', who);
        else if (e.outcome === 'GUARD_BROKEN') {
          fightSound('GUARD_BROKEN', who);
          visuals.shake(2);
        } else if (e.outcome === 'DODGED') fightSound('DODGED', who);
        else {
          fightSound(
            e.material === 'MAIL'
              ? 'HIT_MAIL'
              : e.material === 'SHIELD'
                ? 'HIT_SHIELD'
                : 'HIT_FLESH',
            who,
          );
          if (e.material === 'FLESH' || e.material === 'MAIL') {
            if (display.gore > 0) fightSound(e.heavy ? 'GORE_BONE' : 'GORE_WET', who, 0.03);
            visuals.blood(e.x, e.y, e.dx, e.dy, e.heavy);
          }
        }
        return;
      }
      case 'DODGED':
        fightSound('DODGED', e.who);
        return;
      case 'SHOVE_LANDED':
        fightSound('SHOVED', e.target);
        return;
      case 'PERSON_DOWNED':
        fightSound('PERSON_DOWNED', e.person);
        return;
      case 'PERSON_KILLED':
        fightSound('BODY_FALL', e.person, 0.15);
        fightSound('WEAPON_DROPPED', e.person, 0.3);
        if (e.piece !== null && display.gore === 2) fightSound('GORE_DISMEMBER', e.person);
        return;
      case 'PERSON_SURRENDERED':
        say(t('caption.info.surrender', { name: nameOf(e.person) }), now, 'info');
        return;
      case 'PERSON_FLED':
        say(t('caption.info.flee', { name: nameOf(e.person) }), now, 'info');
        return;
      case 'PERSON_BROUGHT_HOME':
        say(t('caption.info.brought_home', { name: nameOf(e.person) }), now, 'info');
        return;
      case 'LEFT_BEHIND':
        say(t('caption.info.left_behind', { name: nameOf(e.person) }), now, 'info');
        return;
      case 'STEERER_DOWNED':
        if (e.secondWind) say(t('caption.info.second_wind'), now, 'info');
        fightSound('PERSON_DOWNED', 'P_STEERER');
        return;
      case 'STEERER_DIED':
        if (audio !== null && engine.unlocked) audio.event('GAME_OVER', engine.now, { pan: 0 });
        return;
      case 'FINISH_WARNING':
        say(t('caption.info.finish_warning', { target: nameOf(e.target) }), now, 'info');
        return;
      case 'CREW_ORDER_ACK':
        ordersShown[e.person] = { order: e.order.toLowerCase(), until: now + 1500 };
        return;
      case 'CREW_ORDER_REFUSED':
        if (e.reason === 'CANNOT_FIGHT')
          notice = {
            text: `${nameOf(e.person)}: ${t('ui.refusal.cannot_fight')}`,
            until: now + captionMs,
          };
        return;
      case 'FIGHT_REFUSED':
        if (e.reason === 'NO_SHIELD') refuseHere('no_shield', t('ui.refusal.no_shield'), now);
        else refuseHere('too_tired', t('ui.refusal.too_tired'), now);
        return;
      default:
        return;
    }
  };
  sim.events.onAny(onEvent);

  /**
   * The conversation panel (Book 8 section 09): who it is with, the line on screen, and the
   * steerer's options, numbered; a scene's lines and judgement the same way. Rebuilt only when it
   * changes. Time goes on while it is open.
   */
  const renderTalk = (mouse: boolean): void => {
    const region = overlay.region('talk');
    const talk = sim.state.talk;
    const peopleCtx = land.people ?? null;
    if (talk === null || peopleCtx === null) {
      if (region.childElementCount > 0) region.replaceChildren();
      root.dataset['talk'] = '';
      root.dataset['talkKind'] = '';
      root.dataset['talkLine'] = '';
      root.dataset['talkOptions'] = '';
      return;
    }
    const options = talkOptions(sim.state, peopleCtx, land.searches ?? null);
    const cursor = Math.min(session.talkCursor, Math.max(0, options.length - 1));
    const lineKey = talk.line?.key ?? '';
    const shown = [talk.with, lineKey, options.map((o) => o.key).join('|'), cursor, mouse].join(
      '#',
    );
    root.dataset['talk'] = talk.with;
    root.dataset['talkKind'] = talk.kind;
    root.dataset['talkLine'] = lineKey;
    root.dataset['talkOptions'] = options.map((o) => o.key).join('|');
    if (region.dataset['shown'] === shown) return;
    region.dataset['shown'] = shown;
    const title = document.createElement('h2');
    title.textContent =
      talk.kind === 'SCENE' ? t('ui.talk.scene') : t('ui.talk.title', { name: nameOf(talk.with) });
    const parts: HTMLElement[] = [title];
    if (talk.line !== null) {
      const p = document.createElement('p');
      if (talk.line.speaker === null) {
        p.className = 'info';
        p.textContent = t(talk.line.key);
      } else {
        p.className = 'line';
        p.textContent = t('caption.format.subtitle', {
          speaker: nameOf(talk.line.speaker),
          line: line(talk.line.key),
        });
      }
      parts.push(p);
    }
    if (options.length > 0) {
      const list = document.createElement('ol');
      options.forEach((o, i) => {
        const li = document.createElement('li');
        li.textContent = t(o.key);
        if (i === cursor) li.className = 'chosen';
        list.append(li);
      });
      parts.push(list);
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = mouse
        ? t('ui.talk.choose_click', { key: keys('dodge') })
        : t('ui.talk.choose', { keys: `1–${options.length}`, key: keys('dodge') });
      parts.push(hint);
    }
    region.replaceChildren(...parts);
  };

  const browser = attachBrowserInput(window, canvas, input, {
    firstInput: () => {
      if (!engine.unlocked && audio !== null) {
        engine.unlock();
        // Book 11: no music in the first seconds of the opening; wind, surf and Hild's voice.
        engine.setSeason(seasonOf(world.calendar.day) === 'Winter');
        audio.setPlace(map.zone, homePhase(world.calendar, b), engine.now);
      }
    },
  });
  const keys = (action: Action): string =>
    settings.bindings[action]
      .filter((x) => x.device === 'key')
      .slice(0, 1)
      .map(bindingLabel)
      .join('');
  const moveKeys = (['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const).map(keys).join(' ');
  const keyCodes = (action: Action): string[] =>
    settings.bindings[action].flatMap((x) => (x.device === 'key' ? [x.code] : []));
  /** Game over's reload (Book 2 section 20): the latest autosave or checkpoint, into this sim. */
  let restored = false;
  const reloadLatest = (): void => {
    const point = saves.latestRestorePoint();
    if (point === null) {
      window.location.reload();
      return;
    }
    sim.restore(saves.load(point.slot).state);
    restored = true;
    lookOwns = null;
    subtitles = [];
    notice = null;
    fadeInFrom = frameNow;
  };

  const started = performance.now();
  let moved = false;
  let last = started;
  let first = true;
  let lastVisual = started;
  let frameMs = 0;
  let frames = 0;
  // Effect detail (AP-16): full unless forced with ?quality=full|lite|low, stepped down when
  // frames keep coming slower than 10 a second, so a slow machine stays playable.
  const quality = new URLSearchParams(window.location.search).get('quality');
  const forced = quality === 'full' || quality === 'lite' || quality === 'low' ? quality : null;
  // Every session starts at low detail and steps up only once frames prove fast, so a slow
  // machine never compiles or draws the heavy effects (AP-16); a software renderer stays low.
  const software = softwareRenderer(presenter.gl);
  visuals.detail = startDetail();
  let slowFrames = 0;
  let fastFrames = 0;
  let steppedDown = false;
  let lastFrameAt = -1;
  const frame = (now: number): void => {
    frameNow = now;
    const workStart = performance.now();
    if (forced === null && lastFrameAt >= 0) {
      const gap = now - lastFrameAt;
      // A very slow frame counts at once; merely slow ones must keep coming.
      slowFrames =
        gap > 400 ? slowFrames + 4 : gap > 100 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      fastFrames = gap < 30 ? fastFrames + 1 : 0;
      if (slowFrames >= 4 && visuals.detail > 0) {
        visuals.detail = visuals.detail === 2 ? 1 : 0;
        slowFrames = 0;
        steppedDown = true;
      } else if (fastFrames >= 45 && visuals.detail < 2 && !steppedDown && !software) {
        visuals.detail = visuals.detail === 0 ? 1 : 2;
        fastFrames = 0;
      }
    }
    lastFrameAt = now;
    browser.poll();
    // The pointer in world pixels: through the viewport's whole-number scale and the camera.
    const surface = browser.pointer();
    const vp = presenter.viewport;
    const pointer =
      surface === null
        ? null
        : {
            x: viewCamera.x + (surface.x - vp.x) / vp.scale,
            y: viewCamera.y + (surface.y - vp.y) / vp.scale,
          };
    const device = browser.lastDevice();
    const deviceChanged = device !== lastDevice;
    lastDevice = device;
    const result = session.frame(now - last, browser.aim(), { device, pointer });
    // Stage 12, telemetry: real time a menu held the game is sent once time runs again.
    if (session.menus.timeStopped) heldMs += now - last;
    else if (heldMs > 0) {
      sim.submit({ type: 'TIME_HELD', ms: Math.round(heldMs) });
      heldMs = 0;
    }
    updateLaunchUi(now);
    // A checkpoint before major danger (Book 2 section 20), written between ticks.
    if (checkpointDue !== null) {
      saves.checkpoint(sim.state, checkpointDue);
      checkpointDue = null;
    }
    // Walked on into another zone (Book 2 section 10): its map, height field and visuals.
    const zoneNow = sim.state.onFoot?.zone;
    if (zoneNow !== undefined && (zoneNow !== map.zone || restored)) {
      restored = false;
      const next = land.maps.get(zoneNow);
      if (next !== undefined) {
        map = next;
        const detail = visuals.detail;
        visuals = new ZoneVisuals(map, elevationFor(map), display.reducedMotion, tuning);
        visuals.detail = detail;
        wireVisuals(visuals);
        if (audio !== null && engine.unlocked)
          audio.setPlace(map.zone, homePhase(sim.state.calendar, b), engine.now);
      }
    }
    if (session.land !== null && session.land.map !== map) session.land = { ...session.land, map };
    // The tooltip in turn: the next one when the last has had its time; named for the device in use.
    if (tip !== null && tip.until < now) tip = null;
    if (tip === null && tipQueue.length > 0) {
      const next = tipQueue[0];
      tipQueue = tipQueue.slice(1);
      if (next !== undefined) tip = { item: next, until: now + tipSeconds * 1000 };
      renderTip();
    } else if (tip === null && root.dataset['tip'] !== '') renderTip();
    else if (tip !== null && deviceChanged) renderTip();
    last = now;
    const target = result.target;
    if (target !== null) {
      lastTarget = target.tile;
      if (target.refused === 'TOO_FAR')
        refuse('too_far', t('ui.refusal.too_far'), target.tile.tx, target.tile.ty, now);
      if (target.slot !== slotShown) {
        // The slot's name shows briefly above the hotbar (not on the first frame).
        if (slotShown >= 0) slotNameUntil = now + 1500;
        slotShown = target.slot;
      }
    }
    if (first) {
      root.dataset['controlMs'] = String(Math.round(now - options.wokeAt));
      first = false;
    }
    if (result.refusedActions.length > 0)
      notice = { text: t('ui.prompt.hands_full'), until: now + captionMs };
    const onFoot = sim.state.onFoot;
    if (onFoot === null) return;
    if (onFoot.player.moving) moved = true;
    const tide = tideAt(sim.state.calendar, b);
    const tideOpen = tide.tidalGroundOpen;
    const daylight = b.daylight[seasonOf(sim.state.calendar.day)];
    const frameInput = {
      dt: (now - lastVisual) / 1000,
      tick: sim.state.tick,
      onFoot,
      tide,
      sky: { minuteOfDay: sim.state.calendar.minuteOfDay, ...daylight },
      anims,
      steererSheet: look.steerer.body,
      lead: ((): CameraLead => {
        if (device === 'mouse' && pointer !== null) return { kind: 'cursor', ...pointer };
        if (device === 'pad') return { kind: 'stick', ...result.stick };
        return { kind: 'travel' };
      })(),
      aiming: onFoot.player.aim !== null,
      fire: ((): { x: number; y: number; lit: boolean } | null => {
        const site = campDef?.sites.find((x) => x.kind === 'FIRE' && x.zone === map.zone);
        const home = campDef === null ? undefined : sim.state.homes[campDef.home];
        return site === undefined || home === undefined
          ? null
          : { x: site.x * map.tile, y: site.y * map.tile, lit: home.fire.lit };
      })(),
      night: lightPhase(sim.state.calendar, b) === 'night',
    };
    lastVisual = now;
    visuals.update(frameInput);
    const interaction = interactionNow(onFoot, map, land.rules, tideOpen, sim.state.facts);

    // The one prompt that fits the moment.
    let prompt = '';
    let promptKind = '';
    const interactKey = keys('interact');
    if (interaction?.kind === 'PICK_UP') {
      const lying = onFoot.items.find((i) => i.key === interaction.key);
      const what = itemOf(lying?.item ?? 'ITEM_ARROW');
      const item = what === undefined ? '' : t(what.nameKey);
      prompt =
        device === 'mouse'
          ? t('ui.prompt.pick_up_click', { item })
          : t('ui.prompt.pick_up', { key: interactKey, item });
      promptKind = 'pick_up';
    } else if (interaction?.kind === 'LIFT') {
      prompt =
        device === 'mouse'
          ? t('ui.prompt.lift_click', { name: nameOf(interaction.target) })
          : t('ui.prompt.lift', { key: interactKey, name: nameOf(interaction.target) });
      promptKind = 'lift';
    } else if (interaction?.kind === 'SET_DOWN') {
      const name = nameOf(interaction.target);
      if (interaction.refusal === null) {
        prompt = t('ui.prompt.set_down', { key: interactKey, name });
        promptKind = 'set_down';
      } else {
        prompt = t(
          interaction.refusal === 'BELOW_TIDE_LINE' ? 'ui.prompt.below_tide' : 'ui.prompt.no_room',
          {
            name,
          },
        );
        promptKind = interaction.refusal === 'BELOW_TIDE_LINE' ? 'below_tide' : 'no_room';
      }
    } else if (!moved && now - started > opening.moveHintSeconds * 1000) {
      prompt = t('ui.prompt.move', { keys: moveKeys });
      promptKind = 'move';
    }
    // The camp's uses (Stage 7): the nearer of a lift or pickup and a task, as the simulation picks.
    const campCtx = land.camp ?? null;
    const uses = campCtx === null ? [] : campUses(sim.state, campCtx, map, onFoot.actors);
    // Stage 10: the searches' words (Bran, Ketill, Runa, the stone), as the simulation offers them.
    if (land.searches != null) uses.push(...searchPlacedUses(sim.state, land.searches, map));
    // Stage 11: the boat, the wreck's rigging, the skiff's oar, the words at the cave and the bier.
    if (land.repairs != null) uses.push(...repairPlacedUses(sim.state, land.repairs, map));
    const reachPx = land.rules.interactRadiusTiles * map.tile;
    const use =
      onFoot.carrying === null && onFoot.player.work == null
        ? campUseNear(uses, onFoot.player, reachPx)
        : null;
    const at = interaction === null ? null : interactionPoint(onFoot, interaction, map.tile);
    if (
      use !== null &&
      (interaction === null ||
        (interaction.kind !== 'SET_DOWN' &&
          (at === null ||
            Math.hypot(use.x - onFoot.player.x, use.y - onFoot.player.y) <
              Math.hypot(at.x - onFoot.player.x, at.y - onFoot.player.y))))
    ) {
      const label = campUseLabel(use.use, content, t, nameOf, interactKey, device === 'mouse');
      prompt = label.text;
      promptKind = label.kind;
    }
    // Stage 9: a downed foe within reach can be finished (Book 2 section 12), held.
    const finishable = fightCtx === null ? null : finisherTarget(sim.state, fightCtx, map.tile);
    if (finishable !== null) {
      prompt = t(device === 'mouse' ? 'ui.prompt.finish_click' : 'ui.prompt.finish', {
        key: keys('finisher'),
        name: nameOf(finishable),
      });
      promptKind = 'finish';
    }
    const work = onFoot.player.work;
    // Only a timed task asks for the press (decision PT-1); plain work just plays its loop.
    if (work != null && campCtx !== null && isTimed(campCtx, work.task)) {
      prompt = t('ui.prompt.timing', {
        key: device === 'mouse' ? t('ui.input.mouse.0') : keys('useItem'),
      });
      promptKind = 'timing';
    }
    if (notice !== null && notice.until < now) notice = null;
    overlay.region('prompt').textContent = notice?.text ?? prompt;

    subtitles = subtitles.filter((s) => s.until > now);
    // The ambience follows the game's own wind at the steerer and the drawn tide, four times a second.
    if (engine.unlocked && now - lastAmbienceAt > 250) {
      lastAmbienceAt = now;
      engine.setWind(
        STRAND_WIND.strength,
        gustAt(STRAND_WIND, onFoot.player.x, onFoot.player.y, visuals.seconds),
        -STRAND_WIND.dirX,
      );
      if (visuals.tideLevel >= 0) engine.setTide(visuals.tideLevel);
      placeAudio();
    }
    const soundCaptions = audio === null ? [] : audio.update(engine.now);
    showCaptions(
      overlay.region('captions'),
      [...subtitles, ...soundCaptions],
      display.infoCaptions,
    );
    const open = session.menus.open;
    if (open !== 'system') helpOpen = false;
    // The help page: every tooltip seen so far, for the device in use.
    const help = overlay.region('help');
    if (helpOpen) {
      const lines = helpLines(sim.state.player.tipsSeen, items, tipContext, t, has);
      const title = document.createElement('h2');
      title.textContent = t('ui.help.title');
      const body = (lines.length === 0 ? [t('ui.help.empty')] : lines).map((l) => {
        const para = document.createElement('p');
        para.textContent = l;
        return para;
      });
      const back = document.createElement('p');
      back.textContent = t('ui.help.close', { key: 'H' });
      if (help.dataset['shown'] !== lines.join('|') + device) {
        help.replaceChildren(title, ...body, back);
        help.dataset['shown'] = lines.join('|') + device;
      }
    } else if (help.childElementCount > 0) {
      help.replaceChildren();
      help.dataset['shown'] = '';
    }
    root.dataset['help'] = helpOpen ? String(sim.state.player.tipsSeen.length) : '';
    root.dataset['tipsSeen'] = sim.state.player.tipsSeen.join(',');
    overlay.region('menu').textContent =
      open === null
        ? ''
        : `${t('ui.menu.open', { menu: t(`ui.menu.name.${open}`) })}${
            open === 'system'
              ? ` ${t(display.reducedMotion ? 'ui.system.motion_on' : 'ui.system.motion_off', { key: 'M' })} ${t(display.infoCaptions ? 'ui.system.info_on' : 'ui.system.info_off', { key: 'I' })} ${t('ui.system.help', { key: 'H' })} ${t('ui.system.gore', { level: t(`ui.gore.${['off', 'low', 'full'][display.gore] ?? 'full'}`), key: 'G' })} ${t(sim.state.options.secondWind ? 'ui.system.second_wind_on' : 'ui.system.second_wind_off', { key: 'K' })}`
              : ''
          }`;

    const view = visuals.view(frameInput);
    const camp = campScene();
    const scene = zoneScene({
      map,
      onFoot,
      tick: sim.state.tick,
      tideOpen,
      phase: lightPhase(sim.state.calendar, b),
      look: currentLook(),
      anims,
      shadows,
      highlight: interaction?.kind === 'LIFT' ? interaction.target : null,
      visual: view,
      hidePeople,
      facts: sim.state.facts,
      stoneWeeps: stoneWeeps(sim.state),
      missiles: missileLook,
      ...(camp === undefined ? {} : { camp }),
      gore: display.gore,
      orders: Object.fromEntries(
        Object.entries(ordersShown)
          .filter(([, o]) => o.until > now)
          .map(([id, o]) => [id, o.order]),
      ),
      steererBloodied: steererBloodied(),
      ...(content.combat === null
        ? {}
        : {
            corpseFade: {
              low: content.combat.gore.corpseFadeSeconds.low * 60,
              off: content.combat.gore.corpseFadeSeconds.off * 60,
            },
          }),
    });
    root.dataset['camera'] = `${view.camera.x},${view.camera.y}`;
    viewCamera = view.camera;
    const lead = visuals.lead;
    root.dataset['lead'] = `${lead.x},${lead.y}`;
    // The HUD: the hotbar, the target tile (not while drawing) and the bow's aim line.
    const hotbar = sim.state.player.hotbar;
    const p = onFoot.player;
    const drawTicks = (anims.get(look.steerer.body)?.['draw']?.ticks ?? 8) * 2;
    const aimTo = ((): { x: number; y: number } | null => {
      if (p.aim === null) return null;
      if (device === 'mouse' && pointer !== null) return pointer;
      const far = land.controls.castReach * map.tile;
      const a = ((target?.aimDir ?? 0) / AIM_DIRECTIONS) * 2 * Math.PI;
      return { x: p.x + Math.cos(a) * far, y: p.y - 26 + Math.sin(a) * far };
    })();
    const hudView: HudView = {
      camera: view.camera,
      seconds: visuals.seconds,
      tile: map.tile,
      hotbar: {
        slots: Array.from({ length: land.controls.hotbarSlots }, (_, i) => {
          const def = itemOf(hotbar.slots[i] ?? null);
          // An item that spends ammunition shows how much is carried (the bow's arrows).
          const count =
            def?.ammo === undefined ? null : (sim.state.player.inventory[def.ammo] ?? 0);
          return { icon: def?.icon ?? null, count };
        }),
        selected: target?.slot ?? hotbar.selected,
      },
      cursor:
        // A blade has no target tile (it swings at the cursor's facing, S9-22): its arrow shows.
        target === null || p.aim !== null || hidePeople || target.use === 'MELEE'
          ? null
          : {
              tx: target.tile.tx,
              ty: target.tile.ty,
              inReach: target.inReach,
              glyph: target.interactive ? null : (itemOf(target.item)?.glyph ?? null),
            },
      aim:
        aimTo === null || p.aim === null
          ? null
          : {
              from: { x: p.x, y: p.y - 26 },
              to: aimTo,
              draw: Math.min(1, (sim.state.tick - p.aim.since) / drawTicks),
            },
      // The facing an attack or a draw takes, when aimed with the cursor (Book 7 section 10).
      facingArrow:
        p.aim !== null || (target?.use === 'MELEE' && device === 'mouse')
          ? { x: p.x, y: p.y, facing: p.aim !== null ? p.facing : facingTowards(p, pointer) }
          : null,
    };
    // Stage 7: the day clock, the stamina bar with its reasons, and the work's timing ring.
    const st = staminaView(sim.state.player.stamina);
    const light = lightPhase(sim.state.calendar, b);
    const cue = work == null || workCue?.mark == null ? null : { ...workCue, mark: workCue.mark };
    const hudFull: HudView = {
      ...hudView,
      clock: { minuteOfDay: sim.state.calendar.minuteOfDay, light },
      stamina: {
        current: st.current,
        max: st.max,
        base: st.base,
        reasons: st.reasons
          .filter((r) => r.amount > 0)
          .map((r) => ({ reason: r.reason, amount: r.amount })),
      },
      timing:
        cue === null || work == null
          ? null
          : {
              x: work.at.x,
              y: work.at.y - 18,
              progress: (sim.state.tick - cue.since) / Math.max(1, cue.mark - cue.since),
              pressed: work.press !== null,
            },
    };
    hud.draw(hudFull);
    // The words beside them on the text overlay (Book 8 section 10: the plain reason).
    const season = seasonOf(sim.state.calendar.day);
    const clockText2 = t('ui.clock.text', {
      day: String(sim.state.calendar.day),
      season: t(`ui.season.${season.toLowerCase()}`),
      time: clockText(sim.state.calendar.minuteOfDay),
    });
    const clockRegion = overlay.region('clock');
    if (clockRegion.textContent !== clockText2) clockRegion.textContent = clockText2;
    const reasonText = st.reasons.map((r) => t(r.labelKey)).join('  ·  ');
    const staminaRegion = overlay.region('stamina');
    if (staminaRegion.textContent !== reasonText) staminaRegion.textContent = reasonText;
    // Game over (Stage 9; Book 2 section 20): the steerer has fallen; reload the latest save.
    const over = sim.state.gameOver;
    const goRegion = overlay.region('gameover');
    const point = over === null ? null : saves.latestRestorePoint();
    const goShown = over === null ? '' : `${over.tick}|${point?.sequence ?? 0}|${device}`;
    if (goRegion.dataset['shown'] !== goShown) {
      goRegion.dataset['shown'] = goShown;
      if (over === null) goRegion.replaceChildren();
      else {
        const title = document.createElement('h2');
        title.textContent = t('ui.gameover.title', { steerer: sim.state.player.name });
        const body = document.createElement('p');
        body.textContent = t('ui.gameover.line');
        const parts: HTMLElement[] = [title, body];
        if (point !== null) {
          const reload = document.createElement('p');
          reload.className = 'choice';
          reload.textContent = t('ui.gameover.reload', {
            key: keys('interact'),
            day: String(point.day),
          });
          reload.addEventListener('click', reloadLatest);
          parts.push(reload);
        }
        const again = document.createElement('p');
        again.className = 'choice';
        again.textContent = t('ui.gameover.restart', { key: 'N' });
        again.addEventListener('click', () => {
          window.location.reload();
        });
        parts.push(again);
        goRegion.replaceChildren(...parts);
      }
    }
    root.dataset['gameOver'] = over === null ? '' : over.cause;
    // The morning report in Report mode (time stopped until it is closed).
    const reportRegion = overlay.region('report');
    const reportOpen = session.menus.open === 'report' && reportShown !== null;
    if (reportOpen && reportRegion.dataset['shown'] !== reportShown?.join('|')) {
      const title = document.createElement('h2');
      title.textContent = t('ui.report.title', {
        day: String(sim.state.calendar.day),
        season: t(`ui.season.${season.toLowerCase()}`),
      });
      const body = (reportShown ?? []).map((l) => {
        const para = document.createElement('p');
        para.textContent = l;
        return para;
      });
      const close = document.createElement('p');
      close.textContent = t('ui.report.close', { key: keys('report') });
      reportRegion.replaceChildren(title, ...body, close);
      reportRegion.dataset['shown'] = reportShown?.join('|') ?? '';
    } else if (!reportOpen && reportRegion.childElementCount > 0) {
      reportRegion.replaceChildren();
      reportRegion.dataset['shown'] = '';
    }
    // Lying down: the view darkens as sleep comes; on waking and on entering a zone, it clears.
    const sleeping = onFoot.player.sleep;
    let dark = 0;
    if (sleeping != null && campCtx !== null)
      dark = Math.min(1, (sim.state.tick - sleeping.since) / Math.max(1, campCtx.sleepTicks));
    if (fadeInFrom >= 0) dark = Math.max(dark, 1 - (now - fadeInFrom) / 600);
    if (fadeInFrom >= 0 && now - fadeInFrom > 600) fadeInFrom = -1;
    const fade = overlay.region('fade');
    const opacity = dark <= 0.01 ? '0' : dark.toFixed(2);
    if (fade.style.opacity !== opacity) fade.style.opacity = opacity;
    hud.fit(presenter.viewport, window.devicePixelRatio);
    // The slot's name above the hotbar, and a refusal word beside the target tile.
    const inHand = itemOf(hotbar.slots[target?.slot ?? hotbar.selected] ?? null);
    overlay.region('slot').textContent =
      now < slotNameUntil && inHand !== undefined ? t(inHand.nameKey) : '';
    if (refusal !== null && refusal.until < now) refusal = null;
    const word = overlay.region('refusal');
    word.textContent = refusal?.text ?? '';
    if (refusal !== null) {
      word.style.left = `${(((refusal.tx + 1) * map.tile - view.camera.x) / LOGICAL_WIDTH) * 100}%`;
      word.style.top = `${((refusal.ty * map.tile - 4 - view.camera.y) / LOGICAL_HEIGHT) * 100}%`;
    }
    root.dataset['refusal'] = refusal?.key ?? '';
    root.dataset['slot'] = String(target?.slot ?? hotbar.selected);
    root.dataset['item'] = hotbar.slots[target?.slot ?? hotbar.selected] ?? '';
    root.dataset['target'] = target === null ? '' : `${target.tile.tx},${target.tile.ty}`;
    root.dataset['reach'] = target === null ? '' : target.inReach ? 'in' : 'out';
    root.dataset['tileCommands'] = String(session.tileCommands);
    root.dataset['aim'] = p.aim === null ? '' : String(target?.aimDir ?? '');
    root.dataset['steererState'] = view.steerer?.state ?? '';
    root.dataset['steererMask'] = String(view.water['P_STEERER']?.wade?.mask ?? 0);
    root.dataset['hildMask'] = String(view.water['C_HILD']?.wade?.mask ?? 0);
    root.dataset['hildPose'] = onFoot.actors['C_HILD']?.pose ?? '';
    root.dataset['hildPx'] = onFoot.actors['C_HILD']?.x.toFixed(1) ?? '';
    root.dataset['hildPy'] = onFoot.actors['C_HILD']?.y.toFixed(1) ?? '';
    root.dataset['tide'] = visuals.tideLevel.toFixed(4);
    // Missiles as drawn this frame (frame@x,y on screen), for the browser tests.
    const drawnMissiles = scene.sprites.filter(
      (sp) => sp.sheet === MISSILE_SHEET && !sp.frame.startsWith('shadow/'),
    );
    root.dataset['missiles'] = drawnMissiles
      .filter((sp) => /^(arrow|spear)\//.test(sp.frame))
      .map((sp) => `${sp.frame}@${Math.round(sp.x)},${Math.round(sp.y)}`)
      .join(';');
    root.dataset['stuck'] = String(onFoot.stuck.length);
    root.dataset['stuckDrawn'] = String(
      drawnMissiles.length -
        (root.dataset['missiles'] === '' ? 0 : root.dataset['missiles'].split(';').length),
    );
    root.dataset['arrows'] = String(sim.state.player.inventory['ITEM_ARROW'] ?? 0);
    root.dataset['hotbar'] = hotbar.slots.map((x) => x ?? '').join(',');
    root.dataset['items'] = onFoot.items.map((i) => i.key).join(',');
    root.dataset['aimHeld'] = p.aim === null ? '' : String(sim.state.tick - p.aim.since);
    // Stage 9, for the browser tests and captures: the fight, each fighter
    // (id:state:vitality:x:y:ticks to a strike's active frames, -1 for none), the saves.
    const battle = onFoot.battle;
    root.dataset['battle'] =
      battle == null ? '' : battle.over ? 'over' : battle.engaged ? 'engaged' : 'waiting';
    root.dataset['fighters'] = Object.entries(onFoot.actors)
      .flatMap(([id, a]) =>
        a.fight === undefined
          ? []
          : [
              `${id}:${a.fight.f.state}:${Math.round(a.fight.vitality)}:${Math.round(a.x)}:${Math.round(a.y)}:${striking(a.fight.f) && sim.state.tick < a.fight.f.activeAt ? a.fight.f.activeAt - sim.state.tick : -1}`,
            ],
      )
      .join(',');
    root.dataset['steererFight'] = p.fight?.state ?? '';
    root.dataset['vitality'] = String(Math.round(sim.state.player.vitality));
    root.dataset['saves'] = saves
      .headers()
      .map((h) => `${h.kind}:${h.label ?? h.reason ?? ''}:${h.day}`)
      .join(',');
    root.dataset['gore'] = String(display.gore);
    root.dataset['music'] = audio?.director.state ?? '';
    if (frames < 3) mark(`scene${frames}`);
    renderer.render(scene, buildDrawList(scene, geometry, style.cutawayFade));
    if (frames < 3) {
      mark(`frame${frames}`);
      root.dataset['startup'] = JSON.stringify(marks);
    }
    frames++;

    const tile = tileOf(map, onFoot.player.x, onFoot.player.y);
    root.dataset['tick'] = String(sim.state.tick);
    // Stage 7, for the browser tests and captures.
    root.dataset['zone'] = map.zone;
    root.dataset['day'] = String(sim.state.calendar.day);
    root.dataset['clock'] = clockText(sim.state.calendar.minuteOfDay);
    root.dataset['light'] = light;
    root.dataset['staminaMax'] = st.max.toFixed(1);
    root.dataset['staminaNow'] = st.current.toFixed(1);
    root.dataset['reasons'] = st.reasons.map((r) => `${r.reason}:${r.amount}`).join(',');
    root.dataset['work'] = work?.task ?? '';
    root.dataset['workLoop'] = work == null ? '' : (loops[work.task] ?? '');
    // The timing ring over the work: only a timed task's (decision PT-1).
    root.dataset['timingRing'] = String(work != null && workCue?.mark != null);
    root.dataset['driftwood'] =
      campDef === null
        ? ''
        : driftwoodPieces(sim.state, { def: campDef }, map.zone).length.toString();
    root.dataset['sleeping'] = String(sleeping != null);
    root.dataset['report'] = reportOpen ? (reportShown ?? []).join('|') : '';
    const homeNow = campDef === null ? undefined : sim.state.homes[campDef.home];
    root.dataset['fire'] = homeNow?.fire.lit === true ? 'lit' : 'out';
    root.dataset['stage'] = homeNow?.stage ?? '';
    root.dataset['wood'] = (homeNow?.stores['RES_DRIFTWOOD'] ?? 0).toFixed(2);
    root.dataset['pools'] = String(scene.pools.length);
    root.dataset['hildState'] = ((): string => {
      const a = onFoot.actors['C_HILD'];
      if (a === undefined) return '';
      return a.pose === 'work' ? `work:${loops[a.task ?? ''] ?? ''}` : a.pose;
    })();
    root.dataset['steererFrame'] = scene.sprites.find((sp) => sp.focus === true)?.frame ?? '';
    root.dataset['x'] = String(tile.tx);
    root.dataset['y'] = String(tile.ty);
    root.dataset['px'] = onFoot.player.x.toFixed(1);
    root.dataset['py'] = onFoot.player.y.toFixed(1);
    root.dataset['gait'] = onFoot.player.gait;
    root.dataset['moving'] = String(onFoot.player.moving);
    root.dataset['carrying'] = onFoot.carrying ?? '';
    root.dataset['hild'] = onFoot.actors['C_HILD']?.pose ?? '';
    root.dataset['prompt'] = notice === null ? promptKind : 'notice';
    root.dataset['beat'] = beat;
    root.dataset['menu'] = open ?? '';
    root.dataset['body'] = sim.state.player.bodyModel ?? '';
    root.dataset['steerer'] = sim.state.player.name;
    root.dataset['motion'] = display.reducedMotion ? 'reduced' : 'full';
    root.dataset['detail'] = String(visuals.detail);
    root.dataset['seconds'] = visuals.seconds.toFixed(2);
    // Stage 8: the conversation or scene under way, and the household at a glance.
    renderTalk(device === 'mouse');
    const peopleCtx = land.people ?? null;
    const hildAct =
      peopleCtx === null || campCtx === null || sim.state.people['C_HILD']?.life.joinedDay == null
        ? ''
        : activityOf(sim.state, campCtx, peopleCtx, 'C_HILD').kind;
    root.dataset['hildActivity'] = hildAct;
    const hildP = sim.state.people['C_HILD'];
    root.dataset['hildFeel'] =
      hildP === undefined
        ? ''
        : `${hildP.happiness.toFixed(1)},${hildP.friendship.toFixed(1)},${hildP.fear.toFixed(1)}`;
    root.dataset['residents'] = sim.state.household.residents.join(',');
    // Stage 10: the three searches as facts (tests), and whether the Hag's Seat stone weeps.
    root.dataset['searches'] = [
      FACT_ODDI,
      FACT_BRAN,
      FACT_RUNA,
      FACT_CHEST,
      FACT_WRECKERS,
      FACT_BODY,
    ]
      .map((f) => `${f}=${String(sim.state.facts[f] ?? '')}`)
      .join('|');
    root.dataset['stone'] = stoneWeeps(sim.state) ? 'wet' : 'dry';
    // Stage 11: the boat's repairs and fitting, how the oar was come by, and the rites.
    const boat = boatOf(sim.state);
    root.dataset['repairs'] =
      boat === null
        ? ''
        : [
            ...Object.entries(boat.repairs).map(([k, r]) => `${k}=${r.stage}`),
            `FIT=${Object.values(boat.fittings)
              .filter((f) => f !== null)
              .join('+')}`,
            `OAR=${String(sim.state.facts['repair.oar'] ?? '')}`,
            `RITES=${String(sim.state.facts['ch1.rites'] ?? '')}`,
          ].join('|');
    root.dataset['boat'] = boatLayers(sim.state)
      .map((l) => l.frame.split('/')[0] ?? '')
      .join('+');
    root.dataset['barks'] = String(barksHeard);
    root.dataset['scene'] = String(sim.state.facts['scene.beat_1_oddi_theft'] ?? '');
    canvas.setAttribute(
      'aria-label',
      t('ui.play.label', { time: clockText(sim.state.calendar.minuteOfDay) }),
    );
    overlay.fit(presenter.viewport, window.devicePixelRatio);
    // The script's share of the frame (simulation, scene, draw calls), smoothed: the Book 2
    // budget check in tests/browser/standard.spec.ts reads it.
    frameMs = frameMs * 0.95 + (performance.now() - workStart) * 0.05;
    root.dataset['frameMs'] = frameMs.toFixed(2);
    if (!manual) requestAnimationFrame(frame);
  };
  // Capture mode (?capture, for npm run capture): the page does not run by itself; the capture
  // tool advances it one frame of a fixed length at a time, so every captured frame is exact.
  const manual = new URLSearchParams(window.location.search).has('capture');
  if (manual) {
    let clock = performance.now();
    (window as unknown as { oeStep: (ms: number) => void }).oeStep = (ms: number) => {
      clock += ms;
      frame(clock);
    };
    frame(clock);
  } else requestAnimationFrame(frame);
  canvas.dataset['state'] = 'play';
}

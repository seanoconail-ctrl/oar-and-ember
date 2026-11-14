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
import { voiceOf } from '../audio/synth/voice.ts';
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
import { CombatFx } from './combatFx.ts';
import { ZONE_PLACE_KEYS } from '../persist/save.ts';
import { contentNameKeys, displayName } from '../content/names.ts';
import type { NameBook } from '../content/names.ts';
import { saveFor } from '../persist/checkpoints.ts';
import { bakeElevation } from '../render/elevation.ts';
import type { Elevation } from '../render/elevation.ts';
import { createSceneRenderer } from '../render/glRenderer.ts';
import type { SceneRenderer } from '../render/glRenderer.ts';
import type { Palette } from '../render/palette.ts';
import type { Presenter } from '../render/presenter.ts';
import { buildDrawPlan, parseRenderStyle, withSprites } from '../render/scene.ts';
import { gustAt, STRAND_WIND } from '../render/wind.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport.ts';
import { clockText, seasonOf, tideAt } from '../sim/calendar/calendar.ts';
import { landContext } from '../sim/land/context.ts';
import { interactionNow, TICKS_PER_SECOND } from '../sim/land/onFoot.ts';
import { parseStartingWeapons } from '../content/balance.ts';
import type { Id } from '../core/ids.ts';
import { steererOwns, withOwned } from './people.ts';
import type { PeopleLook } from './people.ts';
import { helpLines, tipText } from './tips.ts';
import type { TipContext } from './tips.ts';
import { MISSILE_SHEET } from './zoneScene.ts';
import { tileOf } from '../sim/land/zoneMap.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import { campUseNear, driftwoodPieces, isTimed, leanToUp, shelterStage } from '../sim/home/camp.ts';
import { seaBurialActive } from '../sim/narrative/seaBurial.ts';
import { boatDrawing, boatLayers, repairProps } from './repairsScene.ts';
import { findActor } from '../sim/land/zoneLinks.ts';
import { boatOf } from '../sim/narrative/repairs.ts';
import { staminaView } from '../sim/home/stamina.ts';
import { FACT_HILD_SAFE } from '../sim/narrative/opening.ts';
import { createSimulation } from '../sim/simulation.ts';
import { striking } from '../sim/combat/fighter.ts';
import { parseAiBalance, parseCombatBalance } from '../content/combatBalance.ts';
import { finishOffer, hostilesAware } from '../sim/land/fight.ts';
import { STRIKES as STRIKING } from '../sim/combat/fighter.ts';
import { CombatTeach, promptsCovered } from './combatTeach.ts';
import type { FightContext } from '../sim/land/fight.ts';
import { attachWakingAutosave, DAY_START_SLOT } from '../persist/manager.ts';
import { browserSaves } from '../persist/browserSaves.ts';
import { parseInterfaceBalance } from '../content/interfaceBalance.ts';
import { parsePt4Balance } from '../content/pt4Balance.ts';
import { ACTIONS, rebind } from '../input/actions.ts';
import type { Binding } from '../input/actions.ts';
import { saveSettings } from '../input/settingsStore.ts';
import {
  loadInterfaceSettings,
  MIX_BUSES,
  saveInterfaceSettings,
} from '../input/interfaceSettings.ts';
import type { InterfaceSettings } from '../input/interfaceSettings.ts';
import { actionLabel, agoText, controlLabel, PAUSE_ITEMS } from '../ui/pauseMenu.ts';
import type { PauseEnv, SettingRow } from '../ui/pauseMenu.ts';
import { isFullscreen, toggleFullscreen } from '../ui/fullscreen.ts';
import { PauseMenuView } from './pauseMenuView.ts';
import { itemText, slotLines } from './pauseMenuArt.ts';
import { IntroSkipView } from './introSkip.ts';
import { SkipHold } from '../ui/introSkip.ts';
import { canvasPngBase64, FrameReadback, menuFont } from './pauseMenuView.ts';
import { makeThumbnail } from '../ui/thumbnail.ts';
import { coldOpenSeconds } from '../sim/narrative/wreck.ts';
import { DevMenu, devModeOn } from './devMenu.ts';
import type { SimEvent } from '../sim/simulation.ts';
import { newCampaign } from '../sim/world.ts';
import { createOverlay, showCaptionSlots } from '../ui/overlay.ts';
import { CaptionDirector, inFight as fightHolds } from '../ui/captions.ts';
import { auditInfo, NOTICE_REFUSALS } from '../ui/textAudit.ts';
import type { InfoClass } from '../ui/textAudit.ts';
import { PromptFade, TipLife } from '../ui/prompts.ts';
import { parseStormBalance, parseTextBalance } from '../content/presentationBalance.ts';
import { cinematicNow, CursorGate } from './cursor.ts';
import type { LoadedAtlas } from './atlases.ts';
import { homePhase, lightPhase } from './lightPhase.ts';
import type { NamingChoice } from './namingView.ts';
import { bundledLayerFiles } from './bundledLayers.ts';
import { createHud } from './hud.ts';
import type { HudView } from './hud.ts';
import { peopleLook } from './people.ts';
import { Session } from './session.ts';
import { zoneScene } from './zoneScene.ts';
import {
  coldBoat,
  coldOpenScene,
  coldStorm,
  underSail,
  seaCamera,
  seaBurialView,
  decorate,
  hagCamera,
  OpeningFx,
  openingProps,
  stagePropsNow,
} from './openingView.ts';
import { bladeOf, hagNow, interactFirst, netted, wreckPhase } from '../sim/narrative/wreck.ts';
import type { ColdStorm } from './openingView.ts';
import { firstRainDrops, swayAt } from './storm.ts';
import { heightAt } from '../content/terrain/elevation.ts';
import { stillWaterLevel } from '../sim/land/water.ts';
import type { WreckWhat } from '../sim/narrative/wreck.ts';

/** How long the swell takes to carry the fallen stores into the shallows (presentation, ms). */
const BUNDLE_DRIFT_MS = 2200;

/** The opening's sounds by what happened (content/audio.json events; Book 11 section 07). */
const WRECK_SOUNDS: Partial<Record<WreckWhat, string>> = {
  COLD_STRIKE: 'COLD_STRIKE',
  WOKE: 'COUGH',
  NET_WAVE: 'WADE_SPLASH',
  NET_CUT: 'NET_CUT',
  LOAD_DOWN: 'LOAD_DOWN',
  CHEST_HOME: 'LOAD_DOWN',
  KEY_TAKEN: 'ITEM_PICKED_UP',
  CHEST_OPENED: 'CHEST_OPEN',
  LASHING_CUT: 'LASHING_CUT',
  BUNDLE_SPLASH: 'BUNDLE_SPLASH',
  STORES_BROUGHT: 'LOAD_DOWN',
  // The shelter's stages (DG-12): the sail's cloth filling as it is lashed; the finished
  // shelter's driftwood door creaking on its first swing. The frame's and the haul's own sounds
  // play across their work loops (SHELTER_WORK).
  SHELTER_RAISED: 'SAIL_SET',
  SHELTER_FINISHED: 'DOOR_OPEN',
  RING_FOUND: 'RING_FOUND',
  HAG_HOLD: 'HAG_DRONE',
  HAG_GUST: 'HAG_GUST',
};
import type { CampScene } from './zoneScene.ts';
import { campHooks, campUseLabel, interactionPoint, reportSentences, useWins } from './camp.ts';
import { placedUsesHere } from '../sim/narrative/uses.ts';
import { findProps } from '../sim/narrative/finds.ts';
import { snatchHolds } from '../sim/narrative/story4.ts';
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
import { SeaVoyage } from './seaVoyage.ts';
import type { BodyModel, WorldState } from '../sim/world.ts';

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
  /** A saved world to play from (the title's Continue and Load, or a load across campaigns). */
  readonly load?: WorldState | null;
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
    prepared.renderer.render(scene, buildDrawPlan(scene, prepared.geometry, style.cutawayFade));
    finish();
    yield `draw${body}`;
    // Design addendum 2.5: the cold open's storm sheets, drawn once so their textures are on the
    // card before the first frame of the storm (the cold open follows the naming screen).
    if (body === 'B') {
      const storm = [
        ['ship_t1_storm', 'level/-/0'],
        ['ship_t1_storm_mast', 'level/-/0'],
        ['fx_storm', 'crest/-/0'],
        ['fx_storm_drops', 'rain/-/0'],
        ['fx_storm_mist', 'low/-/0'],
      ] as const;
      const warm = withSprites(
        scene,
        storm
          .filter(([sheet]) => prepared.geometry.has(sheet))
          .map(([sheet, frame]) => ({ sheet, frame, x: -200, y: -200, layer: 'actor' as const })),
      );
      prepared.renderer.render(warm, buildDrawPlan(warm, prepared.geometry, style.cutawayFade));
      finish();
      yield 'storm';
    }
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
  // Design addendum 2.4 (decision DE-30): a new game from the naming screen opens with the played
  // cold open and the waking; `?view=play` starts awake on the strand unless `opening=full`.
  const startParams = new URLSearchParams(window.location.search);
  const coldOpen = startParams.get('view') !== 'play' || startParams.get('opening') === 'full';
  const world =
    options.load ??
    newCampaign(options.seed, b, parsePeopleBasics(content.balance), content, choice, {
      coldOpen,
    });
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
  // reloads, the three manual slots and the day-start save, in the device's one store (the title
  // sees them too, DG-16). The first is written as the steerer wakes on the strand (decision
  // S9-20); storage that is blocked falls back to memory for the session.
  const saves = browserSaves(canvas.dataset['build'] ?? 'dev');
  if (options.load == null) saves.autosave(sim.state, 'WAKING');
  // The start of the day (DG-17): the waking in the surf on day 1 (after the cold open, below),
  // and every waking after.
  if (options.load == null && wreckPhase(sim.state) !== 'COLD_OPEN') saves.dayStart(sim.state);
  attachWakingAutosave(sim, saves);
  /** A checkpoint asked for while the simulation stepped, written once the frame's steps end. */
  let checkpointDue: string | null = null;
  const fightCtx: FightContext | null = land.fight ?? null;
  const combatB = parseCombatBalance(content.balance);
  const aiB = parseAiBalance(content.balance);
  // The user's fourth playtest (Book 10 "The steerer's death", DH-71): the collapse before the
  // game-over screen: the knees, the fall, then a still beat in silence.
  const deathB = parsePt4Balance(content.balance).death;
  const collapseTicks =
    deathB.buckleTicks +
    deathB.fallFrames * deathB.fallFrameTicks +
    Math.round(deathB.beatSeconds * TICKS_PER_SECOND);
  /** Whether the game-over screen shows yet: the collapse first (DH-71). */
  const gameOverShown = (): boolean => {
    const over = sim.state.gameOver;
    return over !== null && sim.state.tick - over.tick >= collapseTicks;
  };
  /** The game-over sting is played once, as the screen comes (DH-71). */
  let gameOverStung = -1;
  /** Combat v2 (decision DE-12): an autosave on reaching camp, written once the frame's steps end. */
  let autosaveDue: 'CAMP' | 'DEPARTURE' | 'LANDING' | null = null;
  const steererVitality = parsePeopleBasics(content.balance).vitality;

  let settings = loadSettings(browserStorage());
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
      // Keys do nothing until the collapse has played and the screen has come (DH-71).
      if (!gameOverShown()) return;
      if (e.code === 'Enter' || keyCodes('interact').includes(e.code)) reloadLatest();
      else if (e.code === 'KeyN') window.location.reload();
      return;
    }
    // Stage 12: the launch's sea map closes with interact or Enter (as with Escape); the Stage 13
    // chart takes them for setting sail.
    if (mapMode === 'reveal' && (e.code === 'Enter' || keyCodes('interact').includes(e.code))) {
      session.menus.close();
      return;
    }
    if (session.menus.open !== 'system') return;
    if (e.code === 'KeyT') {
      timingsOpen = !timingsOpen;
      return;
    }
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
  // Book 10 section 25's music fades (decision DE-29).
  const fades = ((): { fadeIn: number; fadeOut: number; layersJoin: number } | null => {
    const m = land.wreck?.ob.music;
    return m === undefined
      ? null
      : {
          fadeIn: m.fadeInSeconds,
          fadeOut: m.fadeOutSeconds,
          layersJoin: (m.layersJoin[0] + m.layersJoin[1]) / 2,
        };
  })();
  const audio = audioTable === null ? null : new AudioRouter(audioTable, strings, engine, fades);
  // Design addendum 2.5 section 2 (Book 10 section 21, "On-screen text"; DF-11 to DF-13).
  const textB = parseTextBalance(content.balance);
  const stormB = parseStormBalance(content.balance);
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
    refusal = { key, text, tx, ty, until: now + textB.refusalSeconds * 1000 };
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
  // Pickup tooltips: shown once per item kind, one after another; the help page keeps them. Each
  // shows Book 10's tipHold of play or until its controls are used twice, fading (DF-12).
  let tipQueue: Id[] = [];
  let tip: { item: Id; life: TipLife } | null = null;
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
  // Never an ID on the screen (the user's fourth playtest, request 25; DH-110): a person, a load
  // carried or an item is named from its string, or as "that".
  const names: NameBook = {
    has: (key) => strings.has(key),
    t: (key, vars) => t(key, vars ?? {}),
    keys: contentNameKeys(content),
    zones: ZONE_PLACE_KEYS,
  };
  const nameOf = (id: string): string => {
    const short = `person.short.${id.toLowerCase()}`;
    if (strings.has(short)) return t(short);
    const key = world.people[id]?.nameKey;
    return key === undefined ? displayName(id, names) : t(key);
  };
  // Stage 12: the boat's name, once given, in the lines that speak of it ({ship}, Book 8).
  const line = (key: string): string =>
    t(key, { steerer: world.player.name, ship: sim.state.ships['flagship']?.name ?? '' });
  // The caption view: one information line and one speech line, never stacked (DF-11). Every
  // information line goes through the text audit by its string key (Book 8 section 10).
  const captions = new CaptionDirector(textB);
  captions.showInfo = display.infoCaptions;
  /** A speech line ("Name: words"). */
  const say = (text: string, now: number): void => {
    captions.speech(text, now / 1000);
  };
  /** An information line by its string key, as the audit says (cut lines are never shown). */
  const inform = (key: string, text: string, now: number, cls?: InfoClass): void => {
    const verdict = auditInfo(key);
    if (cls !== undefined) captions.info(text, cls, now / 1000);
    else if (verdict.show && verdict.unseenOnly !== true)
      captions.info(text, verdict.cls, now / 1000);
  };
  /** A refused job's reason, shown in the talk panel under the person's line (the audit's merge). */
  let talkNote: { text: string; line: string } | null = null;
  /** When the steerer last struck or took a blow (frame clock, ms): Book 10's inFight. */
  let lastBlowAt = -Infinity;
  /** When the mast's stores fell (frame clock, ms): drawn drifting into the shallows (DF-82). */
  let bundleFellAt = -Infinity;
  /** The rites scene under way (it takes control: the cursor hides, DF-15). */
  let ritesScene = false;
  /** Barks heard this session (Stage 8; the browser tests read it). */
  let barksHeard = 0;
  /** The keys of the latest speech lines, oldest first (the fourth playtest's tests). */
  const spokenKeys: string[] = [];
  let beat = '';
  /** Where a person is, left or right of the steerer, as a stereo pan. */
  const panOf = (person: string): number => {
    const onFoot = sim.state.onFoot;
    const actor = onFoot?.actors[person];
    if (onFoot === null || actor === undefined) return 0;
    return Math.max(-1, Math.min(1, (actor.x - onFoot.player.x) / 200));
  };
  let lastAmbienceAt = -1;
  /**
   * The user's fourth playtest (DH-63; Book 10 boatWorkSound): each resident working at the boat
   * in earshot is heard at it, the repair's adze and mallet panned to them, every boatWorkSound.
   */
  const boatHeardAt = new Map<string, number>();
  const boatWorkSounds = (): void => {
    const peopleNow = land.people ?? null;
    const every = peopleNow?.company?.b.boat.workSoundSeconds;
    if (audio === null || !engine.unlocked || peopleNow === null || every === undefined) return;
    const onFoot = sim.state.onFoot;
    if (onFoot === null || sim.state.talk !== null) return;
    for (const [id, a] of Object.entries(onFoot.actors)) {
      if (a.task !== 'TASK_REPAIR_SHIP' || (a.pose !== 'work' && a.pose !== 'kneel')) continue;
      const d = Math.hypot(a.x - onFoot.player.x, a.y - onFoot.player.y) / map.tile;
      if (d > peopleNow.b.talk.earshotTiles) continue;
      const last = boatHeardAt.get(id) ?? -Infinity;
      if (engine.now - last < every) continue;
      boatHeardAt.set(id, engine.now);
      audio.event('TASK_REPAIR', engine.now, { pan: panOf(id) });
    }
  };
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
      mapMode === 'reveal' || (phaseNow !== null && phaseNow !== 'NAMING' && phaseNow !== 'DONE');
    // The user's fourth playtest (DH-23): Thorkel's rites have their own music, from the choice to
    // the rite's end, at the rite's place and at the camp (the lament is sung over it).
    const ritesForm = sim.state.facts['rites.pending'];
    const ritesDef = content.repairs?.rites;
    const ritesMusic =
      ritesDef === undefined || (ritesForm !== 'SETTING' && ritesForm !== 'SEA')
        ? null
        : map.zone === (ritesForm === 'SEA' ? ritesDef.sea.zone : ritesDef.setting.zone) || atHome
          ? ritesForm === 'SEA'
            ? 'MUS_RITES_SEA'
            : 'MUS_RITES_STONES'
          : null;
    const want =
      sim.state.gameOver !== null
        ? null
        : launching
          ? 'MUS_LAUNCH'
          : inFight
            ? 'MUS_COMBAT_1'
            : (ritesMusic ??
              placeMusic?.want(engine.now, {
                // Design addendum 2.4: the music arrives gently with the first fire.
                allowed:
                  sim.state.facts['ch1.phase'] === undefined
                    ? sim.state.facts[FACT_HILD_SAFE] === true
                    : sim.state.facts['ch1.fire_lit'] === true,
                home: atHome,
                phase,
              }) ??
              null);
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
  // The user's fourth playtest (DH-62): the boat's work in hand drawn stage by stage.
  const drawing = content.repairs === null ? null : boatDrawing(content.balance);
  const loops: Record<string, string> = Object.fromEntries(
    Object.entries(campDef?.tasks ?? {}).map(([id, def]) => [id, def.workLoop]),
  );
  /** Whether the steerer's bed is the prompt now (its highlight edge; DH-103). */
  let bedLit = false;
  const campScene = (): CampScene | undefined => {
    if (campDef === null) return undefined;
    const home = sim.state.homes[campDef.home];
    if (home === undefined) return undefined;
    const here = map.zone === campDef.zone;
    const fireSite = campDef.sites.find((s) => s.kind === 'FIRE' && s.zone === map.zone);
    const stageAll = home.stage === 'S1' ? campDef.props.S1 : campDef.props.S0;
    // Design addendum 2.4: the lean-to only once raised; the mast, the pool, the sail, the doors.
    const stageProps = stagePropsNow(sim.state, stageAll, sim.state.tick);
    const opening =
      wreckCtx === null
        ? []
        : openingProps(
            sim.state,
            wreckCtx,
            map,
            stageAll,
            sim.state.tick,
            campDef.sites.find((s) => s.kind === 'BUILD' && s.zone === map.zone),
          );
    // Stage 11: the boat and its repairs, the wreck's rigging, the skiff, the ship of stones.
    const repairDef = content.repairs;
    const extra =
      repairDef === null
        ? []
        : repairProps(sim.state, { def: repairDef }, map.zone, content.launch, drawing);
    // The user's fourth playtest: the small finds off the paths (DH-115).
    const findsHere = land.finds == null ? [] : findProps(sim.state, land.finds, map.zone);
    // The steerer's bed takes its in-reach highlight edge while it is the prompt (DH-103).
    const marked = (here ? stageProps : []).map((pr) =>
      bedLit && pr.sheet === 'prop_bed_steerer'
        ? { ...pr, frame: pr.frame.replace(/^(s[01])\//, '$1_lit/') }
        : pr,
    );
    return {
      props: [...marked, ...extra, ...opening, ...findsHere],
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
  /** Design addendum 2.4: the journal's current aim, hints and edge captions heard (tests). */
  let journal: string | null = null;
  let hintsHeard = 0;
  let edgeCaptions = 0;
  const openingFx = new OpeningFx();
  const wreckCtx = land.wreck ?? null;
  // Design addendum 2.5 section 3: the storm of the cold open, its strikes, waves and green water
  // fixed from Book 10 and the script; swells are drawn only over the strand's open sea.
  const storm = ((): ColdStorm | null => {
    const elev = land.elevations.get(startMap.zone);
    if (wreckCtx === null || elev === undefined) return null;
    const level = stillWaterLevel(tideAt(world.calendar, b));
    return coldStorm(stormB, wreckCtx, (x, y) => heightAt(elev, x, y) < level - 0.15);
  })();
  /** The cold open's seconds at the last frame, for the storm's sounds (thunder after the flash). */
  let stormLastT = -1;
  /** Thunder heard so far: [flash at, thunder at] in cold-open seconds (tests). */
  const thunderHeard: [number, number][] = [];
  /** Capture only (`camera=still`): the cold open's view held where it starts, for the motion check. */
  const cameraStill = new URLSearchParams(window.location.search).get('camera') === 'still';
  let stillCamera: { x: number; y: number } | null = null;
  /** The fade in from dark on waking and on entering a zone (frame clock, ms). */
  let fadeInFrom = -1;
  let workCue: { since: number; ticks: number; mark: number | null } | null = null;
  /** Stage 9: a crew order's icon over the one who took it, for a moment (frame clock). */
  const ordersShown: Record<string, { order: string; until: number }> = {};
  /** A pan for a point in the world, left or right of the steerer. */
  const panAt = (x: number): number =>
    Math.max(-1, Math.min(1, (x - (sim.state.onFoot?.player.x ?? x)) / 200));
  /** Combat v2's presentation: hit reactions, marks, the enemy's bar, the bars' fade. */
  const combatFx = new CombatFx(combatB.bars, aiB.awareness.markAlertTicks);
  /** A fight sound by its event, from where the person is (Book 11 section 07). */
  const fightSound = (event: string, person: string | undefined, delay = 0): void => {
    if (audio === null || !engine.unlocked) return;
    // A person's wordless sounds at their own pitch (voice.ts): the grunt.
    const voice = person === undefined ? undefined : voiceOf(person)?.pitch;
    audio.event(event, engine.now + delay, {
      pan: person === undefined || person === 'P_STEERER' ? 0 : panOf(person),
      ...(voice === undefined ? {} : { voice }),
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
  // ------------------------------------------------------------------------- the pause menu
  // The user's third playtest (Book 2 sections 02, 20 and 21; decisions DG-15 to DG-18).
  const uiB = parseInterfaceBalance(content.balance);
  let iface: InterfaceSettings = loadInterfaceSettings(store);
  engine.setMix(
    Object.fromEntries(MIX_BUSES.map((bus) => [bus, iface.mix[bus] / 100])),
    iface.mono,
  );
  const setIface = (next: InterfaceSettings): void => {
    iface = next;
    saveInterfaceSettings(store, iface);
    engine.setMix(
      Object.fromEntries(MIX_BUSES.map((bus) => [bus, iface.mix[bus] / 100])),
      iface.mono,
    );
  };
  /** Options chosen while the menu holds time, not yet applied (the first tick applies them). */
  let pendingOptions: { secondWind?: boolean; ransMercy?: boolean } = {};
  const optionNow = (id: 'secondWind' | 'ransMercy'): boolean =>
    pendingOptions[id] ?? sim.state.options[id];
  const onOff = (on: boolean): Record<string, string> => ({
    state: t(on ? 'ui.settings.on' : 'ui.settings.off'),
  });
  const pauseSettings = (): SettingRow[] => [
    {
      id: 'motion',
      group: 'display',
      textKey: 'ui.settings.motion',
      vars: onOff(display.reducedMotion),
    },
    {
      id: 'info',
      group: 'display',
      textKey: 'ui.settings.info',
      vars: onOff(display.infoCaptions),
    },
    {
      id: 'gore',
      group: 'display',
      textKey: 'ui.settings.gore',
      vars: { level: t(`ui.gore.${['off', 'low', 'full'][display.gore] ?? 'full'}`) },
    },
    { id: 'marks', group: 'display', textKey: 'ui.settings.marks', vars: onOff(display.marks) },
    // The user's third playtest (Book 10 promptOption; DG-7): combat prompts first fights, always, off.
    {
      id: 'prompts',
      group: 'display',
      textKey: `ui.settings.prompts_${(display.combatPrompts ?? 'FIRST').toLowerCase()}`,
    },
    ...MIX_BUSES.map((bus): SettingRow => ({
      id: `mix.${bus}`,
      group: 'audio',
      textKey: `ui.settings.${bus}`,
      vars: { level: `${iface.mix[bus]}%` },
    })),
    { id: 'mono', group: 'audio', textKey: 'ui.settings.mono', vars: onOff(iface.mono) },
    {
      id: 'secondWind',
      group: 'gameplay',
      textKey: 'ui.settings.second_wind',
      vars: onOff(optionNow('secondWind')),
    },
    {
      id: 'ransMercy',
      group: 'gameplay',
      textKey: 'ui.settings.rans_mercy',
      vars: onOff(optionNow('ransMercy')),
    },
    { id: 'timings', group: 'gameplay', textKey: 'ui.settings.timings', vars: onOff(timingsOpen) },
    {
      id: 'intro',
      group: 'intro',
      textKey: iface.introSkip ? 'ui.settings.intro_skip' : 'ui.settings.intro_play',
    },
  ];
  const applySetting = (id: string, dir: 1 | -1): void => {
    if (id === 'motion') {
      display = { ...display, reducedMotion: !display.reducedMotion };
      visuals.reducedMotion = display.reducedMotion;
    } else if (id === 'info') display = { ...display, infoCaptions: !display.infoCaptions };
    else if (id === 'marks') display = { ...display, marks: !display.marks };
    else if (id === 'prompts') {
      const order = ['FIRST', 'ALWAYS', 'OFF'] as const;
      const at = order.indexOf(display.combatPrompts ?? 'FIRST');
      display = { ...display, combatPrompts: order[(at + (dir > 0 ? 1 : 2)) % 3] ?? 'FIRST' };
    } else if (id === 'gore') {
      const gore = ((display.gore + (dir > 0 ? 2 : 1)) % 3) as 0 | 1 | 2;
      display = { ...display, gore };
      visuals.gore = gore;
      engine.setGore(gore);
    } else if (id.startsWith('mix.')) {
      const bus = id.slice(4) as (typeof MIX_BUSES)[number];
      const now = iface.mix[bus];
      const next = Math.max(0, Math.min(100, now + dir * 10));
      setIface({ ...iface, mix: { ...iface.mix, [bus]: next } });
      return;
    } else if (id === 'mono') {
      setIface({ ...iface, mono: !iface.mono });
      return;
    } else if (id === 'intro') {
      setIface({ ...iface, introSkip: !iface.introSkip });
      return;
    } else if (id === 'timings') {
      timingsOpen = !timingsOpen;
      return;
    } else if (id === 'secondWind' || id === 'ransMercy') {
      // The campaign's options are world state: changed only while the menu holds time.
      if (!session.menus.timeStopped) {
        pauseView.model.note = { key: 'ui.settings.locked', refused: true };
        return;
      }
      // Sent now, applied on the first tick after the menu lets time run (a pause runs no tick);
      // the row shows the choice made meanwhile.
      const next = !optionNow(id);
      pendingOptions = { ...pendingOptions, [id]: next };
      sim.submit(
        id === 'secondWind'
          ? { type: 'SET_OPTIONS', secondWind: next }
          : { type: 'SET_OPTIONS', ransMercy: next },
      );
      return;
    }
    saveDisplaySettings(store, display);
  };
  /** The controls page: every action, its keys and mouse, its pad (Book 2 section 21). */
  let remapping: (typeof ACTIONS)[number] | null = null;
  let remapNote = '';
  const controlRows = (): {
    rows: { name: string; keys: string; pad: string }[];
    note: string;
  } => ({
    rows: ACTIONS.map((a) => {
      const l = actionLabel(a);
      const list = settings.bindings[a];
      const keysOf = list
        .filter((x) => x.device === 'key' || x.device === 'mouse' || x.device === 'wheel')
        .map(controlLabel);
      const padOf = list.filter((x) => x.device === 'pad' || x.device === 'axis').map(controlLabel);
      return {
        name: t(l.key, l.vars),
        keys: keysOf.length === 0 ? t('ui.controls.none') : keysOf.join(', '),
        pad: padOf.length === 0 ? t('ui.controls.none') : padOf.join(', '),
      };
    }),
    note:
      remapping !== null
        ? t('ui.controls.press', {
            action: t(actionLabel(remapping).key, actionLabel(remapping).vars),
          })
        : remapNote !== ''
          ? remapNote
          : t('ui.controls.change', { key: 'H' }),
  });
  const bindNow = (binding: Binding): void => {
    const action = remapping;
    remapping = null;
    if (action === null) return;
    const { bindings, displaced } = rebind(settings.bindings, action, binding);
    settings = { ...settings, bindings };
    input.setBindings(bindings);
    saveSettings(browserStorage(), settings);
    remapNote = displaced
      .map((a) => t('ui.controls.moved', { action: t(actionLabel(a).key, actionLabel(a).vars) }))
      .join(' ');
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (remapping === null) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') remapping = null;
      else bindNow({ device: 'key', code: e.code });
    },
    { capture: true },
  );
  window.addEventListener(
    'mousedown',
    (e) => {
      if (remapping === null) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      bindNow({ device: 'mouse', button: e.button });
    },
    { capture: true },
  );
  /** Seconds since the newest save (any kind), for the confirmations. */
  const lastSavedSeconds = (): number => {
    const newest = saves.headers().at(-1);
    const at = newest === undefined ? NaN : Date.parse(newest.savedAt);
    return Number.isFinite(at) ? Math.max(0, (Date.now() - at) / 1000) : 0;
  };
  const pauseEnv = (): PauseEnv => ({
    safe: hostilesAware(sim.state.onFoot) === 0,
    fullscreen: isFullscreen(document),
    slots: saves.slotViews(uiB.menu.saveSlots, Date.now()),
    hasDayStart: saves.dayStartHeader() !== null,
    lastSavedAgo: agoText(lastSavedSeconds(), t),
    settings: pauseSettings(),
    controlRows: ACTIONS.length,
  });
  /** Loads a slot into this game (a save of another campaign's steerer reloads the page with it). */
  const loadSlot = (slot: string): void => {
    let loaded: ReturnType<typeof saves.load>;
    try {
      loaded = saves.load(slot, { context: { balance: content.balance } });
    } catch {
      pauseView.model.note = { key: 'ui.save.failed', refused: true };
      return;
    }
    const was = sim.state.player;
    if (loaded.state.player.bodyModel !== was.bodyModel || loaded.state.player.name !== was.name) {
      const url = new URL(window.location.href);
      url.search = `?load=${encodeURIComponent(slot)}`;
      window.location.href = url.toString();
      return;
    }
    session.menus.close();
    sim.restore(loaded.state);
    restored = true;
    lookOwns = null;
    captions.clear();
    fadeInFrom = frameNow;
  };
  const pauseView = new PauseMenuView(document, {
    palette,
    t: (key, vars) => t(key, { ...vars }),
    ago: (seconds) => agoText(seconds, t),
    env: pauseEnv,
    controls: controlRows,
    thumbnail: uiB.menu.thumbnail,
    thumbnailBytes: uiB.menu.thumbnailBytes,
    click: () => {
      engine.click();
    },
    close: () => {
      session.menus.close();
    },
    remap: (row) => {
      remapping = ACTIONS[row] ?? null;
      remapNote = '';
    },
    act: (action, thumbnail) => {
      switch (action.kind) {
        case 'save': {
          const safety = { awareHostiles: hostilesAware(sim.state.onFoot) };
          const result = saves.manualSave(
            sim.state,
            `manual-${action.slot}`,
            safety,
            thumbnail ?? undefined,
          );
          pauseView.model.saved(result.ok, !result.ok && result.reason === 'NOT_SAFE');
          return;
        }
        case 'load':
          loadSlot(action.storeSlot);
          return;
        case 'resetDay':
          loadSlot(DAY_START_SLOT);
          return;
        case 'quit':
          window.location.href = window.location.pathname;
          return;
        case 'fullscreen':
          void toggleFullscreen(document).then((on) => {
            setIface({ ...iface, fullscreen: on });
          });
          return;
        case 'setting':
          applySetting(action.id, action.dir);
          return;
        default:
          return;
      }
    },
  });
  session.systemBack = () => pauseView.systemBack();
  // WebKit: Escape leaves fullscreen rather than reaching the page; leaving it in play opens the
  // pause menu (DG-18). In Chromium the key is locked and opens the menu itself.
  let wasFullscreen = isFullscreen(document);
  document.addEventListener('fullscreenchange', () => {
    const now = isFullscreen(document);
    if (wasFullscreen && !now && session.menus.open === null && sim.state.gameOver === null)
      session.menus.request('system');
    wasFullscreen = now;
  });
  /** Whether the menu held time last frame (the pause duck follows it). */
  let ducked = false;
  // --------------------------------------------------------------------- skipping the intro
  // DG-19: once seen, holding any key or button for skipHold, or the Skip button, runs the cold
  // open unseen to its end: the world is exactly as after it (it writes nothing the waking needs).
  /** True while the cold open is run unseen: its sounds, shakes and lines are not presented. */
  let fastForward = false;
  const skipHold = new SkipHold({
    holdSeconds: uiB.intro.skipHoldSeconds,
    showSeconds: uiB.intro.skipShowSeconds,
    fadeSeconds: uiB.intro.skipFadeSeconds,
  });
  let skipClicked = false;
  const skipView = new IntroSkipView(
    document,
    { palette, font: menuFont(palette) },
    { skip: t('ui.intro.skip'), hold: t('ui.intro.hold') },
    () => {
      skipClicked = true;
    },
  );
  const keysDown = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (!e.repeat) keysDown.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
  });
  window.addEventListener('blur', () => {
    keysDown.clear();
  });
  let anyHeldBefore = false;
  const skipColdOpen = (): void => {
    if (wreckPhase(sim.state) !== 'COLD_OPEN') return;
    fastForward = true;
    try {
      // The oar let go, as when nothing is held; then the cold open's remaining ticks.
      sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
      for (let i = 0; i < 1_000_000 && wreckPhase(sim.state) === 'COLD_OPEN'; i++) sim.step();
    } finally {
      fastForward = false;
    }
    saves.dayStart(sim.state);
    fadeInFrom = frameNow;
  };
  // ------------------------------------------------------------------- the developer menu
  // DG-21: a debug build or `?dev` only; never built otherwise. F3 is its key there (DG-22).
  const devOn = devModeOn(window.location.search, import.meta.env.DEV);
  if (devOn) {
    const quick3 = settings.bindings.quick3.filter((x) => !(x.device === 'key' && x.code === 'F3'));
    settings = { ...settings, bindings: { ...settings.bindings, quick3 } };
    input.setBindings(settings.bindings);
  }
  const dev = !devOn
    ? null
    : new DevMenu(document, {
        t: (key, vars) => t(key, vars ?? {}),
        submit: (command) => {
          sim.submit(command);
        },
        worldAt: (clientX, clientY) => {
          const r = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio;
          const vp = presenter.viewport;
          const lx = ((clientX - r.left) * dpr - vp.x) / vp.scale;
          const ly = ((clientY - r.top) * dpr - vp.y) / vp.scale;
          if (lx < 0 || ly < 0 || lx >= LOGICAL_WIDTH || ly >= LOGICAL_HEIGHT) return null;
          return { x: viewCamera.x + lx, y: viewCamera.y + ly };
        },
        enemyAt: (x, y) => {
          let best: string | null = null;
          let bestD = 1.5 * map.tile;
          for (const [id, a] of Object.entries(sim.state.onFoot?.actors ?? {})) {
            if (a.fight?.side !== 'ENEMY' || a.fight.dead !== null) continue;
            const d = Math.hypot(a.x - x, a.y - 14 - y);
            if (d < bestD) {
              bestD = d;
              best = id;
            }
          }
          return best;
        },
        tileSize: () => map.tile,
        skipMinutes: uiB.dev.skipHours * 60,
        teleportTiles: uiB.dev.teleportTiles,
        fpsSeconds: uiB.dev.fpsSeconds,
      });
  /** The chapter's figures when it ended (played seconds and the first fight's). */
  let chapterEnd: { played: number; fight: number | null } | null = null;
  const words: PanelWords = {
    t: (key, vars) => t(key, vars ?? {}),
    person: (id) => nameOf(id),
    item: (id) => {
      const def = itemOf(id);
      return def === undefined ? displayName(id, names) : t(def.nameKey);
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
  // Stage 13: the sea map's plotting and voyage screen (src/scenes/seaVoyage.ts), drawn in place
  // of the scene while it is up; the on-foot view pays one check a frame for it.
  const seaCtx = land.sea ?? null;
  const sea =
    seaCtx === null
      ? null
      : new SeaVoyage(
          {
            doc: document,
            sim,
            land,
            content,
            atlases,
            region: () => overlay.region('seamap'),
            root,
            t: (key, vars) => t(key, vars ?? {}),
            interactKey: () => keys('interact'),
            menus: session.menus,
            reduced: () => display.reducedMotion,
            devOpen: () => dev?.open === true,
            devMode: devOn,
            autosave: (reason) => {
              autosaveDue = reason;
            },
            present: (rgba) => {
              presenter.present(rgba);
            },
            sound:
              audio === null
                ? null
                : {
                    now: () => engine.now,
                    play: (cue, now) => {
                      if (engine.unlocked) audio.play(cue, now);
                    },
                    silence: (now) => {
                      audio.silence(now);
                    },
                    setSea: (bed) => {
                      engine.setSea(bed);
                    },
                    event: (name, now) => {
                      if (engine.unlocked) audio.event(name, now);
                    },
                  },
          },
          seaCtx,
        );
  let seaUp = false;
  /** The token's state for the household's mark (Book 7 section 05: a sail in its colours). */
  const markState = (): string =>
    (sim.state.ships['flagship']?.marks.sail ?? 'plain').replace(':', '_');
  /** The user's third playtest's combat presentation (src/scenes/combatTeach.ts), made below. */
  let teach: CombatTeach | null = null;
  /** The tick the steerer last let a foe go: the gesture is drawn from it (DG-4). */
  let spareTick: number | null = null;
  const onEvent = (e: SimEvent): void => {
    // The cold open run unseen (DG-19): nothing of it is shown or heard.
    if (fastForward) return;
    const now = frameNow;
    // The user's third playtest: the combat prompts, the let-go lines and their sounds (DG-2 to DG-11).
    teach?.event(e, now, sim.state, display.combatPrompts ?? 'FIRST', fightCtx);
    if (e.type === 'STEERER_SHOUTED') spareTick = sim.state.tick;
    if (e.type === 'GUARD_TURNED') {
      const a = sim.state.onFoot?.actors[e.who];
      if (a !== undefined) combatFx.guardTurn(a.x, a.y, sim.state.tick);
    }
    switch (e.type) {
      case 'PERSON_CALLED': {
        // Direction class: the caller and where from; the words are the speech line.
        const own = `caption.voice.${e.person.slice(2).toLowerCase()}_calling`;
        const key = has(own) ? own : 'caption.voice.hild_calling';
        inform(
          key,
          t('caption.format.with_direction', {
            caption: t(key),
            direction: t(`caption.direction.${e.direction}`),
          }),
          now,
        );
        say(
          t('caption.format.subtitle', { speaker: nameOf(e.person), line: line(e.lineKey) }),
          now,
        );
        // Her call in voice blips, from the side she calls from (Book 11 section 08).
        engine.voice(e.person, line(e.lineKey), panOf(e.person));
        return;
      }
      case 'PERSON_SPOKE':
        spokenKeys.push(e.lineKey);
        if (spokenKeys.length > 40) spokenKeys.shift();
        say(
          t('caption.format.subtitle', { speaker: nameOf(e.person), line: line(e.lineKey) }),
          now,
        );
        engine.voice(e.person, line(e.lineKey), panOf(e.person));
        if (e.bark !== undefined) barksHeard++;
        return;
      case 'TALK_INFO':
        // In talk it stays in the talk panel (the audit); a scene's line likewise.
        if (sim.state.talk === null) inform(e.key, t(e.key), now);
        return;
      case 'SEARCH_INFO':
        inform(e.key, t(e.key), now);
        return;
      // Stage 10: a checkpoint before a search's danger (Book 2 section 20).
      case 'CHECKPOINT':
        checkpointDue = e.label;
        return;
      case 'RESIDENT_APPROACHED':
        // Cut (the audit): the person is seen walking up, and speaks on arrival.
        return;
      case 'RITES_BEGAN':
        ritesScene = true;
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        return;
      case 'DISPUTE_RAISED':
      case 'JUDGEMENT_GIVEN':
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        return;
      case 'JOB_REFUSED':
        // Merged into the person's reply in the talk panel (the audit).
        talkNote = {
          text: t(`ui.reason.${e.reason.toLowerCase()}`, { name: nameOf(e.person) }),
          line: sim.state.talk?.line?.key ?? '',
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
        // The prompt line's notices, merged into refusal words at the cursor (the audit).
        if (e.reason === 'BELOW_TIDE_LINE' || e.reason === 'NO_ROOM') {
          const key = NOTICE_REFUSALS[e.reason] ?? 'ui.refusal.nothing_there';
          refuse(e.reason.toLowerCase(), t(key), lastTarget.tx, lastTarget.ty, now);
        }
        return;
      case 'BOW_DRAWN':
      case 'BOW_LOOSED':
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        // The bow's (and the arrows') tooltip counts its controls used (Book 10 tipHold).
        if (e.type === 'BOW_LOOSED' && (tip?.item === 'ITEM_BOW' || tip?.item === 'ITEM_ARROW'))
          tip.life.used();
        return;
      case 'MISSILE_LOOSED': {
        if (audio !== null && engine.unlocked)
          audio.event(e.kind === 'spear' ? 'SPEAR_THROWN' : 'ARROW_FLIGHT', engine.now + 0.05, {
            pan: panOf(e.shooter),
          });
        // A safety line: an arrow from a shooter out of sight, with its direction (the audit).
        const shooter = sim.state.onFoot?.actors[e.shooter];
        const pl = sim.state.onFoot?.player;
        if (e.shooter !== 'P_STEERER' && shooter !== undefined && pl !== undefined) {
          const sx = shooter.x - viewCamera.x;
          const sy = shooter.y - viewCamera.y;
          if (sx < 0 || sy < 0 || sx > LOGICAL_WIDTH || sy > LOGICAL_HEIGHT) {
            const ang = Math.atan2(shooter.y - pl.y, shooter.x - pl.x);
            const dirs = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
            const dir = dirs[(Math.round(ang / (Math.PI / 4)) + 8) % 8] ?? 'n';
            inform(
              'caption.sfx.arrow_flight',
              t('caption.format.with_direction', {
                caption: t('caption.sfx.arrow_flight'),
                direction: t(`caption.direction.${dir}`),
              }),
              now,
              'SAFETY',
            );
          }
        }
        return;
      }
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
      case 'FIND_MADE':
        // The user's fourth playtest (DH-115, DH-118): a find's sound and its story caption.
        if (audio !== null && engine.unlocked) audio.event(e.sound, engine.now, { pan: 0 });
        inform(e.captionKey, t(e.captionKey), now);
        root.dataset['found'] = e.key;
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
        // The timed task's press is done once pressed (Book 10 promptDone: "the item used once").
        timingPrompt.done();
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
      // A reason for the first raid (DH-147): the skin boat's goods set down into the stores, with
      // the load's own thump, as the ship's stores are.
      case 'GOODS_STORED':
        if (audio !== null && engine.unlocked) audio.event('LOAD_DOWN', engine.now, { pan: 0 });
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
        if (audio !== null && engine.unlocked) audio.event(e.type, engine.now, { pan: 0 });
        return;
      // Thorkel taken by the sea (DG-14): the lament's held note as the bier is borne down, the
      // wash rising wave by wave with the planks knocking, the gulp and bubbles as it sinks.
      case 'SEA_TAKEN': {
        const cue =
          e.what === 'BIER'
            ? 'SEA_LAMENT'
            : e.what === 'WAVE' && e.n === 1
              ? 'BODY_TAKEN'
              : e.what === 'SINK'
                ? 'BODY_SINK'
                : null;
        if (cue !== null && audio !== null && engine.unlocked)
          audio.event(cue, engine.now, { pan: 0 });
        return;
      }
      case 'RITES_DONE':
        ritesScene = false;
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
      case 'FIRE_LIT': {
        // The hearth theme starts at the first fire (Book 11 section 04), gently (decision DE-29);
        // sparks from the flint and the flame taking (design addendum 2.4).
        placeMusic?.begin(engine.now);
        const site = campDef?.sites.find((x) => x.kind === 'FIRE' && x.zone === map.zone);
        if (site !== undefined)
          openingFx.burst('spark', site.x * map.tile, site.y * map.tile, 10, 4);
        if (audio !== null && engine.unlocked) audio.event('FLINT', engine.now, { pan: 0 });
        // The sparks and the flame taking are seen and heard, not captioned (the audit).
        return;
      }
      // ---- Design addendum 2.4: the opening, the aims, the edges and the doors.
      case 'WRECK': {
        const at = e.x === undefined ? null : { x: e.x, y: e.y ?? 0 };
        const sound =
          e.what === 'SHELTER_WORK'
            ? e.key === 'FRAME'
              ? 'SHELTER_FRAME'
              : 'SAIL_RAISE'
            : WRECK_SOUNDS[e.what];
        if (sound !== undefined && audio !== null && engine.unlocked)
          audio.event(sound, engine.now, { pan: at === null ? 0 : panAt(at.x) });
        // The audit: the opening's actions and moments are cut; the pale light gains its
        // direction (it is seen in the west); Thorkel's shout is merged into his speech line.
        if (e.key === 'caption.hag.light')
          inform(
            e.key,
            t('caption.format.with_direction', {
              caption: t(e.key),
              direction: t('caption.direction.w'),
            }),
            now,
          );
        else if (e.key !== undefined && has(e.key)) inform(e.key, t(e.key), now);
        if (at !== null) {
          if (e.what === 'NET_CUT') openingFx.burst('fibre', at.x, at.y, 14, 18);
          if (e.what === 'LASHING_CUT') openingFx.burst('fibre', at.x, at.y + 60, 8, 60);
          if (e.what === 'NET_WAVE') openingFx.burst('spray', at.x, at.y, 9, 6);
          if (e.what === 'BUNDLE_SPLASH' && wreckCtx !== null) {
            // It falls under the lashing, and the swell carries it into the stream's mouth (DF-82).
            const l = wreckCtx.rw.mast.lashing;
            openingFx.burst('spray', l.x * map.tile, l.y * map.tile, 12, 6);
            bundleFellAt = now;
          }
          if (e.what === 'LOAD_DOWN' || e.what === 'CHEST_HOME' || e.what === 'STORES_BROUGHT')
            openingFx.burst('puff', at.x, at.y, 6);
          if (e.what === 'RING_FOUND')
            openingFx.burst('drip', at.x * map.tile, at.y * map.tile, 4, 4);
        }
        if (e.what === 'COLD_STRIKE') visuals.shake(3);
        if (e.what === 'WOKE') {
          fadeInFrom = now;
          // The start of day 1 (DG-17), and the cold open seen to its end on this device (DG-19).
          saves.dayStart(sim.state);
          if (!iface.introSeen) setIface({ ...iface, introSeen: true });
        }
        return;
      }
      case 'AIM_CHANGED':
        journal = e.journalKey;
        return;
      case 'AIM_HINT':
        hintsHeard++;
        return;
      case 'EDGE_CAPTION': {
        // The user's fourth playtest (DH-36): "Nothing that way" names a real, open way.
        const way = e.way;
        const text =
          way === undefined
            ? t(e.key)
            : t('caption.edge.nothing_way', {
                way: t('caption.edge.way', {
                  place: t(`caption.edge.place.${way.to.toLowerCase()}`),
                  direction: t(`caption.direction.${way.direction}`),
                }),
              });
        inform(e.key, text, now);
        edgeCaptions++;
        return;
      }
      // The user's fourth playtest (DH-24): the steerer's word over a body, under the steerer's
      // name with a breath out and no blip (Book 11 section 08).
      case 'STEERER_SPOKE':
        say(
          t('caption.format.subtitle', { speaker: sim.state.player.name, line: line(e.lineKey) }),
          now,
        );
        if (audio !== null && engine.unlocked)
          audio.event('STEERER_REMARK', engine.now, { pan: 0 });
        return;
      // The strongbox taken in sight (DH-13): the box hauled up by its handles, panned to him.
      case 'SNATCH':
        if (e.what === 'GRABBED' && audio !== null && engine.unlocked)
          audio.event('SNATCH', engine.now, { pan: panAt(e.x) });
        return;
      case 'DOOR': {
        if (e.what === 'OPENING') {
          // The door is seen and heard opening: no caption (the audit).
          if (audio !== null && engine.unlocked)
            audio.event(e.kind === 'FLAP' ? 'FLAP_OPEN' : 'DOOR_OPEN', engine.now, {
              pan: panAt(e.x),
            });
        } else if (e.what === 'SHUT' && audio !== null && engine.unlocked)
          audio.event(e.kind === 'FLAP' ? 'FLAP_OPEN' : 'DOOR_SHUT', engine.now, {
            pan: panAt(e.x),
          });
        return;
      }
      // ---- Stage 9: the fight's sounds, sprays and words (Book 11 section 07, Book 7 section 12).
      case 'ENCOUNTER_STARTED':
        checkpointDue = e.checkpoint;
        return;
      case 'CHARGE_LEVEL':
        fightSound(e.level === 1 ? 'CHARGE_LEVEL_1' : 'HEAVY_CHARGE_LEVEL_2', e.who);
        return;
      case 'SWING':
        fightSound(e.heavy ? 'SWING_HEAVY' : 'SWING_LIGHT', e.who);
        if (e.who === 'P_STEERER') {
          lastBlowAt = now;
          if (
            tip !== null &&
            tip.item === sim.state.player.hotbar.slots[sim.state.player.hotbar.selected]
          )
            tip.life.used();
        }
        return;
      case 'BLOW': {
        const who = e.defender;
        // Combat v2 (decision DE-7): the hit's reactions, its shake (heavy hits only) and the
        // hurt sound under the impact: a grunt, or for the steerer a sharp breath, never a cry.
        combatFx.blow(e, sim.state.tick, display.reducedMotion);
        if (e.attacker === 'P_STEERER' || e.defender === 'P_STEERER') lastBlowAt = now;
        if (e.shake != null) visuals.shake(e.shake.px);
        const landed = e.outcome === 'HIT' || e.outcome === 'GUARD_BROKEN';
        if (landed && e.damage > 0)
          fightSound(who === 'P_STEERER' ? 'STEERER_HURT' : 'GRUNT', who, 0.04);
        if (e.kind === 'riposte' && landed) fightSound('RIPOSTE_HIT', who);
        if (e.kind === 'backstab' && landed) fightSound('BACKSTAB', who);
        if (e.kind === 'missile' && e.outcome === 'BLOCKED') {
          fightSound('ARROW_SHIELD', who);
          return;
        }
        if (e.outcome === 'PARRIED') {
          fightSound('PARRY', who);
          fightSound('PARRY_RING', who);
        } else if (e.outcome === 'BLOCKED') fightSound('BLOCKED', who);
        else if (e.outcome === 'GUARD_BROKEN' || e.outcome === 'HOOKED') {
          fightSound('GUARD_BROKEN', who);
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
      // A foe kneeling or running is seen: no caption (the audit).
      case 'PERSON_SURRENDERED':
      case 'PERSON_FLED':
        return;
      case 'PERSON_BROUGHT_HOME':
        inform(
          'caption.info.brought_home',
          t('caption.info.brought_home', { name: nameOf(e.person) }),
          now,
        );
        return;
      case 'LEFT_BEHIND':
        inform(
          'caption.info.left_behind',
          t('caption.info.left_behind', { name: nameOf(e.person) }),
          now,
        );
        return;
      case 'STEERER_DOWNED':
        if (e.secondWind) inform('caption.info.second_wind', t('caption.info.second_wind'), now);
        fightSound('PERSON_DOWNED', 'P_STEERER');
        return;
      case 'STEERER_DIED':
        // The collapse (DH-71): the sound drops away now; the sting comes with the screen.
        engine.setFallen(true, deathB.soundFadeSeconds, deathB.soundQuickSeconds);
        return;
      case 'FINISH_WARNING':
        inform(
          'caption.info.finish_warning',
          t('caption.info.finish_warning', { target: nameOf(e.target) }),
          now,
        );
        return;
      case 'CREW_ORDER_ACK':
        ordersShown[e.person] = { order: e.order.toLowerCase(), until: now + 1500 };
        return;
      case 'CREW_ORDER_REFUSED':
        // Merged into the person's bark (the audit).
        if (e.reason === 'CANNOT_FIGHT')
          say(
            t('caption.format.subtitle', {
              speaker: nameOf(e.person),
              line: t('crew.bark.cannot_fight'),
            }),
            now,
          );
        return;
      case 'FIGHT_REFUSED':
        if (e.reason === 'NO_SHIELD') refuseHere('no_shield', t('ui.refusal.no_shield'), now);
        else if (e.reason === 'NO_BINDING')
          refuseHere('no_binding', t('ui.refusal.no_binding'), now);
        else if (e.reason === 'NO_RATION') refuseHere('no_ration', t('ui.refusal.no_ration'), now);
        // "Too spent" is cut: the exhausted body and breathing show it (the audit).
        else if (e.reason === 'EXHAUSTED') return;
        else refuseHere('too_tired', t('ui.refusal.too_tired'), now);
        return;
      // ---- Combat v2 (design addendum 2.4): awareness, sidesteps, lunges, healing, the camp.
      case 'AWARENESS':
        combatFx.awareness(e.person, e.state, sim.state.tick);
        if (e.state === 'ALERT') fightSound('ALERT_STING', e.person);
        return;
      case 'SIDESTEP': {
        const a = sim.state.onFoot?.actors[e.who];
        if (a !== undefined) combatFx.sidestep(a.x, a.y, sim.state.tick);
        fightSound('SIDESTEP', e.who);
        return;
      }
      case 'ATTACK_STARTED':
        if (e.kind === 'lunge') fightSound('LUNGE_TELL', e.who);
        return;
      // Design addendum 2.5 (Book 10 "Telegraphs"; DF-9, DF-80): an enemy's tell is its one-frame
      // flash and a sound by weight; the steerer's own is a breath. Never a caption.
      case 'TELEGRAPH': {
        if (e.flash) combatFx.telegraph(e.who, sim.state.tick, display.reducedMotion);
        // The red blow's flash: the red glint along the edge (DG-10); its hiss is in the scrape.
        if (e.flash && e.red === true) {
          combatFx.redGlint(e.who, sim.state.tick, display.reducedMotion);
          return;
        }
        if (e.lunge === true) return;
        const blade = e.weapon === 'Seax' || e.weapon === 'Sword' || e.weapon === 'Spear';
        fightSound(
          !e.flash
            ? 'TELL_STEERER'
            : e.weight === 'LIGHT'
              ? 'TELL_LIGHT'
              : blade
                ? 'TELL_SCRAPE'
                : 'TELL_CREAK',
          e.who,
        );
        return;
      }
      // Exhausted (Book 10 exhaustedLook): hard breathing, and the bent idle; no word.
      case 'EXHAUSTED':
        if (e.on) fightSound('EXHAUSTED_BREATH', e.who);
        return;
      case 'ARCHER_HOP': {
        const a = sim.state.onFoot?.actors[e.who];
        if (a !== undefined) combatFx.sidestep(a.x, a.y, sim.state.tick);
        fightSound('SIDESTEP', e.who);
        return;
      }
      case 'SIDEARM_DRAWN':
        fightSound('SIDEARM_DRAWN', e.who);
        return;
      // Book 11 "Commitment and stamina" (DF-83): the parry's rasp, the block's creak, the dodge's
      // landing, and a whiff's overbalanced scuff. Heard and seen, never captioned (DF-80).
      case 'COMMIT_SOUND':
        fightSound(e.what, e.who);
        return;
      case 'MISSED':
        fightSound('WHIFF', e.who);
        return;
      case 'SHIELD_BROKEN': {
        const at =
          e.who === 'P_STEERER' ? sim.state.onFoot?.player : sim.state.onFoot?.actors[e.who];
        if (at !== undefined) combatFx.shieldBroken(at.x + 6, at.y);
        fightSound('SHIELD_SPLIT', e.who);
        return;
      }
      case 'HEAL_STARTED':
        // Healing is seen in its kneeling loop and heard: no caption (the audit).
        fightSound(e.kind === 'BIND' ? 'BIND_WOUND' : 'EAT_RATION', 'P_STEERER');
        return;
      case 'HEAL_INTERRUPTED':
        return;
      case 'CAMP_REACHED': {
        const call = saveFor(e);
        if (call?.kind === 'autosave' && call.reason === 'CAMP') autosaveDue = 'CAMP';
        return;
      }
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
    // A refused job's reason, merged into the talk panel under the line it answers (the audit).
    const note = talkNote !== null && talkNote.line === lineKey ? talkNote.text : '';
    const shown = [
      talk.with,
      lineKey,
      options.map((o) => o.key).join('|'),
      cursor,
      mouse,
      note,
    ].join('#');
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
    if (note !== '') {
      const p = document.createElement('p');
      p.className = 'info';
      p.textContent = note;
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
  teach =
    fightCtx === null
      ? null
      : new CombatTeach(
          fightCtx.pt3,
          content.combat,
          {
            t: (key, vars) => t(key, vars ?? {}),
            has: (key) => strings.has(key),
            steererName: () => world.player.name,
            nameOf,
            say,
            voice: (person, text, pan, level) => {
              engine.voice(person, text, pan, level);
            },
            pan: panOf,
            sound: (event, person, variant) => {
              if (audio === null || !engine.unlocked) return;
              const voice = voiceOf(person)?.pitch;
              audio.event(event, engine.now, {
                pan: person === 'P_STEERER' ? 0 : panOf(person),
                ...(voice === undefined ? {} : { voice }),
                ...(variant === undefined ? {} : { variant }),
              });
            },
            key: (action) => (ACTIONS.includes(action as Action) ? keys(action as Action) : ''),
            speechSeconds: (text) =>
              Math.min(
                textB.speechHold.max,
                Math.max(
                  textB.speechHold.min,
                  textB.speechHold.base + textB.speechHold.perChar * text.length,
                ),
              ),
          },
          sim.state.seed,
        );
  // The pad's Y and A finish and let go while the choice is offered and no other foe in reach is
  // winding up (Book 10 padContext; decision DG-2).
  session.finishChoice = () => {
    const onFoot = sim.state.onFoot;
    if (fightCtx === null || onFoot === null) return false;
    const offer = finishOffer(sim.state, fightCtx, map.tile);
    if (offer === null) return false;
    const p = onFoot.player;
    return !Object.entries(onFoot.actors).some(([id, a]) => {
      const f = a.fight?.f;
      if (id === offer.foe || a.fight?.side !== 'ENEMY' || f === undefined) return false;
      const reach = (fightCtx.cb.weapons[f.weapon ?? 'Seax'].reachTiles + 1) * map.tile;
      return (
        Math.hypot(a.x - p.x, a.y - p.y) <= reach &&
        (f.state.startsWith('charge') ||
          (STRIKING.includes(f.state) && sim.state.tick < f.activeAt))
      );
    });
  };
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
    // With Book 10 for the migrations that need it (schema 3 to 4, the camp's bindings at 10 to 11).
    sim.restore(saves.load(point.slot, { context: { balance: content.balance } }).state);
    restored = true;
    // The sound comes back after the collapse's silence (Book 10 soundFade, DH-71).
    engine.setFallen(false, deathB.restoreSeconds);
    gameOverStung = -1;
    lookOwns = null;
    captions.clear();
    fadeInFrom = frameNow;
  };

  const started = performance.now();
  /** The tutorial prompts' fades (Book 10 promptFade, promptQuiet, promptDone; DF-12). */
  const movePrompt = new PromptFade(textB);
  const timingPrompt = new PromptFade(textB);
  /** How far the steerer has walked (tiles), for the move prompt's promptDone. */
  let walked = 0;
  let walkedFrom: { x: number; y: number } | null = null;
  /** The cursor: hidden in cinematic moments until the mouse moves (Book 10 cursorHidden). */
  const cursorGate = new CursorGate();
  window.addEventListener('mousemove', () => {
    cursorGate.mouseMoved();
  });
  /** Whether a narrative line or beat is showing, as last drawn: prompts stay quiet then. */
  let narrativeShowing = false;
  let last = started;
  let first = true;
  let lastVisual = started;
  let frameMs = 0;
  /** An autosave's screenshot being read back from the GPU (DG-93), and the slots it is for. */
  let pendingShot: { readonly read: FrameReadback; readonly slots: string[] } | null = null;
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
  /** Stage 12: the launch's screens, kept in step with the menus and the simulation. */
  const closeMap = (now: number): void => {
    if (mapMode === 'reveal') sim.submit({ type: 'CLOSE_SEA_MAP' });
    mapMode = null;
    mapClosedAt = now;
    const region = overlay.region('seamap');
    region.replaceChildren();
    region.dataset['shown'] = '';
  };
  // Tests and captures only (`screen=readiness|naming|mark`, with `launch=open`): open a launch
  // screen on the first frame, as looking the boat over and choosing to launch would.
  let screenHook = new URLSearchParams(window.location.search).get('screen');
  const updateLaunchUi = (now: number): void => {
    if (launchDef === null || launchCtx === null) return;
    if (screenHook !== null) {
      const want = screenHook;
      screenHook = null;
      if (
        (want === 'readiness' || want === 'naming' || want === 'mark') &&
        session.menus.request('planning').ok
      ) {
        pendingName = t(launchDef.names.suggestions[1] ?? launchDef.names.defaultKey);
        openLaunch(want);
      }
    }
    const open = session.menus.open;
    const ship = sim.state.ships['flagship'];
    // A screen whose menu was closed (Escape): the readiness screen is left; once the launch is
    // confirmed, its name and mark are asked again, for there is no going back.
    if (launchUi === 'readiness' && open !== 'planning') openLaunch('none');
    if ((launchUi === 'naming' || launchUi === 'mark') && open !== 'planning')
      session.menus.request('planning');
    if (launchUi === 'chapter' && open !== 'report') openLaunch('none');
    // A gate started with no name or mark yet (a checkpoint loaded part-way): ask for them.
    if (
      launchUi === 'none' &&
      launchPhase(sim.state) === 'NAMING' &&
      ship !== undefined &&
      (ship.name === null || ship.marks.sail === null)
    )
      if (session.menus.request('planning').ok) {
        pendingName = ship.name ?? '';
        openLaunch(ship.name === null ? 'naming' : 'mark');
      }
    // The sea map: the reveal at the launch, or looked at again with the map key afterwards.
    if (mapMode !== null && open !== 'map') closeMap(now);
    if (
      mapMode === null &&
      open === 'map' &&
      sim.state.facts[FACT_SMOKE] === true &&
      now - mapClosedAt > 150
    ) {
      mapMode = 'view';
      mapOpenedAt = now;
    }
    const region = overlay.region('launch');
    const key = `${launchUi}|${open ?? ''}`;
    if (launchShown === key) return;
    launchShown = key;
    root.dataset['launchUi'] = launchUi;
    switch (launchUi) {
      case 'none':
        region.replaceChildren();
        return;
      case 'readiness':
        region.replaceChildren(
          readinessPanel(
            document,
            readinessView(sim.state, launchCtx, land, b),
            words,
            { start: keys('interact'), back: 'Esc' },
            () => {
              openLaunch('naming');
            },
            () => {
              session.menus.close();
              openLaunch('none');
            },
          ),
        );
        return;
      case 'naming':
        region.replaceChildren(
          namingPanel(document, launchDef, words, atlases, (name) => {
            pendingName =
              cleanShipName(name, launchDef.names.maxLength) ?? t(launchDef.names.defaultKey);
            openLaunch('mark');
          }),
        );
        return;
      case 'mark':
        region.replaceChildren(
          markPanel(document, launchDef, words, atlases, pendingName, (pattern, dye) => {
            // Confirmed: the gate starts, the boat is named and marked, and the scene plays.
            if (sim.state.gates[GATE_LAUNCH]?.status === 'OPEN')
              sim.submit({ type: 'START_GATE', gate: GATE_LAUNCH });
            if (sim.state.ships['flagship']?.name == null)
              sim.submit({ type: 'NAME_SHIP', name: pendingName });
            sim.submit({ type: 'MARK_SAIL', pattern, dye });
            openLaunch('none');
            session.menus.close();
          }),
        );
        return;
      case 'chapter':
        region.replaceChildren(
          chapterPanel(
            document,
            words,
            sim.state.ships['flagship']?.name ?? '',
            chapterEnd?.played ?? 0,
            chapterEnd?.fight ?? null,
            keys('interact'),
            () => {
              session.menus.close();
              openLaunch('none');
            },
          ),
        );
        return;
    }
  };
  /** The sea map's words over the chart: its title, the places known, and how to leave it. */
  const seaMapLabels = (revealed: number): void => {
    const region = overlay.region('seamap');
    if (launchDef === null) return;
    const sm = launchDef.seaMap;
    const home = sm.places[sm.home];
    const smoke = sm.places[sm.smoke];
    if (home === undefined || smoke === undefined) return;
    const reach = Math.hypot(smoke.x - home.x, smoke.y - home.y) / (Math.hypot(640, 360) * 0.75);
    const showSmoke = revealed >= reach;
    const shown = `${mapMode ?? ''}|${showSmoke}|${keys('interact')}`;
    if (region.dataset['shown'] === shown) return;
    region.dataset['shown'] = shown;
    const at = (x: number, y: number, text: string, cls: string): HTMLElement => {
      const l = document.createElement('div');
      l.className = `label ${cls}`;
      l.style.left = `${(x / LOGICAL_WIDTH) * 100}%`;
      l.style.top = `${(y / LOGICAL_HEIGHT) * 100}%`;
      l.textContent = text;
      return l;
    };
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = t('ui.seamap.title');
    const parts: HTMLElement[] = [title, at(home.x, home.y + 22, t('ui.seamap.home'), 'home')];
    if (showSmoke) parts.push(at(smoke.x, smoke.y + 8, t('ui.seamap.smoke'), 'smoke'));
    const foot = document.createElement('div');
    foot.className = 'foot';
    const note = document.createElement('p');
    note.textContent = t('ui.seamap.readonly');
    const close = document.createElement('button');
    close.textContent = t('ui.seamap.close', { key: keys('interact') });
    close.addEventListener('click', () => {
      session.menus.close();
    });
    foot.append(note, close);
    parts.push(foot);
    region.replaceChildren(...parts);
  };
  /** False while a stepped frame runs undrawn (capture mode's `oeStep(ms, false)`). */
  let drawThis = true;
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
    if (!session.menus.timeStopped) pendingOptions = {};
    // The Skip button and the hold (DG-19).
    const anyHeld = keysDown.size > 0 || result.input.held.size > 0;
    if (anyHeld && !anyHeldBefore) skipHold.press(now / 1000);
    if (!anyHeld) skipHold.releaseAll();
    anyHeldBefore = anyHeld;
    const sv = skipHold.update(
      now / 1000,
      coldOpenSeconds(sim.state),
      iface.introSeen,
      skipClicked,
    );
    skipClicked = false;
    skipView.update(sv.alpha, sv.ring, presenter.viewport, window.devicePixelRatio);
    root.dataset['skip'] = sv.alpha > 0 ? sv.ring.toFixed(2) : '';
    if (sv.skip) skipColdOpen();
    // The pause menu (DG-15): drawn over the frame it paused, or over a running world.
    pauseView.frame(
      session.menus.open === 'system',
      !session.menus.timeStopped,
      result.input,
      presenter.viewport,
      window.devicePixelRatio,
    );
    // Book 10 pauseDuck: music and ambience fall while the menu holds time; effects pause.
    const duck = session.menus.open === 'system' && session.menus.timeStopped;
    if (duck !== ducked) {
      ducked = duck;
      engine.setPaused(duck, uiB.menu.pauseDuckDb, uiB.menu.pauseDuckSeconds);
      if (duck) engine.click(true);
    }
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
    if (autosaveDue !== null) {
      saves.autosave(sim.state, autosaveDue);
      autosaveDue = null;
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
    // The tooltip in turn: the next one when the last has had its time; named for the device in
    // use; faded out while a narrative line, beat, scene or talk shows (DF-12).
    if (tip?.life.over === true) tip = null;
    if (tip === null && tipQueue.length > 0) {
      const next = tipQueue[0];
      tipQueue = tipQueue.slice(1);
      if (next !== undefined) tip = { item: next, life: new TipLife(textB) };
      renderTip();
    } else if (tip === null && root.dataset['tip'] !== '') renderTip();
    else if (tip !== null && deviceChanged) renderTip();
    const tipAlpha = tip === null ? 0 : tip.life.update(now / 1000, narrativeShowing);
    const tipRegion = overlay.region('tip');
    const tipOpacity = tipAlpha.toFixed(2);
    if (tipRegion.style.opacity !== tipOpacity) tipRegion.style.opacity = tipOpacity;
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
    // Hands full: a refusal word at the cursor, not a notice over the prompt (the audit).
    if (result.refusedActions.length > 0) refuseHere('hands_full', t('ui.refusal.hands_full'), now);
    if (sea?.active(mapMode === 'view') === true) {
      seaUp = true;
      sea.frame(now, drawThis, mapMode === 'view');
      hud.canvas.style.visibility = 'hidden';
      if (audio !== null) {
        audio.update(engine.now);
        for (const c of audio.takeCaptions()) inform(c.key, c.text, now);
      }
      const seaCaptions = captions.update(now / 1000, false);
      showCaptionSlots(
        overlay.region('captions'),
        seaCaptions.info,
        seaCaptions.speech,
        seaCaptions.outgoing,
      );
      overlay.fit(presenter.viewport, window.devicePixelRatio);
      frameMs = frameMs * 0.95 + (performance.now() - workStart) * 0.05;
      root.dataset['frameMs'] = frameMs.toFixed(2);
      if (!manual) requestAnimationFrame(frame);
      return;
    }
    if (seaUp) {
      seaUp = false;
      sea?.leave();
    }
    const onFoot = sim.state.onFoot;
    if (onFoot === null) {
      if (!manual) requestAnimationFrame(frame);
      return;
    }
    // Book 10 promptDone: the move prompt is done once the steerer has walked 2 tiles.
    const step =
      walkedFrom === null
        ? 0
        : Math.hypot(onFoot.player.x - walkedFrom.x, onFoot.player.y - walkedFrom.y) / map.tile;
    if (step < 3) walked += step;
    walkedFrom = { x: onFoot.player.x, y: onFoot.player.y };
    if (walked >= textB.moveDoneTiles && wreckPhase(sim.state) === 'PLAY') movePrompt.done();
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
        // Locked on: the view sits between the steerer and the target (PT-0's smoothing kept).
        const locked = onFoot.player.stance?.lockOn ?? null;
        const target = locked === null ? undefined : onFoot.actors[locked];
        if (target !== undefined)
          return {
            kind: 'target',
            x: target.x,
            y: target.y,
            share: combatB.stance.lockCameraShare,
          };
        if (device === 'mouse' && pointer !== null) return { kind: 'cursor', ...pointer };
        if (device === 'pad') return { kind: 'stick', ...result.stick };
        return { kind: 'travel' };
      })(),
      aiming: onFoot.player.aim !== null,
      fire: ((): { x: number; y: number; lit: boolean; roofed: boolean } | null => {
        const site = campDef?.sites.find((x) => x.kind === 'FIRE' && x.zone === map.zone);
        const home = campDef === null ? undefined : sim.state.homes[campDef.home];
        return site === undefined || home === undefined
          ? null
          : {
              x: site.x * map.tile,
              y: site.y * map.tile,
              lit: home.fire.lit,
              roofed: home.stage === 'S1',
            };
      })(),
      night: lightPhase(sim.state.calendar, b) === 'night',
    };
    lastVisual = now;
    visuals.update(frameInput);
    const interaction = interactionNow(
      onFoot,
      map,
      land.rules,
      tideOpen,
      sim.state.facts,
      interactFirst(sim.state, wreckCtx),
    );

    // The one prompt that fits the moment.
    let prompt = '';
    let promptKind = '';
    const interactKey = keys('interact');
    if (interaction?.kind === 'PICK_UP') {
      const lying = onFoot.items.find((i) => i.key === interaction.key);
      const what = itemOf(lying?.item ?? 'ITEM_ARROW');
      // Combat v2's carried bindings have no hotbar entry: named by their own string.
      const item =
        what !== undefined
          ? t(what.nameKey)
          : lying?.item === 'ITEM_BINDING'
            ? t('item.name.bindings')
            : displayName(lying?.item ?? '', names);
      prompt =
        device === 'mouse'
          ? t('ui.prompt.pick_up_click', { item })
          : t('ui.prompt.pick_up', { key: interactKey, item });
      promptKind = 'pick_up';
    } else if (
      interaction?.kind === 'LIFT' &&
      wreckCtx !== null &&
      interaction.target === wreckCtx.caller &&
      netted(sim.state)
    ) {
      // Design addendum 2.4: Hild in the net, cut free with a blade (a hold), or needing one.
      const blade = bladeOf(sim.state, wreckCtx) !== null;
      prompt = !blade
        ? t('ui.refusal.need_blade')
        : device === 'mouse'
          ? t('ui.prompt.cut_net_click')
          : t('ui.prompt.cut_net', { key: interactKey });
      promptKind = blade ? 'cut_net' : 'need_blade';
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
    } else if (!movePrompt.isDone && now - started > opening.moveHintSeconds * 1000) {
      prompt = t('ui.prompt.move', { keys: moveKeys });
      promptKind = 'move';
    }
    // The uses here, the very list the simulation acts on (the user's fourth playtest, DH-10): the
    // nearer of a lift or pickup and a use, as the simulation picks. Before, the opening's own uses
    // were missing here, so the shelter's prompt never showed (DH-4).
    const campCtx = land.camp ?? null;
    const uses = placedUsesHere(
      sim.state,
      {
        camp: campCtx,
        wreck: wreckCtx,
        searches: land.searches ?? null,
        repairs: land.repairs ?? null,
        remarks: land.story4?.remarks ?? null,
        finds: land.finds ?? null,
        raid: land.raid ?? null,
      },
      map,
    );
    const reachPx = land.rules.interactRadiusTiles * map.tile;
    const use =
      onFoot.carrying === null && onFoot.player.work == null
        ? campUseNear(uses, onFoot.player, reachPx)
        : null;
    bedLit = use?.use.kind === 'SLEEP';
    const at = interaction === null ? null : interactionPoint(onFoot, interaction, map.tile);
    if (use !== null && useWins(use, interaction, at, onFoot.player)) {
      const label = campUseLabel(use.use, content, t, nameOf, interactKey, device === 'mouse');
      prompt = label.text;
      promptKind = label.kind;
    }
    // A beaten foe's finish-or-let-go choice is a combat prompt at the screen's edge (DG-7; Book 8
    // section 10: ui.prompt.finish_or_spare replaces ui.prompt.finish), drawn by `teach` below.
    const work = onFoot.player.work;
    // Only a timed task asks for the press (decision PT-1); plain work just plays its loop.
    if (work != null && campCtx !== null && isTimed(campCtx, work.task)) {
      prompt = t('ui.prompt.timing', {
        key: device === 'mouse' ? t('ui.input.mouse.0') : keys('useItem'),
      });
      promptKind = 'timing';
    }
    // Stage 12: the launch scene has the steerer; nothing is offered to do while it plays.
    const launchPlaying = launchDef !== null && launchView(sim.state, { def: launchDef }) !== null;
    if (launchPlaying) {
      prompt = '';
      promptKind = '';
    }
    // Design addendum 2.5 (DF-12): a story beat, a scene or a talk hides every prompt; tutorial
    // prompts also fade while a narrative line shows, come back 2 s after, and go once done.
    const talkOpen = sim.state.talk !== null;
    const storyBeat =
      wreckPhase(sim.state) !== 'PLAY' ||
      (wreckCtx !== null && hagNow(sim.state, wreckCtx) !== null) ||
      ritesScene ||
      seaBurialActive(sim.state) ||
      // The strongbox taken in sight (DH-13): a brief scene.
      snatchHolds(sim.state, land.story4 ?? null) ||
      launchPlaying;
    const quiet = narrativeShowing || storyBeat || talkOpen;
    const secs = now / 1000;
    const moveAlpha = movePrompt.update(secs, promptKind === 'move', quiet);
    const timingAlpha = timingPrompt.update(secs, promptKind === 'timing', quiet);
    const promptAlpha =
      promptKind === 'move'
        ? moveAlpha
        : promptKind === 'timing'
          ? timingAlpha
          : storyBeat || talkOpen
            ? 0
            : 1;
    const promptRegion = overlay.region('prompt');
    const promptText = promptAlpha <= 0 ? '' : prompt;
    if (promptRegion.textContent !== promptText) promptRegion.textContent = promptText;
    const promptOpacity = promptAlpha.toFixed(2);
    if (promptRegion.style.opacity !== promptOpacity) promptRegion.style.opacity = promptOpacity;
    root.dataset['promptAlpha'] = promptOpacity;
    // The combat prompts at the right edge, faded over the action and in story beats (DG-7), and the
    // talk at the fold (DG-26).
    if (teach !== null) {
      const shown = teach.frame(now, sim.state, fightCtx, map.tile, {
        option: display.combatPrompts ?? 'FIRST',
        inFight: fightHolds(
          Object.values(onFoot.actors).flatMap((a) =>
            a.fight?.side === 'ENEMY' && a.fight.vitality > 0
              ? [
                  {
                    alert: a.fight.ai.awareness.state === 'ALERT',
                    tiles: Math.hypot(a.x - onFoot.player.x, a.y - onFoot.player.y) / map.tile,
                  },
                ]
              : [],
          ),
          (now - lastBlowAt) / 1000,
          textB,
        ),
        quiet: storyBeat || talkOpen || (narrativeShowing && hostilesAware(onFoot) === 0),
        covered: promptsCovered(onFoot, viewCamera, fightCtx?.pt3.prompts, {
          w: LOGICAL_WIDTH,
          h: LOGICAL_HEIGHT,
        }),
        region: overlay.region('combat'),
      });
      root.dataset['combatPrompts'] = shown.map((l) => l.id).join(',');
      root.dataset['combatWanted'] = teach.prompts.chosen.join(',');
    }
    // The ambience follows the game's own wind at the steerer and the drawn tide, four times a second.
    if (engine.unlocked && now - lastAmbienceAt > 250) {
      lastAmbienceAt = now;
      // Design addendum 2.4: the cold open is a night's storm at sea, the wind at its full.
      const storm = sim.state.facts['ch1.phase'] === 'COLD_OPEN';
      engine.setWind(
        storm ? 1 : STRAND_WIND.strength,
        storm
          ? 0.7 + 0.3 * Math.sin(visuals.seconds * 1.7)
          : gustAt(STRAND_WIND, onFoot.player.x, onFoot.player.y, visuals.seconds),
        -STRAND_WIND.dirX,
      );
      if (visuals.tideLevel >= 0) engine.setTide(visuals.tideLevel);
      placeAudio();
      boatWorkSounds();
    }
    // Sound captions go through the audit by key like every other line (most are cut).
    if (audio !== null) {
      audio.update(engine.now);
      for (const c of audio.takeCaptions()) inform(c.key, c.text, now);
    }
    // Book 10's inFight: a hostile alert to the steerer within 12 tiles, or a blow lately.
    const hostiles = Object.values(onFoot.actors).flatMap((a) =>
      a.fight?.side === 'ENEMY' && a.fight.vitality > 0
        ? [
            {
              alert: a.fight.ai.awareness.state === 'ALERT',
              tiles: Math.hypot(a.x - onFoot.player.x, a.y - onFoot.player.y) / map.tile,
            },
          ]
        : [],
    );
    const fight = fightHolds(hostiles, (now - lastBlowAt) / 1000, textB);
    captions.showInfo = display.infoCaptions;
    const cf = captions.update(secs, fight);
    showCaptionSlots(overlay.region('captions'), cf.info, cf.speech, cf.outgoing);
    narrativeShowing =
      cf.speech !== null ||
      (cf.info !== null && (cf.info.cls === 'STORY' || cf.info.cls === 'DIRECTION'));
    root.dataset['fight'] = fight ? '1' : '';
    root.dataset['captionInfo'] = cf.info?.text ?? '';
    root.dataset['captionSpeech'] = cf.speech?.text ?? '';
    root.dataset['captionHeld'] = cf.held ?? '';
    root.dataset['tipAlpha'] = tipOpacity;
    // The cursor is hidden through cinematic moments until the mouse moves (DF-15).
    const cinematic = cinematicNow({
      phase: wreckPhase(sim.state),
      gettingUp: sim.state.facts['ch1.getting_up'] !== undefined,
      scene: sim.state.talk?.kind === 'SCENE' || sim.state.talk?.scene != null,
      rites:
        ritesScene || seaBurialActive(sim.state) || snatchHolds(sim.state, land.story4 ?? null),
      launch: launchPlaying,
    });
    const pointerOffered =
      launchUi !== 'none' || mapMode !== null || sim.state.gameOver !== null || helpOpen;
    const cursorHidden = cursorGate.update(cinematic, pointerOffered);
    const cursorStyle = cursorHidden ? 'none' : '';
    if (canvas.style.cursor !== cursorStyle) {
      canvas.style.cursor = cursorStyle;
      document.body.style.cursor = cursorStyle;
    }
    root.dataset['cursor'] = cursorHidden ? 'hidden' : 'shown';
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
    // The other menus' line; the pause menu is drawn as pixel art (DG-15), so its region holds
    // only a text mirror of it for screen readers, kept out of sight.
    const menuRegion = overlay.region('menu');
    const pauseMirror = (): string => {
      const env = pauseEnv();
      const m = pauseView.model;
      const rows =
        m.page === 'main'
          ? PAUSE_ITEMS.map((item) => itemText(item, env, t))
          : m.page === 'settings'
            ? []
            : m.page === 'controls'
              ? [controlRows().note]
              : env.slots.map((slot) =>
                  [
                    slot.slot === 'AUTO'
                      ? t('ui.save.slot_auto')
                      : t('ui.save.slot_manual', { count: slot.slot.slice('MANUAL_'.length) }),
                    ...slotLines(slot, t, (sec) => agoText(sec, t)),
                  ].join(', '),
                );
      const settingsText = env.settings.map((r) => t(r.textKey, r.vars ?? {}));
      const note = m.note === null ? [] : [t(m.note.key, m.note.vars ?? {})];
      const confirm = m.confirm === null ? [] : [t(m.confirm.key, m.confirm.vars ?? {})];
      return [
        t(session.menus.timeStopped ? 'ui.pause.title' : 'ui.pause.running'),
        ...confirm,
        ...note,
        ...rows,
        ...settingsText,
      ].join('. ');
    };
    const menuText =
      open === null || mapMode !== null || launchUi !== 'none'
        ? ''
        : open === 'system'
          ? pauseMirror()
          : t('ui.menu.open', { menu: t(`ui.menu.name.${open}`) });
    if (menuRegion.textContent !== menuText) menuRegion.textContent = menuText;
    const hidden = open === 'system';
    if ((menuRegion.dataset['mirror'] === '1') !== hidden) {
      menuRegion.dataset['mirror'] = hidden ? '1' : '';
      Object.assign(
        menuRegion.style,
        hidden
          ? {
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clipPath: 'inset(50%)',
              whiteSpace: 'nowrap',
            }
          : { position: '', width: '', height: '', overflow: '', clipPath: '', whiteSpace: '' },
      );
    }
    root.dataset['pause'] = pauseView.isOpen ? pauseView.model.page : '';
    root.dataset['paused'] = session.menus.timeStopped ? '1' : '';
    root.dataset['pauseNote'] = pauseView.model.note?.key ?? '';
    root.dataset['pauseConfirm'] = pauseView.model.confirm?.key ?? '';
    root.dataset['pauseCursor'] = String(pauseView.model.cursor);
    root.dataset['fullscreen'] = isFullscreen(document) ? '1' : '';
    root.dataset['camx'] = String(viewCamera.x);
    root.dataset['camy'] = String(viewCamera.y);
    root.dataset['slots'] = pauseView.isOpen
      ? saves
          .slotViews(uiB.menu.saveSlots, Date.now())
          .map(
            (v) =>
              `${v.slot}:${v.empty ? '' : `${v.header?.day ?? ''}@${v.header?.minuteOfDay ?? ''}@${v.header?.placeKey ?? ''}@${v.thumbnail?.data.length ?? 0}`}`,
          )
          .join(',')
      : '';

    const view0 = visuals.view(frameInput);
    const coldBoatAt = wreckCtx === null ? null : coldBoat(sim.state, wreckCtx, map.tile);
    const view = {
      ...view0,
      camera:
        wreckCtx === null
          ? view0.camera
          : coldBoatAt !== null
            ? ((): { x: number; y: number } => {
                // The camera sways with the sea, in whole pixels (none with reduced motion).
                if (cameraStill) {
                  stillCamera ??= {
                    x: Math.round(coldBoatAt.x - 320),
                    y: Math.round(coldBoatAt.y - 200),
                  };
                  return stillCamera;
                }
                const sway = swayAt(coldBoatAt.t, stormB, display.reducedMotion);
                return {
                  x: Math.round(coldBoatAt.x - 320) + sway.x,
                  y: Math.round(coldBoatAt.y - 200) + sway.y,
                };
              })()
            : seaCamera(
                sim.state,
                wreckCtx,
                map,
                hagCamera(sim.state, wreckCtx, map, view0.camera, display.reducedMotion),
                display.reducedMotion,
              ),
    };
    openingFx.update(Math.min(0.1, frameInput.dt));
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
      hidePeople: hidePeople || coldBoatAt !== null,
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
      ...(sim.state.gameOver === null
        ? {}
        : {
            steererCollapse: {
              from: sim.state.gameOver.from ?? null,
              buckle: deathB.buckleTicks,
              frames: deathB.fallFrames,
              frameTicks: deathB.fallFrameTicks,
            },
          }),
      ...(spareTick === null ? {} : { steererSpare: spareTick }),
      combat: combatFx.overlay(onFoot, sim.state.tick, display.marks),
      walkPerTick: (land.movement.walk * map.tile) / TICKS_PER_SECOND,
      ...((): {
        launch?: { hidden: string[]; steererHidden: boolean; steererLoop: string | null };
      } => {
        const lv = launchDef === null ? null : launchView(sim.state, { def: launchDef });
        return lv === null
          ? {}
          : {
              launch: {
                hidden: [...lv.aboard],
                steererHidden: lv.steererAboard,
                steererLoop: lv.heaving ? 'gather' : null,
              },
            };
      })(),
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
        // The launch scene has the steerer: no tile is offered while it plays (Stage 12).
        target === null ||
        p.aim !== null ||
        hidePeople ||
        target.use === 'MELEE' ||
        (launchDef !== null && launchView(sim.state, { def: launchDef }) !== null)
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
    // Combat v2 (decision DE-8): the health and stamina bars, faded out when full outside a fight.
    const inFight = hostilesAware(sim.state.onFoot) > 0;
    const barsAlpha = combatFx.bars(
      { current: sim.state.player.vitality, max: steererVitality },
      { current: st.current, max: st.max },
      inFight,
      sim.state.tick,
    );
    const hudFull: HudView = {
      ...hudView,
      health: {
        current: sim.state.player.vitality,
        max: steererVitality,
        alpha: barsAlpha.health,
        bindings: sim.state.player.inventory['ITEM_BINDING'] ?? 0,
        rations: sim.state.player.inventory['ITEM_RATION'] ?? 0,
      },
      staminaAlpha: barsAlpha.stamina,
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
    if (drawThis) hud.draw(hudFull);
    // Stage 12: the sea map fills the frame; the hotbar and clock are not drawn over it.
    hud.canvas.style.visibility = mapMode === null ? '' : 'hidden';
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
    // The game-over screen waits for the collapse (Book 10 "The steerer's death", DH-71).
    const over = gameOverShown() ? sim.state.gameOver : null;
    if (over !== null && gameOverStung !== over.tick) {
      gameOverStung = over.tick;
      if (audio !== null && engine.unlocked) audio.event('GAME_OVER', engine.now, { pan: 0 });
    }
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
    const aimLine = journal === null ? null : t(journal);
    dev?.frame(now, {
      aim: aimLine ?? '',
      day: sim.state.calendar.day,
      time: clockText(sim.state.calendar.minuteOfDay),
      zone: map.zone,
      tile: tileOf(map, onFoot.player.x, onFoot.player.y),
    });
    root.dataset['dev'] = dev === null ? '' : dev.open ? 'open' : 'closed';
    const reportOpen =
      session.menus.open === 'report' && (reportShown !== null || aimLine !== null);
    const shownKey = `${aimLine ?? ''}|${reportShown?.join('|') ?? ''}`;
    if (reportOpen && reportRegion.dataset['shown'] !== shownKey) {
      const title = document.createElement('h2');
      title.textContent =
        reportShown === null
          ? t('ui.journal.title')
          : t('ui.report.title', {
              day: String(sim.state.calendar.day),
              season: t(`ui.season.${season.toLowerCase()}`),
            });
      // Design addendum 2.4 (DE-23): the current aim, one plain sentence, first.
      const aim = document.createElement('p');
      aim.className = 'oe-journal-aim';
      aim.textContent = aimLine ?? t('ui.journal.none');
      const body = [aim, ...(reportShown ?? [])].map((l) => {
        if (typeof l !== 'string') return l;
        const para = document.createElement('p');
        para.textContent = l;
        return para;
      });
      const close = document.createElement('p');
      close.textContent = t('ui.report.close', { key: keys('report') });
      reportRegion.replaceChildren(title, ...body, close);
      reportRegion.dataset['shown'] = shownKey;
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
    // Combat v2 (tests and captures): the stance (facing in degrees, the locked target, sneaking),
    // each enemy's awareness and hitstop, the steerer's hitstop and heal, the dusk's outcome.
    const st2 = p.stance;
    root.dataset['stance'] =
      st2 === undefined
        ? ''
        : `${Math.round((st2.facing * 180) / Math.PI)}:${st2.lockOn ?? ''}:${st2.sneaking ? 1 : 0}`;
    root.dataset['aware'] = Object.entries(onFoot.actors)
      .flatMap(([id, a]) =>
        a.fight?.side === 'ENEMY'
          ? [`${id}:${a.fight.ai.awareness.state}:${a.fight.f.hitstop}`]
          : [],
      )
      .join(',');
    root.dataset['steererHitstop'] = String(p.fight?.hitstop ?? 0);
    root.dataset['dusk'] = String(sim.state.facts['ch1.dusk'] ?? '');
    root.dataset['saves'] = saves
      .headers()
      .map((h) => `${h.kind}:${h.label ?? h.reason ?? ''}:${h.day}`)
      .join(',');
    root.dataset['gore'] = String(display.gore);
    root.dataset['music'] = audio?.director.state ?? '';
    if (frames < 3) mark(`scene${frames}`);
    // Stage 12: the sea map (read-only) is drawn in place of the scene while it is open.
    const chart = mapMode === null ? null : seaMapView();
    if (chart !== null) {
      const f = chart.frame(
        (now - mapOpenedAt) / 1000,
        mapMode === 'reveal' ? 0.4 : null,
        markState(),
        display.reducedMotion,
      );
      if (drawThis) presenter.present(f.rgba);
      seaMapLabels(f.revealed);
      root.dataset['seamap'] = f.revealed.toFixed(2);
    } else {
      // Design addendum 2.4: the opening's drawing over the zone, or the cold open in its place.
      // The first rain over the island, beading on the sail and heard under it (DF-21).
      const rainDrops = firstRainDrops(
        sim.state.calendar.day,
        sim.state.calendar.minuteOfDay,
        leanToUp(sim.state),
        stormB,
        visuals.seconds,
      );
      const underCloth =
        rainDrops > 0 && wreckCtx !== null && underSail(sim.state, wreckCtx, map, onFoot.player);
      if (engine.unlocked) engine.setRainCloth(underCloth ? 1 : 0);
      root.dataset['rain'] = rainDrops > 0 ? (underCloth ? 'under' : 'falling') : '';
      const cold =
        wreckCtx === null || coldBoatAt === null || storm === null
          ? null
          : coldOpenScene(
              scene,
              sim.state,
              wreckCtx,
              map,
              view.camera,
              choice.bodyModel,
              display.reducedMotion,
              storm,
            );
      if (cold?.drawing != null && coldBoatAt !== null && storm !== null) {
        const t = coldBoatAt.t;
        const d = cold.drawing;
        // The storm's sounds as their moments pass: thunder after each flash by its distance,
        // a wave's boom on the side it strikes, green water over the side (Book 11 section 07).
        if (stormLastT >= 0 && t > stormLastT) {
          const crossed = (at: number): boolean => stormLastT < at && at <= t;
          const lead = (at: number): number => Math.max(0, at - t);
          for (const k of storm.list)
            if (crossed(k.thunderAt)) {
              thunderHeard.push([k.at, k.thunderAt]);
              if (audio !== null && engine.unlocked)
                audio.event(
                  k.distance < 0.5 ? 'THUNDER_NEAR' : 'THUNDER_FAR',
                  engine.now + lead(k.thunderAt),
                  {
                    pan: (k.across - 0.5) * 1.4,
                  },
                );
            }
          for (const w of storm.waves)
            if (crossed(w.at) && audio !== null && engine.unlocked)
              audio.event('WAVE_HULL', engine.now, { pan: w.along * 0.6 });
          for (const g of storm.green)
            if (crossed(g) && audio !== null && engine.unlocked)
              audio.event('GREEN_WATER', engine.now, { pan: -0.1 });
        }
        stormLastT = t;
        root.dataset['storm'] = JSON.stringify({
          t: Math.round(t * 100) / 100,
          flash: Math.round(d.flash * 100) / 100,
          sway: [
            view.camera.x - Math.round(coldBoatAt.x - 320),
            view.camera.y - Math.round(coldBoatAt.y - 200),
          ],
          bow: Math.round(d.bow * 10) / 10,
          roll: d.roll,
          drops: d.drops,
          mist: d.mist.length,
          clear: d.clear,
          strikes: storm.list.map((k) => [
            Math.round(k.at * 100) / 100,
            Math.round(k.thunderAt * 100) / 100,
          ]),
          heard: thunderHeard,
        });
        if (audio !== null && engine.unlocked)
          engine.setStorm(
            t < (wreckCtx?.rw.coldOpen.blackSeconds ?? 0) ? 1 : 0,
            stormB.pitchSeconds,
            stormB.rollSeconds,
          );
      } else if (stormLastT >= 0) {
        stormLastT = -1;
        root.dataset['storm'] = '';
        engine.setStorm(0);
      }
      const drawn =
        wreckCtx === null
          ? scene
          : cold !== null
            ? cold.scene
            : decorate(scene, {
                world: sim.state,
                ctx: wreckCtx,
                map,
                onFoot,
                camera: view.camera,
                seconds: visuals.seconds,
                tick: sim.state.tick,
                reducedMotion: display.reducedMotion,
                fx: openingFx,
                seaRamp: tuning.sea,
                steererSheets: [look.steerer.body, ...Object.values(look.steerer.layers).flat()],
                bodyModel: choice.bodyModel,
                bundleDrift:
                  now - bundleFellAt > BUNDLE_DRIFT_MS
                    ? null
                    : {
                        k: (now - bundleFellAt) / BUNDLE_DRIFT_MS,
                        from: {
                          x: wreckCtx.rw.mast.lashing.x * map.tile,
                          y: wreckCtx.rw.mast.lashing.y * map.tile,
                        },
                      },
                rain:
                  rainDrops > 0
                    ? {
                        drops: rainDrops,
                        slant: Math.tan((stormB.rainSlantDegrees * Math.PI) / 180),
                      }
                    : null,
              });
      if (drawThis) {
        renderer.render(drawn, buildDrawPlan(drawn, geometry, style.cutawayFade));
        // The last frame before the pause menu opened: its backdrop and the save's thumbnail.
        pauseView.afterRender(presenter.gl, presenter.viewport, session.menus.timeStopped);
        // An autosave, checkpoint or day-start written since the last frame: its screenshot.
        // The frame is queued for reading now (before the browser composites it) without
        // waiting on the GPU, taken a frame or more later, and the PNG is made after that frame
        // (DG-93: a plain read on the first frame of play stalled it for the whole start-up).
        if (saves.unpictured.length > 0 && pendingShot === null)
          pendingShot = {
            read: new FrameReadback(presenter.gl, presenter.viewport),
            slots: saves.unpictured.splice(0),
          };
        else if (pendingShot !== null) {
          const read = pendingShot.read.poll();
          if (read !== null) {
            const slots = pendingShot.slots;
            pendingShot = null;
            setTimeout(() => {
              const shot = makeThumbnail(read, uiB.menu.thumbnail, uiB.menu.thumbnailBytes, (img) =>
                canvasPngBase64(document, img),
              );
              if (shot !== null) for (const slot of slots) saves.attachThumbnail(slot, shot);
            }, 0);
          }
        }
      }
      root.dataset['seamap'] = '';
    }
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
    // Design addendum 2.4: the journal's aim, the opening's phase, hints and edge captions heard.
    root.dataset['journal'] = aimLine ?? '';
    root.dataset['aim'] = sim.state.aims?.current ?? '';
    root.dataset['phase'] = String(sim.state.facts['ch1.phase'] ?? '');
    root.dataset['coldoar'] = String(sim.state.facts['ch1.cold_oar'] ?? '');
    // The user's third playtest (tests and captures): the shelter's stage (DG-12) and how the
    // sea burial is drawn (DG-14): its phase, seconds, frame, mask and the wave.
    root.dataset['shelter'] = shelterStage(sim.state) ?? '';
    const seaNow =
      wreckCtx === null ? null : seaBurialView(sim.state, wreckCtx, map, visuals.seconds);
    root.dataset['sea'] =
      seaNow === null
        ? ''
        : `${seaNow.phase} ${seaNow.t.toFixed(2)} ${seaNow.frame} ${seaNow.mask} ${seaNow.wave}`;
    root.dataset['opening'] = [
      'ch1.hild_reached',
      'ch1.net_free',
      'ch1.hild_safe',
      'ch1.chest_named',
      'ch1.chest_home',
      'ch1.fire_lit',
      'ch1.hild_walked_up',
      'ch1.chest_opened',
      'ch1.lashing_cut',
    ]
      .filter((k) => sim.state.facts[k] === true)
      .map((k) => k.slice(4))
      .join(' ');
    root.dataset['hints'] = String(hintsHeard);
    root.dataset['edges'] = String(edgeCaptions);
    root.dataset['doors'] = (onFoot.doors ?? [])
      .map((d) => `${d.id}:${d.open.toFixed(2)}`)
      .join(',');
    root.dataset['hag'] = wreckCtx === null ? '' : (hagNow(sim.state, wreckCtx)?.what ?? '');
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
    root.dataset['prompt'] = promptKind;
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
    // The user's fourth playtest (tests): each resident's activity, pose and tile, and the last
    // speech line's key (exchanges, nudges and advice).
    root.dataset['people'] = sim.state.household.residents
      .map((id) => {
        const f = sim.state.onFoot === null ? null : findActor(sim.state.onFoot, id);
        const act = sim.state.people[id]?.life.activity ?? '';
        if (f === null) return `${id}:${act}:-:-`;
        const x = (f.actor.x / map.tile).toFixed(1);
        const y = (f.actor.y / map.tile).toFixed(1);
        return `${id}:${act}:${f.actor.pose}:${f.zone}@${x},${y}`;
      })
      .join('|');
    root.dataset['spoken'] = spokenKeys.join('|');
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
    root.dataset['boat'] = boatLayers(sim.state, null, drawing)
      .map((l) => l.frame.split('/')[0] ?? '')
      .join('+');
    root.dataset['barks'] = String(barksHeard);
    // Stage 12: the launch's gate and scene, the boat's name and mark, the chapter, the timings.
    root.dataset['gate'] = sim.state.gates[GATE_LAUNCH]?.status ?? '';
    root.dataset['launch'] = launchPhase(sim.state) ?? '';
    root.dataset['launchUi'] = launchUi;
    root.dataset['shipName'] = sim.state.ships['flagship']?.name ?? '';
    root.dataset['sail'] = sim.state.ships['flagship']?.marks.sail ?? '';
    root.dataset['chapter'] = activeChapter(sim.state) ?? '';
    const report = telemetryReport(sim.state);
    root.dataset['telemetry'] = JSON.stringify({
      now: Math.round(report.now),
      held: Math.round(report.held),
      marks: Object.fromEntries(report.marks.map((m) => [m.key, Math.round(m.seconds)])),
    });
    // The timings (system menu T, or ?timings for a dev readout that stays up).
    const timings = overlay.region('timings');
    const showTimings =
      timingsOpen &&
      (session.menus.open === 'system' ||
        new URLSearchParams(window.location.search).has('timings'));
    const timingsKey = showTimings ? `${Math.floor(report.now)}|${report.marks.length}` : '';
    if (timingsKey !== timingsShown) {
      timingsShown = timingsKey;
      timings.replaceChildren(...(showTimings ? [timingsPanel(document, words, report, 'T')] : []));
    }
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
    // `draw` false runs the frame (the simulation, the scene and the overlay's attributes) without
    // drawing it: a stepped test drawing only the last of many frames, as a software-rendered CI
    // runners draws in software at a few frames a second (decision DE-81).
    (window as unknown as { oeStep: (ms: number, draw?: boolean) => void }).oeStep = (
      ms: number,
      draw = true,
    ) => {
      clock += ms;
      drawThis = draw;
      try {
        frame(clock);
      } finally {
        drawThis = true;
      }
    };
    // Captures and browser tests only (combat v2): the world, to stage a moment of a fight (a foe
    // frozen in place, aware or not), as the unit tests do.
    (window as unknown as { oeWorld: unknown }).oeWorld = sim.state;
    // Captures only (design addendum 2.4, the first five minutes): the simulation and its land,
    // for a bot to play the opening through the same commands a player's input sends.
    Object.assign(window as unknown as Record<string, unknown>, {
      oePlay: { sim, land, b, content },
    });
    frame(clock);
  } else requestAnimationFrame(frame);
  // The title's "Intro: skip" (DG-19): a new game starts at the waking.
  if (options.load == null && iface.introSkip) skipColdOpen();
  canvas.dataset['state'] = 'play';
}

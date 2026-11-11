/**
 * Play on foot (Stage 6): the steerer on Wreck Strand under the camera, Hild calling beyond the
 * rocks, and the rescue. The overlay carries only what the moment needs: Hild's words as subtitles
 * with the direction of her voice, the prompt for the nearest thing to do, and a refusal's reason.
 * There is no control list (Book 3 Stage 6 check 2); the only control text is a single movement
 * hint if the steerer has not moved after a few seconds.
 *
 * The overlay root carries data-* attributes the browser tests read.
 */
import renderJson from '../../assets/art/render.json';
import { AudioRouter } from '../audio/router.ts';
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
import { tileOf } from '../sim/land/zoneMap.ts';
import type { ZoneMap } from '../sim/land/zoneMap.ts';
import { createSimulation } from '../sim/simulation.ts';
import type { SimEvent } from '../sim/simulation.ts';
import { newCampaign } from '../sim/world.ts';
import { createOverlay, showCaptions } from '../ui/overlay.ts';
import type { LoadedAtlas } from './atlases.ts';
import { lightPhase } from './lightPhase.ts';
import type { NamingChoice } from './namingView.ts';
import { bundledLayerFiles } from './bundledLayers.ts';
import { createHud } from './hud.ts';
import type { HudView } from './hud.ts';
import { peopleLook } from './people.ts';
import { Session } from './session.ts';
import { zoneScene } from './zoneScene.ts';
import { visualTuning, ZoneVisuals } from './zoneVisuals.ts';
import type { CameraLead } from './zoneVisuals.ts';
import { AIM_DIRECTIONS } from '../sim/simulation.ts';
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
    const look = peopleLook(layerFiles, body);
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
  const map = land.maps.get(world.onFoot.zone);
  if (map === undefined) throw new Error(`No map for ${world.onFoot.zone}`);
  const sim = createSimulation(b, world, land);

  const settings = loadSettings(browserStorage());
  const input = new InputMapper(settings.bindings, settings.toggle);
  const session = new Session(
    sim,
    input,
    { awareHostiles: () => 0 },
    { map, controls: land.controls, rules: land.rules },
  );
  const style = parseRenderStyle(renderJson);
  mark('world');
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
  const visuals = new ZoneVisuals(
    map,
    elevation,
    display.reducedMotion,
    visualTuning(content.balance, palette),
  );
  // Reduced motion can be changed from the system menu with M (Book 2 section 21).
  window.addEventListener('keydown', (e) => {
    if (session.menus.open !== 'system') return;
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
  const look = peopleLook(bundledLayerFiles(), choice.bodyModel);
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
  const audio = audioTable === null ? null : new AudioRouter(audioTable, strings, engine);
  const captionMs = (audioTable?.captionSeconds ?? 3) * 1000;
  visuals.onStep = (surface, x) => {
    if (engine.unlocked)
      engine.footstep(
        surface,
        (x - (sim.state.onFoot?.player.x ?? x)) / 200,
        sim.state.onFoot?.player.gait ?? 'walk',
      );
  };
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

  // Book 8 section 01: patronymics in formal speech only; barks and prompts use the short name.
  const nameOf = (id: string): string => {
    const short = `person.short.${id.toLowerCase()}`;
    if (strings.has(short)) return t(short);
    const key = world.people[id]?.nameKey;
    return key === undefined ? id : t(key);
  };
  const line = (key: string): string => t(key, { steerer: world.player.name });
  let subtitles: { text: string; kind: 'speech' | 'info'; until: number }[] = [];
  const say = (text: string, now: number, kind: 'speech' | 'info' = 'speech'): void => {
    subtitles = subtitles.filter((s) => s.text !== text);
    subtitles.push({ text, kind, until: now + captionMs });
    if (subtitles.length > 3) subtitles.shift();
  };
  let notice: { text: string; until: number } | null = null;
  let beat = '';
  /** Where a person is, left or right of the steerer, as a stereo pan. */
  const panOf = (person: string): number => {
    const onFoot = sim.state.onFoot;
    const actor = onFoot?.actors[person];
    if (onFoot === null || actor === undefined) return 0;
    return Math.max(-1, Math.min(1, (actor.x - onFoot.player.x) / 200));
  };
  let lastAmbienceAt = -1;
  const onEvent = (e: SimEvent): void => {
    const now = performance.now();
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
        return;
      case 'COMMAND_REFUSED':
        if (e.reason === 'OUT_OF_REACH')
          refuse('too_far', t('ui.refusal.too_far'), lastTarget.tx, lastTarget.ty, now);
        if (e.reason === 'NOTHING_THERE')
          refuse('nothing_there', t('ui.refusal.nothing_there'), lastTarget.tx, lastTarget.ty, now);
        if (e.reason === 'NOTHING_TO_USE_ON') {
          const key = itemOf(e.detail)?.refusalKey ?? 'ui.refusal.nothing_there';
          refuse('nothing_to_use_on', t(key), lastTarget.tx, lastTarget.ty, now);
        }
        if (e.reason === 'BELOW_TIDE_LINE' || e.reason === 'NO_ROOM') {
          const key = e.reason === 'BELOW_TIDE_LINE' ? 'ui.prompt.below_tide' : 'ui.prompt.no_room';
          notice = { text: t(key, { name: nameOf(e.detail) }), until: now + captionMs };
        }
        return;
      case 'BEAT_COMPLETED':
        beat = e.beat;
        // The island theme enters once Hild is safe: the opening itself has no music (Book 11).
        if (audio !== null && engine.unlocked && audio.director.state === null)
          audio.play(
            lightPhase(sim.state.calendar, b) === 'night' ? 'MUS_HOME_NIGHT' : 'MUS_HOME_DAY',
            engine.now,
          );
        return;
      default:
        return;
    }
  };
  sim.events.onAny(onEvent);

  const browser = attachBrowserInput(window, canvas, input, {
    firstInput: () => {
      if (!engine.unlocked && audio !== null) {
        engine.unlock();
        // Book 11: no music in the first seconds of the opening; wind, surf and Hild's voice.
        engine.setSeason(seasonOf(world.calendar.day) === 'Winter');
        audio.setPlace(map.zone, lightPhase(world.calendar, b), engine.now);
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
    const result = session.frame(now - last, browser.aim(), { device, pointer });
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
    };
    lastVisual = now;
    visuals.update(frameInput);
    const interaction = interactionNow(onFoot, map, land.rules, tideOpen);

    // The one prompt that fits the moment.
    let prompt = '';
    let promptKind = '';
    const interactKey = keys('interact');
    if (interaction?.kind === 'LIFT') {
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
    }
    const soundCaptions = audio === null ? [] : audio.update(engine.now);
    showCaptions(
      overlay.region('captions'),
      [...subtitles, ...soundCaptions],
      display.infoCaptions,
    );
    const open = session.menus.open;
    overlay.region('menu').textContent =
      open === null
        ? ''
        : `${t('ui.menu.open', { menu: t(`ui.menu.name.${open}`) })}${
            open === 'system'
              ? ` ${t(display.reducedMotion ? 'ui.system.motion_on' : 'ui.system.motion_off', { key: 'M' })} ${t(display.infoCaptions ? 'ui.system.info_on' : 'ui.system.info_off', { key: 'I' })}`
              : ''
          }`;

    const view = visuals.view(frameInput);
    const scene = zoneScene({
      map,
      onFoot,
      tick: sim.state.tick,
      tideOpen,
      phase: lightPhase(sim.state.calendar, b),
      look,
      anims,
      shadows,
      highlight: interaction?.kind === 'LIFT' ? interaction.target : null,
      visual: view,
      hidePeople,
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
        slots: Array.from({ length: land.controls.hotbarSlots }, (_, i) => ({
          icon: itemOf(hotbar.slots[i] ?? null)?.icon ?? null,
        })),
        selected: target?.slot ?? hotbar.selected,
      },
      cursor:
        target === null || p.aim !== null || hidePeople
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
    hud.draw(hudView);
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
    root.dataset['tide'] = visuals.tideLevel.toFixed(4);
    if (frames < 3) mark(`scene${frames}`);
    renderer.render(scene, buildDrawList(scene, geometry, style.cutawayFade));
    if (frames < 3) {
      mark(`frame${frames}`);
      root.dataset['startup'] = JSON.stringify(marks);
    }
    frames++;

    const tile = tileOf(map, onFoot.player.x, onFoot.player.y);
    root.dataset['tick'] = String(sim.state.tick);
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

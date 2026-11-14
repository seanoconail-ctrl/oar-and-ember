/**
 * The user's third playtest, the interface (Book 2 sections 02, 20, 21 and 23; Book 10 section 21,
 * "Menus and saves", "The intro", "Developer menu"; decisions DG-15 to DG-19 and DG-21): the pause
 * menu stops the simulation unless an enemy is aware; reset to the start of this day restores the
 * day-start save; the three manual slots round-trip with their headers and screenshots; saving is
 * refused while an enemy is aware; fullscreen is offered on the title and in the menu; the intro
 * can be skipped only once seen (or by the title's setting) and a skip lands where a played cold
 * open does; the developer menu is absent without `?dev` and its commands replay exactly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseInterfaceBalance } from '../../src/content/interfaceBalance.ts';
import { formatString } from '../../src/content/strings.ts';
import { ACTIONS, DEFAULT_BINDINGS } from '../../src/input/actions.ts';
import { InputMapper } from '../../src/input/inputState.ts';
import {
  DEFAULT_INTERFACE,
  INTERFACE_KEY,
  introSkippable,
  parseInterfaceSettings,
  saveInterfaceSettings,
} from '../../src/input/interfaceSettings.ts';
import { SETTINGS_KEY } from '../../src/input/settingsStore.ts';
import {
  attachWakingAutosave,
  DAY_START_SLOT,
  MemoryStore,
  SaveManager,
} from '../../src/persist/manager.ts';
import { readSave, writeSave } from '../../src/persist/save.ts';
import type { SaveFile } from '../../src/persist/save.ts';
import { devModeOn } from '../../src/scenes/devMenu.ts';
import { composePauseMenu } from '../../src/scenes/pauseMenuArt.ts';
import { Session } from '../../src/scenes/session.ts';
import { titleItems } from '../../src/scenes/titleMenu.ts';
import { FACT_DEV } from '../../src/sim/dev.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { hostilesAware } from '../../src/sim/land/fight.ts';
import { switchZone } from '../../src/sim/land/zoneLinks.ts';
import { wreckPhase } from '../../src/sim/narrative/wreck.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { Command, SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { compileFont } from '../../src/render/bitmapFont.ts';
import { agoText, PAUSE_ITEMS, PauseMenu } from '../../src/ui/pauseMenu.ts';
import type { PauseEnv } from '../../src/ui/pauseMenu.ts';
import { SkipHold } from '../../src/ui/introSkip.ts';
import { makeThumbnail } from '../../src/ui/thumbnail.ts';
import { loadPalette } from '../../src/tools/art/artFiles.ts';
import { loadStrings, REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';
import { decodePng, encodePng } from '../../src/tools/art/png.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { campHooks } from '../../src/scenes/camp.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const ui = parseInterfaceBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const strings = loadStrings();
const t = (key: string, vars: Readonly<Record<string, string>> = {}): string =>
  formatString(strings, key, vars);
const T = 60;
const TILE = 24;

function play(seed: string, coldOpen = false) {
  const world = newCampaign(
    seed,
    b,
    parsePeopleBasics(balance),
    content,
    { name: 'Ash', bodyModel: 'A' },
    { coldOpen },
  );
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  return { world, sim, events };
}

/** Up from the surf, so play has begun. */
function wake(sim: ReturnType<typeof play>['sim']): void {
  sim.submit({ type: 'MOVE', x: -1, y: 0, run: false, sneak: false });
  for (let i = 0; i < 3 * T; i++) sim.step();
  sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
  sim.step();
}

/** A scavenger on the strand near the steerer (Conn: no teaching rule), its awareness set. */
function withFoe(seed: string, aware: boolean) {
  const fixture = {
    ...content,
    searches: null,
    combat:
      content.combat === null
        ? null
        : {
            ...content.combat,
            encounters: [
              {
                id: 'SCN_SK_WRECKERS',
                zone: 'ZONE_SK_STRAND',
                takesCaptives: false,
                checkpoint: 'test',
                members: [{ person: 'E_WRECKER_CONN', x: 60, y: 34.5, facing: 'w' as const }],
              },
            ],
          },
  };
  const fland = landContext(fixture, balance);
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, fland, new URLSearchParams('camp=broch&time=10:00'));
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: 72 * TILE, y: 34.5 * TILE });
  const sim = createSimulation(b, world, fland);
  sim.step();
  const foe = onFoot.actors['E_WRECKER_CONN']?.fight;
  if (foe === undefined) throw new Error('no foe');
  if (aware) {
    foe.ai.aware = true;
    foe.ai.awareness = { level: 100, state: 'ALERT', heard: world.tick };
  }
  return { world, sim };
}

/** A real frame of the game (the stage 12 capture), for the thumbnails. */
const frame = decodePng(readFileSync(join(REPO_ROOT, 'docs/art/captures/stage-12/camp-sail.png')));
const thumbnailOf = () =>
  makeThumbnail(frame, ui.menu.thumbnail, ui.menu.thumbnailBytes, (img) =>
    encodePng({ width: img.width, height: img.height, data: Uint8Array.from(img.data) }).toString(
      'base64',
    ),
  );

describe('Book 10 "Menus and saves", "The intro" and "Developer menu" are read from balance.json', () => {
  it('reads every number this work uses', () => {
    expect(ui.menu).toEqual({
      saveSlots: 3,
      thumbnail: { w: 160, h: 90, block: 4 },
      thumbnailBytes: 24 * 1024,
      pauseDuckDb: 12,
      pauseDuckSeconds: 0.25,
    });
    expect(ui.intro).toEqual({ skipHoldSeconds: 1, skipShowSeconds: 1, skipFadeSeconds: 4 });
    expect(ui.dev).toEqual({ skipHours: 6, teleportTiles: 2, fpsSeconds: 1 });
  });
});

describe('pause stops the simulation, except when an enemy is aware (asked; DG-15)', () => {
  function session(aware: () => number) {
    const g = play('pause');
    wake(g.sim);
    const input = new InputMapper(DEFAULT_BINDINGS);
    return { ...g, input, session: new Session(g.sim, input, { awareHostiles: aware }) };
  }
  const press = (input: InputMapper, code: string): void => {
    input.keyDown(code);
    input.keyUp(code);
  };

  it('Escape, P and the pad’s Start open it; under the safe rule no tick runs, of any length', () => {
    expect(DEFAULT_BINDINGS.systemMenu).toEqual(
      expect.arrayContaining([
        { device: 'key', code: 'Escape' },
        { device: 'key', code: 'KeyP' },
        { device: 'pad', button: 9 },
      ]),
    );
    const s = session(() => 0);
    press(s.input, 'KeyP');
    s.session.frame(16);
    expect(s.session.menus.open).toBe('system');
    expect(s.session.menus.timeStopped).toBe(true);
    const hash = stateHash(s.world);
    const tick = s.world.tick;
    for (let i = 0; i < 600; i++) expect(s.session.frame(1000 / 60).ticks).toBe(0);
    expect(s.session.frame(5000).ticks).toBe(0);
    expect(stateHash(s.world)).toBe(hash);
    expect(s.world.tick).toBe(tick);
    // Closed: the game resumes on the next tick.
    press(s.input, 'Escape');
    expect(s.session.frame(1000 / 60).ticks).toBeGreaterThan(0);
    expect(s.world.tick).toBeGreaterThan(tick);
  });

  it('with a hostile aware it opens as an overlay over a running world', () => {
    let aware = 1;
    const s = session(() => aware);
    press(s.input, 'Escape');
    s.session.frame(16);
    expect(s.session.menus.open).toBe('system');
    expect(s.session.menus.timeStopped).toBe(false);
    const tick = s.world.tick;
    expect(s.session.frame(100).ticks).toBeGreaterThan(0);
    expect(s.world.tick).toBeGreaterThan(tick);
    aware = 0;
    expect(s.session.menus.open).toBe('system');
  });

  it('a hostile turning aware while it holds time starts time again, the menu staying open', () => {
    let aware = 0;
    const s = session(() => aware);
    press(s.input, 'Escape');
    s.session.frame(16);
    expect(s.session.menus.timeStopped).toBe(true);
    aware = 1;
    const tick = s.world.tick;
    expect(s.session.frame(100).ticks).toBeGreaterThan(0);
    expect(s.session.menus.open).toBe('system');
    expect(s.world.tick).toBeGreaterThan(tick);
  });

  it('a real aware enemy keeps the world running under the menu; an unaware one does not', () => {
    for (const aware of [true, false]) {
      const f = withFoe(`pause-foe-${String(aware)}`, aware);
      expect(hostilesAware(f.world.onFoot)).toBe(aware ? 1 : 0);
      const input = new InputMapper(DEFAULT_BINDINGS);
      const s = new Session(f.sim, input, {
        awareHostiles: () => hostilesAware(f.world.onFoot),
      });
      press(input, 'Escape');
      s.frame(16);
      expect(s.menus.timeStopped).toBe(!aware);
      const tick = f.world.tick;
      s.frame(200);
      expect(f.world.tick > tick).toBe(aware);
    }
  });

  it('Escape on a page of the menu goes back to its list; on the list it closes', () => {
    const s = session(() => 0);
    const menu = new PauseMenu();
    s.session.systemBack = () => {
      const closes = menu.back().some((a) => a.kind === 'close');
      return !closes;
    };
    press(s.input, 'Escape');
    s.session.frame(16);
    menu.open();
    menu.choose(PAUSE_ITEMS.indexOf('settings'), env(true));
    expect(menu.page).toBe('settings');
    press(s.input, 'Escape');
    s.session.frame(16);
    expect(menu.page).toBe('main');
    expect(s.session.menus.open).toBe('system');
    press(s.input, 'Escape');
    s.session.frame(16);
    expect(s.session.menus.open).toBeNull();
  });

  it('no other menu opens over it (its keys are its pages’)', () => {
    const s = session(() => 0);
    press(s.input, 'Escape');
    s.session.frame(16);
    press(s.input, 'KeyM');
    press(s.input, 'KeyI');
    s.session.frame(16);
    expect(s.session.menus.open).toBe('system');
  });
});

function env(safe: boolean, over: Partial<PauseEnv> = {}): PauseEnv {
  return {
    safe,
    fullscreen: false,
    slots: [
      { slot: 'AUTO', storeSlot: 'autosave-1', empty: false },
      { slot: 'MANUAL_1', storeSlot: null, empty: true },
      { slot: 'MANUAL_2', storeSlot: 'manual-2', empty: false },
      { slot: 'MANUAL_3', storeSlot: null, empty: true },
    ],
    hasDayStart: true,
    lastSavedAgo: 'moments',
    settings: [{ id: 'intro', group: 'intro', textKey: 'ui.settings.intro_play' }],
    controlRows: ACTIONS.length,
    ...over,
  };
}

describe('the pause menu’s items and pages (Book 2 section 02; DG-15 to DG-18)', () => {
  it('lists Resume, Save, Load, Settings, Fullscreen, Reset to the start of this day, Controls, Quit to title', () => {
    expect([...PAUSE_ITEMS]).toEqual([
      'resume',
      'save',
      'load',
      'settings',
      'fullscreen',
      'resetDay',
      'controls',
      'quit',
    ]);
  });

  it('load, reset and quit each ask once; saving over a used slot asks; an empty slot saves at once', () => {
    const m = new PauseMenu();
    m.open();
    for (const [item, key] of [
      ['resetDay', 'ui.save.confirm_reset'],
      ['quit', 'ui.save.confirm_quit'],
    ] as const) {
      m.open();
      m.choose(PAUSE_ITEMS.indexOf(item), env(true));
      expect(m.confirm?.key).toBe(key);
      expect(m.answer(false).some((a) => a.kind === item)).toBe(false);
      m.choose(PAUSE_ITEMS.indexOf(item), env(true));
      expect(m.answer(true).some((a) => a.kind === item)).toBe(true);
    }
    m.open();
    m.choose(PAUSE_ITEMS.indexOf('save'), env(true));
    expect(m.page).toBe('save');
    expect(m.choose(1, env(true))).toContainEqual({ kind: 'save', slot: 1 });
    expect(m.choose(2, env(true)).some((a) => a.kind === 'save')).toBe(false);
    expect(m.confirm?.key).toBe('ui.save.confirm_overwrite');
    expect(m.answer(true)).toContainEqual({ kind: 'save', slot: 2 });
    // The autosave is shown but cannot be saved to.
    expect(m.enabled(0, env(true))).toBe(false);
    expect(m.choose(0, env(true))).toEqual([]);
    m.open();
    m.choose(PAUSE_ITEMS.indexOf('load'), env(true));
    expect(m.enabled(1, env(true))).toBe(false);
    m.choose(2, env(true));
    expect(m.confirm?.key).toBe('ui.save.confirm_load');
    expect(m.answer(true)).toContainEqual({ kind: 'load', storeSlot: 'manual-2' });
  });

  it('reset is not offered without a day-start save', () => {
    const m = new PauseMenu();
    m.open();
    expect(m.enabled(PAUSE_ITEMS.indexOf('resetDay'), env(true, { hasDayStart: false }))).toBe(
      false,
    );
  });

  it('every action of the controls page has its name, and each binding is shown', () => {
    for (const a of ACTIONS) {
      const key = a.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      const name = /^slot\d+$/.test(a)
        ? 'ui.action.slot'
        : /^quick\d$/.test(a)
          ? 'ui.action.quick'
          : `ui.action.${key}`;
      expect(strings.has(name), a).toBe(true);
    }
  });

  it('every string the menu draws is in the menu lettering (no glyph missing)', () => {
    const palette = loadPalette();
    const font = compileFont(
      readFileSync(join(REPO_ROOT, 'assets/art/ui/font_menu.txt'), 'utf8'),
      'font_menu.txt',
      palette,
    );
    const keys = [...strings.keys()].filter((k) =>
      /^ui\.(pause|save|settings|controls|action|title\.(new_game|continue|load|settings|fullscreen)|intro|gore|season)\./.test(
        k,
      ),
    );
    const vars = {
      count: '3',
      day: '1',
      season: 'spring',
      time: '20:41',
      ago: '3 minutes',
      level: '80%',
      state: 'on',
      action: 'Run',
      key: 'H',
    };
    const missing = keys.flatMap((k) =>
      Array.from(t(k, vars)).filter((c) => c !== ' ' && !font.glyphs.has(c)),
    );
    expect([...new Set(missing)]).toEqual([]);
    // And the place names a slot shows.
    const places = [...strings.keys()].filter((k) => k.startsWith('place.name.sk_'));
    expect(
      places.flatMap((k) => Array.from(t(k)).filter((c) => c !== ' ' && !font.glyphs.has(c))),
    ).toEqual([]);
    // The menu composes at the logical size for every page, palette indices only.
    for (const page of ['main', 'save', 'load', 'settings', 'controls'] as const) {
      const m = new PauseMenu();
      m.open();
      m.page = page;
      const f = composePauseMenu(
        { palette, font },
        {
          menu: m,
          env: env(true),
          t,
          ago: (s) => agoText(s, t),
          running: false,
          backdrop: null,
          controls: [{ name: 'Run', keys: 'Shift', pad: 'L3' }],
          controlsNote: '',
        },
      );
      expect([f.image.width, f.image.height]).toEqual([640, 360]);
      expect(f.hits.length).toBeGreaterThan(0);
      expect([...f.image.pixels].every((p) => p === 255 || palette.entries[p] !== undefined)).toBe(
        true,
      );
    }
  });
});

describe('saving is refused while an enemy is aware (asked; Book 2 section 20)', () => {
  it('the manager refuses with its reason, and the menu says why in one line', () => {
    const f = withFoe('refuse', true);
    const saves = new SaveManager(new MemoryStore(), 'test');
    const r = saves.manualSave(f.world, 'manual-1', {
      awareHostiles: hostilesAware(f.world.onFoot),
    });
    expect(r).toMatchObject({ ok: false, reason: 'NOT_SAFE' });
    expect(saves.headers()).toEqual([]);
    const m = new PauseMenu();
    m.open();
    const acts = m.choose(PAUSE_ITEMS.indexOf('save'), env(false));
    expect(acts.some((a) => a.kind === 'save')).toBe(false);
    expect(m.note).toEqual({ key: 'ui.save.refused', refused: true });
    expect(t('ui.save.refused')).toBe('Not while an enemy is aware of you.');
    // From the save page too (an enemy turned aware while it was open).
    m.page = 'save';
    m.note = null;
    expect(m.choose(1, env(false)).some((a) => a.kind === 'save')).toBe(false);
    expect(m.note).toEqual({ key: 'ui.save.refused', refused: true });
  });
});

describe('save slots round-trip (asked; Book 2 section 20; DG-16)', () => {
  it('each of the three manual slots loads back the same world, with its day, time, place and screenshot', () => {
    const g = play('slots');
    wake(g.sim);
    const store = new MemoryStore();
    const saves = new SaveManager(store, 'test', () => '2026-11-13T10:00:00Z');
    const thumb = thumbnailOf();
    if (thumb === null) throw new Error('no thumbnail');
    expect([thumb.w, thumb.h]).toEqual([160, 90]);
    expect(thumb.data.length).toBeLessThanOrEqual(ui.menu.thumbnailBytes);
    for (let n = 1; n <= ui.menu.saveSlots; n++) {
      for (let i = 0; i < 90 * n; i++) g.sim.step();
      const hash = stateHash(g.world);
      const r = saves.manualSave(g.world, `manual-${n}`, { awareHostiles: 0 }, thumb);
      expect(r.ok).toBe(true);
      const loaded = saves.load(`manual-${n}`, { context: { balance } });
      expect(stateHash(loaded.state)).toBe(hash);
      const h = loaded.header;
      expect(h.day).toBe(g.world.calendar.day);
      expect(h.minuteOfDay).toBe(g.world.calendar.minuteOfDay);
      expect(h.season).toBe('Spring');
      expect(h.zone).toBe('ZONE_SK_STRAND');
      expect(h.placeKey).toBe('place.name.sk_wreck_strand');
      expect(t(h.placeKey ?? '')).toBe('Wreck Strand');
      // A loaded world plays on exactly as the one it was saved from.
      const again = createSimulation(b, loaded.state, land);
      const twin = createSimulation(b, structuredClone(g.world), land);
      for (let i = 0; i < 120; i++) {
        again.step();
        twin.step();
      }
      expect(stateHash(again.state)).toBe(stateHash(twin.state));
    }
    const views = saves.slotViews(ui.menu.saveSlots, Date.parse('2026-11-13T10:05:00Z'));
    expect(views.map((v) => v.slot)).toEqual(['AUTO', 'MANUAL_1', 'MANUAL_2', 'MANUAL_3']);
    for (const v of views.slice(1)) {
      expect(v.empty).toBe(false);
      expect(v.thumbnail?.data).toBe(thumb.data);
      expect(v.agoSeconds).toBe(300);
    }
    // The screenshot sits beside the header, outside the hashed world.
    const file = JSON.parse(store.get('manual-1') ?? '') as SaveFile;
    expect(file.thumbnail?.format).toBe('png');
    expect(readSave(file).header.stateHash).toBe(file.header.stateHash);
  });

  it('the autosave slot shows the newest autosave or checkpoint and cannot be saved to', () => {
    const g = play('auto');
    const saves = new SaveManager(new MemoryStore(), 'test');
    expect(saves.slotViews(3, 0)[0]).toMatchObject({ slot: 'AUTO', empty: true });
    saves.autosave(g.world, 'WAKING');
    g.sim.step();
    saves.checkpoint(g.world, 'dusk');
    saves.dayStart(g.world);
    const auto = saves.slotViews(3, 0)[0];
    expect(auto?.header?.kind).toBe('checkpoint');
    expect(auto?.storeSlot).toBe('checkpoint:dusk');
    // The day-start is never offered as the autosave, nor as game over's reload.
    expect(saves.latestRestorePoint()?.kind).toBe('checkpoint');
    expect(() => saves.manualSave(g.world, 'autosave-1', { awareHostiles: 0 })).toThrow();
  });

  it('an old save without a thumbnail or the new header fields lists and loads', () => {
    const g = play('old');
    const store = new MemoryStore();
    const old = writeSave(g.world, {
      build: 'old',
      kind: 'manual',
      slot: 'manual-2',
      sequence: 1,
      savedAt: '2026-11-12T00:00:00Z',
    });
    const header: Record<string, unknown> = { ...old.header };
    for (const k of ['minuteOfDay', 'season', 'zone', 'placeKey'])
      Reflect.deleteProperty(header, k);
    store.set('manual-2', JSON.stringify({ format: old.format, header, data: old.data }));
    const saves = new SaveManager(store, 'test');
    const v = saves.slotViews(3, Date.parse('2026-11-13T00:00:00Z'))[2];
    expect(v).toMatchObject({ slot: 'MANUAL_2', empty: false });
    expect(v?.thumbnail).toBeUndefined();
    expect(stateHash(saves.load('manual-2').state)).toBe(stateHash(g.world));
  });

  it('says how long ago in plain words', () => {
    expect(agoText(10, t)).toBe('moments');
    expect(agoText(70, t)).toBe('a minute');
    expect(agoText(540, t)).toBe('9 minutes');
    expect(agoText(3700, t)).toBe('an hour');
    expect(agoText(3 * 3600, t)).toBe('3 hours');
    expect(agoText(2 * 86400, t)).toBe('2 days');
  });
});

describe('reset to the start of this day restores the right state (asked; DG-17)', () => {
  it('on day 1 (the waking in the surf) and on a later day, after a sleep, keeping settings and every slot', () => {
    const g = play('reset-day', true);
    const store = new MemoryStore();
    const saves = new SaveManager(store, 'test');
    attachWakingAutosave(g.sim, saves);
    // The cold open to its end: the waking in the surf writes the day-start (as the view does).
    g.sim.events.on('WRECK', (e) => {
      if (e.what === 'WOKE') saves.dayStart(g.world);
    });
    while (wreckPhase(g.world) === 'COLD_OPEN') g.sim.step();
    const day1 = saves.dayStartHeader();
    expect(day1?.day).toBe(1);
    expect(day1?.kind).toBe('day-start');
    const day1Hash = day1?.stateHash;
    wake(g.sim);
    // A manual save and some settings this device keeps.
    saves.manualSave(g.world, 'manual-3', { awareHostiles: 0 });
    const settingsStore = new Map<string, string>([[SETTINGS_KEY, '{"version":1}']]);
    const kv = {
      getItem: (k: string) => settingsStore.get(k) ?? null,
      setItem: (k: string, v: string) => void settingsStore.set(k, v),
    };
    saveInterfaceSettings(kv, { ...DEFAULT_INTERFACE, introSeen: true });
    const settingsBefore = JSON.stringify([...settingsStore]);
    const manualBefore = store.get('manual-3');
    // Play on: walk, an hour passes.
    g.sim.submit({ type: 'MOVE', x: -1, y: 0, run: true, sneak: false });
    for (let i = 0; i < 20 * T; i++) g.sim.step();
    expect(stateHash(g.world)).not.toBe(day1Hash);
    // Reset: the day-start save loads, its hash the header's.
    g.sim.restore(saves.load(DAY_START_SLOT, { context: { balance } }).state);
    expect(stateHash(g.world)).toBe(day1Hash);
    expect(g.world.calendar.day).toBe(1);
    expect(store.get('manual-3')).toBe(manualBefore);
    expect(JSON.stringify([...settingsStore])).toBe(settingsBefore);
    expect(parseInterfaceSettings(settingsStore.get(INTERFACE_KEY) ?? null).introSeen).toBe(true);
    // A later day: the steerer stays up and drops at 02:00, waking at dawn (a sleep missed); the
    // waking writes the new day-start.
    wake(g.sim);
    g.world.calendar = { day: 1, minuteOfDay: 119 };
    const seen = { woke: false };
    g.sim.events.on('WOKE', () => {
      seen.woke = true;
    });
    for (let i = 0; i < 60 * T && !seen.woke; i++) g.sim.step();
    expect(seen.woke).toBe(true);
    const day2 = saves.dayStartHeader();
    expect(day2?.day).toBe(2);
    const day2Hash = day2?.stateHash;
    g.sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
    for (let i = 0; i < 10 * T; i++) g.sim.step();
    g.sim.restore(saves.load(DAY_START_SLOT, { context: { balance } }).state);
    expect(stateHash(g.world)).toBe(day2Hash);
    expect(g.world.calendar.day).toBe(2);
    // The rotating autosaves were not used for it: they are untouched by the reset.
    expect(saves.headers().filter((h) => h.slot === DAY_START_SLOT)).toHaveLength(1);
  });

  it('after a fight: the day-start is the morning’s, whatever the fight changed', () => {
    const f = withFoe('reset-fight', true);
    const saves = new SaveManager(new MemoryStore(), 'test');
    f.sim.step();
    const hash = stateHash(f.world);
    saves.dayStart(f.world);
    f.sim.submit({ type: 'DEV_KILL', target: 'E_WRECKER_CONN' });
    for (let i = 0; i < T; i++) f.sim.step();
    expect(f.world.onFoot?.actors['E_WRECKER_CONN']?.fight?.dead).not.toBeNull();
    f.sim.restore(saves.load(DAY_START_SLOT).state);
    expect(stateHash(f.world)).toBe(hash);
    expect(f.world.onFoot?.actors['E_WRECKER_CONN']?.fight?.dead).toBeNull();
  });
});

describe('fullscreen is offered on the title screen and in the menu (asked; DG-18)', () => {
  it('the title offers New game, Continue, Load, Settings and Fullscreen; Continue and Load need a save', () => {
    const none = titleItems(t, false, false);
    expect(none.map((i) => i.id)).toEqual([
      'newGame',
      'continue',
      'load',
      'settings',
      'fullscreen',
    ]);
    expect(none.map((i) => i.enabled)).toEqual([true, false, false, true, true]);
    expect(none[4]?.text).toBe('Fullscreen: off');
    expect(titleItems(t, true, true).map((i) => i.enabled)).toEqual([true, true, true, true, true]);
    expect(titleItems(t, true, true)[4]?.text).toBe('Fullscreen: on');
  });

  it('the pause menu’s Fullscreen toggles, under the safe rule or over a running world', () => {
    for (const safe of [true, false]) {
      const m = new PauseMenu();
      m.open();
      expect(m.choose(PAUSE_ITEMS.indexOf('fullscreen'), env(safe))).toContainEqual({
        kind: 'fullscreen',
      });
    }
  });
});

describe('skipping the intro (asked; DG-19)', () => {
  const timing = {
    holdSeconds: ui.intro.skipHoldSeconds,
    showSeconds: ui.intro.skipShowSeconds,
    fadeSeconds: ui.intro.skipFadeSeconds,
  };

  it('before it has been seen, holding or clicking never skips; only the title’s setting does', () => {
    const s = new SkipHold(timing);
    s.press(0);
    for (let k = 0; k <= 50; k++) expect(s.update(k / 10, k / 10, false, true).skip).toBe(false);
    expect(introSkippable(DEFAULT_INTERFACE)).toBe(false);
    expect(parseInterfaceSettings(JSON.stringify({ introSkip: true })).introSkip).toBe(true);
  });

  it('once seen, a hold of skipHold skips and a shorter one does not; the button skips once shown', () => {
    const s = new SkipHold(timing);
    s.press(2);
    expect(s.update(2.9, 2.9, true).skip).toBe(false);
    expect(s.update(2.9, 2.9, true).ring).toBeCloseTo(0.9, 5);
    s.releaseAll();
    expect(s.update(3.2, 3.2, true).skip).toBe(false);
    s.press(4);
    expect(s.update(5, 5, true).skip).toBe(true);
    const c = new SkipHold(timing);
    expect(c.update(0.5, 0.5, true, true).skip).toBe(false);
    expect(c.update(1.5, 1.5, true, true).skip).toBe(true);
    // The button shows a second in, then fades after a few seconds until a key is pressed.
    const v = new SkipHold(timing);
    expect(v.update(0.5, 0.5, true).alpha).toBe(0);
    expect(v.update(2, 2, true).alpha).toBe(1);
    expect(v.update(9, 9, true).alpha).toBe(0);
    v.press(10);
    v.releaseAll();
    expect(v.update(10.5, 10.5, true).alpha).toBe(1);
    expect(introSkippable({ ...DEFAULT_INTERFACE, introSeen: true })).toBe(true);
  });

  it('a skip lands on the same world as a cold open played through (the oar let go at the skip)', () => {
    for (const at of [0, 90, 400]) {
      const played = play('intro', true);
      const skipped = play('intro', true);
      // Both steer for a while; the player lets go at `at`; the skip comes at `at`.
      for (const g of [played, skipped]) {
        g.sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
        for (let i = 0; i < at; i++) g.sim.step();
        g.sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
      }
      // Played through: real time runs out the cold open.
      while (wreckPhase(played.world) === 'COLD_OPEN') played.sim.step();
      // Skipped: the view runs the rest unseen, at once (src/scenes/playView.ts skipColdOpen).
      for (let i = 0; i < 1_000_000 && wreckPhase(skipped.world) === 'COLD_OPEN'; i++)
        skipped.sim.step();
      expect(wreckPhase(skipped.world)).toBe('WAKING');
      expect(stateHash(skipped.world)).toBe(stateHash(played.world));
    }
  });
});

describe('the developer menu (asked; DG-21)', () => {
  it('is on only in a debug build or with ?dev in the address', () => {
    expect(devModeOn('', false)).toBe(false);
    expect(devModeOn('?view=play&capture', false)).toBe(false);
    expect(devModeOn('?dev', false)).toBe(true);
    expect(devModeOn('?view=play&dev', false)).toBe(true);
    expect(devModeOn('', true)).toBe(true);
  });

  it('skip 6 hours advances the clock by Book 10’s devSkipHours and marks the run', () => {
    const g = play('dev-skip');
    wake(g.sim);
    const before = g.world.calendar.day * 1440 + g.world.calendar.minuteOfDay;
    const marks = JSON.stringify(g.world.telemetry.marks);
    g.sim.submit({ type: 'DEV_SKIP', minutes: ui.dev.skipHours * 60 });
    g.sim.step();
    const after = g.world.calendar.day * 1440 + g.world.calendar.minuteOfDay;
    expect(after - before).toBeGreaterThanOrEqual(ui.dev.skipHours * 60);
    expect(after - before).toBeLessThan(ui.dev.skipHours * 60 + 2);
    expect(g.world.facts[FACT_DEV]).toBe(true);
    // The chapter's telemetry ignores the run from then on.
    for (let i = 0; i < 600; i++) g.sim.step();
    expect(JSON.stringify(g.world.telemetry.marks)).toBe(marks);
    // A save made after it is marked.
    const file = writeSave(g.world, {
      build: 't',
      kind: 'manual',
      slot: 'manual-1',
      sequence: 1,
      savedAt: '',
    });
    expect(file.header.dev).toBe(true);
    expect(
      writeSave(play('clean').world, {
        build: 't',
        kind: 'manual',
        slot: 'manual-1',
        sequence: 1,
        savedAt: '',
      }).header.dev,
    ).toBeUndefined();
  });

  it('skip is refused in a fight', () => {
    const f = withFoe('dev-fight', true);
    const battle = f.world.onFoot?.battle;
    if (battle != null) battle.engaged = true;
    const events: SimEvent[] = [];
    f.sim.events.onAny((e) => events.push(e));
    const day = f.world.calendar.minuteOfDay;
    f.sim.submit({ type: 'DEV_SKIP', minutes: 360 });
    f.sim.step();
    expect(f.world.calendar.minuteOfDay - day).toBeLessThan(2);
    expect(events.some((e) => e.type === 'COMMAND_REFUSED' && e.command === 'DEV_SKIP')).toBe(true);
  });

  it('teleport goes to the clicked tile if clear, else the nearest clear tile within 2, else refused', () => {
    const g = play('dev-tp');
    wake(g.sim);
    const p = g.world.onFoot?.player;
    if (p === undefined) throw new Error('no steerer');
    g.sim.submit({ type: 'DEV_TELEPORT', tile: { tx: 40, ty: 30 }, within: ui.dev.teleportTiles });
    g.sim.step();
    expect([Math.floor(p.x / TILE), Math.floor(p.y / TILE)]).toEqual([40, 30]);
    // A rock of the western outcrop: the nearest clear tile within two.
    g.sim.submit({ type: 'DEV_TELEPORT', tile: { tx: 39, ty: 36 }, within: ui.dev.teleportTiles });
    g.sim.step();
    expect(Math.hypot(p.x / TILE - 39.5, p.y / TILE - 36.75)).toBeLessThanOrEqual(
      2 * Math.SQRT2 + 0.1,
    );
    // The open sea, far from any ground: refused, and the steerer stays.
    const at = { x: p.x, y: p.y };
    const events: SimEvent[] = [];
    g.sim.events.onAny((e) => events.push(e));
    g.sim.submit({ type: 'DEV_TELEPORT', tile: { tx: 50, ty: 60 }, within: ui.dev.teleportTiles });
    g.sim.step();
    expect(events.some((e) => e.type === 'COMMAND_REFUSED' && e.command === 'DEV_TELEPORT')).toBe(
      true,
    );
    expect(Math.hypot(p.x - at.x, p.y - at.y)).toBeLessThan(2);
  });

  it('kill: the clicked enemy dies at once, and no deed is written', () => {
    const f = withFoe('dev-kill', true);
    const deedsBefore = JSON.stringify(f.world.ledger);
    f.sim.submit({ type: 'DEV_KILL', target: 'E_WRECKER_CONN' });
    f.sim.step();
    expect(f.world.onFoot?.actors['E_WRECKER_CONN']?.fight?.dead).not.toBeNull();
    expect(JSON.stringify(f.world.ledger)).toBe(deedsBefore);
    expect(f.world.facts[FACT_DEV]).toBe(true);
  });

  it('developer commands replay exactly', () => {
    const script: [number, Command][] = [
      [30, { type: 'DEV_TELEPORT', tile: { tx: 60, ty: 33 }, within: 2 }],
      [60, { type: 'MOVE', x: -1, y: 0, run: false, sneak: false }],
      [200, { type: 'DEV_SKIP', minutes: 360 }],
      [260, { type: 'MOVE', x: 0, y: 1, run: true, sneak: false }],
    ];
    const run = (): string => {
      const g = play('dev-replay');
      wake(g.sim);
      for (let i = 0; i < 400; i++) {
        for (const [at, c] of script) if (at === i) g.sim.submit(c);
        g.sim.step();
      }
      return stateHash(g.world);
    };
    expect(run()).toBe(run());
  });
});

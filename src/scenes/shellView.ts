/**
 * The Stage 5 check view (?view=shell): controls, menus under the safe rule, the command ring,
 * the text overlay, music states, stingers, effects and captions, around a running clock.
 * Keys: 1-6 orders, hold Tab for the ring, M I B J menus, Esc system menu, H test hostile,
 * P next music state, O stinger, K horn, L parry, F2 then a key rebinds Interact, T hold-or-toggle
 * for Run. The overlay root carries data-* attributes the browser tests read.
 */
import audioJson from '../../content/audio.json';
import balanceJson from '../../content/balance.json';
import { AudioRouter } from '../audio/router.ts';
import { WebAudioEngine } from '../audio/webAudio.ts';
import { parseTimeBalance } from '../content/balance.ts';
import { parseAudioTable } from '../content/registry.ts';
import { formatString } from '../content/strings.ts';
import type { StringTable } from '../content/strings.ts';
import { bindingLabel, rebind } from '../input/actions.ts';
import type { Action } from '../input/actions.ts';
import { attachBrowserInput } from '../input/browserInput.ts';
import type { CrewOrder } from '../input/commandRing.ts';
import { InputMapper } from '../input/inputState.ts';
import { loadSettings, saveSettings } from '../input/settingsStore.ts';
import type { ControlSettings } from '../input/settingsStore.ts';
import { createIndexedImage, toRgba } from '../render/indexedImage.ts';
import { paletteIndex } from '../render/palette.ts';
import type { Palette } from '../render/palette.ts';
import type { Presenter } from '../render/presenter.ts';
import { clockText } from '../sim/calendar/calendar.ts';
import { createSimulation } from '../sim/simulation.ts';
import { emptyWorld } from '../sim/world.ts';
import { createOverlay, showCaptions } from '../ui/overlay.ts';
import type { MenuId } from '../ui/menus.ts';
import { Session } from './session.ts';

const MUSIC_CYCLE = [
  'MUS_HOME_DAWN',
  'MUS_HOME_DAY',
  'MUS_HOME_DUSK',
  'MUS_HOME_NIGHT',
  'MUS_RAID_APPROACH',
  'MUS_RAID_ALARM',
  'MUS_COMBAT_1',
] as const;

/** A store that survives blocked storage (private windows): it simply forgets. */
function safeStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  return {
    getItem: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      localStorage.setItem(k, v);
    },
  };
}

export function shellViewRequested(search: string): boolean {
  return new URLSearchParams(search).get('view') === 'shell';
}

export function showShellView(
  canvas: HTMLCanvasElement,
  presenter: Presenter,
  palette: Palette,
  strings: StringTable,
): void {
  const t = (key: string, vars: Record<string, string> = {}): string =>
    formatString(strings, key, vars);
  const store = safeStorage();
  let settings: ControlSettings = loadSettings(store);
  const input = new InputMapper(settings.bindings, settings.toggle);
  let hostile = false;
  const b = parseTimeBalance(balanceJson);
  const session = new Session(createSimulation(b, emptyWorld('shell', b)), input, {
    awareHostiles: () => (hostile ? 1 : 0),
  });
  WebAudioEngine.prepare();
  const audioTable = parseAudioTable(audioJson);
  const engine = new WebAudioEngine(audioTable.cues);
  const audio = new AudioRouter(audioTable, strings, engine);
  const overlay = createOverlay(document);
  const root = overlay.root;
  let musicAt = 0;
  let rebinding = false;
  let notice = '';
  let lastOrder: CrewOrder | null = null;

  // A plain night-water frame behind the overlay.
  presenter.present(toRgba(createIndexedImage(640, 360, paletteIndex(palette, 'N')), palette));

  const saveAndApply = (next: ControlSettings): void => {
    settings = next;
    input.setBindings(next.bindings);
    input.setToggle(next.toggle);
    saveSettings(store, next);
  };

  const browser = attachBrowserInput(window, canvas, input, {
    firstInput: () => {
      if (!engine.unlocked) {
        engine.unlock();
        audio.play(MUSIC_CYCLE[0], engine.now);
        audio.setPlace('ZONE_SK_STRAND', 'day', engine.now);
      }
    },
    rawKey: (code) => {
      if (rebinding) {
        rebinding = false;
        const { bindings, displaced } = rebind(settings.bindings, 'interact', {
          device: 'key',
          code,
        });
        saveAndApply({ ...settings, bindings });
        const key = bindingLabel({ device: 'key', code });
        notice =
          displaced.length > 0
            ? t('ui.shell.displaced', { key, others: displaced.join(', ') })
            : t('ui.shell.rebound', { key });
        return true;
      }
      switch (code) {
        case 'F2':
          rebinding = true;
          notice = t('ui.shell.rebind');
          return true;
        case 'KeyH':
          hostile = !hostile;
          return true;
        case 'KeyT': {
          const toggle: Action[] = settings.toggle.includes('run')
            ? settings.toggle.filter((a) => a !== 'run')
            : [...settings.toggle, 'run'];
          saveAndApply({ ...settings, toggle });
          return true;
        }
        case 'KeyP':
          musicAt = (musicAt + 1) % MUSIC_CYCLE.length;
          audio.play(MUSIC_CYCLE[musicAt] ?? MUSIC_CYCLE[0], engine.now);
          return true;
        case 'KeyO':
          audio.event('ALARM_HORN', engine.now);
          return true;
        case 'KeyK':
          audio.event('HORN_BLOWN', engine.now, { direction: 'n', pan: 0 });
          return true;
        case 'KeyL':
          audio.event('PARRY', engine.now);
          return true;
        default:
          return false;
      }
    },
  });

  const keys = (action: Action): string => settings.bindings[action].map(bindingLabel).join(', ');
  const menuName = (m: MenuId): string => t(`ui.menu.name.${m}`);
  const orderName = (o: CrewOrder): string => t(`ui.ring.order.${o.toLowerCase()}`);

  let last = performance.now();
  const frame = (now: number): void => {
    browser.poll();
    const result = session.frame(now - last, browser.aim());
    last = now;
    for (const r of result.menuResults) {
      if (!r.ok)
        notice = t(r.aware === 1 ? 'ui.menu.refused' : 'ui.menu.refused_many', {
          count: String(r.aware),
        });
      else notice = '';
    }
    if (result.orders.length > 0) lastOrder = result.orders.at(-1) ?? null;
    const captions = audio.update(engine.now);

    const open = session.menus.open;
    overlay.region('menu').textContent =
      open === null
        ? ''
        : t(session.menus.timeStopped ? 'ui.menu.open' : 'ui.menu.overlay', {
            menu: menuName(open),
          });
    const ring = session.ring.state;
    overlay.region('ring').textContent = ring.open
      ? t('ui.ring.open', {
          selected: ring.selected === null ? t('ui.ring.none') : orderName(ring.selected),
        })
      : lastOrder === null
        ? ''
        : t('ui.ring.issued', { order: orderName(lastOrder) });
    showCaptions(overlay.region('captions'), captions, true);

    const state = session.sim.state;
    overlay.region('panel').textContent = [
      t('ui.shell.title'),
      t('ui.shell.help'),
      t('ui.shell.status', {
        tick: String(state.tick),
        time: clockText(state.calendar.minuteOfDay),
        hostile: t(hostile ? 'ui.value.yes' : 'ui.value.no'),
        music: audio.director.state ?? t('ui.value.none'),
      }),
      t('ui.shell.binding', {
        keys: keys('interact'),
        run: t(settings.toggle.includes('run') ? 'ui.mode.toggle' : 'ui.mode.hold'),
      }),
      engine.unlocked ? t('ui.shell.audio_on') : t('ui.shell.audio_locked'),
    ].join('\n');
    overlay.region('prompt').textContent = notice;

    root.dataset['tick'] = String(state.tick);
    root.dataset['menu'] = open ?? '';
    root.dataset['time'] = session.menus.timeStopped ? 'stopped' : 'running';
    root.dataset['ring'] = ring.open ? 'open' : 'closed';
    root.dataset['order'] = lastOrder ?? '';
    root.dataset['interact'] = keys('interact');
    root.dataset['captions'] = captions.map((c) => c.cue).join(' ');
    overlay.fit(presenter.viewport, window.devicePixelRatio);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  canvas.dataset['state'] = 'shell';
}

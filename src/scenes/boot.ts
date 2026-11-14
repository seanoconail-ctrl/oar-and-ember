/**
 * The Boot mode (Book 2 section 02): load what the title needs, start the presenter, then hand
 * over to Title. The title waits for any key or click, then the naming screen, then play on
 * Wreck Strand (Stage 6). `?view=play&name=<name>&body=A|B` starts play directly (tests and
 * screenshots); `?view=shell`, `?view=art-test` and `?view=sheet` are the earlier check views.
 */
import { formatString } from '../content/strings.ts';
import { toRgba } from '../render/indexedImage.ts';
import { paletteIndex } from '../render/palette.ts';
import { createPresenter } from '../render/presenter.ts';
import type { Presenter } from '../render/presenter.ts';
import { artViewRequested, showArtView } from './artView.ts';
import { loadAtlases } from './atlases.ts';
import { bundledContent } from './bundledContent.ts';
import { showNaming } from './namingView.ts';
import type { NamingChoice } from './namingView.ts';
import { WebAudioEngine } from '../audio/webAudio.ts';
import { preparePlay, startPlay } from './playView.ts';
import type { PreparedPlay } from './playView.ts';
import { bundledStrings, bundledTitleArt } from './bundledArt.ts';
import { shellViewRequested, showShellView } from './shellView.ts';
import { composeTitleFrame } from './title.ts';
import { TitleMenuView } from './titleMenu.ts';
import { browserSaves } from '../persist/browserSaves.ts';
import { parseInterfaceBalance } from '../content/interfaceBalance.ts';
import { loadInterfaceSettings, saveInterfaceSettings } from '../input/interfaceSettings.ts';
import type { KeyValueStore } from '../input/settingsStore.ts';
import { isFullscreen, toggleFullscreen } from '../ui/fullscreen.ts';
import type { WorldState } from '../sim/world.ts';

export interface BootElements {
  readonly canvas: HTMLCanvasElement;
  /** Shown, as plain text, only when the game cannot start. */
  readonly notice: HTMLElement;
}

/**
 * The canvas size in device pixels: CSS size times the pixel ratio, or the browser's exact
 * device-pixel size when it reports one that agrees (it avoids a rounding error of one pixel).
 * Some browsers, including emulated and headless ones, report CSS pixels as "device pixels";
 * trusting those would let the browser stretch the canvas and blur the art.
 */
export function deviceSize(
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
  exact?: { readonly inlineSize: number; readonly blockSize: number },
): { width: number; height: number } {
  const width = Math.round(cssWidth * pixelRatio);
  const height = Math.round(cssHeight * pixelRatio);
  if (
    exact !== undefined &&
    Math.abs(exact.inlineSize - width) <= 1 &&
    Math.abs(exact.blockSize - height) <= 1
  ) {
    return { width: exact.inlineSize, height: exact.blockSize };
  }
  return { width, height };
}

/** Measures the canvas in device pixels and keeps the presenter sized to it. */
function trackSize(canvas: HTMLCanvasElement, presenter: Presenter): void {
  const measure = (exact?: ResizeObserverSize): void => {
    const rect = canvas.getBoundingClientRect();
    const size = deviceSize(rect.width, rect.height, window.devicePixelRatio, exact);
    presenter.resize(size.width, size.height);
  };
  const observer = new ResizeObserver((entries) => {
    // Safari's entries have no devicePixelContentBoxSize at all.
    const sizes: readonly ResizeObserverSize[] | undefined = entries[0]?.devicePixelContentBoxSize;
    measure(sizes?.[0]);
  });
  try {
    // Exact device pixels where supported (Chromium).
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(canvas);
  }
  // Re-measure when the pixel ratio changes (browser zoom, or a window moved to another screen).
  const watchRatio = (): void => {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        measure();
        watchRatio();
      },
      { once: true },
    );
  };
  watchRatio();
  measure();
}

/**
 * Start-up steps, recorded on the canvas as `data-boot` so a browser that stalls can be diagnosed
 * from outside (the browser smoke tests report it). `data-state` is the outcome: `title` or
 * `no-webgl2`; an exception is recorded as `data-error`.
 */
export type BootStep =
  'strings' | 'art' | 'presenter' | 'frame' | 'size' | 'painted' | 'naming' | 'atlases' | 'play';

export function boot(elements: BootElements, buildId: string): void {
  const { canvas } = elements;
  const step = (name: BootStep): void => {
    canvas.dataset['boot'] = name;
  };
  try {
    start(elements, buildId, step);
  } catch (error) {
    canvas.dataset['error'] = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

function start(elements: BootElements, buildId: string, step: (name: BootStep) => void): void {
  const { canvas, notice } = elements;
  step('strings');
  const strings = bundledStrings();
  step('art');
  const art = bundledTitleArt();
  const name = formatString(strings, 'ui.title.name');
  document.title = name;
  canvas.dataset['build'] = buildId;
  canvas.setAttribute(
    'aria-label',
    formatString(strings, 'ui.title.screen_label', { build: buildId }),
  );

  step('presenter');
  const letterbox = art.palette.entries[paletteIndex(art.palette, art.layout.letterbox)];
  const presenter = letterbox === undefined ? null : createPresenter(canvas, letterbox.rgb);
  if (presenter === null) {
    canvas.hidden = true;
    notice.textContent = formatString(strings, 'ui.boot.webgl2_missing');
    notice.hidden = false;
    canvas.dataset['state'] = 'no-webgl2';
    return;
  }

  if (shellViewRequested(location.search)) {
    // The Stage 5 controls, menus and sound check (see src/scenes/shellView.ts).
    step('frame');
    trackSize(canvas, presenter);
    showShellView(canvas, presenter, art.palette, strings);
    step('painted');
    return;
  }

  if (artViewRequested(location.search)) {
    // A renderer check view instead of the title (see src/scenes/artView.ts).
    step('frame');
    trackSize(canvas, presenter);
    showArtView(location.search, presenter, art.palette).then(
      (label) => {
        canvas.setAttribute('aria-label', label);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            step('painted');
            canvas.dataset['state'] = 'art';
          });
        });
      },
      (error: unknown) => {
        canvas.dataset['error'] = error instanceof Error ? error.message : String(error);
      },
    );
    return;
  }

  const fail = (error: unknown): void => {
    canvas.dataset['error'] = error instanceof Error ? error.message : String(error);
  };
  let content: ReturnType<typeof bundledContent> | null = null;
  const contentNow = (): ReturnType<typeof bundledContent> => (content ??= bundledContent());
  // The play renderer, prepared while the title shows (decision AP-18).
  let prepared: PreparedPlay | null = null;
  // Set on waking: preparation still unfinished then stops, so it never competes with play.
  let woken = false;
  const play = (choice: NamingChoice, wokeAt: number, load: WorldState | null = null): void => {
    woken = true;
    step('atlases');
    loadAtlases().then((atlases) => {
      step('play');
      startPlay(canvas, presenter, art.palette, strings, contentNow(), atlases, choice, {
        seed: load?.seed ?? `campaign-${Math.floor(wokeAt)}`,
        wokeAt,
        prepared,
        load,
      });
    }, fail);
  };
  const t = (key: string, vars: Readonly<Record<string, string>> = {}): string =>
    formatString(strings, key, { ...vars });
  // The device's save slots (DG-16): Continue, Load, and a load across campaigns (`?load=`).
  const saves = browserSaves(buildId);
  const loadSlot = (slot: string): void => {
    try {
      const { state } = saves.load(slot, { context: { balance: contentNow().balance } });
      step('frame');
      canvas.dataset['state'] = 'loading';
      play(
        { name: state.player.name, bodyModel: state.player.bodyModel ?? 'A' },
        performance.now(),
        state,
      );
    } catch (error) {
      fail(error);
    }
  };

  const params = new URLSearchParams(location.search);
  const loadParam = params.get('load');
  if (loadParam !== null) {
    trackSize(canvas, presenter);
    loadSlot(loadParam);
    return;
  }
  if (params.get('view') === 'play') {
    step('frame');
    trackSize(canvas, presenter);
    const body = params.get('body') === 'B' ? 'B' : 'A';
    const nameParam = params.get('name');
    play(
      { name: nameParam ?? formatString(strings, 'ui.naming.name_default'), bodyModel: body },
      performance.now(),
    );
    return;
  }

  step('frame');
  const frame = composeTitleFrame(art, {
    name,
    buildLine: formatString(strings, 'ui.title.build', { build: buildId }),
  });
  const titleRgba = toRgba(frame, art.palette);
  presenter.present(titleRgba);
  step('size');
  trackSize(canvas, presenter);
  // Mark the title as shown once the browser has painted it.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      step('painted');
      canvas.dataset['state'] = 'title';
    });
  });

  // The atlases load while the title shows, so waking needs no wait.
  const atlasesReady = loadAtlases();
  // Once the title is painted, the play renderer is prepared behind it (AP-18): drawn once, then
  // the title is presented again in the same task, so the player never sees the hidden frame.
  let onTitle = true;
  const painted = new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
  Promise.all([atlasesReady, painted]).then(([atlases]) => {
    // The instruments' samples are made in the background too (decision AU-11).
    WebAudioEngine.prepare();
    const steps = preparePlay(presenter, art.palette, contentNow(), atlases, {
      name: formatString(strings, 'ui.naming.name_default'),
      bodyModel: 'A',
    });
    // Each step's cost in ms, on the canvas as data-prepare, for diagnosing slow machines.
    const costs: Record<string, number> = {};
    const next = (): void => {
      if (woken) {
        canvas.dataset['prepared'] = prepared === null ? 'unfinished' : 'ready';
        return;
      }
      const startedAt = performance.now();
      let done = false;
      try {
        const step = steps.next();
        if (step.done === true) {
          prepared = step.value;
          done = true;
        } else costs[step.value] = Math.round(performance.now() - startedAt);
      } catch {
        // Not fatal: play builds its own renderer on waking, as before.
        done = true;
      }
      if (onTitle) presenter.present(titleRgba);
      canvas.dataset['prepare'] = JSON.stringify(costs);
      if (done) canvas.dataset['prepared'] = prepared === null ? 'failed' : 'ready';
      else setTimeout(next, 0);
    };
    setTimeout(next, 0);
  }, fail);
  // The title's menu (DG-18): New game, Continue, Load, Settings and Fullscreen.
  const store = ((): KeyValueStore => {
    try {
      return localStorage;
    } catch {
      return { getItem: () => null, setItem: () => undefined };
    }
  })();
  let iface = loadInterfaceSettings(store);
  const startNew = (): void => {
    onTitle = false;
    step('naming');
    canvas.dataset['state'] = 'naming';
    atlasesReady.then(
      (atlases) =>
        showNaming(document, strings, atlases).then((choice) => {
          play(choice, performance.now());
        }),
      fail,
    );
  };
  const menu = new TitleMenuView(document, {
    palette: art.palette,
    t,
    saves,
    saveSlots: parseInterfaceBalance(contentNow().balance).menu.saveSlots,
    fullscreen: () => isFullscreen(document),
    introSkip: () => iface.introSkip,
    newGame: startNew,
    load: (slot) => {
      onTitle = false;
      loadSlot(slot);
    },
    toggleFullscreen: () => {
      void toggleFullscreen(document).then((on) => {
        iface = { ...iface, fullscreen: on };
        saveInterfaceSettings(store, iface);
        menu.draw();
      });
    },
    toggleIntro: () => {
      iface = { ...iface, introSkip: !iface.introSkip };
      saveInterfaceSettings(store, iface);
    },
    click: () => undefined,
  });
  menu.draw();
  const keepFitted = (): void => {
    if (!onTitle) return;
    menu.fit(presenter.viewport, window.devicePixelRatio);
    menu.pollPad();
    requestAnimationFrame(keepFitted);
  };
  keepFitted();
}

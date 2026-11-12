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
  const play = (choice: NamingChoice, wokeAt: number): void => {
    woken = true;
    step('atlases');
    loadAtlases().then((atlases) => {
      step('play');
      startPlay(canvas, presenter, art.palette, strings, contentNow(), atlases, choice, {
        seed: `campaign-${Math.floor(wokeAt)}`,
        wokeAt,
        prepared,
      });
    }, fail);
  };

  const params = new URLSearchParams(location.search);
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

  // Any key or click leaves the title for the naming screen.
  const press = document.createElement('p');
  press.className = 'oe-press';
  press.textContent = formatString(strings, 'ui.title.start');
  press.style.cssText =
    'position:fixed;left:0;right:0;bottom:8%;margin:0;text-align:center;color:#f4efe4;' +
    'font-family:system-ui,sans-serif;font-size:1.1em;text-shadow:0 1px 0 #22313a;pointer-events:none';
  document.body.append(press);
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
  const leave = (e: Event): void => {
    if (e instanceof KeyboardEvent && (e.repeat || e.key === 'Tab')) return;
    // The key that leaves the title must not also act on the naming screen it opens.
    e.preventDefault();
    window.removeEventListener('keydown', leave);
    canvas.removeEventListener('pointerdown', leave);
    press.remove();
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
  window.addEventListener('keydown', leave);
  canvas.addEventListener('pointerdown', leave);
}

/**
 * The Boot mode (Book 2 section 02): load what the title needs, start the presenter, then hand
 * over to Title. Stage 1 has no tick loop yet (Stage 2): the title frame is static and redrawn
 * only when the window or its pixel density changes.
 */
import { formatString } from '../content/strings.ts';
import { toRgba } from '../render/indexedImage.ts';
import { paletteIndex } from '../render/palette.ts';
import { createPresenter } from '../render/presenter.ts';
import type { Presenter } from '../render/presenter.ts';
import { artViewRequested, showArtView } from './artView.ts';
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
    // Exact device pixels where supported (Chromium, Firefox).
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
export type BootStep = 'strings' | 'art' | 'presenter' | 'frame' | 'size' | 'painted';

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

  step('frame');
  const frame = composeTitleFrame(art, {
    name,
    buildLine: formatString(strings, 'ui.title.build', { build: buildId }),
  });
  presenter.present(toRgba(frame, art.palette));
  step('size');
  trackSize(canvas, presenter);
  // Mark the title as shown once the browser has painted it.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      step('painted');
      canvas.dataset['state'] = 'title';
    });
  });
}

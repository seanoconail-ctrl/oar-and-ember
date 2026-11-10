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
import { bundledStrings, bundledTitleArt } from './bundledArt.ts';
import { composeTitleFrame } from './title.ts';

export interface BootElements {
  readonly canvas: HTMLCanvasElement;
  /** Shown, as plain text, only when the game cannot start. */
  readonly notice: HTMLElement;
}

/** Measures the canvas in device pixels and keeps the presenter sized to it. */
function trackSize(canvas: HTMLCanvasElement, presenter: Presenter): void {
  const fallback = (): void => {
    const rect = canvas.getBoundingClientRect();
    presenter.resize(
      Math.round(rect.width * window.devicePixelRatio),
      Math.round(rect.height * window.devicePixelRatio),
    );
  };
  const observer = new ResizeObserver((entries) => {
    // Safari's entries have no devicePixelContentBoxSize at all.
    const sizes: readonly ResizeObserverSize[] | undefined = entries[0]?.devicePixelContentBoxSize;
    const exact = sizes?.[0];
    if (exact !== undefined) presenter.resize(exact.inlineSize, exact.blockSize);
    else fallback();
  });
  try {
    // Exact device pixels where supported (Chromium, Firefox).
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    // Safari: CSS size times pixel ratio, and re-measure when the ratio changes.
    observer.observe(canvas);
    const watchRatio = (): void => {
      matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
        'change',
        () => {
          fallback();
          watchRatio();
        },
        { once: true },
      );
    };
    watchRatio();
  }
  fallback();
}

export function boot(elements: BootElements, buildId: string): void {
  const { canvas, notice } = elements;
  const strings = bundledStrings();
  const art = bundledTitleArt();
  const name = formatString(strings, 'ui.title.name');
  document.title = name;
  canvas.dataset['build'] = buildId;
  canvas.setAttribute(
    'aria-label',
    formatString(strings, 'ui.title.screen_label', { build: buildId }),
  );

  const letterbox = art.palette.entries[paletteIndex(art.palette, art.layout.letterbox)];
  const presenter = letterbox === undefined ? null : createPresenter(canvas, letterbox.rgb);
  if (presenter === null) {
    canvas.hidden = true;
    notice.textContent = formatString(strings, 'ui.boot.webgl2_missing');
    notice.hidden = false;
    canvas.dataset['state'] = 'no-webgl2';
    return;
  }

  const frame = composeTitleFrame(art, {
    name,
    buildLine: formatString(strings, 'ui.title.build', { build: buildId }),
  });
  presenter.present(toRgba(frame, art.palette));
  trackSize(canvas, presenter);
  // Mark the title as shown once the browser has painted it.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      canvas.dataset['state'] = 'title';
    });
  });
}

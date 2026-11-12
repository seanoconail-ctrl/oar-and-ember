/**
 * The text overlay (Book 7 section 01: UI text may render on an accessible overlay at native
 * resolution, never blurred into the pixel layer). Real HTML text placed over the frame, so it is
 * sharp at any scale, readable by screen readers and sized by the text-size option (100 to 200
 * percent, Book 2 section 21).
 */
import type { Viewport } from '../render/viewport.ts';

export const TEXT_SIZE_RANGE = { min: 100, max: 200 } as const;

export interface Overlay {
  readonly root: HTMLElement;
  /** Places the overlay over the frame: `viewport` in device pixels. */
  fit(viewport: Viewport, devicePixelRatio: number): void;
  setTextSize(percent: number): void;
  /** A named text region (created on first use). */
  region(
    name:
      | 'captions'
      | 'menu'
      | 'ring'
      | 'prompt'
      | 'panel'
      | 'slot'
      | 'refusal'
      | 'tip'
      | 'help'
      | 'clock'
      | 'stamina'
      | 'report'
      | 'talk'
      | 'gameover'
      | 'fade'
      | 'launch'
      | 'seamap'
      | 'timings',
  ): HTMLElement;
}

const STYLE = `
.oe-overlay { position: fixed; pointer-events: none; color: #f4efe4;
  font-family: system-ui, 'Segoe UI', Roboto, 'Noto Sans', 'DejaVu Sans', sans-serif; font-synthesis: none;
  text-shadow: 0 1px 0 #22313a, 1px 0 0 #22313a, 0 -1px 0 #22313a, -1px 0 0 #22313a; }
.oe-overlay [data-region] { position: absolute; left: 4%; right: 4%; }
.oe-overlay [data-region=captions] { bottom: 9.4%; text-align: center; font-size: 1em; line-height: 1.15; }
.oe-overlay [data-region=captions] p { margin: 0.1em auto; display: table; padding: 0.05em 0.5em;
  background: rgba(34, 49, 58, 0.85); border-radius: 2px; }
.oe-overlay [data-region=captions] p.info { font-style: italic; background: rgba(34, 49, 58, 0.7); }
.oe-overlay [data-region=captions] p.speech { font-style: normal; }
.oe-overlay [data-region=captions] .oe-slot { position: relative; }
.oe-overlay [data-region=captions] .oe-slot p.out { position: absolute; left: 50%; top: 0; margin: 0;
  transform: translateX(-50%); white-space: nowrap; }
.oe-overlay [data-region=prompt] { bottom: 24%; text-align: center; }
.oe-overlay [data-region=slot] { bottom: 2.2%; left: 1%; right: auto; width: 24%; text-align: right;
  font-size: 0.8em; }
.oe-overlay [data-region=refusal] { right: auto; font-size: 0.8em; white-space: nowrap;
  transform: translateY(-100%); color: #f2b8a0; }
.oe-overlay [data-region=menu] { top: 30%; text-align: center; font-size: 1.3em; }
.oe-overlay [data-region=menu]:not(:empty) { background: rgba(58, 38, 22, 0.88); border: 2px solid #7b5434;
  padding: 0.6em; }
.oe-overlay [data-region=ring] { top: 42%; text-align: center; font-size: 1.1em; }
.oe-overlay [data-region=tip] { top: 6%; left: auto; right: 3%; width: 42%; font-size: 0.85em;
  line-height: 1.35; }
.oe-overlay [data-region=tip]:not(:empty) { background: rgba(34, 49, 58, 0.9); border: 2px solid #7b5434;
  padding: 0.5em 0.7em; }
.oe-overlay [data-region=tip] strong { display: block; color: #f0ad4c; }
.oe-overlay [data-region=help] { top: 12%; left: 12%; right: 12%; font-size: 0.9em; line-height: 1.4; }
.oe-overlay [data-region=help]:not(:empty) { background: rgba(58, 38, 22, 0.94); border: 2px solid #7b5434;
  padding: 0.6em 0.9em; }
.oe-overlay [data-region=help] p { margin: 0.3em 0; }
.oe-overlay [data-region=help] h2 { margin: 0 0 0.3em; font-size: 1.2em; }
.oe-overlay [data-region=panel] { top: 3%; font-size: 0.85em; line-height: 1.4; white-space: pre-wrap; }
.oe-overlay [data-region=clock] { top: 1.6%; left: 3.4%; right: auto; font-size: 0.8em; white-space: nowrap; }
.oe-overlay [data-region=stamina] { top: 11.4%; left: 0.9%; right: auto; font-size: 0.72em; white-space: nowrap;
  color: #e9d7b8; }
.oe-overlay [data-region=report] { top: 14%; left: 18%; right: 18%; font-size: 0.95em; line-height: 1.45; }
.oe-overlay [data-region=report]:not(:empty) { background: rgba(58, 38, 22, 0.94); border: 2px solid #7b5434;
  padding: 0.7em 1em; }
.oe-overlay [data-region=report] h2 { margin: 0 0 0.4em; font-size: 1.2em; color: #f0ad4c; }
.oe-overlay [data-region=report] p { margin: 0.25em 0; }
.oe-overlay [data-region=gameover] { top: 28%; left: 22%; right: 22%; text-align: center; font-size: 1.05em;
  line-height: 1.5; }
.oe-overlay [data-region=gameover]:not(:empty) { background: rgba(40, 20, 16, 0.94); border: 2px solid #7b5434;
  padding: 0.9em 1.2em; pointer-events: auto; z-index: 2; }
.oe-overlay [data-region=gameover] p.choice { cursor: pointer; color: #f0ad4c; }
.oe-overlay [data-region=gameover] h2 { margin: 0 0 0.4em; font-size: 1.4em; color: #f0ad4c; }
.oe-overlay [data-region=gameover] p { margin: 0.3em 0; }
.oe-overlay [data-region=talk] { top: 36%; left: auto; right: 3%; width: 44%; font-size: 0.88em;
  line-height: 1.4; }
.oe-overlay [data-region=talk]:not(:empty) { background: rgba(34, 49, 58, 0.9); border: 2px solid #7b5434;
  padding: 0.5em 0.8em; }
.oe-overlay [data-region=talk] h2 { margin: 0 0 0.3em; font-size: 1em; color: #f0ad4c; }
.oe-overlay [data-region=talk] p { margin: 0.2em 0; }
.oe-overlay [data-region=talk] p.line { font-style: normal; margin-bottom: 0.45em; }
.oe-overlay [data-region=talk] p.info { font-style: italic; margin-bottom: 0.45em; }
.oe-overlay [data-region=talk] ol { margin: 0; padding-left: 1.4em; }
.oe-overlay [data-region=talk] li.chosen { color: #f0ad4c; }
.oe-overlay [data-region=talk] p.hint { font-size: 0.85em; color: #e9d7b8; }
.oe-overlay [data-region=launch] { top: 0; bottom: 0; }
.oe-overlay [data-region=timings] { top: 0; bottom: 0; }
.oe-overlay [data-region=seamap] { top: 0; bottom: 0; left: 0; right: 0; }
.oe-overlay [data-region=seamap] .label { position: absolute; transform: translate(-50%, 0); font-size: 0.8em;
  white-space: nowrap; font-style: italic; color: #f4efe4; }
.oe-overlay [data-region=seamap] .label.home { font-style: normal; font-weight: 600; }
.oe-overlay [data-region=seamap] .title { position: absolute; top: 3%; left: 0; right: 0; text-align: center;
  font-size: 1.2em; color: #f0ad4c; }
.oe-overlay [data-region=seamap] .foot { position: absolute; bottom: 3%; left: 0; right: 0; text-align: center;
  font-size: 0.85em; }
.oe-overlay [data-region=seamap] .foot p { margin: 0.2em auto; display: table; padding: 0.1em 0.6em;
  background: rgba(34, 49, 58, 0.85); }
.oe-overlay [data-region=seamap] button { font: inherit; pointer-events: auto; cursor: pointer; padding: 0.2em 1em;
  background: #c98f3a; color: #22313a; border: 0; font-weight: 600; }
.oe-overlay [data-region=fade] { top: 0; bottom: 0; left: 0; right: 0; background: #0b0e16; opacity: 0; }
`;

export function createOverlay(doc: Document): Overlay {
  const style = doc.createElement('style');
  style.textContent = STYLE;
  doc.head.append(style);
  const root = doc.createElement('div');
  root.className = 'oe-overlay';
  root.setAttribute('aria-live', 'polite');
  doc.body.append(root);
  const regions = new Map<string, HTMLElement>();
  let scale = 1;
  let textSize = 100;
  const applyFont = (): void => {
    // 16 CSS px at 1x logical-to-CSS scale, times the text-size option.
    root.style.fontSize = `${Math.max(10, 8 * scale) * (textSize / 100)}px`;
  };
  return {
    root,
    fit(viewport, dpr) {
      root.style.left = `${viewport.x / dpr}px`;
      root.style.top = `${viewport.y / dpr}px`;
      root.style.width = `${viewport.width / dpr}px`;
      root.style.height = `${viewport.height / dpr}px`;
      scale = viewport.scale / dpr;
      applyFont();
    },
    setTextSize(percent) {
      textSize = Math.min(TEXT_SIZE_RANGE.max, Math.max(TEXT_SIZE_RANGE.min, percent));
      applyFont();
    },
    region(name) {
      let el = regions.get(name);
      if (el === undefined) {
        el = doc.createElement('div');
        el.dataset['region'] = name;
        root.append(el);
        regions.set(name, el);
      }
      return el;
    },
  };
}

/** A line of subtitles (design addendum 2.3 section 10): speech, or information about a sound. */
export interface CaptionLine {
  readonly text: string;
  readonly kind: 'speech' | 'info';
}

/**
 * Fills the captions region: information lines (italic, a real italic face with no synthesised
 * slant, `font-synthesis: none`) above speech lines (upright, "Name: words"). Information lines
 * are left out when the player has turned them off.
 */
export function showCaptions(
  region: HTMLElement,
  lines: readonly CaptionLine[],
  showInfo: boolean,
): void {
  const doc = region.ownerDocument;
  const ordered = [
    ...(showInfo ? lines.filter((l) => l.kind === 'info') : []),
    ...lines.filter((l) => l.kind === 'speech'),
  ];
  region.replaceChildren(
    ...ordered.map((line) => {
      const p = doc.createElement('p');
      p.className = line.kind;
      p.textContent = line.text;
      return p;
    }),
  );
}

/** One line of the caption view as it shows now: its words, kind and opacity. */
export interface CaptionSlotLine {
  readonly text: string;
  readonly kind: 'speech' | 'info';
  readonly alpha: number;
}

/**
 * Fills the captions region from the caption view (design addendum 2.5 section 2; Book 2 section
 * 18): one information line (italic, a real italic face, `font-synthesis: none`) above one speech
 * line (upright), each in its own slot at the bottom of the view. A line being replaced fades out
 * over the new one in the same slot (`p.out`), so lines never stack. Rebuilt only when the words
 * change; opacity is set every frame.
 */
export function showCaptionSlots(
  region: HTMLElement,
  info: CaptionSlotLine | null,
  speech: CaptionSlotLine | null,
  outgoing: readonly CaptionSlotLine[],
): void {
  const doc = region.ownerDocument;
  const slot = (kind: 'info' | 'speech'): HTMLElement => {
    let el = region.querySelector<HTMLElement>(`.oe-slot[data-slot=${kind}]`);
    if (el === null) {
      el = doc.createElement('div');
      el.className = 'oe-slot';
      el.dataset['slot'] = kind;
      if (kind === 'info') region.prepend(el);
      else region.append(el);
    }
    return el;
  };
  for (const [kind, line] of [
    ['info', info],
    ['speech', speech],
  ] as const) {
    const el = slot(kind);
    const ghosts = outgoing.filter((o) => o.kind === kind && o.alpha > 0.01);
    const key = `${line?.text ?? ''}\u0000${ghosts.map((g) => g.text).join('\u0001')}`;
    if (el.dataset['shown'] !== key) {
      el.dataset['shown'] = key;
      const parts: HTMLElement[] = [];
      if (line !== null) {
        const p = doc.createElement('p');
        p.className = kind;
        p.textContent = line.text;
        parts.push(p);
      }
      for (const g of ghosts) {
        const p = doc.createElement('p');
        p.className = `${kind} out`;
        p.setAttribute('aria-hidden', 'true');
        p.textContent = g.text;
        parts.push(p);
      }
      el.replaceChildren(...parts);
    }
    const ps = el.querySelectorAll<HTMLElement>('p');
    let k = 0;
    if (line !== null) {
      const p = ps[k++];
      if (p !== undefined) p.style.opacity = line.alpha.toFixed(2);
    }
    for (const g of ghosts) {
      const p = ps[k++];
      if (p !== undefined) p.style.opacity = g.alpha.toFixed(2);
    }
  }
}

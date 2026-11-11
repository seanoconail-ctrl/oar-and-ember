/**
 * Naming and body (Book 5: the player names the steerer and chooses one of two body models;
 * Book 7 section 07: the models are offered side by side without labels). An HTML panel over the
 * frame, so it is keyboard- and screen-reader-friendly: type a name (or leave it as "Steerer"),
 * pick a body with a click or the arrow keys, press Enter to wake. Nothing here names a gender.
 */
import { formatString } from '../content/strings.ts';
import type { StringTable } from '../content/strings.ts';
import type { BodyModel } from '../sim/world.ts';
import type { LoadedAtlas } from './atlases.ts';
import { bundledLayerFiles } from './bundledLayers.ts';
import { peopleLook, withOwned } from './people.ts';

/** The preview canvas: room round the 32 x 48 body for the bow's larger canvas. */
const PREVIEW = { w: 48, h: 56, anchor: { x: 24, y: 51 } } as const;

const STYLE = `
.oe-naming { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: system-ui, sans-serif; color: #f4efe4; }
.oe-naming form { background: rgba(34, 49, 58, 0.92); border: 2px solid #7b5434; padding: 1.2em 1.6em;
  max-width: 30em; width: calc(100% - 32px); box-sizing: border-box; }
.oe-naming h1 { font-size: 1.3em; margin: 0 0 0.8em; font-weight: 600; }
.oe-naming label, .oe-naming .oe-legend { display: block; margin: 0.6em 0 0.3em; font-size: 0.95em; }
.oe-naming input { font: inherit; width: 100%; box-sizing: border-box; padding: 0.35em 0.5em;
  background: #f4efe4; color: #22313a; border: 2px solid #7b5434; }
.oe-naming .oe-bodies { display: flex; gap: 1em; justify-content: center; }
.oe-naming .oe-bodies button { background: #3a2616; border: 3px solid #5a3b24; padding: 0.4em; cursor: pointer; }
.oe-naming .oe-bodies button[aria-checked=true] { border-color: #c98f3a; background: #5a3b24; }
.oe-naming canvas { display: block; width: 144px; height: 168px; image-rendering: pixelated; }
.oe-naming .oe-wake { margin-top: 1em; font: inherit; padding: 0.4em 1.4em; background: #c98f3a;
  color: #22313a; border: 0; cursor: pointer; font-weight: 600; }
.oe-naming p { font-size: 0.85em; opacity: 0.85; margin: 0.6em 0 0; }
`;

export interface NamingChoice {
  readonly name: string;
  readonly bodyModel: BodyModel;
}

const FACINGS = ['s', 'e', 'n', 'w'] as const;

/** Shows the panel; resolves when the player wakes. */
export function showNaming(
  doc: Document,
  strings: StringTable,
  atlases: ReadonlyMap<string, LoadedAtlas>,
): Promise<NamingChoice> {
  const t = (key: string): string => formatString(strings, key);
  const style = doc.createElement('style');
  style.textContent = STYLE;
  doc.head.append(style);
  const root = doc.createElement('div');
  root.className = 'oe-naming';
  const form = doc.createElement('form');
  form.noValidate = true;
  const title = doc.createElement('h1');
  title.textContent = t('ui.naming.title');
  const label = doc.createElement('label');
  label.textContent = t('ui.naming.name_label');
  label.htmlFor = 'oe-name';
  const input = doc.createElement('input');
  input.id = 'oe-name';
  input.maxLength = 24;
  input.autocomplete = 'off';
  input.placeholder = t('ui.naming.name_default');
  const legend = doc.createElement('div');
  legend.className = 'oe-legend';
  legend.id = 'oe-body-label';
  legend.textContent = t('ui.naming.body_label');
  const bodies = doc.createElement('div');
  bodies.className = 'oe-bodies';
  bodies.setAttribute('role', 'radiogroup');
  bodies.setAttribute('aria-labelledby', 'oe-body-label');
  const wake = doc.createElement('button');
  wake.type = 'submit';
  wake.className = 'oe-wake';
  wake.textContent = t('ui.naming.wake');
  const hint = doc.createElement('p');
  hint.textContent = t('ui.naming.hint');

  let chosen: BodyModel = 'A';
  const buttons: [BodyModel, HTMLButtonElement, HTMLCanvasElement][] = (['A', 'B'] as const).map(
    (model, i) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'radio');
      // Ordinal names for screen readers only; the panel shows no label on either body.
      button.setAttribute(
        'aria-label',
        t(i === 0 ? 'ui.naming.body_first' : 'ui.naming.body_second'),
      );
      button.dataset['body'] = model;
      const canvas = doc.createElement('canvas');
      canvas.width = PREVIEW.w;
      canvas.height = PREVIEW.h;
      button.append(canvas);
      bodies.append(button);
      return [model, button, canvas];
    },
  );
  const select = (model: BodyModel): void => {
    chosen = model;
    for (const [m, button] of buttons) {
      button.setAttribute('aria-checked', String(m === model));
      button.tabIndex = m === model ? 0 : -1;
    }
    root.dataset['body'] = model;
  };
  for (const [model, button] of buttons) {
    button.addEventListener('click', () => {
      select(model);
    });
  }
  bodies.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      select(chosen === 'A' ? 'B' : 'A');
      buttons.find(([m]) => m === chosen)?.[1].focus();
    }
  });
  select('A');

  const files = bundledLayerFiles();
  // As the steerer wakes: with nothing in hand, so no bow on the back (decision DD-6).
  const bare = (model: BodyModel) => withOwned(peopleLook(files, model).steerer, () => false);
  const looks = { A: { steerer: bare('A') }, B: { steerer: bare('B') } };
  // Each body turns slowly on the spot, so both can be seen from every side.
  let turn = 0;
  const draw = (): void => {
    const facing = FACINGS[Math.floor(turn / 2) % FACINGS.length] ?? 's';
    const frame = turn % 2 === 0 ? 0 : 1;
    for (const [model, , canvas] of buttons) {
      const ctx = canvas.getContext('2d');
      if (ctx === null) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, PREVIEW.w, PREVIEW.h);
      // Every layer of the body's outfit, in the facing's order, round the same foot anchor.
      for (const sheet of looks[model].steerer.layers[facing] ?? []) {
        const atlas = atlases.get(sheet);
        const at = atlas?.manifest.frames[`idle/${facing}/${frame}`];
        if (atlas === undefined || at === undefined) continue;
        const m = atlas.manifest;
        ctx.drawImage(
          atlas.image,
          at[0],
          at[1],
          m.width,
          m.height,
          PREVIEW.anchor.x - m.pivot.x,
          PREVIEW.anchor.y - m.pivot.y,
          m.width,
          m.height,
        );
      }
    }
    turn++;
  };
  draw();
  const timer = setInterval(draw, 600);

  form.append(title, label, input, legend, bodies, wake, hint);
  root.append(form);
  doc.body.append(root);
  root.dataset['state'] = 'naming';
  input.focus();

  return new Promise((resolve) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearInterval(timer);
      const name = input.value.trim() === '' ? t('ui.naming.name_default') : input.value.trim();
      root.remove();
      resolve({ name, bodyModel: chosen });
    });
  });
}

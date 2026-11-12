/**
 * The launch's screens (Stage 12): the readiness screen (Book 6 section 15; Book 2 section 16),
 * naming the boat and choosing its sail's mark (Book 7 section 04), the chapter's end and the
 * timings. Interface text on the overlay (Book 7 section 01, decision S5-5), in the timber and wool
 * frame of Book 7 section 10, with the boat drawn from its atlases in a preview. Keys typed into a
 * panel stay in it (a name typed is never a game command).
 */
import type { LaunchDef } from '../content/registry.ts';
import type { ReadinessLine, ReadinessView } from '../sim/narrative/launch.ts';
import type { LoadedAtlas } from './atlases.ts';

export const PANEL_STYLE = `
.oe-launch { position: absolute; left: 8%; right: 8%; top: 6%; max-height: 88%; overflow: auto;
  pointer-events: auto; background: rgba(58, 38, 22, 0.95); border: 2px solid #7b5434; padding: 0.7em 1em;
  font-size: 0.9em; line-height: 1.4; z-index: 3; box-sizing: border-box; }
.oe-launch h2 { margin: 0 0 0.4em; font-size: 1.3em; color: #f0ad4c; }
.oe-launch p { margin: 0.25em 0; }
.oe-launch .lead { color: #e9d7b8; }
.oe-launch table { border-collapse: collapse; width: 100%; margin: 0.4em 0; }
.oe-launch td { padding: 0.2em 0.4em; vertical-align: top; border-top: 1px solid rgba(123, 84, 52, 0.6); }
.oe-launch td.kind { white-space: nowrap; color: #e9d7b8; }
.oe-launch td.state { white-space: nowrap; font-weight: 600; }
.oe-launch td.state.ready { color: #b7d18a; }
.oe-launch td.state.short { color: #f2b8a0; }
.oe-launch td.state.unknown { color: #c9c2b0; }
.oe-launch .warning { margin: 0.6em 0; padding: 0.4em 0.6em; border: 1px solid #c8592c; color: #f4efe4;
  background: rgba(60, 26, 29, 0.6); }
.oe-launch button { font: inherit; padding: 0.3em 1em; margin: 0.3em 0.4em 0 0; cursor: pointer;
  background: #3a2616; color: #f4efe4; border: 2px solid #7b5434; }
.oe-launch button.primary { background: #c98f3a; color: #22313a; font-weight: 600; border-color: #c98f3a; }
.oe-launch button:disabled { opacity: 0.45; cursor: default; }
.oe-launch button[aria-checked=true] { border-color: #f0ad4c; background: #5a3b24; }
.oe-launch input { font: inherit; width: 100%; box-sizing: border-box; padding: 0.3em 0.5em;
  background: #f4efe4; color: #22313a; border: 2px solid #7b5434; }
.oe-launch .row { display: flex; flex-wrap: wrap; gap: 0.2em; }
.oe-launch .row button { margin: 0; padding: 0.2em 0.6em; }
.oe-launch canvas { display: block; margin: 0.3em auto; image-rendering: pixelated; }
.oe-launch .note { font-size: 0.9em; color: #e9d7b8; font-style: italic; min-height: 1.3em; }
.oe-launch ul { margin: 0.2em 0; padding-left: 1.2em; }
.oe-overlay[data-seamap]:not([data-seamap='']) [data-region=clock],
.oe-overlay[data-seamap]:not([data-seamap='']) [data-region=stamina],
.oe-overlay[data-seamap]:not([data-seamap='']) [data-region=prompt],
.oe-overlay[data-seamap]:not([data-seamap='']) [data-region=slot] { display: none; }
`;

/** What the panels need to put words to IDs. */
export interface PanelWords {
  readonly t: (key: string, vars?: Record<string, string>) => string;
  readonly person: (id: string) => string;
  readonly item: (id: string) => string;
  readonly fitting: (id: string) => string;
}

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text?: string,
  cls?: string,
): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls !== undefined) e.className = cls;
  return e;
}

function panel(doc: Document, name: string): HTMLDivElement {
  const p = el(doc, 'div', undefined, 'oe-launch');
  p.dataset['panel'] = name;
  // Keys typed into a panel stay in it: they are never the game's commands.
  p.addEventListener('keydown', (e) => {
    e.stopPropagation();
  });
  p.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });
  return p;
}

/** A list of names in plain words: "Hild, Oddi and Runa". */
function listOf(names: readonly string[], w: PanelWords): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(w.t('ui.gate.launch.list'))}${w.t('ui.gate.launch.and')}${names[names.length - 1] ?? ''}`;
}

/** A readiness line's words. */
export function readinessText(line: ReadinessLine, w: PanelWords): string {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(line.vars)) vars[k] = String(v);
  const ids = line.list?.ids ?? [];
  const names = ids.map((id) =>
    line.list?.kind === 'person'
      ? w.person(id)
      : line.list?.kind === 'item'
        ? w.item(id)
        : line.list?.kind === 'fitting'
          ? w.fitting(id)
          : w.t(id),
  );
  if (line.measure === 'WEAPONS' && Number(line.vars['arrows'] ?? 0) > 0)
    names.push(w.t('ui.gate.launch.gear.arrows', { count: String(line.vars['arrows']) }));
  vars['names'] = listOf(names, w);
  vars['items'] = vars['names'];
  vars['what'] = vars['names'];
  vars['fitting'] = (names[0] ?? '').toLowerCase();
  let text = w.t(line.textKey, vars);
  if (line.extra !== undefined)
    text += ` ${w.t(line.extra.textKey, { names: listOf(line.extra.ids.map(w.person), w) })}`;
  return text;
}

/** The readiness screen: each line with its state, the warning, and Launch or Not yet. */
export function readinessPanel(
  doc: Document,
  view: ReadinessView,
  w: PanelWords,
  keys: { readonly start: string; readonly back: string },
  onStart: () => void,
  onBack: () => void,
): HTMLDivElement {
  const p = panel(doc, 'readiness');
  p.append(
    el(doc, 'h2', w.t('ui.gate.launch.title')),
    el(doc, 'p', w.t('ui.gate.launch.lead'), 'lead'),
  );
  const table = el(doc, 'table');
  for (const line of view.lines) {
    const tr = el(doc, 'tr');
    tr.dataset['measure'] = line.measure;
    tr.dataset['state'] = line.state;
    tr.append(
      el(doc, 'td', w.t(line.labelKey), 'kind'),
      el(
        doc,
        'td',
        w.t(`ui.gate.state.${line.state.toLowerCase()}`),
        `state ${line.state.toLowerCase()}`,
      ),
      el(doc, 'td', readinessText(line, w)),
    );
    table.append(tr);
  }
  p.append(table, el(doc, 'p', w.t(view.pointOfNoReturnKey), 'warning'));
  if (!view.canStart) p.append(el(doc, 'p', w.t('ui.gate.launch.cannot'), 'note'));
  const start = el(doc, 'button', w.t('ui.gate.launch.start', { key: keys.start }), 'primary');
  start.dataset['action'] = 'start';
  start.disabled = !view.canStart;
  start.addEventListener('click', onStart);
  const back = el(doc, 'button', w.t('ui.gate.launch.back', { key: keys.back }));
  back.dataset['action'] = 'back';
  back.addEventListener('click', onBack);
  p.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') onBack();
    else if ((e.key === 'Enter' || e.key.toLowerCase() === 'e') && view.canStart) onStart();
  });
  p.append(start, back);
  queueMicrotask(() => {
    (view.canStart ? start : back).focus();
  });
  return p;
}

/** Draws the boat afloat with its sail set (`mark` the sail state's suffix, null: furled). */
export function drawBoatPreview(
  canvas: HTMLCanvasElement,
  atlases: ReadonlyMap<string, LoadedAtlas>,
  mark: string | null,
): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Over the sky, the boat on its skids on the shingle (being named) or afloat (its sail set),
  // in the palette's sky, sand and sea.
  ctx.fillStyle = '#929ea3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = mark === null ? '#8a7f6e' : '#4a7d88';
  ctx.fillRect(0, canvas.height - 26, canvas.width, 26);
  const fx = canvas.width / 2;
  const fy = canvas.height - 16;
  const put = (sheet: string, frame: string): void => {
    const a = atlases.get(sheet);
    const at = a?.manifest.frames[frame];
    if (a === undefined || at === undefined) return;
    const m = a.manifest;
    ctx.drawImage(
      a.image,
      at[0],
      at[1],
      m.width,
      m.height,
      fx - m.pivot.x,
      fy - m.pivot.y,
      m.width,
      m.height,
    );
  };
  if (mark === null) {
    put('ship_t1', 'hull_patched/-/0');
    put('ship_t1_parts', 'rig/-/0');
    put('ship_t1_parts', 'oar/-/0');
    put('ship_t1_parts', 'ready/-/0');
    return;
  }
  put('ship_t1_launch', 'afloat/-/0');
  put('ship_t1_launch', 'mast/-/0');
  put('ship_t1_launch', 'oar/-/0');
  put('ship_t1_sail', `set_${mark}/-/0`);
}

/** Naming the boat: a field, the suggestions, and on to the sail. */
export function namingPanel(
  doc: Document,
  def: LaunchDef,
  w: PanelWords,
  atlases: ReadonlyMap<string, LoadedAtlas>,
  onDone: (name: string) => void,
): HTMLDivElement {
  const p = panel(doc, 'naming');
  p.append(
    el(doc, 'h2', w.t('ui.launch.name.title')),
    el(doc, 'p', w.t('ui.launch.name.lead'), 'lead'),
  );
  const canvas = el(doc, 'canvas');
  canvas.width = 220;
  canvas.height = 206;
  canvas.style.width = '330px';
  canvas.style.height = '309px';
  drawBoatPreview(canvas, atlases, null);
  const label = el(doc, 'label', w.t('ui.launch.name.label'));
  label.htmlFor = 'oe-ship-name';
  const input = el(doc, 'input');
  input.id = 'oe-ship-name';
  input.maxLength = def.names.maxLength;
  input.autocomplete = 'off';
  input.placeholder = w.t(def.names.defaultKey);
  const row = el(doc, 'div', undefined, 'row');
  for (const key of def.names.suggestions) {
    const b = el(doc, 'button', w.t(key));
    b.type = 'button';
    b.dataset['suggestion'] = w.t(key);
    b.addEventListener('click', () => {
      input.value = w.t(key);
      input.focus();
    });
    row.append(b);
  }
  const done = (): void => {
    const name = input.value.trim() === '' ? w.t(def.names.defaultKey) : input.value;
    onDone(name);
  };
  const next = el(doc, 'button', w.t('ui.launch.name.next'), 'primary');
  next.dataset['action'] = 'next';
  next.addEventListener('click', done);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') done();
  });
  p.append(canvas, label, input, el(doc, 'p', w.t('ui.launch.name.hint'), 'note'), row, next);
  queueMicrotask(() => {
    input.focus();
  });
  return p;
}

/** Choosing the sail's mark: a pattern and a dye, the boat drawn with it, and Launch. */
export function markPanel(
  doc: Document,
  def: LaunchDef,
  w: PanelWords,
  atlases: ReadonlyMap<string, LoadedAtlas>,
  shipName: string,
  onDone: (pattern: string, dye: string | null) => void,
): HTMLDivElement {
  const p = panel(doc, 'mark');
  p.append(
    el(doc, 'h2', `${w.t('ui.launch.mark.title')}: ${shipName}`),
    el(doc, 'p', w.t('ui.launch.mark.lead'), 'lead'),
  );
  const canvas = el(doc, 'canvas');
  canvas.width = 220;
  canvas.height = 206;
  canvas.style.width = '330px';
  canvas.style.height = '309px';
  let pattern = def.marks.patterns[1]?.key ?? 'plain';
  let dye: string = def.marks.dyes[0]?.key ?? 'madder';
  const note = el(doc, 'p', '', 'note');
  note.dataset['likeness'] = '';
  const patterns = el(doc, 'div', undefined, 'row');
  const dyes = el(doc, 'div', undefined, 'row');
  patterns.setAttribute('role', 'radiogroup');
  dyes.setAttribute('role', 'radiogroup');
  const dyed = (): boolean => def.marks.patterns.find((x) => x.key === pattern)?.dyed !== false;
  const state = (): string => (dyed() ? `${pattern}_${dye}` : pattern);
  const refresh = (): void => {
    for (const b of patterns.querySelectorAll('button'))
      b.setAttribute('aria-checked', String(b.dataset['pattern'] === pattern));
    for (const b of dyes.querySelectorAll('button')) {
      b.setAttribute('aria-checked', String(dyed() && b.dataset['dye'] === dye));
      b.disabled = !dyed();
    }
    drawBoatPreview(canvas, atlases, state());
    const like = def.marks.likeness.find(
      (l) => l.pattern === pattern && (l.dye === undefined || (dyed() && l.dye === dye)),
    );
    note.textContent = like === undefined ? '' : w.t(like.noteKey);
    p.dataset['mark'] = dyed() ? `${pattern}:${dye}` : pattern;
  };
  for (const pat of def.marks.patterns) {
    const b = el(doc, 'button', w.t(pat.nameKey));
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset['pattern'] = pat.key;
    b.addEventListener('click', () => {
      pattern = pat.key;
      refresh();
    });
    patterns.append(b);
  }
  for (const d of def.marks.dyes) {
    const b = el(doc, 'button', w.t(d.nameKey));
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset['dye'] = d.key;
    b.addEventListener('click', () => {
      dye = d.key;
      refresh();
    });
    dyes.append(b);
  }
  const go = el(doc, 'button', w.t('ui.launch.mark.go'), 'primary');
  go.dataset['action'] = 'launch';
  const finish = (): void => {
    onDone(pattern, dyed() ? dye : null);
  };
  go.addEventListener('click', finish);
  p.addEventListener('keydown', (e) => {
    const list = def.marks.patterns.map((x) => x.key);
    const dl = def.marks.dyes.map((x) => x.key);
    if (e.key === 'Enter') finish();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = list.indexOf(pattern) + (e.key === 'ArrowRight' ? 1 : -1);
      pattern = list[(i + list.length) % list.length] ?? pattern;
      refresh();
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && dyed()) {
      const i = dl.indexOf(dye) + (e.key === 'ArrowDown' ? 1 : -1);
      dye = dl[(i + dl.length) % dl.length] ?? dye;
      refresh();
    }
  });
  p.append(
    canvas,
    el(doc, 'p', w.t('ui.launch.mark.pattern'), 'lead'),
    patterns,
    el(doc, 'p', w.t('ui.launch.mark.dye'), 'lead'),
    dyes,
    note,
    el(doc, 'p', w.t('ui.launch.mark.hint'), 'note'),
    go,
  );
  refresh();
  queueMicrotask(() => {
    go.focus();
  });
  return p;
}

/** Minutes and seconds of played time, in the timings' words. */
export function playedText(seconds: number, w: PanelWords): string {
  const m = Math.floor(seconds / 60);
  return w.t('ui.timings.minutes', { m: String(m), s: String(Math.floor(seconds - m * 60)) });
}

/** The chapter's end: what was done, the save made, the time played, and back to the island. */
export function chapterPanel(
  doc: Document,
  w: PanelWords,
  shipName: string,
  played: number,
  fight: number | null,
  key: string,
  onClose: () => void,
): HTMLDivElement {
  const p = panel(doc, 'chapter');
  const close = el(doc, 'button', w.t('ui.chapter.end.close', { key }), 'primary');
  close.dataset['action'] = 'close';
  close.addEventListener('click', onClose);
  p.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key.toLowerCase() === 'e') onClose();
  });
  p.append(
    el(doc, 'h2', w.t('ui.chapter.end.title')),
    el(doc, 'p', w.t('ui.chapter.end.line', { ship: shipName })),
    el(doc, 'p', w.t('ui.chapter.end.saved'), 'lead'),
    el(
      doc,
      'p',
      w.t('ui.chapter.end.time', {
        played: playedText(played, w),
        fight: fight === null ? w.t('ui.chapter.end.no_fight') : playedText(fight, w),
      }),
    ),
    el(doc, 'p', w.t('ui.chapter.end.build'), 'note'),
    close,
  );
  queueMicrotask(() => {
    close.focus();
  });
  return p;
}

/** The timings (telemetry): played time, held time, the first fight and every milestone. */
export function timingsPanel(
  doc: Document,
  w: PanelWords,
  report: {
    readonly now: number;
    readonly held: number;
    readonly known: boolean;
    readonly marks: readonly { readonly key: string; readonly seconds: number }[];
  },
  key: string,
): HTMLDivElement {
  const p = panel(doc, 'timings');
  p.append(
    el(doc, 'h2', w.t('ui.timings.title')),
    el(doc, 'p', w.t('ui.timings.played', { time: playedText(report.now, w) })),
    el(doc, 'p', w.t('ui.timings.held', { time: playedText(report.held, w) }), 'lead'),
  );
  const fight = report.marks.find((m) => m.key === 'first_combat');
  p.append(
    el(
      doc,
      'p',
      fight === undefined
        ? w.t('ui.timings.no_fight')
        : w.t('ui.timings.fight', { time: playedText(fight.seconds, w) }),
    ),
  );
  if (!report.known) p.append(el(doc, 'p', w.t('ui.timings.unknown'), 'note'));
  const list = el(doc, 'ul');
  for (const m of report.marks)
    list.append(
      el(
        doc,
        'li',
        w.t('ui.timings.mark', {
          name: w.t(`ui.timings.mark.${m.key}`),
          time: playedText(m.seconds, w),
        }),
      ),
    );
  p.append(list, el(doc, 'p', w.t('ui.timings.close', { key }), 'note'));
  return p;
}

/**
 * The sea map's words and panels (Stage 13; Book 2 section 09; Book 7 section 10; Book 8 section
 * 10): the plotting screen (a destination, the course, its watches and stores, or the refusal in
 * words), the weather (the wind, the tide, the visibility and tomorrow's forecast in plain words
 * beside their drawn marks), the voyage under way, the sea map's one choice with its consequences in
 * words, and the landing. Interface text on the overlay in the timber and wool frame; the drawn
 * marks themselves are the chart's (src/scenes/seaChart.ts).
 *
 * The text and layout functions are pure (tested in tests/unit/seaPanels.test.ts); only the
 * `*Panel` functions touch the document. Nothing here names an ID on screen: places by their name
 * strings, everything else by `ui.sea.*`.
 */

export interface SeaWords {
  readonly t: (key: string, vars?: Record<string, string>) => string;
  /** A place's name (`place.name.<id>`). */
  readonly place: (id: string) => string;
}

export type Point = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** What the panels are told (built by src/scenes/seaVoyage.ts from the world; no IDs shown). */
export interface WeatherModel {
  readonly windFrom: Point;
  readonly strength: number;
  readonly visibility: 'CLEAR' | 'HAZE' | 'FOG' | 'NIGHT';
  readonly tide: 'FLOOD' | 'EBB';
  /** Game minutes to the next slack water (0: slack now), and its clock time. */
  readonly slackIn: number;
  readonly slackAt: string;
  readonly forecast: {
    readonly windFrom: Point;
    readonly strength: number;
    readonly visibility: 'CLEAR' | 'HAZE' | 'FOG';
    readonly storm: boolean;
    readonly calm: boolean;
  } | null;
  readonly day: number;
  readonly time: string;
}

export interface CourseModel {
  readonly from: string;
  readonly to: string;
  /** Places passed on the way, in order (not the ends). */
  readonly via: readonly string[];
  readonly watches: number;
  readonly arriveDay: number;
  readonly arriveTime: string;
  /** Minutes waiting for slack water on the way. */
  readonly waitMinutes: number;
  /** Ration-days the course eats, and aboard (to be loaded, or in the hold). */
  readonly eatRd: number;
  readonly aboardRd: number;
  /** Everyone aboard, the steerer counted. */
  readonly mouths: number;
  /** Ration-days a person eats a day (Book 10 storesPerPersonPerWatch x watches a day). */
  readonly perDay: number;
  /** A story gate starts on setting out (the Carrick raid). */
  readonly gate: boolean;
}

export interface Refusal {
  readonly textKey: string;
  readonly vars: Readonly<Record<string, string>>;
}

export interface PlaceChoice {
  readonly id: string;
  readonly known: boolean;
}

const POINT_KEY: Readonly<Record<Point, string>> = {
  N: 'n',
  NE: 'ne',
  E: 'e',
  SE: 'se',
  S: 's',
  SW: 'sw',
  W: 'w',
  NW: 'nw',
};

/** "Wind from the south-west, a fair breeze", or the calm. */
export function windWords(from: Point, strength: number, w: SeaWords): string {
  if (strength <= 0) return w.t('ui.sea.wind.calm');
  return w.t('ui.sea.wind.from', {
    point: w.t(`ui.sea.point.${POINT_KEY[from]}`),
    strength: w.t(`ui.sea.strength.${Math.min(4, Math.max(1, Math.round(strength)))}`),
  });
}

/** "Tide flooding; slack water about 12:00", or slack now. */
export function tideWords(
  m: Pick<WeatherModel, 'tide' | 'slackIn' | 'slackAt'>,
  w: SeaWords,
): string {
  if (m.slackIn <= 0) return w.t('ui.sea.tide.slack_now');
  return w.t('ui.sea.tide.line', {
    tide: w.t(m.tide === 'FLOOD' ? 'ui.sea.tide.flood' : 'ui.sea.tide.ebb'),
    time: m.slackAt,
  });
}

export function visibilityWords(v: WeatherModel['visibility'], w: SeaWords): string {
  return w.t(`ui.sea.vis.${v.toLowerCase()}`);
}

/** Tomorrow's weather in words: a storm or a calm said first. */
export function forecastWords(f: WeatherModel['forecast'], w: SeaWords): string {
  if (f === null) return w.t('ui.sea.forecast.none');
  if (f.storm) return w.t('ui.sea.forecast.storm');
  if (f.calm) return w.t('ui.sea.forecast.calm');
  const wind = windWords(f.windFrom, f.strength, w);
  return w.t('ui.sea.forecast.line', {
    wind: wind.charAt(0).toLowerCase() + wind.slice(1),
    vis: visibilityWords(f.visibility, w).toLowerCase(),
  });
}

/** Whole watches in words: "less than a watch", "about 1 watch", "about 3 watches". */
export function watchesWords(watches: number, w: SeaWords): string {
  if (watches < 0.5) return w.t('ui.sea.watches.part');
  const n = Math.max(1, Math.round(watches));
  return w.t(n === 1 ? 'ui.sea.watches.one' : 'ui.sea.watches.many', { count: String(n) });
}

/** Days in words: "half a day", "1 day", "3 days", "2.5 days". */
export function daysWords(days: number, w: SeaWords): string {
  if (days <= 0.5) return w.t('ui.sea.days.half');
  if (days === 1) return w.t('ui.sea.days.one');
  return w.t('ui.sea.days.many', { count: String(days) });
}

/** Ration-days as days for everyone aboard, to the half day. */
export function daysFor(rd: number, mouths: number, perDay: number): number {
  if (mouths <= 0 || perDay <= 0) return 0;
  return Math.floor((rd / (mouths * perDay)) * 2) / 2;
}

/** The course's lines: the way, the time at sea and the landfall, any wait, the stores. */
export function courseLines(c: CourseModel, w: SeaWords): string[] {
  const lines = [w.t('ui.sea.plot.course', { from: c.from, to: c.to })];
  if (c.via.length > 0) lines.push(w.t('ui.sea.plot.via', { places: listWords(c.via, w) }));
  lines.push(
    w.t('ui.sea.plot.time', {
      watches: watchesWords(c.watches, w),
      time: c.arriveTime,
      day: String(c.arriveDay),
    }),
  );
  if (c.waitMinutes > 0) lines.push(w.t('ui.sea.plot.wait'));
  const aboard = daysFor(c.aboardRd, c.mouths, c.perDay);
  const eat = Math.max(0.5, Math.ceil((c.eatRd / Math.max(1e-9, c.mouths * c.perDay)) * 2) / 2);
  lines.push(
    w.t('ui.sea.plot.stores', {
      days: daysWords(aboard, w),
      mouths: String(c.mouths),
      eat: daysWords(eat, w),
    }),
  );
  if (c.eatRd > c.aboardRd + 1e-6) lines.push(w.t('ui.sea.plot.short'));
  if (c.gate) lines.push(w.t('ui.sea.plot.gate', { place: c.to }));
  return lines;
}

/** "Hild, Oddi and Runa" in plain words. */
export function listWords(names: readonly string[], w: SeaWords): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(w.t('ui.gate.launch.list'))}${w.t('ui.gate.launch.and')}${names[names.length - 1] ?? ''}`;
}

/** A refusal's words, with its values (the hold's time and the like). */
export function refusalWords(r: Refusal, w: SeaWords): string {
  return w.t(r.textKey, { ...r.vars });
}

/** How the boat is going: under sail by its point of sail, or rowing and why. */
export function legWords(
  leg: {
    readonly pointOfSail: string;
    readonly rowing: boolean;
    readonly from: string;
    readonly to: string;
  },
  w: SeaWords,
): string {
  if (leg.rowing) {
    // Rowing in a calm, into the wind, or because the oars are quicker than the sail would be.
    const why =
      leg.pointOfSail === 'CALM'
        ? 'ui.sea.row.calm'
        : leg.pointOfSail === 'AGAINST'
          ? 'ui.sea.row.against'
          : 'ui.sea.row.quicker';
    return w.t('ui.sea.at.rowing', { why: w.t(why), from: leg.from, to: leg.to });
  }
  return w.t('ui.sea.at.sailing', {
    pos: w.t(`ui.sea.pos.${leg.pointOfSail.toLowerCase()}`),
    from: leg.from,
    to: leg.to,
  });
}

/** The sea map's choice: its question and each option with what follows from it, in words. */
export interface ChoiceModel {
  readonly questionKey: string;
  readonly pressOn: {
    readonly textKey: string;
    readonly watches: number;
    readonly strength: number;
    readonly storm: boolean;
    readonly arriveTime: string;
  };
  readonly shelter: {
    readonly textKey: string;
    readonly untilTime: string;
    readonly watches: number;
    readonly eatDays: number;
  };
}

export function choiceLines(
  c: ChoiceModel,
  w: SeaWords,
): {
  question: string;
  pressOn: { label: string; then: string };
  shelter: { label: string; then: string };
  clock: string;
} {
  const storm = c.pressOn.storm ? ` ${w.t('ui.sea.choice.storm')}` : '';
  return {
    question: w.t(c.questionKey),
    pressOn: {
      label: w.t(c.pressOn.textKey),
      then: `${w.t('ui.sea.choice.press_on_then', {
        watches: watchesWords(c.pressOn.watches, w),
        strength: w.t(
          `ui.sea.strength.${Math.min(4, Math.max(1, Math.round(c.pressOn.strength)))}`,
        ),
        time: c.pressOn.arriveTime,
      })}${storm}`,
    },
    shelter: {
      label: w.t(c.shelter.textKey),
      then: w.t('ui.sea.choice.shelter_then', {
        time: c.shelter.untilTime,
        watches: watchesWords(c.shelter.watches, w),
        days: daysWords(c.shelter.eatDays, w),
      }),
    },
    clock: w.t('ui.sea.choice.clock'),
  };
}

// ------------------------------------------------------------------------- layout
/** Logical pixels a character of the overlay's label text takes on the 640 x 360 chart. */
export const LABEL_CHAR_PX = 4.6;
export const LABEL_HEIGHT_PX = 9;

export interface LabelIn {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
}
export interface LabelOut extends LabelIn {
  /** Where the label's top centre sits. */
  readonly lx: number;
  readonly ly: number;
  readonly below: boolean;
}

interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}
const overlaps = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Places' names beside their pictograms, never over one another: below the pictogram, else above
 * it, else nudged sideways; kept inside the chart's frame (`w` x `h`) and clear of `avoid` boxes
 * (the weather's cartouche and the panel).
 */
export function labelLayout(
  labels: readonly LabelIn[],
  w: number,
  h: number,
  avoid: readonly Box[] = [],
): LabelOut[] {
  const placed: Box[] = [...avoid];
  const out: LabelOut[] = [];
  for (const l of labels) {
    const width = Math.ceil(l.text.length * LABEL_CHAR_PX) + 4;
    const tries: { lx: number; ly: number; below: boolean }[] = [
      { lx: l.x, ly: l.y + 4, below: true },
      { lx: l.x, ly: l.y - 16 - LABEL_HEIGHT_PX, below: false },
      { lx: l.x + width / 2 + 8, ly: l.y - 6, below: true },
      { lx: l.x - width / 2 - 8, ly: l.y - 6, below: true },
      { lx: l.x, ly: l.y + 4 + LABEL_HEIGHT_PX, below: true },
    ];
    let chosen = tries[0] ?? { lx: l.x, ly: l.y, below: true };
    let box: Box | null = null;
    for (const t of tries) {
      const lx = Math.min(w - 8 - width / 2, Math.max(8 + width / 2, t.lx));
      const ly = Math.min(h - 8 - LABEL_HEIGHT_PX, Math.max(8, t.ly));
      const b = { x0: lx - width / 2, y0: ly, x1: lx + width / 2, y1: ly + LABEL_HEIGHT_PX };
      if (!placed.some((p) => overlaps(p, b))) {
        chosen = { lx, ly, below: t.below };
        box = b;
        break;
      }
    }
    if (box === null) {
      const lx = Math.min(w - 8 - width / 2, Math.max(8 + width / 2, chosen.lx));
      const ly = Math.min(h - 8 - LABEL_HEIGHT_PX, Math.max(8, chosen.ly));
      chosen = { lx, ly, below: chosen.below };
      box = { x0: lx - width / 2, y0: ly, x1: lx + width / 2, y1: ly + LABEL_HEIGHT_PX };
    }
    placed.push(box);
    out.push({ ...l, lx: chosen.lx, ly: chosen.ly, below: chosen.below });
  }
  return out;
}

/** The weather's cartouche in the chart's top-left corner: each mark's foot and its words' place. */
export const CARTOUCHE = {
  x: 10,
  y: 10,
  row: 18,
  /** The marks' feet (ui_seaicons are 16 x 16 with the foot at 8,15). */
  marks: ['watch', 'wind', 'tide', 'vis', 'forecast', 'stores'] as const,
};

export function cartoucheLayout(): {
  readonly marks: readonly { kind: (typeof CARTOUCHE.marks)[number]; x: number; y: number }[];
  readonly words: readonly { kind: (typeof CARTOUCHE.marks)[number]; x: number; y: number }[];
  readonly box: Box;
} {
  const marks = CARTOUCHE.marks.map((kind, i) => ({
    kind,
    x: CARTOUCHE.x + 8,
    y: CARTOUCHE.y + 15 + i * CARTOUCHE.row,
  }));
  const words = CARTOUCHE.marks.map((kind, i) => ({
    kind,
    x: CARTOUCHE.x + 20,
    y: CARTOUCHE.y + 3 + i * CARTOUCHE.row,
  }));
  return {
    marks,
    words,
    box: {
      x0: CARTOUCHE.x,
      y0: CARTOUCHE.y,
      x1: CARTOUCHE.x + 200,
      y1: CARTOUCHE.y + CARTOUCHE.marks.length * CARTOUCHE.row + 2,
    },
  };
}

/** The panel's side: away from the boat and its course, so neither is hidden. */
export function panelSide(points: readonly { readonly x: number }[], w: number): 'left' | 'right' {
  if (points.length === 0) return 'right';
  const mean = points.reduce((s, p) => s + p.x, 0) / points.length;
  return mean > w * 0.55 ? 'left' : 'right';
}

/** The panel's box on the chart (logical pixels), for the labels to keep clear of. */
export function panelBox(side: 'left' | 'right', w: number, h: number): Box {
  const width = Math.round(w * 0.34);
  return side === 'right'
    ? { x0: w - width - 8, y0: 30, x1: w - 8, y1: h - 30 }
    : { x0: 8, y0: 30, x1: 8 + width, y1: h - 30 };
}

// ------------------------------------------------------------------------- the document
export const SEA_PANEL_STYLE = `
.oe-sea { position: absolute; top: 8%; bottom: 8%; width: 34%; overflow: auto; pointer-events: auto;
  background: rgba(58, 38, 22, 0.93); border: 2px solid #7b5434; box-shadow: inset 0 0 0 2px #3a2616;
  padding: 0.55em 0.8em; font-size: 0.82em; line-height: 1.35; z-index: 3; box-sizing: border-box; color: #f4efe4; }
.oe-sea.right { right: 1.5%; } .oe-sea.left { left: 1.5%; }
.oe-sea h2 { margin: 0 0 0.35em; font-size: 1.15em; color: #f0ad4c; }
.oe-sea p { margin: 0.2em 0; }
.oe-sea .lead { color: #e9d7b8; }
.oe-sea .refusal { color: #f2b8a0; border-left: 3px solid #c8592c; padding-left: 0.4em; }
.oe-sea .log p { color: #e9d7b8; font-style: italic; }
.oe-sea ul { list-style: none; margin: 0.2em 0; padding: 0; }
.oe-sea li button { width: 100%; text-align: left; }
.oe-sea button { font: inherit; padding: 0.2em 0.7em; margin: 0.2em 0.3em 0 0; cursor: pointer;
  background: #3a2616; color: #f4efe4; border: 2px solid #7b5434; }
.oe-sea button.primary { background: #c98f3a; color: #22313a; font-weight: 600; border-color: #c98f3a; }
.oe-sea button[aria-pressed=true] { border-color: #f0ad4c; background: #5a3b24; }
.oe-sea button.faint { color: #c9c2b0; font-style: italic; }
.oe-sea .option { margin: 0.4em 0; padding: 0.3em 0.4em; border: 1px solid rgba(123, 84, 52, 0.8); }
.oe-sea .option p { color: #e9d7b8; }
.oe-sea .dev { color: #9fc3d1; font-family: ui-monospace, monospace; font-size: 0.9em; }
.oe-sea-words { position: absolute; transform: none; font-size: 0.72em; color: #f4efe4;
  text-shadow: 0 1px 0 #161a28, 1px 0 0 #161a28, -1px 0 0 #161a28, 0 -1px 0 #161a28; white-space: nowrap; }
.oe-sea-label { position: absolute; transform: translate(-50%, 0); font-size: 0.72em; color: #f4efe4;
  text-shadow: 0 1px 0 #161a28, 1px 0 0 #161a28, -1px 0 0 #161a28, 0 -1px 0 #161a28; white-space: nowrap; }
.oe-sea-label.rumour { font-style: italic; color: #d8cdb5; }
.oe-overlay[data-sea]:not([data-sea='']) [data-region=clock],
.oe-overlay[data-sea]:not([data-sea='']) [data-region=stamina],
.oe-overlay[data-sea]:not([data-sea='']) [data-region=prompt],
.oe-overlay[data-sea]:not([data-sea='']) [data-region=slot] { display: none; }
`;

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

function button(
  doc: Document,
  text: string,
  action: string,
  onClick: () => void,
  cls?: string,
): HTMLButtonElement {
  const b = el(doc, 'button', text, cls);
  b.dataset['action'] = action;
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** The panel's frame: keys typed in it stay in it. */
export function seaPanelFrame(doc: Document, name: string, side: 'left' | 'right'): HTMLDivElement {
  const p = el(doc, 'div', undefined, `oe-sea ${side}`);
  p.dataset['panel'] = name;
  p.addEventListener('keydown', (e) => {
    e.stopPropagation();
  });
  return p;
}

/** The plotting screen's panel: where to steer for, the course or its refusal, and Set sail. */
export function plotPanel(
  doc: Document,
  w: SeaWords,
  m: {
    readonly side: 'left' | 'right';
    readonly at: string;
    readonly places: readonly PlaceChoice[];
    readonly chosen: string | null;
    readonly course: CourseModel | null;
    readonly refusal: Refusal | null;
    readonly atSea: boolean;
    readonly keys: { readonly sail: string; readonly back: string };
  },
  on: {
    readonly choose: (id: string) => void;
    readonly sail: () => void;
    readonly back: () => void;
    readonly home?: () => void;
  },
): HTMLDivElement {
  const p = seaPanelFrame(doc, 'plot', m.side);
  p.append(el(doc, 'h2', w.t('ui.sea.plot.title')));
  p.append(el(doc, 'p', w.t('ui.sea.plot.from', { place: m.at }), 'lead'));
  p.append(el(doc, 'p', w.t('ui.sea.plot.pick')));
  const list = el(doc, 'ul');
  for (const place of m.places) {
    const li = el(doc, 'li');
    const b = button(
      doc,
      w.place(place.id),
      'choose',
      () => {
        on.choose(place.id);
      },
      place.known ? undefined : 'faint',
    );
    b.dataset['place'] = place.id;
    b.setAttribute('aria-pressed', String(place.id === m.chosen));
    li.append(b);
    list.append(li);
  }
  p.append(list);
  if (m.refusal !== null) {
    const r = el(doc, 'p', refusalWords(m.refusal, w), 'refusal');
    r.dataset['refusal'] = m.refusal.textKey;
    p.append(r);
  }
  if (m.course !== null) {
    const c = el(doc, 'div', undefined, 'course');
    for (const line of courseLines(m.course, w)) c.append(el(doc, 'p', line));
    p.append(c);
  }
  const sail = button(
    doc,
    w.t('ui.sea.plot.sail', { key: m.keys.sail }),
    'sail',
    on.sail,
    'primary',
  );
  sail.disabled = m.course === null;
  p.append(sail);
  if (on.home !== undefined) p.append(button(doc, w.t('ui.sea.at.turn_back'), 'home', on.home));
  if (!m.atSea)
    p.append(button(doc, w.t('ui.sea.plot.back', { key: m.keys.back }), 'back', on.back));
  return p;
}

/** The voyage under way: how the boat goes, the next landfall, the stores, and the log. */
export function voyagePanel(
  doc: Document,
  w: SeaWords,
  m: {
    readonly side: 'left' | 'right';
    readonly status: string;
    readonly lines: readonly string[];
    readonly log: readonly string[];
    readonly watchShare: number;
  },
): HTMLDivElement {
  const p = seaPanelFrame(doc, 'voyage', m.side);
  p.dataset['status'] = m.status;
  p.append(el(doc, 'h2', w.t('ui.sea.at.title')));
  for (const line of m.lines) p.append(el(doc, 'p', line, 'lead'));
  if (m.log.length > 0) {
    const log = el(doc, 'div', undefined, 'log');
    for (const line of m.log) log.append(el(doc, 'p', line));
    p.append(log);
  }
  return p;
}

/** The sea map's choice: the question, both options with their consequences, and the clock. */
export function choicePanel(
  doc: Document,
  w: SeaWords,
  side: 'left' | 'right',
  c: ChoiceModel,
  keys: { readonly pressOn: string; readonly shelter: string },
  on: { readonly choose: (option: 'PRESS_ON' | 'SHELTER') => void },
): HTMLDivElement {
  const words = choiceLines(c, w);
  const p = seaPanelFrame(doc, 'choice', side);
  p.append(el(doc, 'h2', w.t('ui.sea.choice.title')));
  p.append(el(doc, 'p', words.question, 'lead'));
  for (const [option, text, key] of [
    ['PRESS_ON', words.pressOn, keys.pressOn],
    ['SHELTER', words.shelter, keys.shelter],
  ] as const) {
    const box = el(doc, 'div', undefined, 'option');
    box.dataset['option'] = option;
    box.append(
      button(
        doc,
        w.t('ui.sea.choice.option', { key, label: text.label }),
        option,
        () => {
          on.choose(option);
        },
        'primary',
      ),
    );
    box.append(el(doc, 'p', text.then));
    p.append(box);
  }
  p.append(el(doc, 'p', words.clock, 'lead'));
  return p;
}

/** Arriving at a landing whose scene is still a stub, or an interruption whose scene is missing. */
export function landingPanel(
  doc: Document,
  w: SeaWords,
  m: {
    readonly side: 'left' | 'right';
    /** Arriving at a landing (not met on the way). */
    readonly landing: boolean;
    readonly lines: readonly string[];
    readonly dev: string | null;
    readonly stay: string;
    readonly home: string | null;
  },
  on: { readonly stay: () => void; readonly home: () => void },
): HTMLDivElement {
  const p = seaPanelFrame(doc, 'landing', m.side);
  p.dataset['landing'] = String(m.landing);
  p.append(el(doc, 'h2', w.t(m.landing ? 'ui.sea.land.title' : 'ui.sea.meet.title')));
  for (const line of m.lines) p.append(el(doc, 'p', line, 'lead'));
  p.append(button(doc, m.stay, 'stay', on.stay, 'primary'));
  if (m.home !== null) p.append(button(doc, m.home, 'home', on.home));
  if (m.dev !== null) p.append(el(doc, 'p', m.dev, 'dev'));
  return p;
}

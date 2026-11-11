/**
 * Art lint (Book 7 section 11 QA checklist, Book 2 section 19). Pure checks over compiled sheets;
 * `lint.ts` adds the check that generated sheets and compiled atlases match their sources.
 */
import { NO_PIXEL } from '../../render/indexedImage.ts';
import type { Palette } from '../../render/palette.ts';
import type { Sheet } from '../../render/sheet.ts';

export interface ArtIssue {
  readonly sheet: string;
  readonly frame?: string;
  readonly reason: string;
}

/**
 * Book 7 section 11 naming patterns, plus prop_ and decal_ for scenery and gore layers (S4-2),
 * ui_ for in-world interface marks such as the interaction marker (S6-9), and layer_ for people's
 * equipment layers (`layer_<slot>_<name>_<body>`).
 */
export const SHEET_NAME =
  /^(actor|ship|token|tile|bld|fx|prop|decal|ui|plant|layer)_[a-z0-9]+(_[a-z0-9]+)*$/;

/**
 * A person's body sheet: actor_<kind>_<id> for the steerer, crew, leaders, residents, enemies and
 * hired hands (Book 2 section 04 prefixes), or actor_heavy, the shared heavy build (design
 * addendum 2.3 section 11). Every other actor_ sheet is an animal.
 */
export const PERSON_SHEET = /^actor_((p|c|l|r|e|h)_[a-z0-9]+(_[a-z0-9]+)*|heavy)$/;
/** An equipment layer (Book 7 section 11): `layer_<slot>_<name>_<body>`. */
export const LAYER_SHEET =
  /^layer_(clothing|cloak|helmet|armour|shield|weapon)_[a-z0-9]+(_[a-z0-9]+)*$/;
/** The heavy build moves heavier: a deeper drop on its down frames (addendum 2.3 section 11). */
export const isHeavy = (name: string): boolean => /(^|_)heavy(_|$)/.test(name);

/**
 * Book 7 section 01: a 32 x 48 canvas, foot anchor at bottom centre, adults about 40 px tall and
 * about 18 x 40 occupied (measured from the front). A body sheet is the bare body under its
 * layers, so the ranges take a bare body in profile (11 px across), an arm swung wide, the heavy
 * build's extra width (up to about 4 px more, addendum 2.3 section 11), the sneak's crouch (34 px)
 * and arms raised into the 8 px of canvas above the head (Hild's call, 46 px).
 */
export const ACTOR = {
  width: 32,
  height: 48,
  pivot: { x: 16, y: 47 },
  occupied: { w: [11, 28], h: [34, 46] },
} as const;
export const TILE_SIZE = 24;

/**
 * The walk (Book 7 section 01): 6 frames, right contact, right down, passing, left contact, left
 * down, passing. The torso and head (the crown row) drop exactly 1 px on the down frames against
 * the contact frame before them; the heavy build 1 to 2 px.
 */
export const WALK = {
  frames: 6,
  contact: [0, 3],
  down: [1, 4],
  drop: [1, 1] as const,
  heavyDrop: [1, 2] as const,
};
/**
 * The run (design addendum 2.3 section 12): 8 frames, contact, down, passing, suspension for each
 * leg. On each suspension frame both feet are at least 1 px above the ground line (the lowest
 * opaque row is above the pivot row); on the down frames the torso drops 1 to 2 px against the
 * contact frame.
 */
export const RUN = {
  frames: 8,
  contact: [0, 4],
  down: [1, 5],
  suspension: [3, 7],
  drop: [1, 2] as const,
  lift: 1,
};

function bounds(
  pixels: Uint8Array,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((pixels[y * w + x] ?? NO_PIXEL) === NO_PIXEL) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function lintSheet(sheet: Sheet, palette: Palette): ArtIssue[] {
  const issues: ArtIssue[] = [];
  const add = (reason: string, frame?: string): void => {
    issues.push(
      frame === undefined ? { sheet: sheet.name, reason } : { sheet: sheet.name, frame, reason },
    );
  };
  if (!SHEET_NAME.test(sheet.name))
    add('name does not follow Book 7 section 11 (actor_, tile_, prop_, decal_, ...)');
  // People (Book 7 section 11) are held to the adult canvas; animals are not.
  const isActor = PERSON_SHEET.test(sheet.name);
  const isLayer = sheet.name.startsWith('layer_');
  const isCreature = sheet.name.startsWith('actor_') && !isActor;
  if (isLayer && !LAYER_SHEET.test(sheet.name))
    add('an equipment layer is named layer_<slot>_<name>_<body> (Book 7 section 11)');
  if (isActor) {
    if (sheet.width !== ACTOR.width || sheet.height !== ACTOR.height)
      add(`an actor canvas is ${ACTOR.width} x ${ACTOR.height}`);
    if (sheet.pivot.x !== ACTOR.pivot.x || sheet.pivot.y !== ACTOR.pivot.y)
      add(`an actor pivot is the foot anchor at bottom centre (${ACTOR.pivot.x},${ACTOR.pivot.y})`);
  }
  if ((isActor || isLayer) && ['s', 'n', 'e', 'w'].some((f) => !sheet.facings.includes(f)))
    add('a person has four facings: s n e w');
  if (isCreature && ['s', 'n', 'e', 'w'].some((f) => !sheet.facings.includes(f)))
    add('wildlife has four facings: s n e w (Book 7 section 13)');
  if (sheet.kind === 'tile' && (sheet.width !== TILE_SIZE || sheet.height !== TILE_SIZE))
    add('a tile is 24 x 24');

  // Ink: Book 7's outline colour or either step of the art-direction ink ramp.
  const inks = new Set<number>([
    ...(palette.indexOf.has('k') ? [palette.indexOf.get('k') ?? -1] : []),
    ...(palette.ramps.get('ink') ?? []),
  ]);
  // A layer sheet is drawn over its body, so where it meets another layer its edge takes the
  // cloth's deepest tone rather than ink (no doubled outline in the composite, people48.py). Its
  // edge is checked where it shows: in the composite of its person (layerProblems), whose outer
  // edge must be ink all round, like any body sheet.
  const edgeOk = inks;
  const reserved = new Set(
    palette.entries.flatMap((e, i) => (e.reserved && !sheet.reserved.includes(e.code) ? [i] : [])),
  );
  /** The crown (top opaque row) and the sole (lowest opaque row) of each frame. */
  const rowsOf = new Map<string, { top: number; bottom: number }>();
  for (const [key, image] of sheet.frames) {
    const { width: w, height: h, pixels } = image;
    const at = (x: number, y: number): number =>
      x < 0 || y < 0 || x >= w || y >= h ? NO_PIXEL : (pixels[y * w + x] ?? NO_PIXEL);
    let badEdge = 0;
    let transparent = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = at(x, y);
        if (v === NO_PIXEL) {
          transparent++;
          continue;
        }
        if (reserved.has(v))
          add(`uses the reserved accent "${palette.entries[v]?.name ?? v}"`, key);
        const onEdge = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes(NO_PIXEL);
        if (onEdge && !edgeOk.has(v)) badEdge++;
      }
    }
    if ((sheet.kind === 'sprite' || sheet.kind === 'prop') && !isLayer && badEdge > 0) {
      add(`${badEdge} edge pixel(s) are not the one-pixel ink outline (Book 7 section 11)`, key);
    }
    // Edge tiles are overlays: a band of one terrain lapping over the tile below it (S6-7).
    const [state = '', , indexText = '0'] = key.split('/');
    const pose = sheet.poses[state];
    if (sheet.kind === 'tile' && transparent > 0 && !state.startsWith('edge_'))
      add('a ground tile must be fully opaque', key);
    const box = bounds(pixels, w, h);
    if (box === null) {
      // A layer may have nothing to show in a frame (a helmet hidden behind a lying body).
      if (!isLayer) add('the frame is empty', key);
      continue;
    }
    rowsOf.set(key, { top: box.y0, bottom: box.y1 });
    // A carried person, a bird on the wing and an in-world marker are off the ground; so is a
    // person in the suspension of a run, and an equipment layer (it is drawn over its body).
    const suspended = isActor && state === 'run' && RUN.suspension.includes(Number(indexText));
    const grounded =
      pose !== 'carried' &&
      pose !== 'flying' &&
      !sheet.name.startsWith('ui_') &&
      !isLayer &&
      !suspended;
    if ((sheet.kind === 'sprite' || sheet.kind === 'prop') && grounded) {
      if (box.y1 !== sheet.pivot.y)
        add(`the feet (lowest row ${box.y1}) are not on the pivot row ${sheet.pivot.y}`, key);
    }
    // The standing size applies to standing poses; lying, carried and seated ones differ (S6-8).
    if (isActor && pose === undefined) {
      const ow = box.x1 - box.x0 + 1;
      const oh = box.y1 - box.y0 + 1;
      if (
        ow < ACTOR.occupied.w[0] ||
        ow > ACTOR.occupied.w[1] ||
        oh < ACTOR.occupied.h[0] ||
        oh > ACTOR.occupied.h[1]
      ) {
        add(
          `occupies ${ow} x ${oh}; an adult is about 18 x 40 (${ACTOR.occupied.w.join(' to ')} wide, ${ACTOR.occupied.h.join(' to ')} tall; Book 7 section 01)`,
          key,
        );
      }
    }
  }
  if (isActor) issues.push(...gaitProblems(sheet, rowsOf));
  return issues;
}

/**
 * The walk and run of a person's body sheet (Book 7 section 01; design addendum 2.3 section 12),
 * from each frame's crown and sole rows.
 */
export function gaitProblems(
  sheet: Sheet,
  rowsOf: ReadonlyMap<string, { readonly top: number; readonly bottom: number }>,
): ArtIssue[] {
  const issues: ArtIssue[] = [];
  const add = (reason: string, frame?: string): void => {
    issues.push(
      frame === undefined ? { sheet: sheet.name, reason } : { sheet: sheet.name, frame, reason },
    );
  };
  const heavy = isHeavy(sheet.name);
  const walk = sheet.anims['walk'];
  const run = sheet.anims['run'];
  if (walk === undefined) add('a person has a walk (Book 7 section 01)');
  else if (walk.frames !== WALK.frames)
    add(`the walk has ${walk.frames} frames; Book 7 asks for ${WALK.frames}`);
  if (run === undefined) add('a person has a run (Book 7 section 01)');
  else if (run.frames !== RUN.frames)
    add(`the run has ${run.frames} frames; Book 7 asks for ${RUN.frames}`);
  if (sheet.anims['idle'] === undefined) add('a person has an idle (Book 7 section 01)');
  const row = (state: string, facing: string, i: number) => rowsOf.get(`${state}/${facing}/${i}`);
  for (const facing of sheet.facings) {
    if (walk?.frames === WALK.frames) {
      const [lo, hi] = heavy ? WALK.heavyDrop : WALK.drop;
      WALK.down.forEach((d, k) => {
        const c = WALK.contact[k] ?? 0;
        const down = row('walk', facing, d);
        const contact = row('walk', facing, c);
        if (down === undefined || contact === undefined) return;
        const drop = down.top - contact.top;
        if (drop < lo || drop > hi)
          add(
            `the walk's down frame drops the head ${drop} px against frame ${c}; Book 7 asks for ${lo === hi ? `exactly ${lo}` : `${lo} to ${hi}`}`,
            `walk/${facing}/${d}`,
          );
      });
    }
    if (run?.frames === RUN.frames) {
      const [lo, hi] = RUN.drop;
      RUN.down.forEach((d, k) => {
        const c = RUN.contact[k] ?? 0;
        const down = row('run', facing, d);
        const contact = row('run', facing, c);
        if (down === undefined || contact === undefined) return;
        const drop = down.top - contact.top;
        if (drop < lo || drop > hi)
          add(
            `the run's down frame drops the torso ${drop} px against frame ${c}; addendum 2.3 asks for ${lo} to ${hi}`,
            `run/${facing}/${d}`,
          );
      });
      for (const s of RUN.suspension) {
        const r = row('run', facing, s);
        if (r !== undefined && r.bottom > sheet.pivot.y - RUN.lift)
          add(
            `the run's suspension frame has a foot on the ground (lowest row ${r.bottom}); both feet clear it by at least ${RUN.lift} px`,
            `run/${facing}/${s}`,
          );
      }
    }
  }
  return issues;
}

/** A person's layer sheets and their draw order per facing (assets/art/layers/*.layers.json). */
export interface LayerDef {
  readonly name: string;
  readonly layers: Readonly<Record<string, readonly string[]>>;
}

/** The body sheet of a layer definition: its one person sheet. */
export function bodyOf(def: LayerDef): string | undefined {
  return Object.values(def.layers)
    .flat()
    .find((n) => PERSON_SHEET.test(n));
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Book 2 section 19: a layer sheet has exactly its body's states, facings, frame counts, pivots and
 * events; a weapon or shield layer may use a larger canvas centred on the same foot anchor. Every
 * layer sheet belongs to a person, and every person lists the same sheets in each facing. Each
 * person, composited in its draw order, has the one-pixel ink outline all round (Book 7 section
 * 11) in every frame: a layer's own edge may take its cloth's deepest tone where it lies against
 * another layer, but never where it meets the ground.
 */
export function layerProblems(
  sheets: readonly Sheet[],
  defs: readonly LayerDef[],
  palette: Palette,
): ArtIssue[] {
  const issues: ArtIssue[] = [];
  const byName = new Map(sheets.map((s) => [s.name, s]));
  const used = new Set<string>();
  for (const def of defs) {
    const bodyName = bodyOf(def);
    const body = bodyName === undefined ? undefined : byName.get(bodyName);
    if (body === undefined) {
      issues.push({ sheet: def.name, reason: 'the layer file names no body sheet that exists' });
      continue;
    }
    const sets = new Set(Object.values(def.layers).map((l) => [...l].sort().join(' ')));
    if (sets.size !== 1 || ['s', 'n', 'e', 'w'].some((f) => def.layers[f] === undefined))
      issues.push({
        sheet: def.name,
        reason: 'each facing lists the same sheets, in its own order',
      });
    for (const name of new Set(Object.values(def.layers).flat())) {
      if (name === bodyName) continue;
      used.add(name);
      const layer = byName.get(name);
      const add = (reason: string): void => {
        issues.push({ sheet: name, reason: `${reason} (body ${body.name}, Book 2 section 19)` });
      };
      if (layer === undefined) {
        issues.push({ sheet: def.name, reason: `names a sheet that does not exist: ${name}` });
        continue;
      }
      if (!sameJson(layer.anims, body.anims))
        add("its states and frame counts differ from its body's");
      if (!sameJson(layer.facings, body.facings)) add("its facings differ from its body's");
      if (!sameJson(layer.events, body.events)) add("its animation events differ from its body's");
      const larger = /^layer_(weapon|shield)_/.test(name);
      const same =
        layer.width === body.width &&
        layer.height === body.height &&
        layer.pivot.x === body.pivot.x &&
        layer.pivot.y === body.pivot.y;
      const centred =
        layer.width >= body.width &&
        layer.height >= body.height &&
        layer.pivot.x - body.pivot.x === (layer.width - body.width) / 2 &&
        layer.pivot.y >= body.pivot.y &&
        layer.height - layer.pivot.y >= body.height - body.pivot.y;
      if (!same && !(larger && centred))
        add(
          larger
            ? "its canvas is not the body's, nor a larger one centred on the same foot anchor"
            : "its canvas or foot anchor differs from its body's",
        );
    }
  }
  const inks = new Set<number>([
    ...(palette.indexOf.has('k') ? [palette.indexOf.get('k') ?? -1] : []),
    ...(palette.ramps.get('ink') ?? []),
  ]);
  for (const def of defs) {
    const body = byName.get(bodyOf(def) ?? '');
    if (body === undefined) continue;
    for (const key of body.frames.keys()) {
      const facing = key.split('/')[1] ?? '';
      const bad = compositeEdge(def.layers[facing] ?? [], byName, key, inks);
      if (bad > 0)
        issues.push({
          sheet: def.name,
          frame: key,
          reason: `${bad} outer edge pixel(s) of the composite are not the ink outline (Book 7 section 11)`,
        });
    }
  }
  for (const s of sheets)
    if (s.name.startsWith('layer_') && !used.has(s.name))
      issues.push({ sheet: s.name, reason: 'belongs to no person (assets/art/layers)' });
  return issues;
}

/** Non-ink pixels on the outer edge of one frame of a person's layers drawn in order. */
function compositeEdge(
  order: readonly string[],
  byName: ReadonlyMap<string, Sheet>,
  key: string,
  inks: ReadonlySet<number>,
): number {
  const used = order.flatMap((n) => {
    const s = byName.get(n);
    return s === undefined ? [] : [s];
  });
  if (used.length === 0) return 0;
  const left = Math.max(...used.map((s) => s.pivot.x));
  const top = Math.max(...used.map((s) => s.pivot.y));
  const w = left + Math.max(...used.map((s) => s.width - s.pivot.x));
  const h = top + Math.max(...used.map((s) => s.height - s.pivot.y));
  const img = new Int32Array(w * h).fill(-1);
  for (const s of used) {
    const f = s.frames.get(key);
    if (f === undefined) continue;
    const dx = left - s.pivot.x;
    const dy = top - s.pivot.y;
    for (let y = 0; y < f.height; y++)
      for (let x = 0; x < f.width; x++) {
        const v = f.pixels[y * f.width + x] ?? NO_PIXEL;
        if (v !== NO_PIXEL) img[(y + dy) * w + x + dx] = v;
      }
  }
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? -1 : (img[y * w + x] ?? -1);
  let bad = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = at(x, y);
      if (v < 0 || inks.has(v)) continue;
      if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes(-1)) bad++;
    }
  return bad;
}

export function placeholders(sheets: readonly Sheet[]): string[] {
  return sheets.filter((s) => s.placeholder).map((s) => s.name);
}

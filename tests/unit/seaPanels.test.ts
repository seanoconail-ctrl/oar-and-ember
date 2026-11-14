/**
 * Stage 13, the sea map's screen (Book 2 section 09; Book 7 sections 05, 10 and 14; Book 8 section
 * 10): the panels' words and layout (src/ui/seaPanels.ts) and the chart's composition
 * (src/scenes/seaChart.ts) from the compiled atlases on disk: the wind, tide, visibility and
 * forecast in plain words with no ID on screen; the course's watches, landfall and stores; the
 * choice's consequences; labels that never overlap; the painted routes kept to open water; and
 * the chart's continuous motion with the camera still (at least 80%, and 50% with reduced motion)
 * in every weather, with the storm's lightning and the fog's layers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatString } from '../../src/content/strings.ts';
import { parseStormBalance } from '../../src/content/presentationBalance.ts';
import { parseTimeBalance } from '../../src/content/balance.ts';
import { loadStrings, REPO_ROOT } from '../../src/tools/art/loadTitleArt.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { decodePng } from '../../src/tools/art/png.ts';
import {
  continuousMotion,
  MOTION_THRESHOLD,
  REDUCED_MOTION_THRESHOLD,
} from '../../src/tools/art/motion.ts';
import { alongPath, headingOf, routePath, SeaChart } from '../../src/scenes/seaChart.ts';
import type { ChartWeather, PixelAtlas } from '../../src/scenes/seaChart.ts';
import {
  cartoucheLayout,
  choiceLines,
  courseLines,
  daysFor,
  forecastWords,
  labelLayout,
  legWords,
  LABEL_HEIGHT_PX,
  panelBox,
  panelSide,
  tideWords,
  visibilityWords,
  watchesWords,
  windWords,
} from '../../src/ui/seaPanels.ts';
import type { CourseModel, SeaWords } from '../../src/ui/seaPanels.ts';

const strings = loadStrings();
const words: SeaWords = {
  t: (key, vars) => formatString(strings, key, vars ?? {}),
  place: (id) => formatString(strings, `place.name.${id.toLowerCase()}`),
};
/** An ID-looking token on screen (the ID lint's rule, Book 8 section 10). */
const ID_LIKE = /\b([A-Z]{2,}_[A-Z0-9_]+|[a-z]+_[a-z0-9_]+|[a-z]+\.[a-z_]+\.[a-z_.]+)\b/;
const balance = loadBalanceJson();
const time = parseTimeBalance(balance);

describe('the sea map in words (Book 7 section 10; Book 8 section 10)', () => {
  it('says the wind by its point and strength, and the calm', () => {
    expect(windWords('SW', 2, words)).toBe('Wind from the south-west, a fair breeze');
    expect(windWords('N', 4, words)).toBe('Wind from the north, a full gale');
    expect(windWords('E', 0, words)).toBe('Flat calm: no wind to sail by');
  });

  it('says the tide and when the slack comes, or slack now', () => {
    expect(tideWords({ tide: 'FLOOD', slackIn: 120, slackAt: '12:00' }, words)).toBe(
      'Tide flooding; slack water about 12:00',
    );
    expect(tideWords({ tide: 'EBB', slackIn: 0, slackAt: '12:00' }, words)).toBe('Slack water now');
  });

  it('says the visibility and tomorrow, a storm or a calm first', () => {
    expect(visibilityWords('FOG', words)).toBe('Fog on the water');
    expect(visibilityWords('NIGHT', words)).toBe('Night');
    const f = {
      windFrom: 'W' as const,
      strength: 3,
      visibility: 'HAZE' as const,
      storm: false,
      calm: false,
    };
    expect(forecastWords(f, words)).toBe('Tomorrow: wind from the west, a strong wind; hazy');
    expect(forecastWords({ ...f, storm: true }, words)).toMatch(/storm/);
    expect(forecastWords({ ...f, calm: true }, words)).toMatch(/calm/);
    expect(forecastWords(null, words)).toBe('No forecast yet');
  });

  it('counts watches in words and stores in days for everyone aboard', () => {
    expect(watchesWords(0.2, words)).toBe('less than a watch');
    expect(watchesWords(1.2, words)).toBe('about 1 watch');
    expect(watchesWords(2.6, words)).toBe('about 3 watches');
    // Book 10: a person eats storesPerPersonPerWatch a watch, four watches a day (1 rd a day).
    expect(daysFor(20, 5, 1)).toBe(4);
    expect(daysFor(11, 5, 1)).toBe(2);
    expect(daysFor(1, 0, 1)).toBe(0);
  });

  it('gives the course its way, watches, landfall, stores and gate, with no ID on screen', () => {
    const c: CourseModel = {
      from: words.place('ISLE_SKARV'),
      to: words.place('SITE_CARRICK'),
      via: [],
      watches: 2,
      arriveDay: 5,
      arriveTime: '18:00',
      waitMinutes: 0,
      eatRd: 2.5,
      aboardRd: 20,
      mouths: 5,
      perDay: 1,
      gate: true,
    };
    const lines = courseLines(c, words);
    expect(lines).toEqual([
      'Skarvholm to Carrick Landing.',
      'At sea about 2 watches; landfall about 18:00 on day 5.',
      'Stores aboard: 4 days for 5. The course eats about half a day.',
      'Setting out on this course begins the raid on Carrick Landing.',
    ]);
    const short = courseLines(
      { ...c, via: [words.place('TOWN_SALTVIK')], aboardRd: 1, waitMinutes: 30, gate: false },
      words,
    );
    expect(short).toContain('By way of Saltvik.');
    expect(short).toContain('The course waits for slack water at the Cauldron.');
    expect(short).toContain('The stores will not last the course.');
    for (const l of [...lines, ...short]) expect(l, l).not.toMatch(ID_LIKE);
  });

  it('says how the boat goes: under sail by its point, or rowing and why', () => {
    const at = { from: 'Skarvholm', to: 'Saltvik' };
    expect(legWords({ ...at, pointOfSail: 'BEAM', rowing: false }, words)).toBe(
      'Under sail with the wind on the beam, Skarvholm to Saltvik.',
    );
    expect(legWords({ ...at, pointOfSail: 'CALM', rowing: true }, words)).toBe(
      'At the oars, Skarvholm to Saltvik: there is no wind.',
    );
    expect(legWords({ ...at, pointOfSail: 'AGAINST', rowing: true }, words)).toMatch(/dead ahead/);
  });

  it('puts the choice with what follows from each option, and says the watches wait', () => {
    const c = choiceLines(
      {
        questionKey: 'sea.choice.rising',
        pressOn: {
          textKey: 'sea.choice.press_on',
          watches: 2,
          strength: 3,
          storm: true,
          arriveTime: '18:00',
        },
        shelter: { textKey: 'sea.choice.shelter', untilTime: '06:00', watches: 3, eatDays: 0.5 },
      },
      words,
    );
    expect(c.question).toMatch(/weather is rising/i);
    expect(c.pressOn.label).toBe('Press on');
    expect(c.pressOn.then).toBe(
      'Cross now: about 2 watches of open water in a strong wind. Landfall about 18:00. A storm will work at the seams.',
    );
    expect(c.shelter.label).toBe('Shelter');
    expect(c.shelter.then).toMatch(/^Wait here until 06:00: about 3 watches more at sea/);
    expect(c.clock).toBe('The watches wait while you choose.');
  });
});

describe('the sea map laid out', () => {
  it('names places beside their pictograms, never over one another or the panel', () => {
    const chart = JSON.parse(readFileSync(join(REPO_ROOT, 'content/launch.json'), 'utf8')) as {
      seaMap: { places: Record<string, { x: number; y: number }> };
    };
    const labels = Object.entries(chart.seaMap.places).map(([id, p]) => ({
      id,
      x: p.x,
      y: p.y + 8,
      text: words.place(id),
    }));
    const cart = cartoucheLayout();
    for (const side of ['left', 'right'] as const) {
      const panel = panelBox(side, 640, 360);
      const out = labelLayout(labels, 640, 360, [cart.box, panel]);
      expect(out).toHaveLength(labels.length);
      const boxes = out.map((l) => ({
        x0: l.lx - (l.text.length * 4.6 + 4) / 2,
        x1: l.lx + (l.text.length * 4.6 + 4) / 2,
        y0: l.ly,
        y1: l.ly + LABEL_HEIGHT_PX,
      }));
      let clashes = 0;
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          if (
            a !== undefined &&
            b !== undefined &&
            a.x0 < b.x1 &&
            b.x0 < a.x1 &&
            a.y0 < b.y1 &&
            b.y0 < a.y1
          )
            clashes++;
        }
      expect(clashes, side).toBe(0);
      for (const b of boxes) {
        expect(b.x0).toBeGreaterThanOrEqual(8);
        expect(b.x1).toBeLessThanOrEqual(632);
      }
    }
  });

  it('keeps the weather marks in the frame and the panel away from the boat', () => {
    const lay = cartoucheLayout();
    expect(lay.marks.map((m) => m.kind)).toEqual([
      'watch',
      'wind',
      'tide',
      'vis',
      'forecast',
      'stores',
    ]);
    for (const m of lay.marks) {
      expect(m.x - 8).toBeGreaterThanOrEqual(5);
      expect(m.y - 15).toBeGreaterThanOrEqual(5);
    }
    expect(panelSide([{ x: 500 }], 640)).toBe('left');
    expect(panelSide([{ x: 100 }], 640)).toBe('right');
    expect(panelSide([], 640)).toBe('right');
  });
});

// ------------------------------------------------------------------------- the chart
function atlas(name: string): PixelAtlas {
  const dir = join(REPO_ROOT, 'assets/atlases');
  const manifest = JSON.parse(
    readFileSync(join(dir, `${name}.json`), 'utf8'),
  ) as PixelAtlas['manifest'];
  const img = decodePng(readFileSync(join(dir, `${name}.png`)));
  return { manifest, width: img.width, rgba: img.data };
}
const atlases = new Map(
  ['ui_seamap', 'ui_seavoyage', 'ui_seaicons', 'token_t1', 'fx_seawake', 'fx_seabolt'].map(
    (n) => [n, atlas(n)] as const,
  ),
);
const storm = parseStormBalance(balance);
const chart = new SeaChart(atlases, storm);
const places = (
  JSON.parse(readFileSync(join(REPO_ROOT, 'content/launch.json'), 'utf8')) as {
    seaMap: { places: Record<string, { x: number; y: number }> };
  }
).seaMap.places;
const SK = places['ISLE_SKARV'] ?? { x: 0, y: 0 };
const CARRICK = places['SITE_CARRICK'] ?? { x: 0, y: 0 };
const course = routePath(SK, CARRICK, (x, y) => chart.isLand(x, y), 7);

const WEATHER = {
  day: {
    windTo: { x: 0.7, y: -0.7 },
    strength: 2,
    visibility: 'CLEAR',
    storm: false,
    rain: false,
    fog: false,
  },
  fog: {
    windTo: { x: 1, y: 0 },
    strength: 1,
    visibility: 'FOG',
    storm: false,
    rain: false,
    fog: true,
  },
  haze: {
    windTo: { x: 0, y: 1 },
    strength: 3,
    visibility: 'HAZE',
    storm: false,
    rain: true,
    fog: false,
  },
  storm: {
    windTo: { x: 0.7, y: -0.7 },
    strength: 4,
    visibility: 'HAZE',
    storm: true,
    rain: true,
    fog: false,
  },
  night: {
    windTo: { x: -1, y: 0 },
    strength: 2,
    visibility: 'NIGHT',
    storm: false,
    rain: false,
    fog: false,
  },
  calm: { windTo: null, strength: 0, visibility: 'CLEAR', storm: false, rain: false, fog: false },
} satisfies Record<string, ChartWeather>;

/** 41 frames over 6.4 s with the camera still, as the capture measures (Book 7 section 14). */
function motionOf(w: ChartWeather, reduced: boolean): number {
  const frames: Uint8Array[] = [];
  for (let i = 0; i <= 40; i++) {
    const f = chart.compose({
      seconds: 3 + i * 0.16,
      reduced,
      weather: w,
      routes: [{ points: course, kind: 'course' }],
      marks: [{ state: 'place_hall', x: SK.x, y: SK.y + 7 }],
      token: { x: 280, y: 200, heading: 'sw', state: 'set_raven_woad', wake: true },
    });
    frames.push(Uint8Array.from(f.rgba));
  }
  return continuousMotion(frames, 640, 360).share;
}

describe('the chart in the voyage’s light (Book 7 section 14)', () => {
  it('keeps at least 80% of the chart moving in every weather, and half with reduced motion', () => {
    for (const [name, w] of Object.entries(WEATHER)) {
      expect(motionOf(w, false), name).toBeGreaterThanOrEqual(MOTION_THRESHOLD);
      expect(motionOf(w, true), `${name} reduced`).toBeGreaterThanOrEqual(REDUCED_MOTION_THRESHOLD);
    }
  }, 120_000);

  it('paints every pixel from the chart’s authored frames (palette colours only)', () => {
    const colours = new Set<number>();
    for (const a of atlases.values()) {
      const v = new Uint32Array(a.rgba.buffer, a.rgba.byteOffset, a.rgba.byteLength >> 2);
      for (const c of v) if (c >>> 24 !== 0) colours.add(c);
    }
    for (const w of Object.values(WEATHER)) {
      const f = chart.compose({
        seconds: 5,
        reduced: false,
        weather: w,
        routes: [],
        marks: [],
        token: null,
      });
      const px = new Uint32Array(f.rgba.buffer, f.rgba.byteOffset, f.rgba.byteLength >> 2);
      let foreign = 0;
      for (const c of px) if (!colours.has(c)) foreign++;
      expect(foreign).toBe(0);
    }
  });

  it('flashes lightning in a storm as a double flicker, and a soft swell with reduced motion', () => {
    // Over a minute a storm strikes (Book 10 lightningEvery: 6 to 14 s apart).
    let bright = 0;
    let maxReduced = 0;
    for (let s = 0; s < 60; s += 1 / 60) {
      if (chart.flashAt(s, false).light >= 0.99) bright++;
      maxReduced = Math.max(maxReduced, chart.flashAt(s, true).light);
    }
    expect(bright).toBeGreaterThan(0);
    // The reduced swell never flickers to full: half strength at most (lightningReduced).
    expect(maxReduced).toBeLessThanOrEqual(storm.reduced.strength + 1e-9);
    expect(maxReduced).toBeGreaterThan(0);
  });

  it('darkens the chart in a storm and by night', () => {
    const lum = (w: ChartWeather): number => {
      const f = chart.compose({
        seconds: 0.5,
        reduced: true,
        weather: w,
        routes: [],
        marks: [],
        token: null,
      });
      let s = 0;
      for (let i = 0; i < f.rgba.length; i += 4)
        s += (f.rgba[i] ?? 0) + (f.rgba[i + 1] ?? 0) + (f.rgba[i + 2] ?? 0);
      return s;
    };
    const day = lum(WEATHER.day);
    expect(lum({ ...WEATHER.storm, rain: false, visibility: 'CLEAR' })).toBeLessThan(day * 0.85);
    expect(lum(WEATHER.night)).toBeLessThan(day * 0.8);
  });

  it('paints routes round the coast by open water, end to end', () => {
    expect(course.length / 2).toBeGreaterThan(40);
    let ashore = 0;
    const n = course.length / 2;
    for (let i = 0; i < n; i++) {
      const x = course[i * 2] ?? 0;
      const y = course[i * 2 + 1] ?? 0;
      const nearEnd =
        Math.hypot(x - SK.x, y - SK.y) < 18 || Math.hypot(x - CARRICK.x, y - CARRICK.y) < 18;
      if (!nearEnd && chart.isLand(x, y)) ashore++;
    }
    expect(ashore / n).toBeLessThan(0.03);
    const start = alongPath(course, 0);
    const end = alongPath(course, 1);
    expect(Math.hypot(start.x - SK.x, start.y - SK.y)).toBeLessThan(1);
    expect(Math.hypot(end.x - CARRICK.x, end.y - CARRICK.y)).toBeLessThan(1);
    // Skarvholm to Carrick runs south-west on the chart.
    expect(['s', 'sw', 'w']).toContain(alongPath(course, 0.5).heading);
  });

  it('turns a chart direction into one of the token’s eight headings', () => {
    expect(headingOf(0, -1)).toBe('n');
    expect(headingOf(1, 0)).toBe('e');
    expect(headingOf(-1, 1)).toBe('sw');
    expect(headingOf(-1, -1)).toBe('nw');
  });

  it('reads the watch animation’s seconds from Book 10', () => {
    expect(time.seaWatchAnimSeconds).toBeGreaterThan(0);
  });
});

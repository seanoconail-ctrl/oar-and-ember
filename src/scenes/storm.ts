/**
 * The storm of the cold open (design addendum 2.5 section 3; Book 7 section 05; Book 10 section 25,
 * "The storm"; decisions DF-16 and DF-17): presentation only, read from the cold open's seconds,
 * with its own seeded stream (never the simulation's), so the same seconds always draw the same
 * storm and the tests can check its timings.
 *
 * - **Lightning**: strikes 6 to 14 s apart, one scripted about 25 s in to show the skerry ahead;
 *   each a double flicker (bright 4 ticks, dim 3, bright 3, then a 0.4 s fade) lighting the ship,
 *   the sea and the land to 70% of the day grade, with hard shadows away from the strike; with
 *   reduced flashes, one soft swell at half strength. Thunder follows by the strike's distance.
 * - **Fog and light**: two layers of mist drifting downwind at their own speeds, never over the
 *   steerer or the steering oar; the night's light varying in drifting patches; the stern
 *   lantern's pool swinging with the ship.
 * - **The sea**: swells' crests rolling in with foam streaks along them; waves breaking against
 *   the hull in bursts of spray; green water over the side and off through the scuppers; rain.
 * - **The ship**: pitching (the bow up and down) and rolling (three roll frames, the mast's head
 *   swaying), the people on deck moving with it; the camera swaying with the sea.
 */
import type { StormBalance } from '../content/presentationBalance.ts';
import type { LightPool, SceneSprite, ShadowCaster } from '../render/scene.ts';

/** The storm hull's strips (assets/art/authoring/storm25_art.py, ship_t1_storm's header). */
export const STORM_HULL = {
  /** Strip 0's left edge, in ship_t1_launch's canvas columns. */
  x0: 5,
  /** The waterline row in ship_t1_launch's canvas: each strip's pivot row. */
  waterline: 178,
  strips: 12,
  strip: 16,
  /** ship_t1_launch's pivot. */
  pivotX: 104,
  pivotY: 186,
} as const;

const TICKS = 60;
const TAU = Math.PI * 2;

/** A small seeded generator (the presentation's own stream). */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export interface Strike {
  /** Cold-open seconds when the flash starts. */
  readonly at: number;
  /** 0 near .. 1 far. */
  readonly distance: number;
  readonly thunderAt: number;
  /** The thunder's roll, seconds. */
  readonly roll: number;
  /** Where the bolt is seen, a share of the view's width, and from which side the light comes. */
  readonly across: number;
  readonly scripted: boolean;
}

/** The cold open's lightning strikes, up to `until` seconds (the hull's strike on the skerry). */
export function strikes(b: StormBalance, until: number): Strike[] {
  const r = stream(0x5747);
  const times: { at: number; scripted: boolean }[] = [
    { at: b.scriptedStrikeSeconds, scripted: true },
  ];
  // Back from the scripted strike to the start, 6 to 14 s apart.
  let t = b.scriptedStrikeSeconds;
  for (;;) {
    t -= lerp(b.lightningEvery[0], b.lightningEvery[1], r());
    if (t < 1.5) break;
    times.unshift({ at: t, scripted: false });
  }
  // And on from it, while before the hull strikes.
  t = b.scriptedStrikeSeconds;
  for (;;) {
    t += lerp(b.lightningEvery[0], b.lightningEvery[1], r());
    if (t >= until) break;
    times.push({ at: t, scripted: false });
  }
  return times.map(({ at, scripted }) => {
    // The skerry's strike is near: it lights the rocks ahead.
    const distance = scripted ? 0.3 : r();
    return {
      at,
      distance,
      thunderAt: at + lerp(b.thunderAfter[0], b.thunderAfter[1], distance),
      roll: lerp(b.thunderRoll[1], b.thunderRoll[0], distance),
      across: scripted ? 0.3 : 0.15 + 0.7 * r(),
      scripted,
    };
  });
}

/** One strike's light at `dt` seconds after it starts, 0..1 (1: the bright frames). */
export function flashProfile(dt: number, b: StormBalance, reduced: boolean): number {
  if (dt < 0) return 0;
  if (reduced) {
    const { up, down, strength } = b.reduced;
    if (dt < up) return (dt / up) * strength;
    if (dt < up + down) return (1 - (dt - up) / down) * strength;
    return 0;
  }
  const f = b.flash;
  const tick = dt * TICKS;
  if (tick < f.bright) return 1;
  if (tick < f.bright + f.dim) return DIM;
  const end = f.bright + f.dim + f.bright2;
  if (tick < end) return 1;
  // Then the light fades from the second bright frame over the fade.
  return Math.max(0, 1 - (dt - end / TICKS) / f.fadeSeconds);
}

/** The dim frames' light between the two bright ones (a share of the bright). */
export const DIM = 0.35;

/** The light of every strike now, the strongest. */
export function flashAt(
  t: number,
  list: readonly Strike[],
  b: StormBalance,
  reduced: boolean,
): number {
  let v = 0;
  for (const s of list) v = Math.max(v, flashProfile(t - s.at, b, reduced));
  return v;
}

/** The strike lighting the scene now, if any. */
export function strikeNow(t: number, list: readonly Strike[]): Strike | null {
  let best: Strike | null = null;
  for (const s of list) if (t >= s.at && t - s.at < 1) best = s;
  return best;
}

/** The camera's sway in whole pixels: up and down with the pitch, sideways with the roll. */
export function swayAt(t: number, b: StormBalance, reduced: boolean): { x: number; y: number } {
  if (reduced) return { x: 0, y: 0 };
  return {
    x: Math.round(b.swayX * Math.sin((TAU * t) / b.rollSeconds)),
    y: Math.round(b.swayY * Math.sin((TAU * t) / b.pitchSeconds + 0.6)),
  };
}

/** How far the bow is lifted (px, positive up) by the pitch. */
export function pitchAt(t: number, b: StormBalance): number {
  return b.pitchPx * Math.sin((TAU * t) / b.pitchSeconds);
}

/** The hull's roll frame now. */
export function rollAt(t: number, b: StormBalance): 'port' | 'level' | 'starboard' {
  const v = Math.sin((TAU * t) / b.rollSeconds);
  return v < -1 / 3 ? 'port' : v > 1 / 3 ? 'starboard' : 'level';
}

/** A strip's lift (px, screen y: negative is up) for the bow's pitch; strip 0 is at the bow. */
export function stripLift(i: number, bow: number): number {
  const mid = (STORM_HULL.strips - 1) / 2;
  return -Math.round((bow * (mid - i)) / mid);
}

export interface Wave {
  readonly at: number;
  /** Along the hull, -1 (bow) .. 1 (stern). */
  readonly along: number;
  readonly count: number;
  readonly height: number;
  readonly seed: number;
}

/** Waves breaking against the hull, every 3 to 6 s. */
export function waves(b: StormBalance, until: number): Wave[] {
  const r = stream(0x77a3);
  const out: Wave[] = [];
  for (let t = 1.2 + r() * 2; t < until; t += lerp(b.breakEvery[0], b.breakEvery[1], r()))
    out.push({
      at: t,
      along: r() * 1.6 - 0.8,
      count: Math.round(lerp(b.sprayCount[0], b.sprayCount[1], r())),
      height: lerp(b.sprayHeight[0], b.sprayHeight[1], r()),
      seed: Math.floor(r() * 1e9),
    });
  return out;
}

/** Green water over the side, every 8 to 12 s. */
export function greenWater(b: StormBalance, until: number): number[] {
  const r = stream(0x9e3b);
  const out: number[] = [];
  for (let t = 4 + r() * 3; t < until; t += lerp(b.greenWaterEvery[0], b.greenWaterEvery[1], r()))
    out.push(t);
  return out;
}

const GRAVITY = 140;

/** A wave's spray particles `dt` after it breaks: [dx, height, dy] each, while in the air. */
export function sprayOf(w: Wave, dt: number): { x: number; z: number; y: number; k: number }[] {
  const r = stream(w.seed);
  const out: { x: number; z: number; y: number; k: number }[] = [];
  for (let j = 0; j < w.count; j++) {
    const h = w.height * (0.55 + 0.45 * r());
    const vz = Math.sqrt(2 * GRAVITY * h);
    const vx = (r() - 0.5) * 50 - 18;
    // Thrown up from the near side and falling back across the deck (up the screen).
    const vy = -10 - r() * 22;
    const t = dt - r() * 0.12;
    if (t < 0) continue;
    const z = vz * t - (GRAVITY * t * t) / 2;
    if (z < -4) continue;
    out.push({ x: vx * t, z: Math.max(0, z), y: vy * t, k: Math.min(3, Math.floor(t * 4)) });
  }
  return out;
}

/** How many raindrops are on screen now (80 to 120, rising and easing with the gusts). */
export function rainCount(t: number, b: StormBalance): number {
  return Math.round(lerp(b.rainDrops[0], b.rainDrops[1], 0.5 + 0.5 * Math.sin(t * 0.7)));
}

export interface MistBank {
  readonly layer: 'low' | 'high';
  readonly x: number;
  readonly y: number;
  readonly frame: number;
}

/** The mist layers' geometry on screen (sprite pivots), drifting downwind (west). */
const MIST = {
  low: { w: 160, h: 44, dx: 212, dy: 84, density: 1 },
  high: { w: 200, h: 36, dx: 300, dy: 124, density: 1 },
} as const;

/**
 * The mist banks in view at `t`: each layer a staggered grid of banks drifting downwind at its
 * own speed (tiles a second), in world space so they roll over the sea as the ship moves; none
 * whose box would cover the steerer or the steering oar (`keepClear`, on screen).
 */
export function mistBanks(
  t: number,
  b: StormBalance,
  camera: { readonly x: number; readonly y: number },
  tile: number,
  keepClear: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  reduced: boolean,
): MistBank[] {
  const out: MistBank[] = [];
  (['low', 'high'] as const).forEach((layer, li) => {
    const g = MIST[layer];
    const drift = (reduced ? 0.5 : 1) * b.fogSpeeds[li === 0 ? 0 : 1] * tile * t;
    const row0 = Math.floor((camera.y - g.h) / g.dy);
    for (let row = row0; row * g.dy < camera.y + 360 + g.h; row++) {
      const stagger = (row & 1) * (g.dx / 2) + li * 57;
      const col0 = Math.floor((camera.x + drift - stagger - g.w) / g.dx);
      for (let col = col0; col * g.dx + stagger - drift < camera.x + 640 + g.w; col++) {
        const wx = col * g.dx + stagger - drift + g.w / 2;
        const wy = row * g.dy + g.h;
        const sx = wx - camera.x;
        const sy = wy - camera.y;
        const left = sx - g.w / 2;
        const top = sy - g.h;
        if (
          left < keepClear.x + keepClear.w &&
          keepClear.x < left + g.w &&
          top < keepClear.y + keepClear.h &&
          keepClear.y < top + g.h
        )
          continue;
        out.push({ layer, x: sx, y: sy, frame: (((col * 7 + row * 3) % 2) + 2) % 2 });
      }
    }
  });
  return out;
}

/** The ship's place on screen and what the storm needs to draw it. */
export interface StormInput {
  readonly t: number;
  readonly b: StormBalance;
  readonly reduced: boolean;
  /** The boat's pivot on screen (ship_t1_launch's pivot). */
  readonly bx: number;
  readonly by: number;
  readonly camera: { readonly x: number; readonly y: number };
  readonly tile: number;
  /** Whether a world pixel is open sea (crests and foam are drawn only there). */
  readonly isSea: (x: number, y: number) => boolean;
  readonly bodyModel: 'A' | 'B';
  readonly strikeSeconds: number;
  readonly list: readonly Strike[];
  readonly waveList: readonly Wave[];
  readonly greenList: readonly number[];
}

export interface StormDrawing {
  readonly under: SceneSprite[];
  readonly ship: SceneSprite[];
  readonly over: SceneSprite[];
  readonly pools: LightPool[];
  readonly shadows: ShadowCaster[];
  readonly flash: number;
  readonly roll: 'port' | 'level' | 'starboard';
  readonly bow: number;
  /** The steerer's and the steering oar's box on screen (kept clear of mist). */
  readonly clear: { x: number; y: number; w: number; h: number };
  readonly drops: number;
  readonly mist: readonly MistBank[];
}

const SEA_SORT = -1e6;

/** Everything the storm draws this frame (screen space). */
export function drawStorm(s: StormInput): StormDrawing {
  const { t, b, bx, by } = s;
  const under: SceneSprite[] = [];
  const ship: SceneSprite[] = [];
  const over: SceneSprite[] = [];
  const pools: LightPool[] = [];
  const bow = s.reduced ? pitchAt(t, b) * 0.5 : pitchAt(t, b);
  const roll = rollAt(t, b);
  const k4 = Math.floor(t * (60 / 9)) % 4;
  // Swells rolling in from the south at swellSpeed, crests 3 to 4 tiles apart, foam along them.
  const tile = s.tile;
  const mean = ((b.swellApart[0] + b.swellApart[1]) / 2) * tile;
  const roll0 = b.swellSpeed * tile * t;
  const first = Math.floor((s.camera.y - 20 + roll0) / mean);
  for (let n = first; n * mean - roll0 < s.camera.y + 380; n++) {
    // Each crest's spacing varies within 3 to 4 tiles.
    const jitter =
      (((n * 2654435761) >>> 0) / 4294967296 - 0.5) * (b.swellApart[1] - b.swellApart[0]) * tile;
    const wy = n * mean - roll0 + jitter;
    const sy = Math.round(wy - s.camera.y);
    for (let x = -64 + ((((n * 37) % 64) + 64) % 64); x < 704; x += 60) {
      const wx = x + s.camera.x;
      const gap = (((n * 73856093) ^ (Math.floor(wx / 60) * 19349663)) >>> 0) % 7 === 0;
      if (gap || !s.isSea(wx, wy)) continue;
      under.push({
        sheet: 'fx_storm',
        frame: `crest/-/${(Math.floor(t * 6) + n) % 4}`,
        x,
        y: sy,
        layer: 'actor',
        sort: SEA_SORT + sy,
      });
      if (((n + Math.floor(wx / 60)) & 1) === 0)
        under.push({
          sheet: 'fx_storm',
          frame: `foam/-/${(Math.floor(t * 10) + n * 2) % 6}`,
          x: x + 6,
          y: sy - 4,
          layer: 'actor',
          sort: SEA_SORT + sy + 0.5,
        });
    }
  }
  // The hull a strip at a time, pitched, in its roll frame.
  const H = STORM_HULL;
  for (let i = 0; i < H.strips; i++)
    ship.push({
      sheet: 'ship_t1_storm',
      frame: `${roll}/-/${i * 4 + k4}`,
      x: bx - H.pivotX + H.x0 + i * H.strip,
      y: by - H.pivotY + H.waterline + stripLift(i, bow),
      layer: 'actor',
      sort: by,
    });
  // Height on the deck at an x on screen (the pitch's lift there).
  const liftAt = (dx: number): number => {
    const i = (dx + H.pivotX - H.x0) / H.strip;
    return stripLift(Math.max(0, Math.min(H.strips - 1, i)), bow);
  };
  const mastLift = liftAt(0);
  ship.push({
    sheet: 'ship_t1_storm_mast',
    frame: `${roll}/-/${Math.floor(t * (60 / 7)) % 4}`,
    x: bx,
    y: by + mastLift,
    layer: 'actor',
    sort: by + 0.1,
  });
  const mastHead = roll === 'port' ? -2 : roll === 'starboard' ? 2 : 0;
  ship.push({
    sheet: 'prop_cold_sail',
    frame: `torn/-/${Math.floor(t * 8) % 4}`,
    x: bx + mastHead,
    y: by - 52 + mastLift,
    layer: 'actor',
    sort: by + 0.2,
  });
  // The household at the oars, braced, moving with the deck; the steerer at the steering oar;
  // Thorkel at the bow shouting.
  for (const [who, dx] of [
    ['hild_1', -36],
    ['oddi_2', -12],
    ['bran_0', 12],
    ['runa_3', 34],
  ] as const)
    ship.push({
      sheet: 'ship_t1_crew',
      frame: `${who}/-/${Math.floor(t * 3) % 4}`,
      x: bx + dx,
      y: by - 6 + liftAt(dx),
      layer: 'actor',
      sort: by + 0.3,
    });
  const helm = `helm_${s.bodyModel.toLowerCase()}`;
  ship.push({
    sheet: 'ship_t1_crew',
    frame: `${helm}/-/${Math.floor(t * 2) % 4}`,
    x: bx + 78,
    y: by - 8 + liftAt(78),
    layer: 'actor',
    sort: by + 0.35,
  });
  ship.push({
    sheet: 'prop_cold_figures',
    frame: `thorkel/-/${Math.floor(t * 5) % 4}`,
    x: bx - 84,
    y: by - 14 + liftAt(-84),
    layer: 'actor',
    sort: by + 0.35,
  });
  // The stern lantern swinging, and its warm pool (3 tiles), swinging with the roll.
  const swing = Math.sin((TAU * t) / b.rollSeconds) * 3;
  const lx = bx + 88 + swing;
  const ly = by - 30 + liftAt(88);
  ship.push({
    sheet: 'fx_storm_drops',
    frame: `lantern/-/${Math.floor(t * 3) % 2}`,
    x: Math.round(lx),
    y: Math.round(ly),
    layer: 'actor',
    sort: by + 0.4,
  });
  pools.push({ x: lx, y: ly - 4, radius: b.lanternTiles * tile, colour: [120, 70, 22] });
  // Waves breaking on the hull: a white burst at the near side and spray falling across the deck.
  for (const w of s.waveList) {
    const dt = t - w.at;
    if (dt < 0 || dt > 1.6) continue;
    const wx = bx + w.along * 80;
    const wy = by + 2;
    if (dt < 6 * (5 / 60))
      over.push({
        sheet: 'fx_storm',
        frame: `burst/-/${Math.min(5, Math.floor(dt / (5 / 60)))}`,
        x: Math.round(wx),
        y: wy,
        layer: 'actor',
        sort: by + 0.5,
      });
    for (const p of sprayOf(w, dt))
      over.push({
        sheet: 'fx_storm_drops',
        frame: `spray/-/${p.k}`,
        x: Math.round(wx + p.x),
        y: Math.round(wy + p.y - p.z),
        layer: 'actor',
        sort: by + 0.6,
      });
  }
  // Green water over the side, then foam off the deck through the scuppers.
  for (const g of s.greenList) {
    const dt = t - g;
    if (dt < 0 || dt > 2.4) continue;
    if (dt < 8 * (5 / 60))
      over.push({
        sheet: 'fx_storm',
        frame: `green/-/${Math.min(7, Math.floor(dt / (5 / 60)))}`,
        x: bx - 10,
        y: by - 2 + liftAt(-10),
        layer: 'actor',
        sort: by + 0.45,
      });
    else
      for (const dx of [-60, -20, 24, 60])
        over.push({
          sheet: 'fx_storm_drops',
          frame: `scupper/-/${Math.floor(dt * 12) % 4}`,
          x: bx + dx,
          y: by + 4 + liftAt(dx),
          layer: 'actor',
          sort: by + 0.45,
        });
  }
  // Lightning: the bolt far off in the bright frames.
  const flash = flashAt(t, s.list, b, s.reduced);
  const strike = strikeNow(t, s.list);
  if (!s.reduced && strike !== null && flash >= 1 - 1e-6)
    over.push({
      sheet: 'fx_storm',
      frame: `bolt/-/${Math.floor((t - strike.at) * 30) % 3}`,
      x: Math.round(strike.across * 640),
      y: 150,
      layer: 'actor',
      sort: SEA_SORT + 0.5,
    });
  // Rain slanting downwind across the whole view.
  const drops = rainCount(t, b);
  const slant = Math.tan((b.rainSlantDegrees * Math.PI) / 180);
  for (let i = 0; i < drops; i++) {
    const fall = 380 + (i % 5) * 30;
    const ry = ((i * 53.3 + t * fall) % 380) - 10;
    const rx = ((((i * 97.1 - t * fall * slant) % 680) + 680) % 680) - 20;
    over.push({
      sheet: 'fx_storm_drops',
      frame: `rain/-/${(i + Math.floor(t * 20)) % 4}`,
      x: Math.round(rx),
      y: Math.round(ry),
      layer: 'actor',
      sort: 1e6,
    });
  }
  // The steerer and the steering oar, kept clear of the mist.
  const clear = { x: bx + 56, y: by - 70, w: 64, h: 84 };
  const mist = mistBanks(t, b, s.camera, tile, clear, s.reduced);
  for (const m of mist)
    (m.layer === 'low' ? under : over).push({
      sheet: 'fx_storm_mist',
      frame: `${m.layer}/-/${m.frame}`,
      x: Math.round(m.x),
      y: Math.round(m.y),
      layer: 'actor',
      sort: m.layer === 'low' ? SEA_SORT + 5000 : 9e5,
    });
  // Hard shadows away from the strike in the bright frames: the ship's people and mast cast them.
  const shadows: ShadowCaster[] = [];
  if (flash > 0.5)
    for (const sp of ship)
      if (sp.sheet === 'ship_t1_crew' || sp.sheet === 'prop_cold_figures')
        shadows.push({ x: sp.x, y: sp.y, w: 8, h: 3, sheet: sp.sheet, frame: sp.frame });
  return { under, ship, over, pools, shadows, flash, roll, bow, clear, drops, mist };
}

/**
 * The first rain over the island (Book 10 section 25, firstRain; decision DF-21): its drops on
 * screen now, or 0 when dry. It falls once the sail is raised, from its hour on its day to its end.
 */
export function firstRainDrops(
  day: number,
  minute: number,
  sailRaised: boolean,
  b: StormBalance,
  seconds: number,
): number {
  if (!sailRaised) return 0;
  const r = b.firstRain;
  const now = day * 1440 + minute;
  if (now < r.fromDay * 1440 + r.from || now >= r.toDay * 1440 + r.to) return 0;
  return Math.round(
    lerp(b.firstRainDrops[0], b.firstRainDrops[1], 0.5 + 0.5 * Math.sin(seconds * 0.4)),
  );
}

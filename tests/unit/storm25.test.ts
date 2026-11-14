/**
 * The storm opening, design addendum 2.5 section 3 (Book 7 section 05; Book 10 section 25, "The
 * storm"; decisions DF-15 to DF-17 and DF-21): the lightning's double flicker and its limit of two
 * flashes a second, thunder after it by the strike's distance, the camera's sway, the ship's pitch
 * and roll, breaking waves and their spray, green water, rain, the mist's cover kept off the
 * steerer, the first rain over the camp, and the art's geometry.
 */
import { describe, expect, it } from 'vitest';
import { parseStormBalance } from '../../src/content/presentationBalance.ts';
import { NO_PIXEL } from '../../src/render/indexedImage.ts';
import {
  drawStorm,
  firstRainDrops,
  flashAt,
  flashProfile,
  greenWater,
  mistBanks,
  pitchAt,
  rainCount,
  rollAt,
  sprayOf,
  STORM_HULL,
  stripLift,
  strikes,
  swayAt,
  waves,
} from '../../src/scenes/storm.ts';
import { loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';

const sb = parseStormBalance(loadBalanceJson());
const STRIKE = 31;
const list = strikes(sb, STRIKE);
const sheets = new Map(loadSheets().map((s) => [s.name, s]));

describe('Book 10 section 25, "The storm"', () => {
  it('reads every number as the book writes it', () => {
    expect(sb.lightningEvery).toEqual([6, 14]);
    expect(sb.scriptedStrikeSeconds).toBe(25);
    expect(sb.flash).toEqual({ bright: 4, dim: 3, bright2: 3, fadeSeconds: 0.4 });
    expect(sb.flashesPerSecond).toBe(2);
    expect(sb.flashDayShare).toBe(0.7);
    expect(sb.reduced).toEqual({ up: 0.3, down: 0.6, strength: 0.5 });
    expect(sb.thunderAfter).toEqual([0.6, 3]);
    expect(sb.thunderRoll).toEqual([2.5, 4]);
    expect(sb.fogSpeeds).toEqual([0.3, 0.6]);
    expect(sb.fogCover).toEqual([0.2, 0.45]);
    expect(sb.lightVaries).toEqual({ share: 0.12, patchTiles: 8, driftTiles: 1.5 });
    expect(sb.lanternTiles).toBe(3);
    expect([sb.swayY, sb.swayX, sb.pitchPx, sb.pitchSeconds]).toEqual([3, 2, 4, 3.2]);
    expect([sb.rollFrames, sb.rollSeconds, sb.mastSwayPx]).toEqual([3, 5.4, 2]);
    expect([sb.swellApart, sb.swellSpeed]).toEqual([[3, 4], 1.2]);
    expect([sb.breakEvery, sb.sprayCount, sb.sprayHeight]).toEqual([
      [3, 6],
      [10, 18],
      [20, 40],
    ]);
    expect(sb.greenWaterEvery).toEqual([8, 12]);
    expect([sb.rainDrops, sb.rainSlantDegrees]).toEqual([[80, 120], 25]);
    expect(sb.firstRain).toEqual({ fromDay: 1, from: 20 * 60, toDay: 2, to: 4 * 60 });
  });
});

describe('lightning and thunder (DF-16)', () => {
  it('strikes 6 to 14 s apart, one scripted about 25 s in, all before the hull strikes', () => {
    expect(list.filter((s) => s.scripted).map((s) => s.at)).toEqual([25]);
    for (let i = 1; i < list.length; i++) {
      const gap = (list[i]?.at ?? 0) - (list[i - 1]?.at ?? 0);
      expect(gap).toBeGreaterThanOrEqual(6);
      expect(gap).toBeLessThanOrEqual(14);
    }
    expect(list.every((s) => s.at < STRIKE)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('thunders 0.6 to 3 s after each flash, sooner when near, rolling 2.5 to 4 s', () => {
    for (const s of list) {
      const delay = s.thunderAt - s.at;
      expect(delay).toBeGreaterThanOrEqual(0.6);
      expect(delay).toBeLessThanOrEqual(3);
      expect(s.roll).toBeGreaterThanOrEqual(2.5);
      expect(s.roll).toBeLessThanOrEqual(4);
    }
    const near = [...list].sort((a, b) => a.distance - b.distance);
    const first = near[0];
    const last = near[near.length - 1];
    if (first !== undefined && last !== undefined)
      expect(first.thunderAt - first.at).toBeLessThanOrEqual(last.thunderAt - last.at);
  });

  it('flickers bright 4 ticks, dim 3, bright 3, then fades over 0.4 s', () => {
    const at = (tick: number): number => flashProfile(tick / 60 + 1e-6, sb, false);
    expect([0, 1, 2, 3].map(at)).toEqual([1, 1, 1, 1]);
    expect([4, 5, 6].map(at).every((v) => v > 0 && v < 1)).toBe(true);
    expect([7, 8, 9].map(at)).toEqual([1, 1, 1]);
    expect(flashProfile(10 / 60 + 0.2, sb, false)).toBeCloseTo(0.5, 1);
    expect(flashProfile(10 / 60 + 0.41, sb, false)).toBe(0);
  });

  it('never flashes more than twice in any one second, over the whole cold open', () => {
    const onsets: number[] = [];
    let last = 0;
    for (let tick = 0; tick < STRIKE * 60; tick++) {
      const v = flashAt(tick / 60, list, sb, false);
      if (v >= 0.99 && last < 0.99) onsets.push(tick / 60);
      last = v;
    }
    expect(onsets.length).toBe(list.length * 2);
    for (const t of onsets)
      expect(onsets.filter((u) => u >= t && u < t + 1).length).toBeLessThanOrEqual(2);
  });

  it('with reduced flashes, one soft swell at half strength and no flicker', () => {
    let peak = 0;
    let rises = 0;
    let last = 0;
    for (let tick = 0; tick < STRIKE * 60; tick++) {
      const v = flashAt(tick / 60, list, sb, true);
      peak = Math.max(peak, v);
      if (v > last && last === 0) rises++;
      last = v;
    }
    expect(peak).toBeCloseTo(0.5, 2);
    expect(rises).toBe(list.length);
  });
});

describe('the camera, the pitch and the roll (DF-17)', () => {
  it('sways 3 px up and down and 2 px sideways in whole pixels, none with reduced motion', () => {
    let maxX = 0;
    let maxY = 0;
    for (let t = 0; t < 30; t += 1 / 60) {
      const s = swayAt(t, sb, false);
      expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
      maxX = Math.max(maxX, Math.abs(s.x));
      maxY = Math.max(maxY, Math.abs(s.y));
      expect(swayAt(t, sb, true)).toEqual({ x: 0, y: 0 });
    }
    expect([maxX, maxY]).toEqual([2, 3]);
  });

  it('pitches the bow up and down 4 px over 3.2 s, the strips stepping between', () => {
    let max = 0;
    for (let t = 0; t < 10; t += 1 / 60) max = Math.max(max, Math.abs(pitchAt(t, sb)));
    expect(max).toBeCloseTo(4, 1);
    expect(pitchAt(0.8, sb)).toBeCloseTo(4, 3);
    expect(pitchAt(2.4, sb)).toBeCloseTo(-4, 3);
    expect(stripLift(0, 4)).toBe(-4);
    expect(stripLift(STORM_HULL.strips - 1, 4)).toBe(4);
    for (let i = 1; i < STORM_HULL.strips; i++)
      expect(Math.abs(stripLift(i, 4) - stripLift(i - 1, 4))).toBeLessThanOrEqual(1);
  });

  it('rolls through its three frames over 5.4 s', () => {
    const seen = new Map<string, number>();
    for (let t = 0; t < 5.4; t += 1 / 60) {
      const r = rollAt(t, sb);
      seen.set(r, (seen.get(r) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(['level', 'port', 'starboard']);
    expect(rollAt(1.35, sb)).toBe('starboard');
    expect(rollAt(4.05, sb)).toBe('port');
    expect(rollAt(0, sb)).toBe('level');
  });
});

describe('the sea and the weather (DF-17)', () => {
  it('breaks a wave on the hull every 3 to 6 s in 10 to 18 spray particles 20 to 40 px up', () => {
    const ws = waves(sb, STRIKE);
    for (let i = 1; i < ws.length; i++) {
      const gap = (ws[i]?.at ?? 0) - (ws[i - 1]?.at ?? 0);
      expect(gap).toBeGreaterThanOrEqual(3);
      expect(gap).toBeLessThanOrEqual(6);
    }
    for (const w of ws) {
      expect(w.count).toBeGreaterThanOrEqual(10);
      expect(w.count).toBeLessThanOrEqual(18);
      let top = 0;
      let most = 0;
      for (let dt = 0; dt < 1.6; dt += 1 / 60) {
        const ps = sprayOf(w, dt);
        most = Math.max(most, ps.length);
        for (const p of ps) top = Math.max(top, p.z);
      }
      expect(most).toBe(w.count);
      expect(top).toBeLessThanOrEqual(40);
      expect(top).toBeGreaterThanOrEqual(w.height * 0.55 - 1);
    }
  });

  it('brings green water over the side every 8 to 12 s', () => {
    const g = greenWater(sb, STRIKE);
    expect(g.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < g.length; i++) {
      expect((g[i] ?? 0) - (g[i - 1] ?? 0)).toBeGreaterThanOrEqual(8);
      expect((g[i] ?? 0) - (g[i - 1] ?? 0)).toBeLessThanOrEqual(12);
    }
  });

  it('rains 80 to 120 drops', () => {
    for (let t = 0; t < 30; t += 0.25) {
      expect(rainCount(t, sb)).toBeGreaterThanOrEqual(80);
      expect(rainCount(t, sb)).toBeLessThanOrEqual(120);
    }
  });

  it('rolls two layers of mist covering 20 to 45% of the view, never over the steerer or the oar', () => {
    const mist = sheets.get('fx_storm_mist');
    if (mist === undefined) throw new Error('no fx_storm_mist');
    const clear = { x: 376, y: 130, w: 64, h: 84 };
    for (const t of [0, 4.5, 11, 19.5, 27]) {
      const banks = mistBanks(t, sb, { x: 600 + t * 20, y: 1100 }, 24, clear, false);
      const cover = new Uint8Array(640 * 360);
      for (const m of banks) {
        const img = mist.frames.get(`${m.layer}/-/${m.frame}`);
        if (img === undefined) throw new Error('no frame');
        const ox = Math.round(m.x) - mist.pivot.x;
        const oy = Math.round(m.y) - mist.pivot.y;
        for (let y = 0; y < img.height; y++)
          for (let x = 0; x < img.width; x++) {
            if (img.pixels[y * img.width + x] === NO_PIXEL) continue;
            const sx = ox + x;
            const sy = oy + y;
            if (sx < 0 || sy < 0 || sx >= 640 || sy >= 360) continue;
            expect(
              sx >= clear.x && sx < clear.x + clear.w && sy >= clear.y && sy < clear.y + clear.h,
            ).toBe(false);
            cover[sy * 640 + sx] = 1;
          }
      }
      // Cover is the share of the view the mist's dithered banks lie over (their drawn pixels,
      // each standing for its 2 x 2 dither cell).
      let n = 0;
      for (let y = 0; y < 360; y += 2)
        for (let x = 0; x < 640; x += 2)
          if (
            cover[y * 640 + x] ||
            cover[y * 640 + x + 1] ||
            cover[(y + 1) * 640 + x] ||
            cover[(y + 1) * 640 + x + 1]
          )
            n++;
      const share = n / (320 * 180);
      console.log(`mist cover at ${t} s: ${(share * 100).toFixed(1)}%`);
      expect(share, `t ${t}`).toBeGreaterThanOrEqual(sb.fogCover[0]);
      expect(share, `t ${t}`).toBeLessThanOrEqual(sb.fogCover[1]);
    }
  });

  it('draws the ship in strips, its people and lantern with it, and the bolt only in a bright frame', () => {
    const d = drawStorm({
      t: 25.01,
      b: sb,
      reduced: false,
      bx: 320,
      by: 200,
      camera: { x: 600, y: 1100 },
      tile: 24,
      isSea: () => true,
      bodyModel: 'A',
      strikeSeconds: STRIKE,
      list,
      waveList: waves(sb, STRIKE),
      greenList: greenWater(sb, STRIKE),
    });
    expect(d.flash).toBe(1);
    expect(d.ship.filter((s) => s.sheet === 'ship_t1_storm')).toHaveLength(STORM_HULL.strips);
    expect(d.over.some((s) => s.frame.startsWith('bolt/'))).toBe(true);
    expect(d.shadows.length).toBeGreaterThan(0);
    expect(d.pools[0]?.radius).toBe(sb.lanternTiles * 24);
    for (const s of [...d.under, ...d.ship, ...d.over])
      expect(sheets.has(s.sheet), s.sheet).toBe(true);
  });

  it('the storm hull strips match their sheet (storm25_art.py)', () => {
    const hull = sheets.get('ship_t1_storm');
    expect(hull?.width).toBe(STORM_HULL.strip);
    expect(hull?.pivot.x).toBe(0);
    expect(hull?.frames.size).toBe(3 * STORM_HULL.strips * 4);
    const launch = sheets.get('ship_t1_launch');
    expect(launch?.pivot).toEqual({ x: STORM_HULL.pivotX, y: STORM_HULL.pivotY });
  });

  it('rains on the island from 20:00 on day 1 to 04:00 on day 2, once the sail is raised', () => {
    expect(firstRainDrops(1, 19 * 60 + 59, true, sb, 0)).toBe(0);
    expect(firstRainDrops(1, 20 * 60, false, sb, 0)).toBe(0);
    const d = firstRainDrops(1, 21 * 60, true, sb, 0);
    expect(d).toBeGreaterThanOrEqual(40);
    expect(d).toBeLessThanOrEqual(60);
    expect(firstRainDrops(2, 3 * 60, true, sb, 5)).toBeGreaterThan(0);
    expect(firstRainDrops(2, 4 * 60, true, sb, 0)).toBe(0);
    expect(firstRainDrops(3, 21 * 60, true, sb, 0)).toBe(0);
  });
});

describe("the Hag's Stone's own reserved accent (DF-21, item 11)", () => {
  it("glows in the Cailleach's cold light, which no ordinary sheet uses", () => {
    const hag = sheets.get('fx_hag');
    expect(hag?.reserved).toContain('&');
    const users = [...sheets.values()].filter((s) => s.reserved.includes('&')).map((s) => s.name);
    expect(users).toEqual(['fx_hag']);
  });
});

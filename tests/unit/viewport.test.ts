import { describe, expect, it } from 'vitest';
import { computeViewport, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../src/render/viewport.ts';

describe('integer scaling and letterbox (Book 7 section 01)', () => {
  it('uses the 640 x 360 logical frame', () => {
    expect([LOGICAL_WIDTH, LOGICAL_HEIGHT]).toEqual([640, 360]);
  });

  it.each([
    // [surface w, h, scale, x, y]
    [640, 360, 1, 0, 0],
    [1280, 720, 2, 0, 0],
    [1920, 1080, 3, 0, 0],
    [2560, 1440, 4, 0, 0],
    [3840, 2160, 6, 0, 0],
    [1366, 768, 2, 43, 24],
    [1500, 900, 2, 110, 90],
    [1440, 900, 2, 80, 90],
    [2880, 1800, 4, 160, 180],
    [1920, 1200, 3, 0, 60],
    [900, 500, 1, 130, 70],
  ])('%i x %i uses scale %i at (%i, %i)', (w, h, scale, x, y) => {
    expect(computeViewport(w, h)).toEqual({ scale, x, y, width: 640 * scale, height: 360 * scale });
  });

  it('never stretches: the scale is always the largest whole number that fits', () => {
    for (let w = 640; w <= 4000; w += 37) {
      for (let h = 360; h <= 2400; h += 29) {
        const vp = computeViewport(w, h);
        expect(Number.isInteger(vp.scale)).toBe(true);
        expect(vp.width).toBeLessThanOrEqual(w);
        expect(vp.height).toBeLessThanOrEqual(h);
        // One step larger would not fit.
        expect(640 * (vp.scale + 1) > w || 360 * (vp.scale + 1) > h).toBe(true);
        // Centred: the two bars differ by at most one device pixel.
        expect(Math.abs(w - vp.width - 2 * vp.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(h - vp.height - 2 * vp.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps scale 1 and crops evenly below 640 x 360 rather than shrinking', () => {
    expect(computeViewport(600, 300)).toEqual({
      scale: 1,
      x: -20,
      y: -30,
      width: 640,
      height: 360,
    });
  });
});

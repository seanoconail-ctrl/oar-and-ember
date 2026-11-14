import { describe, expect, it } from 'vitest';
import { deviceSize } from '../../src/scenes/boot.ts';

describe('measuring the canvas in device pixels', () => {
  it('multiplies CSS size by the pixel ratio', () => {
    expect(deviceSize(1000, 600, 2)).toEqual({ width: 2000, height: 1200 });
    expect(deviceSize(1366, 768, 1.25)).toEqual({ width: 1708, height: 960 });
  });

  it("uses the browser's exact device size when it agrees to within a pixel", () => {
    expect(deviceSize(853.33, 480, 1.5, { inlineSize: 1279, blockSize: 720 })).toEqual({
      width: 1279,
      height: 720,
    });
  });

  it('ignores an "exact" size that is really CSS pixels (emulated or headless browsers)', () => {
    expect(deviceSize(1000, 600, 2, { inlineSize: 1000, blockSize: 600 })).toEqual({
      width: 2000,
      height: 1200,
    });
  });
});

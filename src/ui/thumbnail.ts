/**
 * A save slot's screenshot (Book 2 section 20; Book 10 section 21, "Menus and saves": thumbnail,
 * thumbnailBytes; decision DG-16): the last frame drawn before the menu opened, at a quarter of
 * the logical view, each pixel the mean of its block, as a PNG in base64 of at most
 * `thumbnailBytes`, re-encoded with fewer colours while it is larger. Pure: the PNG encoder is
 * given (the browser's canvas, or the tools' encoder in Node).
 */

export interface Rgba {
  readonly width: number;
  readonly height: number;
  /** RGBA bytes, row 0 at the top. */
  readonly data: Uint8Array | Uint8ClampedArray;
}

/** Each output pixel the mean of its `block` x `block` square (alpha forced opaque). */
export function downsample(frame: Rgba, block: number): Rgba {
  const w = Math.floor(frame.width / block);
  const h = Math.floor(frame.height / block);
  const out = new Uint8Array(w * h * 4);
  const n = block * block;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < block; j++)
        for (let i = 0; i < block; i++) {
          const k = ((y * block + j) * frame.width + x * block + i) * 4;
          r += frame.data[k] ?? 0;
          g += frame.data[k + 1] ?? 0;
          b += frame.data[k + 2] ?? 0;
        }
      const o = (y * w + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  return { width: w, height: h, data: out };
}

/** Each channel rounded to a multiple of `step` (fewer colours, a smaller PNG). */
export function posterize(image: Rgba, step: number): Rgba {
  if (step <= 1) return image;
  const out = new Uint8Array(image.data.length);
  for (let i = 0; i < image.data.length; i++) {
    const v = image.data[i] ?? 0;
    out[i] = (i & 3) === 3 ? v : Math.min(255, Math.round(v / step) * step);
  }
  return { width: image.width, height: image.height, data: out };
}

/** The colour steps tried, from none to coarse, until the PNG fits. */
export const THUMBNAIL_STEPS: readonly number[] = [1, 4, 8, 16, 24, 32, 48, 64];

export interface ThumbnailPng {
  readonly w: number;
  readonly h: number;
  readonly format: 'png';
  readonly data: string;
}

/**
 * The thumbnail of a logical frame: downsampled by `block`, encoded, and posterized step by step
 * until its base64 is at most `maxBytes`. Null if even the coarsest does not fit.
 */
export function makeThumbnail(
  frame: Rgba,
  size: { readonly w: number; readonly h: number; readonly block: number },
  maxBytes: number,
  encodeBase64: (image: Rgba) => string,
): ThumbnailPng | null {
  const small = downsample(frame, size.block);
  if (small.width !== size.w || small.height !== size.h)
    throw new Error(
      `thumbnail: a ${frame.width} x ${frame.height} frame is not ${size.w * size.block} x ${size.h * size.block}`,
    );
  for (const step of THUMBNAIL_STEPS) {
    const data = encodeBase64(posterize(small, step));
    if (data.length <= maxBytes) return { w: small.width, h: small.height, format: 'png', data };
  }
  return null;
}

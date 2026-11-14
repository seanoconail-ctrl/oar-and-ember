"""Concept renderer for the art-direction mockups (not the game pipeline).

It paints with the proposed palette only, at 1 logical pixel per pixel, then applies the same
kinds of pass the WebGL renderer will: soft cast shadows and ambient occlusion, cloud shadows,
light pools and a colour grade. Every animation is periodic in the loop length, so the GIFs loop
without a seam.
"""
import math
import numpy as np
from palette import RAMPS, hex_rgb

LOOP = 6.4          # seconds in one loop
FPS = 12.5          # frames per second in the GIF (80 ms per frame)
FRAMES = int(LOOP * FPS)

_RGB = {k: np.array([hex_rgb(c) for c in v], dtype=np.float32) for k, v in RAMPS.items()}


def C(name, i):
    """A palette colour as float RGB 0..255; the index is clamped to the ramp."""
    r = _RGB[name]
    return r[int(max(0, min(len(r) - 1, i)))]


def ramp_len(name):
    return len(_RGB[name])


def ramp_lookup(name, idx):
    """Vectorised: an array of ramp indices to RGB."""
    r = _RGB[name]
    return r[np.clip(np.rint(idx).astype(int), 0, len(r) - 1)]


# ------------------------------------------------------------------ noise
def _smooth(t):
    return t * t * (3 - 2 * t)


def value_noise(h, w, cell, seed, period_x=None, period_y=None):
    """Smooth value noise in 0..1 on a grid of `cell` pixels, tileable when periods are given."""
    rng = np.random.default_rng(seed)
    gh = int(math.ceil(h / cell)) + 2
    gw = int(math.ceil(w / cell)) + 2
    px = period_x // cell if period_x else None
    py = period_y // cell if period_y else None
    grid = rng.random((py or gh, px or gw)).astype(np.float32)
    ys = np.arange(h, dtype=np.float32) / cell
    xs = np.arange(w, dtype=np.float32) / cell
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = _smooth(ys - y0)[:, None]
    fx = _smooth(xs - x0)[None, :]
    gy0 = y0 % grid.shape[0]
    gy1 = (y0 + 1) % grid.shape[0]
    gx0 = x0 % grid.shape[1]
    gx1 = (x0 + 1) % grid.shape[1]
    a = grid[gy0][:, gx0]
    b = grid[gy0][:, gx1]
    c = grid[gy1][:, gx0]
    d = grid[gy1][:, gx1]
    top = a + (b - a) * fx
    bot = c + (d - c) * fx
    return top + (bot - top) * fy


def fbm(h, w, cell, seed, octaves=3, period_x=None, period_y=None):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        c = max(2, cell // (2 ** o))
        pxo = period_x if period_x is None else period_x
        out += amp * value_noise(h, w, c, seed + o * 97, pxo, period_y)
        tot += amp
        amp *= 0.5
    return out / tot


def hash01(*vals):
    """A deterministic pseudo-random number in 0..1 from integers."""
    h = 2166136261
    for v in vals:
        h = ((h ^ (int(v) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 1274126177) & 0xFFFFFFFF
    return (h & 0xFFFFFF) / 0x1000000


def rng(seed):
    return np.random.default_rng(seed)


# ------------------------------------------------------------------ sprites
class Sprite:
    """An RGB image with a mask, anchored at (ax, ay) (its foot)."""

    def __init__(self, w, h, ax=None, ay=None):
        self.rgb = np.zeros((h, w, 3), np.float32)
        self.mask = np.zeros((h, w), bool)
        self.ax = w // 2 if ax is None else ax
        self.ay = h - 1 if ay is None else ay

    @property
    def w(self):
        return self.rgb.shape[1]

    @property
    def h(self):
        return self.rgb.shape[0]

    def px(self, x, y, col):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.rgb[y, x] = col
            self.mask[y, x] = True

    def outline(self, col=None):
        """A one-pixel ink outline round the drawn pixels (Book 7 section 11)."""
        col = C('ink', 0) if col is None else col
        m = self.mask
        grow = np.zeros_like(m)
        grow[1:, :] |= m[:-1, :]
        grow[:-1, :] |= m[1:, :]
        grow[:, 1:] |= m[:, :-1]
        grow[:, :-1] |= m[:, 1:]
        edge = grow & ~m
        self.rgb[edge] = col
        self.mask |= edge
        return self

    def padded(self, n=1):
        s = Sprite(self.w + 2 * n, self.h + 2 * n, self.ax + n, self.ay + n)
        s.rgb[n:n + self.h, n:n + self.w] = self.rgb
        s.mask[n:n + self.h, n:n + self.w] = self.mask
        return s


def stamp(frame, spr, x, y, tint=None):
    """Draws `spr` with its anchor at (x, y), clipped to the frame."""
    x0 = int(round(x)) - spr.ax
    y0 = int(round(y)) - spr.ay
    H, W = frame.shape[:2]
    sx0, sy0 = max(0, -x0), max(0, -y0)
    ex = min(spr.w, W - x0)
    ey = min(spr.h, H - y0)
    if ex <= sx0 or ey <= sy0:
        return
    m = spr.mask[sy0:ey, sx0:ex]
    region = frame[y0 + sy0:y0 + ey, x0 + sx0:x0 + ex]
    src = spr.rgb[sy0:ey, sx0:ex]
    if tint is not None:
        src = src * tint
    region[m] = src[m]


def stamp_mask(buf, spr, x, y, value=1.0):
    """Writes `value` into a float buffer where the sprite is drawn (for shadows and occlusion)."""
    x0 = int(round(x)) - spr.ax
    y0 = int(round(y)) - spr.ay
    H, W = buf.shape[:2]
    sx0, sy0 = max(0, -x0), max(0, -y0)
    ex = min(spr.w, W - x0)
    ey = min(spr.h, H - y0)
    if ex <= sx0 or ey <= sy0:
        return
    m = spr.mask[sy0:ey, sx0:ex]
    region = buf[y0 + sy0:y0 + ey, x0 + sx0:x0 + ex]
    region[m] = np.maximum(region[m], value)


def blob(spr, cx, cy, rx, ry, ramp_name, base, light=(-0.6, -0.8), levels=None):
    """A shaded ellipse lit from `light` (upper left), stepping through a ramp."""
    lx, ly = light
    n = math.hypot(lx, ly)
    lx, ly = lx / n, ly / n
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1:
                continue
            nz = math.sqrt(max(0.0, 1 - d))
            shade = (-dx * lx - dy * ly) * 0.9 + nz * 0.6
            step = base + round(shade * (levels or 2.4) - 0.6)
            spr.px(x, y, C(ramp_name, step))


# ------------------------------------------------------------------ light
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16


def bayer(h, w):
    return np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]


def banded(field, bands):
    """Quantises a 0..1 field into `bands` steps with an ordered-dither edge between steps."""
    h, w = field.shape
    return np.floor(field * bands + bayer(h, w) * 0.999) / bands


def blur(a, r):
    """A box blur of radius r (separable), for soft shadows."""
    if r <= 0:
        return a
    k = 2 * r + 1
    out = a.copy()
    for axis in (0, 1):
        c = np.cumsum(np.pad(out, [(r + 1, r) if i == axis else (0, 0) for i in range(out.ndim)],
                             mode='edge'), axis=axis)
        sl_hi = [slice(None)] * out.ndim
        sl_lo = [slice(None)] * out.ndim
        sl_hi[axis] = slice(k, None)
        sl_lo[axis] = slice(0, -k)
        out = (c[tuple(sl_hi)] - c[tuple(sl_lo)]) / k
    return out


def shift(a, dx, dy):
    """Shifts a 2-D array by whole pixels, filling with zeros."""
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    dx, dy = int(dx), int(dy)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    out[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx] = a[ys0:ys1, xs0:xs1]
    return out


def to_u8(frame):
    return np.clip(np.rint(frame), 0, 255).astype(np.uint8)


def stone(spr, cx, cy, rx, ry, ramp_name, base, seed, light=(-0.6, -0.8)):
    """An irregular, faceted stone: a lumpy outline and flat planes stepping through a ramp."""
    lx, ly = light
    n = math.hypot(lx, ly)
    lx, ly = lx / n, ly / n
    bumps = [hash01(seed, k) for k in range(7)]
    def radius(a):
        v = 1.0
        for k, b in enumerate(bumps[:4]):
            v += 0.11 * math.sin(a * (k + 2) + b * 6.28)
        return v
    for y in range(int(cy - ry * 1.4) - 1, int(cy + ry * 1.4) + 2):
        for x in range(int(cx - rx * 1.4) - 1, int(cx + rx * 1.4) + 2):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            a = math.atan2(dy, dx)
            d = math.hypot(dx, dy) / radius(a)
            if d > 1:
                continue
            # Facets: the surface normal is snapped to a few directions, so planes read flat.
            facet = round((a + math.pi) / (math.pi / 3)) * (math.pi / 3) - math.pi
            fx_, fy_ = math.cos(facet) * d, math.sin(facet) * d
            nz = math.sqrt(max(0.0, 1 - d * d))
            shade = (-fx_ * lx - fy_ * ly) * 1.0 + nz * 0.5
            if d < 0.45:
                shade = 0.65            # the flat crown
            step = base + round(shade * 3.6 - 0.9)
            if d > 0.9:
                step = min(step, base - 2)          # a dark joint where stones meet
            spr.px(x, y, C(ramp_name, step))

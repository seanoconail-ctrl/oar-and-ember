"""Animated pieces shared by the mockups: plants in the wind, birds, fire and smoke, particles,
cloud shadows, light pools and the colour grade. Everything is a function of time `t` that repeats
every LOOP seconds (or runs on, for the walking capture).
"""
import math
import numpy as np
from core import C, LOOP, Sprite, banded, bayer, blur, fbm, hash01, shift, stamp

TAU = 2 * math.pi


def loopsin(t, cycles, phase=0.0):
    """A sine that completes a whole number of cycles per loop, so the loop has no seam."""
    return math.sin(TAU * (t / LOOP * cycles) + phase)


# ------------------------------------------------------------ plants
def draw_tuft(frame, kind, x, y, height, phase, t, gust, walkers=()):
    """A clump of grass, marram or flowers, swaying in the gust and parting round walkers."""
    H, W = frame.shape[:2]
    lean = gust * (3.2 if kind == 'marram' else 2.2) + 0.7 * loopsin(t, 3, phase * TAU) * (0.5 + gust)
    squash = 1.0
    for (wx, wy) in walkers:
        dx, dy = x - wx, (y - wy) * 1.6
        d = math.hypot(dx, dy)
        if d < 11:
            push = (11 - d) / 11
            lean += math.copysign(push * 4.5, dx if abs(dx) > 0.5 else 1)
            squash = min(squash, 1 - push * 0.55)
    if kind == 'thrift':
        # A cushion of leaves with pink heads on stalks that bob.
        for dx in (-1, 0, 1):
            _px(frame, x + dx, y, C('moss', 2))
        _px(frame, x, y - 1, C('moss', 3))
        for k, off in enumerate((-2, 0, 2)):
            hx = x + off + lean * 0.6 + 0.6 * loopsin(t, 4, phase * TAU + k)
            hy = y - 3 - k % 2
            _px(frame, hx, hy + 1, C('moss', 4))
            _px(frame, hx, hy, C('thrift', 3 + (k == 1)))
            _px(frame, hx + 1, hy, C('thrift', 2))
        return
    if kind in ('clover', 'trefoil', 'redclover', 'violet', 'iris'):
        ramp = {'clover': 'clover_white', 'trefoil': 'trefoil', 'redclover': 'redclover',
                'violet': 'violet', 'iris': 'iris'}[kind]
        n = len_ramp(ramp)
        tall = kind == 'iris'
        stem = (height if tall else min(3, height * 0.5)) * squash
        bx = x + lean * (0.6 if tall else 0.35) + 0.5 * loopsin(t, 5, phase * TAU)
        top = y - stem
        # Leaves at the foot, a short stem, and a head of two to four pixels that bobs.
        _px(frame, x - 1, y, C('grass', 4))
        _px(frame, x + 1, y, C('grass', 5))
        for k in range(int(stem)):
            f = k / max(1, stem)
            _px(frame, x + (bx - x) * f, y - k, C('grass', 5 + f * 2))
        _px(frame, bx, top, C(ramp, n - 2))
        _px(frame, bx + 1, top, C(ramp, n - 3))
        _px(frame, bx, top - 1, C(ramp, n - 1))
        if hash01(int(x), int(y), 11) < 0.5:
            _px(frame, bx - 1, top, C(ramp, n - 3))
        if tall:
            _px(frame, bx - 1, top + 1, C(ramp, 1))
            for k in range(4):
                _px(frame, x - 2 + (lean * 0.3) * k / 4, y - k * 2, C('fern', 3 + k * 0.4))
        return
    ramp = 'marram' if kind == 'marram' else ('fern' if kind == 'reed' else 'grass')
    blades = 6 if kind == 'marram' else 4
    _px(frame, x, y + 1, C('grass', 1) if ramp == 'grass' else C('sand', 1))
    for b in range(blades):
        off = (b - (blades - 1) / 2) * (1.0 if kind == 'marram' else 0.9)
        h = height * squash * (0.7 + 0.3 * hash01(int(x), int(y), b))
        wob = 0.5 * loopsin(t, 4, phase * TAU + b * 1.7)
        bend = lean + wob + off * 0.4
        steps = int(max(2, h))
        for k in range(steps):
            f = k / steps
            px = x + off + bend * f * f
            py = y - k
            n = len_ramp(ramp)
            idx = (1.5 + f * (n - 2.5)) if ramp != 'grass' else (2.5 + f * 8.0)
            _px(frame, px, py, C(ramp, idx))


def _px(frame, x, y, col):
    xi, yi = int(round(x)), int(round(y))
    if 0 <= yi < frame.shape[0] and 0 <= xi < frame.shape[1]:
        frame[yi, xi] = col


def len_ramp(name):
    from palette import RAMPS
    return len(RAMPS[name])


# ------------------------------------------------------------ birds and beasts
def gull_sprite(flap):
    """A gull from above-and-side: white body, grey back, black wing tips; 4 wing frames."""
    s = Sprite(15, 9, 7, 4)
    body = [(5, 4), (6, 4), (7, 4), (8, 4), (9, 4), (6, 3), (7, 3), (8, 3), (10, 4)]
    for (x, y) in body:
        s.px(x, y, C('gull', 4))
    s.px(9, 3, C('gull', 5))
    s.px(11, 4, C('beak', 2))
    wing_y = [1, 3, 5, 3][flap % 4]
    for k in range(5):
        yy = 4 + (wing_y - 4) * (k / 4)
        s.px(6 - k, int(round(yy)), C('gull', 3 if k < 3 else 0))
        s.px(7 + k // 2, int(round(yy)), C('gull', 2))
    return s.outline(C('ink', 1))


def draw_gull(frame, shadow_buf, x, y, alt, t, flap_rate=6, shadow_off=(26, 30)):
    flap = int((t * flap_rate) % 4)
    spr = gull_sprite(flap)
    # Its shadow on the ground, far below and offset by the low sun.
    sx, sy = x + shadow_off[0] * alt, y + shadow_off[1] * alt
    for dx in range(-4, 5):
        for dy in (0, 1):
            xi, yi = int(sx + dx), int(sy + dy)
            if 0 <= yi < shadow_buf.shape[0] and 0 <= xi < shadow_buf.shape[1]:
                shadow_buf[yi, xi] = max(shadow_buf[yi, xi], 0.35)
    stamp(frame, spr, x, y)


def standing_gull(head_turn):
    s = Sprite(9, 9, 4, 8)
    for (x, y) in [(3, 4), (4, 4), (5, 4), (2, 5), (3, 5), (4, 5), (5, 5), (6, 5), (3, 6), (4, 6), (5, 6)]:
        s.px(x, y, C('gull', 4))
    for (x, y) in [(5, 4), (6, 5), (6, 6)]:
        s.px(x, y, C('gull', 2))
    hx = 2 if head_turn else 4
    s.px(hx, 3, C('gull', 5))
    s.px(hx - 1 if head_turn else hx + 1, 3, C('beak', 2))
    s.px(3, 7, C('beak', 1))
    s.px(5, 7, C('beak', 1))
    return s.outline(C('ink', 1))


def cormorant(wing):
    """A cormorant on a rock, wings held out to dry, stirring now and then."""
    s = Sprite(17, 14, 8, 13)
    for y in range(4, 12):
        s.px(8, y, C('seal', 1))
        s.px(9, y, C('seal', 2))
    s.px(9, 3, C('seal', 2))
    s.px(10, 3, C('seal', 3))
    s.px(11, 3, C('beak', 0))
    for k in range(7):
        ly = 6 - (k // 2) * (1 if wing else 0) + (0 if wing else k // 3)
        s.px(7 - k, ly, C('seal', 1 + (k % 2)))
        s.px(10 + k, ly, C('seal', 1 + (k % 2)))
        s.px(7 - k, ly + 1, C('seal', 0))
        s.px(10 + k, ly + 1, C('seal', 0))
    s.px(8, 12, C('beak', 0))
    s.px(9, 12, C('beak', 0))
    return s.outline()


def seal(head_up):
    s = Sprite(24, 10, 12, 9)
    for x in range(3, 20):
        t = (x - 3) / 17
        thick = 3.2 * math.sin(math.pi * min(1, t * 1.1)) ** 0.5
        for y in range(int(6 - thick), int(6 + thick * 0.6) + 1):
            shade = 4 - (y - (6 - thick)) * 0.8
            s.px(x, y, C('seal', shade))
    if head_up:
        for y in range(1, 5):
            s.px(19, y, C('seal', 4))
            s.px(20, y, C('seal', 3))
        s.px(21, 2, C('seal', 2))
    else:
        s.px(20, 5, C('seal', 4))
        s.px(21, 5, C('seal', 3))
    s.px(3, 7, C('seal', 1))
    s.px(2, 8, C('seal', 1))
    return s.outline()


def crab(step):
    s = Sprite(9, 5, 4, 4)
    for x in range(2, 7):
        s.px(x, 2, C('crab', 2))
        s.px(x, 3, C('crab', 1))
    s.px(3, 1, C('crab', 3))
    s.px(5, 1, C('crab', 3))
    for k, x in enumerate((1, 2, 6, 7)):
        s.px(x, 3 + (step + k) % 2, C('crab', 0))
    return s.outline()


def sheep(t, phase, facing_right=True):
    """A grazing sheep: the head dips and lifts; the fleece is lit from the upper left."""
    s = Sprite(20, 15, 10, 14)
    for y in range(3, 11):
        for x in range(3, 16):
            dx, dy = (x - 9.5) / 6.5, (y - 6.5) / 4.2
            if dx * dx + dy * dy <= 1:
                shade = 4 - dy * 1.5 - dx * 0.8 + (0.6 if hash01(x, y, 9) < 0.25 else 0)
                s.px(x, y, C('fleece', shade))
    graze = loopsin(t, 2, phase) > 0.2
    hx, hy = (16, 9 if graze else 6)
    for (x, y) in [(hx, hy), (hx + 1, hy), (hx, hy + 1), (hx + 1, hy + 1), (hx + 2, hy + 1)]:
        s.px(x, y, C('seal', 2))
    s.px(hx + 1, hy, C('ink', 0))
    for x in (5, 7, 12, 14):
        s.px(x, 11, C('seal', 1))
        s.px(x, 12, C('seal', 0))
    s = s.outline()
    if not facing_right:
        s.rgb = s.rgb[:, ::-1].copy()
        s.mask = s.mask[:, ::-1].copy()
    return s


def insect(frame, x, y, t, seed, kind='bee'):
    """A bee, hoverfly or butterfly wandering over flowers, or a midge."""
    a = TAU * (t / LOOP) * (2 + seed % 3) + seed
    px_ = x + 9 * math.sin(a) + 4 * math.sin(a * 2.3 + seed)
    py_ = y + 5 * math.sin(a * 1.4 + seed) - 3
    if kind == 'butterfly':
        open_ = int(t * 10 + seed) % 2
        col = C('wool', 6) if seed % 2 else C('trefoil', 4)
        _px(frame, px_, py_, C('ink', 1))
        _px(frame, px_ - 1, py_ - open_, col)
        _px(frame, px_ + 1, py_ - open_, col)
    else:
        _px(frame, px_, py_, C('trefoil', 3) if kind == 'bee' else C('ink', 1))
        if int(t * 25 + seed) % 2:
            _px(frame, px_, py_ - 1, C('sky', 5))


# ------------------------------------------------------------ fire, smoke and light
def draw_fire(frame, x, y, t):
    """Flames over charred driftwood, flickering; embers rise and drift downwind."""
    for k in range(-5, 6):
        _px(frame, x + k, y + 1, C('tar', 1 + (k % 2)))
        _px(frame, x + k * 0.7, y, C('driftwood', 1))
    for col in range(-4, 5):
        hgt = (6 - abs(col) * 1.1) * (0.65 + 0.35 * abs(math.sin(t * 9 + col * 1.7)) +
                                      0.25 * math.sin(t * 23 + col))
        lean = 0
        for k in range(int(max(1, hgt))):
            f = k / max(1, hgt)
            lean = f * f * 2.5
            _px(frame, x + col + lean, y - k, C('fire', 7 - f * 6.5 - (abs(col) > 2)))
    for e in range(5):
        age = (t * 0.9 + e / 5) % 1
        ex = x + age * 14 + math.sin(e * 3 + t * 4) * 2
        ey = y - 6 - age * 16
        if age < 0.8:
            _px(frame, ex, ey, C('fire', 6 if age < 0.4 else 4))


def draw_smoke(frame, x, y, t, wind=1.0):
    """Smoke rising from the fire and bent over by the wind, thinning as it goes."""
    H, W = frame.shape[:2]
    bay = bayer(H, W)
    for p in range(16):
        age = (t / LOOP * 4 + p / 16) % 1
        r = 2 + age * 9
        cx = x + 3 + age * 60 * wind + math.sin(p * 2.1 + t) * 2
        cy = y - 8 - age * 26 + age * age * 10
        density = 0.6 * (1 - age)
        col = C('smoke', 4 - age * 3)
        for yy in range(int(cy - r), int(cy + r) + 1):
            for xx in range(int(cx - r), int(cx + r) + 1):
                if 0 <= yy < H and 0 <= xx < W and (xx - cx) ** 2 + (yy - cy) ** 2 < r * r:
                    if bay[yy, xx] < density:
                        frame[yy, xx] = frame[yy, xx] * 0.45 + col * 0.55


def light_pool(h, w, cx, cy, radius, t, bands=4):
    """A flickering pool of firelight, in bands (Book 7: light pools), 0..1."""
    flick = 0.88 + 0.08 * math.sin(t * 11) + 0.05 * math.sin(t * 27 + 1)
    ys, xs = np.mgrid[0:h, 0:w]
    d = np.hypot(xs - cx, (ys - cy) * 1.25) / (radius * flick)
    f = np.clip(1 - d, 0, 1) ** 1.4
    return np.ceil(f * bands) / bands * (f > 0)


# ------------------------------------------------------------ weather particles
def draw_rain(frame, t, count, seed, strength=0.5):
    H, W = frame.shape[:2]
    r = np.random.default_rng(seed)
    x0 = r.uniform(0, W, count)
    y0 = r.uniform(0, H, count)
    speed = r.integers(1, 3, count)
    col = C('sky', 5)
    for i in range(count):
        # Each drop crosses the frame a whole number of times per loop (seamless).
        x = (x0[i] + W * speed[i] * t / LOOP * 0.5) % W
        y = (y0[i] + H * speed[i] * t / LOOP * 2) % H
        for k in range(4):
            xi, yi = int(x - k * 0.5), int(y - k * 2)
            if 0 <= yi < H and 0 <= xi < W:
                frame[yi, xi] = frame[yi, xi] * (1 - strength) + col * strength


def draw_blown_sand(frame, mask, t, count, seed):
    H, W = frame.shape[:2]
    r = np.random.default_rng(seed)
    x0 = r.uniform(0, W, count)
    y0 = r.uniform(0, H, count)
    for i in range(count):
        x = (x0[i] + W * 2 * t / LOOP) % W
        y = y0[i] + math.sin(x / 30 + i) * 2
        yi = int(y)
        if not (0 <= yi < H) or not mask[yi, int(x) % W]:
            continue
        for k in range(5):
            xi = int(x - k)
            if 0 <= xi < W:
                frame[yi, xi] = frame[yi, xi] * 0.7 + C('sand', 6) * 0.3


def draw_spray(frame, x, y, t, t0, seed, size=1.0):
    """A burst of spray where a wave breaks on rock, blown downwind and falling back."""
    age = ((t - t0) % (LOOP / 2)) / 1.4
    if age > 1:
        return
    r = np.random.default_rng(seed)
    for p in range(int(26 * size)):
        vx = r.uniform(-1, 2.6) * size
        vy = r.uniform(-4, -1.5) * size
        px_ = x + vx * age * 14 + age * age * 10
        py_ = y + vy * age * 12 + age * age * 26
        if r.random() < 1 - age:
            _px(frame, px_, py_, C('sea', 10 if p % 3 else 9))


# ------------------------------------------------------------ light and grade
def cloud_shadow(h, w, t, cam_x, cam_y, world_w, seed=101, speed_periods=1):
    """Cloud shadows sweeping east: tileable noise moved one period per loop, 0..1 (1 = shade).
    With MOCKUP_STILL_CLOUDS=1 they are frozen, to measure what moves without them."""
    import os
    if os.environ.get('MOCKUP_STILL_CLOUDS') == '1':
        t = 0.0
    period = world_w
    key = (h, w, world_w, seed)
    if key not in _CLOUD:
        _CLOUD[key] = fbm(h + 64, period, 80, seed, 3, period_x=period)
    n = _CLOUD[key]
    off = int(t / LOOP * period * speed_periods)
    xs = (np.arange(w) + cam_x - off) % period
    field = n[:h][:, xs]
    # A hard-edged shade with a one- or two-pixel dithered rim, not a field of dither.
    shade = np.clip((field - 0.52) * 14, 0, 1)
    return banded(shade, 2)


_CLOUD = {}


def grade(frame, cloud, warm_sun=0.0, cool=(0.8, 0.83, 0.93), lift=(9, 13, 22), desat=0.22):
    """The colour grade: cloud shade cools, the low sun warms what it touches, darks lift blue."""
    out = frame.copy()
    sun = (1 - cloud)[..., None]
    shade = cloud[..., None]
    out = out * (shade * np.array(cool) + sun * np.array([1 + 0.08 * warm_sun, 1.0, 1 - 0.07 * warm_sun]))
    grey = out.mean(axis=2, keepdims=True)
    out = out * (1 - desat) + grey * desat
    out = out * 0.94 + np.array(lift)
    return out

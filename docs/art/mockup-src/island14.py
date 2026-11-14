"""Shared pieces for the Stage 14 mockups (Book 7 section 14; decision S14-24): the moor, the
cliffs, the bog, the caves and the old stonework of Skarvholm's new scenes, painted with the
approved ramps (palette.py) and the same light passes as the strand, Kelda and Seal Cave mockups.

Everything is a function of time that repeats every LOOP seconds, so loops have no seam. The
painting functions for the props (the cell, the altar, the cross, the Grey Men, the eyrie, the
peat banks, the causeway's boulders, the cave's shoring and grave cells, the Door, the pushable
stone, the waterfall) are imported by the game's authoring script
(`assets/art/authoring/stage14_island_art.py`), so the built places are drawn from the same art.
"""
import json
import math
import os

import numpy as np
from PIL import Image

import fx
import people48
from core import (C, FPS, FRAMES, LOOP, Sprite, banded, blur, fbm, hash01, ramp_lookup, rng,
                  shift, stamp, stamp_mask, stone, to_u8, value_noise)

W, H = 640, 360
TAU = math.tau
OUT = os.path.join(os.path.dirname(__file__), '..', 'mockups', 'stage-14')
SUN = (0.8, -0.35)
SHADE = np.array([0.6, 0.65, 0.82], np.float32)
YS, XS = np.mgrid[0:H, 0:W].astype(np.float32)


def dist_to(mask, n=40):
    """Pixels from each point to the nearest point of `mask` (a dilation count, capped at n)."""
    d = np.where(mask, 0, n).astype(np.float32)
    cur = mask.copy()
    for k in range(1, n):
        grow = cur.copy()
        grow[1:, :] |= cur[:-1, :]
        grow[:-1, :] |= cur[1:, :]
        grow[:, 1:] |= cur[:, :-1]
        grow[:, :-1] |= cur[:, 1:]
        new = grow & ~cur
        d[new] = k
        cur = grow
        if not new.any():
            break
    return d


def ph(t, cycles=1.0, phase=0.0):
    return TAU * (t / LOOP * cycles) + phase


# ------------------------------------------------------------------ ground
def ground_heather(g, m, tone, detail, bloom=0.6):
    """Heather moor seen from above: a dark peaty floor between cushions of heather, olive and
    brown, the flowering tips purple in clusters (late summer), calm patches of grass."""
    base = 2.2 + (tone - 0.5) * 1.6 + (detail - 0.5) * 0.8
    g[m] = ramp_lookup('weld', base[m])
    cush = m & (detail > 0.48)
    g[cush] = ramp_lookup('weld', 3.0 + (tone[cush] - 0.5) * 1.4)
    brown = m & (fbm(H, W, 14, 61) > 0.62)
    g[brown] = ramp_lookup('bracken', 1.6 + (detail[brown] - 0.5) * 1.4)
    if bloom > 0:
        # Flowering heather in drifts, never an even speckle (Book 7 section 14).
        drift = fbm(H, W, 30, 62) > 0.62 - 0.12 * bloom
        fl = m & drift & (value_noise(H, W, 2, 63) > 0.45) & (detail > 0.42)
        g[fl] = ramp_lookup('violet', 1.6 + (tone[fl] - 0.5) * 2)
        hi = fl & (value_noise(H, W, 2, 64) > 0.72)
        g[hi] = ramp_lookup('thrift', 2.0 + 0 * tone[hi])
    gap = m & (fbm(H, W, 9, 65) < 0.3)
    g[gap] = ramp_lookup('earth', 1.2 + (detail[gap] - 0.5))


def ground_grass(g, m, tone, detail, base=4.6):
    g[m] = ramp_lookup('grass', base + (tone[m] - 0.5) * 2.2 + (detail[m] - 0.5) * 0.9)


def ground_peat(g, m, tone, detail, wet=False):
    """Bare peat: black-brown, crumbling, wet in hollows; spade-cut turves stacked to dry."""
    g[m] = ramp_lookup('earth', 1.4 + (tone[m] - 0.5) * 1.4 + (detail[m] - 0.5) * 0.8)
    crumb = m & (value_noise(H, W, 2, 71) > 0.76)
    g[crumb] = ramp_lookup('tar', 2.0 + 0 * tone[crumb])
    if wet:
        sheen = m & (fbm(H, W, 7, 72) > 0.7)
        g[sheen] = g[sheen] * 0.6 + C('sky', 1) * 0.4


def ground_shingle(g, m, tone, detail):
    g[m] = ramp_lookup('stone', 4.0 + (tone[m] - 0.5) * 0.9 + (detail[m] - 0.5) * 1.1)
    peb = m & (detail > 0.62)
    g[peb] = ramp_lookup('stone', 5.6 + (tone[peb] - 0.5) * 2)
    sand = m & (fbm(H, W, 5, 11) > 0.68)
    g[sand] = ramp_lookup('sand', 3.2 + (detail[sand] - 0.5) * 1.0)


def ground_sand(g, m, tone, detail, wet=False):
    if wet:
        g[m] = ramp_lookup('sand_wet', 2.3 + (tone[m] - 0.5) * 1.2 + (detail[m] > 0.7) * 0.5)
    else:
        g[m] = ramp_lookup('sand', 3.6 + (tone[m] - 0.5) * 1.2 + (detail[m] - 0.5) * 0.6)


def ground_weedrock(g, m, tone, detail):
    """Foreshore rock: black, wrack-hung, barnacled where the waves reach."""
    g[m] = ramp_lookup('stone', 1.6 + (detail[m] - 0.5) * 1.4)
    weed = m & (fbm(H, W, 6, 12) > 0.5)
    g[weed] = ramp_lookup('kelp', 2 + (detail[weed] - 0.5) * 2.4)
    bar = m & (value_noise(H, W, 2, 13) > 0.78)
    g[bar] = ramp_lookup('wool', 3.2 + (tone[bar] - 0.5))


def cliff_face(g, m, top, foot, seed=3, warm=False):
    """A cliff face seen in the three-quarter view: strata in bands, lit ledges and dark cracks,
    lichen on the upper faces, white guano under the ledges, dark and wet at its foot. `top` and
    `foot` are per-column arrays (the lip and the waterline) in view pixels."""
    strata = fbm(H, W, 12, seed, 2)
    yy = YS + strata * 6
    band = np.floor(yy / 5.0)
    rel = np.clip((YS - top[None, :]) / np.maximum(4, foot[None, :] - top[None, :]), 0, 1)
    ramp = 'stone_warm' if warm else 'stone'
    shade = 3.8 - rel * 1.6 + (band % 2) * 0.7 - (band % 3 == 0) * 0.6
    col = ramp_lookup(ramp, shade)
    ledge = (yy % 5.0 < 1.0) & (band % 2 == 1)
    col[ledge] = ramp_lookup('stone', 6.2 + 0 * shade[ledge])
    crack = value_noise(H, W, 2, seed + 5) > 0.84
    col[crack] = ramp_lookup('stone', 1.0 + 0 * shade[crack])
    lichen = (rel < 0.45) & (value_noise(H, W, 3, seed + 7) > 0.74)
    col[lichen] = ramp_lookup('trefoil', 1.2 + 0 * shade[lichen])
    guano = ledge & (value_noise(H, W, 2, seed + 9) > 0.55) & (rel > 0.15)
    col[guano] = ramp_lookup('wool', 5.4 + 0 * shade[guano])
    wetfoot = rel > 0.86
    col[wetfoot] = ramp_lookup('kelp', 1.0 + (strata[wetfoot] - 0.5) * 2)
    lip = (YS - top[None, :]) < 2.5
    col[lip] = ramp_lookup('earth', 1.0 + 0 * shade[lip])
    g[m] = col[m]


def peat_face(g, m, top, seed=5):
    """The cut face of a peat bank: near-black peat with the spade's marks in it, roots and a
    heather lip overhanging it."""
    rel = YS - top[None, :]
    n = fbm(H, W, 5, seed)
    col = ramp_lookup('tar', 2.2 - np.clip(rel / 10, 0, 1) * 1.2 + (n - 0.5) * 0.8)
    spade = (np.floor((XS + n * 3) / 6) % 2 == 0) & ((XS + n * 3) % 6 < 1)
    col[spade] = ramp_lookup('tar', 0.5 + 0 * rel[spade])
    root = value_noise(H, W, 2, seed + 1) > 0.88
    col[root] = ramp_lookup('bracken', 2.5 + 0 * rel[root])
    lip = rel < 2
    col[lip] = ramp_lookup('weld', 1.5 + 0 * rel[lip])
    g[m] = col[m]


# ------------------------------------------------------------------ water
def sea(f, t, m, dist, wind=(0.9, 0.45), calm=0.0):
    """Open water: darker away from the shore (`dist` 0..1), swells in bands rolling in on the
    wind, white crests broken into lengths, glints."""
    u = XS * wind[0] + YS * wind[1]
    w1 = np.sin(u / 9 - ph(t, 3))
    w2 = np.sin(u / 4.3 - ph(t, 5) + XS / 60)
    idx = 4.4 - banded(np.clip(dist, 0, 1), 5) * 2.9 + (w1 > 0.6) * 0.7 + (w2 > 0.85) * 0.5
    col = ramp_lookup('sea', idx)
    broken = value_noise(H, W, 7, 77 + int(t * 2.5) % 5) > 0.55 + calm * 0.3
    crest = (w1 > 0.96) & (w2 > 0.0) & broken
    col[crest] = C('sea', 8)
    gl = value_noise(H, W, 2, 300 + int(round(t * FPS)) % 997) > 0.955
    col[gl] = col[gl] * 0.5 + C('sky', 5) * 0.5
    f[m] = col[m]


def surf(f, t, m, d, seed=61):
    """Foam where water meets land: `d` is the distance in pixels from the waterline (0 at it);
    lines of breaking surf run in and the foam slides up and back."""
    lace = value_noise(H, W, 3, seed + int(t * 5) % 7) > 0.45
    run = np.sin(d * 0.42 - ph(t, 4) + XS / 50 + value_noise(H, W, 24, seed) * 3)
    broken = value_noise(H, W, 9, seed + 3) > 0.4
    brk = m & (d < 18) & (run > 0.82) & broken
    f[brk & lace] = C('sea', 10)
    f[brk & ~lace] = C('sea', 8)
    reach = 3 + 2.5 * np.sin(ph(t, 2) + XS / 45) ** 2
    edge = m & (d < reach)
    f[edge & lace] = C('sea', 10)
    f[edge & ~lace] = C('sea', 9)


def stream(f, t, m, flow=(0.0, 1.0), bank=None, speed=26.0):
    """Running water over stones: streaks drifting downstream, foam along the banks."""
    fx_, fy_ = flow
    along = XS * fx_ + YS * fy_
    across = XS * fy_ - YS * fx_
    tt = t / LOOP
    a = np.sin((along - tt * speed * LOOP) / 3.0 + np.sin(across / 3) * 2) * 0.5 + 0.5
    b = np.sin((along - tt * speed * 0.65 * LOOP) / 1.7 + across * 0.9) * 0.5 + 0.5
    col = np.broadcast_to(C('sea', 4), (H, W, 3)).copy()
    col[a > 0.8] = C('sea', 6)
    col[(b > 0.86) & (a > 0.4)] = C('sea', 7)
    if bank is not None:
        foam = bank < 1.6 + (np.sin(along / 2 - tt * TAU * 6) * 0.5 + 0.5) * 1.2
        col[foam] = C('sea', 9)
    f[m] = f[m] * 0.35 + col[m] * 0.65


def pool(f, t, m, sky=3.0, peat=False, wind=(1.0, 0.3)):
    """Still water holding the grey sky: dark at its edge, wind ripples running across it."""
    along = XS * wind[0] + YS * wind[1]
    rip = np.sin(along / 3.0 - ph(t, 6) + np.sin(YS / 5 + XS / 11) * 2) > 0.78
    rip2 = np.sin(along / 1.8 - ph(t, 9) + YS * 0.7) > 0.9
    base = ramp_lookup('sky', sky + rip * 1.6 + rip2 * 0.8 + 0 * XS)
    if peat:
        base = base * 0.55 + C('tar', 2) * 0.45
    f[m] = base[m]


def waterfall_sheet(f, t, x0, x1, y0, y1):
    """A falling sheet of water over a lip: white streaks racing down, darker gaps, the lip lit."""
    xs = np.arange(int(x0), int(x1))
    for x in xs:
        n = hash01(x, 7)
        for y in range(int(y0), int(y1)):
            v = math.sin((y - t / LOOP * 160 * (1 + n)) / (2.0 + n * 2) + n * 9)
            col = C('sea', 9 if v > 0.5 else 7 if v > -0.3 else 5)
            if y - y0 < 2:
                col = C('sea', 10)
            if 0 <= y < H and 0 <= x < W:
                f[y, x] = col


def spray(f, t, x, y, rx=14, n=60, seed=0):
    """Spray and mist round the foot of a fall or a breaking wave, drifting up and away."""
    r = np.random.default_rng(seed)
    for k in range(n):
        a = r.uniform(0, TAU)
        speed = r.uniform(0.6, 1.4)
        life = ((t / LOOP) * 8 * speed + r.random()) % 1.0
        px_ = x + math.cos(a) * rx * life + 6 * life
        py_ = y - 8 * life * r.uniform(0.3, 1.0) + math.sin(a) * rx * 0.35 * life
        col = C('sea', 10) if life < 0.5 else C('sky', 5)
        fx._px(f, px_, py_, col)


# ------------------------------------------------------------------ plants
_HEATHER = {}


def heather_bush(v, bloom=True):
    """A heather bush in pixels: (dx, dy, colour), dy up from the foot, for variant v."""
    key = (v, bloom)
    if key in _HEATHER:
        return _HEATHER[key]
    out = []
    w = 3 + v % 3
    h = 4 + (v // 3) % 3
    for dy in range(h):
        span = w * math.sqrt(max(0.0, 1 - (dy / h) ** 2))
        for dx in range(-int(span), int(span) + 1):
            if hash01(v, dx, dy, 3) < 0.18:
                continue
            top = dy >= h - 2 or abs(dx) >= span - 1
            if bloom and top and hash01(v, dx, dy, 5) < 0.6:
                col = C('violet', 2 + hash01(v, dx, dy) * 2) if hash01(v, dx, dy, 6) < 0.7 \
                    else C('thrift', 2 + hash01(v, dx, dy) * 2)
            else:
                col = C('weld', 1.5 + dy / h * 2.5 + (dx < 0) * 0.6)
            out.append((dx, dy, col))
    out.append((0, -1, C('earth', 0)))
    _HEATHER[key] = out
    return out


def draw_heather(f, x, y, v, phase, t, gust, bloom=True):
    lean = gust * 2.4 + 1.3 * fx.loopsin(t, 4, phase * TAU) * (0.7 + gust) + \
        0.6 * fx.loopsin(t, 7, phase * TAU * 3)
    pts = heather_bush(v, bloom)
    hmax = 5.0
    for dx, dy, col in pts:
        k = (max(0, dy) / hmax) ** 1.2
        fx._px(f, x + dx + lean * k, y - dy, col)


def draw_cotton(f, x, y, phase, t, gust):
    """Cotton grass: thin stalks with white tufted heads that nod in the wind."""
    lean = gust * 2.4 + 1.2 * fx.loopsin(t, 5, phase * TAU) * (0.6 + gust)
    for s in range(3):
        sx = x + (s - 1) * 1.3
        hgt = 6 + (s * 2 + int(phase * 7)) % 4
        for k in range(hgt):
            ff = k / hgt
            fx._px(f, sx + lean * ff * ff, y - k, C('grass', 3 + ff * 3))
        hx = sx + lean
        fx._px(f, hx, y - hgt, C('wool', 6))
        fx._px(f, hx + 1, y - hgt, C('wool', 5))
        fx._px(f, hx, y - hgt - 1, C('wool', 6))


def draw_bracken(f, x, y, phase, t, gust, autumn=False):
    """A bracken frond: a stem with paired pinnae, its tip curling over in the wind."""
    lean = gust * 2.0 + 0.8 * fx.loopsin(t, 3, phase * TAU)
    ramp = 'bracken' if autumn else 'fern'
    n = 10
    for j in range(n):
        ff = j / n
        px_ = x + lean * ff * ff
        py_ = y - j
        fx._px(f, px_, py_, C(ramp, 1.5 + ff * 2.5))
        if j > 2 and j % 2 == 0:
            span = int(3 * (1 - ff) + 1)
            for s in range(1, span + 1):
                fx._px(f, px_ - s, py_ + s * 0.4, C(ramp, 2 + ff * 2))
                fx._px(f, px_ + s, py_ + s * 0.4, C(ramp, 1 + ff * 2))


def gust_at(x, y, t, period=640, speed=1.0):
    """The gust travelling downwind (east): a band of 0..1 at (x, y)."""
    u = (x - t / LOOP * period * speed + y * 0.3) % period
    return max(0.0, math.sin(u / period * TAU) * 0.9) ** 1.5


def scatter(mask, n, seed, rr=None):
    """Up to n random points inside a mask."""
    r = np.random.default_rng(seed)
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return []
    k = r.choice(len(xs), size=min(n, len(xs)), replace=False)
    return [(float(xs[i]) + r.random(), float(ys[i]) + r.random(), float(r.random())) for i in k]


# ------------------------------------------------------------------ stonework (props)
def drystone(spr, x0, y0, x1, y1, seed, ramp='stone', base=4.4):
    """Drystone coursing: flat stones laid in rows, each lit on top and dark in its joints."""
    y = y0
    row = 0
    while y < y1:
        hgt = 2 + int(hash01(seed, row) * 2)
        x = x0 - int(hash01(seed, row, 1) * 4)
        k = 0
        while x < x1:
            wid = 3 + int(hash01(seed, row, k) * 5)
            tone = base + (hash01(seed, row, k, 2) - 0.5) * 1.6
            for yy in range(y, min(y1, y + hgt)):
                for xx in range(max(x0, x), min(x1, x + wid)):
                    edge = xx == x or yy == y + hgt - 1
                    top = yy == y
                    c = C(ramp, tone - 2.2 if edge else tone + (0.9 if top else 0))
                    if not edge and hash01(xx, yy, seed) < 0.06:
                        c = C('moss', 4)
                    spr.px(xx, yy, c)
            x += wid
            k += 1
        y += hgt
        row += 1


def cell_ring(burned=True):
    """The hermit's cell: a roofless beehive ring of drystone about 5 tiles across inside, its
    corbelled roof fallen (the upper courses lean in and stop ragged), the doorway on the east, a
    corbel lying across the north wall's foot. Seen in the three-quarter view: the back (north)
    wall's inner face shows over the floor, sooted where it burned; the front (south) wall is low
    and broken. Returns (back, front): the back half and the floor sort behind people, the front
    half in front."""
    w, h = 156, 112
    back = Sprite(w, h, w // 2, 76)
    front = Sprite(w, h, w // 2, h - 6)
    cx, cy = w / 2, 72
    rx, ry = 68, 32
    wall = 10
    # The floor: trodden earth and turf grown in since the fire, fallen stones on it.
    for y in range(h):
        for x in range(w):
            d = math.hypot((x + 0.5 - cx) / (rx - wall), (y + 0.5 - cy) / (ry - wall * 0.45))
            if d < 1.0:
                n = hash01(x // 3, y // 2, 21)
                c = C('grass', 3.6 + n * 1.4) if n > 0.45 else C('earth', 2.2 + n * 1.6)
                if hash01(x, y, 22) < 0.03:
                    c = C('stone', 5)
                back.px(x, y, c)
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = math.hypot(dx, dy)
            if d > 1.0 or d < 1.0 - wall / rx:
                continue
            ang = math.atan2(dy, dx)
            if abs(ang) < 0.22:
                continue                       # the doorway, east
            ht = 24 + 5 * math.cos(ang + 1.9)
            if dy > 0:
                ht = 8 + 6 * hash01(int((ang + 4) * 5), 3)
            ht -= 7 * hash01(int((ang + 4) * 7), 4)      # ragged where the roof fell
            for z in range(int(ht)):
                yy = int(y - z)
                if yy < 0:
                    break
                course = z // 3
                sx = int((x + course * 2) / 5)
                tone = 4.6 + (hash01(sx, course, 11) - 0.5) * 2.0
                joint = (z % 3 == 0) or hash01(int((x + course * 2)), course, 12) < 0.16
                c = C('stone', tone - 2.2 if joint else tone + (1.2 if z == int(ht) - 1 else 0))
                inner = dy < 0 and d < 1.0 - wall / rx * 0.5
                if burned and inner and z < ht * 0.85 and hash01(x // 2, yy // 2, 13) < 0.35:
                    c = C('stone', 1.6 + hash01(x, yy) * 0.8)          # soot on the inner face
                if z == int(ht) - 1 and hash01(x, 14) < 0.6:
                    c = C('moss', 4 + hash01(x, 15) * 2)
                if z == int(ht) - 1 and hash01(x, 16) < 0.15:
                    c = C('thrift', 3)
                (back if dy < 0.1 else front).px(x, yy, c)
    # The fallen corbel across the north wall's foot: a long slab, a dark gap under it.
    for x in range(48, 92):
        y0 = 50 - int((x - 48) * 0.06)
        for z in range(4):
            back.px(x, y0 + z, C('stone', 6.0 - z * 0.9))
        back.px(x, y0 + 4, C('ink', 0))
        back.px(x, y0 + 5, C('ink', 1))
    return back.outline(), front.outline()


def altar(burned=True):
    """The burned altar: a slab on two stones against the cell's west wall, scorched black."""
    s = Sprite(30, 22, 15, 20)
    for x in range(3, 27):
        for y in range(6, 10):
            s.px(x, y, C('stone', 5.5 - (y - 6) * 0.7 - (1.8 if burned and hash01(x, y) < 0.4 else 0)))
    for (x0, x1) in ((5, 10), (20, 25)):
        for x in range(x0, x1):
            for y in range(10, 20):
                s.px(x, y, C('stone', 3.4 - (y - 10) * 0.12 + (x == x0) * 0.8))
    for x in range(10, 20):
        for y in range(10, 19):
            s.px(x, y, C('ink', 1))              # the dark under the slab
    return s.outline()


def cross_slab(lit_edge=False):
    """The slab beside the cell's doorway with a cross cut in it, a line of the hermit's hand
    under its arms."""
    s = Sprite(16, 30, 8, 28)
    for y in range(2, 28):
        for x in range(2, 14):
            if (x in (2, 13) and y < 4) or (y < 3 and x in (3, 12)):
                continue
            s.px(x, y, C('stone', 5.0 + (x < 5) * 0.8 - (y > 24) * 1.2))
    for y in range(6, 20):
        s.px(7, y, C('stone', 2.2))
        s.px(8, y, C('stone', 3.0))
    for x in range(4, 12):
        s.px(x, 10, C('stone', 2.2))
        s.px(x, 11, C('stone', 3.0))
    for x in range(4, 12, 2):
        s.px(x, 22, C('stone', 2.6))
    if lit_edge:
        # The interactive highlight (Book 7 section 13): a one-pixel bright edge just inside the
        # ink outline, all round.
        m = s.mask.copy()
        for y, x in zip(*np.nonzero(m)):
            if not (m[y - 1, x] and m[y + 1, x] and m[y, x - 1] and m[y, x + 1]):
                s.rgb[y, x] = C('wool', 6)
    return s.outline()


def standing_stone(k, tall=False, cup=False):
    """One of the Grey Men: a weathered grey slab leaning a little, lichen on its lit face, a
    dark foot in the grass. The tallest stands on the ring's east side; the cup-and-ring stone
    (cup=True) is low and carries its carving."""
    h = 46 if tall else (20 if cup else 30 + int(hash01(k, 1) * 10))
    w = 12 + int(hash01(k, 2) * 5) + (6 if cup else 0)
    s = Sprite(w + 10, h + 4, (w + 10) // 2, h + 2)
    lean = (hash01(k, 3) - 0.5) * 4
    for y in range(h):
        f = y / h
        half = w / 2 * (0.65 + 0.35 * math.sin(math.pi * min(1, (1 - f) * 1.1 + 0.05)))
        cx = s.ax + lean * (1 - f)
        for x in range(int(cx - half), int(cx + half) + 1):
            dx = (x - cx) / max(1, half)
            tone = 5.2 - dx * 1.6 - (1 - f) * 0.2 + (hash01(x, y, k) - 0.5) * 0.7
            c = C('stone', tone)
            if dx < -0.2 and hash01(x // 2, y // 2, k + 9) < 0.18:
                c = C('trefoil', 1.5)
            if hash01(x, y // 3, k + 4) < 0.05:
                c = C('stone', 2.5)
            s.px(x, s.ay - (h - 1 - y), c)
    if cup:
        cx, cy = s.ax, s.ay - h * 0.55
        for rr in (1.2, 3.2, 5.2):
            for a in range(0, 360, 8):
                fx._px(s.rgb, cx + math.cos(math.radians(a)) * rr, cy + math.sin(math.radians(a)) * rr * 0.6, C('stone', 2.4))
        for j in range(4):
            fx._px(s.rgb, cx + 7 + j, cy + 1 - j * 0.3, C('stone', 2.4))
    for x in range(s.w):
        for y in range(s.ay - 1, s.ay + 1):
            if s.mask[y, x]:
                s.rgb[y, x] = C('grass', 2)
    return s.outline()


def boulder(k, rx=9, ry=6, ramp='stone', base=3.6, weed=False):
    s = Sprite(int(rx * 2.8) + 4, int(ry * 2.8) + 4)
    stone(s, s.w / 2, s.h / 2, rx, ry, ramp, base, seed=k * 17 + 3)
    if weed:
        for y, x in zip(*np.nonzero(s.mask)):
            below = s.mask[y:, x].sum()
            if below < 4:
                s.rgb[y, x] = C('kelp', 1 + hash01(x, y, k) * 3)
            elif hash01(x, y, k + 2) < 0.35:
                s.rgb[y, x] = C('kelp', 2.5 + hash01(x, y, k + 3) * 2)
    s.ay = int(s.h / 2 + ry * 0.9)
    return s.outline()


def eyrie():
    """The sea eagle's eyrie on top of the stack: a great platform of sticks and wrack."""
    s = Sprite(34, 14, 17, 11)
    for y in range(3, 12):
        for x in range(2, 32):
            dx, dy = (x - 17) / 15, (y - 7.5) / 4.5
            if dx * dx + dy * dy > 1:
                continue
            stick = math.sin(x * 1.7 + y * 3.1) > 0.3
            s.px(x, y, C('driftwood', 2.5 + stick * 1.6 - (dy > 0.4) * 1.2))
    for x in range(10, 24):
        s.px(x, 5, C('driftwood', 1))
    return s.outline()


def eagle(flap, perched=False):
    """A white-tailed sea eagle: broad dark-brown wings, pale head, white wedge tail."""
    if perched:
        s = Sprite(12, 16, 6, 15)
        for y in range(4, 14):
            for x in range(3, 9):
                s.px(x, y, C('bracken', 1 + (x < 5)))
        for y in range(1, 4):
            for x in range(4, 8):
                s.px(x, y, C('wool', 4 + (x < 6)))
        s.px(8, 2, C('beak', 2))
        for x in range(4, 8):
            s.px(x, 14, C('wool', 6))
        return s.outline()
    s = Sprite(31, 13, 15, 6)
    wy = [2, 5, 8, 5][flap % 4]
    for k in range(13):
        yy = 6 + (wy - 6) * (k / 12) ** 1.3
        for side in (-1, 1):
            x = 15 + side * (2 + k)
            s.px(x, int(round(yy)), C('bracken', 1 + (k > 9)))
            s.px(x, int(round(yy)) + 1, C('tar', 1))
    for x in range(13, 18):
        s.px(x, 6, C('bracken', 1))
    s.px(15, 4, C('wool', 4))
    s.px(15, 5, C('wool', 4))
    for x in range(14, 17):
        s.px(x, 8, C('wool', 6))
    return s.outline()


def hare(k):
    """A brown hare crouched in its form, an ear twitching."""
    s = Sprite(14, 10, 7, 9)
    for y in range(4, 9):
        for x in range(2, 11):
            dx, dy = (x - 6) / 4.5, (y - 6.5) / 2.6
            if dx * dx + dy * dy <= 1:
                s.px(x, y, C('bracken', 3 - dy * 0.9 - dx * 0.5))
    s.px(10, 4, C('bracken', 3))
    s.px(9, 1 + (k % 2), C('bracken', 2))
    s.px(9, 2, C('bracken', 3))
    s.px(10, 2 + (k % 2 == 0), C('bracken', 2))
    s.px(10, 5, C('ink', 0))
    return s.outline()


def lapwing(k):
    s = Sprite(9, 9, 4, 8)
    for (x, y) in [(3, 4), (4, 4), (5, 4), (2, 5), (3, 5), (4, 5), (5, 5), (3, 6), (4, 6)]:
        s.px(x, y, C('moss', 2))
    s.px(4, 6, C('wool', 6))
    s.px(3, 6, C('wool', 6))
    s.px(5 if k else 4, 3, C('ink', 1))
    s.px(5 if k else 4, 2, C('ink', 1))
    s.px(3, 7, C('crab', 2))
    s.px(5, 7, C('crab', 2))
    return s.outline(C('ink', 1))


def fulmar(flap):
    s = fx.gull_sprite(flap)
    return s


# ------------------------------------------------------------------ the drowned (mockup only)
def drowned_figure(k, t, phase=0.0):
    """One of the drowned standing on the skerry: a person in a colder palette (Book 7 section
    09), head bowed a little, hair and clothes hanging wet and weed-hung, water running off them
    in drops. Mockup only: the drowned are characters, whose sheets come with their own approval
    (Book 3)."""
    s = Sprite(16, 40, 8, 39)
    cloth = ('woad', 'smoke', 'sea', 'woad', 'smoke')[k % 5]
    # Legs, then the body widening to the shoulders, arms hanging at the sides.
    for y in range(30, 39):
        for x in (5, 6, 9, 10):
            s.px(x, y, C(cloth, 1.5 + (x > 8) * 0.5))
    for y in range(14, 31):
        f = (y - 14) / 16
        half = 4.2 - f * 0.6 + (1.2 if k % 2 and y > 24 else 0)       # a skirt on some
        for x in range(int(8 - half), int(8 + half) + 1):
            s.px(x, y, C(cloth, 2.6 - (x > 8) * 0.9 + (y < 17) * 0.4))
    for y in range(15, 28):
        s.px(3, y, C(cloth, 1.6))
        s.px(12, y, C(cloth, 1.2))
    for (x, y) in ((3, 28), (12, 28)):
        s.px(x, y, C('sky', 3))                  # pale hands
    for y in range(6, 13):
        for x in range(6, 11):
            if (x - 8) ** 2 / 6.5 + (y - 9.5) ** 2 / 12 <= 1:
                s.px(x, y, C('sky', 3.4 - (x > 8) * 0.8))
    for x in range(5, 12):
        s.px(x, 6, C('kelp', 2))                   # wet hair, weed in it
    for y in range(7, 17):
        s.px(5, y, C('kelp', 2 + (y % 3 == 0)))
        s.px(11, y + 1, C('kelp', 1.5))
    s.px(7, 10, C('ink', 1))
    s.px(9, 10, C('ink', 1))
    s.outline(C('ink', 1))
    drip = int((t / LOOP * 12 + phase * 7) % 7)
    for x in (2, 13):
        if 0 <= 28 + drip < s.h:
            s.px(x, 28 + drip, C('sea', 9))
    return s


# ------------------------------------------------------------------ light, air and output
def contact(buf, x, y, rx=7, ry=2.4, v=0.7):
    for yy in range(int(y - 3), int(y + 3)):
        for xx in range(int(x - rx), int(x + rx + 1)):
            if 0 <= yy < H and 0 <= xx < W and ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2 < 1:
                buf[yy, xx] = max(buf[yy, xx], v)


def cast(buf, spr, x, y, length=8, v=1.0):
    """A sprite's long shadow away from the low sun, stamped into a shadow buffer."""
    m = np.zeros((H, W), np.float32)
    stamp_mask(m, spr, x, y, 1.0)
    out = buf
    for s in range(length):
        out = np.maximum(out, shift(m, s * SUN[0], -s * SUN[1] * 0.3) * v)
    return out


def apply_shadow(f, shadow):
    return f * (1 - shadow[..., None] * (1 - SHADE) * 0.85)


def motes(f, t, n, seed, region=None, col=None, drift=(0.3, -0.6), size=1):
    """Dust or spray hanging in the air: specks drifting on a slow draught, twinkling."""
    r = np.random.default_rng(seed)
    x0 = r.uniform(0, W, n)
    y0 = r.uniform(0, H, n)
    sp = r.uniform(0.5, 1.5, n)
    tw = r.uniform(0, TAU, n)
    col = C('wool', 5) if col is None else col
    for i in range(n):
        x = (x0[i] + drift[0] * W * sp[i] * t / LOOP * 0.25 + 2 * math.sin(ph(t, 2, tw[i]))) % W
        y = (y0[i] + drift[1] * H * sp[i] * t / LOOP * 0.25 + 1.5 * math.cos(ph(t, 3, tw[i]))) % H
        if region is not None and not region[int(y), int(x)]:
            continue
        a = 0.35 + 0.35 * math.sin(ph(t, 5, tw[i]))
        xi, yi = int(x), int(y)
        for dx in range(size):
            if 0 <= xi + dx < W:
                f[yi, xi + dx] = f[yi, xi + dx] * (1 - a) + col * a


def caustics(f, t, m, strength=0.28, scale=7.0, seed=0):
    """Light thrown up off rippling water dancing over the cave's walls and roof."""
    a = np.sin((XS + seed) / scale + np.sin(YS / (scale * 0.8) + ph(t, 3)) * 2.2 + ph(t, 2))
    b = np.sin((YS - seed) / (scale * 0.7) + np.sin(XS / (scale * 1.3) - ph(t, 4)) * 2.0 - ph(t, 3))
    v = (a * b > 0.55).astype(np.float32) * m
    v = v * strength
    f[:] = f * (1 - v[..., None]) + C('sea', 8)[None, None, :] * v[..., None]


def drips(f, t, points, seed=0):
    """Water dripping from the roof: a bright drop falling, a ring where it lands."""
    for k, (x, y, fall) in enumerate(points):
        p = ((t / LOOP) * (3 + k % 3) + hash01(seed, k)) % 1.0
        if p < 0.4:
            fx._px(f, x, y - fall * (1 - p / 0.4), C('sea', 10))
        else:
            rr = (p - 0.4) * 14
            for a in range(0, 360, 20):
                fx._px(f, x + math.cos(math.radians(a)) * rr, y + math.sin(math.radians(a)) * rr * 0.45,
                       C('sea', 9))


def steerer(f, shadow, x, y, facing='e', state='idle', t=0.0, ticks=15, depth=0):
    n = people48.frames_of('steerer_a', state) or 1
    k = int(t * 60 / ticks) % n
    spr = people48.sprite('steerer_a', state, facing, k)
    contact(shadow, x, y)
    if depth > 0:
        out = Sprite(spr.w, spr.h, spr.ax, spr.ay)
        out.rgb[:] = spr.rgb
        out.mask[:] = spr.mask
        wl = spr.ay - depth
        out.mask[wl + 1:, :] = False
        for xx in range(spr.w):
            if spr.mask[wl, xx]:
                out.rgb[wl, xx] = C('sea', 9)
        spr = out
        ring = 3 + (t * 4) % 6
        for a in range(0, 360, 12):
            fx._px(f, x + math.cos(math.radians(a)) * ring * 1.6, y - depth + math.sin(math.radians(a)) * ring * 0.5,
                   C('sea', 9))
    stamp(f, spr, x, y)
    return spr


def dark_grade(f, light, cool=(0.55, 0.6, 0.8), lift=(10, 12, 22)):
    """An interior grade: the light field (0..1) lifts the lit parts; the rest sinks into cool
    blue shadow that stays readable."""
    k = light[..., None]
    out = f * (np.array(cool) * (1 - k) + k)
    return out * 0.94 + np.array(lift)


def save(name, scene, frames=FRAMES):
    """Writes <name>.png (the still), <name>-loop.gif, <name>-motion.png, and returns the
    continuous-motion share measured on every frame at 12.5 fps."""
    import measure
    os.makedirs(OUT, exist_ok=True)
    raw = [to_u8(scene.frame(k / FPS)) for k in range(frames)]
    Image.fromarray(raw[0]).save(os.path.join(OUT, f'{name}.png'))
    Image.fromarray(raw[0]).resize((W * 4, H * 4), Image.NEAREST).save(
        os.path.join(OUT, f'{name}-4x.png'))
    cont, cells = measure.continuous([r.astype(np.int16) for r in raw])
    measure.motion_map(raw[0], cells, os.path.join(OUT, f'{name}-motion.png'))
    imgs = [Image.fromarray(r) for r in raw[::2]]
    imgs[0].save(os.path.join(OUT, f'{name}-loop.gif'), save_all=True, append_images=imgs[1:],
                 duration=int(2000 / FPS), loop=0, optimize=False)
    path = os.path.join(OUT, 'measure.json')
    data = json.load(open(path)) if os.path.exists(path) else {}
    data[name] = {'continuousMotion': round(float(cont), 4), 'frames': len(raw)}
    with open(path, 'w') as fh:
        json.dump(dict(sorted(data.items())), fh, indent=2)
        fh.write('\n')
    print(f'{name}: continuous motion {cont * 100:.1f}% ({len(raw)} frames)')
    return cont

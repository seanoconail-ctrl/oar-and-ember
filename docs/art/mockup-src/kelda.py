"""The Kelda Spring in summer: the lush side of the island, still under Atlantic light."""
import math
import numpy as np
import fx
import people
from core import (C, LOOP, Sprite, blob, blur, banded, fbm, hash01, ramp_lookup, rng, shift,
                  stamp, stamp_mask, stone, value_noise)

W, H = 700, 420
VIEW = (30, 30)
SUN = (0.9, -0.45)
SHADE = np.array([0.6, 0.66, 0.82], np.float32)
GUST_PERIOD = 350

# The stream: a polyline from the pool's outflow down to the south-east edge.
STREAM = [(322, 184), (338, 204), (366, 218), (378, 242), (360, 268), (352, 290), (372, 312),
          (410, 326), (440, 350), (444, 380), (462, 410), (470, 440)]


def _dist_to_polyline(xs, ys, pts):
    best = np.full(xs.shape, 1e9, np.float32)
    along = np.zeros(xs.shape, np.float32)
    acc = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        t = np.clip(((xs - x0) * dx + (ys - y0) * dy) / (L * L), 0, 1)
        px, py = x0 + t * dx, y0 + t * dy
        d = np.hypot(xs - px, ys - py)
        closer = d < best
        best = np.where(closer, d, best)
        along = np.where(closer, acc + t * L, along)
        acc += L
    return best, along


class Kelda:
    def __init__(self):
        r = rng(17)
        self.r = r
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        self.xs, self.ys = xs, ys
        tone = fbm(H, W, 70, 5)
        detail = fbm(H, W, 14, 6)
        self.tone = tone
        g = np.zeros((H, W, 3), np.float32)
        # Summer machair: fuller and lighter than the strand's, but still grey-green.
        grass_idx = 6.0 + (tone - 0.5) * 1.7 + (detail - 0.5) * 0.8
        g[:] = ramp_lookup('grass', grass_idx)
        # A worn path from the wall's gap down to the pool's edge.
        pd, _ = _dist_to_polyline(xs, ys, [(560, 30), (548, 70), (510, 100), (450, 116), (390, 128)])
        path = pd < 5 + (detail - 0.5) * 3
        g[path] = ramp_lookup('earth', 3.5 + (detail[path] - 0.5) * 2)
        trod = (pd >= 5 + (detail - 0.5) * 3) & (pd < 8)
        g[trod] = ramp_lookup('grass', 4 + 0 * pd[trod])
        # A boggy patch to the south-west: dark moss and peaty water.
        bog = fbm(H, W, 30, 7)
        bogm = (np.hypot(xs - 120, (ys - 330) * 1.3) < 80 + bog * 30) & (bog > 0.45)
        g[bogm] = ramp_lookup('moss', 2.5 + (detail[bogm] - 0.5) * 2)
        peat = bogm & (bog > 0.62)
        g[peat] = ramp_lookup('earth', 0.6 + (bog[peat] > 0.7)) * 0.7 + ramp_lookup('sky', 1 + 0 * bog[peat]) * 0.3
        self.bog = bogm
        # The spring pool: an irregular basin, clear and darker towards its deep eye.
        pr = np.hypot((xs - 276) / 62, (ys - 152) / 34) + (fbm(H, W, 16, 8) - 0.5) * 0.45
        self.pool = pr < 1
        self.pool_r = pr
        # Moss round the pool and along the stream: soft, wet edges.
        sd, along = _dist_to_polyline(xs, ys, STREAM)
        width = 6.5 + 2.5 * np.sin(along / 23) + (detail - 0.5) * 2
        self.stream = (sd < width) & ~self.pool
        self.stream_d, self.stream_along, self.stream_w = sd, along, width
        moss = ((pr >= 1) & (pr < 1.35)) | ((sd >= width) & (sd < width + 5 + detail * 4))
        g[moss & ~path] = ramp_lookup('moss', 4 + (detail[moss & ~path] - 0.5) * 3)
        self.moss = moss
        self.ground = g
        self.props = []
        self.tufts = []
        self._place()

    def add(self, spr, x, y, height):
        self.props.append((y, spr, x, y, height))

    def _place(self):
        r = self.r
        # Mossy stones ringing the pool, and stepping stones in the stream.
        for k in range(30):
            a = k / 30 * math.tau + r.normal(0, 0.12)
            rad = 1.0 + r.normal(0, 0.08) - (0.18 if r.random() < 0.15 else 0)
            x = 276 + math.cos(a) * 64 * rad
            y = 152 + math.sin(a) * 36 * rad
            if 0.75 < a % math.tau < 1.25 or r.random() < 0.18:
                continue                         # the outflow, and gaps where moss runs down
            sz = r.uniform(3, 8) if r.random() < 0.8 else r.uniform(8, 11)
            spr = Sprite(int(sz * 2.6) + 4, int(sz * 2) + 4)
            stone(spr, spr.w / 2, spr.h / 2, sz, sz * 0.75, 'stone', 5, seed=k * 13)
            _moss_top(spr)
            self.add(spr.outline(), x, y + sz * 0.7, sz)
        self.stepping = [(366, 262), (358, 274), (356, 287)]
        for k, (x, y) in enumerate(self.stepping):
            spr = Sprite(14, 10)
            stone(spr, 7, 5, 5, 3.6, 'stone', 6, seed=99 + k)
            self.add(spr.outline(), x, y + 3, 2)
        # Boulders with lichen; the drystone wall with a gap where the path runs through.
        for (x, y, sz) in [(160, 80, 12), (610, 250, 10), (90, 210, 8), (500, 330, 9)]:
            spr = Sprite(int(sz * 3), int(sz * 2.4))
            stone(spr, spr.w / 2, spr.h / 2, sz, sz * 0.72, 'stone', 5, seed=x)
            _moss_top(spr, 0.18)
            self.add(spr.outline(), x, y, sz * 1.2)
        self.wall = []
        for seg in ((404, 62, 528, 80), (566, 82, 700, 96)):
            x0, y0, x1, y1 = seg
            n = int(math.hypot(x1 - x0, y1 - y0) / 7)
            for k in range(n):
                for course in range(3):
                    x = x0 + (x1 - x0) * (k + 0.5 * (course % 2)) / n
                    y = y0 + (y1 - y0) * k / n - course * 5
                    spr = Sprite(12, 9)
                    stone(spr, 6, 4.5, 4.2, 3.0, 'stone', 4 + course, seed=int(x * 7 + course))
                    if course == 2:
                        _moss_top(spr, 0.35)
                    self.add(spr.outline(), x, y + 4 + course * 5, 6 + course * 5)
        # Plants: grass everywhere, flowers in drifts, reeds and iris by water, ferns by the
        # spring, bracken on the far bank, cotton grass in the bog.
        drift = fbm(H, W, 36, 9)
        tussock = fbm(H, W, 22, 10)
        species = fbm(H, W, 90, 11)
        species = (species - species.min()) / (species.max() - species.min()) * 0.999
        kinds = ['clover', 'trefoil', 'redclover', 'violet']
        for _ in range(15000):
            x, y = r.uniform(0, W), r.uniform(0, H)
            xi, yi = int(x), int(y)
            if self.pool[yi, xi] or self.stream[yi, xi]:
                continue
            sd = self.stream_d[yi, xi] - self.stream_w[yi, xi]
            near_water = sd < 8 or (self.pool_r[yi, xi] < 1.45)
            if near_water and r.random() < 0.22:
                kind = 'iris' if r.random() < 0.22 else 'reed'
                self.tufts.append((kind, x, y, r.uniform(8, 14) if kind == 'reed' else 10, r.random()))
                continue
            if self.bog[yi, xi]:
                if r.random() < 0.06:
                    self.tufts.append(('clover', x, y, 7, r.random()))    # cotton grass heads
                elif r.random() < 0.15:
                    self.tufts.append(('reed', x, y, r.uniform(5, 8), r.random()))
                continue
            d, tu = drift[yi, xi], tussock[yi, xi]
            if d > 0.56:
                # A drift of one flower, thick, with a few others mixed in.
                if r.random() < (d - 0.56) * 4.5:
                    k = kinds[int(species[yi, xi] * 4)] if r.random() < 0.8 else kinds[r.integers(4)]
                    self.tufts.append((k, x, y, r.uniform(3, 6), r.random()))
            elif tu > 0.58 and r.random() < (tu - 0.58) * 3:
                self.tufts.append(('grass', x, y, r.uniform(5, 9), r.random()))
            elif r.random() < 0.025:
                self.tufts.append(('grass', x, y, r.uniform(3, 6), r.random()))
        # Flower drifts colour the ground under them too.
        g = self.ground
        for k_i, kind in enumerate(kinds):
            m = (drift > 0.6) & ((species * 4).astype(int) == k_i) & ~self.pool & ~self.stream
            tint = {'clover': C('clover_white', 1), 'trefoil': C('trefoil', 2),
                    'redclover': C('redclover', 2), 'violet': C('violet', 2)}[kind]
            g[m] = g[m] * 0.82 + tint * 0.18
        for (cx, cy, n) in [(196, 118, 6), (356, 128, 5), (222, 204, 4), (330, 196, 3)]:
            for _ in range(n):
                self.props.append((cy + r.normal(0, 10), 'fern', cx + r.normal(0, 14), cy + r.normal(0, 8), r.random()))
        for _ in range(16):
            self.props.append((r.uniform(240, 300), 'bracken', r.uniform(560, 690), r.uniform(240, 300), r.random()))
        self.tufts.sort(key=lambda t: t[2])
        self.sheep = [(470, 230, 0.3, True), (540, 190, 2.1, False), (600, 330, 4.0, True)]

    def gust(self, x, y, t):
        u = (x - t / LOOP * GUST_PERIOD) % GUST_PERIOD
        return _gust(u, y)


_G = None


def _gust(u, y):
    global _G
    if _G is None:
        _G = fbm(H, GUST_PERIOD, 50, 93, 2, period_x=GUST_PERIOD)
    return max(0.0, (_G[int(y) % H, int(u) % GUST_PERIOD] - 0.38) * 2.0)


def _moss_top(spr, share=0.5):
    """Moss on the upper face of a stone."""
    top = {}
    for y, x in zip(*np.nonzero(spr.mask)):
        top.setdefault(x, y)
    for x, y0 in top.items():
        depth = int(1 + share * 4 * hash01(x, 7))
        for y in range(y0, y0 + depth):
            if spr.mask[y, x] and hash01(x, y, 3) < 0.85:
                spr.rgb[y, x] = C('moss', 4 + (y == y0) * 2)


def fern(frame, x, y, t, phase, gust):
    """A fern: fronds arching out from a crown, the tips stirring in the wind."""
    for k in range(7):
        a = -math.pi / 2 + (k - 3) * 0.48
        sway = gust * 1.4 + 0.5 * fx.loopsin(t, 3, phase * 6.28 + k)
        for j in range(15):
            f = j / 15
            px = x + math.cos(a) * j * 1.2 + sway * f * f * 2
            py = y + math.sin(a) * j * 0.9 + f * f * 6
            fx._px(frame, px, py, C('fern', 1 + f * 4))
            if j % 2 == 0 and j > 1:
                fx._px(frame, px - 1, py + 1, C('fern', 2 + f * 3))
                fx._px(frame, px + 1, py + 1, C('fern', 1 + f * 3))


def bracken(frame, x, y, t, phase, gust):
    for k in range(3):
        sway = gust * 1.8 + 0.6 * fx.loopsin(t, 3, phase * 6.28 + k)
        for j in range(8):
            f = j / 8
            px = x + (k - 1) * 3 + sway * f
            py = y - j
            fx._px(frame, px, py, C('bracken', 2 + f * 2))
            fx._px(frame, px + 1, py - 1, C('fern', 3 + f * 2) if j > 3 else C('bracken', 3))

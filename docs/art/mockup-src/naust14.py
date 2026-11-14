"""Naust Cove (Stage 14 mockup; Book 9 sections 03 and 05; decisions S14-1, S14-5, S14-21 and
S14-24), an autumn afternoon going towards low water, a fresh south-west wind.

Looking south over the cove from the turf above it: the boatshed plot marked out on the turf with
stakes, a line and the first timbers laid by it; beside it the line of old stones half sunk in the
turf leading to the old naust, a stone-lined boat-hollow fallen in, its lintel stone lying cut
with a ship; below, the bank down to the beach, shingle and then sand curving round the cove, the
landing at its middle; the flats coming bare as the tide drops, pools and wrack; the swell running
into the cove and breaking white; the fishing rocks on its two points; seals in the cove, gulls on
the rocks and wheeling, a cormorant drying its wings; the steerer on the turf.

    python3 docs/art/mockup-src/naust14.py
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import fx  # noqa: E402
import island14 as I  # noqa: E402
from core import C, Sprite, fbm, rng, stamp, value_noise  # noqa: E402

H, W = I.H, I.W
XS, YS = I.XS, I.YS


def bank(x):
    return 150 + 16 * math.sin(x / 90 + 0.5) + 5 * math.sin(x / 23)


def cove(x):
    """The cove's waterline: a bay between two rocky points."""
    u = (x - 320) / 320
    return 300 - 70 * (1 - u * u) + 8 * math.sin(x / 31)


class Naust:
    def __init__(self):
        r = rng(181)
        tone = fbm(H, W, 50, 53)
        detail = fbm(H, W, 9, 54)
        g = np.zeros((H, W, 3), np.float32)
        warp = (fbm(H, W, 18, 55) - 0.5) * 8
        bk = np.array([bank(x) for x in range(W)], np.float32)[None, :] + warp
        cv = np.array([cove(x) for x in range(W)], np.float32)[None, :] + warp
        self.turf = YS < bk
        self.face = (YS >= bk) & (YS < bk + 7)
        beach = (YS >= bk + 7) & (YS < cv)
        self.shingle = beach & (YS < bk + 7 + 30 + warp * 2)
        self.sand = beach & ~self.shingle
        self.flats = (YS >= cv) & (YS < cv + 28 + warp)
        self.water = YS >= cv + 28 + warp
        rough = (fbm(H, W, 14, 56) - 0.5) * 0.9
        pts = (np.hypot((XS - 30) / 80, (YS - 310) / 60) + rough < 1) | \
            (np.hypot((XS - 620) / 70, (YS - 296) / 56) + rough < 1)
        self.points = pts & ~self.turf & (YS > 220)
        for m in (self.shingle, self.sand, self.flats, self.water):
            m &= ~self.points
        ground_turf = self.turf
        I.ground_grass(g, ground_turf, tone, detail, base=5.0)
        I.ground_shingle(g, self.shingle, tone, detail)
        I.ground_sand(g, self.sand, tone, detail)
        I.ground_sand(g, self.flats, tone, detail, wet=True)
        I.ground_weedrock(g, self.points, tone, detail)
        I.cliff_face(g, self.face, np.array([bank(x) for x in range(W)], np.float32),
                     np.array([bank(x) + 7 for x in range(W)], np.float32), seed=57, warm=True)
        # The boatshed plot: a worn rectangle of turf pegged out with a line.
        self.plot = (np.abs(XS - 430) < 70) & (np.abs(YS - 70) < 26)
        worn = self.plot & (value_noise(H, W, 3, 58) > 0.45)
        g[worn] = I.ramp_lookup('earth', 2.4 + (detail[worn] - 0.5) * 1.2)
        path = (np.abs(XS - (300 + (YS - 150) * 0.4) - warp) < 4) & self.turf
        g[path] = I.ramp_lookup('earth', 2.4 + (detail[path] - 0.5) * 1.4)
        self.path = path
        self.ground = g
        self.pools = self.flats & (fbm(H, W, 12, 59) > 0.66)
        self.dshore = I.dist_to(~self.water, 40)
        self.dist = np.clip(self.dshore / 50, 0, 1)
        # Stakes at the plot's corners and along its line; the first timbers laid beside it.
        self.stakes = []
        for (x, y) in ((360, 44), (500, 44), (360, 96), (500, 96), (430, 44), (430, 96)):
            s = Sprite(5, 12, 2, 11)
            for yy in range(1, 11):
                s.px(2, yy, C('driftwood', 4 - (yy > 8) * 2))
                s.px(1, yy, C('driftwood', 3))
            self.stakes.append((s.outline(), x, y))
        self.timbers = Sprite(70, 12, 35, 10)
        for k in range(3):
            for x in range(4, 66):
                for yy in range(2):
                    self.timbers.px(x, 3 + k * 3 + yy, C('driftwood', 5 - yy * 2 - (x % 17 == 0)))
        self.timbers.outline()
        # The line of old stones in the turf, and the fallen boat-hollow with its carved lintel.
        self.oldstones = [(I.boulder(70 + k, rx=4, ry=2.5, base=4.6), 90 + k * 22 + 6 * math.sin(k), 60 + k * 9)
                          for k in range(7)]
        self.hollow = (((XS - 120) / 46) ** 2 + ((YS - 112) / 16) ** 2) < 1
        g[self.hollow] = I.ramp_lookup('grass', 2.6 + (detail[self.hollow] - 0.5) * 1.4)
        self.lining = [(I.boulder(110 + k, rx=3.5, ry=2.4, base=4.2), 120 + 46 * math.cos(a), 112 + 16 * math.sin(a))
                       for k, a in enumerate(np.linspace(0, math.tau, 16, endpoint=False))]
        self.lintel = Sprite(40, 12, 20, 10)
        for x in range(3, 37):
            for yy in range(3, 9):
                self.lintel.px(x, yy, C('stone', 5.2 - (yy - 3) * 0.4 + (x < 6) * 0.6))
        for (x, yy) in [(10, 6), (12, 7), (14, 7), (16, 7), (18, 7), (20, 7), (22, 6), (16, 5), (16, 4), (17, 4)]:
            self.lintel.px(x, yy, C('stone', 2.2))
        self.lintel.outline()
        self.rocks = [(I.boulder(80 + k, rx=8 + k % 3 * 3, ry=6, weed=True), x, y)
                      for k, (x, y) in enumerate(((30, 290), (70, 320), (20, 340), (600, 282), (630, 318), (580, 330)))]
        self.plants = []
        for (x, y, p) in I.scatter(self.turf & ~path, 3800, 15):
            xi, yi = int(x), int(y)
            if self.hollow[yi, xi]:
                continue
            lipz = yi > bank(xi) - 5
            kind = 'thrift' if lipz and p < 0.4 else ('tussock' if p < 0.18 else ('clover' if p < 0.22 else 'grass'))
            self.plants.append((kind, x, y, 3 + p * 4, p))
        for (x, y, p) in I.scatter(self.shingle & (YS < np.array([bank(x) for x in range(W)])[None, :] + 20), 260, 16):
            self.plants.append(('marram', x, y, 7 + p * 4, p))
        self.plants.sort(key=lambda u: u[2])
        sh = np.zeros((H, W), np.float32)
        below = np.roll(self.face, 5, axis=0) & ~self.face
        sh[below] = 0.5
        hol = self.hollow & (YS < 120)
        sh[hol] = np.maximum(sh[hol], 0.6)
        self.static_shadow = sh

    def frame(self, t):
        f = self.ground.copy()
        I.sea(f, t, self.water, self.dist, wind=(0.5, -1.0))
        I.surf(f, t, self.water, self.dshore)
        # The ebb's film over the flats; pools holding the sky.
        reach = 6 + 6 * math.sin(I.ph(t, 2)) ** 2
        df = self._dflat()
        film = self.flats & (df < reach)
        f[film] = f[film] * 0.5 + C('sea', 5) * 0.5
        f[self.flats & (np.abs(df - reach) < 1)] = C('sea', 10)
        I.pool(f, t, self.pools & ~film, sky=3.2)
        shadow = self.static_shadow.copy()
        for (spr, x, y) in self.rocks:
            stamp(f, spr, x, y)
        for (spr, x, y) in self.oldstones + self.lining:
            stamp(f, spr, x, y)
        for (kind, x, y, a, p) in self.plants:
            g = I.gust_at(x, y, t)
            fx.draw_tuft(f, kind, x, y, a, p, t, g)
        stamp(f, self.lintel, 128, 124)
        I.contact(shadow, 128, 124, 18)
        stamp(f, self.timbers, 430, 122)
        I.contact(shadow, 430, 122, 30)
        for (spr, x, y) in self.stakes:
            stamp(f, spr, x, y)
            I.contact(shadow, x, y, 3)
        # The line between the stakes, stirring in the wind.
        for (ax, ay, bx, by) in ((360, 36, 500, 36), (360, 88, 500, 88), (360, 36, 360, 88), (500, 36, 500, 88)):
            n = int(math.hypot(bx - ax, by - ay))
            for k in range(n):
                u = k / n
                sag = 2 * math.sin(math.pi * u) * (1 + 0.5 * fx.loopsin(t, 3, ax * 0.1))
                fx._px(f, ax + (bx - ax) * u, ay + (by - ay) * u + sag, C('wool', 4))
        I.steerer(f, shadow, 300, 132, 's', 'idle', t)
        for j, (x, y) in enumerate(((44, 280), (602, 270), (620, 300))):
            stamp(f, fx.standing_gull(int(t * 1.4 + j) % 3 == 0), x, y)
        stamp(f, fx.cormorant(fx.loopsin(t, 3) > 0), 36, 312)
        for j, (x, y) in enumerate(((260, 330), (380, 344), (470, 320))):
            stamp(f, fx.seal(fx.loopsin(t, 1, j * 2) > 0.1), x + 6 * fx.loopsin(t, 1, j), y)
        gbuf = np.zeros((H, W), np.float32)
        for j, (cx, cy, rad) in enumerate([(200, 200, 60), (420, 230, 50), (330, 60, 40)]):
            a = I.ph(t, 1, j * 2.1)
            fx.draw_gull(f, gbuf, cx + rad * math.cos(a), cy + rad * 0.5 * math.sin(a), 26, t)
        I.spray(f, t, 60, 300, rx=18, n=50, seed=8)
        I.spray(f, t, 590, 296, rx=18, n=50, seed=9)
        I.motes(f, t, 220, 12, region=self.shingle | self.sand, col=C('sand', 6), drift=(1.0, -0.2))
        shadow = np.maximum(shadow, gbuf * 0.5)
        f = I.apply_shadow(f, shadow)
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 640, seed=181)
        return fx.grade(f, cloud * 0.5, warm_sun=0.25)

    def _dflat(self):
        if not hasattr(self, '_df'):
            self._df = I.dist_to(self.water, 40)
        return self._df


if __name__ == '__main__':
    I.save('naust', Naust())

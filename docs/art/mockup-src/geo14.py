"""Gull Geo and the hermit's cell (Stage 14 mockup; Book 9 sections 03 and 05; decisions S14-1,
S14-5 and S14-24), a grey afternoon with a west wind, near low water.

The view from the geo's east rim: the narrow geo cutting in from the north, the swell running up
it and breaking white on its head of shingle; its west wall a tall face of strata with fulmars on
the ledges and the dark mouth of the sea cave low in it, a dry cleft above the storm line across a
gully; heather and thrift on the cliff tops, bending in the wind; the steep path climbing the
east side to the cell, a roofless ring of drystone with its doorway on the east, the burned altar
against its west wall, the cross cut on the slab beside the doorway and the fallen corbel across
the north wall's foot; gulls wheeling over the geo with their shadows; the steerer on the path.

    python3 docs/art/mockup-src/geo14.py      # docs/art/mockups/stage-14/geo.png, -loop.gif
"""
import math
import sys
import os

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import fx  # noqa: E402
import island14 as I  # noqa: E402
from core import C, fbm, rng, stamp, value_noise  # noqa: E402

H, W = I.H, I.W
XS, YS = I.XS, I.YS


def geo_west(y):
    return 150 + 12 * math.sin(y / 37) + 6 * math.sin(y / 11 + 2) - 0.06 * y


def geo_east(y):
    return 250 - 22 * (y / 360) + 9 * math.sin(y / 29 + 1) + 4 * math.sin(y / 7)


def coast(x):
    return 34 + 9 * math.sin(x / 53) + 5 * math.sin(x / 17 + 1)


HEAD = 228          # where the geo's shingle head meets the water


class Geo:
    def __init__(self):
        r = rng(141)
        tone = fbm(H, W, 50, 3)
        detail = fbm(H, W, 9, 4)
        g = np.zeros((H, W, 3), np.float32)
        warp = (fbm(H, W, 16, 9) - 0.5) * 12
        west = np.array([geo_west(y) for y in range(H)], np.float32)[:, None] + warp
        east = np.array([geo_east(y) for y in range(H)], np.float32)[:, None] + warp
        cst = np.array([coast(x) for x in range(W)], np.float32)[None, :] + warp * 0.6
        head = HEAD + warp * 0.8 + 8 * np.cos((XS - 200) / 40)
        self.water = ((XS > west + 24) & (XS < east - 10) & (YS < head)) | (YS < cst)
        self.head = (XS > west + 18) & (XS < east - 4) & (YS >= head) & (YS < head + 34 + warp)
        self.face = (XS > west - 4) & (XS <= west + 24) & (YS < head + 40) & ~self.water & (YS >= cst)
        self.eface = (XS >= east - 10) & (XS < east + 6) & (YS < head + 8) & ~self.water & (YS >= cst)
        self.top = ~(self.water | self.head | self.face | self.eface)
        self.path = np.zeros((H, W), bool)
        pts = [(236, 258), (262, 238), (292, 232), (312, 212), (350, 202), (392, 206), (446, 220)]
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            for k in range(40):
                u = k / 40
                cx, cy = ax + (bx - ax) * u, ay + (by - ay) * u
                self.path |= ((XS - cx) ** 2 + ((YS - cy) * 1.7) ** 2) < 26
        self.path &= self.top | self.head
        I.ground_heather(g, self.top, tone, detail, bloom=0.5)
        grass = self.top & ((fbm(H, W, 30, 21) > 0.6) | (I.dist_to(~self.top, 12) < 5))
        I.ground_grass(g, grass, tone, detail, base=4.4)
        I.ground_shingle(g, self.head, tone, detail)
        top_line = np.zeros(W, np.float32)
        foot = np.full(W, float(HEAD + 40), np.float32)
        I.cliff_face(g, self.face, top_line, foot, seed=31)
        I.cliff_face(g, self.eface, top_line, foot, seed=33, warm=True)
        g[self.path] = I.ramp_lookup('earth', 2.4 + (detail[self.path] - 0.5) * 1.6)
        edge = self.top & (I.dist_to(self.water | self.face | self.eface, 4) < 2)
        g[edge] = I.ramp_lookup('earth', 1.0 + 0 * tone[edge])           # the turf lip's undercut
        self.ground = g
        land = ~self.water
        self.dshore = I.dist_to(land, 40)
        self.dist = np.clip(self.dshore / 40, 0, 1)
        cv = geo_west(156) + 18
        self.cave = (((XS - cv) / 10) ** 2 + ((YS - 160) / 15) ** 2 < 1) & self.face
        self.cleft = (((XS - geo_west(120) - 10) / 5) ** 2 + ((YS - 122) / 3.5) ** 2 < 1) & self.face
        self.grass = grass
        self.plants = []
        for (x, y, p) in I.scatter(self.top & ~self.path, 4600, 5):
            if grass[int(y), int(x)]:
                self.plants.append(('thrift' if p < 0.15 else 'grass', x, y, 3 + p * 3, p))
            else:
                self.plants.append(('heather', x, y, int(p * 9), p))
        for (x, y, p) in I.scatter(self.face & (value_noise(H, W, 3, 7) > 0.62), 80, 6):
            self.plants.append(('thrift', x, y, 3, p))
        self.plants.sort(key=lambda u: u[2])
        self.back, self.front = I.cell_ring()
        self.cell_at = (500, 230)
        self.altar = I.altar()
        self.cross = I.cross_slab()
        self.rocks = []
        for k, (x, y) in enumerate([(geo_west(y) + 26, y) for y in (70, 120, 176, 214)] +
                                   [(geo_east(y) - 12, y) for y in (90, 150, 206)] +
                                   [(60, 30), (300, 24), (420, 36), (560, 28)]):
            self.rocks.append((I.boulder(k, rx=7 + k % 3 * 2, ry=5, weed=True), x, y))
        self.ledges = [(geo_west(y) + 10 + r.uniform(0, 10), y) for y in (66, 92, 112, 138, 190)]
        sh = np.zeros((H, W), np.float32)
        sh = I.cast(sh, self.back, *self.cell_at, length=6)
        under = self.water & (XS < west + 50) & (XS > west + 20)
        sh[under] = np.maximum(sh[under], 0.5)                     # the west wall's shade
        self.static_shadow = sh

    def frame(self, t):
        f = self.ground.copy()
        I.sea(f, t, self.water, self.dist, wind=(0.25, 1.0))
        I.surf(f, t, self.water, self.dshore)
        # The swash on the shingle head: a film of water running up and back, foam at its edge.
        reach = 4 + 5 * math.sin(I.ph(t, 2)) ** 2
        near = self.head & (self._dhead() < reach)
        f[near] = f[near] * 0.5 + C('sea', 5) * 0.5
        f[self.head & (np.abs(self._dhead() - reach) < 1.0)] = C('sea', 10)
        # The sea cave: dark, the swell surging in and out of its mouth; the dry cleft above.
        f[self.cave] = C('ink', 0)
        surge = self.cave & (YS > 166 - 5 * math.sin(I.ph(t, 2)))
        f[surge] = I.ramp_lookup('sea', 3 + (np.sin(XS / 3 + I.ph(t, 4)) > 0.5)[surge] * 3)
        f[self.cleft] = C('ink', 1)
        shadow = self.static_shadow.copy()
        for (spr, x, y) in self.rocks:
            stamp(f, spr, x, y)
        for (kind, x, y, a, p) in self.plants:
            g = I.gust_at(x, y, t)
            if kind == 'heather':
                I.draw_heather(f, x, y, a, p, t, g)
            else:
                fx.draw_tuft(f, kind, x, y, a, p, t, g)
        stamp(f, self.back, *self.cell_at)
        stamp(f, self.altar, self.cell_at[0] - 48, self.cell_at[1] - 32)
        I.steerer(f, shadow, 352, 204, 'e', 'idle', t)
        stamp(f, self.front, *self.cell_at)
        stamp(f, self.cross, self.cell_at[0] + 70, self.cell_at[1] - 12)
        for j, (x, y) in enumerate(self.ledges):
            stamp(f, fx.standing_gull(int(t * 1.3 + j) % 4 == 0), x, y)
        gbuf = np.zeros((H, W), np.float32)
        for j, (cx, cy, rad) in enumerate([(210, 110, 50), (300, 60, 44), (430, 100, 70), (120, 40, 40)]):
            a = I.ph(t, 1, j * 2.2)
            fx.draw_gull(f, gbuf, cx + rad * math.cos(a), cy + rad * 0.45 * math.sin(a), 24, t)
        I.spray(f, t, geo_west(206) + 30, 220, rx=16, n=50, seed=3)
        I.spray(f, t, geo_west(80) + 28, 80, rx=12, n=40, seed=4)
        I.spray(f, t, 300, 30, rx=20, n=40, seed=5)
        I.motes(f, t, 300, 9, region=self.water | self.head, col=C('sea', 10), drift=(1.0, 0.2))
        shadow = np.maximum(shadow, gbuf * 0.5)
        f = I.apply_shadow(f, shadow)
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 640, seed=141)
        return fx.grade(f, cloud * 0.5, warm_sun=0.05)

    def _dhead(self):
        if not hasattr(self, '_dh'):
            self._dh = I.dist_to(self.water, 20)
        return self._dh


if __name__ == '__main__':
    I.save('geo', Geo())

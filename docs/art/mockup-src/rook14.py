"""Rook Hill and Kelda's upper stream (Stage 14 mockup; Book 9 sections 03 and 05; decisions
S14-1, S14-5 and S14-24), a summer afternoon with the heather in flower and a breeze from the
south-west.

Looking north up the hill: the heather slopes in purple drifts with bracken in the hollows and
hares sitting in their forms; the upper stream coming down from its spring line under the summit
to the lip of the high ground, where it falls as a waterfall (the lip, the white falling sheet,
spray and a churned pool), a dark dry ledge showing behind the sheet; below, the stream runs on
south over the grass towards the Kelda, foam at its stones; up on the summit the watch cairn's
plot marked out in stones, and on the summit's lee the hermit's prayer stone over its cist; bees
over the heather, a raven, a buzzard's shadow; the steerer by the pool.

    python3 docs/art/mockup-src/rook14.py
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
FALL_X = 318


def lip(x):
    return 168 + 14 * math.sin(x / 71) + 5 * math.sin(x / 23 + 1)


def course(y):
    """The stream's centre line, top to bottom."""
    if y < lip(FALL_X):
        return FALL_X + 30 * math.sin((y + 40) / 60) + 8 * math.sin(y / 17)
    return FALL_X - 6 + 26 * math.sin((y - 190) / 70) + 6 * math.sin(y / 13)


class Rook:
    def __init__(self):
        r = rng(161)
        tone = fbm(H, W, 50, 33)
        detail = fbm(H, W, 9, 34)
        g = np.zeros((H, W, 3), np.float32)
        warp = (fbm(H, W, 18, 35) - 0.5) * 6
        lp = np.array([lip(x) for x in range(W)], np.float32)[None, :] + warp
        cx = np.array([course(y) for y in range(H)], np.float32)[:, None]
        width = np.where(YS < lp, 7.0, 9.5)
        self.water = (np.abs(XS - cx - warp) < width / 2) & (YS > 24)
        broken = fbm(H, W, 40, 38) > 0.38
        self.face = (YS >= lp) & (YS < lp + 26) & ~((np.abs(XS - FALL_X) < 16)) & broken
        self.pool = (((XS - FALL_X) / 30) ** 2 + ((YS - (lip(FALL_X) + 40)) / 14) ** 2) < 1
        self.fallzone = (np.abs(XS - FALL_X) < 16) & (YS >= lp) & (YS < lp + 26)
        self.water |= self.pool
        self.high = YS < lp
        self.low = (YS >= lp) & ~self.pool & ~self.face & ~self.fallzone
        summit = (((XS - 500) / 120) ** 2 + ((YS - 36) / 50) ** 2) < 1
        I.ground_heather(g, self.high, tone, detail, bloom=1.0)
        I.ground_heather(g, self.low & (YS < 290), tone, detail, bloom=0.8)
        grass = (self.low & (YS >= 270 + warp * 3)) | (summit & (fbm(H, W, 20, 36) > 0.45))
        I.ground_grass(g, grass, tone, detail, base=4.8)
        bracken = self.low & ~grass & (fbm(H, W, 26, 37) > 0.62)
        g[bracken] = I.ramp_lookup('fern', 2.0 + (detail[bracken] - 0.5) * 2)
        # The high ground's lip: a face of rock and peat, broken where the stream falls.
        I.cliff_face(g, self.face, lp[0] * 0 + np.array([lip(x) for x in range(W)], np.float32),
                     np.array([lip(x) + 22 for x in range(W)], np.float32), seed=41, warm=True)
        I.cliff_face(g, self.fallzone, np.array([lip(x) for x in range(W)], np.float32),
                     np.array([lip(x) + 22 for x in range(W)], np.float32), seed=43)
        g[self.face] = g[self.face] * 0.62 + C('earth', 1) * 0.12
        lipm = (YS >= lp - 2) & (YS < lp + 2) & (self.face | self.fallzone)
        g[lipm] = I.ramp_lookup('weld', 1.2 + detail[lipm])
        bed = self.water
        g[bed] = I.ramp_lookup('stone', 2.4 + (detail[bed] > 0.6) * 1.4)
        self.ground = g
        self.grass = grass
        self.bank = I.dist_to(~self.water, 8)
        # The watch cairn's plot on the summit: a ring of marker stones and a few stakes.
        self.plot = []
        for k in range(14):
            a = k / 14 * math.tau
            self.plot.append((I.boulder(40 + k, rx=3, ry=2.2, base=4.2), 520 + 34 * math.cos(a), 40 + 15 * math.sin(a)))
        self.prayer = I.standing_stone(7, cup=False)
        self.cap = I.boulder(90, rx=9, ry=4, base=4.8)
        self.plants = []
        for (x, y, p) in I.scatter(~self.water & ~self.face & ~self.fallzone, 5200, 12):
            xi, yi = int(x), int(y)
            if grass[yi, xi]:
                self.plants.append(('clover' if p < 0.07 else 'grass', x, y, 3 + p * 3, p))
            elif bracken[yi, xi]:
                self.plants.append(('bracken', x, y, 0, p))
            else:
                self.plants.append(('heather', x, y, int(p * 9), p))
        for (x, y, p) in I.scatter(self.face, 60, 13):
            self.plants.append(('grass', x, y, 3, p))
        self.plants.sort(key=lambda u: u[2])
        self.hares = [(150, 120), (430, 230), (560, 140)]
        self.stones = [(I.boulder(60 + k, rx=4 + k % 3, ry=3, weed=False, base=3.6), course(y) + d, y)
                       for k, (y, d) in enumerate(((60, 2), (110, -3), (226, 4), (262, -6), (300, 3), (340, -2)))]
        self.shadow = np.zeros((H, W), np.float32)
        below = np.roll(self.face, 6, axis=0) & ~self.face
        self.shadow[below] = 0.5

    def frame(self, t):
        f = self.ground.copy()
        I.stream(f, t, self.water & ~self.pool & (YS < lip(FALL_X)), flow=(0.2, 1.0), bank=self.bank)
        I.stream(f, t, self.water & ~self.pool & (YS > lip(FALL_X)), flow=(-0.1, 1.0), bank=self.bank, speed=30)
        # The churned pool: white water under the fall, rings spreading to its calmer edge.
        I.pool(f, t, self.pool, sky=1.4, peat=True)
        py = lip(FALL_X) + 40
        d = np.hypot((XS - FALL_X) / 30, (YS - py) / 14)
        churn = self.pool & (d < 0.42 + 0.08 * np.sin(I.ph(t, 6) + XS / 3)) & \
            (value_noise(H, W, 2, 50 + int(t * 6) % 9) > 0.55) & (YS < py)
        f[churn] = C('sea', 10)
        rings = self.pool & (np.abs(np.sin(d * 9 - I.ph(t, 5))) < 0.18) & (d > 0.5)
        f[rings] = C('sea', 8)
        shadow = self.shadow.copy()
        # Behind the sheet: the dark of the dry ledge.
        for y in range(int(lip(FALL_X)), int(lip(FALL_X) + 26)):
            for x in range(FALL_X - 15, FALL_X + 15):
                f[y, x] = C('ink', 1) if abs(x - FALL_X) < 13 else C('stone', 1.5)
        I.waterfall_sheet(f, t, FALL_X - 11, FALL_X + 9, lip(FALL_X) - 2, lip(FALL_X) + 30)
        I.spray(f, t, FALL_X, py - 4, rx=20, n=90, seed=7)
        for (spr, x, y) in self.stones:
            stamp(f, spr, x, y)
        for (spr, x, y) in self.plot:
            stamp(f, spr, x, y)
        for (kind, x, y, a, p) in self.plants:
            g = I.gust_at(x, y, t, speed=0.8)
            if kind == 'heather':
                I.draw_heather(f, x, y, a, p, t, g)
            elif kind == 'bracken':
                I.draw_bracken(f, x, y, p, t, g)
            else:
                fx.draw_tuft(f, kind, x, y, a, p, t, g)
        stamp(f, self.prayer, 420, 92)
        stamp(f, self.cap, 438, 96)
        I.contact(shadow, 420, 92, 8)
        for j, (x, y) in enumerate(self.hares):
            stamp(f, I.hare(int(t * 1.6 + j) % 5 == 0), x, y)
            I.contact(shadow, x, y, 6)
        I.steerer(f, shadow, FALL_X + 46, int(lip(FALL_X) + 56), 'w', 'idle', t)
        for j in range(14):
            fx.insect(f, 80 + j * 40, 60 + (j * 53) % 220, t, j, 'bee' if j % 3 else 'butterfly')
        gbuf = np.zeros((H, W), np.float32)
        a = I.ph(t, 1)
        rx, ry = 300 + 200 * math.cos(a), 140 + 60 * math.sin(a)
        stamp(f, I.eagle(int(t * 2) % 4), rx, ry)       # a buzzard over the hill
        I.contact(gbuf, rx + 30, ry + 36, 8, 3, 0.5)
        shadow = np.maximum(shadow, gbuf)
        f = I.apply_shadow(f, shadow)
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 640, seed=161)
        return fx.grade(f, cloud * 0.5, warm_sun=0.2)


if __name__ == '__main__':
    I.save('rook', Rook())

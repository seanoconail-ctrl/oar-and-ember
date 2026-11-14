"""The Skerry of the Drowned and its causeway at a spring low tide (Stage 14 mockup; Book 9
sections 03 and 05; decisions S14-1, S14-5, S14-18 and S14-24), a cold grey evening, still air.

From the east shore's turf above the rocky coast: the causeway of weed-covered boulders showing
from the shore out to the skerry, the low black rock, with the flats and pools bare on either side
at the bottom of the spring tide and the sea breathing at their edges; seals hauled out on the
skerry; and on the skerry the drowned, standing still and dripping though the tide is out (Book 7
section 09), drawn small and colder than the living. The crack at the causeway's shore end, where
a gold ring catches the light. Gulls, an oystercatcher, the steerer at the causeway's start.

    python3 docs/art/mockup-src/skerry14.py
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import fx  # noqa: E402
import island14 as I  # noqa: E402
from core import C, fbm, rng, stamp, value_noise  # noqa: E402

H, W = I.H, I.W
XS, YS = I.XS, I.YS


def shore(y):
    return 170 - 0.5 * y + 14 * math.sin(y / 41) + 6 * math.sin(y / 13)


def causeway(u):
    """The causeway's line from the shore end (u=0) to the skerry (u=1)."""
    return 150 + 330 * u + 10 * math.sin(u * 7), 120 + 170 * u + 12 * math.sin(u * 5 + 1)


class Skerry:
    def __init__(self):
        r = rng(191)
        tone = fbm(H, W, 50, 63)
        detail = fbm(H, W, 9, 64)
        g = np.zeros((H, W, 3), np.float32)
        warp = (fbm(H, W, 18, 65) - 0.5) * 10
        sh = np.array([shore(y) for y in range(H)], np.float32)[:, None] + warp
        self.turf = XS < sh - 30
        self.coast = (XS >= sh - 30) & (XS < sh)
        dc = np.full((H, W), 99.0, np.float32)
        for k in range(60):
            cx, cy = causeway(k / 59)
            dc = np.minimum(dc, np.hypot(XS - cx, (YS - cy) * 1.2))
        self.dc = dc
        sk = np.hypot((XS - 520) / 80, (YS - 300) / 40) + (fbm(H, W, 12, 66) - 0.5) * 0.5 < 1
        self.skerry = sk
        self.flats = ~self.turf & ~self.coast & ~sk & ((dc < 70 + warp * 3) | (np.hypot((XS - 520) / 120, (YS - 300) / 64) < 1))
        self.water = ~(self.turf | self.coast | sk | self.flats)
        I.ground_grass(g, self.turf, tone, detail, base=4.4)
        I.ground_weedrock(g, self.coast, tone, detail)
        I.ground_sand(g, self.flats, tone, detail, wet=True)
        weed = self.flats & (fbm(H, W, 7, 67) > 0.58)
        g[weed] = I.ramp_lookup('kelp', 2.2 + (detail[weed] - 0.5) * 2)
        I.ground_weedrock(g, sk, tone, detail)
        top = sk & (np.hypot((XS - 520) / 60, (YS - 296) / 26) < 1)
        g[top] = I.ramp_lookup('stone', 2.2 + (detail[top] - 0.5) * 1.6)
        self.ground = g
        self.pools = self.flats & (fbm(H, W, 12, 68) > 0.7) & (dc > 18)
        self.dshore = I.dist_to(~self.water, 40)
        self.dist = np.clip(self.dshore / 60, 0, 1)
        # The causeway's boulders, weed-hung, from the shore end out to the skerry.
        self.boulders = []
        n = 26
        for k in range(n):
            cx, cy = causeway(k / (n - 1))
            cx += r.uniform(-5, 5)
            cy += r.uniform(-3, 3)
            self.boulders.append((cy, I.boulder(200 + k, rx=10 + r.uniform(0, 5), ry=7, base=3.2, weed=True), cx, cy))
        for k in range(18):
            x = shore(30 + k * 18) - r.uniform(0, 26)
            y = 30 + k * 18
            self.boulders.append((y, I.boulder(260 + k, rx=8 + r.uniform(0, 5), ry=6, base=3.0, weed=True), x, y))
        self.boulders.sort(key=lambda u: u[0])
        self.plants = []
        for (x, y, p) in I.scatter(self.turf, 2400, 17):
            kind = 'thrift' if p < 0.2 else ('tussock' if p < 0.3 else 'grass')
            self.plants.append((kind, x, y, 3 + p * 3, p))
        self.plants.sort(key=lambda u: u[2])
        self.drowned = [(500, 286), (520, 290), (544, 284), (562, 292), (488, 296)]
        self.seals = [(470, 312), (590, 308)]

    def frame(self, t):
        f = self.ground.copy()
        I.sea(f, t, self.water, self.dist, wind=(0.3, 1.0), calm=0.6)
        I.surf(f, t, self.water, self.dshore)
        reach = 5 + 6 * math.sin(I.ph(t, 2)) ** 2
        df = self._df()
        film = self.flats & (df < reach)
        f[film] = f[film] * 0.5 + C('sea', 5) * 0.5
        f[self.flats & (np.abs(df - reach) < 1)] = C('sea', 10)
        I.pool(f, t, self.pools & ~film, sky=1.4)
        shadow = np.zeros((H, W), np.float32)
        for (_, spr, x, y) in self.boulders:
            stamp(f, spr, x, y)
            I.contact(shadow, x, y + 2, 7, 2, 0.4)
        for (kind, x, y, a, p) in self.plants:
            g = I.gust_at(x, y, t, speed=0.5) * 0.6
            fx.draw_tuft(f, kind, x, y, a, p, t, g)
        # The gold ring in the crack at the causeway's shore end: a glint now and then.
        if int(t * 2.5) % 4 == 0:
            fx._px(f, 136, 116, C('trefoil', 4))
            fx._px(f, 137, 116, C('trefoil', 3))
        for j, (x, y) in enumerate(self.seals):
            stamp(f, fx.seal(fx.loopsin(t, 1, j * 1.7) > 0.3), x, y)
        # The drowned: still, dripping, a ring of wet round each on the dry rock.
        for j, (x, y) in enumerate(self.drowned):
            for a in range(0, 360, 30):
                rr = 4 + (t * 3 + j) % 4
                fx._px(f, x + math.cos(math.radians(a)) * rr, y + math.sin(math.radians(a)) * rr * 0.4, C('sea', 6))
            spr = I.drowned_figure(j, t, j * 0.3)
            stamp(f, spr, x, y)
            I.contact(shadow, x, y, 5)
        I.steerer(f, shadow, 128, 132, 'e', 'idle', t)
        stamp(f, I.lapwing(int(t * 3) % 2), 300 + 20 * fx.loopsin(t, 1), 200)
        gbuf = np.zeros((H, W), np.float32)
        for j, (cx, cy, rad) in enumerate([(380, 120, 70), (560, 200, 40), (250, 300, 50)]):
            a = I.ph(t, 1, j * 2.1)
            fx.draw_gull(f, gbuf, cx + rad * math.cos(a), cy + rad * 0.5 * math.sin(a), 24, t)
        I.motes(f, t, 260, 14, region=self.flats | self.water, col=C('sky', 5), drift=(0.6, 0.1))
        shadow = np.maximum(shadow, gbuf * 0.5)
        f = I.apply_shadow(f, shadow)
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 640, seed=191)
        return fx.grade(f, cloud * 0.4, warm_sun=0.0, cool=(0.76, 0.8, 0.94), desat=0.3)

    def _df(self):
        if not hasattr(self, '_d'):
            self._d = I.dist_to(self.water, 40)
        return self._d


if __name__ == '__main__':
    I.save('skerry', Skerry())

"""The peat bog and the Grey Men (Stage 14 mockup; Book 9 sections 03 and 05; decisions S14-1,
S14-5, S14-11 and S14-24), early summer, grey and still after rain, a light air from the west.

The bog's south: banks of peat with their cut faces dark and wet and the spade's marks in them,
turves stacked to dry along their tops; knee-deep pools between them holding the grey sky,
ripples running across them; bog cotton nodding round the pools, heather on the hummocks and
sphagnum bright in the wet; on the drier rise to the north-west the Grey Men, nine weathered
stones in a ring, the tallest on its east side, the low cup-and-ring stone on its north-west;
midges over the pools, a curlew, meadow pipits; the steerer at a bank with a peat spade.

    python3 docs/art/mockup-src/bog14.py
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
RING = (196, 118)


def bank_line(k, x):
    return 196 + k * 56 + 10 * math.sin(x / 57 + k * 1.7) + 4 * math.sin(x / 19 + k)


class Bog:
    def __init__(self):
        r = rng(171)
        tone = fbm(H, W, 50, 43)
        detail = fbm(H, W, 9, 44)
        g = np.zeros((H, W, 3), np.float32)
        warp = (fbm(H, W, 18, 45) - 0.5) * 8
        self.faces = np.zeros((H, W), bool)
        self.tops = []
        for k in range(3):
            bl = np.array([bank_line(k, x) for x in range(W)], np.float32)[None, :] + warp
            span = (XS > 40 + k * 70 + warp * 3) & (XS < 600 - k * 40 + warp * 3)
            face = (YS >= bl) & (YS < bl + 14) & span
            self.faces |= face
            self.tops.append(np.array([bank_line(k, x) for x in range(W)], np.float32))
        wet = fbm(H, W, 34, 46)
        self.pools = (wet > 0.64) & ~self.faces & (YS > 150)
        self.pools |= (((XS - 470) / 50) ** 2 + ((YS - 120) / 16) ** 2 < 1) & (wet > 0.4)
        dry = (np.hypot((XS - RING[0]) / 170, (YS - RING[1]) / 86) + (fbm(H, W, 24, 52) - 0.5) * 0.6 < 1) & (YS < 200)
        self.peat = ~dry & ~self.pools & ~self.faces
        I.ground_heather(g, dry, tone, detail, bloom=0.0)
        grass = dry & (fbm(H, W, 22, 47) > 0.5)
        I.ground_grass(g, grass, tone, detail, base=4.2)
        I.ground_peat(g, self.peat, tone, detail, wet=True)
        moss = self.peat & (I.dist_to(self.pools, 10) < 6) & (detail > 0.45)
        g[moss] = I.ramp_lookup('moss', 4.5 + (tone[moss] - 0.5) * 2)
        hum = self.peat & (fbm(H, W, 12, 48) > 0.6)
        g[hum] = I.ramp_lookup('weld', 2.2 + (detail[hum] - 0.5) * 1.6)
        for k in range(3):
            I.peat_face(g, self.faces & (np.abs(YS - self.tops[k][None, :] - 7) < 9), self.tops[k], seed=50 + k)
        self.ground = g
        self.hum = hum
        self.dry = dry
        # The Grey Men: nine stones round the ring's centre, the tallest east, the cup-and-ring
        # stone low on the north-west.
        self.stones = []
        for k in range(9):
            a = k / 9 * math.tau
            x = RING[0] + 92 * math.cos(a)
            y = RING[1] + 40 * math.sin(a)
            tall = k == 0
            cup = abs(a - 3.93) < 0.4
            self.stones.append((y, I.standing_stone(k, tall=tall, cup=cup), x, y))
        # Turves stacked to dry on the bank tops.
        self.stacks = []
        for k, (x, b) in enumerate(((150, 0), (300, 0), (420, 1), (520, 1), (260, 2))):
            s = Sprite(16, 12, 8, 11)
            for j, (dx, dy) in enumerate(((-4, 0), (0, 0), (4, 0), (-2, -3), (2, -3), (0, -6))):
                for yy in range(3):
                    for xx in range(4):
                        s.px(8 + dx - 2 + xx, 8 + dy + yy, C('tar', 3 - yy * 0.6 + (xx == 0) * 0.6))
            self.stacks.append((s.outline(), x, bank_line(b, x) - 3))
        self.plants = []
        dpool = I.dist_to(self.pools, 20)
        for (x, y, p) in I.scatter(~self.faces & ~self.pools, 4600, 14):
            xi, yi = int(x), int(y)
            near_pool = dpool[yi, xi] < 12
            if dry[yi, xi]:
                self.plants.append(('grass' if grass[yi, xi] else 'heather', x, y, int(p * 9) if not grass[yi, xi] else 3 + p * 2, p))
            elif hum[yi, xi]:
                self.plants.append(('heather', x, y, int(p * 9), p))
            elif near_pool and p < 0.7:
                self.plants.append(('cotton', x, y, 0, p))
            else:
                self.plants.append(('grass', x, y, 3 + p * 3, p))
        self.plants.sort(key=lambda u: u[2])
        sh = np.zeros((H, W), np.float32)
        for (_, spr, x, y) in self.stones:
            sh = I.cast(sh, spr, x, y, length=7, v=0.8)
        below = np.roll(self.faces, 4, axis=0) & ~self.faces
        sh[below] = np.maximum(sh[below], 0.5)
        self.static_shadow = sh

    def frame(self, t):
        f = self.ground.copy()
        I.pool(f, t, self.pools, sky=1.8, peat=True)
        edge = self.pools & (I.dist_to(~self.pools, 3) < 2) if not hasattr(self, '_edge') else self._edge
        self._edge = edge
        f[edge] = f[edge] * 0.6 + C('tar', 1) * 0.4
        shadow = self.static_shadow.copy()
        for (spr, x, y) in self.stacks:
            stamp(f, spr, x, y)
            I.contact(shadow, x, y, 7)
        items = [(y, 'stone', spr, x) for (y, spr, x, _) in self.stones]
        for (kind, x, y, a, p) in self.plants:
            g = I.gust_at(x, y, t, speed=0.6) * 0.8
            if kind == 'heather':
                I.draw_heather(f, x, y, a, p, t, g, bloom=False)
            elif kind == 'cotton':
                I.draw_cotton(f, x, y, p, t, g)
            else:
                fx.draw_tuft(f, kind, x, y, a, p, t, g)
        for (y, _, spr, x) in sorted(items, key=lambda u: u[0]):
            stamp(f, spr, x, y)
            I.contact(shadow, x, y, 7)
        I.steerer(f, shadow, 380, int(bank_line(1, 380) - 6), 's', 'idle', t)
        # Midges in clouds over the pools, a curlew walking, pipits flitting over the heather.
        for j in range(22):
            cx = 120 + (j * 97) % 460
            cy = 170 + (j * 61) % 170
            for k in range(6):
                fx.insect(f, cx + k * 2, cy + k, t, j * 7 + k, 'midge')
        cx = 520 + 18 * fx.loopsin(t, 1)
        stamp(f, I.lapwing(int(t * 2) % 2), cx, 300)
        for j in range(5):
            a = I.ph(t, 2, j)
            fx._px(f, 80 + j * 110 + 20 * math.cos(a), 60 + 10 * math.sin(a * 2), C('bracken', 2))
            fx._px(f, 81 + j * 110 + 20 * math.cos(a), 60 + 10 * math.sin(a * 2), C('bracken', 3))
        f = I.apply_shadow(f, shadow)
        # A low mist lying over the pools, drifting east.
        mist = (fbm(H, W, 40, 49, 2) > 0.55)
        drift = int(t / I.LOOP * 640) % 640
        mist = np.roll(mist, drift, axis=1) & (YS > 150)
        dither = (value_noise(H, W, 1, 3) > 0.5)
        f[mist & dither] = f[mist & dither] * 0.82 + C('sky', 4) * 0.18
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 640, seed=171)
        return fx.grade(f, cloud * 0.35, warm_sun=0.0, desat=0.28)


if __name__ == '__main__':
    I.save('bog', Bog())

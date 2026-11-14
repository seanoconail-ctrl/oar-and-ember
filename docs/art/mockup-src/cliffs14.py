"""The west cliffs and the eagle stack (Stage 14 mockup; Book 9 sections 03 and 05; decisions
S14-1, S14-5 and S14-24), a bright cold morning in late spring with a west wind off the sea.

From the cliff path along the top: the heather and the cliff-top flowers bending in the wind, the
path worn along the edge; the face going down in strata to the surf, the egg ledges lit across it
with guillemots and kittiwakes in rows and white with their droppings; three marked climbing
routes down to the ledges, their hand-holds cut and drawn, each with a waymark at its top and a
ledge to rest on part way; offshore the eagle stack, its eyrie of sticks on the grassy top and the
sea eagle on it, the other circling; the swell rolling in from the west and bursting at the foot.

    python3 docs/art/mockup-src/cliffs14.py
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import fx  # noqa: E402
import island14 as I  # noqa: E402
from core import C, Sprite, fbm, rng, stamp, stone, value_noise  # noqa: E402

H, W = I.H, I.W
XS, YS = I.XS, I.YS


def foot(y):
    return 214 + 18 * math.sin(y / 61) + 7 * math.sin(y / 19 + 1)


def lip(y):
    return foot(y) + 92 + 10 * math.sin(y / 43 + 2) + 4 * math.sin(y / 9)


ROUTES = [  # (x at the top, y at the top, ...): the three marked climbs, foot to top
    [(0, 64), (-10, 50), (-26, 44), (-40, 34), (-58, 30), (-74, 24), (-86, 20)],
    [(0, 170), (-12, 160), (-30, 156), (-44, 146), (-60, 140), (-78, 132)],
    [(0, 280), (-14, 270), (-30, 266), (-44, 256), (-62, 252), (-80, 244)],
]


class Cliffs:
    def __init__(self):
        r = rng(151)
        tone = fbm(H, W, 50, 13)
        detail = fbm(H, W, 9, 14)
        g = np.zeros((H, W, 3), np.float32)
        warp = (fbm(H, W, 18, 19) - 0.5) * 10
        ft = np.array([foot(y) for y in range(H)], np.float32)[:, None] + warp
        lp = np.array([lip(y) for y in range(H)], np.float32)[:, None] + warp * 0.6
        self.water = XS < ft
        self.face = (XS >= ft) & (XS < lp)
        self.top = XS >= lp
        stack = (((XS - 84) / 40) ** 2 + ((YS - 126) / 34) ** 2) < 1
        self.stacktop = (((XS - 84) / 34) ** 2 + ((YS - 108) / 18) ** 2) < 1
        self.stackface = stack & ~self.stacktop & (YS > 104)
        self.water &= ~(self.stacktop | self.stackface)
        I.ground_heather(g, self.top, tone, detail, bloom=0.0)
        edge = self.top & (XS < lp + 30 + warp)
        I.ground_grass(g, edge, tone, detail, base=4.8)
        # The face, seen across: strata running along it, lit ledges, guano, the wet foot.
        self.rel = np.clip((XS - ft) / np.maximum(1, lp - ft), 0, 1)
        strata = fbm(H, W, 12, 23, 2)
        band = np.floor((XS * 0.25 + YS * 0.9 + strata * 10) / 7)
        col = I.ramp_lookup('stone', 3.4 + self.rel * 1.8 + (band % 2) * 0.7 - (band % 3 == 0) * 0.6)
        crack = value_noise(H, W, 2, 25) > 0.84
        col[crack] = C('stone', 1.2)
        self.ledge = self.face & ((XS * 0.25 + YS * 0.9 + strata * 10) % 7 < 1.6) & (band % 2 == 1) & \
            (self.rel > 0.2) & (self.rel < 0.85)
        col[self.ledge] = C('stone', 6.4)
        guano = self.face & (np.roll(self.ledge, 1, axis=1) | np.roll(self.ledge, 2, axis=1)) & \
            (value_noise(H, W, 2, 26) > 0.35)
        col[guano] = C('wool', 5.6)
        lichen = self.face & (self.rel > 0.6) & (value_noise(H, W, 3, 27) > 0.72)
        col[lichen] = C('trefoil', 1.4)
        wetfoot = self.face & (self.rel < 0.08)
        col[wetfoot] = I.ramp_lookup('kelp', 1.2 + strata[wetfoot] * 2)
        lipline = self.face & (self.rel > 0.95)
        col[lipline] = C('earth', 1.0)
        g[self.face] = col[self.face]
        # The stack: its own face and its grassy top.
        sc = I.ramp_lookup('stone', 3.0 + (YS - 104) / 40 * -1.5 + (np.floor((YS + strata * 4) / 4) % 2) * 0.7)
        g[self.stackface] = sc[self.stackface]
        I.ground_grass(g, self.stacktop, tone, detail, base=5.2)
        # The cliff path, worn along the top a little in from the edge.
        path = self.top & (np.abs(XS - (lp + 46 + warp * 0.5)) < 5)
        g[path] = I.ramp_lookup('earth', 2.6 + (detail[path] - 0.5) * 1.6)
        self.path = path
        self.ground = g
        self.dshore = I.dist_to(~self.water, 40)
        self.dist = np.clip(self.dshore / 40, 0, 1)
        self.plants = []
        for (x, y, p) in I.scatter(self.top & ~path, 4200, 7):
            if edge[int(y), int(x)]:
                kind = 'thrift' if p < 0.35 else ('trefoil' if p < 0.45 else 'grass')
                self.plants.append((kind, x, y, 3 + p * 3, p))
            else:
                self.plants.append(('heather', x, y, int(p * 9), p))
        for (x, y, p) in I.scatter(self.stacktop, 120, 8):
            self.plants.append(('grass', x, y, 3 + p * 2, p))
        for (x, y, p) in I.scatter(self.face & (value_noise(H, W, 3, 9) > 0.66), 70, 9):
            self.plants.append(('thrift', x, y, 3, p))
        self.plants.sort(key=lambda u: u[2])
        # The routes' hand-holds, cut steps lit on top, dark below; the rest ledge part way.
        self.holds = []
        for k, route in enumerate(ROUTES):
            y0 = route[0][1]
            x0 = lip(y0) + 2
            for j, (dx, y) in enumerate(route):
                for s in range(3):
                    hx = x0 + dx + s * 3 - 3
                    hy = y + s * 2 - 2
                    self.holds.append((hx, hy))
        self.marks = [(lip(rt[0][1]) + 10, rt[0][1] + 4) for rt in ROUTES]
        self.birds = [(x, y) for (x, y, _) in I.scatter(self.ledge, 70, 10)]
        self.eyrie = I.eyrie()
        self.rocks = [(I.boulder(k, rx=6 + k % 3 * 3, ry=5, weed=True), foot(y) + r.uniform(-14, 2), y)
                      for k, y in enumerate((30, 96, 150, 196, 240, 300, 338))]
        self.static_shadow = np.zeros((H, W), np.float32)
        sh = self.water & (XS > np.array([foot(y) for y in range(H)])[:, None] - 30)
        self.static_shadow[sh] = 0.35

    def frame(self, t):
        f = self.ground.copy()
        I.sea(f, t, self.water, self.dist, wind=(1.0, 0.25))
        I.surf(f, t, self.water, self.dshore)
        shadow = self.static_shadow.copy()
        for (spr, x, y) in self.rocks:
            stamp(f, spr, x, y)
        for (hx, hy) in self.holds:
            for dx in (0, 1, 2):
                fx._px(f, hx + dx, hy, C('stone', 8.5 - dx * 0.5))
                fx._px(f, hx + dx, hy + 1, C('stone', 6))
                fx._px(f, hx + dx, hy + 2, C('ink', 1))
        for (x, y) in self.marks:
            m = Sprite(8, 10, 4, 9)
            for k, (yy, w) in enumerate(((8, 3), (6, 3), (4, 2), (2, 1))):
                for dx in range(-w, w + 1):
                    m.px(4 + dx, yy, C('stone', 6 - k * 0.4 - (dx < 0) * 0.8))
                    m.px(4 + dx, yy + 1, C('stone', 4 - k * 0.4))
            stamp(f, m.outline(), x, y)
            I.contact(shadow, x, y, 4)
        # Guillemots and kittiwakes in rows on the ledges, shuffling, heads turning.
        for j, (x, y) in enumerate(self.birds):
            b = fx.standing_gull(int(t * 2 + j * 0.37) % 3 == 0)
            if j % 3:
                # Guillemots: dark backs, white fronts.
                top = np.zeros_like(b.mask)
                top[:6] = True
                b.rgb[b.mask & top] = C('seal', 1)
            stamp(f, b, x + (int(t * 3 + j) % 7 == 0), y)
        for (kind, x, y, a, p) in self.plants:
            g = I.gust_at(x, y, t)
            if kind == 'heather':
                I.draw_heather(f, x, y, a, p, t, g, bloom=False)
            else:
                fx.draw_tuft(f, kind, x, y, a, p, t, g)
        stamp(f, self.eyrie, 84, 106)
        stamp(f, I.eagle(int(t * 0.8) % 2, perched=True), 80, 100)
        I.steerer(f, shadow, int(lip(200) + 48), 200, 'n', 'idle', t)
        gbuf = np.zeros((H, W), np.float32)
        a = I.ph(t, 1)
        stamp(f, I.eagle(int(t * 3) % 4), 160 + 70 * math.cos(a), 110 + 34 * math.sin(a))
        for j, (cx, cy, rad) in enumerate([(240, 60, 40), (250, 290, 50), (130, 250, 36), (330, 160, 30)]):
            aa = I.ph(t, 2, j * 1.7)
            fx.draw_gull(f, gbuf, cx + rad * math.cos(aa), cy + rad * 0.5 * math.sin(aa), 22, t)
        for j, y in enumerate((40, 120, 200, 280, 330)):
            I.spray(f, t, foot(y) - 4, y + 6, rx=18, n=45, seed=20 + j)
        I.spray(f, t, 50, 134, rx=16, n=40, seed=31)
        I.motes(f, t, 260, 11, region=self.water, col=C('sea', 10), drift=(1.0, 0.1))
        shadow = np.maximum(shadow, gbuf * 0.5)
        f = I.apply_shadow(f, shadow)
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 640, seed=151)
        return fx.grade(f, cloud * 0.4, warm_sun=0.12)


if __name__ == '__main__':
    I.save('cliffs', Cliffs())

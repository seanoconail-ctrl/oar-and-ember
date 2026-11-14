"""The two interiors of Stage 14 (mockups; Book 9 sections 09 and 16; decisions S14-8 to S14-10,
S14-22 and S14-24), each painted tile for tile from its Book 9 grid, so the mockup is the plan:

- deep.png: the Seal Cave's deep passage on a spring low, open: the knee-deep pool running east
  to the way in, the mid chamber's bank of dry rock, the alcove with the man on the waves cut in
  its wall, the crawl under its fallen slab, the fallen kerb-stone in the wide way's doorway and
  its slot; the weed line along both walls at the height the water comes to; drips ringing in the
  pools, the light thrown off the water dancing on the walls, a damp haze moving on the draught.
- cairn_in.png: the Hollow Cairn's inside in Year 1, the festival morning the door opened: the low
  sun lying along the outer passage from the east door, dust turning in it; the grave cells off
  the passage with their goods, the carvings that seem to listen; the great chamber whole and
  dark beyond, the Door of Three Truths closed at the far end.

    python3 docs/art/mockup-src/interiors14.py
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import fx  # noqa: E402
import island14 as I  # noqa: E402
from core import C, Sprite, banded, bayer, blur, fbm, hash01, rng, stamp, value_noise  # noqa: E402

H, W = I.H, I.W
XS, YS = I.XS, I.YS
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
T = 24


def grid(name):
    rows = []
    for line in open(os.path.join(ROOT, 'docs', 'levels', name), encoding='utf8'):
        parts = line.rstrip('\n').split(' ', 3)
        if len(line) > 4 and line[:3].strip().isdigit():
            rows.append(line.rstrip('\n')[4:])
    return rows


class Interior:
    """Paints an interior from its grid: `floor` is the set of grid characters that are floor,
    `water` those under water; the view's top-left tile is (tx, ty)."""

    def __init__(self, rows, tx, ty, floor, water, seed, wall_ramp='stone'):
        self.rows = rows
        ch = np.full((H, W), '#', dtype='<U1')
        for y in range(H):
            gy = ty + y / T
            row = rows[int(gy)] if 0 <= int(gy) < len(rows) else ''
            for x in range(W):
                gx = tx + x / T
                ch[y, x] = row[int(gx)] if 0 <= int(gx) < len(row) else '#'
        self.ch = ch
        isfloor = np.isin(ch, list(floor + water)).astype(np.float32)
        n = (fbm(H, W, 10, seed) - 0.5) * 0.7 + (fbm(H, W, 4, seed + 9) - 0.5) * 0.25
        self.floor = blur(blur(isfloor, 7), 4) + n > 0.5
        iswater = np.isin(ch, list(water)).astype(np.float32)
        self.water = (blur(iswater, 5) + n * 0.6 > 0.5) & self.floor
        self.rock = ~self.floor
        # A wall's face shows where floor lies just below it (the three-quarter view).
        below = np.zeros((H, W), bool)
        for d in range(1, 26):
            below |= np.roll(self.floor, -d, axis=0)
        self.face = self.rock & below
        self.roof = self.rock & ~self.face
        tone = fbm(H, W, 40, seed + 1)
        detail = fbm(H, W, 7, seed + 2)
        g = np.zeros((H, W, 3), np.float32)
        # The roof seen from above: the dark mass of the rock over the passage.
        g[self.roof] = I.ramp_lookup('stone', 0.2 + (tone[self.roof] - 0.5) * 0.8 + (detail[self.roof] > 0.72) * 0.9)
        crown = self.roof & (I.dist_to(self.face, 8) < 3)
        g[crown] = I.ramp_lookup('stone', 1.6 + 0 * tone[crown])
        # The faces: rough rock in courses, lit along the top and dark at the foot.
        dfoot = I.dist_to(self.floor, 26)
        strata = fbm(H, W, 6, seed + 3)
        band = np.floor((YS + strata * 5) / 4)
        rel = np.clip(dfoot / 24, 0, 1)
        col = I.ramp_lookup(wall_ramp, 2.4 + rel * 1.8 + (band % 2) * 0.7 - (detail > 0.75) * 1.4)
        g[self.face] = col[self.face]
        self.dfoot = dfoot
        # The floor: wet rock, darker in hollows, a sheen where it holds water.
        fl = self.floor & ~self.water
        g[fl] = I.ramp_lookup('stone_warm', 2.0 + (tone[fl] - 0.5) * 1.4 + (detail[fl] - 0.5) * 1.2)
        foot = fl & (I.dist_to(self.rock, 6) < 4)
        g[foot] = g[foot] * 0.7
        self.ground = g
        self.tone, self.detail = tone, detail

    def tile(self, x, y, tx, ty):
        return (x - tx) * T, (y - ty) * T


def haze(f, t, strength=0.18, seed=5, col=None):
    """A damp haze moving through the dark on the draught, ordered-dithered: the air of the
    passage is never still."""
    col = C('sky', 2) if col is None else col
    off = t / I.LOOP * 640
    n = np.roll(fbm(H, W, 28, seed, 2), int(off), axis=1) * 0.6 + \
        np.roll(fbm(H, W, 11, seed + 1, 2), int(-off * 0.7), axis=1) * 0.4
    a = (n + bayer(H, W) * 0.35 > 0.72).astype(np.float32) * strength
    f[:] = f * (1 - a[..., None]) + col[None, None, :] * a[..., None]


def cave_pool(f, t, m):
    """Dark sea water lying in the passage: green-black, the floor showing near its edge,
    ripples from the drips and the draught crossing it."""
    n1 = value_noise(H, W, 6, 320 + int(t * 5) % 7)
    n2 = value_noise(H, W, 3, 330 + int(t * 7) % 5)
    rip = (np.sin(XS / 4.0 - I.ph(t, 5) + n1 * 4) > 0.82) | (n2 > 0.86)
    col = I.ramp_lookup('sea', 1.6 + n1 * 1.4 + rip * 2.2)
    f[m] = f[m] * 0.3 + col[m] * 0.7


class Deep(Interior):
    TX, TY = 15.6, 1.2

    def __init__(self):
        rows = grid('sealcave_passage_tiles.txt')
        super().__init__(rows, self.TX, self.TY, floor='.cpPABLS', water='kv', seed=301)
        g = self.ground
        # The weed line along both walls at the height the water comes to.
        weed = self.face & (self.dfoot < 7)
        g[weed] = I.ramp_lookup('kelp', 1.6 + self.detail[weed] * 2.4)
        barn = self.face & (self.dfoot >= 7) & (self.dfoot < 10) & (value_noise(H, W, 2, 302) > 0.6)
        g[barn] = I.ramp_lookup('wool', 2.6 + 0 * self.tone[barn])
        crawl = self.ch == 'c'
        g[crawl] = I.ramp_lookup('stone', 1.6 + 0 * self.tone[crawl])
        # The crawl: a fallen slab over a low creep, its dark mouth on each side.
        self.slab = Sprite(130, 26, 65, 24)
        for x in range(2, 128):
            for y in range(4, 16 - int(abs(x - 64) / 40)):
                self.slab.px(x, y, C('stone', 4.6 - (y - 4) * 0.3 + (x % 31 == 0) * -1.6))
            for y in range(16 - int(abs(x - 64) / 40), 22):
                self.slab.px(x, y, C('ink', 0))
        self.slab.outline()
        self.stone = I.boulder(77, rx=11, ry=8, base=4.0)            # the fallen kerb-stone
        self.carving = Sprite(26, 18, 13, 17)
        for k in range(5):
            for x in range(2, 24):
                y = 12 - k * 0.2 + math.sin(x / 2 + k) * 1.2 + k * 0.0
                if k < 3:
                    self.carving.px(x, int(y + k * 1.5), C('stone', 2.2))
        for y in range(3, 11):
            self.carving.px(13, y, C('stone', 2.2))                  # a figure on the waves
        for (x, y) in ((12, 3), (14, 3), (11, 6), (15, 6), (13, 2)):
            self.carving.px(x, y, C('stone', 2.2))
        self.shell = I.boulder(91, rx=2, ry=1.5, ramp='wool', base=5)
        self.drips = [(470, 210, 60), (560, 224, 50), (300, 236, 40), (380, 220, 44), (600, 218, 30)]
        self.light = np.clip(1.0 - np.hypot((XS - 640) / 520, (YS - 210) / 300), 0.15, 1.0)
        self.light = banded(self.light, 4)

    def frame(self, t):
        f = self.ground.copy()
        cave_pool(f, t, self.water)
        wedge = self.water & (I.dist_to(~self.water, 3) < 2) if not hasattr(self, '_we') else self._we
        self._we = wedge
        f[wedge] = C('sea', 6)
        near = self.face & (self.dfoot < 22)
        I.caustics(f, t, near, strength=0.35, scale=6.0, seed=301)
        I.drips(f, t, self.drips, seed=3)
        tx, ty = self.TX, self.TY
        shadow = np.zeros((H, W), np.float32)
        x, y = self.tile(22.5, 8.9, tx, ty)
        stamp(f, self.slab, x, y)
        x, y = self.tile(23.5, 12.9, tx, ty)
        stamp(f, self.stone, x, y)
        I.contact(shadow, x, y, 10)
        x, y = self.tile(27.5, 4.9, tx, ty)
        stamp(f, self.carving, x, y - 4)
        x, y = self.tile(43.5, 5.9, tx, ty)
        stamp(f, self.shell, x, y)
        x, y = self.tile(28.5, 10.4, tx, ty)
        I.steerer(f, shadow, x, y, 'w', 'idle', t)
        f = I.apply_shadow(f, shadow)
        haze(f, t, strength=0.16, seed=303)
        I.motes(f, t, 160, 304, region=self.floor, col=C('sea', 8), drift=(-0.5, -0.2))
        return I.dark_grade(f, self.light, cool=(0.7, 0.78, 0.88), lift=(6, 8, 14))


class CairnIn(Interior):
    TX, TY = 11.0, 3.0

    def __init__(self):
        rows = grid('hollow_cairn_tiles.txt')
        # Year 1: no shaft (g is rock), the rubble and the sea-light's places are floor.
        rows = [r.replace('g', '#') for r in rows]
        super().__init__(rows, self.TX, self.TY, floor='.,+bECD', water='ws', seed=311,
                         wall_ramp='stone_warm')
        g = self.ground
        # The cairn's walls: drystone coursing on the faces, slabs over the passage.
        # Drystone: courses of uneven height, stones of uneven length, each its own tone.
        wob = fbm(H, W, 9, 316) * 3
        row = np.floor((YS + wob) / 3.6)
        rh = np.vectorize(lambda r: hash01(int(r), 1))(row)
        width = 5 + rh * 6
        off = rh * 13
        idx = np.floor((XS + off) / width)
        stoneid = np.vectorize(lambda r, i: hash01(int(r), int(i), 2))(row, idx)
        tonef = 2.6 + stoneid * 2.2 + np.clip(self.dfoot / 24, 0, 1) * 1.0
        col = I.ramp_lookup('stone_warm', tonef)
        g[self.face] = col[self.face]
        joint = self.face & ((((YS + wob) % 3.6) < 0.9) | (((XS + off) % width) < 1))
        g[joint] = I.ramp_lookup('stone', 0.6 + 0 * tonef[joint])
        # Earth floor, dry, with fallen grit.
        fl = self.floor
        g[fl] = I.ramp_lookup('earth', 2.4 + (self.tone[fl] - 0.5) * 1.4 + (self.detail[fl] > 0.8) * 0.8)
        self.goods = []
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c == 'b':
                    self.goods.append((x + 0.5, y + 0.8))
        self.pots = [self._goods(k) for k in range(4)]
        self.door = Sprite(30, 60, 15, 58)
        for y in range(2, 58):
            for x in range(3, 27):
                self.door.px(x, y, C('stone', 4.4 + (x < 8) * 0.8 - (y > 50) * 1.0 + (hash01(x // 3, y // 3) - 0.5)))
        for k in range(3):
            for a in range(0, 360, 10):
                rr = 3 + k * 3
                fx._px(self.door.rgb, 15 + math.cos(math.radians(a)) * rr, 26 + math.sin(math.radians(a)) * rr, C('stone', 2.4))
        self.door.outline()
        # The festival sun along the outer passage from the east door.
        sun = np.zeros((H, W), np.float32)
        y0 = (14 - self.TY) * T + 12
        beam = (np.abs(YS - y0 - (XS - W) * 0.03) < 22 + (W - XS) * 0.02) & self.floor
        sun[beam] = 1.0
        self.beam = blur(sun, 3) > 0.5
        self.light = np.clip(0.18 + blur(sun, 18) * 1.4, 0, 1)
        self.light = banded(self.light, 5)

    def _goods(self, k):
        s = Sprite(20, 14, 10, 12)
        if k % 2 == 0:
            for y in range(3, 12):
                for x in range(5, 15):
                    if ((x - 10) / 6) ** 2 + ((y - 7.5) / 5) ** 2 <= 1:
                        s.px(x, y, C('earth', 3.6 - (x > 10) * 1.2 + (y < 5) * 0.8))
            for x in range(7, 13):
                s.px(x, 3, C('earth', 1))
        else:
            for x in range(3, 17):
                for y in range(8, 11):
                    s.px(x, y, C('trefoil', 1.4 + (y == 8) * 0.8))     # a bronze bowl
            for (x, y) in ((4, 11), (8, 11), (12, 11)):
                s.px(x, y, C('wool', 5))                               # beads
        return s.outline()

    def frame(self, t):
        f = self.ground.copy()
        I.stream(f, t, self.water, flow=(1.0, 0.2), speed=10)
        shadow = np.zeros((H, W), np.float32)
        for k, (gx, gy) in enumerate(self.goods):
            x, y = self.tile(gx, gy, self.TX, self.TY)
            stamp(f, self.pots[k % 4], x, y)
            I.contact(shadow, x, y, 6)
        # The carvings that seem to listen, by the grave cells: rings that brighten and fade.
        x, y = self.tile(38.5, 12.7, self.TX, self.TY)
        for k in range(3):
            for a in range(0, 360, 12):
                rr = 2 + k * 2.5
                fx._px(f, x + math.cos(math.radians(a)) * rr, y - 8 + math.sin(math.radians(a)) * rr * 0.7,
                       C('stone', 2.2 + 0.8 * (fx.loopsin(t, 1, k) > 0.6)))
        x, y = self.tile(12.5, 15.2, self.TX, self.TY)
        stamp(f, self.door, x, y)
        x, y = self.tile(33.5, 14.6, self.TX, self.TY)
        I.steerer(f, shadow, x, y, 'w', 'idle', t)
        f = I.apply_shadow(f, shadow)
        lit = self.beam[..., None]
        f = np.where(lit, f * np.array([1.18, 1.08, 0.9]), f)
        haze(f, t, strength=0.16, seed=313, col=C('stone_warm', 4))
        I.motes(f, t, 900, 314, region=self.beam, col=C('fire', 7), drift=(-0.3, 0.4))
        I.motes(f, t, 260, 315, region=~self.beam, col=C('stone', 5), drift=(-0.2, 0.3))
        return I.dark_grade(f, self.light, cool=(0.5, 0.52, 0.66), lift=(8, 9, 16))


if __name__ == '__main__':
    I.save('deep', Deep())
    I.save('cairn_in', CairnIn())

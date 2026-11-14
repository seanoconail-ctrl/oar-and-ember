"""The wreck on Sgeir Dhubh, a reef in Rán's Reach, on a grey windy afternoon (Stage 13 mockup;
Book 6 section 19, Book 9 section 15; decisions S13-40 to S13-59).

The view the steerer has from the reef's shingle back, looking along it to the south-west: the
spine of black rock stacks along the north with kittiwakes and a cormorant, the crown of salt turf
and thrift under it, the shingle and the weed-dark foreshore going down to a shelf of flats; the
swell rolling in from the south-west and breaking white along the reef, spray on the rocks, kelp
swaying in the shallows; the Faoileán broken-backed on the south-western tip, her sail awash in
the surf beside her, the cask and the iron in the wash; Fínán holding her gunwale, Derbáil braced
and shivering on the rocks above, Ívar lying hurt on the shingle; the steerer standing on the
shingle; and the household's boat lying alongside to the east, the crew at their oars, bobbing.
Gulls wheel with their shadows on the reef; a seal lifts its head on the flats.

The painting helpers (`faoilean`, `cask`, `iron_bundle`, `spray_burst`, `kelp`, `sail_awash`) are
imported by the game's authoring script (assets/art/authoring/stage13_wreck_art.py), so the built
place is drawn from the same art.

    python3 docs/art/mockup-src/sea_wreck.py      # docs/art/mockups/stage-13/sea-wreck.png, .gif
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import fx  # noqa: E402
import people48  # noqa: E402
from core import (C, FPS, FRAMES, LOOP, Sprite, banded, blur, fbm, hash01, ramp_lookup,  # noqa: E402
                  rng, shift, stamp, stamp_mask, stone, to_u8, value_noise)

W, H = 640, 360
OUT = os.path.join(os.path.dirname(__file__), '..', 'mockups', 'stage-13')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SUN = (0.8, -0.35)
SHADE = np.array([0.6, 0.65, 0.82], np.float32)
TAU = math.tau


# ------------------------------------------------------------------ the wreck's own pieces
def faoilean(k=0):
    """The Faoileán, a Carrick fishing and trading boat, broken-backed on the rocks: seen from the
    south in the three-quarter view, her bow (left) lifted on the reef and her stern settled in the
    wash, listing towards the viewer. Oak strakes greyed by salt, not tarred black like the
    household's boat; a gap amidships where her back broke, plank ends sprung and ribs showing,
    sea slopping in it; the mast snapped to a stump; weed along her keel. `k` (0..3) moves the
    foam slopping in the break and along her waterline."""
    w, h = 112, 56
    s = Sprite(w, h, w // 2, h - 6)
    x0, x1 = 6, 104
    nz = value_noise(h, w, 3, 71)
    brk0, brk1 = 0.46, 0.58                       # the break amidships, as a share of her length
    for x in range(x0, x1):
        t = (x - x0) / (x1 - x0 - 1)
        body = math.sin(math.pi * t) ** 0.35
        tilt = (0.5 - t) * 14                     # the bow lifted on the reef, the stern settled
        sag = 5 * math.exp(-((t - 0.52) / 0.08) ** 2)   # her broken back sags
        rise = 18 * (1 - math.sin(math.pi * t)) ** 2.2
        near = 30 - rise + sag - tilt * 0.6 + 2
        far = near - 8 * body
        keel = near + 1 + 13 * body ** 1.4
        broken = brk0 < t < brk1
        for y in range(int(far), int(keel) + 1):
            if broken and y > near + 1:
                # The break: ragged plank ends and the sea inside her.
                edge = min(t - brk0, brk1 - t) * (x1 - x0)
                if edge > 1.5 + hash01(x, y, 3) * 2:
                    foam = math.sin(x * 0.9 + k * TAU / 4 + y) > 0.55
                    s.px(x, y, C('sea', 9 if foam else 3 + (y - near) * 0.15))
                    continue
            if y < near:
                depth = (y - far) / max(1, near - far)
                col = C('earth', 1.2 + depth * 0.4 + (nz[y, x] - 0.5) * 0.6)
                if (x - x0) % 11 in (0, 1) and 0.08 < t < 0.92:
                    col = C('driftwood', 4.5 if (x - x0) % 11 == 0 else 3.2)    # a rib
                if broken:
                    col = C('sea', 3 + depth * 2)
            else:
                v = (y - near) / max(1, keel - near)
                strake = min(3, int(v * 4))
                within = v * 4 - strake
                col = C('earth', 3.9 - strake * 0.45 - (1.4 if within > 0.78 else 0)
                        + (0.7 if within < 0.2 else 0) + (nz[y, x] - 0.5) * 0.7)
                if within > 0.8 and (x * 7 + strake * 3) % 13 == 0:
                    col = C('stone', 4)                               # a rivet head, rusted
                if v > 0.82:
                    col = C('kelp', 1.5 + hash01(x, y, 5) * 2)          # weed along her keel
            s.px(x, y, col)
        s.px(x, int(far), C('driftwood', 5 if not broken else 3))
        if not broken:
            s.px(x, int(near), C('driftwood', 6 if x % 5 else 4))
        # Foam slapping along her waterline, moving with k.
        wl = int(keel) - 1
        if math.sin(x * 0.45 - k * TAU / 4) > 0.4:
            s.px(x, wl, C('sea', 10))
    # Stem and stern posts; the mast snapped to a jagged stump, the stay hanging slack.
    for j in range(9):
        s.px(x0 + 1 + j // 4, 15 - j + 4, C('earth', 2))
        s.px(x1 - 2 - j // 4, 24 - j, C('earth', 2))
    mx = 38
    for y in range(8, 24):
        s.px(mx, y, C('driftwood', 4))
        s.px(mx + 1, y, C('driftwood', 2))
    for dx, y in ((-1, 7), (0, 6), (2, 7), (1, 5)):
        s.px(mx + dx, y, C('driftwood', 5))
    for j in range(18):
        s.px(mx + 2 + j, 9 + int(j * 0.9) + (1 if j % 3 == 0 else 0), C('wool', 3))
    return s.outline()


def cask():
    """A cask of salted herring on its side in the wash: oak staves, two dark hoops."""
    s = Sprite(16, 13, 8, 11)
    for x in range(1, 15):
        for y in range(2, 12):
            dx, dy = (x - 7.5) / 7, (y - 6.5) / 5
            if dx * dx * 0.6 + dy * dy > 1:
                continue
            col = C('driftwood', 4.4 - dy * 1.6 + (0.5 if (x % 3 == 0) else 0))
            if x in (4, 11):
                col = C('tar', 1.5)
            s.px(x, y, col)
    for y in range(4, 10):
        s.px(14, y, C('driftwood', 2.5))
    return s.outline()


def iron_bundle():
    """A bundle of bar iron from Saltvik, lashed with rope, lying in the wash."""
    s = Sprite(22, 9, 11, 7)
    for row in range(4):
        y = 2 + row + (row // 2)
        for x in range(2 + row % 2, 20 - row % 2):
            s.px(x, y, C('stone', 3.5 - row * 0.4 + (0.8 if (x + row) % 7 == 0 else 0)))
    for x0 in (6, 15):
        for y in range(1, 8):
            s.px(x0, y, C('wool', 3 + (y % 2)))
    return s.outline()


def spray_burst(k, n=6):
    """A burst of spray where the swell breaks on rock, `k` of `n` frames: thrown up and blown
    downwind (east), falling back. No outline: water, white and pale."""
    w, h = 30, 28
    s = Sprite(w, h, 8, h - 2)
    r = np.random.default_rng(91)
    age = (k + 0.5) / n
    for p in range(34):
        vx = r.uniform(-1.0, 2.4)
        vy = r.uniform(-4.0, -1.6)
        x = 8 + vx * age * 9 + age * age * 6
        y = h - 2 + vy * age * 10 + age * age * 18
        if r.random() < 1.05 - age:
            s.px(int(round(x)), int(round(y)), C('sea', 10 if p % 3 else 9))
    # The white water at its foot.
    for x in range(2, 16):
        if math.sin(x * 1.3 + k * 1.7) > -0.2:
            s.px(x, h - 2, C('sea', 10))
    return s


def kelp(k, n=4):
    """Kelp fronds under the water, swaying with the swell: dark brown blades from a holdfast."""
    w, h = 22, 14
    s = Sprite(w, h, 11, h - 2)
    for b, (bx, ln, ph) in enumerate([(6, 10, 0.0), (10, 12, 1.3), (14, 9, 2.4), (17, 7, 3.1)]):
        for j in range(ln):
            sway = math.sin(k * TAU / n + ph + j * 0.35) * j * 0.32
            s.px(int(round(bx + sway)), h - 2 - j, C('kelp', 1 + (j / ln) * 2.2))
    return s


def sail_awash(k, n=4):
    """The Faoileán's sail adrift in the surf beside her: pale wool cloth half under the water,
    ripples running across it and foam at its edges; the yard's end showing."""
    w, h = 44, 18
    s = Sprite(w, h, w // 2, h - 2)
    for x in range(2, 42):
        top = 5 + 2 * math.sin(x * 0.2 + k * TAU / n)
        bot = 14 + math.sin(x * 0.31 + 1 - k * TAU / n)
        for y in range(int(top), int(bot)):
            rip = math.sin(x * 0.55 + y * 0.9 - k * TAU / n * 2) > 0.6
            col = C('wool', 4.6 - (y - top) * 0.25 - (0.9 if rip else 0))
            if hash01(x, y, 7) < 0.12:
                col = C('sea', 5)                        # water over the cloth
            s.px(x, y, col)
        if math.sin(x * 0.7 + k * TAU / n) > 0.3:
            s.px(x, int(bot), C('sea', 10))
    for x in range(30, 44):
        s.px(x, 4 + (x - 30) // 5, C('driftwood', 3))
    return s


def sheet_sprite(name, frame):
    """A frame of a game sheet (assets/art/sheets) as a Sprite anchored at its pivot."""
    pal = people48._palette()
    path = os.path.join(ROOT, 'assets', 'art', 'sheets', name + '.txt')
    rows, pivot, size, cur = [], None, None, None
    with open(path, encoding='utf8') as f:
        for line in f.read().split('\n'):
            if line.startswith('pivot:'):
                pivot = tuple(int(v) for v in line[6:].strip().split(','))
            elif line.startswith('size:'):
                size = tuple(int(v) for v in line[5:].strip().split('x'))
            elif line == f'frame {frame}':
                cur = []
            elif line == 'end' and cur is not None:
                rows = cur
                break
            elif cur is not None:
                cur.append(line)
    s = Sprite(size[0], size[1], pivot[0], pivot[1])
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch not in '. ':
                s.rgb[y, x] = pal[ch]
                s.mask[y, x] = True
    return s


# ------------------------------------------------------------------ the view
def reef_axis(x):
    """The reef's spine line across the view (its north edge), in view pixels."""
    return 150 - 0.13 * (x - 320) + 6 * math.sin(x / 47) + 3 * math.sin(x / 13 + 1)


class SeaWreck:
    def __init__(self):
        r = rng(57)
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        self.xs, self.ys = xs, ys
        axis = np.array([reef_axis(x) for x in range(W)], np.float32)[None, :]
        warp = (fbm(H, W, 28, 5) - 0.5) * 22
        # Depth across the reef: 0 at the spine, rising southwards; the reef narrows to the west.
        across = (ys - axis + warp)
        width = 150 - 0.05 * np.abs(xs - 330)
        self.d = across / width                         # < 0 north of the spine
        tone = fbm(H, W, 50, 3)
        detail = fbm(H, W, 9, 4)
        g = np.zeros((H, W, 3), np.float32)
        d = self.d
        self.rockband = (d > -0.18) & (d < 0.02)
        self.crown = (d >= 0.02) & (d < 0.22) & (xs > 180) & (xs < 470) & \
            (fbm(H, W, 20, 8) > 0.38)
        self.shingle = (d >= 0.02) & (d < 0.5) & ~self.crown
        self.foreshore = (d >= 0.5) & (d < 0.72)
        self.flats = (d >= 0.72) & (d < 1.0)
        self.northshelf = (d > -0.42) & (d <= -0.18)
        self.land = self.rockband | self.crown | self.shingle | self.foreshore | self.flats | self.northshelf
        g[:] = ramp_lookup('sea', 2)
        sh = self.shingle
        g[sh] = ramp_lookup('stone', 4.0 + (tone[sh] - 0.5) * 0.9 + (detail[sh] - 0.5) * 1.1)
        peb = sh & (detail > 0.62)
        g[peb] = ramp_lookup('stone', 5.5 + (tone[peb] - 0.5) * 2)
        sand = sh & (fbm(H, W, 5, 11) > 0.7)
        g[sand] = ramp_lookup('sand', 3.2 + (detail[sand] - 0.5) * 1.0)
        fs = self.foreshore
        g[fs] = ramp_lookup('stone', 2.4 + (tone[fs] - 0.5) * 1.2) * 0.7 + C('sea', 2) * 0.3
        weed = fs & (fbm(H, W, 6, 12) > 0.52)
        g[weed] = ramp_lookup('kelp', 2 + (detail[weed] - 0.5) * 2)
        fl = self.flats | self.northshelf
        g[fl] = ramp_lookup('kelp', 1.6 + (tone[fl] - 0.5) * 1.5) * 0.6 + C('sea', 3) * 0.4
        bar = fl & (detail > 0.6)
        g[bar] = ramp_lookup('wool', 3.4 + (tone[bar] - 0.5))           # barnacled rock
        cr = self.crown
        g[cr] = ramp_lookup('grass', 4.2 + (tone[cr] - 0.5) * 1.6 + (detail[cr] - 0.5) * 0.8)
        rb = self.rockband
        g[rb] = ramp_lookup('stone', 1.6 + (detail[rb] - 0.5) * 1.2)
        self.ground = g
        self.pools = (fbm(H, W, 16, 13) > 0.66) & (self.foreshore | self.flats)
        # The spine's black rock stacks, sorted by foot.
        self.rocks = []
        x = -10.0
        k = 0
        while x < W + 20:
            sz = r.uniform(11, 22)
            y = reef_axis(x) - 2 + r.uniform(-4, 4)
            spr = Sprite(int(sz * 2.8), int(sz * 2.4))
            stone(spr, spr.w / 2, spr.h / 2, sz, sz * 0.8, 'stone', 2.6, seed=k * 31 + 5)
            self._weed_base(spr, k)
            self.rocks.append((y, spr.outline(), x, y + sz * 0.7))
            x += sz * r.uniform(1.4, 2.1)
            k += 1
        # The offshore stack with the cormorant, top right.
        spr = Sprite(46, 50)
        stone(spr, 23, 25, 16, 20, 'stone', 2.4, seed=901)
        self._weed_base(spr, 99)
        self.stack = (spr.outline(), 520, 66)
        # The wreck and its pieces.
        self.wreck = [faoilean(k) for k in range(4)]
        self.wreck_at = (104, 286)
        self.cask, self.iron = cask(), iron_bundle()
        self.sails = [sail_awash(k) for k in range(4)]
        self.sprays = [spray_burst(k) for k in range(6)]
        self.kelps = [kelp(k) for k in range(4)]
        self.kelp_at = [(r.uniform(0, W), r.uniform(0, H)) for _ in range(120)]
        self.kelp_at = [(x_, y_) for (x_, y_) in self.kelp_at
                        if self._at(self.flats | self.northshelf | (self.d > 1.0) & (self.d < 1.4), x_, y_)][:36]
        # The household's boat alongside to the east, with the crew at their oars.
        self.boat = [sheet_sprite('ship_t1_launch', f'afloat - {k}') for k in range(4)]
        self.mast = sheet_sprite('ship_t1_launch', 'mast - 0')
        self.crew = {who: [sheet_sprite('ship_t1_crew', f'{who} - {k}') for k in range(4)]
                     for who in ('hild_1', 'oddi_2', 'bran_0', 'runa_3')}
        self.boat_at = (560, 322)
        # Plants: salt turf and thrift on the crown, sea campion in the rock crevices.
        self.tufts = []
        for _ in range(7000):
            x_, y_ = r.uniform(0, W), r.uniform(0, H)
            xi, yi = int(x_), int(y_)
            if self.crown[yi, xi]:
                kind = 'thrift' if r.random() < 0.3 else 'grass'
                self.tufts.append((kind, x_, y_, r.uniform(3, 6), r.random()))
            elif self.rockband[yi, xi] and r.random() < 0.05:
                self.tufts.append(('thrift', x_, y_, 3, r.random()))
        self.tufts.sort(key=lambda u: u[2])
        self.people = [('finan', 'call', 'w', 140, 280, 9), ('derbail', 'idlewind', 'e', 176, 232, 6),
                       ('ivar', 'down', 'n', 228, 262, 40), ('steerer_a', 'idle', 'w', 404, 238, 15)]
        self.static_shadow = self._shadows()

    def _weed_base(self, spr, k):
        """Wet black rock at the foot: weed hanging, barnacles above it."""
        h = spr.h
        for y in range(h):
            for x in range(spr.w):
                if not spr.mask[y, x]:
                    continue
                below = sum(spr.mask[yy, x] for yy in range(y, h))
                if below < 4:
                    spr.rgb[y, x] = C('kelp', 1 + hash01(x, y, k) * 2)
                elif below < 7 and hash01(x, y, k + 3) < 0.5:
                    spr.rgb[y, x] = C('wool', 3 + hash01(x, y, k + 4) * 2)

    @staticmethod
    def _at(mask, x, y):
        xi, yi = int(x), int(y)
        return 0 <= xi < W and 0 <= yi < H and bool(mask[yi, xi])

    def _shadows(self):
        sh = np.zeros((H, W), np.float32)
        for (_, spr, x, y) in self.rocks:
            m = np.zeros((H, W), np.float32)
            stamp_mask(m, spr, x, y, 1.0)
            for s in range(8):
                sh = np.maximum(sh, shift(m, s * SUN[0], -s * SUN[1] * 0.3))
        soft = blur(sh, 1)
        return np.where(soft > 0.7, 1.0, np.where(soft > 0.2, 0.5, 0.0)).astype(np.float32)

    def water(self, f, t):
        xs, ys, d = self.xs, self.ys, self.d
        ph = TAU * t / LOOP
        # Open water: deeper away from the reef; swells in bands from the south-west.
        far = np.clip(np.abs(np.where(d < 0, d + 0.42, d - 1.0)) * 1.6, 0, 1)
        sea = ~self.land
        u = xs * 0.42 - ys * 0.9
        w1 = np.sin(u / 9 - ph * 3)
        w2 = np.sin(u / 4.3 - ph * 5 + xs / 60)
        idx = 4.2 - banded(far, 5) * 2.8 + (w1 > 0.6) * 0.7 + (w2 > 0.85) * 0.5
        col = ramp_lookup('sea', idx)
        broken = value_noise(H, W, 7, 77 + int(t * 2.5) % 5) > 0.55
        crest = (w1 > 0.96) & (w2 > 0.0) & broken
        col[crest] = ramp_lookup('sea', 8 + 0 * xs[crest])
        f[sea] = col[sea]
        # The surf zone round the reef: white lines breaking and foam running up the foreshore.
        edge_s = (d > 1.0 - 0.06 * np.sin(ph * 2 + xs / 37)) & (d < 1.35)
        brk = edge_s & (np.sin((d - 1.0) * 40 - ph * 4 + xs / 50) > 0.6)
        lace = value_noise(H, W, 3, 61 + int(t * 5) % 7) > 0.45
        f[brk & lace] = C('sea', 10)
        f[brk & ~lace] = C('sea', 8)
        edge_n = (d < -0.42) & (d > -0.6) & (np.sin((d + 0.42) * 36 + ph * 4 + xs / 40) > 0.7)
        f[edge_n & lace] = C('sea', 9)
        # The tide's swash over the flats and foreshore: a film of water that breathes up and back.
        swash = 0.84 + 0.07 * np.sin(ph * 2 + xs / 45) + 0.015 * np.sin(ph * 5 + xs / 9)
        covered = (self.flats | self.foreshore) & (d > swash)
        f[covered] = f[covered] * 0.55 + C('sea', 4) * 0.45
        line = (self.flats | self.foreshore) & (np.abs(d - swash) < 0.01) & lace
        f[line] = C('sea', 9)
        # Pools holding the grey sky, a ripple crossing.
        p = self.pools & ~covered
        rip = np.sin(xs / 3 + ys / 7 - ph * 3) > 0.8
        f[p] = ramp_lookup('sky', 3 + rip[p] * 2.5) * 0.7 + f[p] * 0.3
        # Glints on the wet rock and the water.
        wet = self.foreshore | self.flats | sea
        gl = wet & (value_noise(H, W, 2, 300 + int(round(t * FPS)) % 997) > 0.95)
        f[gl] = f[gl] * 0.4 + C('sky', 7) * 0.6

    def frame(self, t):
        f = self.ground.copy()
        self.water(f, t)
        shadow = self.static_shadow.copy()
        ph = TAU * t / LOOP
        k4 = int(t * 2.5) % 4
        # Kelp swaying under the shallows, the sail awash, the pieces in the wash.
        for j, (x, y) in enumerate(self.kelp_at):
            stamp(f, self.kelps[(k4 + j) % 4], x, y)
        stamp(f, self.sails[k4], 50, 300)
        sprites = []
        for (y, spr, x, foot) in self.rocks:
            sprites.append((foot, spr, x, y))
        sprites.append((self.wreck_at[1], self.wreck[k4], *self.wreck_at))
        sprites.append((291, self.cask, 158, 291))
        sprites.append((298, self.iron, 140, 298))
        for (foot, spr, x, y) in sorted(sprites, key=lambda u: u[0]):
            stamp(f, spr, x, y)
        stamp(f, self.stack[0], self.stack[1], self.stack[2])
        stamp(f, fx.cormorant(fx.loopsin(t, 3) > 0), 520, 40)
        # Plants on the crown and in the rock's crevices, in the wind from the south-west.
        for (kind, x, y, hgt, p) in self.tufts:
            gust = max(0.0, math.sin(((x - t / LOOP * 320) % 320) / 320 * TAU) * 0.8)
            fx.draw_tuft(f, kind, x, y, hgt, p, t, gust)
        # Kittiwakes and gulls standing on the spine.
        for j, (x, y) in enumerate([(250, 128), (318, 118), (372, 116), (446, 106)]):
            stamp(f, fx.standing_gull(int(t * 1.5 + j * 0.7) % 3 == 0), x, y)
        # A seal on the flats lifting its head; crabs on the foreshore.
        stamp(f, fx.seal(fx.loopsin(t, 1) > 0.2), 330, 318)
        for j, (x, y) in enumerate([(266, 276), (300, 290)]):
            stamp(f, fx.crab(int(t * 6) % 2), x + 6 * fx.loopsin(t, 2, j), y)
        # The people: each with a contact shadow, drawn in foot order.
        for (who, state, facing, x, y, ticks) in sorted(self.people, key=lambda u: u[4]):
            n = people48.frames_of(who, state) or 1
            k = int(t * 60 / ticks) % n
            spr = people48.sprite(who, state, facing, k)
            contact(shadow, x, y, 9 if state == 'down' else 7)
            if who in ('finan',):
                # Waist deep in the wash: the water hides the legs, a ripple ring round them.
                spr = waded(spr, 17)
                ring = 3 + (t * 4) % 6
                for a in range(0, 360, 12):
                    fx._px(f, x + math.cos(math.radians(a)) * ring * 1.6, y - 16 + math.sin(math.radians(a)) * ring * 0.5, C('sea', 9))
            stamp(f, spr, x, y)
        # The household's boat, bobbing on the swell, the crew at their oars.
        bob = int(round(fx.loopsin(t, 4) * 1.0))
        bx, by = self.boat_at
        stamp(f, self.boat[k4], bx, by + bob)
        stamp(f, self.mast, bx, by + bob)
        for who, dx in (('hild_1', -36), ('oddi_2', -12), ('bran_0', 12), ('runa_3', 34)):
            stamp(f, self.crew[who][int(t * 2) % 4], bx + dx, by - 6 + bob)
        # Spray where the swell meets the rocks and the wreck.
        for j, (x, y, t0) in enumerate([(70, 268, 0.0), (32, 316, 1.1), (210, 190, 2.0), (612, 296, 0.6),
                                        (500, 160, 2.6), (128, 300, 1.7)]):
            s = self.sprays[int(((t - t0) % (LOOP / 4)) / (LOOP / 4) * 6) % 6]
            stamp(f, s, x, y)
        # Spindrift: flecks of spume torn off the surf and blown east over the reef, and wet
        # glints coming and going on the shingle.
        rr = np.random.default_rng(23)
        n = 420
        x0 = rr.uniform(0, W, n)
        y0 = rr.uniform(0, H, n)
        sp = rr.uniform(0.6, 1.4, n)
        for i in range(n):
            x = (x0[i] + W * 2 * sp[i] * t / LOOP) % W
            y = y0[i] + math.sin(x / 31 + i) * 3
            if not self._at(self.land, x, y):
                continue
            xi, yi = int(x), int(y)
            f[yi, xi] = f[yi, xi] * 0.35 + C('sea', 10) * 0.65
        gl = self.shingle & (value_noise(H, W, 2, 500 + int(round(t * FPS)) % 997) > 0.93)
        f[gl] = f[gl] * 0.55 + C('sky', 7) * 0.45
        # Gulls wheeling over the wreck, with their shadows on the reef.
        gbuf = np.zeros((H, W), np.float32)
        for j, (cx, cy, rad) in enumerate([(150, 200, 54), (360, 90, 60), (520, 230, 40)]):
            a = ph + j * 2.1
            fx.draw_gull(f, gbuf, cx + rad * math.cos(a), cy + rad * 0.5 * math.sin(a), 30, t)
        shadow = np.maximum(shadow, gbuf * 0.5)
        f = f * (1 - shadow[..., None] * (1 - SHADE) * 0.85)
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 640)
        f = fx.grade(f, cloud * 0.45, warm_sun=0.1)
        return f


def waded(spr, depth):
    """A person standing in water to `depth` px above the feet: masked below the waterline, with a
    pale line where the water meets them (Book 7 section 07, people in water)."""
    out = Sprite(spr.w, spr.h, spr.ax, spr.ay)
    out.rgb[:] = spr.rgb
    out.mask[:] = spr.mask
    wl = spr.ay - depth
    out.mask[wl + 1:, :] = False
    for x in range(spr.w):
        if spr.mask[wl, x]:
            out.rgb[wl, x] = C('sea', 9)
    return out


def contact(buf, x, y, rx=7):
    for yy in range(int(y - 3), int(y + 3)):
        for xx in range(int(x - rx), int(x + rx + 1)):
            if 0 <= yy < H and 0 <= xx < W and ((xx - x) / rx) ** 2 + ((yy - y) / 2.4) ** 2 < 1:
                buf[yy, xx] = max(buf[yy, xx], 0.7)


def main():
    os.makedirs(OUT, exist_ok=True)
    scene = SeaWreck()
    still = to_u8(scene.frame(0.0))
    Image.fromarray(still).save(os.path.join(OUT, 'sea-wreck.png'))
    raw = [to_u8(scene.frame(k / FPS)) for k in range(FRAMES)]
    import measure
    cont, cells = measure.continuous([r.astype(np.int16) for r in raw])
    measure.motion_map(raw[0], cells, os.path.join(OUT, 'sea-wreck-motion.png'))
    frames = [Image.fromarray(r) for r in raw[::2]]
    frames[0].save(os.path.join(OUT, 'sea-wreck-loop.gif'), save_all=True, append_images=frames[1:],
                   duration=int(2000 / FPS), loop=0, optimize=False)
    with open(os.path.join(OUT, 'measure.json'), 'w') as fh:
        json.dump({'continuousMotion': round(float(cont), 4), 'frames': len(raw)}, fh)
        fh.write('\n')
    print(f'wrote {OUT}/sea-wreck.png and sea-wreck-loop.gif ({len(frames)} frames); '
          f'continuous motion {cont * 100:.1f}% (all {len(raw)} frames)')


if __name__ == '__main__':
    main()

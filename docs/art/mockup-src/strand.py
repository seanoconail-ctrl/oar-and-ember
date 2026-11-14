"""Wreck Strand, grey and windswept, late afternoon: the target for the island coast.

World coordinates: x east, y south. The sea lies south, the machair north; the wind blows from
the west, and a low sun in the west-south-west throws long shadows east-north-east.
"""
import math
import numpy as np
from core import (C, LOOP, Sprite, blob, stone, blur, bayer, banded, fbm, hash01, ramp_lookup, rng,
                  shift, stamp, stamp_mask, value_noise)
import people

W, H = 800, 720
CUT_X = 150                 # where a sandy path climbs the bank onto the machair
VIEW = (60, 250)           # the still's camera (top-left corner)
SUN = (1.45, -0.4)          # shadow direction per pixel of height (east-north-east)
WIND = 1.0                  # wind from the west, blowing east
GUST_PERIOD = 320           # gust pattern repeats every 320 px; it travels one period per loop


def shore_y(x):
    return 470 + 18 * math.sin(x / 97) + 11 * math.sin(x / 41 + 1.3) - 0.04 * (x - 400)


class Strand:
    def __init__(self):
        r = rng(7)
        self.r = r
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        warp = (fbm(H, W, 40, 11) - 0.5) * 16
        shore = np.array([shore_y(x) for x in range(W)], np.float32)[None, :]
        self.s = ys - shore + warp            # signed distance to the shore: + is seaward
        self.xs, self.ys = xs, ys
        s = self.s
        self.ground = np.zeros((H, W, 3), np.float32)
        self.material = np.zeros((H, W), np.int8)   # 0 grass 1 bank 2 dune 3 sand 4 shingle 5 wet 6 sea
        self.props = []        # (y_sort, sprite, x, y, height, kind)
        self.tufts = []        # animated grass, marram and flowers
        self.decals = Sprite(W, H, 0, 0)
        self._paint_ground()
        self._paint_shingle_and_wrack()
        self._place_props()
        self._place_plants()
        self.wet_time = np.full((H, W), -99.0, np.float32)
        self.wavenoise = fbm(H, W, 30, 62)
        self.wavenoise2 = fbm(H, W, 14, 63)

    # ------------------------------------------------------------ ground
    def _paint_ground(self):
        s, g = self.s, self.ground
        tone = fbm(H, W, 64, 21)                          # large calm tonal patches
        detail = fbm(H, W, 12, 22)
        # Machair: cool grey-green, with darker tussock patches and worn sandy hollows.
        grass_idx = 5.2 + (tone - 0.5) * 3.2 + (detail - 0.5) * 1.2
        grass = ramp_lookup('grass', grass_idx)
        # Dry sand with wind ripples running north-south (the wind is from the west).
        ripple_amp = np.clip((fbm(H, W, 56, 23) - 0.45) * 4, 0, 1)
        ripple = np.sin(self.xs / 2.1 + np.sin(self.ys / 17) * 1.6 + np.sin(self.ys / 5.3) * 0.5)
        ripple = np.sin(self.xs / 1.3 + np.sin(self.ys / 9) * 1.4 + np.sin(self.ys / 3.1) * 0.4)
        sand_idx = 3.7 + (tone - 0.5) * 0.6 + np.where(ripple > 0.9, 0.55, 0) * ripple_amp
        sand = ramp_lookup('sand', sand_idx)
        # Wet sand: darker and cooler towards the water, with a sheen of sky.
        wet_idx = 1.6 + np.clip(-s / 30, 0, 1.6) + (tone - 0.5) * 0.8
        wet = ramp_lookup('sand_wet', wet_idx)
        sheen = (np.sin(self.xs / 7 + detail * 6) > 0.86) & (s > -10)
        wet[sheen] = (wet[sheen] * 0.5 + ramp_lookup('sky', 3 + 0 * wet_idx[sheen]) * 0.5)
        m = self.material
        m[:] = 3
        m[s > -14] = 5
        m[s > 0] = 6
        m[(s > -72) & (s < -40)] = 4
        dune = (s < -100) & (s > -146)
        m[dune] = 2
        m[s <= -146] = 1
        m[s <= -168] = 0
        self.cut = np.abs(self.xs - CUT_X - (self.ys - 330) * 0.15) < 9 + (fbm(H, W, 6, 35) - 0.5) * 4
        cutzone = self.cut & (s > -190) & (s <= -146)
        m[cutzone] = 2
        g[:] = sand
        g[m == 5] = wet[m == 5]
        g[m == 0] = grass[m == 0]
        # Dunes: hummocks shaded by their slope, lit from the west.
        hum = fbm(H, W, 26, 31, 2)
        dzx = np.gradient(hum, axis=1)
        dzy = np.gradient(hum, axis=0)
        light = (-dzx * 1.0 - dzy * 0.6) * 40
        dune_idx = 3.9 + np.clip(light, -1.0, 1.0) + (tone - 0.5) * 0.5
        dsand = ramp_lookup('sand', dune_idx)
        g[m == 2] = dsand[m == 2]
        # The bank: a low earth-and-stone cliff between the machair and the dunes (real height):
        # a grass lip with an overhang, a face with strata and ledges, scree and shadow at its foot.
        bank = (m == 1)
        face_t = np.clip((s + 164) / 18, 0, 1)                    # 0 at the lip, 1 at the foot
        strata_n = fbm(H, W, 10, 33)
        layer = np.floor((s + 164 + strata_n * 4) / 3.5)          # bands of rock and earth
        face_idx = 4.2 - face_t * 2.2 + (layer % 2) * 0.9 - (layer % 3 == 0) * 0.7
        # Ledges: a lit top edge on some layers.
        ledge = ((s + 164 + strata_n * 4) % 3.5 < 0.9) & (layer % 2 == 1)
        face = ramp_lookup('stone_warm', face_idx)
        g[bank] = face[bank]
        g[bank & ledge] = ramp_lookup('stone', 7 + 0 * face_idx[bank & ledge])
        cracks = (value_noise(H, W, 2, 34) > 0.8) & bank & (face_t > 0.15)
        g[cracks] = ramp_lookup('stone', 1 + 0 * face_idx[cracks])
        # The grass lip overhangs the face, with a dark undercut below it.
        lip = (s > -170) & (s <= -164) & ~self.cut
        g[lip] = ramp_lookup('grass', 4 + (detail[lip] > 0.5) * 1.0)
        under = (s > -164) & (s <= -161) & ~self.cut
        g[under] = ramp_lookup('earth', 0.5 + (s[under] + 164) / 3)
        # The cut is trodden sand, darker in the middle where feet go; a sheep track runs on
        # from its top across the machair.
        cutfloor = self.cut & (s > -192) & (s <= -140)
        g[cutfloor] = ramp_lookup('sand', 1.7 + (detail[cutfloor] - 0.5) * 1.4)
        prints = cutfloor & (value_noise(H, W, 2, 37) > 0.72)
        g[prints] = ramp_lookup('sand_wet', 4 + 0 * detail[prints])
        track_d = np.abs(self.ys - (300 - (self.xs - CUT_X) * 0.32 + np.sin(self.xs / 37) * 6))
        track = (track_d < 2.6 + (detail - 0.5) * 2) & (s < -186) & (self.xs > CUT_X - 6)
        g[track] = ramp_lookup('earth', 3.2 + (detail[track] - 0.5) * 1.5)
        worn = (track_d >= 2.6) & (track_d < 5) & (s < -186) & (self.xs > CUT_X - 6)
        g[worn] = ramp_lookup('grass', 4 + 0 * track_d[worn])
        self.track = track | worn
        # A boggy hollow on the machair, dark moss and peaty water.
        bogn = fbm(H, W, 22, 36)
        self.bog = (np.hypot(self.xs - 520, (self.ys - 200) * 1.4) < 55 + bogn * 25) & (s < -190) & (bogn > 0.42)
        g[self.bog] = ramp_lookup('moss', 2.4 + (detail[self.bog] - 0.5) * 2)
        peat = self.bog & (bogn > 0.6)
        g[peat] = ramp_lookup('earth', 0.6 + 0 * bogn[peat]) * 0.7 + ramp_lookup('sky', 1 + 0 * bogn[peat]) * 0.3
        # The cut's west wall throws a shadow across its floor.
        cutside = self.cut & (s > -170) & (s <= -146) & (np.abs(self.xs - CUT_X - (self.ys - 330) * 0.15) > 5)
        g[cutside] *= np.array([0.8, 0.82, 0.92])
        # Fallen stones and shadow at the bank's foot, on the dune sand.
        foot = (s > -146) & (s < -134) & ~self.cut
        g[foot] *= np.where(s[foot] < -141, 0.58, 0.8)[:, None] * np.array([0.9, 0.94, 1.1])
        self.tone = tone
        # Tide pools left in hollows of the wet sand near the rocks, holding the sky.
        for (px_, py_, rx, ry) in [(452, 452, 9, 4), (600, 448, 12, 4), (690, 470, 7, 3), (420, 462, 5, 2)]:
            d = ((self.xs - px_) / rx) ** 2 + ((self.ys - py_) / ry) ** 2
            pool = d < 1
            g[pool] = ramp_lookup('sky', np.where(d[pool] > 0.6, 2, 3) + 0 * d[pool])
            rim = (d >= 1) & (d < 1.5)
            g[rim] = ramp_lookup('sand_wet', 0 * d[rim])

    def _paint_shingle_and_wrack(self):
        r = self.r
        d = self.decals
        s = self.s
        # The storm ridge of shingle: pebbles in clusters, calm sand between the clusters.
        cluster = fbm(H, W, 30, 41)
        kinds = [('stone', 5), ('stone', 6), ('stone', 4), ('stone_warm', 3), ('stone', 7),
                 ('sand', 2), ('stone_warm', 4)]
        for _ in range(16000):
            x, y = r.uniform(0, W), r.uniform(0, H)
            sv = s[int(y), int(x)]
            ridge = math.exp(-((sv + 56) / 15) ** 2)
            scatter = 0.12 * math.exp(-((sv + 25) / 18) ** 2)
            p = (ridge * 1.3 + scatter) * (0.1 + 2.2 * max(0.0, cluster[int(y), int(x)] - 0.42))
            if r.random() > p:
                continue
            rx = r.uniform(0.9, 2.6) if r.random() < 0.85 else r.uniform(2.6, 4.0)
            name, base = kinds[r.integers(len(kinds))]
            # A shadow below each stone, then the stone lit from the upper left.
            for yy in range(int(y + 1), int(y + rx * 0.7 + 2)):
                for xx in range(int(x - rx + 1), int(x + rx + 1)):
                    if 0 <= xx < W and 0 <= yy < H and not d.mask[yy, xx]:
                        self.ground[yy, xx] *= 0.72
            blob(d, x, y, rx, rx * 0.72, name, base)
        # Shells and small bright stones, sparse, in drifts.
        for _ in range(500):
            x, y = r.uniform(0, W), r.uniform(0, H)
            sv = s[int(y), int(x)]
            if not -40 < sv < -12 or r.random() > 0.6:
                continue
            col = C('wool', 6) if r.random() < 0.6 else C('thrift', 4)
            d.px(int(x), int(y), col)
            if r.random() < 0.4:
                d.px(int(x) + 1, int(y), C('wool', 4))
        # The wrack line: kelp washed up at the last high tide, in broken strands and heaps.
        line = {}
        for x in range(W):
            col = s[:, x]
            idx = np.nonzero(col > -76)[0]
            line[x] = idx[0] if len(idx) else 0
        for _ in range(1400):
            x = r.uniform(0, W - 1)
            y0 = line[int(x)] + r.normal(0, 1.8)
            if fbm_cache(x, y0) < 0.36:
                continue
            length = r.integers(3, 14)
            ang = r.normal(0, 0.5) + (math.pi if r.random() < 0.5 else 0)
            col_i = r.integers(1, 6)
            for k in range(length):
                xx = int(x + math.cos(ang) * k)
                yy = int(y0 + math.sin(ang) * k * 0.5 + math.sin(k * 0.9) * 0.8)
                d.px(xx, yy, C('kelp', col_i + (1 if k % 4 == 0 else 0)))
                if k % 3 == 0:
                    d.px(xx, yy + 1, C('kelp', max(0, col_i - 2)))
        self.wrack_y = lambda x: shore_y(x) - 74

    # ------------------------------------------------------------ props
    def add(self, spr, x, y, height, kind='prop'):
        self.props.append((y, spr, x, y, height, kind))

    def _place_props(self):
        r = self.r
        self.rock = rock_pile(r, 128, 70, wet_line=44, boulders=16)
        self.add(self.rock, 560, 490, 30, 'rock')
        for (x, y, sz, n) in [(486, 502, 6, 4), (640, 474, 8, 5), (618, 510, 5, 3), (470, 476, 5, 3),
                              (508, 462, 4, 2), (650, 520, 6, 3), (455, 490, 3, 2)]:
            self.add(rock_pile(r, sz * 6, sz * 4, wet_line=sz * 3, boulders=n), x, y, sz * 1.4, 'rock')
        self.add(driftwood_log(r, 70), 200, 402, 6, 'wood')
        self.add(driftwood_log(r, 34), 360, 410, 4, 'wood')
        self.add(planks(r), 300, 418, 2, 'wood')
        self.add(barrel(), 412, 404, 7, 'wood')
        self.add(rope_coil(), 330, 400, 2, 'wood')
        self.add(driftwood_log(r, 22), 120, 438, 3, 'wood')
        self.add(driftwood_log(r, 16), 470, 392, 3, 'wood')
        self.add(planks(r), 520, 430, 2, 'wood')
        self.add(barrel(), 96, 410, 6, 'wood')
        self.add(net_scrap(), 250, 430, 1, 'wood')
        self.add(net_scrap(), 610, 384, 1, 'wood')
        for (x, y, sz) in [(300, 230, 9), (420, 160, 12), (620, 250, 8), (90, 150, 10), (700, 120, 7)]:
            spr = Sprite(int(sz * 3), int(sz * 2.4))
            stone(spr, spr.w / 2, spr.h / 2, sz, sz * 0.72, 'stone', 5, seed=x + y)
            for yy, xx in zip(*np.nonzero(spr.mask)):
                if yy < spr.h * 0.4 and hash01(xx, yy, 2) < 0.3:
                    spr.rgb[yy, xx] = C('moss', 5)
            self.add(spr.outline(), x, y, sz * 1.2, 'rock')
        for (x, y) in [(240, 200), (380, 250), (560, 280), (660, 180), (130, 250)]:
            self.add(heather(r), x, y, 5, 'plant')
        for k in range(14):
            for course in range(3):
                x = 520 + k * 7 + (course % 2) * 3
                y = 100 + k * 1.5 - course * 5
                spr = Sprite(12, 9)
                stone(spr, 6, 4.5, 4.2, 3.0, 'stone', 4 + course, seed=int(x * 7 + course))
                self.add(spr.outline(), x, y + 4 + course * 5, 6 + course * 5, 'rock')
        self.wreck = wreck_hull(r)
        self.add(self.wreck, 726, 548, 22, 'wreck')
        # The fire ring on the upper beach, where the steerer and Hild have made camp.
        self.fire = (262, 352)
        for k in range(9):
            a = k / 9 * math.pi * 2
            st = Sprite(8, 6, 4, 4)
            blob(st, 4, 3, 3, 2.2, 'stone', 5)
            st.outline()
            self.add(st, self.fire[0] + math.cos(a) * 9, self.fire[1] + math.sin(a) * 5 + 2, 2, 'stone')

    def _place_plants(self):
        r = self.r
        s = self.s
        tussock = fbm(H, W, 20, 37)
        drift = fbm(H, W, 34, 38)
        for _ in range(14000):
            x, y = r.uniform(0, W), r.uniform(0, H)
            xi, yi = int(x), int(y)
            sv = s[yi, xi]
            if sv < -168 and not self.cut[yi, xi]:
                if self.track[yi, xi]:
                    continue
                if self.bog[yi, xi]:
                    if r.random() < 0.08:
                        self.tufts.append(('clover', x, y, 6, r.random()))      # cotton grass
                    elif r.random() < 0.12:
                        self.tufts.append(('reed', x, y, r.uniform(5, 8), r.random()))
                    continue
                tu, d = tussock[yi, xi], drift[yi, xi]
                if tu > 0.5 and r.random() < (tu - 0.5) * 4.0:
                    self.tufts.append(('grass', x, y, r.uniform(5, 9), r.random()))
                elif d > 0.6 and r.random() < (d - 0.6) * 3.0:
                    k = 'thrift' if sv > -230 else ('clover' if d > 0.68 else 'trefoil')
                    self.tufts.append((k, x, y, r.uniform(3, 5), r.random()))
                elif r.random() < 0.16:
                    self.tufts.append(('grass', x, y, r.uniform(3, 5), r.random()))
            elif -146 < sv < -96 and r.random() < 0.3 and not self.cut[yi, xi]:
                self.tufts.append(('marram', x, y, r.uniform(7, 13), r.random()))
            elif -168 <= sv < -158 and r.random() < 0.12 and not self.cut[yi, xi]:
                self.tufts.append(('thrift', x, y, 3, r.random()))
        self.tufts.sort(key=lambda t: t[2])

    # ------------------------------------------------------------ dynamics
    def gust(self, x, y, t):
        """The wind field: gusts travel east one pattern-length per loop."""
        u = (x - t / LOOP * GUST_PERIOD) % GUST_PERIOD
        return gust_at(u, y)

    def water(self, frame, t, wet_buf):
        """Layered waves, foam that runs up and back, wetting and drying the sand."""
        s = self.s
        xs = self.xs
        phase2 = 2 * math.pi * t / LOOP
        # The waterline: two uprushes per loop, out of step along the beach.
        uprush = 8 * np.sin(phase2 * 2 - xs / 60 + self.tone * 3) - 4
        covered = s > -uprush - 6
        depth = s + uprush + 6
        # Water colour darkens with depth, banded, with dithered steps (Book 7: water gradients).
        dd = np.clip(depth / 150, 0, 1)
        band = banded(1 - dd, 7)
        sea_idx = 1 + band * 7
        # Layered swell: two sets of crests moving shorewards.
        warpw = self.tone * 3 + self.wavenoise * 2.5
        w1 = np.sin(depth / 9 + phase2 * 4 + xs / 140 + warpw)
        w2 = np.sin(depth / 5.3 + phase2 * 6 - xs / 70 + 1 + warpw * 0.7)
        broken = self.wavenoise2 > 0.4
        crest = ((w1 > 0.84) & broken) | ((w2 > 0.92) & (depth < 70) & ~broken)
        trough = (w1 < -0.9) & (depth > 30) & broken
        sea_idx = sea_idx + crest * 1.5 - trough * 0.8
        col = ramp_lookup('sea', sea_idx)
        # Breakers and the swash: foam lace near the edge.
        lace = value_noise(H, W, 3, 61 + int(t * 5) % 7) > 0.45
        foam_edge = covered & (depth < 2.5)
        foam_band = covered & (depth < 22) & crest & lace
        thin = covered & (depth < 12)
        # The thin film of water over sand lets the sand show through.
        col[thin] = col[thin] * 0.55 + frame[thin] * 0.45
        col[foam_band] = ramp_lookup('sea', 9 + 0 * depth[foam_band])
        col[foam_edge] = ramp_lookup('sea', 10 - (lace[foam_edge] * 1))
        # Glints of the low sun on the swell, flickering.
        gl = crest & (value_noise(H, W, 2, 71 + int(round(t * 12.5)) % 997) > 0.93) & (depth > 18) & (xs < 420)
        col[gl] = ramp_lookup('sea', 10 + 0 * depth[gl])
        frame[covered] = col[covered]
        # Sand the foam has just left stays dark and shiny, then dries over a few seconds.
        wet_buf[covered] = t
        since = t - wet_buf
        damp = (~covered) & (since < 2.8) & (s > -26)
        k = np.clip(1 - since / 2.8, 0, 1)[damp][:, None]
        frame[damp] = frame[damp] * (1 - 0.45 * k) + ramp_lookup('sky', 2 + 0 * since[damp]) * 0.25 * k
        return covered

    def kelp_underwater(self, frame, t):
        r = rng(81)
        for _ in range(26):
            x0, y0 = 470 + r.uniform(0, 160), 520 + r.uniform(0, 60)
            ph = r.random() * 6.28
            for k in range(9):
                sway = math.sin(2 * math.pi * t / LOOP * 2 + ph + k * 0.4) * k * 0.35
                xx, yy = int(x0 + sway + k * 0.4), int(y0 - k)
                if 0 <= xx < W and 0 <= yy < H:
                    frame[yy, xx] = frame[yy, xx] * 0.6 + C('kelp', 2) * 0.4


_GUST = None


def gust_at(u, y):
    global _GUST
    if _GUST is None:
        _GUST = fbm(H, GUST_PERIOD, 40, 91, 2, period_x=GUST_PERIOD)
    g = _GUST[int(y) % H, int(u) % GUST_PERIOD]
    return max(0.0, (g - 0.35) * 2.2)


_FB = None


def fbm_cache(x, y):
    global _FB
    if _FB is None:
        _FB = fbm(H, W, 20, 51)
    return _FB[int(max(0, min(H - 1, y))), int(max(0, min(W - 1, x)))]


# ------------------------------------------------------------ prop builders
def rock_pile(r, w, h, wet_line, boulders=12):
    """A jumble of boulders lit from the upper left: dark and wet below the tide mark with weed
    hanging from it and barnacles above it, lichen on the crowns, a tide pool in a hollow."""
    spr = Sprite(w + 6, h + 6, (w + 6) // 2, h + 2)
    stones = []
    for i in range(boulders):
        big = i < max(1, boulders // 4)
        rx = r.uniform(w * 0.14, w * 0.22) if big else r.uniform(w * 0.06, w * 0.13)
        ry = rx * r.uniform(0.62, 0.82)
        # The big stones sit at the back and middle, the small ones round the foot.
        cx = r.uniform(rx + 3, w - rx + 3)
        cy = (r.uniform(h * 0.35, h * 0.6) if big else r.uniform(h * 0.5, h - ry + 2))
        stones.append((cy + ry, cx, cy, rx, ry, r.integers(0, 3)))
    for _, cx, cy, rx, ry, kind in sorted(stones):
        base = (5, 6, 4)[kind]
        stone(spr, cx, cy, rx, ry, 'stone', base, seed=int(cx * 31 + cy * 7))
        # A dark crevice under each stone where it meets the next.
        for x in range(int(cx - rx * 0.7), int(cx + rx * 0.7)):
            yy = int(cy + ry * 0.92)
            if 0 <= yy < spr.h and spr.mask[yy, x]:
                spr.rgb[yy, x] = C('stone', 1)
    tide = h - wet_line * 0.5
    for y in range(spr.h):
        for x in range(spr.w):
            if not spr.mask[y, x]:
                continue
            col = spr.rgb[y, x]
            if y > tide:
                # Wet rock: darker and cooler, weed hanging in strands.
                wet = col * 0.55 + C('sea', 1) * 0.25
                strand = hash01(x, 0, 4) < 0.45 and (y - tide) < 3 + hash01(x, 1, 5) * 9
                spr.rgb[y, x] = C('kelp', 2 + int(hash01(x, y // 2, 6) * 3)) if strand else wet
            elif y > tide - 4 and hash01(x // 2, y, 5) < 0.4:
                spr.rgb[y, x] = C('wool', 4 + int(hash01(x, y, 8) * 2))   # barnacles
            elif hash01(x // 2, y // 2, 6) < 0.07 and y < tide - 6:
                spr.rgb[y, x] = C('moss', 5 + int(hash01(x, y, 7) * 2))    # lichen
    if boulders > 6:
        cx, cy = w * 0.46, h * 0.42
        for y in range(int(cy - 3), int(cy + 4)):
            for x in range(int(cx - 7), int(cx + 8)):
                if ((x - cx) / 7) ** 2 + ((y - cy) / 3) ** 2 < 1 and spr.mask[y, x]:
                    spr.rgb[y, x] = C('sky', 2 if y < cy - 1 else 4)
                    if hash01(x, y, 9) < 0.1:
                        spr.rgb[y, x] = C('kelp', 3)
    return spr.outline()


def driftwood_log(r, length):
    spr = Sprite(length + 8, 14, (length + 8) // 2, 11)
    for x in range(3, length + 3):
        t = (x - 3) / length
        thick = 3.2 + math.sin(t * 9) * 0.6 - t * 0.8
        cy = 7 + math.sin(t * 4) * 1.5
        for y in range(int(cy - thick), int(cy + thick) + 1):
            dy = (y - cy) / thick
            shade = 5 - (dy + 0.7) * 2.2
            if hash01(x, 1, 2) < 0.15:
                shade -= 1            # cracks along the grain
            spr.px(x, y, C('driftwood', shade))
    # A root bole at one end and a snapped branch.
    blob(spr, 5, 7, 4, 5, 'driftwood', 5)
    for k in range(6):
        spr.px(length // 2 + k, 3 - k // 2, C('driftwood', 4))
    return spr.outline()


def planks(r):
    spr = Sprite(30, 12, 15, 9)
    for (x0, y0, ln, ang) in [(2, 4, 24, 0.12), (6, 7, 20, -0.08)]:
        for k in range(ln):
            for w_ in range(3):
                spr.px(int(x0 + k), int(y0 + k * ang + w_), C('tar', 4 - w_ + (1 if k % 7 == 0 else 0)))
        spr.px(int(x0 + ln - 3), int(y0 + ln * ang), C('stone', 7))   # an iron nail
    return spr.outline()


def barrel():
    spr = Sprite(14, 14, 7, 12)
    blob(spr, 7, 7, 5.5, 6, 'tar', 3)
    for y in (3, 10):
        for x in range(2, 13):
            if spr.mask[y, x]:
                spr.px(x, y, C('stone', 3))
    for y in range(5, 9):
        spr.px(10, y, C('earth', 0))     # a broken stave
    return spr.outline()


def heather(r):
    """A low clump of heather on the machair's edge, purple-brown, lit from the upper left."""
    spr = Sprite(22, 12, 11, 10)
    for k in range(9):
        cx, cy = r.uniform(5, 17), r.uniform(4, 8)
        blob(spr, cx, cy, r.uniform(2.5, 4), r.uniform(2, 3), 'weld', 2)
    for y, x in zip(*np.nonzero(spr.mask)):
        if hash01(x, y, 4) < 0.3:
            spr.rgb[y, x] = C('violet', 2 + int(hash01(x, y, 5) * 2))
    return spr.outline()


def net_scrap():
    """A torn piece of fishing net with a float, washed up in the wrack."""
    spr = Sprite(18, 10, 9, 8)
    for y in range(1, 9):
        for x in range(1, 17):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                if ((x - 9) / 8) ** 2 + ((y - 5) / 4) ** 2 < 1:
                    spr.px(x, y, C('wool', 3 if (x + y) % 2 else 2))
    blob(spr, 14, 3, 1.8, 1.5, 'madder', 3)
    return spr


def rope_coil():
    spr = Sprite(14, 9, 7, 7)
    for k in range(70):
        a = k * 0.45
        rad = 2 + k / 18
        spr.px(int(7 + math.cos(a) * rad), int(4 + math.sin(a) * rad * 0.55), C('wool', 2 + (k % 3)))
    return spr.outline()


def wreck_hull(r):
    """Thorkel's boat on the skerry: planks lying over, the stern stove in, the mast snapped."""
    w, h = 96, 54
    spr = Sprite(w, h, w // 2, h - 8)
    for x in range(4, 90):
        t = (x - 4) / 85
        top = 22 - 13 * math.sin(math.pi * min(1, t * 1.1))
        bot = top + 4 + 22 * math.sin(math.pi * min(1, t * 1.05)) ** 0.6
        for y in range(int(top), int(bot)):
            strake = int((y - top) / 4.2)
            shade = 4 - strake * 0.5 - (1 if (y - top) % 4.2 < 1 else 0)
            spr.px(x, y, C('tar', shade))
        spr.px(x, int(top), C('driftwood', 5))
    for x in range(70, 92):
        for y in range(0, h):
            if spr.mask[y, x] and (x + y) % 6 != 0 and y < 34:
                spr.mask[y, x] = False
    for rx in (72, 77, 82, 87):
        for y in range(12, 36):
            spr.px(rx, y, C('driftwood', 4))
            spr.px(rx + 1, y, C('driftwood', 2))
    for y in range(4, 18):
        spr.px(44, y, C('driftwood', 5))
        spr.px(45, y, C('driftwood', 3))
    spr = spr.outline()
    spr.sail = (46, 6)            # a torn strip of sail still tied to the mast
    return spr

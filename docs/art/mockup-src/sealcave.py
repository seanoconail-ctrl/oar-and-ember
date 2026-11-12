"""Seal Cave on the north-east cliffs, at low water on a grey morning (Stage 11 mockup).

The view the steerer sees coming down to the inlet from the moor: the cliff with the cave's arch
in it, its mouth dry at low water with the wreck-scavengers' skiff drawn up inside, the steering oar
lashed on its quarter; the cove's wet sand and pools in front, the sea running in from the east
over a rock shelf, a seal on the skerry and a cormorant drying its wings; the scavengers' fire on
the dry shingle under the bank to the west, and the moor's turf coming down to the bank at the
foot of the view.

The painting helpers (`cave_face`, `cave_gloom`, `skiff`) are imported by the game's authoring
script (assets/art/authoring/stage11_art.py), so the built place is drawn from the same art.

    python3 docs/art/mockup-src/sealcave.py      # docs/art/mockups/stage-11/sealcave.png, .gif
"""
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
OUT = os.path.join(os.path.dirname(__file__), '..', 'mockups', 'stage-11')
SUN = (0.8, -0.35)
SHADE = np.array([0.6, 0.65, 0.82], np.float32)
TAU = math.tau

# The cave's arch in the view: its centre at the cliff foot, its half-width and height.
ARCH_X, ARCH_FOOT, ARCH_HALF, ARCH_H = 300, 150, 56, 86


def cliff_top(x):
    """The cliff's top edge (where the moor's turf breaks over), in view pixels."""
    return 46 + 9 * math.sin(x / 71) + 5 * math.sin(x / 23 + 1.3) - (10 if 230 < x < 370 else 0)


def cliff_foot(x):
    """The cliff's foot on the cove's sand."""
    return 146 + 8 * math.sin(x / 57 + 0.6) + 4 * math.sin(x / 19) + max(0, (x - 470) * 0.45)


# ------------------------------------------------------------------ the cliff and its cave
def arch_inside(x, y, foot=ARCH_FOOT, half=ARCH_HALF, height=ARCH_H, cx=ARCH_X):
    """Whether (x, y) is inside the arch's opening: a rough pointed arch, wider at the foot."""
    u = (foot - y) / height
    if u < 0 or u > 1:
        return False
    w = half * (1 - u ** 2.2) ** 0.55 + 3 * math.sin(y / 5.3) * (1 - u)
    return abs(x - cx) < w


def cave_face(w, h, foot, cx, half, height, seed=11, top_of=None, foot_of=None):
    """The cliff face as a sprite w x h, its arch's foot on row `foot`: beds of rock broken by
    joints into blocks, each lit from the upper left (a lit top lip, a dark undercut beneath, darker
    to its right and foot), wet dark rock at the foot with weed and barnacles, lichen and thrift on
    the lit ledges, and the arch left open (transparent) where the cave runs in. `top_of(x)` and
    `foot_of(x)` are each column's top and foot rows."""
    s = Sprite(w, h, w // 2, foot)
    s.ledges = []
    r = rng(seed)
    nz = value_noise(h, w, 5, seed)
    nz2 = value_noise(h, w, 2, seed + 1)
    wav = value_noise(64, w, 23, seed + 2)
    # Beds: irregular thickness, each with its own run of joints.
    beds = []
    y = 0.0
    while y < h + 20:
        thick = r.uniform(9, 17)
        joints = []
        x = r.uniform(-30, 0)
        while x < w + 40:
            joints.append(x)
            x += r.uniform(14, 42)
        beds.append((y, thick, joints, r.random()))
        y += thick
    big = value_noise(h, w, 30, seed + 3)
    for x in range(w):
        top = top_of(x) if top_of is not None else 0
        base = min(h, int(foot_of(x)) if foot_of is not None else h)
        # Buttresses standing out and recesses falling back, along the face.
        stand = math.sin(x / 41 + big[0, x] * 4) * 0.5 + (big[h // 2, x] - 0.5) * 0.9
        for y in range(int(max(0, top)), base):
            if arch_inside(x, y, foot, half, height, cx):
                continue
            # Which bed (dipping gently and wandering) and which block in it.
            yy = y - x * 0.09 + 18 + (wav[min(63, y // 6), x] - 0.5) * 9
            k = 0
            while k + 1 < len(beds) and beds[k + 1][0] <= yy:
                k += 1
            b0, thick, joints, tone = beds[k]
            v = (yy - b0) / thick                       # 0 at the bed's top, 1 at its foot
            xj = x + (v - 0.5) * (6 if hash01(k, 1, seed) < 0.5 else -6) + (nz[y, x] - 0.5) * 7
            j = 0
            while j + 1 < len(joints) and joints[j + 1] <= xj:
                j += 1
            jx0 = joints[j]
            jx1 = joints[j + 1] if j + 1 < len(joints) else jx0 + 30
            u = (xj - jx0) / max(1, jx1 - jx0)          # 0 at the block's left, 1 at its right
            block = hash01(k, j, seed)
            light = (tone - 0.5) * 0.5 + (block - 0.5) * 0.5 + (nz[y, x] - 0.5) * 0.8 + stand
            light += 0.35 * (1 - v) - 0.3 * u           # lit from the upper left
            ledge = tone > 0.45
            if ledge and v < 0.1:
                light += 0.8                            # the lit lip of a ledge
                if base - y > 20 and hash01(x // 3, k, seed + 9) < 0.5 and (x + k) % 3 == 0:
                    s.ledges.append((x, y))
            elif ledge and v > 0.9:
                light -= 1.1                            # the undercut under the next lip
            if (u > 0.95 or xj - jx0 < 0.8) and block > 0.3:
                light -= 0.9                            # a joint
            col = C('stone', 3.1 + light * 1.5)
            # The arch's rim: darker, worn smooth, the shadow falling into it.
            d = abs(x - cx) - half * (1 - max(0, min(1, (foot - y) / height)) ** 2.2) ** 0.55
            if 0 <= d < 5 and foot - y < height + 4:
                col = C('stone', 1.2 + d * 0.5)
            if base - y < 15:
                # Wet rock at the foot: darker and cooler, weed hanging in strands.
                col = col * 0.55 + C('sea', 1) * 0.3
                if hash01(x, 3, seed) < 0.55 and base - y < 4 + hash01(x, 4, seed) * 10:
                    col = C('kelp', 1.5 + hash01(x, y // 2, seed) * 2.5)
            elif base - y < 20 and nz2[y, x] < 0.45:
                col = C('wool', 4 + nz2[y, x] * 3)      # barnacles above the weed
            elif ledge and v < 0.12 and nz2[y, x] > 0.72:
                col = C('moss', 4.5 + (nz2[y, x] > 0.86) * 1.5)   # lichen and moss on the lips
            elif nz2[y, x] > 0.93 and big[y, x] > 0.6 and ledge:
                col = C('trefoil', 2)                   # a yellow lichen crust
            s.rgb[y, x] = col
            s.mask[y, x] = True
    return s


def cave_gloom(w, h, foot, cx, half, height, t=0.0, seed=13):
    """What shows through the arch: the dark of the cave running back, its floor of wet sand and
    weed going down into shadow, the far wall barely seen, light off the water flickering on the
    roof. A sprite drawn behind the face (and behind anyone standing in the mouth)."""
    s = Sprite(w, h, w // 2, foot)
    nz = value_noise(h, w, 4, seed)
    for y in range(h):
        for x in range(w):
            if not arch_inside(x, y, foot, half + 2, height + 2, cx):
                continue
            u = (foot - y) / height                     # 0 at the mouth's floor, 1 at its crown
            k = abs(x - cx) / half
            depth = (1 - u) * 0.0 + u
            # The roof and walls run back into dark; the floor comes forward out of it.
            floor = u < 0.34 - 0.12 * k * k
            if floor:
                f = u / 0.34
                col = ramp_lookup('sand_wet', 2.5 - f * 2.2 + (nz[y, x] - 0.5) * 0.8) * (1 - f * 0.55)
                if nz[y, x] > 0.66:
                    col = C('kelp', 1 + (1 - f))
            else:
                col = C('stone', 0.6 + (1 - u) * 1.2 + k * 1.4 + (nz[y, x] - 0.5) * 0.6) * (0.55 + 0.35 * k)
                # Light thrown up off the water in the mouth: bright ripples on the roof.
                if 0.45 < u < 0.95 and k < 0.8:
                    r = math.sin(x / 7.3 + math.sin(y / 5.1) * 2 + TAU * t / LOOP * 3) * \
                        math.sin(y / 4.2 - TAU * t / LOOP * 2 + x / 13)
                    if r > 0.7:
                        col = col * 0.5 + C('sea', 5 + (r > 0.88) * 2) * 0.5
            col = col * (1 - 0.25 * depth)
            s.rgb[y, x] = col
            s.mask[y, x] = True
    return s


# ------------------------------------------------------------------ the scavengers' skiff
def skiff(oar=True, facing_right=True):
    """A small clinker skiff seen from the south in the three-quarter view, drawn up and listing a
    little: its far gunwale, the inside with three thwarts and two oars laid fore and aft, the near
    gunwale and three tarred strakes down to the keel, stem and stern posts rising; and the steering
    oar lashed on its starboard quarter (the near side at the stern), or gone."""
    w, h = 116, 48
    s = Sprite(w, h, w // 2, h - 7)
    x0, x1 = 6, 108
    for x in range(x0, x1):
        t = (x - x0) / (x1 - x0 - 1)
        body = math.sin(math.pi * t) ** 0.3
        rise = 9 * (1 - math.sin(math.pi * t)) ** 3
        near = 22 - rise - 2 * t                         # the near gunwale (it lists a little)
        far = near - 6 * body                            # the far gunwale, higher on screen
        keel = 22 - 2 * t + 2 + 9 * body - rise * 0.35
        for y in range(int(far), int(keel) + 1):
            if y < near:
                # The inside: the far planking, darker towards the bilge.
                depth = (y - far) / max(1, near - far)
                col = C('tar', 1.4 + depth * 1.2) if y > far + 1 else C('driftwood', 4)
            else:
                v = (y - near) / max(1, keel - near)
                strake = int(v * 3)
                col = C('tar', 4.4 - strake * 0.8 - (1.3 if (v * 3) % 1 < 0.22 else 0))
                if (x * 7 + strake * 3) % 9 == 0 and (v * 3) % 1 < 0.3:
                    col = C('stone', 5)                  # a rivet head
            s.px(x, y, col)
        s.px(x, int(near), C('driftwood', 5 if x % 6 else 4))
        s.px(x, int(far), C('driftwood', 3))
    # Thwarts across the inside, and two oars lying fore and aft along them.
    for tx in (38, 58, 78):
        t = (tx - x0) / (x1 - x0 - 1)
        near = 22 - 9 * (1 - math.sin(math.pi * t)) ** 3 - 2 * t
        far = near - 6 * math.sin(math.pi * t) ** 0.3
        for y in range(int(far) + 1, int(near)):
            s.px(tx, y, C('driftwood', 4))
            s.px(tx + 1, y, C('driftwood', 2))
    for k, dy in enumerate((-4, -2)):
        for x in range(26, 92):
            t = (x - x0) / (x1 - x0 - 1)
            y = int(22 - 2 * t + dy)
            if s.mask[y, x]:
                s.px(x, y, C('driftwood', 5 - k))
    # Stem and stern posts curling up at each end.
    for k in range(9):
        s.px(x0 - 1 + k // 5, 15 - k, C('tar', 2.5))
        s.px(x1 - k // 5, 13 - k, C('tar', 2.5))
    if oar:
        # The steering oar on the near quarter at the stern (the right end): the loom rising above
        # the gunwale, lashed at its boss with a withy, the broad blade down in the sand, and the
        # tiller across the stern.
        ax, ay, bx, by = 92, 1, 104, 44
        for k in range(70):
            f = k / 69
            x = ax + (bx - ax) * f
            y = ay + (by - ay) * f
            wide = 0 if f < 0.6 else int(1 + (f - 0.6) * 7)
            for d in range(-wide, wide + 1):
                s.px(int(round(x + d)), int(round(y)), C('driftwood', 5.5 - (d > 0) * 1.5 - f * 1.4))
        for y in (16, 17, 18):
            for x in range(96, 100):
                s.px(x, y, C('wool', 3 + (y == 17)))
        for x in range(84, 94):
            s.px(x, 3 + (x - 84) // 4, C('driftwood', 4))
    s = s.outline()
    if not facing_right:
        s.rgb = s.rgb[:, ::-1].copy()
        s.mask = s.mask[:, ::-1].copy()
        s.ax = s.w - 1 - s.ax
    return s


# ------------------------------------------------------------------ the view
class SealCave:
    def __init__(self):
        r = rng(41)
        self.r = r
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        self.xs, self.ys = xs, ys
        tone = fbm(H, W, 60, 3)
        detail = fbm(H, W, 12, 4)
        top = np.array([cliff_top(x) for x in range(W)], np.float32)
        foot = np.array([cliff_foot(x) for x in range(W)], np.float32)
        self.top, self.foot = top, foot
        # The cove: the sea comes in from the east over a rock shelf; the shoreline curves.
        self.shore = 470 - 60 * np.sin((ys - 150) / 140) - 18 * (fbm(H, W, 30, 5) - 0.5)
        # Ground layers.
        g = np.zeros((H, W, 3), np.float32)
        sand_idx = 3.2 + (tone - 0.5) * 1.6 + (detail - 0.5) * 0.9
        ripple = np.sin(xs / 3.6 + ys / 8 + fbm(H, W, 20, 9) * 9) > 0.55
        g[:] = ramp_lookup('sand_wet', sand_idx + ripple * 0.7)
        # The dry shingle beach under the bank to the west and its wrack line.
        bank_y = 262 + 14 * np.sin(xs / 60) + 6 * np.sin(xs / 17)
        beach = (xs < 250 - (ys - 200) * 0.9 + (fbm(H, W, 18, 7) - 0.5) * 70) & (ys < bank_y)
        g[beach] = ramp_lookup('sand', 4 + (detail[beach] - 0.5) * 2)
        peb = (detail > 0.64) & beach
        g[peb] = ramp_lookup('stone', 4.5 + (tone[peb] - 0.5) * 3)
        self.beach = beach
        # The moor: turf below the bank at the foot of the view, a path cut down through it.
        moor = (ys >= bank_y) & (xs < self.shore - 40 - 30 * detail)
        g[moor] = ramp_lookup('grass', 5.6 + (tone[moor] - 0.5) * 1.6 + (detail[moor] - 0.5) * 0.7)
        face = moor & (ys < bank_y + 7)
        g[face] = ramp_lookup('earth', 2 + (ys[face] - bank_y[face]) * 0.25)
        path = np.abs(xs - (120 + (ys - 260) * 0.35 + 6 * np.sin(ys / 14))) < 7
        cut = path & (ys > bank_y - 4)
        g[cut] = ramp_lookup('earth', 3.5 + (detail[cut] - 0.5) * 1.5)
        self.moor, self.path = moor & ~cut, cut
        # Pools on the sand that hold the sky.
        pools = (fbm(H, W, 22, 6) > 0.63) & ~beach & ~moor & (ys > 170)
        self.pools = pools
        self.ground = g
        self.cliff = (ys < foot[None, :].repeat(H, 0)) & (xs < 560)
        # The cliff face and the cave (sprites in view space).
        self.face = cave_face(W, int(foot.max()) + 2, ARCH_FOOT, ARCH_X, ARCH_HALF, ARCH_H, 11,
                              top_of=cliff_top, foot_of=cliff_foot)
        self._face_mask()
        # Rocks on the shelf, and the skerry with the seal.
        self.rocks = []
        for (x, y, sz, seed) in [(520, 196, 16, 1), (560, 238, 22, 2), (492, 280, 12, 3),
                                 (612, 186, 18, 4), (436, 196, 8, 5), (404, 182, 6, 6)]:
            spr = Sprite(int(sz * 2.8), int(sz * 2.2))
            stone(spr, spr.w / 2, spr.h / 2, sz, sz * 0.72, 'stone', 4, seed=seed * 17)
            self.rocks.append((y, spr.outline(), x, y, sz))
        self.skiff = skiff(True)
        # Plants: turf on the moor and the cliff top, thrift on the edges, marram by the bank.
        self.tufts = []
        for _ in range(9000):
            x, y = r.uniform(0, W), r.uniform(0, H)
            xi, yi = int(x), int(y)
            if moor[yi, xi] and not self.path[yi, xi]:
                if face[yi, xi]:
                    continue
                lip = ys[yi, xi] < bank_y[yi, xi] + 10
                kind = 'thrift' if lip and r.random() < 0.35 else 'grass'
                self.tufts.append((kind, x, y, r.uniform(4, 9), r.random()))
            elif y < top[xi] and r.random() < 0.9:
                edge = top[xi] - y < 7
                kind = 'thrift' if edge and r.random() < 0.4 else 'grass'
                self.tufts.append((kind, x, y, r.uniform(4, 8), r.random()))
            elif beach[yi, xi] and bank_y[yi, xi] - y < 26 and r.random() < 0.18:
                self.tufts.append(('marram', x, y, r.uniform(6, 10), r.random()))
        self.tufts.sort(key=lambda u: u[2])
        self.camp = (150, 214)
        self.wreckers = [('wrecker_ketill', 'idle', 'e', 128, 220), ('wrecker_svart', 'idle', 's', 176, 202),
                         ('wrecker_conn', 'gather', 'w', 196, 230)]
        self.static_shadow = self._shadows()
        # Plants on the ledges, kittiwakes nesting, water seeping down the face.
        led = sorted(set(self.face.ledges))
        self.ledge_tufts = [(('thrift' if hash01(x, y, 3) < 0.4 else 'grass'), x, y,
                             3 + hash01(x, y, 4) * 3, hash01(x, y, 5)) for (x, y) in led]
        self.kittiwakes = [(x, y) for (x, y) in led if hash01(x, y, 6) < 0.05][:14]
        self.seeps = [(x, int(cliff_top(x)) + 6) for x in (84, 152, 205, 410, 448, 515, 588)]
        self.wet = ~self.beach & ~self.moor & ~self.path & (self.ys > self.foot[None, :] + 3)

    def _face_mask(self):
        f = self.face
        f.ax, f.ay = 0, 0

    def _shadows(self):
        sh = np.zeros((H, W), np.float32)
        for (_, spr, x, y, sz) in self.rocks:
            m = np.zeros((H, W), np.float32)
            stamp_mask(m, spr, x, y, 1.0)
            for s in range(int(sz * 0.8)):
                sh = np.maximum(sh, shift(m, s * SUN[0], -s * SUN[1] * 0.3))
        # The cliff throws the cove's upper sand into shade under it.
        under = (self.ys > self.foot[None, :]) & (self.ys < self.foot[None, :] + 22) & (self.xs < 470)
        sh = np.maximum(sh, under * 0.6)
        m = np.zeros((H, W), np.float32)
        stamp_mask(m, self.skiff, 300, 182, 1.0)
        for s in range(10):
            sh = np.maximum(sh, shift(m, s * SUN[0], -s * SUN[1] * 0.3))
        soft = blur(sh, 1)
        return np.where(soft > 0.7, 1.0, np.where(soft > 0.2, 0.5, 0.0)).astype(np.float32)

    def gust(self, x, y, t):
        u = (x - t / LOOP * 320) % 320
        return max(0.0, math.sin(u / 320 * TAU) * 0.7 + 0.2 * math.sin(y / 40))

    def water(self, f, t):
        xs, ys = self.xs, self.ys
        ph = TAU * t / LOOP
        # The waterline breathes up and back over the sand: two surges a loop.
        edge = self.shore - 10 * np.sin(ph * 2 + ys / 40) - 4
        covered = (xs > edge) & (ys > self.foot[None, :] - 2)
        depth = xs - edge
        dd = np.clip(depth / 140, 0, 1)
        idx = 1.2 + banded(1 - dd, 7) * 7
        w1 = np.sin(depth / 8 - ph * 4 + ys / 90)
        w2 = np.sin(depth / 4.6 - ph * 6 + ys / 45 + 1)
        crest = (w1 > 0.86) | ((w2 > 0.93) & (depth < 60))
        idx = idx + crest * 1.4
        col = ramp_lookup('sea', idx)
        lace = value_noise(H, W, 3, 61 + int(t * 5) % 7) > 0.45
        thin = covered & (depth < 10)
        col[thin] = col[thin] * 0.55 + f[thin] * 0.45
        foam = covered & ((depth < 2.5) | ((depth < 26) & crest & lace))
        col[foam] = ramp_lookup('sea', 9.5 + 0 * depth[foam])
        f[covered] = col[covered]
        # Pools: the sky held in them, a ripple crossing in the wind.
        p = self.pools & ~covered
        rip = np.sin(xs / 3 + ys / 7 - ph * 3) > 0.8
        f[p] = ramp_lookup('sky', 3 + rip[p] * 2.5) * 0.7 + f[p] * 0.3
        # The dark sheen of sand the water has just left.
        damp = (~covered) & (xs > edge - 18) & (ys > self.foot[None, :])
        f[damp] = f[damp] * 0.78
        # Kelp swaying in the shallows over the shelf.
        r = rng(81)
        for _ in range(60):
            x0, y0 = r.uniform(480, 640), r.uniform(170, 360)
            phs = r.random() * TAU
            for k in range(8):
                sway = math.sin(ph * 2 + phs + k * 0.4) * k * 0.4
                xx, yy = int(x0 + sway), int(y0 - k)
                if 0 <= xx < W and 0 <= yy < H and covered[yy, xx]:
                    f[yy, xx] = f[yy, xx] * 0.55 + C('kelp', 2) * 0.45
        return covered

    def frame(self, t):
        f = self.ground.copy()
        self.water(f, t)
        shadow = self.static_shadow.copy()
        # The cave's gloom behind, then the face over everything north of its foot.
        gloom = cave_gloom(W, ARCH_FOOT + 2, ARCH_FOOT, ARCH_X, ARCH_HALF, ARCH_H, t)
        gloom.ax, gloom.ay = 0, 0
        stamp(f, gloom, 0, 0)
        # The skiff in the mouth, the steering oar on its quarter.
        stamp(f, self.skiff, 300, 182)
        # Drips falling from the arch's lip into the mouth.
        for k, (dx, ph0) in enumerate([(-30, 0.1), (12, 0.45), (38, 0.8)]):
            age = (t / LOOP * 4 + ph0) % 1
            fx._px(f, ARCH_X + dx, ARCH_FOOT - ARCH_H * 0.82 + age * 70, C('sea', 8))
        cliff = self.face
        m = cliff.mask
        f[:cliff.h][m] = cliff.rgb[m]
        # The cliff top: turf breaking over the edge, a dark undercut beneath it.
        for x in range(W):
            ty = int(self.top[x])
            for y in range(0, max(0, ty)):
                f[y, x] = ramp_lookup('grass', 5 + hash01(x // 3, y // 3, 2) * 1.6)
            for d in range(3):
                if 0 <= ty + d < H and m[ty + d, x] if ty + d < cliff.h else False:
                    f[ty + d, x] = C('earth', 1 + d)
        # Rocks, the seal, the cormorant.
        for (_, spr, x, y, _sz) in sorted(self.rocks, key=lambda u: u[0]):
            stamp(f, spr, x, y)
        seal = fx.seal(fx.loopsin(t, 1) > 0.3)
        stamp(f, seal, 560, 222)
        corm = fx.cormorant(fx.loopsin(t, 3) > 0)
        stamp(f, corm, 612, 168)
        # The scavengers' fire and its smoke bending east in the wind; the three about it.
        fx.draw_fire(f, *self.camp, t)
        fx.draw_smoke(f, self.camp[0], self.camp[1] - 6, t, wind=1.2)
        walkers = []
        for (who, state, facing, x, y) in self.wreckers:
            n = people48.frames_of(who, state) or 1
            k = int(t * (6 if state == 'gather' else 2.5)) % n
            spr = people48.sprite(who, state, facing, k)
            spr = people48.lit(spr, (1.18, 1.05, 0.9), side=-1 if x > self.camp[0] else 1)
            fx_contact(shadow, x, y)
            stamp(f, spr, x, y)
            walkers.append((x, y))
        # The cliff's life: ledge plants nodding, kittiwakes turning their heads, water seeping.
        for (kind, x, y, hgt, ph) in self.ledge_tufts:
            fx.draw_tuft(f, kind, x, y, hgt, ph, t, self.gust(x, y, t) * 0.7)
        for k, (x, y) in enumerate(self.kittiwakes):
            stamp(f, fx.standing_gull(int(t * 2 + k * 0.7) % 3 == 0), x, y)
        for k, (x, y0) in enumerate(self.seeps):
            for j in range(5):
                yy = y0 + ((t / LOOP * 6 + j / 5 + k * 0.13) % 1) * (cliff_foot(x) - y0)
                fx._px(f, x + math.sin(yy / 9) * 1.5, yy, C('sky', 6))
        # Glints on the wet sand, coming and going; sand blown along the dry beach.
        gl = self.wet & (value_noise(H, W, 2, 300 + int(round(t * FPS)) % 997) > 0.94)
        f[gl] = f[gl] * 0.4 + C('sky', 7) * 0.6
        fx.draw_blown_sand(f, self.beach, t, 300, 5)
        foot_wet = (self.ys < self.foot[None, :]) & (self.ys > self.foot[None, :] - 15) & self.cliff
        gl2 = foot_wet & (value_noise(H, W, 2, 500 + int(round(t * FPS)) % 997) > 0.9)
        f[gl2] = f[gl2] * 0.5 + C('sea', 8) * 0.5
        # Plants.
        for (kind, x, y, hgt, ph) in self.tufts:
            fx.draw_tuft(f, kind, x, y, hgt, ph, t, self.gust(x, y, t), walkers)
        # Spray where the swell meets the rocks.
        fx.draw_spray(f, 520, 186, t, 0.4, 7, 0.8)
        fx.draw_spray(f, 612, 176, t, 2.1, 8, 1.0)
        fx.draw_spray(f, 560, 226, t, 1.3, 9, 0.9)
        # Gulls wheeling, with their shadows.
        gbuf = np.zeros((H, W), np.float32)
        for k, (cx, cy, rad) in enumerate([(360, 120, 60), (180, 90, 44), (520, 300, 50)]):
            a = TAU * t / LOOP + k * 2.1
            fx.draw_gull(f, gbuf, cx + rad * math.cos(a), cy + rad * 0.5 * math.sin(a), 30, t)
        shadow = np.maximum(shadow, gbuf * 0.5)
        # Light: the firelight pool, cloud shadows, shade cool blue-violet, and the grade.
        pool = fx.light_pool(H, W, self.camp[0], self.camp[1] - 4, 40, t)
        f = f * (1 + pool[..., None] * np.array([0.22, 0.12, -0.02]))
        f = f * (1 - shadow[..., None] * (1 - SHADE) * 0.85)
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 640)
        f = fx.grade(f, cloud * 0.4, warm_sun=0.2)
        return f


def fx_contact(buf, x, y):
    for yy in range(int(y - 3), int(y + 4)):
        for xx in range(int(x - 8), int(x + 9)):
            if 0 <= yy < H and 0 <= xx < W and ((xx - x) / 8) ** 2 + ((yy - y) / 2.6) ** 2 < 1:
                buf[yy, xx] = max(buf[yy, xx], 0.7)


def main():
    os.makedirs(OUT, exist_ok=True)
    scene = SealCave()
    still = to_u8(scene.frame(0.0))
    Image.fromarray(still).save(os.path.join(OUT, 'sealcave.png'))
    raw = [to_u8(scene.frame(k / FPS)) for k in range(FRAMES)]
    import measure
    cont, cells = measure.continuous([r.astype(np.int16) for r in raw])
    measure.motion_map(raw[0], cells, os.path.join(OUT, 'sealcave-motion.png'))
    # The GIF keeps every other frame (6.25 fps) to stay under 4 MB; motion is measured on all 80.
    frames = [Image.fromarray(r) for r in raw[::2]]
    frames[0].save(os.path.join(OUT, 'sealcave-loop.gif'), save_all=True, append_images=frames[1:],
                   duration=int(2000 / FPS), loop=0, optimize=False)
    print(f'wrote {OUT}/sealcave.png and sealcave-loop.gif ({len(frames)} frames); '
          f'continuous motion {cont * 100:.1f}% (all {len(raw)} frames)')


if __name__ == '__main__':
    main()

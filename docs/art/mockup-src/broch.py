"""The old broch and the camp inside it (Book 3 Stage 7 mockup): stages S0 and S1.

World coordinates are the ground plane in pixels (x east, y south), and the view is the game's
3/4 top-down: a point at height z is drawn z pixels higher on screen, so screen = (x, y - z).
The window shows tiles (2.3 to 29, 4.4 to 19.4) of the steading plan (Book 9 section 04): the
broch with its centre at tile (12, 13) and its door on the south at (12, 18), the path north
through the breach and south to the shore, and the stream from the Kelda on the east.

The drystone tower is solid geometry (a ring with a batter, a ruined wall head, the door passage
under its lintel, the intramural gallery, a breach in the north), ray-cast in this projection so
its faces, wall head, cast shadows and the firelight's reach all come from the same shape. Props,
plants, creatures and people are sprites sorted by their feet; the wall's rows are drawn in the
same sort, so the south wall hides whoever stands behind it.
"""
import math
import numpy as np
from core import (C, LOOP, Sprite, blob, blur, banded, bayer, fbm, hash01, ramp_lookup, rng,
                  shift, stamp_mask, stone, value_noise)
import strand as st

W, H = 640, 360          # the world here is the view (the camera is still for the mockup)
TILE = 24
CX, CY = 236, 206        # the broch's centre on the ground (tile (12, 13) of the steading plan)
RIN, ROUT = 108, 132     # the court is 9 tiles across; the wall is a tile thick at its foot
BATTER = 0.10            # the outer face leans in as it rises
ZMAX = 76
DOOR_HALF = 11           # clear opening 22 px at the foot, 20 at the head (Book 7 section 01)
DOOR_H = 48              # clear height 48 px under the lintel (at least 46)
SUN = (1.3, -0.35)       # cast shadow per pixel of height: long and low towards the east-north-east
WIND = 1.0               # from the west
GUST_PERIOD = 320
FIRE_S0 = (232, 196)
HEARTH_S1 = (238, 204)

# The ruined wall head: height above the ground by bearing (degrees, screen: 90 is south).
_PROFILE = [(-180, 58), (-158, 63), (-135, 67), (-112, 64), (-100, 58), (-94, 14), (-90, 8),
            (-86, 12), (-80, 54), (-62, 66), (-45, 62), (-25, 50), (0, 40), (18, 26), (32, 17),
            (48, 15), (62, 22), (74, 40), (80, 56), (84, 61), (96, 61), (102, 56), (112, 50),
            (135, 45), (158, 52), (180, 58)]
_PA = np.array([p[0] for p in _PROFILE], np.float32)
_PH = np.array([p[1] for p in _PROFILE], np.float32)


def _profile(deg):
    return np.interp(deg, _PA, _PH, period=360)


# Ragged stones along the wall head and the outer face (by bearing bins of 1/4 degree).
_R = np.random.default_rng(1207)
_HEAD_NOISE = np.repeat(_R.uniform(-3.0, 2.0, 1440 // 6 + 1), 6)[:1440]
_HEAD_NOISE2 = _R.uniform(-1.0, 1.0, 1440)
_OUT_NOISE = _R.uniform(-1.6, 1.4, (1440 // 4 + 1, 40))
_GROUND = None
_PN1 = value_noise(H, W, 1, 4401)
_PN2 = value_noise(H, W, 5, 4402)


def _bin(deg):
    return (np.rint((deg + 180) * 4).astype(int)) % 1440


def wall_top(x, y):
    """The wall head's height at ground point (x, y) (vectorised)."""
    dx, dy = x - CX, y - CY
    deg = np.degrees(np.arctan2(dy, dx))
    r = np.hypot(dx, dy)
    b = _bin(deg)
    top = _profile(deg) + _HEAD_NOISE[b] + _HEAD_NOISE2[b] * 0.8
    # The inner skin stands a little higher than the outer: the head slopes outwards, broken.
    top = top - np.clip((r - RIN) / (ROUT - RIN), 0, 1) * 4
    return np.maximum(top, 3)


def solid(x, y, z, sail=None):
    """Whether the point (x, y, z) is inside the tower's stone (or the sail sheet)."""
    dx, dy = x - CX, y - CY
    r = np.hypot(dx, dy)
    deg = np.degrees(np.arctan2(dy, dx))
    b = _bin(deg)
    course = np.clip((z / 5.2).astype(int), 0, 39)
    rout = ROUT - BATTER * z + _OUT_NOISE[b // 4, course]
    top = wall_top(x, y)
    s = (r >= RIN) & (r <= rout) & (z < top) & (z >= 0)
    # The entrance passage through the south wall, under its lintel.
    half = DOOR_HALF - z / DOOR_H
    s &= ~((np.abs(x - CX) < half) & (dy > 0) & (z < DOOR_H))
    # The intramural gallery between the two skins, roofed here and there by slabs.
    arc = np.radians(deg) * (RIN + 11)
    slab = ((arc % 21) < 5) & (z > top - 6)
    gal = (r > RIN + 9) & (r < RIN + 14) & (z > 9) & (top > 34) & ~slab
    s &= ~gal
    if sail is not None:
        s |= sail(x, y, z)
    return s


# ------------------------------------------------------------------ the sail sheets
def leanto_s0(x, y, z):
    """S0: the torn sail as a lean-to facing the fire: its foot weighted with stones at the
    west wall's foot, its front edge tied along a broken oar on two forked sticks."""
    x0, x1 = 134.0, 180.0
    zs = 30 * (x - x0) / (x1 - x0)
    ragged = 1.5 * np.sin(x / 3.1) + 1.2 * np.sin(x / 1.7 + 1)
    inside = (x > x0) & (x < x1 + 0.5 * np.sin(y / 2.3)) & (y > 116 + np.sin(x / 5) * 1.5) & (y < 168 + ragged)
    return inside & (np.abs(z - zs) < 1.2)


def roof_s1(x, y, z):
    """S1: the sail stretched across the north of the court from the wall head to a ridge pole
    on two driftwood posts; its front eave stands 46 px up (Book 7: eaves clear heads)."""
    y0, y1 = 98.0, 168.0
    f = np.clip((y - y0) / (y1 - y0), 0, 1)
    sag = 3.5 * np.sin(np.pi * np.clip((x - 152) / 172, 0, 1))
    zs = 60 - 14 * f - sag * (1 - abs(2 * f - 1))
    inside = (x > 150) & (x < 324) & (y > y0 - 6) & (y < y1 + 1.5 * np.sin(x / 4.3))
    return inside & (np.abs(z - zs) < 1.3)


SAIL = {'s0': leanto_s0, 's1': roof_s1}
POSTS_S1 = [(166, 168), (308, 168)]      # the ridge pole's posts (feet)


# ------------------------------------------------------------------ the ray cast
def raycast(stage):
    """For every screen pixel: the height of the first solid point along the view ray (-1 for
    the ground), and so its world position."""
    sail = SAIL[stage]
    sy, sx = np.mgrid[0:H, 0:W].astype(np.float32)
    hz = np.full((H, W), -1, np.int16)
    for z in range(ZMAX + 1):
        hit = solid(sx, sy + z, np.float32(z), sail)
        hz[hit] = z
    return hz


def surface(stage, hz):
    """World position, kind and normal of what each pixel shows."""
    sy, sx = np.mgrid[0:H, 0:W].astype(np.float32)
    z = np.maximum(hz, 0).astype(np.float32)
    wy = sy + z
    on = hz >= 0
    sail = SAIL[stage](sx, wy, z) & on
    above = solid(sx, wy, z + 1, SAIL[stage])
    top = on & ~above & ~sail
    dx, dy = sx - CX, wy - CY
    r = np.hypot(dx, dy)
    kind = np.zeros((H, W), np.int8)            # 0 ground, 1 wall top, 2 outer face, 3 inner
    kind[top] = 1                               # face, 4 passage side, 5 sail
    face = on & ~top & ~sail
    kind[face & (r > (RIN + ROUT) / 2)] = 2
    kind[face & (r <= (RIN + ROUT) / 2)] = 3
    passage = face & (np.abs(sx - CX) < DOOR_HALF + 1) & (dy > RIN - 3) & (z < DOOR_H + 1)
    kind[passage] = 4
    kind[sail] = 5
    n = np.zeros((H, W, 3), np.float32)
    n[..., 2] = 1
    rr = np.maximum(r, 1)
    out = kind == 2
    n[out] = np.stack([dx[out] / rr[out], dy[out] / rr[out], np.full(out.sum(), 0.12)], -1)
    inn = kind == 3
    n[inn] = np.stack([-dx[inn] / rr[inn], -dy[inn] / rr[inn], np.zeros(inn.sum())], -1)
    ps = kind == 4
    n[ps] = np.stack([-np.sign(sx[ps] - CX), np.zeros(ps.sum()), np.zeros(ps.sum())], -1)
    if stage == 's0':
        sl = kind == 5
        n[sl] = np.array([-0.55, 0.0, 0.84])       # the lean-to's sheet slopes down to the west wall
    else:
        sl = kind == 5
        n[sl] = np.array([0.0, 0.2, 0.98])
    nl = np.linalg.norm(n, axis=-1, keepdims=True)
    n = np.where(nl > 1e-3, n / np.maximum(nl, 1e-3), np.array([0, 0, 1], np.float32))
    return dict(x=sx, y=wy, z=z, kind=kind, n=n, r=r, deg=np.degrees(np.arctan2(dy, dx)))


def sun_visibility(S, stage, extra=None):
    """1 where the low sun reaches the surface, 0 in the tower's (or sail's) shadow."""
    sail = SAIL[stage]
    d = np.array([-SUN[0], -SUN[1], 1.0], np.float32)
    x, y, z = S['x'].copy(), S['y'].copy(), S['z'].copy()
    x += S['n'][..., 0] * 1.2 + d[0] * 1.5
    y += S['n'][..., 1] * 1.2 + d[1] * 1.5
    z += S['n'][..., 2] * 1.2 + d[2] * 1.5
    lit = np.ones((H, W), bool)
    for k in range(ZMAX + 2):
        zz = z + k
        live = lit & (zz <= ZMAX)
        if not live.any():
            break
        hit = solid(x[live] + d[0] * k, y[live] + d[1] * k, zz[live], sail)
        idx = np.flatnonzero(live)
        lit.flat[idx[hit]] = False
    return lit


def point_visibility(S, stage, P, steps=72):
    """1 where a straight line from the surface to point P (the fire) is clear of stone."""
    sail = SAIL[stage]
    x, y, z = S['x'], S['y'], S['z']
    nx, ny, nz = S['n'][..., 0], S['n'][..., 1], S['n'][..., 2]
    x0, y0, z0 = x + nx * 1.5, y + ny * 1.5, z + nz * 1.5
    vis = np.ones((H, W), bool)
    for k in range(1, steps):
        f = k / steps
        xi = x0 + (P[0] - x0) * f
        yi = y0 + (P[1] - y0) * f
        zi = z0 + (P[2] - z0) * f
        live = vis
        idx = np.flatnonzero(live)
        hit = solid(xi.flat[idx], yi.flat[idx], zi.flat[idx], sail)
        vis.flat[idx[hit]] = False
    return vis


# ------------------------------------------------------------------ textures
def stone_face(S, kind_mask, radius, seed):
    """Drystone courses on a curved face: (ramp name per pixel as an index, step, joint mask)."""
    r = np.random.default_rng(seed)
    bounds = np.concatenate([[0], np.cumsum(r.uniform(3.6, 6.4, 60))]).astype(np.float32)
    L = r.uniform(7, 15, 61)
    off = r.uniform(0, 30, 61)
    deg = S['deg'][kind_mask]
    z = S['z'][kind_mask]
    arc = np.radians(deg + 180) * radius
    zz = z + 1.1 * np.sin(np.radians(deg) * 7 + seed) + 0.6 * np.sin(np.radians(deg) * 19)
    c = np.clip(np.searchsorted(bounds, zz, side='right') - 1, 0, 59)
    ch = bounds[c + 1] - bounds[c]
    v = (zz - bounds[c]) / ch                           # 0 at the course's foot, 1 at its top
    a = arc + off[c]
    # Stones vary in length along the course: a second, coarser cut every few stones.
    s = np.floor(a / L[c]).astype(int)
    u = a - s * L[c]
    tone = np.array([hash01(int(ci), int(si), seed) for ci, si in zip(c, s)], np.float32)
    warm = tone > 0.78
    step = 4.0 + np.floor(tone * 3.2)
    step = np.where(warm, 2.5 + np.floor(tone * 2.0), step)
    top_row = v * ch > ch - 1.2
    step = step + top_row * 1.0                          # the lit top edge of each stone
    joint = (u < 1.0) | (v * ch < 1.0)
    # Small pinning stones in some vertical joints.
    pin = (u < 2.2) & (u >= 1.0) & (np.array([hash01(int(ci), int(si), 77) for ci, si in zip(c, s)]) < 0.25)
    step = np.where(pin, step - 1.5, step)
    return dict(step=step, warm=warm, joint=joint, c=c, s=s, v=v, tone=tone)


def shade_steps(n, light, amount=2.6, bias=-0.4):
    lam = (n * np.array(light, np.float32)).sum(-1)
    return np.rint(lam * amount + bias)


def paint_static(S, stage, ground, sunlit, night=False):
    """The tower, its wall head and the sail, painted with ramp steps for day or night."""
    img = ground.copy()
    kind = S['kind']
    Ld = np.array([-SUN[0], -SUN[1], 1.0], np.float32)
    Ld /= np.linalg.norm(Ld)
    SHADE = np.array([0.6, 0.64, 0.8], np.float32)
    for k, radius, seed in ((2, ROUT, 11), (3, RIN, 23), (4, 1.0, 37)):
        m = kind == k
        if not m.any():
            continue
        if k == 4:
            # The passage sides: courses along the passage's length.
            fake = dict(S)
            fake['deg'] = (S['y'] - CY) * 2.0
            tex = stone_face(fake, m, 6.0, seed)
        else:
            tex = stone_face(S, m, radius, seed)
        z = S['z'][m]
        n = S['n'][m]
        if night:
            off = np.full(z.shape, -1.0)
        else:
            off = shade_steps(n, Ld, 2.6, -0.2)
        step = tex['step'] + off
        # Ambient occlusion: darker towards the foot and deep in the passage.
        step -= np.clip((6 - z) / 6, 0, 1) * 1.2
        if k == 4:
            depth = (S['y'][m] - (CY + RIN)) / (ROUT - RIN)       # 0 inner end, 1 outer end
            step -= 1.6 + (1 - np.clip(np.abs(depth - 0.5) * 2, 0, 1)) * 1.4
        step = np.where(tex['joint'], np.minimum(step - 2.5, 2), step)
        col = np.where(tex['warm'][:, None], ramp_lookup('stone_warm', step - 1),
                       ramp_lookup('stone', step))
        # Moss creeping up from the foot and along the tops of stones on the shaded inner
        # faces; crusts of pale lichen (and a little yellow) on the lit outer faces.
        pm = _PN1[m]
        cl = _PN2[m]
        hz = np.array([hash01(int(a), int(b), 5 + k) for a, b in zip(tex['c'], tex['s'])])
        topband = tex['v'] > 0.55
        moss = (~tex['joint']) & (pm < np.clip(0.85 - z / 9.0, 0, 1) + (cl > 0.62) * 0.25 * (z < 16))
        moss |= (~tex['joint']) & (k == 3) & topband & (hz < 0.35) & (pm < 0.55) & (cl > 0.5)
        col[moss] = ramp_lookup('moss', 3.0 + tex['v'][moss] * 1.5 + off[moss] * 0.6)
        lichen = (~tex['joint']) & (cl > 0.72) & (pm < (0.22 if k == 2 else 0.1)) & (z > 8)
        yellow = lichen & (pm < 0.025)
        col[lichen] = col[lichen] * 0.45 + ramp_lookup('wool', 4 + 0 * z[lichen]) * 0.55
        col[yellow] = col[yellow] * 0.5 + C('trefoil', 2) * 0.5
        if not night:
            shadowed = ~sunlit[m]
            col[shadowed] = col[shadowed] * SHADE
        img[m] = col
    # The doorway's dressing: one long lintel stone over the opening and two tall jamb
    # stones each side, bigger than the coursing round them (Book 7: a heavy lintel).
    m2 = (kind == 2) & (np.abs(S['x'] - CX) < DOOR_HALF + 7) & (S['y'] > CY)
    if m2.any():
        x, z = S['x'], S['z']
        lint = m2 & (z >= DOOR_H) & (z < DOOR_H + 7) & (np.abs(x - CX) < DOOR_HALF + 6)
        jamb = m2 & (z < DOOR_H) & (np.abs(x - CX) >= DOOR_HALF - 1.5) & (np.abs(x - CX) < DOOR_HALF + 5)
        lstep = 5.0 + (z >= DOOR_H + 5) * 1.0 - (z < DOOR_H + 1) * 2.0 \
            - (np.abs(x - CX) > DOOR_HALF + 4.5) * 2.5 + (x < CX - 6) * 0.5
        jstep = 4.5 + (np.abs(x - CX) < DOOR_HALF) * 0.8 - ((z.astype(int) % 24) < 1) * 2.5 \
            - (np.abs(x - CX) > DOOR_HALF + 3.5) * 2.0 + (x < CX) * 0.6
        dayk = 1.0 if night else 0.0
        for msk, stp in ((lint, lstep), (jamb, jstep)):
            col = ramp_lookup('stone', stp[msk] - dayk)
            if not night:
                col[~sunlit[msk]] = col[~sunlit[msk]] * SHADE
            img[msk] = col
    # The wall head: turf with the capstones showing at its broken rim.
    m = kind == 1
    if m.any():
        x, y, z = S['x'][m], S['y'][m], S['z'][m]
        r = S['r'][m]
        tn = np.array([hash01(int(a) // 3, int(b) // 2, 3) for a, b in zip(x, y)])
        rim = (r < RIN + 2.5) | (r > ROUT - BATTER * z - 3.0) | (tn < 0.18)
        grass = ramp_lookup('grass', 5.3 + tn * 1.8)
        st_ = ramp_lookup('stone', 6 + (tn > 0.5))
        col = np.where(rim[:, None], st_, grass)
        low = z < 22                                     # rubble slumps on the collapsed side
        col[low & ~rim] = ramp_lookup('grass', 4.5 + tn[low & ~rim] * 2)
        gap = (r > RIN + 8) & (r < RIN + 15) & (z < 40)  # the gallery's mouth, seen into
        if not night:
            col[~sunlit[m]] = col[~sunlit[m]] * SHADE
        else:
            col = col * 0.92
        img[m] = col
    # The sail: undyed wool panels, seams, a darker patch and a long tear.
    m = kind == 5
    if m.any():
        x, y = S['x'][m], S['y'][m]
        if stage == 's0':
            seam = (np.abs(((y - 116) % 11)) < 1.0)
            fold = 0.9 * np.sin(y / 3.4 + np.sin(x / 9)) + 0.5 * np.sin(y / 1.9)
            base = 2.7 + fold * 0.6 + (value_noise(H, W, 6, 404)[m] - 0.5) * 0.9 - (x < 142) * 0.8
        else:
            seam = (np.abs(((y - 98) % 12)) < 1.0)
            fold = 0.7 * np.sin(x / 5.5 + np.sin(y / 11) * 2)
            base = 3.3 + fold * 0.6 + (value_noise(H, W, 6, 404)[m] - 0.5) * 0.8
        if not night:
            base += shade_steps(S['n'][m], Ld, 1.6, 0.2)
        base -= seam * 1.2
        col = ramp_lookup('wool', base)
        patch = (np.abs(x - (198 if stage == 's1' else 152)) < 11) & (np.abs(y - (124 if stage == 's1' else 140)) < 7)
        col[patch] = ramp_lookup('wool', base[patch] - 1.6) * 0.9 + C('madder', 2) * 0.1
        stitch = patch & ((np.abs(x - (198 if stage == 's1' else 152)) > 9.6) | (np.abs(y - (124 if stage == 's1' else 140)) > 5.6))
        col[stitch] = C('wool', 1)
        if not night:
            col[~sunlit[m]] = col[~sunlit[m]] * SHADE
        img[m] = col
    # Ink edge where the tower meets the sky ground behind it and along the sail's edge,
    # so the silhouette reads (props and structures carry the one-pixel outline).
    on = kind > 0
    edge = np.zeros_like(on)
    yw = S['y']
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb = np.roll(np.roll(on, dy, 0), dx, 1)
        nby = np.roll(np.roll(yw, dy, 0), dx, 1)
        edge |= (~on) & nb & (nby > yw + 6)
    img[edge] = C('ink', 0) * 0.6 + img[edge] * 0.4
    sail = kind == 5
    sedge = np.zeros_like(sail)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sedge |= (~sail) & np.roll(np.roll(sail, dy, 0), dx, 1)
    img[sedge & (kind != 5)] = C('ink', 1) * 0.7 + img[sedge & (kind != 5)] * 0.3
    return img


# ------------------------------------------------------------------ the ground
STREAM = [(612, -12), (602, 40), (598, 86), (586, 130), (590, 168), (578, 206), (566, 250),
          (570, 288), (556, 330), (548, 372)]


def _dist_poly(xs, ys, pts):
    best = np.full(xs.shape, 1e9, np.float32)
    along = np.zeros(xs.shape, np.float32)
    acc = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        t = np.clip(((xs - x0) * dx + (ys - y0) * dy) / (L * L), 0, 1)
        px, py = x0 + t * dx, y0 + t * dy
        d = np.hypot(xs - px, ys - py)
        closer = d < best
        best = np.where(closer, d, best)
        along = np.where(closer, acc + t * L, along)
        acc += L
    return best, along


class Broch:
    def __init__(self, stage):
        self.stage = stage
        self.r = rng(70 + (stage == 's1'))
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        self.xs, self.ys = xs, ys
        self.hz = raycast(stage)
        self.S = surface(stage, self.hz)
        self.props = []        # (y_sort, sprite, x, y, height, kind)
        self.tufts = []        # (kind, x, y, height, phase, shelter, lift)
        self.ferns = []
        self._ground()
        self._props()
        self._plants()

    # -------------------------------------------------------------- ground albedo
    def _ground(self):
        xs, ys = self.xs, self.ys
        stage = self.stage
        tone = fbm(H, W, 60, 301)
        detail = fbm(H, W, 12, 302)
        g = ramp_lookup('grass', 5.3 + (tone - 0.5) * 3.0 + (detail - 0.5) * 1.2)
        r = np.hypot(xs - CX, ys - CY)
        court = r < RIN - 0.5
        self.court = court
        # The court's floor: S0 rough grass, moss and rubble with a patch cleared and trodden
        # round the fire; S1 a floor of trodden earth with bracken strewn where people sleep.
        moss = ramp_lookup('moss', 3.2 + (tone - 0.5) * 3 + (detail - 0.5) * 1.6)
        rough = ramp_lookup('grass', 4.0 + (tone - 0.5) * 2.2 + (detail - 0.5) * 1.5)
        floor = np.where((detail > 0.55)[..., None], moss, rough)
        g[court] = floor[court]
        wobble = (fbm(H, W, 14, 303) - 0.5) * 18
        if stage == 's0':
            fx_, fy_ = FIRE_S0
            clear = (np.hypot(xs - fx_ + 8, (ys - fy_ + 10) * 1.25) + wobble < 58) & court
        else:
            fx_, fy_ = HEARTH_S1
            clear = (np.hypot((xs - CX) * 0.95, (ys - CY + 30) * 1.1) + wobble < 98) & court
            to_door = (np.abs(xs - CX - (ys - 260) * 0.05) < 9 + (detail - 0.5) * 5) & (ys > 200)
            clear |= to_door & (r < ROUT + 4)
        clump = fbm(H, W, 9, 306)
        earth = ramp_lookup('earth', 3.3 + np.floor((clump - 0.5) * 3.2) * 0.5 + (tone - 0.5) * 0.6)
        sandy = ramp_lookup('earth', 4.4 + 0 * clump)
        tread = np.where(((value_noise(H, W, 4, 304) > 0.8) & (clump > 0.55))[..., None], sandy, earth)
        g[clear] = tread[clear]
        self.clear = clear
        # Paths: north through the breach, south from the door to the shore; in S1 a track
        # worn east to the stream where water is fetched.
        pn, _ = _dist_poly(xs, ys, [(CX, 96), (CX - 2, 60), (CX - 20, 30), (CX - 44, -10)])
        ps, _ = _dist_poly(xs, ys, [(CX, 300), (CX + 2, 340), (CX + 10, 372)])
        paths = [pn, ps]
        if stage == 's1':
            pe, _ = _dist_poly(xs, ys, [(CX + 12, 344), (CX + 90, 340), (CX + 200, 318), (566, 290)])
            paths.append(pe)
        self.path = np.zeros((H, W), bool)
        for k, pd in enumerate(paths):
            wdt = (3.4 if (k < 2 or stage == 's1') else 2.0) + (detail - 0.5) * 2.5
            if stage == 's0' and k == 0:
                wdt = wdt - 0.8
            core = (pd < wdt) & ~court
            g[core] = ramp_lookup('earth', 3.0 + (detail[core] - 0.5) * 2)
            worn = (pd >= wdt) & (pd < wdt + 3) & ~court
            g[worn] = ramp_lookup('grass', 4.2 + 0 * pd[worn])
            self.path |= core | worn
        # The stream from the Kelda, flowing south on the east, with mossy banks.
        sd, along = _dist_poly(xs, ys, STREAM)
        width = 6.0 + 2.0 * np.sin(along / 21) + (detail - 0.5) * 2.2
        self.stream = sd < width
        self.stream_d, self.stream_along, self.stream_w = sd, along, width
        bank = (sd >= width) & (sd < width + 4 + detail * 4)
        g[bank] = ramp_lookup('moss', 3.6 + (detail[bank] - 0.5) * 3)
        g[self.stream] = ramp_lookup('earth', 1.5 + 0 * sd[self.stream])
        self.bank = bank
        # A ring of shade and damp at the wall's foot, inside and out (contact occlusion).
        foot = (np.abs(r - ROUT) < 6) | (np.abs(r - RIN) < 5)
        k = np.clip(1 - np.minimum(np.abs(r - ROUT), np.abs(r - RIN)) / 6, 0, 1)
        g[foot] = g[foot] * (1 - 0.3 * k[foot][:, None]) + ramp_lookup('moss', 2 + 0 * k[foot]) * 0.18 * k[foot][:, None]
        # S1: ash spread round the hearth; strewn bracken under the roof.
        if stage == 's1':
            hx, hy = HEARTH_S1
            ash = (np.hypot(xs - hx, (ys - hy) * 1.5) < 26 + wobble * 0.4) & court
            g[ash] = g[ash] * 0.55 + ramp_lookup('smoke', 2 + detail[ash] * 2) * 0.45
            bed = (ys > 116) & (ys < 160) & (xs > 162) & (xs < 312) & court
            g[bed] = ramp_lookup('bracken', 2.3 + (value_noise(H, W, 2, 305)[bed] - 0.5) * 2.4)
        else:
            fx_, fy_ = FIRE_S0
            ash = (np.hypot(xs - fx_, (ys - fy_) * 1.4) < 15 + wobble * 0.2)
            g[ash] = g[ash] * 0.5 + ramp_lookup('smoke', 1.5 + detail[ash] * 2) * 0.5
        # The passage floor under the lintel: worn earth and a threshold slab, in deep shade.
        pas = (np.abs(xs - CX) < DOOR_HALF) & (ys > CY + RIN - 3) & (ys < CY + ROUT + 2)
        depth = np.clip((ys - (CY + RIN)) / (ROUT - RIN), 0, 1)
        dim = 0.42 + 0.25 * np.abs(depth - 0.45) * 2
        g[pas] = ramp_lookup('earth', 2.6 + (detail[pas] - 0.5) * 1.2) * dim[pas][:, None]
        slab = pas & (np.abs(ys - (CY + ROUT - 3)) < 2.5) & (np.abs(xs - CX) < DOOR_HALF - 1)
        g[slab] = ramp_lookup('stone', 4 + (ys[slab] < CY + ROUT - 3)) * 0.8
        self.passage_floor = pas
        self.tone = tone
        self.ground = g

    # -------------------------------------------------------------- props
    def add(self, spr, x, y, height, kind='prop'):
        self.props.append((y, spr, x, y, height, kind))

    def _props(self):
        r = self.r
        stage = self.stage
        # Tumbled stones: a spill where the south-east wall fell, and some at the foot all round.
        for k in range(46):
            a = math.radians(r.uniform(18, 72))
            d = r.uniform(-30, 30) if k < 20 else r.uniform(0, 34)
            rad = (ROUT + 4 + abs(d)) if k >= 20 or d > 0 else (RIN - 6 + d * 0.5)
            if k < 20 and d <= 0:
                rad = RIN - 4 - abs(d) * 0.6
            x, y = CX + math.cos(a) * rad, CY + math.sin(a) * rad
            sz = r.uniform(3, 7.5) * (1.0 if abs(d) < 20 else 0.7)
            self.add(_rock(x, y, sz), x, y, sz * 1.1, 'rock')
        for k in range(30):
            a = r.uniform(-math.pi, math.pi)
            rad = ROUT + r.uniform(3, 14)
            if r.random() < 0.35:
                rad = RIN - r.uniform(3, 10)
            x, y = CX + math.cos(a) * rad, CY + math.sin(a) * rad
            if abs(x - CX) < 20 and y > CY:
                continue                    # keep the doorway and its path clear
            if stage == 's1' and rad < RIN and (y < 170 or self.clear[int(y) % H, int(x) % W]):
                continue
            sz = r.uniform(2.5, 5.5)
            self.add(_rock(x, y, sz), x, y, sz, 'rock')
        # Boulders and stones in the turf beyond.
        for (x, y, sz) in [(52, 120, 9), (410, 70, 7), (470, 300, 8), (540, 120, 6), (24, 300, 7),
                           (380, 210, 5)]:
            self.add(_rock(x, y, sz, mossy=0.25), x, y, sz * 1.2, 'rock')
        for (x, y) in [(70, 70), (440, 180), (500, 40), (30, 200), (420, 330)]:
            self.add(st.heather(r), x, y, 5, 'plant')
        # Stepping stones in the stream.
        self.stepping = [(574, 214), (581, 205)]
        for (x, y) in self.stepping:
            spr = Sprite(12, 9)
            stone(spr, 6, 4.5, 4.5, 3.2, 'stone', 6, seed=int(x + y))
            self.add(spr.outline(), x, y + 3, 2, 'rock')
        if stage == 's0':
            self._camp_s0()
        else:
            self._camp_s1()

    def _camp_s0(self):
        r = self.r
        fx_, fy_ = FIRE_S0
        self.fire = (fx_, fy_)
        # A fire ring of beach stones on a bed of shingle carried up from the strand.
        for k in range(11):
            a = k / 11 * math.tau + 0.2
            s = Sprite(9, 7, 4, 5)
            blob(s, 4.5, 3.5, 3.4 + hash01(k, 3) * 0.8, 2.5, 'stone', 5 + (k % 3 == 0))
            s.outline()
            self.add(s, fx_ + math.cos(a) * 11, fy_ + math.sin(a) * 6 + 2, 2, 'stone')
        # The broken oar that holds up the lean-to, and stones weighting the sheet's foot.
        for (px, py) in ((180, 117), (180, 168)):
            self.add(_post(30, fork=True), px, py, 30, 'post')
        self.ridge = ((180, 117, 31), (180, 168, 31))
        for k in range(5):
            self.add(_rock(136, 121 + k * 11, 3), 137 + (k % 2), 121 + k * 11, 3, 'rock')
        # Salvage in heaps against the north wall: a sea chest, a cask, rope, planks, net.
        self.add(_chest(), 214, 128, 10, 'wood')
        self.add(st.barrel(), 236, 124, 8, 'wood')
        self.add(st.rope_coil(), 252, 131, 2, 'wood')
        self.add(st.planks(r), 270, 126, 2, 'wood')
        self.add(st.net_scrap(), 290, 134, 1, 'wood')
        self.add(_oar(40), 300, 118, 2, 'wood')
        # The driftwood gathered for the fire, in a loose heap.
        self.add(_wood_heap(r, 26, 3), 272, 206, 4, 'wood')
        self.add(st.driftwood_log(r, 30), 192, 226, 4, 'wood')
        self.add(_bag(), 186, 196, 6, 'wood')
        self.bedroll = (160, 163)        # the steerer sleeps under the lean-to, feet to the fire

    def _camp_s1(self):
        r = self.r
        hx, hy = HEARTH_S1
        self.fire = (hx, hy)
        # A proper hearth: a kerb of set stones round a bed of ash.
        for k in range(16):
            a = k / 16 * math.tau
            s = Sprite(9, 7, 4, 5)
            stone(s, 4.5, 3.5, 3.6, 2.4, 'stone', 6, seed=k * 7 + 3)
            s.outline()
            self.add(s, hx + math.cos(a) * 17, hy + math.sin(a) * 9 + 2, 2, 'stone')
        self.add(_pot(), hx + 14, hy - 4, 7, 'wood')
        # The roof's posts and ridge pole, and the drying lines with fish.
        for (px, py) in POSTS_S1:
            self.add(_post(48), px, py, 48, 'post')
        self.lines = [((166, 168, 40), (308, 168, 40)), ((308, 168, 38), (342, 196, 30))]
        self.fish = []
        for (a, b) in self.lines:
            n = int(math.hypot(b[0] - a[0], b[1] - a[1]) / 13)
            for k in range(1, n):
                f = k / n
                self.fish.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f,
                                  a[2] + (b[2] - a[2]) * f - 2.5 * math.sin(math.pi * f), k * 1.7))
        # Bedding under the roof: heather and bracken beds with wool blankets.
        self.add(_bed(r, 'woad'), 190, 140, 3, 'bed')
        self.add(_bed(r, 'wool'), 226, 136, 3, 'bed')
        self.add(_bed(r, 'earth'), 262, 140, 3, 'bed')
        self.bedroll = (290, 152)
        # Salvage sorted along the walls: the chest, casks, oars, rope.
        self.add(_chest(), 156, 202, 10, 'wood')
        self.add(st.barrel(), 166, 222, 8, 'wood')
        self.add(_waterskin(), 168, 172, 0, 'skin')
        self.add(st.rope_coil(), 182, 236, 2, 'wood')
        self.add(_oar(44), 150, 240, 2, 'wood')
        # The woodpile of driftwood, stacked against the east wall.
        self.add(_woodpile(r), 318, 222, 14, 'wood')
        self.add(st.driftwood_log(r, 22), 290, 236, 3, 'wood')
        # The driftwood door, standing in the doorway (drawn with the wall).
        self.door = _door()

    # -------------------------------------------------------------- plants
    def _plants(self):
        r = self.r
        S = self.S
        tussock = fbm(H, W, 20, 311)
        drift = fbm(H, W, 34, 312)
        rr = np.hypot(self.xs - CX, self.ys - CY)
        for _ in range(16000):
            x, y = r.uniform(0, W), r.uniform(0, H + 30)
            xi, yi = int(x), min(H - 1, int(y))
            rad = math.hypot(x - CX, y - CY)
            if RIN - 1 < rad < ROUT + 2 or self.path[yi, xi] or self.stream[yi, xi]:
                continue
            inside = rad < RIN
            if inside and (self.clear[yi, xi] or (self.stage == 's1')):
                if not (self.stage == 's1' and rad > RIN - 9 and r.random() < 0.35 and not self.clear[yi, xi]):
                    continue
            if self.bank[yi, xi]:
                if r.random() < 0.3:
                    self.tufts.append(('reed', x, y, r.uniform(6, 10), r.random(), 1.0, 0))
                continue
            shelter = 0.35 if inside else 1.0
            tu, d = tussock[yi, xi], drift[yi, xi]
            near_foot = abs(rad - ROUT) < 14 or (inside and rad > RIN - 12)
            if near_foot and r.random() < 0.5:
                self.tufts.append(('grass', x, y, r.uniform(6, 10), r.random(), shelter, 0))
            elif tu > 0.5 and r.random() < (tu - 0.5) * 4.0:
                self.tufts.append(('grass', x, y, r.uniform(5, 9), r.random(), shelter, 0))
            elif d > 0.62 and r.random() < (d - 0.62) * 3.5 and not inside:
                k = ('thrift', 'clover', 'trefoil')[int(hash01(xi // 40, yi // 40, 9) * 3)]
                self.tufts.append((k, x, y, r.uniform(3, 5), r.random(), shelter, 0))
            elif r.random() < 0.2:
                self.tufts.append(('grass', x, y, r.uniform(3, 5), r.random(), shelter, 0))
        # Grass and thrift on the wall head, in the full wind.
        top = np.argwhere(S['kind'] == 1)
        for (sy, sx) in top[r.choice(len(top), 420, replace=False)]:
            z = S['z'][sy, sx]
            wy = S['y'][sy, sx]
            rad = S['r'][sy, sx]
            if rad < RIN + 3 or rad > ROUT - BATTER * z - 3:
                continue
            k = 'thrift' if r.random() < 0.28 else 'grass'
            self.tufts.append((k, float(sx), float(wy), r.uniform(3, 7), r.random(), 1.25, float(z)))
        # Ferns in the shade at the foot of the inner wall, and in the passage's mouth.
        for _ in range(26):
            a = r.uniform(-math.pi, math.pi)
            if math.sin(a) > 0.55:
                continue
            rad = RIN - r.uniform(2, 6)
            x, y = CX + math.cos(a) * rad, CY + math.sin(a) * rad
            if self.clear[int(y) % H, int(x) % W] and self.stage == 's1':
                continue
            self.ferns.append((x, y, r.random()))
        self.tufts.sort(key=lambda t: t[2])

    def gust(self, x, y, t):
        u = (x - t / LOOP * GUST_PERIOD) % GUST_PERIOD
        return st.gust_at(u, y)


# ------------------------------------------------------------------ prop builders
def _rock(x, y, sz, mossy=0.1):
    spr = Sprite(int(sz * 2.8) + 4, int(sz * 2.2) + 4)
    stone(spr, spr.w / 2, spr.h / 2, sz, sz * 0.72, 'stone', 5, seed=int(x * 13 + y * 7))
    for yy, xx in zip(*np.nonzero(spr.mask)):
        if yy < spr.h * 0.42 and hash01(xx, yy, int(x)) < mossy:
            spr.rgb[yy, xx] = C('moss', 5)
        elif hash01(xx, yy, int(y)) < 0.03:
            spr.rgb[yy, xx] = C('wool', 4)          # crusts of lichen
    return spr.outline()


def _oar(length, broken=False):
    """A ship's oar of tarred pine, lying; a broken one stands for the lean-to's ridge."""
    spr = Sprite(length + 10, 8, (length + 10) // 2, 6)
    for k in range(length):
        spr.px(3 + k, 3, C('driftwood', 5))
        spr.px(3 + k, 4, C('driftwood', 3))
    blade = 0 if broken else 12
    for k in range(blade):
        for w in (2, 3, 4, 5):
            spr.px(3 + length - blade + k, w, C('driftwood', 6 - (w > 3) - (w == 5)))
    if broken:
        for k in range(4):
            spr.px(3 + length + k % 2, 3 + k % 3, C('driftwood', 6))   # splintered end
    return spr.outline()


def _chest():
    """A sea chest: oak boards, iron bands and a sloped lid, lit from the upper left."""
    spr = Sprite(22, 17, 11, 15)
    for y in range(3, 15):
        for x in range(2, 20):
            lid = y < 8
            step = (4 if lid else 3) - (x > 16) + (y == 3)
            spr.px(x, y, C('tar', step))
    for x in range(2, 20):
        spr.px(x, 8, C('tar', 1))
    for x in (5, 16):
        for y in range(3, 15):
            spr.px(x, y, C('stone', 3 if y > 8 else 4))
    spr.px(11, 9, C('stone', 6))
    spr.px(11, 10, C('stone', 3))
    return spr.outline()


def _bag():
    spr = Sprite(12, 12, 6, 10)
    blob(spr, 6, 6.5, 4.2, 4.0, 'wool', 3)
    spr.px(6, 2, C('earth', 3))
    spr.px(5, 2, C('earth', 2))
    return spr.outline()


def _pot():
    """A soapstone cooking pot with a handle loop, on the hearth's kerb."""
    spr = Sprite(14, 13, 7, 11)
    blob(spr, 7, 7, 5, 4.5, 'stone_warm', 2)
    for x in range(3, 12):
        spr.px(x, 3, C('stone_warm', 4))
        spr.px(x, 4, C('stone_warm', 1))
    for x in range(4, 11):
        spr.px(x, 4, C('earth', 1))
    spr.px(2, 3, C('stone', 2))
    spr.px(12, 3, C('stone', 2))
    return spr.outline()


def _post(h, fork=False):
    """A driftwood post, bark gone, silver-grey, with the lashing for the ridge pole."""
    spr = Sprite(7, h + 4, 3, h + 2)
    if fork:
        spr.px(1, 1, C('driftwood', 5))
        spr.px(5, 1, C('driftwood', 4))
        spr.px(1, 2, C('driftwood', 5))
        spr.px(5, 2, C('driftwood', 4))
    for y in range(2, h + 2):
        for x in (2, 3, 4):
            spr.px(x, y, C('driftwood', 6 - (x - 2) * 1.5 - (hash01(y // 3, x, 4) < 0.2)))
    for y in (6, 7, 8):
        for x in (1, 2, 3, 4, 5):
            spr.px(x, y, C('wool', 2 + (x + y) % 2))
    return spr.outline()


def _bed(r, blanket):
    """A bed of heather and bracken heaped on the floor, a blanket over it."""
    spr = Sprite(34, 16, 17, 13)
    for k in range(10):
        cx, cy = r.uniform(5, 29), r.uniform(5, 11)
        blob(spr, cx, cy, r.uniform(3, 5), r.uniform(2, 3), 'bracken', 2)
    for y, x in zip(*np.nonzero(spr.mask)):
        if hash01(x, y, 6) < 0.25:
            spr.rgb[y, x] = C('violet', 1 + (hash01(x, y, 2) < 0.5))
    ramp = {'woad': 'woad', 'wool': 'wool', 'earth': 'earth'}[blanket]
    base = {'woad': 3, 'wool': 3, 'earth': 4}[blanket]
    for y in range(4, 11):
        for x in range(9, 27):
            if ((x - 18) / 9.5) ** 2 + ((y - 7.5) / 3.8) ** 2 < 1:
                fold = (x * 2 + y) % 9 == 0
                spr.px(x, y, C(ramp, base + (y < 6) - (y > 9) - fold))
    return spr.outline()


def _waterskin():
    """A goatskin water bag hanging from the post by a thong (anchored at its hook)."""
    spr = Sprite(10, 16, 5, 0)
    for y in range(0, 4):
        spr.px(5, y, C('earth', 2))
    blob(spr, 5, 9.5, 3.6, 5.2, 'earth', 4)
    spr.px(3, 13, C('earth', 1))
    spr.px(7, 7, C('earth', 5))
    return spr.outline()


def _wood_heap(r, n, seed):
    spr = Sprite(40, 18, 20, 15)
    rr = np.random.default_rng(seed)
    for k in range(n):
        x0, y0 = rr.uniform(4, 30), rr.uniform(6, 14)
        ln = rr.uniform(7, 14)
        ang = rr.normal(0, 0.35) + (0 if k % 2 else math.pi)
        tone = rr.integers(3, 6)
        for j in range(int(ln)):
            x = x0 + math.cos(ang) * j
            y = y0 + math.sin(ang) * j * 0.5 - (k / n) * 4
            spr.px(int(x), int(y), C('driftwood', tone + (j == 0)))
            spr.px(int(x), int(y) + 1, C('driftwood', tone - 2))
    return spr.outline()


def _woodpile(r):
    """Driftwood split and stacked in rows against the wall, the cut ends showing."""
    spr = Sprite(36, 30, 18, 27)
    for row in range(5):
        y = 24 - row * 4
        for k in range(7 - row // 2):
            x = 4 + k * 4 + (row % 2) * 2
            for dy in range(3):
                for dx in range(4):
                    end = dx == 0
                    col = C('driftwood', 6 - dy) if not end else C('bracken', 3 - dy * 0.5)
                    spr.px(x + dx, y + dy, col)
            spr.px(x + 1, y + 1, C('bracken', 4) if hash01(row, k, 5) < 0.5 else C('driftwood', 6))
    return spr.outline()


def _door():
    """The driftwood door: weathered planks of uneven length lashed to two battens with rope,
    standing ajar in the doorway (Book 7 section 06, S1)."""
    w, h = 22, 49
    spr = Sprite(w, h, w // 2, h - 1)
    lengths = [44, 47, 46, 45, 47, 43]
    for p, ln in enumerate(lengths):
        x0 = 1 + p * 3
        for y in range(h - ln, h):
            for dx in range(3):
                g = (hash01(p, y // 4, 7) < 0.18)
                step = 5 - dx - g + (y == h - ln)
                spr.px(x0 + dx, y, C('driftwood', step))
        spr.px(x0 + 2, h - ln + 3, C('driftwood', 2))
    for by in (12, 34):
        for x in range(1, 19):
            spr.px(x, by, C('driftwood', 3))
            spr.px(x, by + 1, C('driftwood', 2))
        for x in (3, 9, 15):
            spr.px(x, by, C('wool', 3))
            spr.px(x, by + 1, C('wool', 2))
    return spr.outline()

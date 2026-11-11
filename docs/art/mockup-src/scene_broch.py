"""Renders the Stage 7 mockup: the broch shelter and the camp at S0 and S1, by day and by night.

    python3 docs/art/mockup-src/scene_broch.py            # all four (writes docs/art/mockups/stage-07/)
    python3 docs/art/mockup-src/scene_broch.py s1 night   # one of them

Each is a still and a seamless 6.4-second loop at 640 x 360 (12.5 frames a second), like the
approved references. Day is the windswept late afternoon of the Wreck Strand target; night is a
blue-grey moonlit grade with the fire's light pool flickering on the floor and the inner wall,
spilling out through the doorway.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
import fx
import people48 as P48
import broch as B
from broch import CX, CY, H, W, RIN, ROUT, SUN, DOOR_H, DOOR_HALF
from core import C, FPS, FRAMES, LOOP, Sprite, banded, bayer, blur, hash01, ramp_lookup, shift, stamp_mask, to_u8
from kelda import fern
from scene_strand import cast, contact

OUT = os.path.join(os.path.dirname(__file__), '..', 'mockups', 'stage-07')
SHADE = np.array([0.6, 0.64, 0.8], np.float32)
TAU = 2 * math.pi
BAY = bayer(H, W)


def lsin(t, cycles, phase=0.0):
    return math.sin(TAU * t / LOOP * cycles + phase)


# ------------------------------------------------------------------ small animated pieces
def fish_sprite(swing):
    """A split fish (saithe or cod) hung by the tail to dry: grey-brown flesh, dark skin edge."""
    s = Sprite(7, 13, 3, 0)
    for y in range(1, 12):
        half = [0, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1][y - 1]
        dx = int(round(swing * y / 11))
        for x in range(-half, half + 1):
            edge = abs(x) == half
            s.px(3 + x + dx, y, C('seal', 3) if edge else C('stone_warm', 4 - (y > 8) + (x < 0)))
    s.px(3, 0, C('wool', 2))
    s.px(2 + int(round(swing)), 12, C('seal', 2))
    s.px(4 + int(round(swing)), 12, C('seal', 2))
    return s.outline()


def skin_sprite(swing):
    s = Sprite(11, 18, 5, 0)
    for y in range(0, 5):
        s.px(5 + int(round(swing * y / 16)), y, C('earth', 2))
    for y in range(5, 16):
        dx = swing * y / 16
        w = [1, 2, 3, 3, 4, 4, 4, 4, 3, 3, 2][y - 5]
        for x in range(-w, w + 1):
            s.px(int(round(5 + x + dx)), y, C('earth', 4 + (x < 0) - (y > 13) - (x == w)))
    return s.outline()


def wheatear(turn, bob):
    """A wheatear on the wall head: grey back, buff breast, black mask and wings, white rump."""
    s = Sprite(9, 7, 4, 6)
    for (x, y) in [(3, 3), (4, 3), (5, 3), (3, 4), (4, 4), (5, 4), (6, 4)]:
        s.px(x, y, C('gull', 2))
    s.px(4, 4, C('sand', 5))
    s.px(5, 4, C('sand', 5))
    s.px(2, 3 + bob, C('wool', 6))                 # the white rump, flicking with the tail
    s.px(1, 3 + bob, C('ink', 1))
    hx = 6 if not turn else 3
    s.px(hx, 2, C('gull', 3))
    s.px(hx + (1 if not turn else -1), 2, C('ink', 0))
    s.px(4, 5, C('ink', 1))
    return s.outline(C('ink', 1))


def sheep_lying(t, phase):
    """A ewe lying in the dark turf, chewing; now and then she lifts her head."""
    s = Sprite(20, 12, 10, 10)
    for y in range(2, 10):
        for x in range(2, 17):
            dx, dy = (x - 9.5) / 7.5, (y - 6.5) / 3.6
            if dx * dx + dy * dy <= 1:
                s.px(x, y, C('fleece', 4 - dy * 1.5 - dx * 0.6 + (hash01(x, y, 3) < 0.2) * 0.6))
    up = lsin(t, 1, phase) > 0.5
    hy = 3 if up else 5
    for (x, y) in [(16, hy), (17, hy), (16, hy + 1), (17, hy + 1), (18, hy + 1)]:
        s.px(x, y, C('seal', 2))
    return s.outline()


def sleeper(cloak_rgb, hem_rgb, head, breath):
    """The steerer asleep on their side, rolled in the dark wool cloak with its madder hem,
    the head on a fold of sail: the approved head and colours laid down (a mockup pose)."""
    s = Sprite(40, 14, 20, 12)
    lift = 1 if breath else 0
    for x in range(10, 36):
        f = (x - 10) / 26
        top = 5 - lift * (x < 26) + (f > 0.8) * (f - 0.8) * 10
        for y in range(int(top), 12):
            shade = 4 - (y - top) * 0.45 + (y == int(top)) * 0.6
            s.px(x, y, cloak_rgb[int(max(0, min(len(cloak_rgb) - 1, shade)))])
        s.px(x, 11, hem_rgb[1] if x % 7 else hem_rgb[0])
    for x in range(12, 34, 5):
        s.px(x, int(5 - lift) + 2, cloak_rgb[1])
    # The head, from the steerer's own sprite, turned to lie on its side.
    hh, hw = head.shape[:2]
    for y in range(hh):
        for x in range(hw):
            if head[y, x, 3] > 0:
                s.px(2 + y, 2 + (hw - 1 - x) // 1 + 0, head[y, x, :3])
    return s.outline()


def head_of(who='steerer_a'):
    spr = P48.sprite(who, 'idle', 'e', 0)
    rows = range(8, 19)
    out = np.zeros((len(rows), 10, 4), np.float32)
    for i, y in enumerate(rows):
        for j, x in enumerate(range(20, 30)):
            if spr.mask[y, x]:
                out[i, j, :3] = spr.rgb[y, x]
                out[i, j, 3] = 1
    return out


def bandage(spr):
    """Hild's shin bound with a strip of linen (her injury, treated)."""
    out = Sprite(spr.w, spr.h, spr.ax, spr.ay)
    out.rgb[:] = spr.rgb
    out.mask[:] = spr.mask
    out.cloth = getattr(spr, 'cloth', np.zeros((spr.h, spr.w), bool))
    for y in range(spr.ay - 7, spr.ay - 2):
        for x in (spr.ax + 7, spr.ax + 8):
            if spr.mask[y, x] and spr.mask[y - 1, x] and spr.mask[y + 1, x]:
                out.rgb[y, x] = C('wool', 5 if x == spr.ax + 7 else 4)
    return out


# ------------------------------------------------------------------ fire, smoke and sparks
def draw_fire(f, x, y, t, size=1.0, logs=True):
    """Flames over crossed driftwood on a bed of embers that pulse."""
    if logs:
        for k in range(-7, 8):
            fx._px(f, x + k, y + 1 + (k % 3 == 0), C('tar', 1 + (k % 2)))
            fx._px(f, x + k * 0.8, y - k * 0.25, C('driftwood', 2 + (k > 0)))
            fx._px(f, x + k * 0.8, y + k * 0.25 - 1, C('driftwood', 1 + (k < 0)))
        for k in range(-5, 6):
            glow = 0.5 + 0.5 * math.sin(t * 5 + k * 1.9)
            fx._px(f, x + k, y + 2, C('fire', 1 + glow * 3))
    for col in range(-5, 6):
        hgt = (9 - abs(col) * 1.35) * size * (0.62 + 0.3 * abs(math.sin(t * 8.7 + col * 1.7)) +
                                                0.2 * math.sin(t * 21 + col * 2.3))
        for k in range(int(max(1, hgt))):
            fr = k / max(1, hgt)
            lean = fr * fr * 1.5 * size
            fx._px(f, x + col + lean, y - k, C('fire', 7 - fr * 6.2 - (abs(col) > 3)))
    for e in range(6):
        age = (t * 1.1 + e / 6) % 1
        ex = x + math.sin(e * 3 + t * 4) * 3 + age * 4
        ey = y - 8 * size - age * 14
        if age < 0.7:
            fx._px(f, ex, ey, C('fire', 6 if age < 0.35 else 4))


def smoke_particles(fire, t, wall=56, night=False):
    """Smoke rises straight up inside the sheltered court, then bends hard downwind (east) once
    it clears the wall head, thinning as it goes. Returns (x, y, radius, density, age)."""
    x0, y0 = fire
    out = []
    for p in range(22):
        age = (t / LOOP * 3 + p / 22) % 1
        h = 6 + age * 120
        over = max(0.0, h - wall)
        drift = over ** 1.25 * 0.9 + math.sin(p * 2.1 + TAU * t / LOOP * 2) * (1.5 + age * 3)
        x = x0 + 1 + drift
        y = y0 - h + over * 0.25
        r = 2 + age * 11
        dens = 0.62 * (1 - age) ** 0.8
        out.append((x, y, r, dens, age))
    return out


def draw_smoke(f, parts, col_fn):
    for (cx, cy, r, dens, age) in parts:
        x0, x1 = int(cx - r), int(cx + r) + 1
        y0, y1 = int(cy - r), int(cy + r) + 1
        for yy in range(max(0, y0), min(H, y1)):
            for xx in range(max(0, x0), min(W, x1)):
                if (xx - cx) ** 2 + (yy - cy) ** 2 < r * r and BAY[yy, xx] < dens:
                    f[yy, xx] = f[yy, xx] * 0.45 + col_fn(age, yy) * 0.55


def sparks(fire, t, n=10):
    x0, y0 = fire
    pts = []
    for e in range(n):
        ph = hash01(e, 7)
        age = (t / LOOP * (5 + e % 3) + ph) % 1
        h = 10 + age * 80
        over = max(0.0, h - 50)
        x = x0 + math.sin(e * 2.3 + age * 9) * (2 + age * 6) + over ** 1.3 * 0.9
        y = y0 - h
        if age < 0.85 and hash01(e, int(t * 12.5)) < 0.85:
            pts.append((x, y, age))
    return pts


# ------------------------------------------------------------------ the renderer
class BrochRenderer:
    def __init__(self, stage, night):
        self.stage, self.night = stage, night
        self.w = w = B.Broch(stage)
        S = w.S
        self.S = S
        kind = S['kind']
        self.ground_px = kind == 0
        # The static paint: the sun's shadows by day; ambient moonlight by night.
        if not night:
            self.sun = B.sun_visibility(S, stage)
        else:
            self.sun = np.ones((H, W), bool)
        base = B.paint_static(S, stage, w.ground, self.sun, night=night)
        g = self.ground_px
        if not night:
            base[g & ~self.sun] *= SHADE
        # Props: their shadows (long by day) and contact occlusion, computed once.
        sh = np.zeros((H, W), np.float32)
        ao = np.zeros((H, W), np.float32)
        for (_, spr, x, y, hgt, k) in w.props:
            if k == 'skin':
                continue
            m = np.zeros((H, W), np.float32)
            stamp_mask(m, spr, x, y, 1.0)
            if not night:
                for s in range(0, int(hgt * 1.25) + 1):
                    sh = np.maximum(sh, shift(m, s * SUN[0], s * SUN[1]) * (1.0 if s < hgt else 0.6))
            ao = np.maximum(ao, blur(m, 2) * 1.3)
        soft = blur(sh, 1)
        pshadow = np.where(soft > 0.75, 1.0, np.where(soft > 0.2, 0.5, 0.0)).astype(np.float32)
        pshadow *= self.sun                 # already in the tower's shadow: no double darkening
        k = np.maximum(pshadow * 0.75, np.clip(ao, 0, 1) * 0.42)[..., None] * g[..., None]
        base = base * (1 - k) + base * SHADE * k
        self.base = base
        # The wall's rows, for drawing it in the same sort as everything standing on the ground.
        wy = S['y'].astype(int)
        on = ~g
        self.slices = {}
        for Y in np.unique(wy[on]):
            self.slices[int(Y)] = np.flatnonzero(on & (wy == Y))
        # The fire: where it is, what it can see, how far each surface is from it.
        fxy = w.fire
        self.F = (fxy[0], fxy[1], 10.0)
        vis = B.point_visibility(S, stage, self.F)
        d = np.stack([self.F[0] - S['x'], self.F[1] - S['y'], self.F[2] - S['z']], -1)
        dist = np.linalg.norm(d, axis=-1)
        ndl = (S['n'] * d).sum(-1) / np.maximum(dist, 1)
        ndl = np.where(kind == 0, 1.0, np.clip(ndl * 1.2, 0, 1))
        self.fire_static = vis * ndl
        self.fire_dist = dist
        # Wind: the gust field (sheltered inside the court).
        self.gx_field = None
        self.cloak = None
        self._sleeper_cache = {}

    # -------------------------------------------------------------- actors
    def actors(self, t):
        w = self.w
        stage, night = self.stage, self.night
        fx_, fy_ = w.fire
        out = []
        if not night:
            look = lsin(t, 1, 0.6)
            facing = 'w' if look < 0.35 else ('s' if look < 0.8 else 'n')
            state = 'glance' if facing == 's' else ('shift' if lsin(t, 2, 1) > 0.4 else 'idle')
            n = P48.frames_of('steerer_a', state)
            spr = P48.sprite('steerer_a', state, facing, int(t * 4) % n)
            if stage == 's0':
                pos = (fx_ + 28, fy_ + 8)
                hild_pos = (fx_ - 24, fy_ + 4)
            else:
                pos = (fx_ + 34, fy_ + 14)
                hild_pos = (fx_ - 24, fy_ + 9)
            gust = w.gust(pos[0], pos[1], t) * 0.4
            spr = _flutter(spr, gust, int(t * 8))
            out.append({'x': pos[0], 'y': pos[1], 'sprite': spr, 'who': 'steerer'})
            hild = bandage(P48.sprite('hild', 'sit', 'e', int(t * 3.1) % 4))
            out.append({'x': hild_pos[0], 'y': hild_pos[1], 'sprite': hild, 'who': 'hild'})
        else:
            hild_pos = (fx_ - 22, fy_ + 5) if stage == 's0' else (fx_ - 26, fy_ + 9)
            hild = bandage(P48.sprite('hild', 'sit', 'e', int(t * 3.1) % 4))
            out.append({'x': hild_pos[0], 'y': hild_pos[1], 'sprite': hild, 'who': 'hild'})
        self.hild_pos = hild_pos
        return out

    def _sleeper(self, breath):
        if breath not in self._sleeper_cache:
            idle = P48.sprite('steerer_a', 'idle', 'n', 0)
            # The cloak's own ramp, read from the approved cloak layer's pixels.
            cols = idle.rgb[idle.cloth]
            lum = cols.mean(axis=1)
            order = np.argsort(lum)
            uniq = []
            for c in cols[order]:
                if not any(np.allclose(c, u) for u in uniq):
                    uniq.append(c)
            cloak = [u for u in uniq if u[0] < u[1] * 1.25 + 8][:5] or uniq[:5]
            hem = [C('madder', 2), C('madder', 3)]
            self._sleeper_cache[breath] = sleeper(cloak, hem, head_of(), breath)
        return self._sleeper_cache[breath]

    # -------------------------------------------------------------- one frame
    def frame(self, t):
        w, S = self.w, self.S
        night, stage = self.night, self.stage
        f = self.base.copy()
        g = self.ground_px
        # Position buffers for the light pass (sprites overwrite them with their own).
        PX, PY, PZ = S['x'].copy(), S['y'].copy(), S['z'].copy()
        fire_k = self.fire_static.copy()
        fire_d = self.fire_dist.copy()
        self._water(f, t)
        self._sail_wind(f, t)
        actors = self.actors(t)
        # Dynamic shadows: people and birds by day (long, from the sun); by night the fire
        # throws everyone's shadow away from it.
        dyn = np.zeros((H, W), np.float32)
        occ = np.zeros((H, W), np.float32)
        for a in actors:
            if not night:
                cast(dyn, a['sprite'], a['x'], a['y'], 0.9)
            contact(occ, a['x'], a['y'] - 1, 7, 2.5, 0.8)
        creatures = self._creatures(t, dyn, occ)
        if not night:
            soft = blur(dyn, 1) * 1.2
            shadow = np.where(soft > 0.6, 1.0, np.where(soft > 0.15, 0.5, 0.0)) * self.sun
        else:
            shadow = np.zeros((H, W), np.float32)
        shadow = np.maximum(shadow, occ) * g
        k = (shadow * 0.75)[..., None]
        f = f * (1 - k) + f * SHADE * k
        if night:
            self._fire_shadows(fire_k, actors)
        base = f.copy()
        flat = f.reshape(-1, 3)
        bflat = base.reshape(-1, 3)
        # Everything standing on the ground, and the wall's rows, sorted by their feet.
        items = []
        for (_, spr, x, y, hgt, kind) in w.props:
            if kind == 'skin':
                continue
            items.append((y, 1, 'sprite', spr, x))
        for a in actors:
            items.append((a['y'], 1, 'actor', a['sprite'], a['x']))
        for tf in w.tufts:
            items.append((tf[2], 1, 'tuft', tf, None))
        for fe in w.ferns:
            items.append((fe[1], 1, 'fern', fe, None))
        items += creatures
        items += self._camp_items(t)
        for Y, idx in self.slices.items():
            items.append((Y + 0.5, 0, 'slice', idx, None))
        items.sort(key=lambda it: (it[0], it[1]))
        for (y, _, kind, obj, x) in items:
            if kind == 'slice':
                flat[obj] = bflat[obj]
            elif kind == 'tuft':
                k_, tx, ty, hgt, ph, shelter, lift = obj
                gust = w.gust(tx, ty, t) * shelter
                if lift:
                    fx.draw_tuft(f, k_, tx, ty - lift, hgt, ph, t, gust)
                else:
                    fx.draw_tuft(f, k_, tx, ty, hgt, ph, t, gust)
            elif kind == 'fern':
                fern(f, obj[0], obj[1], t, obj[2], w.gust(obj[0], obj[1], t) * 0.3)
            elif kind == 'fn':
                obj(f)
            else:
                self._stamp(f, obj, x, y, PX, PY, PZ, fire_k, fire_d)
        fire = w.fire
        if not night:
            # Day: the fire burns low; smoke bends away east over the wall head.
            draw_fire(f, fire[0], fire[1], t, 0.75)
            draw_smoke(f, smoke_particles(fire, t), lambda a, yy: C('smoke', 4.4 - a * 2.6))
            for (sx, sy, age) in sparks(fire, t, 4):
                fx._px(f, sx, sy, C('fire', 6 - age * 3))
            for b in self._birds(t):
                b(f)
            view = f
            cloud = fx.cloud_shadow(H, W, t, 0, 0, 1280)
            out = fx.grade(view, cloud, warm_sun=1.0)
            pool = fx.light_pool(H, W, fire[0], fire[1] - 4, 56, t)[..., None]
            out = out * (1 + pool * np.array([0.42, 0.2, 0.0])) + pool * np.array([18, 7, 0])
            return out
        # Night: a blue-grey moonlit grade, then the firelight in flickering bands.
        cloud = fx.cloud_shadow(H, W, t, 0, 0, 1280, seed=131)
        grey = f.mean(axis=2, keepdims=True)
        out = (f * 0.72 + grey * 0.28) * np.array([0.30, 0.355, 0.50]) + np.array([6, 9, 17])
        out *= (1 - 0.2 * cloud)[..., None]
        flick = 0.93 + 0.04 * math.sin(t * 11.3) + 0.03 * math.sin(t * 26.9 + 1.3) + \
            0.02 * math.sin(t * 4.1)
        R = 150 * flick
        L = fire_k * np.clip(1 - fire_d / R, 0, 1) ** 1.45
        Lb = banded(np.clip(L * 1.15, 0, 1), 6)
        out = out + f * Lb[..., None] * np.array([1.30, 0.74, 0.30]) * flick + \
            Lb[..., None] * np.array([22, 8, 0])
        # Light through the gaps of the driftwood door and its open edge, from the court.
        # Smoke, lit warm from below near the fire.
        def smoke_col(age, yy):
            warm = max(0.0, 1 - age * 3.5)
            return C('smoke', 1.6 - age * 0.8) * np.array([0.42, 0.46, 0.6]) + warm * np.array([34, 14, 2])
        draw_smoke(out, smoke_particles(fire, t), smoke_col)
        draw_fire(out, fire[0], fire[1], t, 1.15 if stage == 's1' else 1.0)
        for (sx, sy, age) in sparks(fire, t, 14):
            fx._px(out, sx, sy, C('fire', 7 - age * 4))
        self._moths(out, t)
        return out

    def _stamp(self, f, spr, x, y, PX, PY, PZ, fire_k, fire_d):
        """Stamps a sprite and records its position for the light pass."""
        x0 = int(round(x)) - spr.ax
        y0 = int(round(y)) - spr.ay
        sx0, sy0 = max(0, -x0), max(0, -y0)
        ex, ey = min(spr.w, W - x0), min(spr.h, H - y0)
        if ex <= sx0 or ey <= sy0:
            return
        m = spr.mask[sy0:ey, sx0:ex]
        ys_ = slice(y0 + sy0, y0 + ey)
        xs_ = slice(x0 + sx0, x0 + ex)
        f[ys_, xs_][m] = spr.rgb[sy0:ey, sx0:ex][m]
        if self.night:
            fxp, fyp, fzp = self.F
            hh = (y - np.arange(y0 + sy0, y0 + ey, dtype=np.float32))[:, None] * np.ones((1, ex - sx0))
            xx = np.arange(x0 + sx0, x0 + ex, dtype=np.float32)[None, :] * np.ones((ey - sy0, 1))
            d = np.sqrt((xx - fxp) ** 2 + (y - fyp) ** 2 + (hh - fzp) ** 2)
            xi, yi = int(min(W - 1, max(0, x))), int(min(H - 1, max(0, y)))
            v = 1.0 if self.w.court[yi, xi] else float(self.fire_static[yi, xi])
            # The side of a figure away from the fire takes less of its light.
            side = np.clip(0.55 + 0.45 * np.sign(fxp - x) * (xx - x) / 8, 0.35, 1.0)
            fd = fire_d[ys_, xs_]
            fk = fire_k[ys_, xs_]
            fd[m] = d[m]
            fk[m] = (v * side)[m]
            fire_d[ys_, xs_] = fd
            fire_k[ys_, xs_] = fk

    def _fire_shadows(self, fire_k, actors):
        """At night each figure's shadow falls on the floor away from the fire."""
        fxp, fyp, _ = self.F
        buf = np.zeros((H, W), np.float32)
        for a in actors + [{'x': self.w.bedroll[0], 'y': self.w.bedroll[1], 'sprite': None}]:
            spr = a['sprite']
            if spr is None:
                continue
            dx, dy = a['x'] - fxp, a['y'] - fyp
            dd = max(1.0, math.hypot(dx, dy))
            ux, uy = dx / dd, dy / dd
            for yy, xx in zip(*np.nonzero(spr.mask)):
                hgt = spr.ay - yy
                gx = int(round(a['x'] + ux * hgt * 1.3 + (xx - spr.ax) * 0.5 * -uy))
                gy = int(round(a['y'] + uy * hgt * 1.3 + (xx - spr.ax) * 0.5 * ux))
                if 0 <= gy < H and 0 <= gx < W:
                    buf[gy, gx] = 1
        soft = blur(buf, 1)
        fire_k *= 1 - np.where(soft > 0.5, 0.65, np.where(soft > 0.12, 0.35, 0.0)) * self.ground_px

    # -------------------------------------------------------------- the camp's moving parts
    def _camp_items(self, t):
        w = self.w
        items = []
        if self.stage == 's0':
            (x0, y0, z0), (x1, y1, z1) = w.ridge
            def ridge(f):
                for k in range(int(y1 - y0) + 1):
                    yy = y0 + k
                    fx._px(f, x0, yy - z0, C('driftwood', 5 - (k % 9 == 0)))
                    fx._px(f, x0 + 1, yy - z0, C('driftwood', 3))
                    fx._px(f, x0 - 1, yy - z0, C('ink', 1))
                    fx._px(f, x0 + 2, yy - z0, C('ink', 1))
                # The torn edge of the sail hangs off the ridge and lifts in the gusts.
                gust = w.gust(x0, y0 + 30, t)
                for k in range(0, int(y1 - y0), 2):
                    yy = y0 + k
                    ln = 2 + int(2 * hash01(k, 3)) + int(round(gust * 2 + 0.8 * lsin(t, 5, k * 0.7)))
                    for j in range(ln):
                        fx._px(f, x0 + 2 + j * 0.6, yy - z0 + 1 + j, C('wool', 3 - j * 0.4))
            items.append((y1 + 0.4, 1, 'fn', ridge, None))
            bx, by = w.bedroll
            breath = lsin(t, 2) > 0.2
            if self.night:
                items.append((by, 1, 'sprite', self._sleeper(breath), bx))
            else:
                items.append((by, 1, 'sprite', _bedroll_empty(), bx))
        else:
            # The drying lines: rope sagging between the posts and to the wall, fish swinging.
            for (a, b) in w.lines:
                def line(f, a=a, b=b):
                    n = int(math.hypot(b[0] - a[0], b[1] - a[1] - (b[2] - a[2])))
                    for k in range(n + 1):
                        fr = k / max(1, n)
                        x = a[0] + (b[0] - a[0]) * fr
                        y = a[1] + (b[1] - a[1]) * fr
                        z = a[2] + (b[2] - a[2]) * fr - 2.5 * math.sin(math.pi * fr)
                        fx._px(f, x, y - z, C('wool', 2))
                items.append((max(a[1], b[1]) - 0.2, 1, 'fn', line, None))
            for (x, y, z, ph) in w.fish:
                gust = w.gust(x, y, t) * 0.6
                swing = gust * 2.2 + 0.9 * lsin(t, 3, ph)
                spr = fish_sprite(swing)
                items.append((y, 1, 'sprite', _hang(spr, z), x))
            sk = skin_sprite(0.8 * lsin(t, 2, 1.0) + w.gust(166, 168, t) * 0.8)
            items.append((168.6, 1, 'sprite', _hang(sk, 30), 170))
            bx, by = (226, 141)
            if self.night:
                items.append((by + 0.5, 1, 'sprite', self._sleeper(lsin(t, 2) > 0.2), bx))
            # The driftwood door in the doorway, at the passage's inner end, standing ajar.
            items.append((CY + RIN + 6, 1, 'sprite', w.door, CX - 3))
        # Hild's work: by night she tends the fire with a stick; by day, S0, she rests her
        # bound leg and feeds the fire; S1, she cooks a fish on a stick over the hearth.
        hx, hy = self.hild_pos
        fxp, fyp = w.fire
        def stick(f):
            poke = 0.5 + 0.5 * lsin(t, 2 if self.night else 1, 0.4)
            sx, sy = hx + 8, hy - 16
            ex = fxp - 6 + poke * 4
            ey = fyp - 2 - (1 - poke) * 3
            n = int(math.hypot(ex - sx, ey - sy))
            for k in range(n + 1):
                fr = k / max(1, n)
                fx._px(f, sx + (ex - sx) * fr, sy + (ey - sy) * fr, C('driftwood', 4 - (fr > 0.85) * 3))
            if self.stage == 's1' and not self.night:
                for dx in range(-2, 3):
                    fx._px(f, ex + dx, ey - 1, C('stone_warm', 4 - (dx == 2)))
                    fx._px(f, ex + dx, ey, C('seal', 3))
            elif poke > 0.7:
                fx._px(f, ex, ey, C('fire', 6))
        items.append((hy + 0.6, 1, 'fn', stick, None))
        return items

    def _water(self, f, t):
        w = self.w
        s = w.stream
        along = w.stream_along
        flow = np.sin(along / 5.5 - t / LOOP * TAU * 6 + w.stream_d * 0.9)
        flow2 = np.sin(along / 2.7 - t / LOOP * TAU * 9 - w.stream_d * 1.3)
        sidx = 5.2 - (w.stream_w - w.stream_d) * 0.28 + (flow > 0.8) * 2 + (flow2 > 0.92) * 1.5
        col = ramp_lookup('sea', sidx)
        near = np.zeros_like(s)
        for (x, y) in w.stepping:
            near |= np.hypot(w.xs - x, w.ys - y) < 9
        narrow = s & (w.stream_w < 4.6)
        foam = (narrow | near) & ((flow > 0.45) | (flow2 > 0.6))
        col[foam] = ramp_lookup('sea', 9.4 + 0 * sidx[foam])
        edge = s & (w.stream_d > w.stream_w - 1.3)
        col[edge] = col[edge] * 0.55 + f[edge] * 0.45
        if not self.night:
            gl = s & (flow2 > 0.97) & (np.sin(w.xs * 1.7 + t * 9) > 0.6)
            col[gl] = C('sea', 10)
        else:
            gl = s & (flow > 0.96) & (np.sin(w.xs * 2.3 + w.ys + t * 7) > 0.75)
            col[gl] = C('sea', 9)
        f[s] = col[s]

    def _sail_wind(self, f, t):
        """Ripples run across the sail in the gusts; the court shelters the lean-to more."""
        S = self.S
        m = S['kind'] == 5
        if not m.any():
            return
        x, y = S['x'][m], S['y'][m]
        amp = 0.6 if self.stage == 's0' else 1.0
        wave = np.sin(x / 6.5 - TAU * t / LOOP * 4 + np.sin(y / 9) * 1.5) * amp + \
            0.5 * np.sin(x / 3.1 + y / 4 - TAU * t / LOOP * 7)
        q = np.rint(wave)
        f[m] = f[m] * (1 + 0.075 * q[:, None])

    def _creatures(self, t, dyn, occ):
        w = self.w
        items = []
        sheep = [(60, 186, 0.3, True), (432, 128, 2.1, False), (476, 270, 4.0, True)]
        for (sx, sy, ph, right) in sheep:
            if not self.night:
                x = sx + 3 * lsin(t, 1, ph)
                spr = fx.sheep(t, ph, right)
                cast(dyn, spr, x, sy, 0.8)
            else:
                x = sx
                spr = sheep_lying(t, ph)
            contact(occ, x, sy - 1, 9, 3, 0.8)
            items.append((sy, 1, 'sprite', spr, x))
        if not self.night:
            # A wheatear on the east wall head, bobbing and turning.
            S = self.S
            bx, by_world, bz = 352, 196, None
            col = np.nonzero((S['kind'][:, bx] == 1))[0]
            if len(col):
                sy_ = col[len(col) // 2]
                bz = S['z'][sy_, bx]
                by_world = S['y'][sy_, bx]
                spr = wheatear(lsin(t, 3) > 0.3, int(t * 6) % 3 == 0)
                hop = 2 * max(0.0, lsin(t, 2, 2.0)) ** 8
                items.append((by_world + 0.1, 1, 'sprite', _lift(spr, bz + hop), bx + (lsin(t, 1, 1) > 0.6) * 3))
        return items

    def _birds(self, t):
        calls = []
        for i, (cx, cy, rad, cyc) in enumerate([(420, 120, 80, 1), (300, 90, 60, -1), (120, 240, 70, 1)]):
            a = TAU * t / LOOP * cyc + i * 2.1
            x = cx + math.cos(a) * rad
            y = cy + math.sin(a) * rad * 0.5 - 30
            calls.append(lambda fr, x=x, y=y, i=i: fx.draw_gull(fr, np.zeros((H, W), np.float32), x, y, 1.0, t + i))
        return calls

    def _moths(self, out, t):
        fxp, fyp = self.w.fire
        for i in range(4):
            a = TAU * t / LOOP * (2 + i % 2) + i * 1.7
            x = fxp + math.cos(a) * (14 + i * 4) + math.sin(a * 3 + i) * 3
            y = fyp - 22 - i * 5 + math.sin(a * 2) * 6
            open_ = int(t * 14 + i) % 2
            fx._px(out, x, y, C('wool', 6) * 0.9 + np.array([20, 8, 0]))
            fx._px(out, x - 1, y - open_, C('wool', 5) * 0.8)
            fx._px(out, x + 1, y - open_, C('wool', 5) * 0.8)


def _hang(spr, z):
    """Re-anchors a hanging sprite so it draws `z` pixels above its foot point."""
    s = Sprite(spr.w, spr.h, spr.ax, int(round(-z)))
    s.rgb[:] = spr.rgb
    s.mask[:] = spr.mask
    return s


def _lift(spr, z):
    s = Sprite(spr.w, spr.h, spr.ax, spr.ay + int(round(z)))
    s.rgb[:] = spr.rgb
    s.mask[:] = spr.mask
    return s


def _bedroll_empty():
    """By day the bedding under the lean-to: heather pulled for a mattress, a fold of sailcloth."""
    s = Sprite(36, 12, 18, 10)
    for k in range(9):
        cx, cy = 6 + k * 3.2, 6 + (k % 3) * 0.8
        for y in range(int(cy - 2.5), int(cy + 3)):
            for x in range(int(cx - 3), int(cx + 3)):
                if ((x - cx) / 3) ** 2 + ((y - cy) / 2.6) ** 2 < 1:
                    s.px(x, y, C('bracken', 2 + (y < cy) + (hash01(x, y, 2) < 0.2)))
    for x in range(4, 14):
        for y in range(4, 8):
            s.px(x, y, C('wool', 3 + (y == 4) - (y == 7)))
    return s.outline()


def _flutter(spr, gust, tick):
    """The cloak's lee edge lifts a little in the gusts that reach into the court."""
    out = Sprite(spr.w, spr.h, spr.ax, spr.ay)
    out.rgb[:] = spr.rgb
    out.mask[:] = spr.mask
    if gust < 0.12:
        return out
    for y in range(spr.h):
        xs = np.nonzero(spr.cloth[y])[0]
        if len(xs) == 0 or y < spr.ay - 26:
            continue
        edge = xs.max()
        reach = int(round(gust * (1.0 + (y - (spr.ay - 26)) / 12) + (0.6 if (y + tick) % 4 < 2 else 0)))
        col = spr.rgb[y, edge].copy()
        for k in range(1, reach + 1):
            if edge + k + 1 < spr.w:
                out.px(edge + k, y, col)
                out.px(edge + k + 1, y, C('ink', 0))
    return out


# ------------------------------------------------------------------ output
NAMES = {('s0', False): 's0-day', ('s0', True): 's0-night', ('s1', False): 's1-day', ('s1', True): 's1-night'}


def render(stage, night, frames=FRAMES, still_at=0.3):
    R = BrochRenderer(stage, night)
    name = NAMES[(stage, night)]
    os.makedirs(OUT, exist_ok=True)
    imgs = []
    for i in range(frames):
        imgs.append(Image.fromarray(to_u8(R.frame(i / FPS))))
        print(f'\r{name} frame {i + 1}/{frames}', end='', file=sys.stderr)
    print(file=sys.stderr)
    still = imgs[int(frames * still_at)]
    still.save(os.path.join(OUT, f'{name}.png'))
    # The 4x crop of the broch's court, fire and doorway.
    crop = still.crop((116, 80, 356, 350)).resize((960, 1080), Image.NEAREST)
    crop.save(os.path.join(OUT, f'{name}-broch-4x.png'))
    pal = [im.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in imgs]
    pal[0].save(os.path.join(OUT, f'{name}.gif'), save_all=True, append_images=pal[1:],
                duration=int(1000 / FPS), loop=0, disposal=1)
    return imgs


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        stage, night = sys.argv[1], sys.argv[2] == 'night'
        n = int(sys.argv[3]) if len(sys.argv) > 3 else FRAMES
        render(stage, night, n)
    else:
        for key in NAMES:
            render(*key)

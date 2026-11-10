"""Renders Wreck Strand frames: the target still, the loop and the walking capture."""
import math
import numpy as np
import fx
import people
from core import C, LOOP, Sprite, banded, blur, shift, stamp, stamp_mask
from strand import H, W, Strand, VIEW

SUN = (1.1, -0.3)       # cast shadow per pixel of height: long, low, towards the east-north-east
SHADE = np.array([0.6, 0.64, 0.8], np.float32)  # shadows go cool blue-violet, never black


def cast(buf, spr, x, y, height_scale=1.0, strength=1.0):
    """A sprite's shadow laid flat on the ground away from the low sun."""
    x0 = int(round(x)) - spr.ax
    y0 = int(round(y)) - spr.ay
    for yy, xx in zip(*np.nonzero(spr.mask)):
        hgt = (spr.ay - yy) * height_scale
        gx = int(round(x + hgt * SUN[0] + (xx - spr.ax) * 0.35))
        gy = int(round(y + hgt * SUN[1] * 0.6 + (xx - spr.ax) * 0.45))
        if 0 <= gy < buf.shape[0] and 0 <= gx < buf.shape[1]:
            buf[gy, gx] = max(buf[gy, gx], strength)
            if gx + 1 < buf.shape[1]:
                buf[gy, gx + 1] = max(buf[gy, gx + 1], strength)


def contact(buf, x, y, rx, ry, strength):
    """Ambient occlusion where something meets the ground: a soft dark ellipse."""
    for yy in range(int(y - ry - 1), int(y + ry + 2)):
        for xx in range(int(x - rx - 1), int(x + rx + 2)):
            if 0 <= yy < buf.shape[0] and 0 <= xx < buf.shape[1]:
                d = ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2
                if d < 1:
                    buf[yy, xx] = max(buf[yy, xx], strength * (1.0 if d < 0.45 else 0.55))


class StrandRenderer:
    def __init__(self):
        self.world = Strand()
        w = self.world
        self.base = w.ground.copy()
        dm = w.decals.mask
        self.base[dm] = w.decals.rgb[dm]
        # Static shadows and occlusion of the props, computed once.
        sh = np.zeros((H, W), np.float32)
        ao = np.zeros((H, W), np.float32)
        for (_, spr, x, y, hgt, kind) in w.props:
            m = np.zeros((H, W), np.float32)
            stamp_mask(m, spr, x, y, 1.0)
            for k in range(0, int(hgt * 1.3) + 1, 1):
                sh = np.maximum(sh, shift(m, k * SUN[0], k * SUN[1]) * (1.0 if k < hgt else 0.6))
            ao = np.maximum(ao, blur(m, 3) * 1.4)
        # Two crisp steps: the core shadow and a one-pixel penumbra (no dither field).
        soft = blur(sh, 1)
        self.static_shadow = np.where(soft > 0.75, 1.0, np.where(soft > 0.2, 0.5, 0.0)).astype(np.float32)
        self.static_ao = np.clip(ao, 0, 1) * 0.5
        self.dry = (w.material == 2) | (w.material == 3)
        self.wet = np.full((H, W), -99.0, np.float32)

    def frame(self, t, cam, actors, trails=None):
        """One frame at time t (seconds), camera top-left `cam`, with actor dicts."""
        w = self.world
        f = self.base.copy()
        if trails is not None:
            trails.draw(f, t)
        covered = w.water(f, t, self.wet)
        w.kelp_underwater(f, t)
        # Shadows: props (static), people and birds (each frame), and contact occlusion.
        dyn = np.zeros((H, W), np.float32)
        occ = np.zeros((H, W), np.float32)
        walkers = [(a['x'], a['y']) for a in actors]
        sprites = []
        for a in actors:
            spr = a['sprite']
            cast(dyn, spr, a['x'], a['y'])
            contact(occ, a['x'], a['y'] - 1, 7, 2.5, 0.8)
            sprites.append((a['y'], spr, a['x'], a['y']))
        birds = self._birds(f, dyn, t)
        soft = blur(dyn, 1) * 1.2
        shadow = np.maximum(self.static_shadow, np.where(soft > 0.6, 1.0, np.where(soft > 0.15, 0.5, 0.0)))
        shadow = np.maximum(shadow, occ)
        shade = np.maximum(shadow * 0.75, self.static_ao)[..., None]
        f = f * (1 - shade) + f * SHADE * shade
        # Everything that stands on the ground, sorted by its feet.
        items = [(y, 'prop', spr, x) for (_, spr, x, y, _, _) in w.props]
        items += [(y, 'sprite', spr, x) for (_, spr, x, y) in sprites]
        items += [(tf[2], 'tuft', tf, None) for tf in w.tufts]
        items += self._creatures(t)
        items.sort(key=lambda it: it[0])
        cx0, cy0 = cam
        for (y, kind, obj, x) in items:
            if kind == 'tuft':
                k, tx, ty, hgt, ph = obj
                if not (cx0 - 20 < tx < cx0 + 660 and cy0 - 20 < ty < cy0 + 380):
                    continue
                fx.draw_tuft(f, k, tx, ty, hgt, ph, t, w.gust(tx, ty, t), walkers)
            elif kind == 'fn':
                obj(f)
            else:
                stamp(f, obj, x, y)
        self._wreck_sail(f, t)
        fx.draw_fire(f, *w.fire, t)
        fx.draw_smoke(f, w.fire[0], w.fire[1], t)
        fx.draw_spray(f, 520, 506, t, 0.4, 3, 1.2)
        fx.draw_spray(f, 610, 512, t, 1.9, 4, 0.9)
        fx.draw_spray(f, 700, 556, t, 1.1, 5, 1.4)
        fx.draw_blown_sand(f, self.dry, t, 520, 9)
        for b in birds:
            b(f)
        # The gust sheen over the machair and the marram.
        grassy = (w.material == 0) & ~w.bog & ~w.track
        gx = ((np.arange(W)[None, :] - t / LOOP * 320) % 320).astype(int) % 320
        import strand as _s
        _s.gust_at(0, 0)
        field = _s._GUST[np.arange(H)[:, None] % H, gx]
        f = fx.gust_sheen(f, grassy, np.clip((field - 0.42) * 2.4, 0, 1), 0.13)
        # Light: cloud shadows sweeping east, the low sun, firelight, the grade.
        view = f[cy0:cy0 + 360, cx0:cx0 + 640]
        cloud = fx.cloud_shadow(360, 640, t, cx0, cy0, 1280)
        out = fx.grade(view, cloud, warm_sun=1.0)
        pool = fx.light_pool(360, 640, w.fire[0] - cx0, w.fire[1] - cy0 - 4, 78, t)[..., None]
        out = out * (1 + pool * np.array([0.55, 0.28, 0.02])) + pool * np.array([26, 10, 0])
        fx.draw_rain(out, t, 300, 13, 0.3)
        return out

    def _wreck_sail(self, f, t):
        """A torn strip of sail on the snapped mast, flogging in the wind."""
        mx, my = 726 - 48 + 46, 548 - 46 + 6
        for k in range(16):
            wave = math.sin(t * 9 - k * 0.7) * (k / 16) * 3
            for d in range(3 - k // 7):
                fx._px(f, mx + k, my + d + wave + k * 0.15, C('wool', 4 - d - (k % 5 == 0)))

    def _birds(self, f, shadow_buf, t):
        calls = []
        for i, (cx, cy, rad, cyc) in enumerate([(380, 330, 70, 1), (450, 300, 46, 1), (300, 420, 90, -1)]):
            a = fx.TAU * t / LOOP * cyc + i * 2.1
            x = cx + math.cos(a) * rad
            y = cy + math.sin(a) * rad * 0.5 - 40
            calls.append(lambda fr, x=x, y=y, i=i: fx.draw_gull(fr, shadow_buf, x, y, 1.0 + i * 0.2, t + i))
            fx.draw_gull(np.zeros((1, 1, 3), np.float32), shadow_buf, x, y, 1.0 + i * 0.2, t + i)
        return calls

    def _creatures(self, t):
        items = []
        # A gull on the big log, turning its head; a cormorant drying its wings on the rocks;
        # a seal on the skerry lifting its head; a crab at the tide pool.
        g = fx.standing_gull(fx.loopsin(t, 2) > 0.3)
        items.append((402, 'prop', g, 212))
        corm = fx.cormorant(fx.loopsin(t, 3) > 0.6)
        corm.ay += 24          # it stands on the crown of the rock pile, drawn after it
        items.append((491, 'prop', corm, 566 - 10))
        sl = fx.seal(fx.loopsin(t, 1, 1) > 0.4)
        items.append((562, 'prop', sl, 686))
        cx = 540 + 6 * fx.loopsin(t, 1)
        items.append((470, 'prop', fx.crab(int(t * 8)), cx))
        return items


class Trails:
    """Footprints left in the sand behind a walker, fading as the sand dries and blows."""

    def __init__(self):
        self.prints = []

    def add(self, x, y, t, wet):
        self.prints.append((x, y, t, wet))

    def draw(self, f, t):
        for (x, y, t0, wet) in self.prints:
            age = t - t0
            if age > 8 or age < 0:
                continue
            k = 0.35 * (1 - age / 8)
            for dx in (0, 1):
                xi, yi = int(x + dx), int(y)
                if 0 <= yi < f.shape[0] and 0 <= xi < f.shape[1]:
                    f[yi, xi] = f[yi, xi] * (1 - k) + f[yi, xi] * SHADE * k * 0.6
            if wet:
                xi, yi = int(x), int(y) - 1
                if 0 <= yi < f.shape[0] and 0 <= xi < f.shape[1]:
                    f[yi, xi] = f[yi, xi] * 0.85 + C('sky', 3) * 0.15

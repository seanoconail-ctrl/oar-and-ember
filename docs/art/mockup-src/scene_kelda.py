"""Renders the Kelda Spring in summer: the still and the loop."""
import math
import os
import sys
import numpy as np
from PIL import Image
import fx
import people
from core import C, FPS, FRAMES, LOOP, Sprite, banded, blur, ramp_lookup, shift, stamp, stamp_mask, to_u8, value_noise
from kelda import H, W, Kelda, SHADE, SUN, VIEW, bracken, fern
from scene_strand import cast, contact

OUT = os.path.join(os.path.dirname(__file__), '..')
SPRING = (262, 148)
HILD_AT = (300, 204)          # kneeling on the south lip of the pool


class KeldaRenderer:
    def __init__(self):
        self.k = Kelda()
        k = self.k
        sh = np.zeros((H, W), np.float32)
        ao = np.zeros((H, W), np.float32)
        for item in k.props:
            if isinstance(item[1], str):
                continue
            _, spr, x, y, hgt = item
            m = np.zeros((H, W), np.float32)
            stamp_mask(m, spr, x, y, 1.0)
            for s in range(0, int(hgt * 1.2) + 1):
                sh = np.maximum(sh, shift(m, s * SUN[0], s * SUN[1]))
            ao = np.maximum(ao, blur(m, 3) * 1.4)
        soft = blur(sh, 1)
        self.static_shadow = np.where(soft > 0.75, 1.0, np.where(soft > 0.2, 0.5, 0.0)).astype(np.float32)
        self.static_ao = np.clip(ao, 0, 1) * 0.45

    def water(self, f, t):
        k = self.k
        # The pool: clear water over pale stones at the edge, deepening to a dark eye.
        depth = np.clip(1 - k.pool_r, 0, 1)
        idx = 7.5 - banded(depth, 5) * 5.5
        col = ramp_lookup('sea', idx)
        # Sky and cloud reflected, drifting.
        refl = value_noise(H, W, 18, 41, period_x=W)
        off = int(t / LOOP * W) % W
        refl = np.roll(refl, off, axis=1)
        col = col * 0.8 + ramp_lookup('sky', 2 + refl * 3) * 0.2
        # The spring: rings spreading from its source, and bubbles rising.
        dx, dy = k.xs - SPRING[0], (k.ys - SPRING[1]) * 1.8
        d = np.hypot(dx, dy)
        for ring in range(2):
            age = (t / LOOP * 5 + ring / 2) % 1
            rad = age * 16
            band_ = (np.abs(d - rad) < 0.7) & k.pool
            fade = 0.45 * (1 - age)
            col[band_] = col[band_] * (1 - fade) + ramp_lookup('sea', 9 + 0 * d[band_]) * fade
        f[k.pool] = col[k.pool]
        for b in range(7):
            age = (t * 1.3 + b / 7) % 1
            bx = SPRING[0] + math.sin(b * 2.4) * 5 + math.sin(t * 3 + b) * 0.6
            by = SPRING[1] + math.cos(b * 1.7) * 2.5 - age * 2
            fx._px(f, bx, by, C('sea', 10 if age < 0.7 else 8))
        # The stream: flow lines run downstream, foam where it narrows and over the stones.
        s = k.stream
        along = k.stream_along
        flow = np.sin(along / 5.5 - t / LOOP * 2 * math.pi * 6 + k.stream_d * 0.9)
        flow2 = np.sin(along / 2.7 - t / LOOP * 2 * math.pi * 9 - k.stream_d * 1.3)
        sidx = 5.0 - (k.stream_w - k.stream_d) * 0.3 + (flow > 0.8) * 2 + (flow2 > 0.92) * 1.5
        scol = ramp_lookup('sea', sidx)
        narrow = s & (k.stream_w < 3.6)
        foam = (narrow | (np.hypot(k.xs - 355, k.ys - 276) < 12)) & ((flow > 0.4) | (flow2 > 0.6))
        scol[foam] = ramp_lookup('sea', 9.6 + 0 * sidx[foam])
        edge = s & (k.stream_d > k.stream_w - 1.2)
        scol[edge] = scol[edge] * 0.6 + f[edge] * 0.4         # soft banks
        f[s] = scol[s]

    def frame(self, t, cam=VIEW):
        k = self.k
        f = k.ground.copy()
        self.water(f, t)
        dyn = np.zeros((H, W), np.float32)
        occ = np.zeros((H, W), np.float32)
        actors = self._actors(t)
        walkers = [(a['x'], a['y']) for a in actors]
        for a in actors:
            cast(dyn, a['sprite'], a['x'], a['y'], 0.8)
            contact(occ, a['x'], a['y'] - 1, 7, 2.5, 0.8)
        sheep_items = []
        for (sx, sy, ph, right) in k.sheep:
            x = sx + 3 * fx.loopsin(t, 1, ph)
            spr = fx.sheep(t, ph, right)
            cast(dyn, spr, x, sy, 0.8)
            contact(occ, x, sy - 1, 9, 3, 0.8)
            sheep_items.append((sy, 'sprite', spr, x))
        soft = blur(dyn, 1) * 1.2
        shadow = np.maximum(self.static_shadow, np.where(soft > 0.6, 1.0, np.where(soft > 0.15, 0.5, 0.0)))
        shadow = np.maximum(shadow, occ)
        shade = np.maximum(shadow * 0.7, self.static_ao)[..., None]
        f = f * (1 - shade) + f * SHADE * shade
        items = []
        for item in k.props:
            if isinstance(item[1], str):
                y, kind, x, yy, ph = item
                items.append((yy, kind, (x, yy, ph), None))
            else:
                y, spr, x, yy, _ = item
                items.append((yy, 'sprite', spr, x))
        items += [(tf[2], 'tuft', tf, None) for tf in k.tufts]
        items += [(a['y'], 'sprite', a['sprite'], a['x']) for a in actors]
        items += sheep_items
        items.append((HILD_AT[1] - 1, 'fn', self._bucket(t), None))
        items.sort(key=lambda it: it[0])
        cx0, cy0 = cam
        for (y, kind, obj, x) in items:
            if kind == 'tuft':
                kk, tx, ty, hgt, ph = obj
                if not (cx0 - 20 < tx < cx0 + 660 and cy0 - 20 < ty < cy0 + 380):
                    continue
                fx.draw_tuft(f, kk, tx, ty, hgt, ph, t, k.gust(tx, ty, t), walkers)
            elif kind == 'fern':
                fern(f, obj[0], obj[1], t, obj[2], k.gust(obj[0], obj[1], t))
            elif kind == 'bracken':
                bracken(f, obj[0], obj[1], t, obj[2], k.gust(obj[0], obj[1], t))
            elif kind == 'fn':
                obj(f)
            else:
                stamp(f, obj, x, y)
        # The gust sheen over the turf, travelling with the wind.
        gx = (np.arange(W)[None, :] - t / LOOP * 350) % 350
        from kelda import _gust as _g
        if not hasattr(self, '_gf'):
            import kelda as _k
            _g(0, 0)
            self._gf = _k._G
        field = self._gf[np.arange(H)[:, None] % H, gx.astype(int) % 350]
        grassy = ~(k.pool | k.stream | k.bog)
        f = fx.gust_sheen(f, grassy, np.clip((field - 0.45) * 2.4, 0, 1), 0.14)
        # Insects over the flowers, pollen and seed drifting downwind.
        for i in range(14):
            bx, by = 380 + (i * 47) % 300, 90 + (i * 61) % 280
            fx.insect(f, bx, by, t, i, 'butterfly' if i % 4 == 0 else 'bee')
        for i in range(40):
            px_ = (i * 97 + t / LOOP * W) % W
            py_ = (i * 53) % H + 4 * fx.loopsin(t, 2, i)
            if i % 3 == 0:
                fx._px(f, px_, py_, C('wool', 6))
        view = f[cy0:cy0 + 360, cx0:cx0 + 640]
        cloud = fx.cloud_shadow(360, 640, t, cx0, cy0, 1400, seed=211)
        out = fx.grade(view, cloud * 0.85, warm_sun=1.1, desat=0.08, lift=(8, 12, 18))
        # Soft shafts of light through the haze, slanting from the west.
        ys, xs = np.mgrid[0:360, 0:640]
        shaft = (np.sin((xs + ys * 0.7) / 38 + t / LOOP * 2 * math.pi) > 0.93) * (1 - cloud)
        out = out + shaft[..., None] * np.array([7, 7, 4])
        return out

    def _actors(self, t):
        # The steerer walks the path down towards the pool through the flowers.
        u = (t / LOOP) % 1
        pts = [(548, 84), (508, 106), (452, 120)]
        seg = u * 2
        i = min(1, int(seg))
        f_ = seg - i
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        x, y = x0 + (x1 - x0) * f_, y0 + (y1 - y0) * f_
        frame_i = int(t * 8.6) % 6
        walker = people.flutter(people.sprite('actor_p_steerer_b', 'walk', 'w', frame_i),
                                self.k.gust(x, y, t) * 0.7, 'w', int(t * 8))
        bounce = -1 if frame_i in (1, 4) else 0
        # Hild kneels at the pool's lip, filling a pail (a task, not a stroll).
        hild = people.sprite('actor_c_hild', 'sit', 'n', int(t * 3.3) % 4)
        return [{'x': x, 'y': y + bounce, 'sprite': walker},
                {'x': HILD_AT[0], 'y': HILD_AT[1], 'sprite': hild}]

    def _bucket(self, t):
        dip = fx.loopsin(t, 2) > 0
        def draw(f):
            bx, by = HILD_AT[0] - 3, HILD_AT[1] - (16 if dip else 20)
            for yy in range(4):
                for xx in range(5):
                    fx._px(f, bx + xx, by + yy, C('tar', 3 - (yy == 3) + (xx == 0)))
            fx._px(f, bx + 2, by - 1, C('stone', 6))
            if dip:
                for xx in range(-2, 7):
                    fx._px(f, bx + xx, by + 4, C('sea', 9))
            else:
                fx._px(f, bx + 2, by + 4 + int(t * 10) % 3, C('sea', 9))   # dripping
        return draw


def main():
    R = KeldaRenderer()
    imgs = []
    for i in range(FRAMES):
        imgs.append(Image.fromarray(to_u8(R.frame(i / FPS))))
        print(f'\rframe {i + 1}/{FRAMES}', end='', file=sys.stderr)
    print(file=sys.stderr)
    imgs[int(FRAMES * 0.35)].save(os.path.join(OUT, 'kelda-summer-target.png'))
    pal = [im.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in imgs]
    pal[0].save(os.path.join(OUT, 'kelda-summer-target.gif'), save_all=True, append_images=pal[1:],
                duration=int(1000 / FPS), loop=0, disposal=1)


if __name__ == '__main__':
    if len(sys.argv) > 1:
        R = KeldaRenderer()
        out = R.frame(float(sys.argv[1]))
        Image.fromarray(to_u8(out)).resize((1280, 720), Image.NEAREST).save(sys.argv[2])
    else:
        main()

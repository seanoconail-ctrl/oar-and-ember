"""Approval renders for the Stage 6 rework (Book 3: a redrawn character is shown rendered, in the
real scene, before it is wired into the game). Composites the proposed people, layers, particles
and interface (assets/art/proposed/atlases) over real Wreck Strand frames captured by
src/tools/art/preview48.ts, masked at the real waterline from the captured depth field.

    node src/tools/art/proposed.ts           # compile the proposed sheets
    node src/tools/art/preview48.ts ...      # capture the backgrounds (see that file)
    python3 assets/art/authoring/preview48.py

Writes docs/art/stage-06-rework/: wade.gif, compare-before.png and compare-after.png
(1920 x 1080), hotbar.gif, bow.gif. Deterministic: the same inputs give the same files.

The game's own renderer is not used for the people here (that is the wiring step after approval),
so the light and grade of the post pass are approximated by sampling the frame (see `grade`).
"""
import json, os, math
import numpy as np
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
WORK = f'{REPO}/docs/art/stage-06-rework/.work'
OUT = f'{REPO}/docs/art/stage-06-rework'
PROPOSED = f'{REPO}/assets/art/proposed'

# Water depth bands for the preview, in the game's height units (depth field / 250). The band
# thresholds become Book 10 numbers when the rework is wired in; the masks are Book 10's.
BANDS = [('wet', 0.012, 0), ('ankle', 0.05, 3), ('knee', 0.14, 12), ('waist', 0.30, 22)]
SPEED = {'wet': 1.0, 'ankle': 0.9, 'knee': 0.7, 'waist': 0.5}
DRIP_AFTER = {'knee': 4.0, 'waist': 8.0}


def band_of(depth):
    for name, upto, mask in BANDS:
        if depth < upto:
            return name, mask
    return 'deep', 999


class Sheet:
    def __init__(self, name, folder):
        m = json.load(open(f'{folder}/{name}.json'))
        self.name = name
        self.m = m
        self.img = np.asarray(Image.open(f"{folder}/{m['image']}").convert('RGBA')).copy()
        self.w, self.h = m['width'], m['height']
        self.px, self.py = m['pivot']['x'], m['pivot']['y']
        self.frames = dict((k, v) for k, v in m['frames'].items()) if isinstance(m['frames'], dict) else dict(m['frames'])
        self.anims = m.get('anims', {})

    def has(self, key):
        return key in self.frames

    def frame(self, key):
        x, y = self.frames[key]
        return self.img[y:y + self.h, x:x + self.w]


def sheet(name, proposed=True):
    return Sheet(name, f'{PROPOSED}/atlases' if proposed else f'{REPO}/assets/atlases')


def over(dst, src, x0, y0, alpha=1.0):
    """Alpha-composites RGBA `src` onto RGB float `dst` with its top-left at (x0, y0)."""
    h, w = src.shape[:2]
    H, W = dst.shape[:2]
    xa, ya = max(0, x0), max(0, y0)
    xb, yb = min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb:
        return
    s = src[ya - y0:yb - y0, xa - x0:xb - x0].astype(np.float32)
    a = (s[..., 3:4] / 255.0) * alpha
    dst[ya:yb, xa:xb] = dst[ya:yb, xa:xb] * (1 - a) + s[..., :3] * a


def shadow(dst, cx, cy, w, h, strength=0.38):
    """The soft, semi-transparent oval ground shadow, darker at its centre (Book 7 section 14)."""
    H, W = dst.shape[:2]
    for y in range(int(cy - h), int(cy + h) + 1):
        for x in range(int(cx - w), int(cx + w) + 1):
            if 0 <= x < W and 0 <= y < H:
                d = ((x + 0.5 - cx) / w) ** 2 + ((y + 0.5 - cy) / h) ** 2
                if d < 1:
                    k = strength * (1 - d) ** 0.7
                    dst[y, x] *= (1 - k)


def grade(frame_rgb, rgba):
    """Approximates the post pass on an unlit sprite: the frame's own warm/cool balance."""
    return rgba


class Character:
    """A layered character: sheets drawn in each facing's order, aligned on the body's pivot."""

    def __init__(self, layers_file):
        d = json.load(open(f'{PROPOSED}/{layers_file}'))
        self.layers = d['layers']
        names = {n for v in self.layers.values() for n in v}
        self.sheets = {n: sheet(n) for n in names}
        body = self.layers['s'][0] if not self.layers['s'][0].startswith('layer_') else None
        self.body = self.sheets[next(n for n in self.layers['s'] if n.startswith('actor_'))]

    def image(self, key, extra=()):
        facing = key.split('/')[1]
        W, H = self.body.w + 32, self.body.h + 16
        canvas = np.zeros((H, W, 4), np.uint8)
        ox, oy = 16, 8  # the body's top-left inside the larger canvas
        for name in list(self.layers[facing]) + list(extra):
            s = self.sheets.get(name) or sheet(name)
            self.sheets[name] = s
            if not s.has(key):
                continue
            f = s.frame(key)
            x0 = ox + self.body.px - s.px
            y0 = oy + self.body.py - s.py
            a = f[..., 3:4] > 0
            region = canvas[y0:y0 + s.h, x0:x0 + s.w]
            np.copyto(region, f, where=a)
        return canvas, ox + self.body.px, oy + self.body.py

    def frames(self, state):
        return self.body.anims.get(state, {}).get('frames', 1)


def put_person(dst, img, ax, ay, fx, fy, mask, t, dark=0.0):
    """Draws a person with its anchor (ax, ay in img) at screen (fx, fy), masked `mask` px up
    from the feet by the water, with a moving waterline highlight where the water cuts it."""
    img = img.copy()
    if dark > 0:
        img[..., :3] = (img[..., :3].astype(np.float32) * (1 - 0.22 * dark)).astype(np.uint8)
    cut = None
    if mask > 0:
        cut = ay - mask + 1  # rows from here down are under the water
        under = img[cut:].copy()
        img[cut:, :, 3] = 0
        # A faint, darker body under the surface, broken by the water.
        under[..., :3] = (under[..., :3].astype(np.float32) * 0.45 + np.array([20, 55, 70]) * 0.55).astype(np.uint8)
        under[..., 3] = (under[..., 3] > 0) * 70
        for r in range(under.shape[0]):
            if (r + int(t * 6)) % 3 == 0:
                under[r, :, 3] = 0
    over(dst, img, int(fx - ax), int(fy - ay))
    if mask > 0:
        over(dst, under, int(fx - ax), int(fy - ay + cut))
        # The waterline: a light rim one pixel wide across the body, rippling a pixel.
        row = img[cut - 1] if cut - 1 >= 0 else None
        cols = np.where((row[..., 3] > 0) if row is not None else [])[0] if row is not None else []
        if len(cols):
            y = int(fy - ay + cut)
            for c in range(cols.min() - 2, cols.max() + 3):
                x = int(fx - ax + c)
                wob = int(round(math.sin(t * 5 + c * 0.9) * 0.6))
                if 0 <= x < dst.shape[1] and 0 <= y + wob < dst.shape[0]:
                    edge = c < cols.min() or c > cols.max()
                    k = 0.45 if edge else 0.75
                    dst[y + wob, x] = dst[y + wob, x] * (1 - k) + np.array([214, 236, 236]) * k


def load_bg(name):
    meta = json.load(open(f'{WORK}/{name}/meta.json'))
    frames, depths = [], []
    for i in range(len(meta)):
        frames.append(np.asarray(Image.open(f'{WORK}/{name}/frame-{i:03d}.png').convert('RGB')).astype(np.float32))
        depths.append(np.fromfile(f'{WORK}/{name}/depth-{i:03d}.u8', dtype=np.uint8).reshape(360, 640) / 250.0)
    return meta, frames, depths


def save_gif(frames, path, scale=2, ms=80):
    imgs = [Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)).resize((640 * scale, 360 * scale), Image.NEAREST) for f in frames]
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms, loop=0, optimize=False)


if __name__ == '__main__':
    import sys
    which = sys.argv[1:] or ['wade', 'compare', 'hotbar', 'bow']
    print('nothing to do yet' if not which else which)

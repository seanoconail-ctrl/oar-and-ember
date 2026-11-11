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



# ------------------------------------------------------------------ the interface (Book 7 s. 10)

class Hud:
    def __init__(self):
        self.s = {n: sheet(n) for n in ['ui_hotbar', 'ui_icons', 'ui_digits', 'ui_cursor',
                                        'ui_cursor_glyph', 'ui_aim', 'ui_stamina',
                                        'ui_stamina_reason', 'fx_people']}

    def f(self, name, key):
        return self.s[name].frame(key)

    def put(self, dst, name, key, x, y, crop=None, alpha=1.0):
        img = self.f(name, key)
        if crop is not None:
            img = img[:, :crop]
        over(dst, img, int(x), int(y), alpha)

    ITEMS = ['axe', 'spade', 'sickle', 'seed_bag', 'pail', 'hammer', 'bow', 'spear',
             'fishing_line', 'seax', 'bread', 'rope']
    COUNTS = {3: 12, 7: 3, 10: 4}

    def hotbar(self, dst, selected, lift=1.0):
        sx0 = (640 - 22 * 14) // 2
        sy0 = 360 - 30
        self.put(dst, 'ui_hotbar', 'cap_left/-/0', sx0, sy0)
        for i, item in enumerate(self.ITEMS):
            x = sx0 + 22 * (i + 1)
            sel = i == selected
            self.put(dst, 'ui_hotbar', ('slot_selected' if sel else 'slot') + '/-/0', x, sy0)
            oy = sy0 + (0 if sel else 4)
            self.put(dst, 'ui_icons', f'{item}/-/0', x + 3, oy + 5)
            self.put(dst, 'ui_digits', ('key_selected' if sel else 'key') + f'/-/{i}', x, oy + 3)
            n = self.COUNTS.get(i)
            if n and n > 1:
                text = str(n)
                for j, ch in enumerate(text):
                    self.put(dst, 'ui_digits', f'count/-/{ch}', x + 3 + 16 - 4 * (len(text) - j) - 1, oy + 15)
        self.put(dst, 'ui_hotbar', 'cap_right/-/0', sx0 + 22 * 13, sy0)

    def stamina(self, dst, maximum=70, current=48, reasons=(('cold', 20), ('hunger', 10))):
        x0, y0 = 8, 8
        self.put(dst, 'ui_stamina', 'cap_left/-/0', x0, y0, crop=4)
        for x in range(maximum):
            self.put(dst, 'ui_stamina', 'frame/-/0', x0 + 4 + x, y0, crop=1)
        self.put(dst, 'ui_stamina', 'cap_right/-/0', x0 + 4 + maximum, y0, crop=4)
        for x in range(max(0, current - 2)):
            self.put(dst, 'ui_stamina', 'fill/-/0', x0 + 4 + x, y0, crop=1)
        self.put(dst, 'ui_stamina', 'fill_end/-/0', x0 + 4 + current - 2, y0, crop=2)
        gx = x0 + 8 + maximum
        for i, (name, n) in enumerate(reasons):
            for x in range(n):
                self.put(dst, 'ui_stamina', 'groove/-/0', gx + x, y0, crop=1)
            self.put(dst, 'ui_stamina_reason', f'{name}/-/0', gx + n // 2 - 4, y0 + 10)
            gx += n
            if i < len(reasons) - 1:
                self.put(dst, 'ui_stamina', 'groove_cut/-/0', gx, y0, crop=3)
                gx += 3
        self.put(dst, 'ui_stamina', 'groove_end/-/0', gx, y0, crop=2)

    def cursor(self, dst, tile_x, tile_y, ok, glyph, pulse=0):
        self.put(dst, 'ui_cursor', ('valid' if ok else 'reach') + f'/-/{pulse % 2 if ok else 0}', tile_x - 2, tile_y - 2)
        if glyph:
            self.put(dst, 'ui_cursor_glyph', f'{glyph}/-/0', tile_x + 18, tile_y - 4)


def fx(hud, dst, name, frame, x, y, alpha=1.0):
    s = hud.s['fx_people']
    key = f'{name}/-/{frame}'
    if s.has(key):
        over(dst, s.frame(key), int(x - s.px), int(y - s.py), alpha)


def facing_of(dx, dy):
    if abs(dx) >= abs(dy):
        return 'e' if dx > 0 else 'w'
    return 's' if dy > 0 else 'n'


# ------------------------------------------------------------------ the scenes

def scene_wade(body='a'):
    """The steerer walks from the sand into the shallows beside Hild, and back out, dripping."""
    meta, frames, depths = load_bg('wade')
    hud = Hud()
    st = Character(f'steerer_{body}.layers.json')
    hild = Character('hild.layers.json')
    # Hild stands in her waist band, calling, facing the shore.
    hx, hy = 356, 119
    # The steerer's path: down the sand, into the water beside Hild, a pause, and back out.
    path = [(292, 64, 'walk'), (318, 104, 'walk'), (334, 120, 'walk'), (334, 120, 'idle', 22),
            (318, 104, 'walk'), (300, 70, 'walk'), (300, 70, 'idle', 30)]
    x, y = path[0][0], path[0][1]
    seg, wait, dist, facing = 1, 0, 0.0, 's'
    wet_until, wet_band, prints, ripples, splashes, drips = -1.0, None, [], [], [], []
    out, last_band = [], 'wet'
    step_t = 0.0
    for i, (m, bg, dep) in enumerate(zip(meta, frames, depths)):
        t = i * 0.08
        img = bg.copy()
        moving = False
        if seg < len(path):
            target = path[seg]
            if target[2] == 'idle':
                wait += 1
                if wait >= target[3]:
                    seg += 1
                    wait = 0
            else:
                d = dep[int(y), int(x)]
                band, mask = band_of(d)
                speed = 48 * SPEED.get(band, 0.5) * 0.08
                dx, dy = target[0] - x, target[1] - y
                L = math.hypot(dx, dy)
                if L <= speed:
                    x, y = target[0], target[1]
                    seg += 1
                else:
                    x += dx / L * speed
                    y += dy / L * speed
                    dist += speed
                    moving = True
                facing = facing_of(dx, dy)
        d = dep[int(y), int(x)]
        band, mask = band_of(d)
        # Leaving deeper water: wet and dripping for a while (Book 10 section 02).
        if band in ('wet', 'ankle') and last_band in DRIP_AFTER:
            wet_until = t + DRIP_AFTER[last_band]
        if band in DRIP_AFTER:
            wet_until = -1.0
        if band in ('knee', 'waist') and last_band in ('wet', 'ankle'):
            splashes.append((x, y + 1, t))
        last_band = band
        wetness = max(0.0, min(1.0, (wet_until - t) / 3.0)) if wet_until > t else 0.0
        frame_n = int(dist / 8) % 6 if moving else int(t * 4) % 4
        state = 'walk' if moving else ('idle' if st.body.has(f'idle/{facing}/0') else 'walk')
        if moving and int(dist / 8) != int((dist - 3.84) / 8) and frame_n in (0, 3):
            # A footfall: a print on sand, a ripple in water.
            if band == 'wet' or d <= 0:
                kind = 'print_wet' if wetness > 0 or band == 'wet' else 'print_dry'
                prints.append((x + (-2 if frame_n == 0 else 2), y, f'{kind}_{facing}', frame_n // 3, t))
            else:
                ripples.append((x, y, t))
        if not moving and band in ('ankle', 'knee', 'waist') and int(t / 1.2) != int((t - 0.08) / 1.2):
            ripples.append((x, y, t))
        if int(t / 1.2) != int((t - 0.08) / 1.2):
            ripples.append((hx, hy, t))
        if wetness > 0 and int(t / 0.3) != int((t - 0.08) / 0.3):
            drips.append((x + (i * 7) % 9 - 4, y - 18 - (i * 5) % 10, t))
        # Ground marks first, then shadows, people (sorted by feet), then particles over them.
        for (px, py, kind, foot, t0) in prints:
            age = t - t0
            if age < 6:
                fx(hud, img, kind, foot, px, py, alpha=1.0 if age < 4 else (6 - age) / 2)
        for (rx, ry, t0) in ripples:
            k = int((t - t0) / 0.15)
            if 0 <= k < 6:
                fx(hud, img, 'ripple', k, rx, ry + 1)
        people = [(hy, 'hild', hx, hy), (y, 'steerer', x, y)]
        for _, who, px, py in sorted(people):
            if who == 'hild':
                c, key = hild, f"call/s/{int(t * 4) % hild.frames('call')}" if hild.body.has('call/s/0') else 'idle/s/0'
                hb, hm = band_of(dep[int(py), int(px)])
            else:
                c, key = st, f'{state}/{facing}/{frame_n % st.frames(state)}'
                hb, hm = band, mask
            if hb in ('wet', 'ankle') or hb is None:
                shadow(img, px, py, 8, 2.5)
            im, ax, ay = c.image(key)
            put_person(img, im, ax, ay, px, py, hm if hm < 99 else 30, t, dark=wetness if who == 'steerer' else 0)
            if who == 'hild' and int(t / 2.5) != int((t - 0.08) / 2.5):
                splashes.append((px + 3, py - 2, t))
        for (sx, sy, t0) in splashes:
            k = int((t - t0) / 0.1)
            if 0 <= k < 5:
                fx(hud, img, 'splash', k, sx, sy)
            k2 = int((t - t0) / 0.12)
            if 0 <= k2 < 4:
                fx(hud, img, 'surf', k2, sx - 4, sy - 6)
        for (dx_, dy_, t0) in drips:
            k = int((t - t0) / 0.1)
            if 0 <= k < 3:
                fx(hud, img, 'drip', k, dx_, dy_ + k * 4)
        out.append(img)
    save_gif(out, f'{OUT}/wade-{body}.gif', scale=2, ms=80)
    Image.fromarray(np.clip(out[60], 0, 255).astype(np.uint8)).save(f'{OUT}/wade-{body}-still.png')
    print(f'wade-{body}.gif: {len(out)} frames')


def scene_compare():
    """1920 x 1080 before and after: the people beside the broch doorway and the boat."""
    meta, frames, depths = load_bg('still')
    door = sheet('prop_broch_door')
    boat = sheet('prop_wreck_t1', proposed=False)
    for label in ('before', 'after'):
        img = frames[0].copy()
        # The broch doorway and the boat set on the sand, side by side, for scale.
        shadow(img, 170, 96, 46, 5, 0.3)
        over(img, door.frame('wall/-/0'), 170 - door.px, 96 - door.py)
        shadow(img, 450, 92, 36, 5, 0.3)
        over(img, boat.frame('wrecked/-/0'), 450 - boat.px, 92 - boat.py)
        spots = [(206, 98, 'a'), (232, 98, 'b'), (400, 96, 'a')]
        if label == 'before':
            for (px, py, b) in spots:
                s = sheet(f'actor_p_steerer_{b}', proposed=False)
                shadow(img, px, py, 7, 2.5)
                over(img, s.frame('idle/s/0'), px - s.px, py - s.py)
            h = sheet('actor_c_hild', proposed=False)
            shadow(img, 300, 100, 7, 2.5)
            over(img, h.frame('idle/s/0'), 300 - h.px, 100 - h.py)
        else:
            for (px, py, b) in spots:
                c = Character(f'steerer_{b}.layers.json')
                im, ax, ay = c.image('idle/s/0')
                shadow(img, px, py, 8, 2.5)
                over(img, im, int(px - ax), int(py - ay))
            c = Character('hild.layers.json')
            im, ax, ay = c.image('idle/s/0')
            shadow(img, 300, 100, 8, 2.5)
            over(img, im, int(300 - ax), int(100 - ay))
        big = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((1920, 1080), Image.NEAREST)
        big.save(f'{OUT}/compare-{label}.png')
    print('compare-before.png, compare-after.png')


def scene_hotbar():
    """Choosing hotbar slots with the wheel and number keys; the target tile follows the cursor,
    within reach and beyond it."""
    meta, frames, depths = load_bg('sand')
    hud = Hud()
    st = Character('steerer_a.layers.json')
    fxp, fyp = 320, 150
    out = []
    plan = [0] * 8 + [1] * 8 + [2] * 8 + [3] * 8 + [6] * 10 + [5] * 8 + [0] * 8 + [4] * 10 + [4] * 7
    glyphs = {0: 'axe', 1: 'spade', 2: 'axe', 3: 'seed', 4: 'pail', 5: 'hammer', 6: 'sword'}
    for i, bg in enumerate(frames):
        t = i * 0.08
        img = bg.copy()
        sel = plan[min(i, len(plan) - 1)]
        # The cursor sweeps round the steerer: in reach near, out of reach far.
        ang = t * 0.9
        r = 26 + 40 * (0.5 + 0.5 * math.sin(t * 0.7))
        cx, cy = fxp + math.cos(ang) * r, fyp - 10 + math.sin(ang) * r * 0.6
        tile_x = int(cx // 24 * 24) + (meta[i]['camera'][0] % 24 and 0)
        tile_y = int(cy // 24 * 24)
        ok = math.hypot(tile_x + 12 - fxp, tile_y + 12 - fyp) <= 1.5 * 24 + 6
        facing = facing_of(cx - fxp, cy - fyp)
        shadow(img, fxp, fyp, 8, 2.5)
        im, ax, ay = st.image(f'idle/{facing}/{int(t * 4) % 4}')
        hud.cursor(img, tile_x, tile_y, ok, glyphs.get(sel), int(t * 3))
        put_person(img, im, ax, ay, fxp, fyp, 0, t)
        hud.stamina(img)
        hud.hotbar(img, sel)
        out.append(img)
    save_gif(out, f'{OUT}/hotbar.gif', scale=2, ms=80)
    print('hotbar.gif')


def scene_bow():
    """Aiming a bow at the cursor: the draw, the aim line with dots spreading as the draw grows,
    the cross at the aim point, the facing arrow, and the loose."""
    meta, frames, depths = load_bg('sand')
    hud = Hud()
    st = Character('steerer_a.layers.json')
    fxp, fyp = 300, 150
    out = []
    for i, bg in enumerate(frames):
        t = i * 0.08
        img = bg.copy()
        tx, ty = 300 + 150 * math.cos(t * 0.5), 150 - 70 + 40 * math.sin(t * 0.8)
        facing = facing_of(tx - fxp, ty - fyp)
        cycle = (t % 3.0) / 3.0
        draw = min(1.0, cycle / 0.6)
        fr = 0 if cycle < 0.15 else (1 if cycle < 0.4 else (2 if cycle < 0.85 else 3))
        state = 'draw' if st.body.has(f'draw/{facing}/0') else 'idle'
        shadow(img, fxp, fyp, 8, 2.5)
        hud.put(img, 'ui_aim', f'facing_{facing}/-/0', fxp - 5 + {'e': 12, 'w': -12}.get(facing, 0), fyp - 5 + {'s': 8, 'n': -6}.get(facing, 0))
        im, ax, ay = st.image(f'{state}/{facing}/{fr if state == "draw" else 0}')
        put_person(img, im, ax, ay, fxp, fyp, 0, t)
        if fr in (1, 2):
            hx, hy = fxp, fyp - 24
            dx, dy = tx - hx, ty - hy
            L = math.hypot(dx, dy)
            step = 9.0 - 3 * draw
            d = step
            while d < L - 6:
                k = 0 if d < L * 0.3 else (1 if d < L * 0.7 else 2)
                hud.put(img, 'ui_aim', f'dot/-/{k}', hx + dx * d / L - 5, hy + dy * d / L - 5)
                d += step + (2 - 2 * draw) * k
            hud.put(img, 'ui_aim', f'cross/-/{int(t * 4) % 2}', tx - 5, ty - 5)
        hud.stamina(img, 100, 80, ())
        hud.hotbar(img, 6)
        out.append(img)
    save_gif(out, f'{OUT}/bow.gif', scale=2, ms=80)
    print('bow.gif')


if __name__ == '__main__':
    import sys
    which = sys.argv[1:] or ['wade', 'compare', 'hotbar', 'bow']
    if 'wade' in which:
        scene_wade('a')
        scene_wade('b')
    if 'compare' in which:
        scene_compare()
    if 'hotbar' in which:
        scene_hotbar()
    if 'bow' in which:
        scene_bow()

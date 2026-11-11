"""Builds the proposed 32 x 48 people (Book 7 sections 01, 07 and 14): the steerer's body models A
and B and Hild, each as a paper doll of layer sheets that share one set of frames.

    python3 assets/art/authoring/people48.py && node src/tools/art/proposed.ts

Writes assets/art/proposed/maps/*.map.txt. Nothing here is read by the game.

How it works
------------
Every frame is posed as a small skeleton in body space (r: the figure's right, f: forward, u: up,
in pixels; the sole is u = 0 on row 46, one row above the pivot row 47 that the ink outline sits
on). A pose gives the pelvis, the lean, the head, each ankle and each wrist; knees and elbows come
from two-bone IK. The skeleton is projected for each facing (s, n, e, w: west is drawn, never
mirrored, so the light stays upper left and an armed pose stays right-handed), and rasterised into
parts: a part is a set of pixels of named materials at a depth, on one layer (body, clothing,
cloak, helmet, bow). Each part is shaded on its own (lit from the upper left: the up and left edge
take the highlight, the down and right edge and anything under a caster take the shadow).

The layers are then separated so that compositing them in the draw order of layers.json gives the
depth-correct picture: an upper layer is cut where a lower layer is nearer (the bow on the back,
seen from the south, is drawn over the body but cut where the body is in front of it). The ink
outline is authored here, aware of the layers below: a layer's outline goes round it where
nothing below shows, and where a lower layer's colour shows against its edge the edge pixel
itself takes the line (ink between separate things; the cloth's deepest tone where clothing
meets skin, so a collar or a cuff is not a black ring). So every layer has a clean edge alone,
and the composite has one outline, never a doubled one.

Loose things lag a frame (Book 7 section 07): hair tails, Hild's braid, cloaks, hems and sashes are
posed from the previous frame's motion and settle after it.
"""
import math
import os
import json

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = f'{REPO}/assets/art/proposed/maps'

W, H = 32, 48
PIVOT = (16, 47)
TILT = 0.25          # how much depth (towards the camera) lowers a point on screen
FACINGS = ['s', 'n', 'e', 'w']

# ------------------------------------------------------------------------------------- palette
_pal = json.load(open(f'{REPO}/assets/palette/book07.json'))
RAMPS = {}
for _e in _pal['entries']:
    if 'ramp' in _e:
        RAMPS.setdefault(_e['ramp'], {})[_e['step']] = (_e['code'], _e['hex'])
CODE_HEX = {e['code']: e['hex'] for e in _pal['entries']}


def rhex(ramp, step):
    return RAMPS[ramp][step][1]


# --------------------------------------------------------------------------------- geometry
def clamp(v, a, b):
    return a if v < a else b if v > b else v


def lerp(a, b, t):
    return a + (b - a) * t


def ik(a, b, l1, l2, bend):
    """Two-bone IK in 3D: the joint between a and b, bent towards the unit vector `bend`."""
    d = [b[i] - a[i] for i in range(3)]
    dist = math.sqrt(sum(c * c for c in d)) or 1e-6
    if dist >= l1 + l2 - 1e-6:
        t = l1 / (l1 + l2)
        return tuple(a[i] + d[i] * t for i in range(3))
    # Distance along a->b of the joint's foot, and the height off the line.
    x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - x * x))
    n = [c / dist for c in d]
    # Bend direction made perpendicular to the bone line.
    dot = sum(bend[i] * n[i] for i in range(3))
    p = [bend[i] - dot * n[i] for i in range(3)]
    pl = math.sqrt(sum(c * c for c in p)) or 1e-6
    p = [c / pl for c in p]
    return tuple(a[i] + n[i] * x + p[i] * h for i in range(3))


def project(facing, pt):
    """Body space (r, f, u) to the canvas: (x, y) continuous, pixel (c, r) has centre c+.5, r+.5,
    and the depth towards the camera."""
    r, f, u = pt
    if facing == 's':
        x, d = 16 - r, f
    elif facing == 'n':
        x, d = 16 + r, -f
    elif facing == 'e':
        x, d = 16 + f, r
    else:
        x, d = 16 - f, -r
    return x, 46.5 - u + d * TILT, d


# ------------------------------------------------------------------------------------ parts
class Part:
    """Pixels of materials at a depth on one layer, shaded together."""

    def __init__(self, layer, z, name='', rim=True, side=0, cast=True, bottom=True):
        self.layer, self.z, self.name = layer, z, name
        self.bottom = bottom    # shadow along the bottom edge
        self.px = {}
        self.rim = rim          # highlight on the up and left edges
        self.side = side        # extra shadow columns on the right of each row (volume)
        self.cast = cast        # take cast shadows from casters above inside the part

    def put(self, x, y, mat, z=None):
        x, y = int(x), int(y)
        if 0 <= x < CW and 0 <= y < CH:
            self.px[(x, y)] = (mat, self.z if z is None else z)

    def erase(self, x, y):
        self.px.pop((int(x), int(y)), None)

    def has(self, x, y):
        return (int(x), int(y)) in self.px

    def mat(self, x, y):
        v = self.px.get((int(x), int(y)))
        return None if v is None else v[0]

    def fill(self, x0, y0, x1, y1, mat):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.put(x, y, mat)

    def row(self, y, x0, x1, mat):
        for x in range(int(x0), int(x1) + 1):
            self.put(x, y, mat)

    def seg(self, a, b, w, mat, z=None, ends=True):
        """A limb from a to b (canvas coordinates), w pixels thick across its run."""
        (x0, y0), (x1, y1) = a, b
        if abs(y1 - y0) >= abs(x1 - x0):
            r0, r1 = math.floor(min(y0, y1)), math.floor(max(y0, y1))
            for ry in range(r0, r1 + 1):
                t = 0.0 if y1 == y0 else clamp((ry + 0.5 - y0) / (y1 - y0), 0, 1)
                cx = lerp(x0, x1, t)
                c0 = math.floor(cx - w / 2 + 0.5)
                for c in range(c0, c0 + w):
                    self.put(c, ry, mat, z)
        else:
            c0, c1 = math.floor(min(x0, x1)), math.floor(max(x0, x1))
            for cx in range(c0, c1 + 1):
                t = clamp((cx + 0.5 - x0) / (x1 - x0), 0, 1)
                cy = lerp(y0, y1, t)
                r0 = math.floor(cy - w / 2 + 0.5)
                for ry in range(r0, r0 + w):
                    self.put(cx, ry, mat, z)

    def line(self, a, b, mat, z=None):
        """A one-pixel line (Bresenham on rounded ends)."""
        x0, y0 = int(math.floor(a[0])), int(math.floor(a[1]))
        x1, y1 = int(math.floor(b[0])), int(math.floor(b[1]))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.put(x0, y0, mat, z)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def stamp(self, rows, x0, y0, letters, flip=False):
        """A drawn template: rows of letters, '.' empty, each letter a material."""
        for j, r in enumerate(rows):
            if flip:
                r = r[::-1]
            for i, ch in enumerate(r):
                if ch != '.' and ch != ' ':
                    self.put(x0 + i, y0 + j, letters[ch])


# Canvas size for parts (layers may be larger than the 32 x 48 body: the bow's 48 x 56).
CW, CH = 48, 56
OX, OY = 8, 4        # the body canvas sits at (8, 4) inside the working canvas


# Materials that throw a shadow on the pixel below them inside the same part.
CASTERS = {'hair', 'sash', 'belt', 'tunic', 'cloak', 'shawl', 'iron', 'dress', 'brow'}
# Materials that are fixed marks: no shading.
MARKS = {'eye', 'mouth', 'glint', 'bglint', 'blood', 'nose', 'lash', 'fold', 'wrapd', 'cloakf', 'head', 'fletch', 'plait'}


def shade_part(p):
    """Tone per pixel: 2 highlight, 1 base, 0 shadow; marks keep 'm'."""
    out = {}
    px = p.px
    rows = {}
    for (x, y) in px:
        rows.setdefault(y, []).append(x)
    for (x, y), (mat, z) in px.items():
        if mat in MARKS:
            out[(x, y)] = (mat, 'm', z)
            continue
        inn = lambda dx, dy: (x + dx, y + dy) in px
        up = px.get((x, y - 1))
        if p.rim and (not inn(-1, 0) or not inn(0, -1)):
            tone = 2
        elif not inn(1, 0) or (not inn(0, 1) and (p.bottom or not inn(2, 0))):
            tone = 0
        elif p.cast and up is not None and up[0] != mat and up[0] in CASTERS:
            tone = 0
        else:
            tone = 1
        if p.side and tone == 1 and x > max(rows[y]) - 1 - p.side:
            tone = 0
        out[(x, y)] = (mat, tone, z)
    return out


# --------------------------------------------------------------------------- layer separation
INK = ('ink', 'k')        # the outline
INNER_DARK = 'd'          # tone marker: the material's deepest step (clothing meeting skin)


def separate(parts, order, soft_pairs):
    """Paints each layer's parts by depth, cuts an upper layer where a lower one is nearer, and
    authors the outline aware of the layers below. Returns {layer: {(x, y): (mat, tone)}}."""
    painted = {L: {} for L in order}
    owner = {L: {} for L in order}
    for p in parts:
        if p.layer not in painted:
            continue
        for pos, (mat, tone, z) in shade_part(p).items():
            cur = painted[p.layer].get(pos)
            if cur is None or z >= cur[2]:
                painted[p.layer][pos] = (mat, tone, z)
                owner[p.layer][pos] = p
    # Shadow where a nearer part of the same layer covers the pixel up or left of this one.
    for L in order:
        img = painted[L]
        for (x, y), (mat, tone, z) in list(img.items()):
            if tone == 'm':
                continue
            me = owner[L][(x, y)]
            for n in ((x - 1, y), (x, y - 1), (x + 1, y)):
                o = owner[L].get(n)
                if o is not None and o is not me and img[n][2] > z + 0.01 and img[n][0] not in MARKS:
                    img[(x, y)] = (mat, INNER_DARK if img[n][2] > z + 2.5 else 0, z)
                    break
    out = {}
    below_z = {}
    below = {}      # what the layers below show: (mat, tone) or INK, and their layer
    for L in order:
        img = painted[L]
        keep, holes = {}, set()
        for pos, (mat, tone, z) in img.items():
            if pos in below_z and below_z[pos] > z + 0.01:
                holes.add(pos)
            else:
                keep[pos] = (mat, tone)
        res = dict(keep)
        for (x, y) in keep:
            for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if n in keep:
                    continue
                lo = below.get(n)
                if n in holes or (lo is not None and lo[0] != INK):
                    # Something below shows against this edge: the edge pixel takes the line.
                    soft = n not in holes and lo is not None and (L, lo[1]) in soft_pairs
                    mat = keep[(x, y)][0]
                    if mat in MARKS:
                        continue
                    if soft:
                        if res[(x, y)] != INK:
                            res[(x, y)] = (mat, INNER_DARK)
                    else:
                        res[(x, y)] = INK
                elif not (0 <= n[0] < CW and 0 <= n[1] < CH):
                    continue
                else:
                    res[n] = INK
        out[L] = res
        for pos, v in res.items():
            below[pos] = (INK if v == INK else v, L)
        for pos, (mat, tone, z) in img.items():
            if pos in keep:
                below_z[pos] = max(below_z.get(pos, -99), z)
    return out


# ------------------------------------------------------------------------------- map writing
LETTERS = 'ABCDEFGHIJLMNOPQRSTUVWXYZabcdefghijlmnopqrstuvwxyz0123456789_'


class Sheet:
    """One layer sheet being written: its frames and the letters its materials use."""

    def __init__(self, name, layer, mats, size=(W, H), pivot=PIVOT, intro='', shadow=None):
        self.name, self.layer, self.mats = name, layer, mats
        self.size, self.pivot, self.intro, self.shadow = size, pivot, intro, shadow
        self.frames = {}
        self.letters = {}      # (mat, tone) -> letter

    def code(self, mat, tone):  # noqa: C901
        """Palette (ramp, step) for a material and tone."""
        if (mat, tone) == INK:
            return ('ink', 0)
        if mat.endswith('_far'):
            # The far limb in profile: a step darker, so the two read apart.
            ramp, step = self.code(mat[:-4], tone)
            return (ramp, max(0, step - 1))
        spec = self.mats[mat]
        if mat in MARKS or tone == 'm':
            return spec if len(spec) == 2 else (spec[0], spec[2])
        if spec[0] == 'code':
            return spec
        ramp, sh, base, hi = spec
        if tone == INNER_DARK:
            return (ramp, max(0, sh - 1))
        return (ramp, (sh, base, hi)[tone])

    def letter(self, mat, tone):
        key = self.code(mat, tone)
        if key not in self.letters:
            if key == ('ink', 0):
                self.letters[key] = 'k'
            else:
                self.letters[key] = LETTERS[len([v for v in self.letters.values() if v != 'k'])]
        return self.letters[key]

    def add(self, state, facing, i, img):
        w, h = self.size
        ox = OX + PIVOT[0] - self.pivot[0]
        oy = OY + PIVOT[1] - self.pivot[1]
        rows = []
        for y in range(h):
            r = ''
            for x in range(w):
                v = img.get((x + ox, y + oy))
                if v is None:
                    r += '.'
                elif v == INK:
                    r += self.letter(*INK)
                else:
                    r += self.letter(*v)
            rows.append(r)
        # Nothing may be cut off by the canvas.
        for (x, y) in img:
            assert ox <= x < ox + w and oy <= y < oy + h, (self.name, state, facing, i, x, y)
        self.frames[(state, facing, i)] = rows

    def text(self, anims, events, poses, extra=''):
        w, h = self.size
        lines = [self.intro.rstrip(), f'sheet: {self.name}', 'kind: sprite', 'palette: book07',
                 f'size: {w}x{h}', f'pivot: {self.pivot[0]},{self.pivot[1]}', 'footprint: 10x4']
        if self.shadow:
            lines.append(f'shadow: {self.shadow}')
        lines += ['facings: s n e w', 'placeholder: false']
        for state, (n, ticks, loop) in anims.items():
            lines.append(f'anim.{state}: frames {n}, ticks {ticks}' + (', loop' if loop else ''))
        if events:
            lines.append(f'event.footstep: {events}')
        for state, pose in poses.items():
            lines.append(f'pose.{state}: {pose}')
        lines.append('# The outline and the three tones are authored in the map (people48.py), aware of the')
        lines.append('# layers below this one, so the generator adds no outline of its own.')
        lines.append('outline: . 4')
        for (ramp, step), letter in sorted(self.letters.items(), key=lambda kv: kv[1]):
            lines.append(f'mark.{letter}: {step}' if ramp == 'code' else f'mark.{letter}: {ramp} {step}')
        if extra:
            lines.append(extra.rstrip())
        body = []
        for state in anims:
            for facing in FACINGS:
                for i in range(anims[state][0]):
                    body += ['', f'frame {state} {facing} {i}', *self.frames[(state, facing, i)], 'end']
        return '\n'.join(lines + body) + '\n'


# ----------------------------------------------------------------------------------- preview
def preview(path, sheets_by_layer, order_for, cells, scale=4, ground=(196, 176, 138), crop=(4, 0, 40, 54)):
    """A quick contact sheet for iterating (the real one is made by src/tools/art/proposed.ts).
    cells: rows of (state, facing, i, layers or None for the full order)."""
    from PIL import Image
    x0c, y0c, x1c, y1c = crop
    cw, chh = x1c - x0c, y1c - y0c
    ncol = max(len(r) for r in cells)
    img = Image.new('RGB', ((cw + 2) * ncol + 2, (chh + 2) * len(cells) + 2), ground)
    pix = img.load()
    for ri, row in enumerate(cells):
        for ci, (state, facing, i, only) in enumerate(row):
            ox, oy = 2 + ci * (cw + 2) - x0c, 2 + ri * (chh + 2) - y0c
            for L in (only or order_for(facing)):
                sh = sheets_by_layer.get(L)
                if sh is None:
                    continue
                fr = sh.frames.get((state, facing, i))
                if fr is None:
                    continue
                lx = OX + PIVOT[0] - sh.pivot[0]
                ly = OY + PIVOT[1] - sh.pivot[1]
                inv = {v: k for k, v in sh.letters.items()}
                for y, r in enumerate(fr):
                    for x, ch in enumerate(r):
                        if ch == '.':
                            continue
                        X, Y = x + lx, y + ly
                        if not (x0c <= X < x1c and y0c <= Y < y1c):
                            continue
                        ramp, step = inv[ch]
                        hx = CODE_HEX[step] if ramp == 'code' else rhex(ramp, step)
                        pix[ox + X, oy + Y] = tuple(int(hx[k:k + 2], 16) for k in (1, 3, 5))
    img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    img.save(path)


# ------------------------------------------------------------------------------- the models
class Pose:
    """One frame's skeleton in body space. Offsets are from the rest pose."""

    def __init__(self, **kw):
        self.pel = (0.0, 0.0, 0.0)         # pelvis (r, f, u) offset
        self.lean = (0.0, 0.0)             # shoulders' (r, f) offset from the pelvis
        self.breath = 0.0                  # shoulders and head settle (negative)
        self.head = (0.0, 0.0, 0.0)        # extra head offset
        self.turn = 0                      # -1 looks to its right, +1 to its left (glance)
        self.mouth = 0                     # 1: open, calling
        self.feet = {'R': (0.0, 0.0), 'L': (0.0, 0.0)}   # (f, lift) of each sole
        self.toe = {'R': 0, 'L': 0}        # 1: heel up, on the toe
        self.feet_r = {'R': 0.0, 'L': 0.0} # sideways offset of each foot
        self.hands = {'R': None, 'L': None}  # wrist (r, f, u) in body space, None: hanging
        self.elbow = {'R': (0.3, -1.0, 0.0), 'L': (0.3, -1.0, 0.0)}  # bend: (outward, f, u)
        self.brace = 0.0                   # leaning into the wind from the west
        self.grip = {'R': 'open', 'L': 'open'}
        self.cloth = (0.0, 0.0)            # loose cloth lag (f, u) at the hem
        self.wind = 0.0                    # gust strength 0..1 (from the west)
        self.flap = 0                      # ripple phase in the gust
        self.hair = (0.0, 0.0)             # loose hair lag (f, u)
        self.bow = 'back'                  # 'back' or a draw stage 0..3
        for k, v in kw.items():
            setattr(self, k, v)

    def copy(self, **kw):
        p = Pose()
        p.__dict__.update({k: (dict(v) if isinstance(v, dict) else v) for k, v in self.__dict__.items()})
        for k, v in kw.items():
            setattr(p, k, v)
        return p


class Model:
    def __init__(self, key, shw, upper, lower, upper_e, lower_e, heads, hipw=2.5,
                 limb=3, forearm=3, big=False, neck=4, heavy=False):
        self.key = key
        self.limb, self.forearm, self.big, self.neck, self.heavy = limb, forearm, big, neck, heavy
        self.shw = shw            # shoulder joint offset (arms' centre line)
        self.hipw = hipw
        self.upper, self.lower = upper, lower            # half widths, front and back views
        self.upper_e, self.lower_e = upper_e, lower_e    # (back, front) extents in profile
        self.heads = heads


# Torso rows: the upper block (rows 18 to 23 at rest) rides on the shoulders; the lower block (the
# sash, the belt and the skirt, rows 24 to 35) on the pelvis.
UPPER_ROWS, LOWER_TOP, HEM_K = 6, 6, 17

# Heads, 8 rows from the crown (row 9) to the chin (row 16). Letters: H hair, h hair (the dark
# underside), F skin, e eye, m mouth, b brow, n nose shade, L lashes. The profile is drawn facing
# east; west is the same drawing reversed and shaded again.
HEAD_A = {
    's': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HHhFFhHH',
          'hFeFFeFh',
          'FFFFFFFF',
          '.FFmmFF.',
          '..FFFF..'],
    'n': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HHHHHHHH',
          'HHHHHHHH',
          'FHHHHHHF',
          '.HHHHHH.',
          '..hhhh..'],
    'e': ['..HHHH...',
          '.HHHHHH..',
          'HHHHHHHH.',
          'HHHHHFFF.',
          'HHFHFFeF.',
          'HHFHFFFFF',
          '.HHFFFFF.',
          '..hFFFF..'],
}
HEAD_B = {
    's': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HHhFFhHH',
          'HFeFFeFH',
          'HFFFFFFH',
          'H.FmmF.H',
          'h..FF..h'],
    'n': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HHHHHHHH',
          'HHHHHHHH',
          'HHHHHHHH',
          'HHHHHHHH',
          'hHHHHHHh'],
    'e': ['..HHHH...',
          '.HHHHHH..',
          'HHHHHHHH.',
          'HHHHHhFF.',
          'HHHHFFeF.',
          'HHHHFFFFF',
          'HHHFFFFF.',
          'hHH.FFF..'],
}
HEAD_HILD = {
    's': ['..HHHH..',
          '.HHHHHH.',
          'HHHhhHHH',
          'HHFFFFHH',
          'HFeFFeFH',
          'HFFFFFFH',
          '.FFmmFF.',
          '..FFFF..'],
    'n': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HHHHHHHH',
          'HHHHHHHH',
          'HHHHHHHH',
          '.HHHHHH.',
          '..hhhh..'],
    'e': ['..HHHH...',
          '.HHHHHH..',
          'HHHHHHHH.',
          'HHHHHHFF.',
          'HHHHFFeF.',
          'HHHHFFFFF',
          '.HHHFFFF.',
          '..hFFFF..'],
}
HEAD_LETTERS = {'H': 'hair', 'h': 'hair', 'F': 'skin', 'e': 'eye', 'm': 'mouth', 'b': 'brow',
                'n': 'nose', 'L': 'lash'}

MODEL_A = Model('a', 6.5,
                upper=[4, 5, 5, 5, 5, 5], lower=[5, 5, 5, 5, 5, 5, 5, 5, 5, 5.5, 5.5, 6],
                upper_e=[(-3, 2), (-4, 3), (-4, 3), (-4, 3), (-4, 3), (-3, 3)],
                lower_e=[(-3, 3), (-3, 3), (-3, 3), (-4, 3), (-4, 3), (-4, 3), (-4, 4), (-4, 4),
                         (-4, 4), (-5, 4), (-5, 4), (-5, 5)],
                heads=HEAD_A)
MODEL_B = Model('b', 5.5, forearm=2,
                upper=[3, 4, 4, 4, 4, 4], lower=[4, 4, 4, 4.5, 5, 5, 5, 5, 5, 5.5, 5.5, 6],
                upper_e=[(-3, 2), (-3, 3), (-3, 3), (-3, 3), (-3, 3), (-3, 3)],
                lower_e=[(-3, 3), (-3, 3), (-3, 3), (-4, 3), (-4, 3), (-4, 3), (-4, 4), (-4, 4),
                         (-4, 4), (-5, 4), (-5, 4), (-5, 5)],
                heads=HEAD_B)
MODEL_HILD = Model('hild', 5.5, forearm=2,
                   upper=[3, 4, 4, 4, 4, 4],
                   lower=[4, 4, 4, 4.5, 5, 5, 5, 5.5, 5.5, 6, 6, 6, 6.5, 6.5],
                   upper_e=[(-3, 2), (-3, 3), (-3, 3), (-3, 3), (-3, 3), (-3, 3)],
                   lower_e=[(-3, 3), (-3, 3), (-3, 3), (-4, 3), (-4, 3), (-4, 4), (-4, 4), (-4, 4),
                            (-5, 4), (-5, 4), (-5, 5), (-5, 5), (-5, 5), (-6, 5)],
                   heads=HEAD_HILD)


def P2(facing, pt):
    x, y, d = project(facing, pt)
    return (x + OX, y + OY, d)


def P2g(facing, pt, raise_ok=True):
    """A point on or near the ground: depth may raise it on the screen (a foot further back, seen
    from the front or behind) but never lowers it below the sole row, and a foot carrying the
    weight alone is never raised, so the feet stay on the pivot row."""
    x, y, d = project(facing, pt)
    if facing in 'e w' or not raise_ok:
        y -= d * TILT
    else:
        y -= max(0.0, d * TILT)
    return (x + OX, y + OY, d)


def add(a, b):
    return tuple(a[i] + b[i] for i in range(3))


def joints(m, pose):
    """The skeleton's joints in body space."""
    P = (pose.pel[0], pose.pel[1], 16 + pose.pel[2])
    S = (P[0] + pose.lean[0], P[1] + pose.lean[1], P[2] + 11 + pose.breath)
    j = {'P': P, 'S': S}
    j['C'] = add(add(S, (0, 0.6 * (pose.lean[1] > 0), 3)), pose.head)   # the chin
    for side, sg in (('R', 1), ('L', -1)):
        hip = add(P, (sg * m.hipw, 0, 0))
        f, lift = pose.feet[side]
        ankle = (sg * m.hipw + pose.feet_r[side], f, 2 + lift)
        knee = ik(hip, ankle, 7.0, 7.0, (sg * 0.15, 1.0, 0.0))
        sh = add(S, (sg * m.shw, 0, 0))
        # Hands are given from the shoulder: (outward, forward, up).
        o, hf, hu = pose.hands[side] or (0.0, 0.2, -11.3)
        wrist = add(sh, (sg * o, hf, hu))
        e = pose.elbow[side]
        elbow = ik(sh, wrist, 6.0, 5.5, (sg * e[0], e[1], e[2]))
        j[side] = {'hip': hip, 'knee': knee, 'ankle': ankle, 'sh': sh, 'elbow': elbow, 'wrist': wrist}
    return j


def zseg(part, facing, a, b, w, mat, bias, scale=1.0):
    """A limb segment whose depth follows the bone (an arm swinging in front of the body)."""
    pa, pb = P2(facing, a), P2(facing, b)
    tmp = Part(part.layer, 0)
    tmp.seg(pa[:2], pb[:2], w, mat)
    (x0, y0), (x1, y1) = pa[:2], pb[:2]
    L2 = (x1 - x0) ** 2 + (y1 - y0) ** 2 or 1e-6
    for (x, y), (m, _) in tmp.px.items():
        t = clamp(((x + .5 - x0) * (x1 - x0) + (y + .5 - y0) * (y1 - y0)) / L2, 0, 1)
        part.put(x, y, m, lerp(pa[2], pb[2], t) * scale + bias)


def foot(part, facing, ankle, toe, mat, z, sg, raise_ok=True, w=3):
    """The shoe (or bare foot) under an ankle: 'toe' is the heel raised."""
    x, y, _ = P2g(facing, ankle, raise_ok)
    a, r = int(math.floor(x)), int(math.floor(y))   # r: the ankle's row
    if facing in 's n':
        out = -1 if (sg == 1) == (facing == 's') else 1   # the toes turn a little outward
        cols = list(range(a - (w - 1) // 2 - (1 if w == 4 else 0), a - (w - 1) // 2 - (1 if w == 4 else 0) + w))
        if toe:
            for c in cols:
                part.put(c, r + 1, mat, z)
                part.put(c, r + 2, mat, z)
        else:
            for c in cols:
                part.put(c, r + 1, mat, z)
            for c in cols + [cols[0] + out if out < 0 else cols[-1] + out]:
                part.put(c, r + 2, mat, z)
    else:
        fw = 1 if facing == 'e' else -1

        def P(dx, dy):
            part.put(a + dx * fw, r + dy, mat, z)
            if w > 3 and dx == -1:
                part.put(a - 2 * fw, r + dy, mat, z)
        if toe == 1:            # heel up, pushing off the toe
            for dx in (-1, 0, 1, 2):
                P(dx, 1)
            for dx in (0, 1, 2, 3):
                P(dx, 2)
        elif toe == -1:         # heel strike, toe up
            for dx in (-1, 0, 1, 2, 3):
                P(dx, 1)
            for dx in (-1, 0, 1, 2):
                P(dx, 2)
        else:
            for dx in (-1, 0, 1, 2):
                P(dx, 1)
            for dx in (-1, 0, 1, 2, 3):
                P(dx, 2)


HAND = {
    # Templates from the wrist down: letters F skin. Keyed by (view, grip).
    ('s', 'open'): ['FF', 'FF', '.F'],
    ('e', 'open'): ['FF', 'FF', 'F.'],
    ('s', 'fist'): ['FF', 'FF'],
    ('e', 'fist'): ['FF', 'FF'],
    # Big hands for the heavy build.
    ('S', 'open'): ['FFF', 'FFF', '.FF'],
    ('E', 'open'): ['FFF', 'FFF', 'FF.'],
    ('S', 'fist'): ['FFF', 'FFF'],
    ('E', 'fist'): ['FFF', 'FFF'],
}


def hand(part, facing, wrist, elbow, grip, z, sg, mat='skin', big=False):
    x, y, _ = P2(facing, wrist)
    ex, ey, _ = P2(facing, elbow)
    view = 's' if facing in 's n' else 'e'
    key = view.upper() if big else view
    rows = HAND.get((key, grip), HAND[(key, 'open')])
    # Hands point along the forearm; a raised hand is drawn above the wrist.
    up = ey > y + 1
    flip = (sg == 1) == (facing in 's') if view == 's' else facing == 'w'
    if facing == 'n':
        flip = sg == 1
    w = len(rows[0])
    x0 = int(math.floor(x - w / 2 + 0.5))
    y0 = int(math.floor(y)) + (1 if not up else -len(rows))
    if up:
        rows = rows[::-1]
    for j, r in enumerate(rows):
        r = r[::-1] if flip else r
        for i, ch in enumerate(r):
            if ch != '.':
                part.put(x0 + i, y0 + j, mat, z)


def ext(m, facing, k, c):
    """Columns x0..x1 of torso row k centred on c."""
    if k < UPPER_ROWS:
        v, ve = m.upper[k], m.upper_e[k]
    else:
        v, ve = m.lower[k - UPPER_ROWS], m.lower_e[k - UPPER_ROWS]
    if facing in 's n':
        return math.floor(c - v + 0.5), math.floor(c + v - 0.5)
    b, f = ve
    if facing == 'e':
        return math.floor(c) + b, math.floor(c) + f - 1
    return math.floor(c) - f, math.floor(c) - b - 1


def torso_rows(m, facing, j):
    """(row, k, centre) for each torso row: the upper block rides the shoulders, the lower block
    (sash, belt, skirt) the pelvis; where they meet the lower block wins (the chest settles into
    the belt) and a gap is filled from the chest's last row."""
    Sx, Sy, _ = P2(facing, j['S'])
    Px, Py, _ = P2(facing, j['P'])
    top = math.floor(Sy) - 1
    prow = math.floor(Py)
    c = lambda k: Px + (Sx - Px) * max(0.0, 1 - k / 12)
    out = {}
    nlow = len(m.lower)
    first_low = prow - 12 + UPPER_ROWS
    for k in range(UPPER_ROWS):
        out[top + k] = (k, c(k))
    for row in range(top + UPPER_ROWS, first_low):
        out[row] = (UPPER_ROWS - 1, c(UPPER_ROWS - 1))
    for k in range(UPPER_ROWS, UPPER_ROWS + nlow):
        out[prow - 12 + k] = (k, c(k))
    return sorted((r, k, cc) for r, (k, cc) in out.items())


def fig(ch, facing, pose, prev):
    """All parts of one frame of a standing character."""
    m = ch.model
    if pose.brace:
        west = {'s': (1, 0), 'n': (-1, 0), 'e': (0, -1), 'w': (0, 1)}[facing]
        pose = pose.copy(lean=(pose.lean[0] + west[0] * pose.brace, pose.lean[1] + west[1] * pose.brace))
    j = joints(m, pose)
    parts = []
    near = {'s': None, 'n': None, 'e': 'R', 'w': 'L'}[facing]
    prof = facing in 'e w'
    fw = {'e': 1, 'w': -1}.get(facing, 0)          # screen direction of forward in profile
    # Loose things lag a frame: how far the body moved since the previous frame.
    lag_u = (prev.pel[2] + prev.breath) - (pose.pel[2] + pose.breath)
    lag_f = (prev.pel[1] - pose.pel[1]) + pose.cloth[0]
    lag_u += pose.cloth[1]
    rows = torso_rows(m, facing, j)
    trail = -pose.cloth[0]
    if prof and abs(trail) > 1.2:
        # The hem drags a frame behind: the skirt's last rows trail (or swing on, stopping).
        last = UPPER_ROWS + len(m.lower) - 1
        shifted = []
        for row, k, c in rows:
            t = max(0, k - (last - 4)) / 4
            shifted.append((row, k, c - fw * round(clamp(trail, -2, 2) * 0.6 * t)))
        rows = shifted
    lowz = 3.0 if prof else 0.3

    # ---- torso: the body's linen shirt and the clothing over it
    tb = Part('body', 0.0, 'torso', side=1)
    tc = Part('clothing', 0.0, 'tunic', side=1)
    tl = Part('clothing', lowz, 'skirt', side=1)
    for row, k, c in rows:
        x0, x1 = ext(m, facing, k, c)
        if k <= 11:
            tb.row(row, x0, x1, 'linen')
        mat = ch.torso_mat(k)
        (tc if k < UPPER_ROWS else tl).row(row, x0, x1, mat)
    # The neck opening, the buckle and the folds.
    top_row, _, ctop = rows[0]
    cx = math.floor(ctop)
    if facing == 's':
        # The neck slit of the tunic.
        tc.erase(cx - 1, top_row)
        tc.erase(cx, top_row)
        tb.put(cx - 1, top_row, 'skin')
        tb.put(cx, top_row, 'skin')
        tc.put(cx - 1, top_row + 1, 'fold')
    for row, k, c in rows:
        x0, x1 = ext(m, facing, k, c)
        cc = math.floor(c)
        if k == 8 and facing == 's':
            tl.put(cc - 1, row, 'buckle')
            tl.put(cc, row, 'buckle')
        if k == 8 and facing in 'e w':
            tl.put(x1 if facing == 'e' else x0, row, 'buckle')
        if ch.skirt_from <= k:
            kk = k - ch.skirt_from
            last = UPPER_ROWS + len(m.lower) - 1
            if facing in 's n':
                if k >= last - 2:
                    tl.put(cc - 1, row, 'fold')
            elif kk >= len(m.lower) - 4:
                tl.put(cc + (1 if facing == 'e' else -2), row, 'fold')
    parts += [tb, tc, tl]

    # ---- neck and head
    Cx, Cy, _ = P2(facing, j['C'])
    chin = math.floor(Cy)
    neck = Part('body', 0.4, 'neck')
    ncx = math.floor(Cx)
    if prof:
        for x in range(ncx - 2, ncx + 1) if facing == 'e' else range(ncx - 1, ncx + 2):
            neck.put(x, chin + 1, 'skin')
            neck.put(x, chin + 2, 'skin')
    else:
        for x in range(ncx - m.neck // 2, ncx + m.neck // 2):
            neck.put(x, chin + 1, 'skin')
            neck.put(x, chin + 2, 'skin')
    parts.append(neck)
    head = Part('body', 0.5, 'head', bottom=False)
    tpl = m.heads['e' if prof else facing]
    tpl = turn_head(tpl, pose.turn, facing)
    if pose.mouth and facing in 's e w':
        tpl = [r.replace('m', 'M') for r in tpl]
    else:
        # A closed mouth is left to the shading: at this size a mark reads as a beard.
        tpl = [r.replace('m', 'F') for r in tpl]
    letters = dict(HEAD_LETTERS, M='mouth')
    wdt = len(tpl[0])
    if facing == 'w':
        x0 = ncx - (wdt - 4)
    else:
        x0 = ncx - 4
    head.stamp(tpl, x0, chin - 7, letters, flip=facing == 'w')
    if pose.mouth:
        # An open mouth is two pixels deep.
        for (x, y), (mt, z) in list(head.px.items()):
            if mt == 'mouth' and (x, y + 1) in head.px:
                head.put(x, y + 1, 'mouth')
    parts.append(head)
    ch.hair_extra(parts, facing, j, pose, prev, chin, ncx, head)

    # ---- arms and hands
    far = {'e': 'L', 'w': 'R'}.get(facing)
    for side, sg in (('R', 1), ('L', -1)):
        J = j[side]
        fs = '_far' if side == far else ''
        if prof:
            bias = 0.0
        else:
            bias = 0.6
        sleeve_b = Part('body', 0, 'arm' + side)
        sleeve_c = Part('clothing', 0, 'sleeve' + side)
        for part, mat in ((sleeve_b, 'linen' + fs), (sleeve_c, ch.sleeve + fs)):
            zseg(part, facing, J['sh'], J['elbow'], m.limb, mat, bias)
            zseg(part, facing, J['elbow'], J['wrist'], m.forearm, mat, bias)
        # The shoulder cap rounds the top of the arm into the torso.
        hd = Part('body', 0, 'hand' + side)
        wz = P2(facing, J['wrist'])[2] + bias + 0.05
        hand(hd, facing, J['wrist'], J['elbow'], pose.grip[side], wz, sg, 'skin' + fs, m.big)
        parts += [sleeve_b, sleeve_c, hd]

    # ---- legs
    for side, sg in (('R', 1), ('L', -1)):
        J = j[side]
        fs = '_far' if side == far else ''
        d = P2(facing, J['hip'])[2]
        z = d * 0.4 if prof else d * 0.1 - 1
        lb = Part('body', z, 'leg' + side)
        lc = Part('clothing', z, 'leg' + side)
        kx, ky, _ = P2(facing, J['knee'])
        other = 'L' if side == 'R' else 'R'
        raise_ok = pose.feet[other][1] == 0
        for part, thigh, shin, ft in ((lb, 'linen' + fs, 'skin' + fs, 'skin' + fs),
                                      (lc, ch.trouser + fs, 'wrap' + fs, 'shoe' + fs)):
            part.seg(P2(facing, J['hip'])[:2], (kx, ky), m.limb, thigh)
            part.seg((kx, ky + 1), P2g(facing, J['ankle'], raise_ok)[:2], m.limb, shin)
            foot(part, facing, J['ankle'], pose.toe[side], ft, z, sg, raise_ok, m.limb)
        # The wraps spiral round the shin.
        ad = P2(facing, J['ankle'])[2]
        if facing == 'n' and ad > 3:
            # Seen from behind, a heel kicked up behind swings out past the cloak's hem.
            for part in (lb, lc):
                for (x, y), (mt, zz) in list(part.px.items()):
                    if y > ky:
                        part.px[(x, y)] = (mt, 3.5)
        for (x, y), (mt, zz) in list(lc.px.items()):
            if mt.startswith('wrap') and (x + y) % 3 == 0 and (x - 1, y) in lc.px and lc.px[(x - 1, y)][0] == mt:
                lc.put(x, y, 'wrapd')
        if hasattr(ch, 'leg_hook'):
            ch.leg_hook(lc, side, J, facing)
        parts += [lb, lc]
    ch.extras(parts, facing, j, pose, prev, rows, lag_u, lag_f)
    return parts


def turn_head(tpl, turn, facing):
    """A glance: the face's features slide a pixel inside the head's outline."""
    if not turn:
        return tpl
    out = []
    feat = set('eFmhbM')
    for y, r in enumerate(tpl):
        r = list(r)
        if facing in 's n' and 3 <= y <= 6:
            idx = [i for i, ch in enumerate(r) if ch != '.']
            if idx:
                lo, hi = idx[0], idx[-1]
                inner = r[lo:hi + 1]
                if facing == 's':
                    # turn +1: towards its left (screen right in the south view)
                    inner = (['H'] + inner[:-1]) if turn > 0 else (inner[1:] + ['H'])
                    if y >= 5:
                        inner = [('F' if c == 'H' else c) for c in inner]
                else:
                    inner = (inner[1:] + [inner[-1]]) if turn > 0 else ([inner[0]] + inner[:-1])
                r[lo:hi + 1] = inner
        elif facing in 'e w' and 3 <= y <= 6:
            # Profile: looking back towards the camera (the eye moves back) or up.
            if turn < 0:
                r = ['.' if c == '.' else c for c in r]
                if 'e' in r:
                    i = r.index('e')
                    r[i] = 'F'
                    r[i - 1] = 'e'
        out.append(''.join(r))
    if facing in 'e w' and turn > 0:
        # Looking up: the eye rises a row.
        out = [r for r in out]
        for y in range(1, len(out)):
            if 'e' in out[y]:
                i = out[y].index('e')
                out[y] = out[y][:i] + 'F' + out[y][i + 1:]
                if out[y - 1][i] in 'Fh':
                    out[y - 1] = out[y - 1][:i] + 'e' + out[y - 1][i + 1:]
                break
    return out


def ripple(row, flap, amp):
    return amp * math.sin(row * 0.9 + flap * 1.7)


class Steerer:
    """The steerer (Book 5 section 02, Book 7 section 07): Norse household dress, a madder sash at
    the belt, a wool cloak pinned at the right shoulder with a madder border, and a bow."""

    sleeve, trouser = 'tunic', 'trouser'
    skirt_from = 9

    sash = True

    def __init__(self, model):
        self.model = model
        self.helmet = False

    def torso_mat(self, k):
        return 'sash' if k in (6, 7) else 'belt' if k == 8 else 'tunic'

    def hair_extra(self, parts, facing, j, pose, prev, chin, ncx, head):
        if self.model.key != 'b':
            return
        # Model B's hair is long and tied at the nape: the tail hangs and lags.
        lag = (prev.pel[2] + prev.breath) - (pose.pel[2] + pose.breath)
        tail = Part('body', {'s': -1.0, 'n': 3.6, 'e': 5.6, 'w': 5.6}[facing], 'tail', side=0)
        n = 7
        for i in range(n):
            t = i / (n - 1)
            dy = round(lag * t)
            wind = pose.wind * (1.5 + 3 * t) + ripple(i, pose.flap, 0.6 * pose.wind)
            if facing == 'n':
                x = ncx - 1 + round(wind * t)
                y = chin + 1 + i + dy
                tail.put(x, y, 'hair')
                tail.put(x + 1, y, 'hair')
            elif facing in 'e w':
                back = -1 if facing == 'e' else 1
                trail = -pose.cloth[0] * 1.5 * t
                xb = ncx + back * 3 + round(back * (0.8 * t) + back * trail + wind * (1 if facing == 'e' else 1))
                y = chin - 1 + i + dy
                tail.put(xb, y, 'hair')
                if i < n - 2:
                    tail.put(xb - back, y, 'hair')
            else:
                continue
        parts.append(tail)

    def extras(self, parts, facing, j, pose, prev, rows, lag_u, lag_f):
        m = self.model
        prof = facing in 'e w'
        top_row = rows[0][0]
        Sx, Sy, _ = P2(facing, j['S'])
        Px, Py, _ = P2(facing, j['P'])
        # ---- sash tails: knotted on the left hip, they hang and lag (Book 7 section 07)
        tails = Part('clothing', {'s': 0.6, 'n': 0.6, 'e': -4, 'w': 4.2}[facing], 'sashtail', side=0)
        knot = [r for r in rows if r[1] == 7][0]
        x0, x1 = ext(m, facing, 7, knot[2])
        kr = knot[0]
        if facing in 's n':
            out = 1 if facing == 's' else -1
            kx = (x1 - 2) if facing == 's' else (x0 + 1)       # the knot's left column
            tails.fill(kx, kr, kx + 1, kr + 1, 'sash')
            for side, spread, n, mat in ((0, -0.4, 4, 'sash'), (1, 0.6, 3, 'sashd')):
                for i in range(n):
                    t = i / 3
                    sway = pose.wind * (0.6 + 2.2 * t) + ripple(i + side, pose.flap, 0.5 * pose.wind)
                    y = kr + 2 + i + round(lag_u * t)
                    tails.put(kx + side + round(sway + spread * t), y, mat)
        elif facing == 'w':
            kx = math.floor(knot[2])
            tails.fill(kx - 1, kr, kx, kr + 1, 'sash')
            for side, spread in ((0, -0.7), (1, 0.7)):
                for i in range(4):
                    t = i / 3
                    sway = pose.wind * (0.6 + 2.2 * t) + ripple(i + side, pose.flap, 0.5 * pose.wind)
                    trail = -pose.cloth[0] * t * 1.5
                    y = kr + 2 + i + round(lag_u * t) - side
                    tails.put(kx - 1 + side + round(sway + trail + spread * t), y, 'sash')
        if self.sash:
            parts.append(tails)
        cloak_wool(parts, facing, j, pose, rows, lag_u, m, brooch=True)
        if self.helmet:
            helmet(parts, facing, j, pose)
        bow(parts, facing, j, pose, m)


def cloak_wool(parts, facing, j, pose, rows, lag_u, m, brooch):
    """A rectangular wool cloak pinned at the right shoulder, with a madder tablet-woven border
    along its hem and front edges (the steerer's accent from behind, Book 7 section 07)."""
    top_row, _, ctop = rows[0]
    Px, Py, _ = P2(facing, j['P'])
    Sx, Sy, _ = P2(facing, j['S'])
    hem = 41 + OY - round(pose.pel[2] + lag_u)
    wind, flap = pose.wind, pose.flap
    trail = -pose.cloth[0]          # positive: the hem trails behind
    sw = m.shw + 1.5                # half width over the shoulders
    torso_hw = m.upper[2]
    if facing in 's n':
        # Running, the cloak streams out behind and its hem lifts off the legs.
        hem -= round(max(0.0, trail - 1.0) * 2.0)
        if facing == 's':
            # Seen from the front: the inside of the cloak hangs behind, in shadow.
            panel = Part('cloak', -3.0, 'panel', side=1, rim=False)
            top = top_row + 2
        else:
            panel = Part('cloak', 3.0, 'panel', side=1)
            top = top_row - 1
        for row in range(top, hem + 1):
            t = (row - top) / max(1, hem - top)
            c = lerp(Sx, Px, min(1, t * 2))
            if facing == 'n':
                # Over the shoulders, then hanging down the back between the arms, wider below.
                hw = sw if row <= top_row + 1 else (torso_hw + 1.0 + 3.2 * t + 0.6 * trail * t)
                if row == top:
                    hw = torso_hw - 1
            else:
                hw = sw - 0.5 + 2.4 * t
            wr = wind * (0.5 + 4.5 * t ** 1.4) + ripple(row, flap, 0.8 * wind * t)
            wl = -wind * 1.6 * t
            x0 = max(OX + 1, math.floor(c - hw + 0.5) + round(wl))
            x1 = min(OX + W - 2, math.floor(c + hw - 0.5) + round(wr))
            band = row >= hem - (1 if facing == 's' else 1)
            for x in range(x0, x1 + 1):
                mat = 'lining' if band else ('cloakin' if facing == 's' else 'cloak')
                panel.put(x, row, mat)
            if facing == 'n' and row > top_row + 5 and not band:
                # Folds fall from the shoulder blades to the hem.
                cc = math.floor(c)
                for fx in (cc - 3 - round(t), cc + 2 + round(t * 1.5)):
                    if x0 < fx < x1 and (row + fx) % 5 != 0:
                        panel.put(fx, row, 'cloakf')
        # The hem rises where the gust lifts it.
        if wind > 0:
            for x in range(0, CW):
                lift = round(wind * 2.5 * max(0, (x - Px) / 10) + ripple(x, flap, wind * 0.7))
                for k in range(max(0, lift)):
                    panel.erase(x, hem - k)
                if lift > 0 and panel.has(x, hem - lift):
                    panel.put(x, hem - lift, 'lining')
        parts.append(panel)
        if facing == 's':
            # The front: the cloak lies over both shoulders and is pinned on the right one.
            yoke = Part('cloak', 1.0, 'yoke', side=0)
            c = math.floor(Sx)
            L = math.floor(c - sw + 0.5)
            R = math.floor(c + sw - 0.5)
            yoke.row(top_row - 1, c - 3, c + 2, 'cloak')
            yoke.row(top_row, L + 1, c - 3, 'cloak')
            yoke.row(top_row, c + 2, R - 1, 'cloak')
            yoke.row(top_row + 1, L, c - 4, 'cloak')
            yoke.row(top_row + 1, c + 3, R, 'cloak')
            yoke.row(top_row + 2, L, L + 2, 'cloak')
            yoke.row(top_row + 2, R - 2, R, 'cloak')
            # The turned front edges show the madder border.
            yoke.put(c - 3, top_row, 'lining')
            yoke.put(c + 2, top_row, 'lining')
            yoke.put(c + 3, top_row + 1, 'lining')
            parts.append(yoke)
            if brooch:
                b = Part('cloak', 1.2, 'brooch', rim=True)
                b.fill(c - 5, top_row, c - 4, top_row + 1, 'brooch')
                b.put(c - 5, top_row, 'bglint')
                parts.append(b)
        else:
            col = Part('cloak', 3.1, 'collar', side=0)
            c = math.floor(Sx)
            col.row(top_row - 2, c - 2, c + 1, 'cloak')
            parts.append(col)
    else:
        fw = 1 if facing == 'e' else -1
        panel = Part('cloak', 0, 'panel', side=0)
        tr = {r: (k, cc) for r, k, cc in rows}
        # Running, the cloak streams out behind and its hem lifts off the legs.
        hem -= round(max(0.0, trail - 1.0) * 1.5)
        last = rows[-1]
        for row in range(top_row, hem + 1):
            t = (row - top_row) / max(1, hem - top_row)
            k, cc = tr.get(row, (last[1], last[2]))
            x0, x1 = ext(m, facing, k, cc)
            backx = x0 if fw > 0 else x1           # the torso's back edge on this row
            outward = min(8.0, 2.0 + 3.2 * t + trail * (0.3 + 1.6 * t))
            if row <= top_row + 1:
                cover = (math.floor(Sx) + 2 - backx) * fw + 1 if row == top_row + 1 else 4
                z = 7.0
            elif row <= last[0]:
                cover, z = 2, 4.0
            else:
                cover, z = 0, 0.0
            front_extra = 0.0
            if wind > 0:
                if facing == 'e':     # the gust comes from behind: pressed to the back, the hem flies forward
                    outward -= wind * 1.4 * t
                    if row > last[0] - 2:
                        front_extra = wind * (7.0 * t ** 2) + ripple(row, flap, wind * 0.8 * t)
                else:                 # facing into the gust: it streams out behind
                    outward += wind * (1.0 + 5.0 * t ** 1.3) + ripple(row, flap, wind * 0.9 * t)
            outer = backx - fw * round(outward)
            inner = backx + fw * (cover - 1) + fw * round(front_extra)
            lo, hi = max(OX + 1, min(outer, inner)), min(OX + W - 2, max(outer, inner))
            band = row >= hem - 1
            for x in range(lo, hi + 1):
                panel.put(x, row, 'lining' if band else 'cloak', z)
        if wind > 0 and facing == 'w':
            for x in range(0, CW):
                lift = round(wind * 2.5 * max(0, (x - Px) / 8))
                for k in range(max(0, lift)):
                    panel.erase(x, hem - k)
                if lift > 0 and panel.has(x, hem - lift):
                    panel.put(x, hem - lift, 'lining', 1.0)
        parts.append(panel)
        if brooch and facing == 'e':
            b = Part('cloak', 7.2, 'brooch')
            bx = math.floor(Sx) + 1
            b.fill(bx, top_row, bx + 1, top_row + 1, 'brooch')
            b.put(bx, top_row, 'bglint')
            parts.append(b)


def helmet(parts, facing, j, pose):
    """A plain rounded iron cap with a brow band (Book 7 section 07: no horns)."""
    Cx, Cy, _ = P2(facing, j['C'])
    chin = math.floor(Cy)
    c = math.floor(Cx)
    hp = Part('helmet', 0.7, 'cap', side=1)
    crown = chin - 8
    if facing in 's n':
        shape = [(c - 3, c + 2), (c - 4, c + 3), (c - 5, c + 4), (c - 5, c + 4), (c - 5, c + 4)]
    else:
        f = 1 if facing == 'e' else -1
        base = [(-4, 3), (-5, 4), (-5, 5), (-5, 5), (-5, 5)]
        shape = [(c + a, c + b - 1) if f > 0 else (c - b, c - a - 1) for a, b in base]
    for i, (x0, x1) in enumerate(shape):
        hp.row(crown + i, x0, x1, 'iron' if i < 4 else 'ironband')
    # A ridge down the middle catches the light.
    if facing in 's n':
        for y in (crown, crown + 1, crown + 2):
            hp.put(c - 1, y, 'glint') if y == crown + 1 else None
    else:
        hp.put(c - 1, crown + 1, 'glint')
    parts.append(hp)


def bow_points(m, j, pose, facing):
    """The bow's two tips, its grip and the string's nock point in body space."""
    if pose.bow == 'back':
        top = add(j['S'], (5.0, -4.6, 13.0))
        bot = add(j['P'], (-6.0, -4.6, -10.0))
        return top, bot, None, None
    stage = pose.bow
    g = j['L']['wrist']
    # The bow stands upright in the left hand; the limbs bend more at full draw.
    cant = (0.0, 0.0, 1.0)
    half = 18.0
    top = (g[0] + cant[0] * half, g[1] + 0.6, g[2] + half)
    bot = (g[0] - cant[0] * half, g[1] + 0.6, g[2] - half)
    nock = j['R']['wrist'] if stage in (1, 2) else None
    return top, bot, g, nock


def bow(parts, facing, j, pose, m):
    """A self bow, 36 px, carried on the back or drawn in the left hand."""
    top, bot, grip, nock = bow_points(m, j, pose, facing)
    st = Part('bow', 0, 'stave', side=0)
    if pose.bow == 'back':
        zb = {'s': -4.5, 'n': 4.5, 'e': 6.0, 'w': 6.0}[facing]
        a, b = P2(facing, top), P2(facing, bot)
        n = 40
        pts = []
        for i in range(n + 1):
            t = i / n
            x, y = lerp(a[0], b[0], t), lerp(a[1], b[1], t)
            # A gentle curve: the strung bow's arc.
            off = 1.3 * math.sin(math.pi * t)
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy) or 1
            pts.append((x + off * dy / L, y - off * dx / L))
        for p0, p1 in zip(pts, pts[1:]):
            st.line(p0, p1, 'wood', zb)
        # Thicken the middle of the stave (the grip).
        for (x, y), (mt, z) in list(st.px.items()):
            t = (y - a[1]) / ((b[1] - a[1]) or 1)
            if 0.3 < t < 0.7:
                st.put(x + 1, y, 'wood', zb)
        s = Part('bow', zb - 0.01 if facing != 's' else zb, 'string', rim=False)
        s.line(a[:2], b[:2], 'string', zb - 0.05)
        parts += [st, s]
        return
    bow_drawn(parts, facing, j, pose)


STEERER_MATS = {
    'skin': ('skin_light', 2, 3, 4), 'hair': ('hair_brown', 1, 2, 3),
    'eye': ('ink', 0), 'mouth': ('skin_light', 2), 'nose': ('skin_light', 2), 'brow': ('hair_brown', 1, 1, 2),
    'linen': ('wool', 4, 5, 6),
    'tunic': ('earth', 3, 4, 5), 'fold': ('earth', 3),
    'sash': ('madder', 2, 3, 4), 'sashd': ('madder', 1, 2, 3), 'belt': ('tar', 0, 1, 2), 'buckle': ('stone', 6, 7, 8),
    'trouser': ('woad', 1, 2, 3), 'wrap': ('wool', 2, 3, 4), 'wrapd': ('wool', 1),
    'shoe': ('tar', 1, 2, 3),
    'cloak': ('driftwood', 2, 3, 4), 'lining': ('madder', 2, 3, 4),
    'cloakin': ('driftwood', 1, 2, 3), 'cloakf': ('driftwood', 2),
    'brooch': ('trefoil', 1, 2, 3), 'bglint': ('trefoil', 4),
    'iron': ('stone', 3, 5, 7), 'ironband': ('stone', 2, 4, 6), 'glint': ('stone', 9),
    'wood': ('bracken', 1, 2, 4), 'string': ('wool', 4, 5, 6), 'strap': ('tar', 2, 3, 4),
    'arrow': ('driftwood', 3, 4, 5), 'fletch': ('gull', 4), 'head': ('stone', 8),
}
STEERER_ORDER = {'s': ['body', 'clothing', 'bow', 'cloak', 'helmet'],
                 'n': ['body', 'clothing', 'cloak', 'bow', 'helmet'],
                 'e': ['body', 'clothing', 'cloak', 'bow', 'helmet'],
                 'w': ['body', 'clothing', 'cloak', 'bow', 'helmet']}
SOFT = {('clothing', 'body')}


# ------------------------------------------------------------------------------- animations
# Hands hanging: (outward, forward, up) from the shoulder.
HANG = (0.0, 0.2, -11.3)


def swing(f, up=0.0, out=0.0):
    """A hand swung forward (f > 0) or back: the elbow bends as it comes forward."""
    return (out + 0.25 * abs(f) * (f < 0), f, -11.3 + up + 0.18 * max(0, f) ** 1.5 / 2)


def anim_idle():
    return [Pose(breath=b) for b in (0, -1, -1, 0)]


def anim_shift():
    """A weight shift: onto the right leg, the left knee easing, and back."""
    out = []
    for i, (pr, pf, toe, b) in enumerate([(0, 0, 0, 0), (1, 1, 1, 0), (1, 1, 1, -1), (0, 0, 0, 0)]):
        p = Pose(pel=(pr, pf, 0), breath=b, lean=(-0.5 * pr, -0.6 * pf))
        p.toe = {'R': 0, 'L': toe}
        p.feet = {'R': (0, 0), 'L': (0.6 * toe, 0)}
        p.hands = {'R': (0.4, 0.2 + 0.6 * pf, -11.3), 'L': (0.4 + 0.6 * pr, 0.2, -11.3)}
        out.append(p)
    return out


def anim_glance():
    return [Pose(turn=t, breath=b) for t, b in ((0, 0), (-1, 0), (0, -1), (1, 0))]


def anim_idlewind():
    """A gust from the west: braced into it, a hand at the cloak, cloth and hair streaming east."""
    out = []
    for i, w in enumerate((0.7, 1.0, 0.85, 1.0)):
        p = Pose(wind=w, flap=i, brace=1.0, breath=(0, -1, -1, 0)[i] * 0)
        p.hands = {'R': (-3.6, 3.2, -5.2), 'L': HANG}
        p.elbow = {'R': (1.0, -0.6, 0.0), 'L': (0.3, -1.0, 0.0)}
        p.grip = {'R': 'fist', 'L': 'open'}
        out.append(p)
    return out


def gait(steps, pel_u, arms, toe_seq, lift_seq, cloth, lean=(0, 0), extra=None):
    """A cycle from per-frame values: steps are (right f, left f) of the soles, lifts their heights."""
    out = []
    for i in range(len(steps)):
        p = Pose(pel=(0, 0, pel_u[i]), lean=lean, cloth=cloth[i])
        p.feet = {'R': (steps[i][0], lift_seq[i][0]), 'L': (steps[i][1], lift_seq[i][1])}
        p.toe = {'R': toe_seq[i][0], 'L': toe_seq[i][1]}
        p.hands = {'R': arms[i][0], 'L': arms[i][1]}
        if extra:
            extra(i, p)
        out.append(p)
    return out


def anim_walk(heavy=False):
    """Right contact, right down, passing, left contact, left down, passing. The planted foot moves
    back 4 px a frame: at 5 ticks a frame, 48 px a second, the walk speed (Book 10: 2.0 tiles a
    second), so the feet do not slide. The torso and head drop exactly 1 px on the down frames
    (2 px for the heavy build, which also swings its arms a little less)."""
    R = [6, 2, -2, -6, -3, 1]          # the right sole: planted 0 to 3, swinging 3 to 0
    L = [-6, -3, 1, 6, 2, -2]
    lift = [(0, 0), (0, 2), (0, 3), (0, 0), (2, 0), (3, 0)]
    toe = [(-1, 1), (0, 1), (0, 0), (1, -1), (1, 0), (0, 0)]
    drop = 2 if heavy else 1
    pel = [0, -drop, 0, 0, -drop, 0]
    k = 0.85 if heavy else 1.0
    sw = [5 * k, 4 * k, 0, -5 * k, -4 * k, 0]          # the left hand swings with the right foot
    arms = [(swing(-a), swing(a)) for a in sw]
    cloth = [(-1.0 + 0.5 * math.cos(i * math.pi / 3), 0) for i in range(6)]

    def extra(i, p):
        p.hair = p.cloth
    return gait(list(zip(R, L)), pel, arms, toe, lift, cloth, lean=(0, 0.6), extra=extra)


# The run (addendum 2.3 section 12): contact, down, passing, suspension for each foot. At 3 ticks a
# frame the run's 144 px a second is 7.2 px a frame, so the planted foot moves back 7 px a frame
# through contact, down and passing (+7, 0, -7), and a stride is about 29 px.
RUN_LEG = {
    # The right sole (f, lift, toe) through the cycle; the left runs half a cycle behind.
    False: [(7, 0, -1), (0, 0, 0), (-7, 0, 1), (-9, 5, 0), (-6, 9, 0), (-1, 8, 0), (3, 6, 0), (6, 2, 0)],
    # Heavy: a deeper down, a lower knee and heel, and a flight of exactly 1 px.
    True: [(6.5, 0, -1), (0, 0, 0), (-6.5, 0, 1), (-8, 3, 0), (-5.5, 6, 0), (-1, 6, 0), (3, 4, 0), (5.5, 1, 0)],
}
RUN_PEL = {False: [-1, -2, -1, 0, -1, -2, -1, 0], True: [-1, -3, -1, -1, -1, -3, -1, -1]}


def run_arm(a, heavy):
    """A pumping arm, elbow near a right angle: a = 1 fist forward at chest height, -1 elbow driven
    far back."""
    if heavy:
        F, B = (-2.2, 3.6, -4.6), (0.8, -3.2, -8.4)
    else:
        F, B = (-2.6, 4.5, -4.0), (0.8, -4.2, -8.4)
    t = (a + 1) / 2
    return tuple(lerp(B[k], F[k], t) for k in range(3))


def anim_run(heavy=False):
    """A forward tilt for the whole run (shoulders 2 px and the head 3 px ahead of the hips), one
    suspension frame per stride with both feet off the ground, the leading knee bending deep on the
    down frames as the torso drops, the knee driving high on the forward swing, the heel kicking up
    behind after push-off, and the elbows pumping opposite the legs. Hair, hem, cloak and sash trail
    a frame behind."""
    legR = RUN_LEG[heavy]
    pel = RUN_PEL[heavy]
    phase = [-1, -0.7, 0, 0.7, 1, 0.7, 0, -0.7]
    if heavy:   # a slightly slower swing: it lags half a frame and reaches less far
        phase = [-0.85, -0.85, -0.3, 0.4, 0.85, 0.85, 0.3, -0.4]
    out = []
    for i in range(8):
        r, l = legR[i], legR[(i + 4) % 8]
        p = Pose(pel=(0, 0, pel[i]), lean=(0, 2.0), head=(0, 1.0, 0))
        p.feet = {'R': (r[0], r[1]), 'L': (l[0], l[1])}
        p.toe = {'R': r[2], 'L': l[2]}
        p.hands = {'R': run_arm(phase[i], heavy), 'L': run_arm(-phase[i], heavy)}
        p.elbow = {'R': (0.3, -1.0, 0.4), 'L': (0.3, -1.0, 0.4)}
        p.grip = {'R': 'fist', 'L': 'fist'}
        p.cloth = (-2.4 + 0.6 * math.cos(i * math.pi / 2), 0)
        p.hair = p.cloth
        out.append(p)
    return out


def anim_runstart(heavy=False):
    """One frame leaning into the start: low, tipped forward, the back foot pushing off."""
    p = Pose(pel=(0, 0, -3 if heavy else -2), lean=(0, 3.0), head=(0, 1.0, 0))
    p.feet = {'R': (-6, 0), 'L': (3, 0)}
    p.toe = {'R': 1, 'L': 0}
    p.hands = {'R': run_arm(0.8, heavy), 'L': run_arm(-0.8, heavy)}
    p.elbow = {'R': (0.3, -1.0, 0.4), 'L': (0.3, -1.0, 0.4)}
    p.grip = {'R': 'fist', 'L': 'fist'}
    p.cloth = (-1.4, 0)
    p.hair = p.cloth
    return [p]


def anim_runstop(heavy=False):
    """A short skid on the front heel, leaning back with the arms out, then settling; the cloak and
    hair swing on forward past the body and come back."""
    a = Pose(pel=(0, 0, -3 if heavy else -2), lean=(0, -1.5), head=(0, -0.5, 0))
    a.feet = {'R': (-4, 0), 'L': (7, 0)}
    a.toe = {'R': 1, 'L': -1}
    a.hands = {'R': (1.2, 3.5, -6.5), 'L': (1.2, 3.0, -7.0)}
    a.elbow = {'R': (0.6, -1.0, 0.0), 'L': (0.6, -1.0, 0.0)}
    a.cloth = (2.0, 0)
    a.hair = a.cloth
    b = Pose(pel=(0, 0, -1), lean=(0, 0.3))
    b.feet = {'R': (-1.5, 0), 'L': (2, 0)}
    b.hands = {'R': (0.2, 1.2, -11.0), 'L': (0.2, 1.0, -11.0)}
    b.cloth = (0.8, 0)
    b.hair = b.cloth
    return [a, b]


def anim_sneak():
    """Crouched, leaning in, careful steps with the arms held out from the body."""
    R = [5, 1, -3, -6, -2, 2]
    L = [-6, -2, 2, 5, 1, -3]
    lift = [(0, 0), (0, 1), (0, 2), (0, 0), (1, 0), (2, 0)]
    toe = [(0, 1), (0, 0), (0, 0), (1, 0), (0, 0), (0, 0)]
    pel = [-4, -4, -3, -4, -4, -3]
    arms = [((1.4, 3.5 - 0.5 * (i % 3), -8.0), (1.4, 3.0 + 0.5 * (i % 3), -8.0)) for i in range(6)]
    cloth = [(-0.6, 0)] * 6

    def extra(i, p):
        p.elbow = {'R': (0.8, -1.0, 0.0), 'L': (0.8, -1.0, 0.0)}
        p.head = (0, 0.6, -0.5)
    return gait(list(zip(R, L)), pel, arms, toe, lift, cloth, lean=(0, 2.8), extra=extra)


def anim_carry():
    """Heavier steps under a load: the hands up at the shoulders holding it."""
    R = [5, 1, -2, -6, -3, 1]
    L = [-6, -3, 1, 5, 1, -2]
    lift = [(0, 0), (0, 1), (0, 2), (0, 0), (1, 0), (2, 0)]
    toe = [(-1, 1), (0, 1), (0, 0), (1, -1), (1, 0), (0, 0)]
    pel = [-1, -2, -1, -1, -2, -1]
    hold = (-0.6, 1.2, 1.0)
    arms = [(hold, hold)] * 6
    cloth = [(-0.6, 0)] * 6

    def extra(i, p):
        p.elbow = {'R': (0.9, 0.1, -1.0), 'L': (0.9, 0.1, -1.0)}
        p.grip = {'R': 'fist', 'L': 'fist'}
    return gait(list(zip(R, L)), pel, arms, toe, lift, cloth, lean=(0, 0.4), extra=extra)


def anim_draw():
    """Raise, draw to the cheek, hold at full draw, loose with a follow-through (Book 7 section 01:
    draw and loose 4). The bow is in the left hand; the right hand draws."""
    out = []
    spec = [
        # bow hand (o, f, u), draw hand, draw stage
        ((-2.0, 7.5, -4.5), (-6.0, 6.0, -4.0), 0),
        ((-2.6, 9.5, -0.5), (-7.5, 3.0, 2.2), 1),
        ((-2.8, 10.0, 0.0), (-7.2, 0.6, 3.0), 2),
        ((-2.6, 10.6, -0.8), (-4.5, -2.2, 3.4), 3),
    ]
    for bowh, drawh, st in spec:
        p = Pose(bow=st, lean=(0, -0.3), pel=(0, 0, 0))
        p.hands = {'L': bowh, 'R': drawh}
        p.elbow = {'L': (1.0, 0.0, -0.4), 'R': (1.0, -0.4, 0.5)}
        p.grip = {'L': 'fist', 'R': 'fist'}
        p.feet = {'R': (-1.5, 0), 'L': (2.5, 0)}
        p.feet_r = {'R': 0.5, 'L': -0.5}
        out.append(p)
    return out


def states_for(heavy=False, bow=True):
    """The steerer's state list, shared by the heavy build (the same counts and timing)."""
    h = heavy
    out = [
        # state, poses, ticks, loop
        ('idle', anim_idle, 15, True),
        ('shift', anim_shift, 20, True),
        ('glance', anim_glance, 24, True),
        ('idlewind', anim_idlewind, 9, True),
        ('walk', lambda: anim_walk(h), 5, True),
        ('run', lambda: anim_run(h), 3, True),
        ('runstart', lambda: anim_runstart(h), 4, False),
        ('runstop', lambda: anim_runstop(h), 6, False),
        ('sneak', anim_sneak, 6, True),
        ('carry', anim_carry, 5, True),
    ]
    if bow:
        out.append(('draw', anim_draw, 8, False))
    return out


STEERER_STATES = states_for(False)
HEAVY_STATES = states_for(True)
STEERER_EVENTS = 'walk 0, walk 3, run 0, run 4, sneak 0, sneak 3, carry 0, carry 3'


def bow_drawn(parts, facing, j, pose):
    """The bow in the left hand: raise, draw to the cheek, hold, loose (stage 0 to 3)."""
    stage = pose.bow
    g = j['L']['wrist']
    g = (g[0] + 0.3, g[1] + 0.8, g[2] + 0.5)          # the grip sits in the fist
    axis = (0.12, 0.0, 0.993)
    bend = {0: 1.6, 1: 2.8, 2: 3.8, 3: 1.4}[stage]
    back = (0.0, -1.0, 0.0)                            # the belly faces the archer
    half = 17.5
    pts = []
    for i in range(-14, 15):
        sgn = i / 14
        pts.append(tuple(g[k] + axis[k] * half * sgn + back[k] * bend * sgn * sgn for k in range(3)))
    st = Part('bow', 0, 'stave', side=0)
    proj = [P2(facing, p) for p in pts]
    for a, b in zip(proj, proj[1:]):
        tmp = Part('bow', 0)
        tmp.line(a[:2], b[:2], 'wood')
        for (x, y) in tmp.px:
            st.put(x, y, 'wood', (a[2] + b[2]) / 2)
    # The grip is thicker.
    mid = proj[12:17]
    for a in mid:
        st.put(a[0] + (1 if facing != 'w' else -1), a[1], 'wood', a[2])
    parts.append(st)
    tip_t, tip_b = pts[-1], pts[0]
    nock = j['R']['wrist'] if stage in (0, 1, 2) else None
    s = Part('bow', 0, 'string', rim=False)

    def zline(part, a3, b3, mat, bias=0.0):
        a, b = P2(facing, a3), P2(facing, b3)
        tmp = Part('bow', 0)
        tmp.line(a[:2], b[:2], mat)
        L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 or 1e-6
        for (x, y), (m, _) in tmp.px.items():
            t = clamp(((x + .5 - a[0]) * (b[0] - a[0]) + (y + .5 - a[1]) * (b[1] - a[1])) / L2, 0, 1)
            part.put(x, y, m, lerp(a[2], b[2], t) + bias)
    if nock is not None:
        nk = (nock[0] - 0.3, nock[1] + 0.6, nock[2] + 0.6)
        zline(s, tip_t, nk, 'string')
        zline(s, nk, tip_b, 'string')
        # The arrow, from the nock past the grip.
        d = [g[k] - nk[k] for k in range(3)]
        dl = math.sqrt(sum(c * c for c in d)) or 1
        d = [c / dl for c in d]
        pt = tuple(g[k] + d[k] * 4.5 for k in range(3))
        ar = Part('bow', 0, 'arrow', rim=False)
        zline(ar, nk, pt, 'arrow', 0.2)
        hp = P2(facing, pt)
        ar.put(hp[0], hp[1], 'head', hp[2] + 0.3)
        fl = tuple(nk[k] + d[k] * 2.0 for k in range(3))
        fp = P2(facing, fl)
        ar.put(fp[0], fp[1], 'fletch', fp[2] + 0.3)
        parts.append(ar)
    else:
        zline(s, tip_t, tip_b, 'string')
    parts.append(s)


class Hild:
    """Hild Thorkelsdottir (C_HILD, Book 5 section 02): a woad dress over brown trousers and wrapped
    legs; her signature is the woad blue of her dress (Book 5; addendum 2.3 section 9, which drops the
    weld-green shawl) and her long blond braid; her left shin is bound where the wreck hurt it."""

    sleeve, trouser = 'dress', 'trouser'
    skirt_from = 9
    forearm_w = 2

    def __init__(self):
        self.model = MODEL_HILD
        self.mats = HILD_MATS
        self.order = HILD_ORDER
        self.soft = HILD_SOFT

    def torso_mat(self, k):
        if k == 8:
            return 'belt'
        if k == UPPER_ROWS + len(self.model.lower) - 1 or k == 0:
            return 'trim'
        return 'dress'

    def leg_hook(self, part, side, J, facing):
        if side != 'L':
            return
        ys = sorted({y for (x, y), (m, z) in part.px.items() if m.startswith('wrap')})
        if len(ys) < 5:
            return
        band = ys[1:4]
        for (x, y), (m, z) in list(part.px.items()):
            if y in band and (m.startswith('wrap')):
                part.put(x, y, 'bind' + ('_far' if m.endswith('_far') else ''))
        cols = sorted(x for (x, y), (m, z) in part.px.items() if y == band[1] and m.startswith('bind'))
        if cols:
            part.put(cols[len(cols) // 2], band[1], 'blood')

    def hair_extra(self, parts, facing, j, pose, prev, chin, ncx, head):
        """The braid: from behind the left ear over the left shoulder and down her front. It lags a
        frame (Book 7 section 07) and swings out in a gust."""
        lag = (prev.pel[2] + prev.breath) - (pose.pel[2] + pose.breath)
        swing_f = (prev.pel[1] - pose.pel[1]) + pose.hair[0]
        C = j['C']
        pts = [(-3.0, -0.5, 2.5), (-3.6, 1.5, 0.0), (-3.6, 3.2, -2.5)]
        n = 11
        for i in range(n):
            pts.append((-3.4 + 0.1 * i, 3.6 + 0.12 * i, -3.5 - i * 1.0))
        z = {'s': 2.5, 'n': -2.0, 'e': 7.5, 'w': 7.5}[facing]
        br = Part('body', z, 'braid', side=0)
        cells = []
        for idx, (r, f, u) in enumerate(pts):
            t = max(0, idx - 2) / (len(pts) - 3)
            wf = swing_f * 1.5 * t
            pt = (C[0] + r, C[1] + f + wf, C[2] + u + lag * t)
            x, y, d = P2(facing, pt)
            # The gust pushes the hanging braid east on the screen.
            x += pose.wind * (0.5 + 3.5 * t ** 1.3) + ripple(idx, pose.flap, 0.6 * pose.wind * t)
            cells.append((x, y, idx))
        for (x0, y0, i0), (x1, y1, i1) in zip(cells, cells[1:]):
            br.seg((x0, y0), (x1, y1), 2, 'hair')
        # Plaited texture and a tie at the end.
        for (x, y), (m, zz) in list(br.px.items()):
            if (x + y) % 2 == 0 and (x - 1, y) in br.px:
                br.put(x, y, 'plait')
        lx, ly, _ = cells[-1]
        br.put(lx, ly + 1, 'tie')
        br.put(lx - 1, ly + 1, 'tie')
        br.put(lx, ly + 2, 'hair')
        if facing == 'n':
            # From behind only the braid's start over the shoulder shows; the rest hangs in front.
            for (x, y) in list(br.px):
                if y > chin + 3:
                    br.erase(x, y)
        parts.append(br)

    def extras(self, parts, facing, j, pose, prev, rows, lag_u, lag_f):
        pass


HILD_MATS = {
    'skin': ('skin_light', 2, 3, 4), 'hair': ('hair_blond', 2, 3, 5), 'plait': ('hair_blond', 2),
    'tie': ('wool', 4, 5, 6),
    'eye': ('ink', 0), 'mouth': ('skin_light', 2), 'nose': ('skin_light', 2), 'brow': ('hair_blond', 1, 2, 3),
    'linen': ('wool', 4, 5, 6),
    'dress': ('woad', 2, 3, 4), 'fold': ('woad', 2), 'trim': ('wool', 3, 4, 5),
    'belt': ('tar', 0, 1, 2), 'buckle': ('stone', 6, 7, 8),
    'trouser': ('earth', 2, 3, 4), 'wrap': ('wool', 2, 3, 4), 'wrapd': ('wool', 1),
    'shoe': ('tar', 1, 2, 3),
    'bind': ('wool', 4, 5, 6), 'blood': ('code', '7'),
}
HILD_ORDER = {f: ['body', 'clothing'] for f in FACINGS}
HILD_SOFT = {('clothing', 'body')}


def anim_call():
    """In the surf: calling and waving one arm high, then cupping her mouth, the weight shifting
    against the water (Book 7 section 07; the waterline hides her legs, so the arms carry it)."""
    spec = [
        # right hand (o, f, u), left hand, mouth, pelvis r, lean r
        ((2.5, 5.0, 11.0), (2.2, 0.8, -9.0), 1, -1, 0.5),
        ((-0.5, 7.5, 9.5), (2.2, 0.8, -9.0), 1, -1, 0.5),
        ((2.5, 5.0, 11.0), (2.2, 0.8, -9.0), 0, 0, 0.0),
        ((-4.4, 3.4, 4.0), (-4.4, 3.4, 4.0), 1, 1, -0.5),
        ((-4.4, 3.6, 4.2), (-4.4, 3.6, 4.2), 1, 1, -0.5),
        ((-2.0, 2.5, -4.5), (1.8, 0.5, -9.5), 0, 0, 0.0),
    ]
    out = []
    for i, (rh, lh, mo, pr, lr) in enumerate(spec):
        p = Pose(pel=(pr * 0.8, 0, 0), lean=(lr, 0.5), mouth=mo)
        p.hands = {'R': rh, 'L': lh}
        p.elbow = {'R': (1.0, -0.3, 0.2), 'L': (1.0, -0.5, 0.0)}
        p.grip = {'R': 'open', 'L': 'open'}
        p.feet_r = {'R': 0.5, 'L': -0.5}
        out.append(p)
    return out


# ------------------------------------------------------------- Hild lying, carried and seated
class Doll:
    """Hand-placed poses that are not a standing figure, drawn piece by piece on the three layers:
    clothing pieces also lay the body's underclothes beneath them, so the body sheet stays whole."""

    UNDER = {'dress': 'linen', 'trim': 'linen', 'belt': 'linen', 'trouser': 'linen',
             'wrap': 'skin', 'bind': 'skin', 'shoe': 'skin', 'blood': 'skin'}

    def __init__(self):
        self.parts = []

    def part(self, layer, name, **kw):
        z = {'body': 0.0, 'clothing': 1.0, 'cloak': 2.0}[layer]
        p = Part(layer, z, name, **kw)
        self.parts.append(p)
        return p

    def cloth(self, name, draw, z=0.0):
        """draw(part, mat_fn) once for the clothing and once for the body underneath."""
        c = self.part('clothing', name)
        b = self.part('body', name)
        c.z += z
        b.z += z
        draw(c, lambda m: m)
        draw(b, lambda m: self.UNDER.get(m.replace('_far', ''), m) + ('_far' if m.endswith('_far') else ''))
        return c, b


def W_(x):
    return x + OX


def H_(y):
    return y + OY


def mirror_parts(parts):
    for p in parts:
        p.px = {(2 * (16 + OX) - 1 - x, y): v for (x, y), v in p.px.items()}
    return parts


def plait(part):
    for (x, y), (m, z) in list(part.px.items()):
        if m == 'hair' and (x + y) % 2 == 0 and (x - 1, y) in part.px:
            part.put(x, y, 'plait')


def hild_down(i):
    """Lying on her side, propped on her far elbow, calling with the near arm raised (Book 7:
    downed 2). Drawn facing east, the head at the east end; the waving hand moves."""
    d = Doll()
    X, Y = W_, H_
    wave = (0, 1)[i]
    # Legs along the ground to the west, knees a little bent; the far leg behind, a step darker.
    for far, dy, dx in ((True, -1, 1), (False, 0, 0)):
        fs = '_far' if far else ''

        def leg(p, m, dx=dx, dy=dy, fs=fs, far=far):
            p.seg((X(15 + dx), Y(43 + dy)), (X(8.5 + dx), Y(42.5 + dy)), 4, m('trouser' + fs))
            p.seg((X(8.5 + dx), Y(43 + dy)), (X(4 + dx), Y(44.5 + dy)), 3, m('wrap' + fs))
            p.fill(X(1 + dx), Y(44 + dy), X(3 + dx), Y(45 + dy), m('shoe' + fs))
            p.put(X(2 + dx), Y(43 + dy), m('shoe' + fs))
            if not far:
                for (bx, by) in ((6, 43), (6, 44), (7, 43), (7, 44), (6, 45)):
                    p.put(X(bx), Y(by), m('bind'))
                p.put(X(6), Y(44), m('blood'))
        d.cloth('leg' + fs, leg, z=-0.5 if far else 0.0)
    # The far forearm on the ground, propping her up.
    d.cloth('proparm', lambda p, m: (p.seg((X(24), Y(39)), (X(25), Y(44)), 2, m('dress_far')),
                                     p.seg((X(25), Y(44.5)), (X(28.5), Y(45.5)), 2, m('dress_far'))), z=-0.8)
    hp = d.part('body', 'prophand')
    hp.fill(X(29), Y(45), X(30), Y(46), 'skin_far')
    hp.put(X(28), Y(46), 'skin_far')

    def torso(p, m):
        # From the shoulders down to the hip, and the skirt of the dress over the thighs.
        p.seg((X(22.5), Y(39.5)), (X(15), Y(43.5)), 7, m('dress'))
        p.seg((X(16), Y(44)), (X(10.5), Y(44)), 4, m('dress'))
        for y in range(40, 47):
            if p.has(X(10), Y(y)):
                p.put(X(10), Y(y), m('trim'))
        p.seg((X(17.5), Y(40)), (X(16.5), Y(46)), 1, m('belt'))
    d.cloth('torso', torso)
    hd = d.part('body', 'head', bottom=False)
    hd.stamp(HEAD_HILD['e'], X(21), Y(30), HEAD_LETTERS)
    hd.fill(X(23), Y(38), X(25), Y(38), 'skin')
    br = d.part('body', 'braid', side=0)
    br.z = 3.0
    br.seg((X(22.5), Y(36)), (X(20.5), Y(41)), 2, 'hair')
    br.seg((X(20.5), Y(41)), (X(20), Y(44)), 2, 'hair')
    plait(br)
    br.put(X(20), Y(45), 'tie')
    br.put(X(21), Y(45), 'tie')
    # The near arm raised beside her head, the hand waving.

    def raised(p, m):
        p.seg((X(20.5), Y(38.5)), (X(20), Y(33)), 2, m('dress'))
        p.seg((X(20), Y(33)), (X(20.5 + wave), Y(28.5)), 2, m('dress'))
    d.cloth('arm', raised, z=4.0)
    hn = d.part('body', 'hand')
    hn.z = 4.5
    hx = 20 + wave
    hn.fill(X(hx), Y(25), X(hx + 1), Y(27), 'skin')
    hn.put(X(hx + (2 if wave else -1)), Y(26), 'skin')
    return d.parts


def hild_sit(facing, i):
    """Set down safe on the shingle, legs out, breathing (pose seated)."""
    d = Doll()
    X, Y = W_, H_
    br = (0, -1, -1, 0)[i]      # the breath: head and shoulders settle a pixel
    if facing in 'e w':
        # Legs out east, knees a little up; hands on her knees.
        for far, off in ((True, -1), (False, 0)):
            fs = '_far' if far else ''

            def leg(p, m, fs=fs, off=off):
                p.seg((X(16), Y(43 + off)), (X(22.5), Y(41 + off)), 4, m('trouser' + fs))
                p.seg((X(23), Y(41.5 + off)), (X(27), Y(44.5 + off)), 3, m('wrap' + fs))
                p.fill(X(27), Y(44 + off), X(29), Y(45 + off), m('shoe' + fs))
                p.put(X(30), Y(45 + off), m('shoe' + fs))
                if not far:
                    p.put(X(25), Y(43), m('bind'))
                    p.put(X(26), Y(43), m('bind'))
                    p.put(X(25), Y(42), m('bind'))
                    p.put(X(25), Y(43), m('blood'))
            d.cloth('leg' + fs, leg, z=-0.5 if far else 0.0)

        def body(p, m):
            # The dress from the shoulders to the ground, spread at the hips.
            for y in range(31 + br, 47):
                t = (y - 31) / 15
                x0 = 11 + (1 if y < 34 else 0) - (1 if y > 42 else 0) - (1 if y > 44 else 0)
                x1 = 17 + (1 if y > 40 else 0) + (2 if y > 42 else 0)
                for x in range(x0, x1 + 1):
                    p.put(X(x), Y(y), m('trim' if y == 46 else 'dress'))
            p.row(Y(38), X(11), X(17), m('belt'))
        d.cloth('torso', body)
        hd = d.part('body', 'head', bottom=False)
        hd.stamp(HEAD_HILD['e'], X(11), Y(22 + br), HEAD_LETTERS)
        hd.fill(X(13), Y(30 + br), X(15), Y(30 + br), 'skin')

        def arm(p, m):
            p.seg((X(15), Y(32 + br)), (X(17), Y(37)), 2, m('dress'))
            p.seg((X(17), Y(37)), (X(20.5), Y(39)), 2, m('dress'))
        d.cloth('arm', arm, z=2.0)
        hn = d.part('body', 'hand')
        hn.z = 3.5
        hn.fill(X(21), Y(39), X(22), Y(40), 'skin')
        b = d.part('body', 'braid', side=0)
        b.z = 3.0
        b.seg((X(18), Y(29 + br)), (X(18.5), Y(37 + br)), 2, 'hair')
        plait(b)
        b.put(X(18), Y(38 + br), 'tie')
        parts = d.parts
        return mirror_parts(parts) if facing == 'w' else parts
    # Front and back: seated square to the view, legs towards the camera.
    front = facing == 's'

    def body(p, m):
        for y in range(31 + br, 41):
            x0, x1 = (12, 19) if y < 38 else (11, 20)
            p.row(Y(y), X(x0), X(x1), m('dress'))
        p.row(Y(37), X(12), X(19), m('belt'))
        # The dress spread on the ground round her.
        for y in range(41, 44):
            p.row(Y(y), X(10), X(21), m('trim' if y == 43 else 'dress'))
    d.cloth('torso', body)
    if front:
        def legs(p, m):
            for xa, mat in ((12, 'wrap'), (17, 'wrap')):
                p.fill(X(xa), Y(41), X(xa + 2), Y(44), m(mat))
                p.fill(X(xa - 0), Y(45), X(xa + 3), Y(46), m('shoe'))
            p.put(X(18), Y(42), m('bind'))
            p.put(X(19), Y(42), m('bind'))
            p.put(X(18), Y(43), m('blood'))
        d.cloth('legs', legs, z=0.5)
    else:
        def feet(p, m):
            p.fill(X(10), Y(44), X(12), Y(46), m('shoe'))
            p.fill(X(19), Y(44), X(21), Y(46), m('shoe'))
        d.cloth('feet', feet, z=-0.5)
    hd = d.part('body', 'head', bottom=False)
    hd.stamp(HEAD_HILD[facing], X(12), Y(22 + br), HEAD_LETTERS)
    hd.fill(X(14), Y(30 + br), X(17), Y(30 + br), 'skin')
    if front:
        def arms(p, m):
            p.seg((X(11), Y(33 + br)), (X(11), Y(38)), 2, m('dress'))
            p.seg((X(20), Y(33 + br)), (X(19), Y(38)), 2, m('dress'))
        d.cloth('arms', arms, z=1.5)
        hn = d.part('body', 'hands')
        hn.z = 3.5
        hn.fill(X(11), Y(39), X(12), Y(40), 'skin')
        hn.fill(X(18), Y(39), X(19), Y(40), 'skin')
        b = d.part('body', 'braid', side=0)
        b.z = 3.0
        b.seg((X(19), Y(29 + br)), (X(19.5), Y(36 + br)), 2, 'hair')
        plait(b)
        b.put(X(19), Y(37 + br), 'tie')
    return d.parts


# The steerer's carry bob (anim_carry pelvis), so Hild rides in step on the shoulders.
CARRY_BOB = [-1, -2, -1, -1, -2, -1]


def hild_carried(facing, i):
    """Across the steerer's shoulders (decision S6-15): drawn over the steerer at the same anchor,
    with the steerer's face kept clear; her hanging head, arm, braid and legs lag a frame."""
    d = Doll()
    X = W_
    dy = -CARRY_BOB[i]
    lag = -CARRY_BOB[i - 1]
    Y = lambda y: H_(y + dy)
    Yl = lambda y: H_(y + lag)
    if facing in 's n':
        # Body across the shoulders behind the steerer's head; her head hangs to the left.
        def body(p, m):
            p.seg((X(5), Y(16.5)), (X(21), Y(16.5)), 5, m('dress'))
            p.row(Y(14), X(9), X(19), m('dress'))
            p.seg((X(15), Y(15)), (X(15), Y(19)), 1, m('belt'))
            p.seg((X(21), Y(16)), (X(26), Y(17.5)), 4, m('trouser'))
            p.seg((X(26), Y(18)), (X(27), Y(24 + lag - dy)), 3, m('wrap'))
            p.put(X(26), Y(21), m('bind'))
            p.put(X(27), Y(21), m('blood'))
            p.fill(X(26), Yl(25), X(28), Yl(26), m('shoe'))
            p.seg((X(22), Y(17)), (X(23), Y(23 + lag - dy)), 3, m('wrap_far'))
            p.fill(X(22), Yl(24), X(24), Yl(25), m('shoe_far'))
            # The near arm hangs down on the head side.
            p.seg((X(7), Y(18)), (X(7.5), Y(24 + lag - dy)), 2, m('dress'))
        d.cloth('body', body)
        hn = d.part('body', 'hand')
        hn.fill(X(7), Yl(25), X(8), Yl(27), 'skin')
        hd = d.part('body', 'head', bottom=False)
        # Her head hangs face down at the left: the crown downwards, seen from the side.
        flipped = [r for r in reversed(HEAD_HILD['e'])]
        hd.stamp(flipped, X(1), Yl(16), HEAD_LETTERS)
        br = d.part('body', 'braid', side=0)
        br.seg((X(3), Yl(24)), (X(3.5), Yl(31)), 2, 'hair')
        plait(br)
        br.put(X(3), Yl(32), 'tie')
    else:
        # Seen from the side: her body end-on behind the head, her legs hanging in front.
        def body(p, m):
            for y in range(12, 20):
                x0 = 8 if y > 13 else 9
                p.row(Y(y), X(x0), X(14), m('dress'))
            p.row(Y(18), X(8), X(14), m('belt'))
            p.seg((X(14), Y(16)), (X(19), Y(17)), 4, m('trouser'))
            p.seg((X(19), Y(18)), (X(19.5), Y(25 + lag - dy)), 3, m('wrap'))
            p.put(X(19), Y(21), m('bind'))
            p.put(X(20), Y(21), m('blood'))
            p.fill(X(19), Yl(26), X(21), Yl(27), m('shoe'))
            p.seg((X(9), Y(19)), (X(8.5), Y(26 + lag - dy)), 2, m('dress_far'))
        d.cloth('body', body)
        hn = d.part('body', 'hand')
        hn.fill(X(8), Yl(27), X(9), Yl(28), 'skin_far')
        br = d.part('body', 'braid', side=0)
        br.seg((X(10), Y(19)), (X(10.5), Yl(27)), 2, 'hair')
        plait(br)
    # The steerer's face stays clear.
    for p in d.parts:
        for (x, y) in list(p.px):
            if X(11) <= x <= X(20) and y <= Y(17) - (0 if facing in 's n' else 1) and y >= H_(6):
                if facing in 's n' or X(14) <= x:
                    p.erase(x, y)
    parts = d.parts
    if facing in 'n w':
        parts = mirror_parts(parts)
    return parts


# ------------------------------------------------------------------------------------- output
HEAD_HEAVY = {
    's': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HhFFFFhH',
          'FFeFFeFF',
          'FFFFFFFF',
          'FFFFFFFF',
          '.FFFFFF.'],
    'n': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HHHHHHHH',
          'FHHHHHHF',
          'FHHHHHHF',
          '.hhhhhh.',
          '.FFFFFF.'],
    'e': ['..HHHH...',
          '.HHHHHH..',
          'HHHHHHHH.',
          'HHHHHFFF.',
          'HHFHFFeF.',
          'HHFHFFFFF',
          '.HFFFFFF.',
          '.hFFFFFF.'],
}
# Arms 4 px thick on shoulders 8 px out: 20 px across plus the outline (about 4 more than model A).
MODEL_HEAVY = Model('heavy', 8.0, limb=4, forearm=4, big=True, neck=6, heavy=True, hipw=3.0,
                    upper=[5, 6, 6, 6, 6, 6],
                    lower=[6, 6, 6, 6, 6.5, 6.5, 6.5, 6.5, 6.5, 7, 7, 7],
                    upper_e=[(-4, 3), (-5, 4), (-5, 5), (-5, 5), (-5, 5), (-5, 5)],
                    lower_e=[(-4, 5), (-4, 5), (-4, 5), (-5, 4), (-5, 4), (-5, 4), (-5, 5), (-5, 5),
                             (-5, 5), (-6, 5), (-6, 5), (-6, 6)],
                    heads=HEAD_HEAVY)
HEAVY_MATS = dict(STEERER_MATS)
HEAVY_MATS.update({
    'hair': ('hair_brown', 0, 1, 3),
    'tunic': ('stone_warm', 2, 3, 4), 'fold': ('stone_warm', 2),
    'trouser': ('earth', 1, 2, 3),
    # A plain dark wool cloak: its hem is the same wool, a shade deeper; no madder (the steerer's).
    'cloak': ('earth', 1, 2, 3), 'cloakin': ('earth', 0, 1, 2), 'cloakf': ('earth', 1),
    'lining': ('earth', 0, 1, 1),
    'brooch': ('stone', 4, 5, 7), 'bglint': ('stone', 8),
})


class Heavy(Steerer):
    """The heavy build: a working person's dress, a plain dark cloak, no sash."""

    sash = False

    def __init__(self):
        super().__init__(MODEL_HEAVY)

    def torso_mat(self, k):
        return 'belt' if k == 8 else 'tunic'


HILD_STATES = [
    ('idle', anim_idle, 15, True),
    ('shift', anim_shift, 20, True),
    ('glance', anim_glance, 24, True),
    ('idlewind', anim_idlewind, 9, True),
    ('walk', anim_walk, 5, True),
    ('run', anim_run, 3, True),
    ('runstart', anim_runstart, 4, False),
    ('runstop', anim_runstop, 6, False),
    ('call', anim_call, 10, True),
    ('down', None, 24, True),
    ('carried', None, 5, True),
    ('sit', None, 18, True),
]
HILD_EVENTS = 'walk 0, walk 3, run 0, run 4'
HILD_POSES = {'down': 'lying', 'carried': 'carried', 'sit': 'seated'}

INTRO = {
    'a': """# The steerer, body model {L} (Book 5 section 02, Book 7 section 07), on the 32 x 48 canvas
# (decision DA-1): proposed, staged for the user's approval; nothing here is read by the game.
# The two body models are offered side by side without labels. Generated by
# assets/art/authoring/people48.py; edit that script, not this map.""",
    'heavy': """# The heavy build (addendum 2.3 section 11): broad shoulders, a thick torso and limbs, big hands,
# for residents and enemies, never the steerer; an ordinary working person, neither labelled nor
# gendered. The same 32 x 48 cell (about 4 px wider), frame counts, facings and timing as the
# steerer, moving heavier. Proposed, staged for the user's approval; nothing here is read by the
# game. Generated by assets/art/authoring/people48.py; edit that script, not this map.""",
    'hild': """# Hild Thorkelsdottir (C_HILD, Book 5 section 02) on the 32 x 48 canvas (decision DA-1): proposed,
# staged for the user's approval; nothing here is read by the game. Generated by
# assets/art/authoring/people48.py; edit that script, not this map.""",
}
LAYER_NOTE = {
    'body': 'The body: skin, face and hair (loose hair lags a frame), in linen underclothes.',
    'clothing': 'Clothing layer: shares the body sheet\'s states, frames, facings and anchor.',
    'cloak': 'Cloak layer: lags a frame behind the body and settles after it; streams in a gust.',
    'helmet': 'Helmet layer: a plain rounded iron cap (iron helmets are rare; the steerer starts with none).',
    'bow': 'Weapon layer: a 36 px self bow on a larger canvas round the same foot anchor; on the back, or\n# drawn in the left hand (never mirrored: west is drawn).',
}


def render_character(ch, states, mats, order, names, sizes, soft):
    sheets = {}
    for L, name in names.items():
        size, pivot = sizes.get(L, ((W, H), PIVOT))
        sheets[L] = Sheet(name, L, mats, size=size, pivot=pivot)
    for state, fn, ticks, loop in states:
        if fn is not None:
            poses = fn()
            for f in FACINGS:
                for i, pose in enumerate(poses):
                    parts = fig(ch, f, pose, poses[i - 1])
                    sep = separate(parts, order[f], soft)
                    for L in names:
                        sheets[L].add(state, f, i, sep.get(L, {}))
        else:
            n = {'down': 2, 'carried': 6, 'sit': 4}[state]
            for f in FACINGS:
                for i in range(n):
                    if state == 'down':
                        parts = hild_down(i)
                        if f in 'n w':
                            parts = mirror_parts(parts)
                    elif state == 'carried':
                        parts = hild_carried(f, i)
                    else:
                        parts = hild_sit(f, i)
                    sep = separate(parts, order[f], soft)
                    for L in names:
                        sheets[L].add(state, f, i, sep.get(L, {}))
    return sheets


def write_character(key):
    if key == 'heavy':
        ch = Heavy()
        ch.helmet = True
        names = {'body': 'actor_heavy', 'clothing': 'layer_clothing_tunic_heavy',
                 'cloak': 'layer_cloak_wool_heavy', 'helmet': 'layer_helmet_iron_heavy',
                 'bow': 'layer_weapon_bow_heavy'}
        states, mats, order, events, poses = HEAVY_STATES, HEAVY_MATS, STEERER_ORDER, STEERER_EVENTS, {}
        intro = INTRO['heavy']
    elif key in ('a', 'b'):
        ch = Steerer(MODEL_A if key == 'a' else MODEL_B)
        ch.helmet = True
        names = {'body': f'actor_p_steerer_{key}', 'clothing': f'layer_clothing_tunic_{key}',
                 'cloak': f'layer_cloak_wool_{key}', 'helmet': f'layer_helmet_iron_{key}',
                 'bow': f'layer_weapon_bow_{key}'}
        states, mats, order, events, poses = STEERER_STATES, STEERER_MATS, STEERER_ORDER, STEERER_EVENTS, {}
        intro = INTRO['a'].format(L=key.upper())
    else:
        ch = Hild()
        names = {'body': 'actor_c_hild', 'clothing': 'layer_clothing_dress_hild'}
        states, mats, order, events, poses = HILD_STATES, HILD_MATS, HILD_ORDER, HILD_EVENTS, HILD_POSES
        intro = INTRO['hild']
    sizes = {'bow': ((48, 56), (24, 51))}
    sheets = render_character(ch, states, mats, order, names, sizes, getattr(ch, 'soft', SOFT))
    anims = {}
    for state, fn, ticks, loop in states:
        n = len(fn()) if fn else {'down': 2, 'carried': 6, 'sit': 4}[state]
        anims[state] = (n, ticks, loop)
    os.makedirs(OUT, exist_ok=True)
    for L, sh in sheets.items():
        sh.intro = intro + f'\n# {LAYER_NOTE[L]}'
        if L == 'body':
            sh.shadow = '18x5' if key == 'heavy' else '16x5'
        with open(f'{OUT}/{sh.name}.map.txt', 'w') as fh:
            fh.write(sh.text(anims, events, poses))
    return sheets, names


def layers_json(name, layers):
    path = f'{REPO}/assets/art/proposed/{name}.layers.json'
    with open(path, 'w') as fh:
        fh.write(json.dumps({'name': name, 'layers': layers}, indent=2) + '\n')


def main():
    for key in ('a', 'b'):
        _, n = write_character(key)
        base = {f: [n[L] for L in STEERER_ORDER[f] if L != 'helmet'] for f in FACINGS}
        layers_json(f'steerer_{key}', base)
        if key == 'a':
            layers_json('steerer_a_helmeted', {f: [n[L] for L in STEERER_ORDER[f]] for f in FACINGS})
        else:
            layers_json('steerer_b_helmeted', {f: [n[L] for L in STEERER_ORDER[f]] for f in FACINGS})
    _, n = write_character('heavy')
    layers_json('heavy', {f: [n[L] for L in STEERER_ORDER[f] if L != 'helmet'] for f in FACINGS})
    layers_json('heavy_helmeted', {f: [n[L] for L in STEERER_ORDER[f]] for f in FACINGS})
    _, n = write_character('hild')
    layers_json('hild', {f: [n[L] for L in HILD_ORDER[f]] for f in FACINGS})
    print('wrote the proposed people maps')


if __name__ == '__main__':
    main()

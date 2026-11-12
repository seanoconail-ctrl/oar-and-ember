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


def set_canvas(big):
    """Stage 9: a spear needs a larger working canvas round the same anchor. The existing people
    keep the small one, so their approved frames are written exactly as before."""
    global CW, CH, OX, OY
    CW, CH, OX, OY = (78, 86, 23, 19) if big else (48, 56, 8, 4)


# Materials that throw a shadow on the pixel below them inside the same part.
CASTERS = {'hair', 'sash', 'belt', 'tunic', 'cloak', 'shawl', 'iron', 'dress', 'brow'}
# Materials that are fixed marks: no shading.
MARKS = {'eye', 'mouth', 'glint', 'bglint', 'blood', 'blood_dry', 'blood_fresh', 'edge', 'nose', 'lash', 'fold', 'wrapd', 'cloakf', 'head', 'fletch', 'plait'}


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
                    img[(x, y)] = (mat, INNER_DARK if img[n][2] > z + 0.5 else 0, z)
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


CUT = set()


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
            if not (ox <= x < ox + w and oy <= y < oy + h):
                CUT.add((self.name, state, facing, i))
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
        self.tool = None                   # a work loop's tool (Stage 7): stick, line, mallet
        self.tool_stage = 0
        # Stage 9: how weapons are held (None: carried as each weapon is carried at rest), the
        # blade's direction from the hand (r, f, u), the shield's carriage, weapons thrown down.
        self.hold = None
        self.wdir = None
        self.shield = None
        self.dropped = False
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
        # The waist above the belt belongs with the chest unless it is the sash.
        (tc if k < UPPER_ROWS or (k < 8 and mat == ch.sleeve) else tl).row(row, x0, x1, mat)
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
        if getattr(self, 'cloak', True):
            cloak_wool(parts, facing, j, pose, rows, lag_u, m, brooch=getattr(self, 'brooch', True))
        if self.helmet:
            helmet(parts, facing, j, pose)
        bow(parts, facing, j, pose, m)
        work_tool(parts, facing, j, pose)
        # Stage 9: weapons in hand or carried, and a shield (drawn by draw_arms, below).
        draw_arms(parts, facing, j, pose, self)


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
    'drift': ('driftwood', 3, 5, 6),
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


# ------------------------------------------------------------------------- work loops (Stage 7)
# Book 7 section 07: every homestead task has a readable work loop of 4 to 8 frames, the same for the
# steerer and residents, its tool drawn to the people scale of section 01. Shoulders stay 11 px over
# the pelvis, so stooping is a crouch: the pelvis drops and the knees bend.

def work_tool(parts, facing, j, pose):
    """The work loop's tool in the hands, on the body layer at the hand's depth."""
    if pose.tool is None:
        return
    R, L = j['R']['wrist'], j['L']['wrist']
    t = Part('body', 0, 'tool', side=0)

    def fillz(x0, y0, x1, y1, mat, z):
        for yy in range(int(math.floor(y0)), int(math.floor(y1)) + 1):
            for xx in range(int(math.floor(x0)), int(math.floor(x1)) + 1):
                t.put(xx, yy, mat, z)

    def pt(p):
        x, y, d = P2(facing, p)
        return x, y, d
    if pose.tool == 'stick':
        # A length of driftwood (14 px): picked up in the right hand, then carried under the left
        # arm with the others (the bundle).
        if pose.tool_stage in (1, 2):
            a = pt(add(R, (0.0, 1.5, -1.0)))
            b = pt(add(R, (0.0, -9.0, -2.0))) if pose.tool_stage == 1 else pt(add(R, (0.0, 2.0, 9.0)))
            t.seg(a[:2], b[:2], 2, 'drift', a[2] + 0.2)
        for k in range(3 if pose.tool_stage >= 2 else 2):
            a = pt(add(L, (0.5, 5.0 - k * 0.8, 1.0 + k * 1.4)))
            b = pt(add(L, (0.5, -8.0 + k * 0.8, 1.0 + k * 1.4)))
            t.seg(a[:2], b[:2], 2, 'drift', a[2] + 0.3 + k * 0.01)
    elif pose.tool == 'line':
        # A hand line: a coil in the left hand, the line from the right running out to the water.
        c = pt(L)
        fillz(c[0] - 1, c[1] - 1, c[0] + 1, c[1], 'string', c[2] + 0.3)
        r = pt(R)
        if pose.tool_stage == 0:
            # Swung back: the weight hangs from the hand.
            t.line(r[:2], (r[0], r[1] + 4), 'string', r[2] + 0.2)
            t.put(r[0], r[1] + 5, 'iron', r[2] + 0.2)
        else:
            out = pt(add(R, (0.0, 9.0, -6.0 - 2 * (pose.tool_stage % 2))))
            # The line runs on out of the frame to the water (the scene draws its end there); in
            # the sprite it stops inside the canvas so its outline closes.
            ex = clamp(out[0], OX + 2, OX + 29)
            ey = clamp(out[1], OY + 2, OY + 45)
            t.line(r[:2], (ex, ey), 'string', r[2] + 0.2)
    elif pose.tool == 'mallet':
        # A wooden mallet in the right hand; a stake held upright in the left.
        r = pt(R)
        head = pt(add(R, (0.0, 2.5, 6.0) if pose.tool_stage == 0 else (0.0, 6.0, 1.0)))
        head = (clamp(head[0], OX + 2, OX + 29), clamp(head[1], OY + 2, OY + 45), head[2])
        t.seg(r[:2], head[:2], 1, 'wood', r[2] + 0.2)
        fillz(head[0] - 1, head[1] - 1, head[0] + 1, head[1] + 1, 'wood', head[2] + 0.25)
        l = pt(L)
        t.seg((l[0], l[1] - 2), (l[0], 46.5 + OY - 1), 2, 'wood', l[2] + 0.2)
    parts.append(t)


def anim_gather():
    """Gathering driftwood: crouch at the weed line, take a piece up, rise, tuck it under the left
    arm with the others."""
    out = []
    spec = [
        # pelvis drop, lean forward, right hand, tool stage
        (0, 0.5, (0.8, 1.5, -10.5), 0),
        (-4, 2.0, (0.6, 4.5, -11.0), 0),
        (-8, 3.0, (0.4, 6.0, -11.5), 0),
        (-8, 3.0, (0.4, 6.5, -11.0), 1),
        (-4, 1.5, (0.6, 5.0, -6.0), 2),
        (0, 0.5, (-1.5, 3.5, -5.0), 2),
    ]
    for pel, lean, rh, st in spec:
        p = Pose(pel=(0, 0, pel), lean=(0, lean), tool='stick', tool_stage=st)
        p.hands = {'R': rh, 'L': (1.2, 2.0, -6.5)}
        p.elbow = {'R': (0.3, -1.0, 0.0), 'L': (1.0, -1.0, -0.4)}
        p.grip = {'R': 'fist' if st else 'open', 'L': 'fist'}
        p.feet = {'R': (-1.5 if pel else -1.0, 0), 'L': (2.5 if pel else 1.0, 0)}
        out.append(p)
    return out


def anim_fish():
    """Fishing from the shore with a hand line: swing the weighted line back and up, cast it out,
    then haul hand over hand."""
    out = []
    spec = [
        ((0.4, -3.5, -3.0), (1.0, 3.0, -7.0), 0, -0.5),
        ((0.3, -1.5, 3.5), (1.0, 3.0, -7.0), 0, -0.8),
        ((0.3, 7.0, -1.0), (1.0, 3.5, -7.0), 1, 0.8),
        ((0.6, 5.5, -6.5), (1.0, 3.5, -7.5), 2, 0.6),
        ((0.6, 3.5, -7.5), (1.0, 5.5, -6.0), 3, 0.5),
        ((0.6, 5.5, -6.5), (1.0, 3.5, -7.5), 4, 0.6),
    ]
    for rh, lh, st, lean in spec:
        p = Pose(lean=(0, lean), tool='line', tool_stage=st)
        p.hands = {'R': rh, 'L': lh}
        p.elbow = {'R': (0.6, -1.0, 0.3), 'L': (1.0, -1.0, -0.4)}
        p.grip = {'R': 'fist', 'L': 'fist'}
        p.feet = {'R': (-2.0, 0), 'L': (3.0, 0)}
        out.append(p)
    return out


def anim_kneel():
    """Kneeling at work low in front: binding a wound, laying and blowing on a fire, stirring the
    pot (Book 7: cooking and tending wounds). One knee down, the hands working in turn."""
    out = []
    for i in range(6):
        a = math.sin(i * math.pi / 3)
        p = Pose(pel=(0, -1.0, -9), lean=(0, 2.5), breath=(0, -1, -1, 0, 0, -1)[i])
        p.hands = {'R': (0.0, 6.0 + a, -8.0 + 1.2 * a), 'L': (0.0, 6.0 - a, -8.0 - 1.2 * a)}
        p.elbow = {'R': (0.8, -1.0, 0.0), 'L': (0.8, -1.0, 0.0)}
        p.grip = {'R': 'fist' if i % 3 == 1 else 'open', 'L': 'open'}
        p.feet = {'R': (-7.0, 0), 'L': (3.5, 0)}
        p.toe = {'R': 1, 'L': 0}
        out.append(p)
    return out


def anim_build():
    """Raising the sail shelter: a stake held in the left hand, driven with a mallet in the right:
    lift, strike, rebound."""
    out = []
    spec = [
        ((0.8, 1.0, 3.0), 0, -0.4),
        ((0.8, 0.5, 4.5), 0, -0.6),
        ((0.4, 6.5, -8.0), 1, 1.6),
        ((0.5, 6.0, -6.0), 1, 1.2),
        ((0.7, 4.0, -2.0), 0, 0.4),
        ((0.8, 2.0, 1.5), 0, 0.0),
    ]
    for rh, st, lean in spec:
        p = Pose(pel=(0, 0, -3), lean=(0, 1.5 + lean), tool='mallet', tool_stage=st)
        p.hands = {'R': rh, 'L': (0.5, 6.0, -9.5)}
        p.elbow = {'R': (0.8, -1.0, 0.4), 'L': (0.8, -1.0, 0.0)}
        p.grip = {'R': 'fist', 'L': 'fist'}
        p.feet = {'R': (-2.5, 0), 'L': (3.0, 0)}
        out.append(p)
    return out


def sleeper(ch, i):
    """Asleep on the ground (Stage 7): on the side, the head to the east on the rolled edge of the
    cloak (Hild in her dress), the body under the cloak along the ground to the west, breathing."""
    d = Doll()
    X, Y = W_, H_
    lift = (0, 1)[i]
    hild = isinstance(ch, Hild)
    m = ch.model

    def legs(p, mm):
        p.seg((X(15), Y(44.5)), (X(7), Y(44.5)), 4, mm('trouser'))
        p.seg((X(7), Y(45)), (X(3.5), Y(45)), 3, mm('wrap'))
        p.fill(X(1), Y(44), X(2.5), Y(46), mm('shoe'))
    d.cloth('legs', legs, z=-0.5)

    def torso(p, mm):
        p.seg((X(23), Y(42.5)), (X(14), Y(43.5)), 6, mm('dress' if hild else 'tunic'))
    d.cloth('torso', torso)
    hd = d.part('body', 'head', bottom=False)
    hd.stamp(m.heads['e'], X(21), Y(33.5) + lift * 0, HEAD_LETTERS)
    # The near hand tucked under the cheek.
    hn = d.part('body', 'hand')
    hn.z = 1.5
    hn.fill(X(27), Y(41), X(28), Y(42), 'skin')
    if not hild:
        cl = d.part('cloak', 'cloak')
        # The cloak over shoulder to shin, its madder hem along the lower edge; it rises and falls.
        for x in range(3, 26):
            t = (x - 3) / 22
            top = 40.0 - 2.2 * math.sin(math.pi * min(1.0, t * 1.15)) - (lift if 9 < x < 22 else 0)
            for y in range(int(math.floor(top)), 46):
                cl.put(X(x), Y(y), 'cloak')
            cl.put(X(x), Y(46), 'lining')
        for x in range(4, 25, 5):
            cl.put(X(x), Y(42), 'cloakf')
    else:
        # Hild's braid lies over her shoulder.
        br = d.part('body', 'braid', side=0)
        br.z = 3.0
        br.seg((X(21.5), Y(40.5)), (X(17), Y(42)), 2, 'hair')
        plait(br)
        br.put(X(16), Y(42), 'tie')
    return d.parts


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
    out += WORK_STATES
    return out


# The work loops and sleep (Stage 7), shared by every body: the same frame counts and timing.
WORK_STATES = [
    ('gather', anim_gather, 8, True),
    ('fish', anim_fish, 10, True),
    ('kneel', anim_kneel, 9, True),
    ('build', anim_build, 7, True),
    ('sleep', None, 36, True),
]
WORK_POSES = {'gather': 'seated', 'kneel': 'seated', 'sleep': 'lying'}


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
        work_tool(parts, facing, j, pose)


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
    'wood': ('bracken', 1, 2, 4), 'string': ('wool', 4, 5, 6), 'iron': ('stone', 3, 5, 7),
    'drift': ('driftwood', 3, 5, 6),
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


# Stage 10: whose head these hand-drawn poses wear (Hild's, or Runa's sharing her dress), whether a
# braid is drawn, and the cloth a carried person wears (her dress, or a tunic).
CUR = {'head': HEAD_HILD, 'braid': True, 'cloth': 'dress'}


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
    hd.stamp(CUR["head"]['e'], X(21), Y(30), HEAD_LETTERS)
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
        hd.stamp(CUR["head"]['e'], X(11), Y(22 + br), HEAD_LETTERS)
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
    hd.stamp(CUR["head"][facing], X(12), Y(22 + br), HEAD_LETTERS)
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


def hild_eat(facing, i):
    """Eating at the fire (Stage 8): seated as she sits, a wooden bowl in her lap and the spoon
    taken up to her mouth and down again: in the bowl, rising, at the mouth, lowering (pose seated).
    From behind the bowl is hidden; her elbow lifts with each mouthful."""
    base = 'e' if facing == 'w' else facing
    parts = hild_sit(base, i)
    br = (0, -1, -1, 0)[i]
    X, Y = W_, H_
    d = Doll()
    if base == 'n':
        # From behind: the near elbow lifts out past her side as the spoon goes up.
        d.parts = parts
        lift = (0, 1, 2, 1)[i]
        def elbow(p, m):
            p.seg((X(20), Y(33 + br)), (X(21), Y(37 - lift)), 2, m('dress'))
        d.cloth('elbow', elbow, z=1.5)
        return d.parts
    drop = {'arm', 'arms', 'hand', 'hands'}
    d.parts = [p for p in parts if p.name not in drop]
    if base == 'e':
        hand = [(21, 38.5), (20.5, 34.5), (18.5, 29.5), (20.5, 34.5)][i]
        elbow = [(17.5, 37), (19, 37), (19, 34.5), (19, 37)][i]

        def arm(p, m):
            p.seg((X(15), Y(32 + br)), (X(elbow[0]), Y(elbow[1])), 2, m('dress'))
            p.seg((X(elbow[0]), Y(elbow[1])), (X(hand[0] - 0.5), Y(hand[1])), 2, m('dress'))
        d.cloth('arm', arm, z=2.0)
        bowl = d.part('body', 'bowl', side=0)
        bowl.z = 3.2
        bowl.row(Y(39), X(17), X(21), 'wood')
        bowl.row(Y(40), X(18), X(20), 'wood')
        bowl.put(X(18), Y(39), 'shoe')
        bowl.put(X(19), Y(39), 'shoe')
        hn = d.part('body', 'hand')
        hn.z = 3.6
        hn.fill(X(hand[0]), Y(hand[1]), X(hand[0] + 1), Y(hand[1] + 1), 'skin')
        if i != 2:
            # The spoon's bowl below the fist.
            hn.put(X(hand[0] - 1), Y(hand[1] + 1), 'wood')
        parts = d.parts
        return mirror_parts(parts) if facing == 'w' else parts
    # Front: the bowl held in both hands at her lap, the spoon hand going to the mouth.
    hand = [(17.5, 38.5), (19, 35), (16, 29.5), (19, 35)][i]

    def arms(p, m):
        p.seg((X(11), Y(33 + br)), (X(12.5), Y(38)), 2, m('dress'))
        p.seg((X(20), Y(33 + br)), (X(20), Y(36.5)), 2, m('dress'))
        p.seg((X(20), Y(36.5)), (X(hand[0] + 0.5), Y(hand[1] + 0.5)), 2, m('dress'))
    d.cloth('arms', arms, z=1.5)
    bowl = d.part('body', 'bowl', side=0)
    bowl.z = 3.2
    bowl.row(Y(39), X(13), X(17), 'wood')
    bowl.row(Y(40), X(14), X(16), 'wood')
    bowl.put(X(14), Y(39), 'shoe')
    bowl.put(X(15), Y(39), 'shoe')
    hn = d.part('body', 'hands')
    hn.z = 3.6
    hn.fill(X(12), Y(39), X(13), Y(40), 'skin')
    hn.fill(X(hand[0]), Y(hand[1]), X(hand[0] + 1), Y(hand[1] + 1), 'skin')
    if i != 2:
        hn.put(X(hand[0]), Y(hand[1] + 2), 'wood')
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
        flipped = [r for r in reversed(CUR["head"]['e'])]
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


def body_carried(ch, facing, i):
    """Anyone in a tunic across the steerer's (or a bearer's) shoulders (Stage 10: Oddi, Thorkel's
    body): Hild's carried pose with their own head and tunic, no braid."""
    keep = dict(CUR)
    CUR.update(head=ch.model.heads, braid=False, cloth='tunic')
    try:
        parts = _tunic_carried(facing, i)
    finally:
        CUR.update(keep)
    return [p for p in parts if p.name != 'braid']


def _tunic_carried(facing, i):
    return _tunic_variant()(facing, i)


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


def _tunic_variant():
    import inspect
    src = inspect.getsource(hild_carried)
    src = src.replace('def hild_carried(facing, i):', 'def _carried_tunic(facing, i):')
    src = src.replace("m('dress_far')", "m('tunic_far')").replace("m('dress')", "m('tunic')")
    src = src.replace('d = Doll()', 'd = FightDoll()')
    ns = dict(globals())
    exec(src, ns)
    return ns['_carried_tunic']


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
    # Stage 8: eating at the fire (4 frames, a mouthful about every 2.4 seconds).
    ('eat', None, 36, True),
] + WORK_STATES
HILD_EVENTS = 'walk 0, walk 3, run 0, run 4'
HILD_POSES = {'down': 'lying', 'carried': 'carried', 'sit': 'seated', 'eat': 'seated', **WORK_POSES}

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


# ===================================================================================== Stage 9
# Fighting (Book 7 sections 07, 12 and 16; Book 2 section 12's states). Every body that fights
# (the steerer's two models, the heavy build and the three wreck-scavengers) shares these states,
# so every one of its layers has their frames:
#   windup 2 (the raised weapon: the tell of every attack), light1 to light3 3 each (a strike:
#   cocked, the blow, the follow-through), charge 2 and chargewalk 6 (held high, and walking slowly
#   so), heavy 3, block 2, parry 2, dodge 3, shove 3, stagger 2, finish 1 (the finishing warning:
#   the weapon raised high, a pose no other attack uses), surrender 2 (kneeling, empty hands up),
#   downed 2 (lying, breathing, a hand moving), dead 1 and dead_head, dead_arm, dead_leg (the
#   corpse of a dismembering blow), and piece_head, piece_arm, piece_leg (what it took).
# Weapons are held in the right hand and a shield on the left forearm (never mirrored); a weapon
# and a shield are layers of their own, on a larger canvas round the same foot anchor.

def vnorm(v):
    l = math.sqrt(sum(c * c for c in v)) or 1e-6
    return tuple(c / l for c in v)


def vcross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def vscale(v, k):
    return tuple(c * k for c in v)


CAMERA = {'s': (0.0, 1.0, 0.35), 'n': (0.0, -1.0, 0.35), 'e': (1.0, 0.0, 0.35), 'w': (-1.0, 0.0, 0.35)}


def blade_line(part, facing, a, b, w, mat, bias=0.15):
    zseg(part, facing, a, b, w, mat, bias)


def draw_arms(parts, facing, j, pose, ch):
    """The weapons a person carries (ch.arms): a seax, an axe or a spear in the right hand or carried
    at rest, and a round shield on the left forearm or slung on the back."""
    arms = getattr(ch, 'arms', ())
    if not arms:
        return
    R = j['R']['wrist']
    combat = pose.hold == 'held'
    if pose.dropped:
        dropped_arms(parts, facing, j, pose, ch)
        return
    for kind in arms:
        if kind in ('bow',):
            continue
        if kind == 'shield':
            shield(parts, facing, j, pose, ch)
            continue
        wp = Part('weapon', 0, kind, side=0)
        if kind == 'seax':
            if combat:
                d = vnorm(pose.wdir or (0.0, 1.0, 0.0))
                grip = add(R, vscale(d, 0.5))
                blade_line(wp, facing, add(grip, vscale(d, -2.5)), grip, 1, 'haft', 0.2)
                blade_line(wp, facing, grip, add(grip, vscale(d, 7.5)), 2 if facing in 'e w' else 1, 'blade', 0.25)
                tip = P2(facing, add(grip, vscale(d, 5.5)))
                wp.put(tip[0], tip[1], 'edge', tip[2] + 0.3)
            else:
                # Sheathed across the front of the belt, the grip at the right hip (Book 7: seaxes
                # across the front).
                P = j['P']
                a = add(P, (-3.5, 2.4, 3.6))
                b = add(P, (3.0, 2.4, 3.6))
                blade_line(wp, facing, a, b, 2, 'sheath', 0.5)
                h = add(P, (5.0, 2.4, 3.8))
                blade_line(wp, facing, b, h, 1, 'haft', 0.55)
        elif kind == 'axe':
            if combat:
                d = vnorm(pose.wdir or (0.0, 0.3, 1.0))
            else:
                d = None
            if d is None:
                # Thrust through the belt at the left hip, the head up behind the arm.
                P = j['P']
                bot = add(P, (-4.6, 0.6, -3.0))
                top = add(P, (-4.8, 0.4, 9.0))
                blade_line(wp, facing, bot, top, 2, 'haft', -0.4)
                axe_head(wp, facing, top, (0.0, 0.0, 1.0), (0.0, -1.0, 0.0), -0.3)
            else:
                butt = add(R, vscale(d, -2.0))
                end = add(R, vscale(d, 11.0))
                blade_line(wp, facing, butt, end, 2, 'haft', 0.2)
                edge = vnorm(vcross(d, (1.0, 0.0, 0.0))) if abs(d[0]) < 0.8 else vnorm(vcross(d, (0.0, 1.0, 0.0)))
                if edge[1] < 0 and abs(d[1]) < 0.6:
                    edge = vscale(edge, -1)
                axe_head(wp, facing, end, d, edge, 0.3)
        elif kind == 'spear':
            d = vnorm(pose.wdir if combat and pose.wdir else (0.0, 0.35, 0.94))
            butt = add(R, vscale(d, -15.0))
            tip = add(R, vscale(d, 27.0))
            blade_line(wp, facing, butt, tip, 1 if not combat or facing in 's n' else 2, 'haft', 0.2)
            head0 = add(R, vscale(d, 23.0))
            blade_line(wp, facing, head0, add(tip, vscale(d, 1.5)), 2, 'blade', 0.3)
            t = P2(facing, add(tip, vscale(d, -1.0)))
            wp.put(t[0], t[1], 'edge', t[2] + 0.35)
        parts.append(wp)


def axe_head(part, facing, at, d, edge, bias):
    """A bearded axe head at the end of the haft: the blade out along `edge`, its beard down the
    haft (Book 7: axes threaten shields)."""
    for k in range(0, 5):
        a = add(at, vscale(d, -k * 0.8))
        b = add(a, vscale(edge, 3.6 - 0.35 * k))
        blade_line(part, facing, a, b, 1, 'blade' if k < 4 else 'iron', bias)
    e0 = P2(facing, add(at, vscale(edge, 2.2)))
    part.put(e0[0], e0[1], 'edge', e0[2] + bias + 0.1)


def shield(parts, facing, j, pose, ch):
    """A round shield of boards with an iron boss and a hide rim, about 14 px across. On the left
    forearm (facing out to the left), held up in front (blocking), raised high, or on the back."""
    mode = pose.shield or ('back' if pose.hold != 'held' else 'arm')
    S = j['S']
    L = j['L']['wrist']
    if mode == 'front':
        c, n = add(S, (-1.0, 6.0, -5.0)), (0.0, 1.0, 0.1)
    elif mode == 'up':
        c, n = add(S, (-1.5, 4.5, 1.0)), (0.0, 0.8, 0.6)
    elif mode == 'arm':
        c, n = add(L, (-1.2, 0.8, 1.2)), (-0.85, 0.5, 0.1)
    else:
        c, n = add(S, (0.0, -4.8, -4.0)), (0.0, -1.0, 0.15)
    n = vnorm(n)
    up = (0.0, 0.0, 1.0) if abs(n[2]) < 0.9 else (0.0, 1.0, 0.0)
    e1 = vnorm(vcross(n, up))
    e2 = vcross(n, e1)
    cam = vnorm(CAMERA[facing])
    face = sum(n[k] * cam[k] for k in range(3)) > 0
    sp = Part('shield', 0, 'shield', side=0, rim=True)
    R0 = 7.0
    steps = 34
    for a in range(-steps, steps + 1):
        for b in range(-steps, steps + 1):
            u = a / steps * R0
            v = b / steps * R0
            r = math.hypot(u, v)
            if r > R0:
                continue
            pt = add(c, add(vscale(e1, u), vscale(e2, v)))
            x, y, dz = P2(facing, pt)
            if r > R0 - 1.1:
                mat = 'rim'
            elif face and r < 1.7:
                mat = 'boss'
            elif face:
                mat = ch.shield_paint(u, v)
            else:
                mat = 'board_back'
            cur = sp.px.get((int(math.floor(x)), int(math.floor(y))))
            z = dz + 0.4
            if cur is None or z > cur[1] or (cur[0] == 'rim' and mat != 'rim' and abs(z - cur[1]) < 0.3):
                sp.put(x, y, mat, z)
    parts.append(sp)


def dropped_arms(parts, facing, j, pose, ch):
    """Weapons thrown down in surrender: they lie on the ground in front, and the shield beside."""
    P = j['P']
    for kind in getattr(ch, 'arms', ()):
        if kind == 'bow':
            continue
        wp = Part('weapon' if kind != 'shield' else 'shield', -2.0, kind + 'down', side=0)
        if kind == 'shield':
            c = (P[0] - 4.0, P[1] + 7.5, 0.0)
            for a in range(-14, 15):
                for b in range(-14, 15):
                    u, v = a / 2.0, b / 2.0
                    if math.hypot(u, v) > 7:
                        continue
                    x, y, d = P2g(facing, (c[0] + u, c[1] + v, 0.6))
                    wp.put(x, y, 'rim' if math.hypot(u, v) > 5.9 else ch.shield_paint(u, v), d - 2)
        else:
            length = {'seax': 9.0, 'axe': 13.0, 'spear': 40.0}[kind]
            f = P[1] + 6.0
            a = (P[0] - length / 2 + 2.0, f, 0.8)
            b = (P[0] + length / 2 + 2.0, f, 0.8)
            pa, pb = P2g(facing, a), P2g(facing, b)
            wp.seg(pa[:2], pb[:2], 1, 'haft' if kind != 'seax' else 'blade')
            if kind == 'axe':
                for k in range(3):
                    wp.put(pb[0] - k * (1 if facing in 'e s' else -1), pb[1] - 1, 'blade')
                    wp.put(pb[0] - k * (1 if facing in 'e s' else -1), pb[1] - 2, 'blade')
            if kind == 'spear':
                wp.put(pb[0], pb[1], 'blade')
                wp.put(pb[0] + 1, pb[1], 'edge')
        parts.append(wp)


# ------------------------------------------------------------------------------ fighting poses
def fight_pose(rh, wdir, lean=(0.0, 0.6), pel=(0.0, 0.0, 0.0), lh=None, shield=None, feet=None,
               elbow_r=(0.8, -0.6, 0.3), cloth=(0.0, 0.0), head=(0.0, 0.0, 0.0), mouth=0):
    p = Pose(pel=pel, lean=lean, hold='held', wdir=wdir, shield=shield, head=head, mouth=mouth)
    p.hands = {'R': rh, 'L': lh or (1.6, 4.2, -6.5)}
    p.elbow = {'R': elbow_r, 'L': (1.0, -0.6, -0.2)}
    p.grip = {'R': 'fist', 'L': 'fist'}
    p.feet = feet or {'R': (-2.0, 0), 'L': (3.0, 0)}
    p.cloth = cloth
    p.hair = cloth
    return p


def spear_style(ch):
    return 'spear' in getattr(ch, 'arms', ())


def anim_windup(ch=None):
    """The tell: the weapon drawn back and up (a spear: drawn back to thrust)."""
    if ch is not None and spear_style(ch):
        return [fight_pose((0.6, -2.0, -3.5), (0.0, 1.0, 0.05), lean=(0, -0.4)),
                fight_pose((0.6, -4.0, -3.0), (0.0, 1.0, 0.1), lean=(0, -0.8))]
    return [fight_pose((1.6, -1.5, 3.5), (0.15, -0.35, 0.92), lean=(0, -0.2)),
            fight_pose((2.0, -2.8, 6.5), (0.1, -0.6, 0.8), lean=(0, -0.6))]


def anim_light(n, ch=None):
    """A light strike in three frames: cocked, the blow (the active ticks), the follow-through.
    1 a forehand cut across, 2 a backhand, 3 an overhead chop; a spear thrusts."""
    if ch is not None and spear_style(ch):
        lift = {1: 0.0, 2: 2.5, 3: -1.0}[n]
        return [fight_pose((0.6, -3.5, -3.0 + lift), (0.0, 1.0, 0.05)),
                fight_pose((0.4, 9.5, -1.5 + lift), (0.0, 1.0, 0.0), lean=(0, 2.2),
                           feet={'R': (-4.0, 0), 'L': (5.0, 0)}),
                fight_pose((0.6, 5.0, -3.0), (0.0, 1.0, -0.1), lean=(0, 1.2))]
    if n == 1:
        return [fight_pose((2.2, -1.0, 5.5), (0.3, -0.3, 0.9)),
                fight_pose((-3.5, 8.0, -2.5), (-0.55, 0.8, -0.2), lean=(0, 2.0),
                           feet={'R': (-3.5, 0), 'L': (4.5, 0)}, cloth=(0.8, 0)),
                fight_pose((-5.0, 4.5, -8.5), (-0.4, 0.4, -0.85), lean=(0, 1.2), cloth=(0.4, 0))]
    if n == 2:
        return [fight_pose((-4.0, 2.5, 2.5), (-0.6, -0.1, 0.8), lean=(-0.3, 0.4)),
                fight_pose((3.5, 8.5, -2.0), (0.6, 0.8, 0.0), lean=(0.3, 2.0),
                           feet={'R': (-3.5, 0), 'L': (4.5, 0)}, cloth=(0.8, 0)),
                fight_pose((4.0, 4.0, -6.5), (0.8, 0.2, -0.55), lean=(0.2, 1.0), cloth=(0.4, 0))]
    return [fight_pose((0.6, 0.5, 9.0), (0.0, -0.55, 0.85), lean=(0, -0.5)),
            fight_pose((0.4, 8.5, -4.0), (0.0, 0.6, -0.8), lean=(0, 2.4), pel=(0, 0, -1),
                       feet={'R': (-3.5, 0), 'L': (5.0, 0)}, cloth=(0.9, 0)),
            fight_pose((0.4, 6.0, -9.5), (0.0, 0.3, -0.95), lean=(0, 1.6), pel=(0, 0, -1), cloth=(0.4, 0))]


def anim_charge(ch=None):
    """The heavy held: the weapon high behind the shoulder, the body coiled; a tremble in the arm."""
    if ch is not None and spear_style(ch):
        return [fight_pose((0.8, -5.5, -2.0), (0.0, 1.0, 0.15), lean=(0, -1.0), pel=(0, 0, -1)),
                fight_pose((0.9, -5.8, -1.6), (0.0, 1.0, 0.18), lean=(0, -1.1), pel=(0, 0, -1))]
    return [fight_pose((2.4, -3.5, 8.0), (0.1, -0.75, 0.65), lean=(0, -1.0), pel=(0, 0, -1)),
            fight_pose((2.6, -3.8, 8.4), (0.1, -0.78, 0.62), lean=(0, -1.1), pel=(0, 0, -1))]


def anim_chargewalk(ch=None, heavy=False):
    """Walking slowly with the heavy held (Book 10's charge speed): the walk's legs, the arms set."""
    walk = anim_walk(heavy)
    held = anim_charge(ch)[0]
    out = []
    for i, w in enumerate(walk):
        p = w.copy(hold='held', wdir=held.wdir, lean=(0, -0.6))
        p.hands = {'R': held.hands['R'], 'L': held.hands['L']}
        p.elbow = dict(held.elbow)
        p.grip = {'R': 'fist', 'L': 'fist'}
        out.append(p)
    return out


def anim_heavy(ch=None):
    """A released charge: the big swing through, a step in, and a heavy recovery."""
    if ch is not None and spear_style(ch):
        return [fight_pose((0.8, -5.0, -2.0), (0.0, 1.0, 0.1), lean=(0, -0.8)),
                fight_pose((0.3, 9.5, -2.5), (0.0, 1.0, -0.05), lean=(0, 2.5), pel=(0, 0.8, -1),
                           feet={'R': (-4.5, 0), 'L': (5.0, 0)}, cloth=(1.0, 0)),
                fight_pose((0.5, 7.0, -4.0), (0.0, 0.9, -0.3), lean=(0, 2.0), pel=(0, 0.5, -1))]
    return [fight_pose((2.2, -2.0, 9.0), (0.1, -0.5, 0.85), lean=(0, -0.8)),
            fight_pose((-1.0, 9.5, -5.0), (-0.2, 0.7, -0.7), lean=(0, 3.0), pel=(0, 1.0, -2),
                       feet={'R': (-5.0, 0), 'L': (6.0, 0)}, cloth=(1.0, 0)),
            fight_pose((-2.5, 6.0, -10.0), (-0.2, 0.3, -0.95), lean=(0, 2.2), pel=(0, 0.5, -2))]


def anim_block(ch=None):
    """The shield up in front, braced; the second frame takes a blow."""
    a = fight_pose((1.5, 2.5, -4.0), (0.2, 0.9, 0.3), lean=(0, 0.6), lh=(0.2, 5.0, -2.0), shield='front',
                   feet={'R': (-3.0, 0), 'L': (3.0, 0)})
    b = fight_pose((1.6, 1.5, -4.5), (0.2, 0.9, 0.3), lean=(0, -0.6), lh=(0.2, 4.0, -2.0), shield='front',
                   feet={'R': (-3.5, 0), 'L': (2.5, 0)})
    return [a, b]


def anim_parry(ch=None):
    """The blade (or the shield's edge) swept across to meet the blow, then back."""
    if ch is not None and 'shield' in getattr(ch, 'arms', ()):
        return [fight_pose((1.8, 2.0, -3.0), (0.3, 0.8, 0.5), lh=(-0.5, 6.5, 0.5), shield='up', lean=(0, 1.0)),
                fight_pose((2.0, 1.0, -4.0), (0.3, 0.8, 0.4), lh=(0.8, 4.0, -3.0), shield='arm')]
    return [fight_pose((-1.5, 6.5, 2.5), (-0.7, 0.4, 0.6), lean=(0, 0.8)),
            fight_pose((1.5, 4.0, -2.0), (0.4, 0.7, 0.5), lean=(0, 0.2))]


def anim_dodge(ch=None):
    """A quick sidestep: crouch, the push away (a lean, the trailing foot lifted), and landing."""
    a = fight_pose((1.8, 2.0, -6.0), (0.2, 0.9, 0.3), lean=(0, 0.8), pel=(0, 0, -3),
                   feet={'R': (-2.0, 0), 'L': (2.5, 0)})
    b = fight_pose((1.6, 1.0, -4.5), (0.3, 0.8, 0.4), lean=(-0.8, -0.5), pel=(-0.6, -1.0, -2),
                   feet={'R': (-4.0, 3.0), 'L': (2.0, 0)}, cloth=(-1.2, 0))
    c = fight_pose((1.8, 2.5, -5.5), (0.2, 0.9, 0.3), lean=(0, 0.6), pel=(0, -1.0, -3),
                   feet={'R': (-2.5, 0), 'L': (2.0, 0)}, cloth=(0.6, 0))
    return [a, b, c]


def anim_shove(ch=None):
    """Both hands drawn in, then thrust out: a shove that makes space (Book 1 section 09)."""
    a = fight_pose((-1.0, 3.0, -3.0), (0.2, 0.9, 0.3), lh=(1.0, 3.0, -3.0), lean=(0, -0.4), shield='arm')
    b = fight_pose((-2.5, 10.0, -2.0), (0.2, 0.9, 0.3), lh=(2.5, 10.0, -2.0), lean=(0, 2.8), pel=(0, 1.0, -1),
                   feet={'R': (-4.5, 0), 'L': (5.0, 0)}, cloth=(1.0, 0), shield='front')
    c = fight_pose((0.5, 5.0, -5.0), (0.2, 0.9, 0.3), lh=(1.5, 5.0, -5.0), lean=(0, 1.0), shield='arm')
    for p in (a, b, c):
        p.grip = {'R': 'open', 'L': 'open'}
    return [a, b, c]


def anim_stagger(ch=None):
    """Knocked back off balance: the head thrown back, the arms wide."""
    a = fight_pose((3.5, -1.5, -5.0), (0.5, 0.5, -0.7), lean=(0.5, -2.5), head=(0, -1.0, 0),
                   feet={'R': (-3.0, 0), 'L': (2.5, 1.0)}, lh=(3.5, -1.0, -5.0), cloth=(1.4, 0), mouth=1,
                   shield='arm')
    b = fight_pose((3.0, -0.5, -7.0), (0.5, 0.6, -0.6), lean=(0.3, -1.5), head=(0, -0.5, 0),
                   feet={'R': (-3.5, 0), 'L': (2.0, 0)}, lh=(3.0, 0.0, -7.0), cloth=(0.6, 0), shield='arm')
    return [a, b]


def anim_finish(ch=None):
    """The finishing warning (Book 7 section 07): standing over the downed with the weapon raised
    high in both hands, held for the whole warning; a pose no other attack uses."""
    p = fight_pose((0.0, 1.0, 11.0), (0.0, -0.2, 0.98), lean=(0, -1.0), lh=(-0.5, 1.0, 10.0), mouth=1,
                   shield='back')
    return [p]


def anim_surrender(ch=None):
    """Kneeling, both hands raised and open, the weapons thrown down in front (Book 7 section 07:
    surrendered actors kneel with empty hands); the second frame a small flinch."""
    out = []
    for k in range(2):
        p = Pose(pel=(0, -1.0, -9), lean=(0, 1.0 + 0.4 * k), breath=-k, dropped=True)
        p.hands = {'R': (1.8, 4.0 - k * 0.5, 3.0 - k), 'L': (1.8, 4.0 - k * 0.5, 3.0 - k)}
        p.elbow = {'R': (1.2, -0.4, -0.6), 'L': (1.2, -0.4, -0.6)}
        p.grip = {'R': 'open', 'L': 'open'}
        p.feet = {'R': (-7.0, 0), 'L': (3.5, 0)}
        p.toe = {'R': 1, 'L': 0}
        p.head = (0, 0.3 * k, -0.5 * k)
        out.append(p)
    return out


def anim_riposte(ch=None):
    """Combat v2 (Book 7 section 12, decision DE-5): the riposte, a heavy distinct blow into the
    reeling foe. The step in with the weapon coiled low and back, the long drive up through the
    body (a spear: a full-length thrust), then held at the end of it."""
    if ch is not None and spear_style(ch):
        return [fight_pose((0.6, -6.0, -3.5), (0.0, 1.0, 0.1), lean=(0, -1.4), pel=(0, -1.0, -2),
                           feet={'R': (-5.0, 0), 'L': (4.0, 0)}),
                fight_pose((0.2, 9.5, -1.0), (0.0, 1.0, 0.05), lean=(0, 2.6), pel=(0, 1.0, -2),
                           feet={'R': (-5.0, 0), 'L': (5.0, 0)}, cloth=(1.4, 0), mouth=1),
                fight_pose((0.4, 7.5, -2.5), (0.0, 1.0, -0.1), lean=(0, 2.0), pel=(0, 0.8, -2),
                           feet={'R': (-5.0, 0), 'L': (5.0, 0)}, cloth=(0.6, 0))]
    return [fight_pose((2.8, -3.0, -6.5), (0.3, 0.6, -0.5), lean=(0, -1.0), pel=(0, -1.0, -3),
                       lh=(1.5, 5.0, -1.0), feet={'R': (-5.0, 0), 'L': (3.5, 0)}),
            fight_pose((0.8, 8.5, 1.5), (0.1, 0.8, 0.6), lean=(0, 2.6), pel=(0, 1.0, -2),
                       lh=(1.2, 6.5, -4.0), feet={'R': (-5.0, 0), 'L': (5.0, 0)}, cloth=(1.4, 0),
                       mouth=1),
            fight_pose((0.6, 7.5, 3.0), (0.1, 0.6, 0.8), lean=(0, 2.0), pel=(0, 0.8, -2),
                       lh=(1.4, 5.5, -3.5), feet={'R': (-5.0, 0), 'L': (5.0, 0)}, cloth=(0.6, 0))]


def anim_backstab(ch=None):
    """Combat v2 (decision DE-9): the backstab, heavy and distinct. The left hand reaches high to
    take the shoulder while the blade is drawn back at the hip, the drive in low under the ribs
    with the left hand pulling the foe back onto it, and the wrench free."""
    return [fight_pose((2.6, -2.5, -5.0), (0.1, 0.9, 0.4), lean=(0, 1.0), lh=(0.0, 9.0, 3.0),
                       feet={'R': (-3.5, 0), 'L': (4.5, 0)}),
            fight_pose((0.4, 9.5, -4.0), (0.0, 1.0, 0.2), lean=(0, 2.8), lh=(-0.5, 6.0, 4.0),
                       pel=(0, 1.0, -1), feet={'R': (-5.0, 0), 'L': (5.5, 0)}, cloth=(1.0, 0)),
            fight_pose((2.0, 5.0, -5.5), (0.4, 0.8, -0.3), lean=(0, 1.2), lh=(-0.5, 7.5, 2.0),
                       pel=(0, 0.5, -1), feet={'R': (-4.5, 0), 'L': (5.0, 0)}, cloth=(0.4, 0))]


def anim_lunge(ch=None):
    """Combat v2 (decision DE-4): the lunge's tell, a step and a dip of the shoulders with the
    weapon held back, then the long reach at the end of the ground covered."""
    if ch is not None and spear_style(ch):
        return [fight_pose((0.6, -4.5, -4.5), (0.0, 1.0, 0.05), lean=(0, 1.6), pel=(0, 0.5, -3),
                           feet={'R': (-4.0, 0), 'L': (5.0, 0)}),
                fight_pose((0.3, 9.5, -2.0), (0.0, 1.0, 0.0), lean=(0, 2.4), pel=(0, 1.0, -2),
                           feet={'R': (-5.5, 1.0), 'L': (5.0, 0)}, cloth=(1.2, 0))]
    return [fight_pose((2.4, -2.0, 4.0), (0.2, -0.4, 0.88), lean=(0, 1.6), pel=(0, 0.5, -3),
                       feet={'R': (-4.0, 0), 'L': (5.0, 0)}),
            fight_pose((-1.0, 8.5, -3.0), (-0.3, 0.8, -0.5), lean=(0, 2.4), pel=(0, 1.0, -2),
                       feet={'R': (-5.5, 1.0), 'L': (5.0, 0)}, cloth=(1.2, 0))]


def anim_parried(ch=None):
    """Combat v2 (decision DE-5): parried, the weapon thrown up and out of line, the body reeling
    back and open, the head snapped back; then swaying, still open."""
    up = (0.6, -1.5, 9.5) if ch is None or not spear_style(ch) else (0.8, -2.5, 7.5)
    a = fight_pose(up, (0.3, -0.6, 0.75), lean=(0.4, -2.8), head=(0, -1.2, 0), mouth=1,
                   lh=(3.0, 1.0, -2.0), feet={'R': (-4.0, 0), 'L': (2.0, 1.5)}, cloth=(-1.2, 0),
                   elbow_r=(1.2, -0.4, 0.6), shield='arm')
    b = fight_pose((up[0] + 0.6, up[1] + 1.0, up[2] - 2.5), (0.4, -0.3, 0.85), lean=(0.2, -2.0),
                   head=(0, -0.6, 0), lh=(3.2, 1.5, -3.5), feet={'R': (-4.5, 0), 'L': (2.0, 0)},
                   cloth=(-0.4, 0), elbow_r=(1.2, -0.4, 0.4), shield='arm')
    return [a, b]


def anim_getup(ch=None):
    """Combat v2 (decision DE-7): getting up after a knockdown, one knee and a hand on the ground,
    then rising into a crouch with the weapon gathered."""
    out = []
    for k, (u, lean) in enumerate([(-8.0, 2.4), (-4.0, 1.4)]):
        p = Pose(pel=(0, -0.5, u), lean=(0, lean), breath=-1, hold='held', wdir=(0.3, 0.6, -0.6))
        p.hands = {'R': (1.8, 4.0, -2.0 - 3 * (1 - k)), 'L': (0.6, 5.5, -9.0 + 4 * k)}
        p.elbow = {'R': (1.0, -0.6, 0.0), 'L': (1.0, -0.4, 0.0)}
        p.grip = {'R': 'fist', 'L': 'open'}
        p.feet = {'R': (-6.5 + 2 * k, 0), 'L': (3.5, 0)}
        p.toe = {'R': 1, 'L': 0}
        p.head = (0, 0.2, -0.3)
        p.shield = 'arm'
        out.append(p)
    return out


class Lying:
    """A lying or dismembered state drawn piece by piece (not a standing skeleton)."""

    def __init__(self, kind, frames):
        self.kind, self.frames = kind, frames

    def __call__(self):
        return [None] * self.frames


class FightDoll(Doll):
    """A Doll whose tunic also lays linen under it (the lying of Stage 9)."""

    UNDER = dict(Doll.UNDER, tunic='linen', sash='linen', fold='linen')


def lying_parts(ch, kind, i):
    """Drawn facing east (head to the east), as the sleeper is: the downed on their back, breathing,
    a hand moving; the dead sprawled and still; a dismembered corpse without its piece, the stump
    bloody; the piece itself on its own."""
    d = FightDoll()
    X, Y = W_, H_
    m = ch.model
    heavy = m.heavy
    if kind.startswith('piece_'):
        return piece_parts(ch, kind[6:], d)
    breathe = (0, 1)[i] if kind == 'downed' else 0
    no_head = kind == 'dead_head'
    no_arm = kind == 'dead_arm'
    no_leg = kind == 'dead_leg'
    thick = 6 if heavy else 5
    # The cloak spread under the body (those who wear one).
    if getattr(ch, 'cloak', True) and not isinstance(ch, Hild):
        cl = d.part('cloak', 'cloak')
        cl.z = -2.0
        for x in range(5, 26):
            for y in range(41, 47):
                if (x + y) % 7 != 0:
                    cl.put(X(x), Y(y), 'cloak')
            cl.put(X(x), Y(46), 'lining')
    # Legs to the west; the near one ends at the knee when taken.
    for far, dy, dx in ((True, -1, 1), (False, 0, 0)):
        fs = '_far' if far else ''
        stump = no_leg and not far

        def leg(p, mm, dx=dx, dy=dy, fs=fs, stump=stump):
            p.seg((X(15 + dx), Y(43.5 + dy)), (X(10 + dx), Y(43.5 + dy)), 4 if heavy else 3, mm('trouser' + fs))
            if stump:
                return
            p.seg((X(10 + dx), Y(44 + dy)), (X(5 + dx), Y(44 + dy)), 3, mm('wrap' + fs))
            p.fill(X(2 + dx), Y(43 + dy), X(4 + dx), Y(45 + dy), mm('shoe' + fs))
        d.cloth('leg' + fs, leg, z=-0.5 if far else 0.0)
    if no_leg:
        bl = d.part('body', 'stump')
        bl.z = 2.0
        bl.fill(X(9), Y(43), X(9), Y(45), 'blood')
        bl.put(X(8), Y(44), 'blood_fresh')

    def torso(p, mm):
        p.seg((X(23), Y(41.5 - breathe * 0.5)), (X(15), Y(43.0)), thick, mm(ch.torso_mat(4)))
        p.seg((X(17), Y(40.5)), (X(16.5), Y(45.5)), 1, mm('belt'))
    d.cloth('torso', torso)
    # The far arm along the ground.
    d.cloth('fararm', lambda p, mm: (p.seg((X(22), Y(40)), (X(17), Y(39)), 2, mm(ch.sleeve + '_far')),
                                     p.seg((X(17), Y(39)), (X(13), Y(39.5)), 2, mm(ch.sleeve + '_far'))), z=-0.8)
    fh = d.part('body', 'farhand')
    fh.z = -0.7
    fh.fill(X(11), Y(39), X(12), Y(40), 'skin_far')
    if not no_arm:
        if kind == 'downed':
            # The near hand on the chest, lifting with the breath.
            def near(p, mm):
                p.seg((X(22), Y(44)), (X(19), Y(45.5)), 2, mm(ch.sleeve))
                p.seg((X(19), Y(45.5)), (X(17), Y(42.5 - breathe)), 2, mm(ch.sleeve))
            d.cloth('arm', near, z=3.0)
            hn = d.part('body', 'hand')
            hn.z = 3.5
            hn.fill(X(16), Y(41 - breathe), X(17), Y(42 - breathe), 'skin')
        else:
            # Flung out towards the viewer, open on the ground.
            def near(p, mm):
                p.seg((X(21), Y(43.5)), (X(23), Y(45.2)), 2, mm(ch.sleeve))
                p.seg((X(23), Y(45.2)), (X(27), Y(45.2)), 2, mm(ch.sleeve))
            d.cloth('arm', near, z=3.0)
            hn = d.part('body', 'hand')
            hn.z = 3.5
            hn.fill(X(28), Y(45), X(29), Y(45), 'skin')
            hn.put(X(28), Y(44), 'skin')
    else:
        st = d.part('body', 'stump')
        st.z = 3.2
        st.fill(X(21), Y(44), X(22), Y(44), 'blood')
        st.put(X(22), Y(45), 'blood_fresh')
    if not no_head:
        hd = d.part('body', 'head', bottom=False)
        tpl = m.heads['e']
        if kind != 'downed':
            tpl = [r.replace('e', 'F') if kind != 'downed' else r for r in tpl]
        hd.stamp(tpl, X(22), Y(33.5 + (1 if kind != 'downed' else 0)), HEAD_LETTERS)
    else:
        st = d.part('body', 'neck')
        st.z = 1.5
        st.fill(X(24), Y(40), X(25), Y(42), 'blood')
        st.put(X(26), Y(41), 'blood_fresh')
        st.put(X(25), Y(43), 'blood_dry')
    d.parts = [p for p in d.parts if p.layer in ('body', 'clothing', 'cloak')]
    # Weapons lie beside the hand.
    for kind_ in getattr(ch, 'arms', ()):
        if kind_ == 'bow':
            continue
        wp = Part('weapon' if kind_ != 'shield' else 'shield', -2.5, kind_ + 'lying', side=0)
        if kind_ == 'shield':
            for a in range(-14, 15):
                for b in range(-6, 7):
                    u, v = a / 2.0, b / 2.0
                    if (u / 7) ** 2 + (v / 3) ** 2 > 1:
                        continue
                    wp.put(X(9 + u), Y(39 + v), 'rim' if (u / 7) ** 2 + (v / 3) ** 2 > 0.7 else ch.shield_paint(u, v * 2))
        else:
            length = {'seax': 8, 'axe': 13, 'spear': 40}[kind_]
            x0 = 29 - length
            wp.seg((X(x0), Y(47.5)), (X(29), Y(47.5)), 1, 'blade' if kind_ == 'seax' else 'haft')
            if kind_ == 'axe':
                wp.fill(X(27), Y(45.5), X(29), Y(46.5), 'blade')
            if kind_ == 'spear':
                wp.fill(X(28), Y(47), X(30), Y(47), 'blade')
        d.parts.append(wp)
    return d.parts


def piece_parts(ch, piece, d):
    """What a dismembering blow took, lying on its own at the anchor."""
    X, Y = W_, H_
    m = ch.model
    if piece == 'head':
        hd = d.part('body', 'head', bottom=False)
        tpl = [r.replace('e', 'F') for r in m.heads['e']]
        hd.stamp(tpl, X(12), Y(38), HEAD_LETTERS)
        bl = d.part('body', 'neck')
        bl.z = 1.0
        bl.fill(X(14), Y(46), X(17), Y(46), 'blood')
        bl.put(X(18), Y(46), 'blood_fresh')
    elif piece == 'arm':
        d.cloth('arm', lambda p, mm: p.seg((X(10), Y(44)), (X(19), Y(45)), 2, mm(ch.sleeve)))
        hn = d.part('body', 'hand')
        hn.z = 1.0
        hn.fill(X(20), Y(44), X(21), Y(45), 'skin')
        bl = d.part('body', 'stump')
        bl.z = 1.0
        bl.fill(X(9), Y(44), X(9), Y(45), 'blood')
    else:
        d.cloth('leg', lambda p, mm: (p.seg((X(9), Y(44)), (X(15), Y(44)), 3, mm('trouser')),
                                      p.seg((X(15), Y(44.5)), (X(20), Y(44.5)), 3, mm('wrap')),
                                      p.fill(X(21), Y(43), X(23), Y(45), mm('shoe'))))
        bl = d.part('body', 'stump')
        bl.z = 1.0
        bl.fill(X(8), Y(43), X(8), Y(45), 'blood')
    return [p for p in d.parts if p.layer in ('body', 'clothing')]


FIGHT_POSES = {'downed': 'lying', 'dead': 'lying', 'dead_head': 'lying', 'dead_arm': 'lying',
               'dead_leg': 'lying', 'piece_head': 'lying', 'piece_arm': 'lying', 'piece_leg': 'lying',
               'surrender': 'seated', 'getup': 'seated'}


def narrow(poses, ch):
    """The heavy build's broad shoulders: hands kept closer in, so the figure stays in its cell."""
    if ch is None or not ch.model.heavy:
        return poses
    for p in poses:
        p.hands = {k: (None if v is None else (max(-1.5, min(-0.5, v[0])), v[1], v[2]))
                   for k, v in p.hands.items()}
        p.lean = (0.0, p.lean[1])
        p.pel = (0.0, p.pel[1], p.pel[2])
        p.elbow = {k: (min(0.0, e[0]), e[1], e[2]) for k, e in p.elbow.items()}
    return poses


def fight_states(ch, heavy=False):
    """Stage 9's states for a body that fights (the same counts and timing for every build)."""
    c = ch
    N = narrow
    return [
        ('windup', lambda: N(anim_windup(c), c), 6, False),
        ('light1', lambda: N(anim_light(1, c), c), 6, False),
        ('light2', lambda: N(anim_light(2, c), c), 6, False),
        ('light3', lambda: N(anim_light(3, c), c), 6, False),
        ('charge', lambda: N(anim_charge(c), c), 6, True),
        ('chargewalk', lambda: N(anim_chargewalk(c, heavy), c), 8, True),
        ('heavy', lambda: N(anim_heavy(c), c), 8, False),
        ('block', lambda: N(anim_block(c), c), 10, False),
        ('parry', lambda: N(anim_parry(c), c), 6, False),
        ('dodge', lambda: N(anim_dodge(c), c), 7, False),
        ('shove', lambda: N(anim_shove(c), c), 7, False),
        ('stagger', lambda: N(anim_stagger(c), c), 9, False),
        # Combat v2 (design addendum 2.4, decisions DE-4, DE-5, DE-7, DE-9).
        ('riposte', lambda: N(anim_riposte(c), c), 7, False),
        ('backstab', lambda: N(anim_backstab(c), c), 9, False),
        ('lunge', lambda: N(anim_lunge(c), c), 8, False),
        ('parried', lambda: N(anim_parried(c), c), 10, False),
        ('getup', lambda: N(anim_getup(c), c), 10, False),
        ('finish', lambda: N(anim_finish(c), c), 30, False),
        ('surrender', lambda: N(anim_surrender(c), c), 40, True),
        ('downed', Lying('downed', 2), 40, True),
        ('dead', Lying('dead', 1), 60, False),
        ('dead_head', Lying('dead_head', 1), 60, False),
        ('dead_arm', Lying('dead_arm', 1), 60, False),
        ('dead_leg', Lying('dead_leg', 1), 60, False),
        ('piece_head', Lying('piece_head', 1), 60, False),
        ('piece_arm', Lying('piece_arm', 1), 60, False),
        ('piece_leg', Lying('piece_leg', 1), 60, False),
    ]


# ---------------------------------------------------------------------------- weapons' colours
ARMS_MATS = {
    'blade': ('stone', 5, 7, 9), 'edge': ('stone', 9), 'haft': ('driftwood', 1, 2, 4),
    'sheath': ('tar', 0, 1, 2), 'iron': ('stone', 3, 5, 7),
    'rim': ('tar', 0, 1, 2), 'boss': ('stone', 4, 6, 8), 'board_back': ('driftwood', 1, 2, 3),
    'paint_a': ('driftwood', 2, 3, 5), 'paint_b': ('driftwood', 2, 3, 5),
    'blood': ('code', '7'), 'blood_dry': ('code', '8'), 'blood_fresh': ('code', '6'),
}


def material_of_factory(ch):
    return lambda m: m


# ----------------------------------------------------------------------- the wreck-scavengers
HEAD_SVART = {
    's': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HhFFFFhH',
          'FFeFFeFF',
          'FFFFFFFF',
          'hFFFFFFh',
          '.hhhhhh.'],
    'n': HEAD_A['n'],
    'e': HEAD_A['e'],
}


class Wrecker(Steerer):
    """A wreck-scavenger (Stage 9, decision S9-11): an outlaw's mended clothes, no sash, a body of
    one of the three builds; the leader on the heavy build. Never the steerer's madder."""

    sash = False

    def __init__(self, model, arms, cloak=True, paint=('paint_a', 'paint_b')):
        super().__init__(model)
        self.arms = arms
        self.cloak = cloak
        self.brooch = False
        self.paint = paint

    def torso_mat(self, k):
        return 'belt' if k == 8 else 'tunic'

    def shield_paint(self, u, v):
        return self.paint[0] if u * 0.6 + v >= 0 else self.paint[1]

    @staticmethod
    def material_of(mat):
        return mat


def steerer_paint(self, u, v):
    return 'paint_a'


Steerer.shield_paint = steerer_paint
Steerer.material_of = staticmethod(lambda m: m)
Hild.material_of = staticmethod(lambda m: m)
Hild.shield_paint = steerer_paint

def merge(*ds):
    out = {}
    for d_ in ds:
        out.update(d_)
    return out


WRECKER_MATS = {
    'ketill': merge(HEAVY_MATS, ARMS_MATS, {
        'hair': ('hair_brown', 0, 0, 1), 'brow': ('hair_brown', 0, 0, 1),
        'tunic': ('seal', 1, 2, 3), 'fold': ('seal', 1),
        'trouser': ('wool', 1, 2, 3), 'wrap': ('tar', 1, 2, 3), 'wrapd': ('tar', 0),
        'cloak': ('fleece', 1, 2, 3), 'cloakin': ('fleece', 0, 1, 2), 'cloakf': ('fleece', 1),
        'lining': ('fleece', 0, 1, 1),
        'paint_a': ('weld', 1, 2, 3), 'paint_b': ('tar', 0, 1, 2),
    }),
    'svart': merge(STEERER_MATS, ARMS_MATS, {
        'hair': ('hair_brown', 0, 1, 1), 'brow': ('hair_brown', 0, 0, 1),
        'skin': ('skin_deep', 2, 3, 4), 'mouth': ('skin_deep', 2), 'nose': ('skin_deep', 2),
        'tunic': ('kelp', 1, 2, 3), 'fold': ('kelp', 1),
        'trouser': ('earth', 1, 2, 3), 'wrap': ('wool', 1, 2, 3), 'wrapd': ('wool', 0),
        'cloak': ('stone', 2, 3, 4), 'cloakin': ('stone', 1, 2, 3), 'cloakf': ('stone', 2),
        'lining': ('stone', 1, 2, 2),
        'paint_a': ('driftwood', 2, 3, 4), 'paint_b': ('driftwood', 1, 2, 3),
    }),
    'conn': merge(STEERER_MATS, ARMS_MATS, {
        'hair': ('hair_blond', 1, 2, 4), 'brow': ('hair_blond', 1, 1, 2),
        'tunic': ('moss', 1, 2, 3), 'fold': ('moss', 1),
        'trouser': ('wool', 2, 3, 4), 'wrap': ('earth', 1, 2, 3), 'wrapd': ('earth', 0),
    }),
}
MODEL_SVART = Model('svart', 6.5,
                    upper=MODEL_A.upper, lower=MODEL_A.lower, upper_e=MODEL_A.upper_e,
                    lower_e=MODEL_A.lower_e, heads=HEAD_SVART)

for _mats in (STEERER_MATS, HEAVY_MATS, HILD_MATS):
    for _key, _val in ARMS_MATS.items():
        _mats.setdefault(_key, _val)


# ------------------------------------------------------------------------------------- output
# ------------------------------------------------------------------- Stage 10: the three searches
class Resident(Wrecker):
    """A resident found in Chapter 1's searches (Stage 10; Book 5 section 02): working dress like the
    scavengers' cut (no sash: the madder is the steerer's), their own colours and silhouette."""

    ladle = False

    def extras(self, parts, facing, j, pose, prev, rows, lag_u, lag_f):
        super().extras(parts, facing, j, pose, prev, rows, lag_u, lag_f)
        if not self.ladle:
            return
        # Bran's ladle at his belt (Book 7 section 07: his silhouette detail), on the right hip.
        Px, Py, _ = P2(facing, j['P'])
        side = {'s': -6, 'n': 6, 'e': -2, 'w': 2}[facing]
        z = {'s': 3.0, 'n': -3.0, 'e': -2.0, 'w': 3.0}[facing]
        lad = Part('clothing', z, 'ladle', side=0)
        x = Px + side
        for k in range(5):
            lad.put(x, Py - 1 + k, 'wood')
        lad.fill(x - 1, Py + 4, x + 1, Py + 5, 'wood')
        lad.put(x, Py + 5, 'drift')
        parts.append(lad)


class Thorkel(Steerer):
    """Thorkel Ketilsson, drowned in the wreck (Book 5 section 02): only lying dead and carried."""

    sash = False

    def __init__(self):
        super().__init__(MODEL_A)
        self.brooch = True

    def torso_mat(self, k):
        return 'belt' if k == 8 else 'tunic'


HEAD_RUNA = {
    's': ['..HHHH..',
          '.HHHHHH.',
          'HHHHHHHH',
          'HHFFFFHH',
          'HFeFFeFH',
          '.FFFFFF.',
          '.FFmmFF.',
          '..FFFF..'],
    'n': HEAD_HILD['n'],
    'e': ['..HHHH...',
          '.HHHHHH..',
          'HHHHHHHH.',
          'HHHHHHFF.',
          'HHHHFFeF.',
          '.HHHFFFFF',
          '..HFFFFF.',
          '..hFFFF..'],
}
MODEL_RUNA = Model('runa', 5.5, forearm=2, upper=MODEL_HILD.upper, lower=MODEL_HILD.lower,
                   upper_e=MODEL_HILD.upper_e, lower_e=MODEL_HILD.lower_e, heads=HEAD_RUNA)


class Runa(Hild):
    """Runa Asdisardottir (C_RUNA, Book 5 section 02): an ochre dress (her signature colour), dark
    hair pinned up in a knot, her ankle bound where the headland took it, and the adze over her
    shoulder (her silhouette detail, Book 7 section 07)."""

    def __init__(self):
        super().__init__()
        self.model = MODEL_RUNA
        self.mats = RUNA_MATS

    def hair_extra(self, parts, facing, j, pose, prev, chin, ncx, head):
        # The knot at the back of her head, a pixel behind the crown; it does not swing.
        z = {'s': -2.0, 'n': 3.0, 'e': 2.0, 'w': 2.0}[facing]
        k = Part('body', z, 'knot', side=0)
        x = ncx + {'s': 0, 'n': 0, 'e': -4, 'w': 4}[facing]
        y = chin - 9
        k.fill(x - 1, y, x + 1, y + 1, 'hair')
        k.put(x, y - 1, 'plait')
        parts.append(k)

    def extras(self, parts, facing, j, pose, prev, rows, lag_u, lag_f):
        work_tool(parts, facing, j, pose)
        if pose.tool is not None:
            return
        # The adze over her right shoulder, the haft down her back and its iron head up by her ear.
        Sx, Sy, _ = P2(facing, j['S'])
        z = {'s': -3.0, 'n': 3.0, 'e': -3.0, 'w': 3.0}[facing]
        a = Part('body', z, 'adze', side=0)
        dx = {'s': 4, 'n': -4, 'e': -3, 'w': 3}[facing]
        for k in range(11):
            a.put(Sx + dx - (k // 4) * (1 if dx > 0 else -1), Sy - 5 + k, 'wood')
        a.fill(Sx + dx - 1, Sy - 7, Sx + dx + 1, Sy - 6, 'iron')
        parts.append(a)


RESIDENT_MATS = {
    'oddi': merge(STEERER_MATS, ARMS_MATS, {
        'hair': ('hair_brown', 2, 3, 4), 'brow': ('hair_brown', 2, 2, 3),
        'tunic': ('stone', 4, 5, 6), 'fold': ('stone', 4),
        'trouser': ('earth', 2, 3, 4), 'wrap': ('wool', 1, 2, 3), 'wrapd': ('wool', 0),
        'bind': ('wool', 4, 5, 6), 'blood': ('code', '7'),
    }),
    'bran': merge(HEAVY_MATS, ARMS_MATS, {
        'hair': ('hair_brown', 0, 1, 2), 'brow': ('hair_brown', 0, 0, 1),
        'tunic': ('wool', 4, 5, 6), 'fold': ('wool', 4),
        'trouser': ('earth', 1, 2, 3), 'wrap': ('tar', 2, 3, 4), 'wrapd': ('tar', 1),
        'paint_a': ('earth', 2, 3, 4), 'paint_b': ('wool', 3, 4, 5),
        'bind': ('wool', 4, 5, 6), 'blood': ('code', '7'),
    }),
    'thorkel': merge(STEERER_MATS, ARMS_MATS, {
        'hair': ('stone', 5, 6, 8), 'brow': ('stone', 5, 5, 6),
        'tunic': ('woad', 1, 2, 3), 'fold': ('woad', 1),
        'trouser': ('earth', 1, 2, 3), 'wrap': ('wool', 2, 3, 4), 'wrapd': ('wool', 1),
        'cloak': ('stone', 2, 3, 4), 'cloakin': ('stone', 1, 2, 3), 'cloakf': ('stone', 2),
        'lining': ('woad', 1, 2, 3), 'brooch': ('stone', 6, 7, 8), 'bglint': ('stone', 9),
        'bind': ('wool', 4, 5, 6), 'blood': ('code', '7'),
    }),
}
RUNA_MATS = dict(HILD_MATS)
RUNA_MATS.update({
    'hair': ('hair_brown', 1, 2, 3), 'plait': ('hair_brown', 1), 'brow': ('hair_brown', 1, 1, 2),
    'dress': ('bracken', 2, 3, 4), 'fold': ('bracken', 2), 'trim': ('wool', 2, 3, 4),
    'trouser': ('earth', 1, 2, 3),
})
for _key, _val in ARMS_MATS.items():
    RUNA_MATS.setdefault(_key, _val)


def sit_kneel():
    """Sitting back on the heels at the fire (Stage 10's residents): the kneel loop's first pose."""
    return anim_kneel()[:1] * 4


LAYER_NOTE = dict(LAYER_NOTE, **{
    'weapon': 'Weapon layer (Stage 9): in the right hand to fight, carried at rest otherwise, thrown down in\n# surrender and lying beside the dead; on a larger canvas round the same foot anchor.',
    'shield': 'Shield layer (Stage 9): a round shield on the left forearm, held up to block, slung on the back\n# at rest; on a larger canvas round the same foot anchor.',
    'blood': 'Bloodied layer (Book 7 section 12, Stage 9): drawn over the clothing below half vitality and on\n# the dead; the clothing darkens at the wound side. Only with the gore setting.',
})


def blood_layer(sep, facing, state):
    """The bloodied overlay: the clothing's pixels on the wound side (the figure's right flank and
    belly), darkened with dark, dried and a little fresh blood in clusters."""
    clothing = sep.get('clothing', {})
    pts = [(x, y) for (x, y), v in clothing.items()
           if v != INK and v[0].split('_far')[0] in ('tunic', 'trouser', 'dress', 'trim', 'sash', 'sashd')]
    if not pts:
        return {}
    xs = [x for x, _ in pts]
    ys = [y for _, y in pts]
    cx = (min(xs) + max(xs)) / 2
    top, bot = min(ys), max(ys)
    lying = state.startswith('dead') or state == 'downed' or state.startswith('piece_')
    out = {}
    for (x, y) in pts:
        t = (y - top) / max(1, bot - top)
        if lying:
            side = abs(x - (cx + 1)) < 5
        elif facing == 's':
            side = x <= cx
        elif facing == 'n':
            side = x >= cx
        elif facing == 'e':
            side = x >= cx - 1
        else:
            side = x <= cx + 1
        if not side or not (0.18 <= t <= 0.75 or lying):
            continue
        h = ((x * 73856093) ^ (y * 19349663)) % 100
        if h < 42:
            out[(x, y)] = ('blood_dry' if h < 9 else 'blood_fresh' if h > 38 else 'blood', 'm')
    return out


def render_character(ch, states, mats, order, names, sizes, soft):
    fights = {st for st, _, _, _ in fight_states(ch)} | {'stagger'}
    whole = isinstance(ch, Wrecker)
    sheets = {}
    for L, name in names.items():
        size, pivot = sizes.get(L, ((W, H), PIVOT))
        sheets[L] = Sheet(name, L, mats, size=size, pivot=pivot)
    for state, fn, ticks, loop in states:
        if isinstance(fn, Lying):
            for f in FACINGS:
                for i in range(fn.frames):
                    parts = settle_on_ground(lying_parts(ch, fn.kind, i))
                    if f in 'n w':
                        parts = mirror_parts(parts)
                    sep = separate(parts, order[f], soft)
                    if 'blood' in names:
                        sep['blood'] = blood_layer(sep, f, state)
                    close_outline(sep, [L for L in order[f] if L in names], sizes)
                    for L in names:
                        sheets[L].add(state, f, i, sep.get(L, {}))
        elif fn is not None:
            poses = fn()
            for f in FACINGS:
                for i, pose in enumerate(poses):
                    parts = fig(ch, f, pose, poses[i - 1])
                    # Cloth that reaches the ground lies on it: nothing below the sole row.
                    for part in parts:
                        part.px = {k: v for k, v in part.px.items() if k[1] <= OY + 46}
                    sep = separate(parts, order[f], soft)
                    if 'blood' in names:
                        sep['blood'] = blood_layer(sep, f, state)
                    if whole or state in fights:
                        close_outline(sep, [L for L in order[f] if L in names], sizes)
                    for L in names:
                        sheets[L].add(state, f, i, sep.get(L, {}))
        else:
            n = {'down': 2, 'carried': 6, 'sit': 4, 'sleep': 2, 'eat': 4}[state]
            for f in FACINGS:
                for i in range(n):
                    if state == 'eat':
                        parts = hild_eat(f, i)
                    elif state == 'sleep':
                        parts = sleeper(ch, i)
                        if f in 'n w':
                            parts = mirror_parts(parts)
                    elif state == 'down':
                        parts = hild_down(i)
                        if f in 'n w':
                            parts = mirror_parts(parts)
                    elif state == 'carried':
                        parts = hild_carried(f, i) if isinstance(ch, Hild) else body_carried(ch, f, i)
                    else:
                        parts = hild_sit(f, i)
                    if not CUR['braid']:
                        parts = [p for p in parts if p.name != 'braid']
                    sep = separate(parts, order[f], soft)
                    if 'blood' in names:
                        sep['blood'] = blood_layer(sep, f, state)
                    for L in names:
                        sheets[L].add(state, f, i, sep.get(L, {}))
    return sheets


def settle_on_ground(parts):
    """A lying figure rests on the ground: its lowest body or clothing row is the sole row (46), so
    its outline is on the pivot row, as a standing figure's feet are."""
    ys = [y for p in parts if p.layer in ('body', 'clothing') for (_, y) in p.px]
    if not ys:
        return parts
    dy = OY + 46 - max(ys)
    for p in parts:
        p.px = {(x, y + dy): v for (x, y), v in p.px.items() if y + dy <= OY + 46}
    return parts


def close_outline(sep, order_f, sizes):
    """Stage 9's frames: wherever the composite of the layers (in draw order) has a coloured pixel at
    its outer edge (a stump, a blade's tip, cloth meeting cloth), the layer that drew it gets the
    ink outline outside it, or, at the edge of its canvas, on it (Book 7 section 11)."""
    comp, owner = {}, {}
    for L in order_f:
        for pos, v in sep.get(L, {}).items():
            comp[pos] = v
            owner[pos] = L
    for (x, y), v in list(comp.items()):
        if v == INK:
            continue
        L = owner[(x, y)]
        (w, h), (px, py) = sizes.get(L, ((W, H), PIVOT))
        x0, y0 = OX + PIVOT[0] - px, OY + PIVOT[1] - py
        for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if n in comp:
                continue
            if x0 <= n[0] < x0 + w and y0 <= n[1] < y0 + h:
                sep.setdefault(L, {})[n] = INK
                comp[n] = INK
                owner[n] = L
            else:
                sep[L][(x, y)] = INK
                comp[(x, y)] = INK


def frames_of(state, fn):
    if isinstance(fn, Lying):
        return fn.frames
    if fn is not None:
        return len(fn())
    return {'down': 2, 'carried': 6, 'sit': 4, 'sleep': 2, 'eat': 4}[state]


ORDER_ARMED = {'s': ['body', 'clothing', 'blood', 'bow', 'cloak', 'helmet', 'weapon', 'shield'],
               'n': ['body', 'clothing', 'blood', 'cloak', 'bow', 'helmet', 'weapon', 'shield'],
               'e': ['body', 'clothing', 'blood', 'cloak', 'bow', 'helmet', 'weapon', 'shield'],
               'w': ['body', 'clothing', 'blood', 'cloak', 'bow', 'helmet', 'weapon', 'shield']}
HILD_ORDER_BLOOD = {f: ['body', 'clothing', 'blood'] for f in FACINGS}


def write_character(key):
    big = False
    if key == 'heavy':
        ch = Heavy()
        ch.helmet = True
        ch.arms = ()
        names = {'body': 'actor_heavy', 'clothing': 'layer_clothing_tunic_heavy',
                 'cloak': 'layer_cloak_wool_heavy', 'helmet': 'layer_helmet_iron_heavy',
                 'bow': 'layer_weapon_bow_heavy', 'blood': 'layer_blood_wound_heavy'}
        states = HEAVY_STATES + fight_states(ch, True)
        mats, order, events = HEAVY_MATS, ORDER_ARMED, STEERER_EVENTS
        poses = dict(WORK_POSES, **FIGHT_POSES)
        intro = INTRO['heavy']
    elif key in ('a', 'b'):
        ch = Steerer(MODEL_A if key == 'a' else MODEL_B)
        ch.helmet = True
        ch.arms = ('seax',)
        names = {'body': f'actor_p_steerer_{key}', 'clothing': f'layer_clothing_tunic_{key}',
                 'cloak': f'layer_cloak_wool_{key}', 'helmet': f'layer_helmet_iron_{key}',
                 'bow': f'layer_weapon_bow_{key}', 'weapon': f'layer_weapon_seax_{key}',
                 'blood': f'layer_blood_wound_{key}'}
        states = STEERER_STATES + fight_states(ch)
        mats, order, events = STEERER_MATS, ORDER_ARMED, STEERER_EVENTS
        poses = dict(WORK_POSES, **FIGHT_POSES)
        intro = INTRO['a'].format(L=key.upper())
    elif key == 'hild':
        ch = Hild()
        names = {'body': 'actor_c_hild', 'clothing': 'layer_clothing_dress_hild',
                 'blood': 'layer_blood_wound_hild'}
        states = HILD_STATES + [('stagger', lambda: anim_stagger(None), 9, False)]
        mats, order, events, poses = HILD_MATS, HILD_ORDER_BLOOD, HILD_EVENTS, HILD_POSES
        intro = INTRO['hild']
    elif key == 'runa':
        ch = Runa()
        names = {'body': 'actor_c_runa', 'clothing': 'layer_clothing_dress_runa',
                 'blood': 'layer_blood_wound_runa'}
        states = HILD_STATES + [('stagger', lambda: anim_stagger(None), 9, False)]
        mats, order, events, poses = RUNA_MATS, HILD_ORDER_BLOOD, HILD_EVENTS, HILD_POSES
        intro = INTRO_RESIDENT.format(name='Runa Asdisardottir (C_RUNA)')
        CUR.update(head=HEAD_RUNA, braid=False)
    elif key == 'thorkel':
        ch = Thorkel()
        names = {'body': 'actor_c_thorkel', 'clothing': 'layer_clothing_tunic_thorkel',
                 'cloak': 'layer_cloak_wool_thorkel'}
        # In the game he is only lying dead and carried; the sheet keeps a person's idle, walk and
        # run all the same (Book 7 section 01: every person's body sheet has them).
        moving = [s_ for s_ in STEERER_STATES if s_[0] in ('idle', 'walk', 'run')]
        states = moving + [('dead', Lying('dead', 1), 60, False), ('carried', None, 5, True)]
        mats, order, events = RESIDENT_MATS['thorkel'], ORDER_ARMED, 'walk 0, walk 3, run 0, run 4'
        poses = dict(WORK_POSES, dead='lying', carried='carried')
        intro = INTRO_RESIDENT.format(name='Thorkel Ketilsson (C_THORKEL), drowned; lying dead and carried in play')
    elif key in ('oddi', 'bran'):
        big = True
        set_canvas(True)
        heavy = key == 'bran'
        ch = Resident(MODEL_HEAVY if heavy else MODEL_B,
                      ('axe', 'shield') if heavy else ('seax',), cloak=False,
                      paint=('paint_a', 'paint_b'))
        ch.ladle = heavy
        nk = f'{key}_heavy' if heavy else key
        names = {'body': f'actor_c_{nk}', 'clothing': f'layer_clothing_tunic_{nk}',
                 'blood': f'layer_blood_wound_{nk}'}
        kind = 'axe' if heavy else 'seax'
        names['weapon'] = f'layer_weapon_{kind}_{nk}'
        if heavy:
            names['shield'] = f'layer_shield_round_{nk}'
        base = [s_ for s_ in (HEAVY_STATES if heavy else STEERER_STATES) if s_[0] != 'draw']
        states = base + fight_states(ch, heavy) + [('sit', sit_kneel, 18, True)]
        if not heavy:
            states += [('down', Lying('downed', 2), 40, True), ('carried', None, 5, True)]
        mats, order, events = RESIDENT_MATS[key], ORDER_ARMED, STEERER_EVENTS
        poses = dict(WORK_POSES, **FIGHT_POSES, sit='seated', down='lying', carried='carried')
        intro = INTRO_RESIDENT.format(name={'oddi': 'Oddi Gunnarsson (C_ODDI)', 'bran': 'Bran Gilla Brigte (C_BRAN), the heavy build'}[key])
    else:
        big = True
        set_canvas(True)
        if key == 'ketill':
            ch = Wrecker(MODEL_HEAVY, ('axe', 'shield'))
            heavy = True
        elif key == 'svart':
            ch = Wrecker(MODEL_SVART, ('spear', 'shield'))
            heavy = False
        else:
            ch = Wrecker(MODEL_B, ('seax', 'bow'), cloak=False)
            heavy = False
        # The leader is drawn on the heavy build: every sheet of his says so (Book 7 section 16).
        nk = f'{key}_heavy' if heavy else key
        names = {'body': f'actor_e_wrecker_{nk}', 'clothing': f'layer_clothing_wrecker_{nk}',
                 'blood': f'layer_blood_wound_{nk}'}
        if ch.cloak:
            names['cloak'] = f'layer_cloak_wrecker_{nk}'
        if 'bow' in ch.arms:
            names['bow'] = f'layer_weapon_bow_{nk}'
        if any(k in ch.arms for k in ('seax', 'axe', 'spear')):
            kind = [k for k in ch.arms if k in ('seax', 'axe', 'spear')][0]
            names['weapon'] = f'layer_weapon_{kind}_{nk}'
        if 'shield' in ch.arms:
            names['shield'] = f'layer_shield_round_{nk}'
        base = HEAVY_STATES if heavy else STEERER_STATES
        if 'bow' not in ch.arms:
            base = [s for s in base if s[0] != 'draw']
        states = base + fight_states(ch, heavy)
        mats, order, events = WRECKER_MATS[key], ORDER_ARMED, STEERER_EVENTS
        poses = dict(WORK_POSES, **FIGHT_POSES)
        intro = INTRO_WRECKER.format(name=key.capitalize())
    arms_size = ((CW, CH), (OX + PIVOT[0], OY + PIVOT[1]))
    sizes = {'bow': ((48, 56), (24, 51)) if not big else arms_size, 'weapon': arms_size, 'shield': arms_size}
    sheets = render_character(ch, states, mats, order, names, sizes, getattr(ch, 'soft', SOFT))
    anims = {}
    for state, fn, ticks, loop in states:
        anims[state] = (frames_of(state, fn), ticks, loop)
    os.makedirs(OUT, exist_ok=True)
    for L, sh in sheets.items():
        sh.intro = intro + f'\n# {LAYER_NOTE[L]}'
        if L == 'body':
            sh.shadow = '18x5' if (key == 'heavy' or key == 'ketill') else '16x5'
        with open(f'{OUT}/{sh.name}.map.txt', 'w') as fh:
            fh.write(sh.text(anims, events, poses))
    set_canvas(False)
    CUR.update(head=HEAD_HILD, braid=True, cloth='dress')
    return sheets, names


INTRO_WRECKER = """# {name}, one of the three wreck-scavengers (Stage 9, decision S9-11; Book 4 section 08, Chapter 1
# beat 3), on the 32 x 48 canvas with their own layers: an enemy drawn by Claude, proposed, staged
# for the user's approval; nothing here is read by the game. Generated by
# assets/art/authoring/people48.py; edit that script, not this map."""


INTRO_RESIDENT = """# {name}, found in Chapter 1's searches (Stage 10; Book 5 section 02), on the
# 32 x 48 canvas with their own layers: drawn by Claude, proposed, flagged for the user's review
# (decision DD-11). Generated by assets/art/authoring/people48.py; edit that script, not this map."""


def layers_json(name, layers):
    path = f'{REPO}/assets/art/proposed/{name}.layers.json'
    with open(path, 'w') as fh:
        fh.write(json.dumps({'name': name, 'layers': layers}, indent=2) + '\n')


def main():
    only = os.environ.get('PEOPLE_ONLY')
    keys = only.split(',') if only else ['a', 'b', 'heavy', 'hild', 'ketill', 'svart', 'conn',
                                          'oddi', 'bran', 'runa', 'thorkel']
    for key in keys:
        _, n = write_character(key)
        if key in ('a', 'b'):
            base = {f: [n[L] for L in ORDER_ARMED[f] if L in n and L not in ('helmet',)] for f in FACINGS}
            layers_json(f'steerer_{key}', base)
            layers_json(f'steerer_{key}_helmeted', {f: [n[L] for L in ORDER_ARMED[f] if L in n] for f in FACINGS})
        elif key == 'heavy':
            layers_json('heavy', {f: [n[L] for L in ORDER_ARMED[f] if L in n and L != 'helmet'] for f in FACINGS})
            layers_json('heavy_helmeted', {f: [n[L] for L in ORDER_ARMED[f] if L in n] for f in FACINGS})
        elif key == 'hild':
            layers_json('hild', {f: [n[L] for L in HILD_ORDER_BLOOD[f]] for f in FACINGS})
        elif key == 'runa':
            layers_json('runa', {f: [n[L] for L in HILD_ORDER_BLOOD[f]] for f in FACINGS})
        elif key in ('oddi', 'bran', 'thorkel'):
            layers_json(key, {f: [n[L] for L in ORDER_ARMED[f] if L in n] for f in FACINGS})
        else:
            layers_json(f'wrecker_{key}', {f: [n[L] for L in ORDER_ARMED[f] if L in n] for f in FACINGS})
    if CUT:
        for c in sorted(CUT):
            print('cut off by the canvas:', c)
        raise SystemExit(1)
    print('wrote the proposed people maps')


if __name__ == '__main__':
    main()

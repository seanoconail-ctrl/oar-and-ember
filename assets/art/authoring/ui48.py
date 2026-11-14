"""Proposed interface, particle and broch-door art for the 40 px people (Book 7 sections 01, 07, 10).

    python3 assets/art/authoring/ui48.py && node src/tools/art/proposed.ts

Writes drawn sheets to assets/art/proposed/sheets/ for the user's approval; nothing here is read by
the game yet. Everything is deterministic (seeded random only) and uses palette codes by ramp name.

Shapes are drawn as material letters, then shaded the way the material-map generator shades
(src/tools/art/materials.ts): an edge facing up or left takes the material's highlight, an edge
facing down or right its shadow, and a one-pixel ink outline goes round in-world sprites and props.
Interface pieces use carved-wood frames instead of an outline where the frame is the edge.
"""
import json
import math
import os
import random

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(REPO, 'assets', 'art', 'proposed', 'sheets')

with open(os.path.join(REPO, 'assets', 'palette', 'book07.json'), encoding='utf8') as f:
    _PAL = json.load(f)
RAMP = {}
for _e in _PAL['entries']:
    if 'ramp' in _e:
        RAMP.setdefault(_e['ramp'], {})[_e['step']] = _e['code']


def c(ramp, step):
    """A palette code by ramp name and step."""
    return RAMP[ramp][step]


INK = c('ink', 0)
INK1 = c('ink', 1)
T = '.'

# Three tones (shadow, base, highlight) per material, from the hue-shifted ramps.
MAT = {
    'I': (c('stone', 4), c('stone', 6), c('stone', 8)),        # iron
    'W': (c('bracken', 2), c('bracken', 3), c('bracken', 4)),  # ash and oak handles
    'D': (c('tar', 2), c('tar', 4), c('tar', 5)),              # tarred, dark timber
    'C': (c('wool', 2), c('wool', 4), c('wool', 6)),           # undyed cloth
    'R': (c('hair_blond', 1), c('hair_blond', 2), c('hair_blond', 4)),  # hemp rope
    'S': (c('hair_blond', 2), c('hair_blond', 4), c('hair_blond', 5)),  # barley seed
    'Q': (c('sea', 5), c('sea', 7), c('sea', 9)),              # water in a pail
    'B': (c('bracken', 4), c('hair_blond', 3), c('hair_blond', 4)),     # bread crust
    'M': (c('madder', 2), c('madder', 3), c('madder', 4)),     # madder binding
    'H': (c('driftwood', 4), c('driftwood', 5), c('driftwood', 7)),     # bone and antler
    'Y': (c('bracken', 3), c('bracken', 4), c('hair_blond', 3)),         # a yew bow stave
    'L': (c('wool', 5), c('wool', 5), c('wool', 6)),           # line and bowstring
    'F': (c('sky', 3), c('sky', 4), c('sky', 5)),              # frost, and goose fletching
    'K': (c('skin_light', 2), c('skin_light', 3), c('skin_light', 4)),  # skin
    'Z': (c('woad', 2), c('woad', 3), c('woad', 4)),           # woad cloth
}
# Marks: fixed codes drawn over the shading.
MARK = {
    '*': c('stone', 9),         # iron glint
    '+': c('sea', 10),          # water glint
    'k': INK,
    'x': c('bracken', 2),       # a score or a split
    'g': c('hair_blond', 5),    # seed glint
    'r': c('madder', 4),        # a fevered flush
    'v': c('weld', 4),          # a sprout, lit
    'V': c('weld', 2),          # a sprout's stem
    'e': c('skin_light', 1),    # a closed eyelid's lash
}


def blank(w, h, ch=T):
    return [[ch] * w for _ in range(h)]


def parse(rows):
    """ASCII art (one string per row) to a grid of material letters."""
    return [list(r) for r in rows]


def material_of(ch):
    if ch in MAT:
        return ch
    return None


def shade(g, base_of=None):
    """Material letters to palette codes, lit from the upper left. Marks keep their material for
    the shading of their neighbours when base_of maps them (mark -> material)."""
    h, w = len(g), len(g[0])
    base_of = base_of or {}

    def mat(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return None
        ch = g[y][x]
        return base_of.get(ch, ch) if ch != T else None

    out = blank(w, h)
    for y in range(h):
        for x in range(w):
            ch = g[y][x]
            if ch == T:
                continue
            if ch in MARK and ch not in MAT:
                out[y][x] = MARK[ch]
                continue
            if ch not in MAT:
                out[y][x] = ch  # already a palette code
                continue
            sh, base, hi = MAT[ch]
            m = ch
            if mat(x, y - 1) != m or mat(x - 1, y) != m:
                out[y][x] = hi
            elif mat(x, y + 1) != m or mat(x + 1, y) != m:
                out[y][x] = sh
            else:
                out[y][x] = base
    return out


def outline(g, code=INK, n=4):
    h, w = len(g), len(g[0])
    out = [row[:] for row in g]
    nb = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    if n == 8:
        nb += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    for y in range(h):
        for x in range(w):
            if g[y][x] != T:
                continue
            for dx, dy in nb:
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and g[yy][xx] != T:
                    out[y][x] = code
                    break
    return out


def paste(dst, src, ox, oy):
    for y, row in enumerate(src):
        for x, ch in enumerate(row):
            if ch != T and 0 <= oy + y < len(dst) and 0 <= ox + x < len(dst[0]):
                dst[oy + y][ox + x] = ch


def flip_x(g):
    return [list(reversed(r)) for r in g]


def flip_y(g):
    return [r[:] for r in reversed(g)]


def text(g):
    return '\n'.join(''.join(r) for r in g)


def check(g, w, h, name):
    assert len(g) == h, f'{name}: {len(g)} rows, want {h}'
    for r in g:
        assert len(r) == w, f'{name}: row of {len(r)}, want {w}'


def write_sheet(name, kind, w, h, pivot, footprint, anims, notes, shadow=None):
    """anims: list of (state, [frames], ticks, loop)."""
    lines = [f'# Generated by assets/art/authoring/ui48.py. Do not edit by hand: change the script and',
             '# run python3 assets/art/authoring/ui48.py.']
    lines += [f'# {n}' for n in notes]
    lines += [f'sheet: {name}', f'kind: {kind}', 'palette: book07', f'size: {w}x{h}',
              f'pivot: {pivot[0]},{pivot[1]}', f'footprint: {footprint[0]}x{footprint[1]}',
              'facings: -', 'placeholder: false']
    if shadow:
        lines.append(f'shadow: {shadow[0]}x{shadow[1]}')
    for state, frames, ticks, loop in anims:
        lines.append(f'anim.{state}: frames {len(frames)}, ticks {ticks}' + (', loop' if loop else ''))
    lines.append('')
    for state, frames, _, _ in anims:
        for i, fr in enumerate(frames):
            check(fr, w, h, f'{name} {state} {i}')
            lines += [f'frame {state} - {i}', text(fr), 'end', '']
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f'{name}.txt'), 'w', encoding='utf8') as f:
        f.write('\n'.join(lines))


def icon(rows, base_of=None, line=INK):
    g = parse(rows)
    return outline(shade(g, base_of), line)


def plot(g, x, y, ch):
    if 0 <= y < len(g) and 0 <= x < len(g[0]):
        g[y][x] = ch


# ---------------------------------------------------------------------------------------------
# ui_icons: 16 x 16 item icons
# ---------------------------------------------------------------------------------------------
IRON_EDGE = {'*': 'I'}

AXE = [
    '................',
    '.....II.........',
    '.....IIIIIIII*..',
    '.....IIIIIIII*..',
    '.....IIIIIIII*..',
    '.....II..IIII*..',
    '.....II...III*..',
    '.....WW...III*..',
    '.....WW....II*..',
    '.....WW....II*..',
    '.....WW.....I*..',
    '.....WW......*..',
    '....WW..........',
    '....WW..........',
    '....WW..........',
    '................',
]

SPADE = [
    '................',
    '.....WWWWWW.....',
    '.......WW.......',
    '.......WW.......',
    '.......WW.......',
    '.......WW.......',
    '.......WW.......',
    '....WWWWWWWW....',
    '....WWWWWWWW....',
    '....WWWWWWWW....',
    '....WWWWWWWW....',
    '....IIIIIIII....',
    '....IIIIIIII....',
    '.....IIIIII.....',
    '......*III......',
    '................',
]

SEED_BAG = [
    '................',
    '....CC....CC....',
    '.....CC..CC.....',
    '......CCCC......',
    '......RRRR......',
    '.....CCCCCC.....',
    '....CCCCCCCC....',
    '...CCCCCCCCCC...',
    '..CCCvCCCvCCCC..',
    '..CCCCvCvCCCCC..',
    '..CCCCCVCCCCCC..',
    '..CCCCCVCCCCCC..',
    '...CCCCCCCCCC...',
    '....CCCCCCCC.S..',
    '...........S.S..',
    '................',
]

PAIL = [
    '................',
    '......IIII......',
    '....II....II....',
    '...I........I...',
    '...I........I...',
    '..WWWWWWWWWWWW..',
    '..WQQQQQQQQQQW..',
    '..WWWWWWWWWWWW..',
    '...IIIIIIIIII...',
    '...WWxWWxWWxW...',
    '...WWxWWxWWxW...',
    '...WWxWWxWWxW...',
    '...IIIIIIIIII...',
    '....WxWWxWWxW...',
    '....WWWWWWWWW...',
    '................',
]

HAMMER = [
    '................',
    '................',
    '..IIIIIIIII.....',
    '..IIIIIIIIIII...',
    '..IIIIIIIIIIIII.',
    '..IIIIIIIII.....',
    '......WW........',
    '......WW........',
    '......WW........',
    '......WW........',
    '......WW........',
    '......WW........',
    '......WW........',
    '......WW........',
    '......WW........',
    '................',
]

SEAX = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......IIII.....',
    '.....IIIIIII....',
    '.DDDDIIIIIIII...',
    '.DDDDIIIIIIIII..',
    '.DDDDI*********.',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
]


def sickle():
    g = blank(16, 16)
    cx, cy, ro = 8.0, 7.5, 6.2
    for y in range(16):
        for x in range(16):
            dx, dy = x + .5 - cx, y + .5 - cy
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx))  # 0 right, 90 down, -90 up
            # From the root at the bottom (100) round by the right and the top to the tip (-160).
            if a > 100:
                continue
            if a < -165:
                continue
            u = (100 - a) / 265  # 0 at the root, 1 at the tip
            t = 2.6 - 1.9 * u
            if ro - t <= r <= ro:
                g[y][x] = 'I'
    # The inner edge is the cutting edge: a bright line.
    for y in range(16):
        for x in range(16):
            if g[y][x] == 'I':
                dx, dy = x + .5 - cx, y + .5 - cy
                inx, iny = x - round(dx / max(1e-6, math.hypot(dx, dy))), y - round(dy / max(1e-6, math.hypot(dx, dy)))
                if 0 <= inx < 16 and 0 <= iny < 16 and g[iny][inx] == T:
                    g[y][x] = '*'
    # The handle runs down and left from the root.
    for i, (x, y) in enumerate([(6, 13), (5, 13), (5, 14), (4, 14), (6, 12), (7, 12)]):
        g[y][x] = 'W'
    g[13][6] = 'M'
    g[12][6] = 'M'
    return outline(shade(g, IRON_EDGE))


def fishing():
    g = blank(16, 16)
    # The rod: a staircase from the butt (bottom left) to the tip (top right).
    pts = [(2, 14), (3, 13), (3, 12), (4, 12), (5, 11), (5, 10), (6, 10), (7, 9), (7, 8), (8, 8),
           (9, 7), (9, 6), (10, 6), (11, 5), (11, 4), (12, 3), (12, 2)]
    for x, y in pts:
        g[y][x] = 'W'
    for x, y in [(1, 14), (2, 13), (3, 14)]:
        g[y][x] = 'W'
    for x, y in [(2, 13), (3, 12)]:
        g[y][x] = 'R'
    # The line hangs from the tip in a slack curve to the hook.
    for x, y in [(13, 2), (14, 3), (14, 4), (14, 5), (14, 6), (13, 7)]:
        g[y][x] = 'L'
    # A J-shaped iron hook with its barb.
    for x, y in [(13, 8), (13, 9), (13, 10), (13, 11), (12, 12), (11, 12), (10, 11), (10, 10),
                 (10, 9), (11, 10)]:
        g[y][x] = 'I'
    g[8][13] = '*'
    g[9][10] = '*'
    return outline(shade(g, IRON_EDGE))


def spear():
    g = blank(16, 16)
    # Shaft from bottom left towards the top right, two pixels thick.
    for i in range(10):
        x, y = 1 + i, 14 - i
        g[y][x] = 'W'
        if i < 9:
            g[y][x + 1] = 'W'
    # Socket ring.
    for x, y in [(10, 5), (11, 5), (10, 4)]:
        g[y][x] = 'I'
    # A long leaf-shaped head along the diagonal.
    ux, uy = 1 / math.sqrt(2), -1 / math.sqrt(2)
    cx, cy = 12.2, 3.6
    for y in range(16):
        for x in range(16):
            dx, dy = x + .5 - cx, y + .5 - cy
            along = dx * ux + dy * uy
            across = -dx * uy + dy * ux
            half = 1.9 * (1 - (along / 3.4) ** 2) if abs(along) < 3.4 else -1
            if abs(across) <= half:
                g[y][x] = 'I'
    # The midrib catches the light.
    for x, y in [(11, 4), (12, 3), (13, 2)]:
        if g[y][x] == 'I':
            g[y][x] = '*'
    return outline(shade(g, IRON_EDGE))


def bow():
    g = blank(16, 16)
    cx, cy, rx, ry = 11.0, 7.5, 6.0, 7.0
    for y in range(16):
        for x in range(16):
            dx, dy = (x + .5 - cx), (y + .5 - cy)
            if dx > 0.3:
                continue
            e = math.hypot(dx / rx, dy / ry)
            t = 0.36 - 0.20 * abs(dy) / ry  # thick at the grip, thin at the tips
            if 1 - t <= e <= 1.0 + 0.04:
                g[y][x] = 'Y'
    # The string from tip to tip.
    for y in range(1, 15):
        if g[y][11] == T:
            g[y][11] = 'L'
    # Grip binding.
    for y in (7, 8):
        for x in range(16):
            if g[y][x] == 'Y':
                g[y][x] = 'M'
    # Horn nocks at the tips.
    g[0][10] = T
    return outline(shade(g))


def arrow():
    """Arrows: two arrows crossed low, fletched in grey goose bound with madder, iron heads."""
    g = blank(16, 16)
    for (x0, y0, dx) in [(2, 13, 1), (13, 13, -1)]:
        for i in range(11):
            x, y = x0 + dx * i, y0 - i
            g[y][x] = 'S' if i < 9 else '*'
        # The head: a small leaf of iron round the point.
        hx, hy = x0 + dx * 10, y0 - 10
        g[hy + 1][hx] = 'I'
        g[hy][hx - dx] = 'I'
        # Fletching either side of the tail, and the thread binding it.
        for k in range(3):
            fx, fy = x0 + dx * k, y0 - k
            if 0 <= fx - dx < 16:
                g[fy - 1][fx] = 'F' if g[fy - 1][fx] == T else g[fy - 1][fx]
            if 0 <= fy + 1 < 16 and 0 <= fx + dx < 16:
                g[fy][fx + dx] = 'F' if g[fy][fx + dx] == T else g[fy][fx + dx]
        g[y0 - 3][x0 + dx * 3] = 'M'
    out = shade(g, {'*': 'I'})
    return outline(out)


def bread():
    g = blank(16, 16)
    cx, cy, rx, ry = 7.8, 8.6, 6.4, 5.4
    for y in range(16):
        for x in range(16):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                g[y][x] = 'B'
    # Three slashed scores across the dome.
    for x0, y0 in [(4, 9), (7, 7), (10, 6)]:
        for k in range(3):
            if g[y0 + 2 - k][x0 + k] == 'B':
                g[y0 + 2 - k][x0 + k] = 'x'
    out = shade(g, {'x': 'B'})
    # The underside, baked darker.
    for y in range(16):
        for x in range(16):
            if g[y][x] != T and (y + 1 >= 16 or g[y + 1][x] == T or (y + 2 < 16 and g[y + 2][x] == T)):
                out[y][x] = c('bracken', 3) if out[y][x] != c('hair_blond', 4) else out[y][x]
    # Flour dust on the lit top.
    for x, y in [(5, 5), (8, 4), (6, 4)]:
        if g[y][x] != T:
            out[y][x] = c('wool', 6)
    return outline(out)


def rope():
    g = blank(16, 16)
    cx, cy = 8.0, 8.6
    out = blank(16, 16)
    for y in range(16):
        for x in range(16):
            dx, dy = (x + .5 - cx) / 6.6, (y + .5 - cy) / 5.0
            r = math.hypot(dx, dy)
            if r > 1:
                continue
            ring = r * 3.0  # three turns visible
            frac = ring - math.floor(ring)
            if r < 0.24:
                out[y][x] = INK1  # the hole in the middle of the coil
                g[y][x] = 'R'
                continue
            g[y][x] = 'R'
            sh, base, hi = MAT['R']
            # Each turn is a rounded strand: lit on its upper-left side, a dark seam between turns.
            if frac < 0.22:
                out[y][x] = c('hair_blond', 0)
            elif frac < 0.55:
                out[y][x] = hi if (dx + dy) < 0.2 else base
            else:
                out[y][x] = base if (dx + dy) < 0.2 else sh
            # The lay of the twist: short diagonal strokes.
            if frac >= 0.22 and (x * 2 + y) % 5 == 0:
                out[y][x] = sh if out[y][x] != hi else base
    # The loose end trailing to the right and down.
    for x, y in [(13, 11), (14, 12), (14, 13), (13, 14)]:
        out[y][x] = c('hair_blond', 2)
    out[13][14] = c('hair_blond', 4)
    return outline(out)


def icons():
    def ic(rows, **kw):
        return icon(rows, IRON_EDGE, **kw)

    seed = parse(SEED_BAG)
    seed_out = outline(shade(seed, {'g': 'S', 'v': 'C', 'V': 'C'}))
    pail = outline(shade(parse(PAIL), {'x': 'W'}))
    # A glint on the water.
    pail[6][4] = MARK['+']
    pail[6][5] = MARK['+']
    hammer = ic(HAMMER)
    hammer[3][2] = MARK['*']
    hammer[2][3] = MARK['*']
    seax = ic(SEAX)
    # The fuller groove along the blade.
    for x in range(6, 11):
        seax[7][x] = c('stone', 5)
    # A brass ferrule between grip and blade, and a brass pommel cap.
    for y in (7, 8, 9):
        seax[y][5] = c('beak', 1)
        seax[y][1] = c('beak', 0)
    seax[7][5] = c('beak', 2)
    axe = ic(AXE)
    sets = [
        ('axe', axe), ('spade', ic(SPADE)), ('sickle', sickle()), ('seed_bag', seed_out),
        ('pail', pail), ('hammer', hammer), ('fishing_line', fishing()), ('spear', spear()),
        ('bow', bow()), ('seax', seax), ('bread', bread()), ('rope', rope()),
        ('arrow', arrow()),
    ]
    write_sheet('ui_icons', 'decal', 16, 16, (8, 8), (16, 16),
                [(n, [g], 1, False) for n, g in sets],
                ['Hotbar and inventory item icons, 16 x 16, one state per item (Book 7 section 10).',
                 'Counts are drawn with ui_digits (state count) at the slot\'s lower right.'])
    return dict(sets)


# ---------------------------------------------------------------------------------------------
# ui_digits: slot keys and counts, 3 x 5 numerals with a frame of ink
# ---------------------------------------------------------------------------------------------
DIGITS = {
    '0': ['###', '#.#', '#.#', '#.#', '###'],
    '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['##.', '..#', '.#.', '#..', '###'],
    '3': ['##.', '..#', '.#.', '..#', '##.'],
    '4': ['#.#', '#.#', '###', '..#', '..#'],
    '5': ['###', '#..', '##.', '..#', '##.'],
    '6': ['.##', '#..', '###', '#.#', '###'],
    '7': ['###', '..#', '.#.', '.#.', '.#.'],
    '8': ['###', '#.#', '.#.', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '##.'],
    '-': ['...', '...', '###', '...', '...'],
    '=': ['...', '###', '...', '###', '...'],
}
KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=']


def digit(ch, fill, shadow, frame):
    g = blank(5, 7)
    for y, row in enumerate(DIGITS[ch]):
        for x, p in enumerate(row):
            if p == '#':
                g[y + 1][x + 1] = fill
    if frame == 'outline':
        return outline(g, INK, 8)
    if frame == 'none':
        return g
    # Key numerals: a drop shadow down and right, cut into the wood.
    out = [r[:] for r in g]
    for y in range(7):
        for x in range(5):
            if g[y][x] != T:
                for dx, dy in ((1, 0), (0, 1), (1, 1)):
                    if x + dx < 5 and y + dy < 7 and g[y + dy][x + dx] == T:
                        out[y + dy][x + dx] = shadow
    return out


def digits():
    keys = [outline(digit(k, c('wool', 5), INK, 'none'), INK, 4) for k in KEYS]
    keys_lit = [outline(digit(k, c('fire', 7), INK, 'none'), INK, 4) for k in KEYS]
    counts = [digit(str(i), c('wool', 6), INK, 'outline') for i in range(10)]
    write_sheet('ui_digits', 'decal', 5, 7, (0, 0), (5, 7),
                [('key', keys, 1, False), ('key_selected', keys_lit, 1, False),
                 ('count', counts, 1, False)],
                ['Pixel numerals, 3 x 5 inside a 5 x 7 cell, drawn at the cell\'s top left (pivot 0,0).',
                 'key / key_selected: the slot keys 1 2 3 4 5 6 7 8 9 0 - = (frames 0 to 11), bone or',
                 'firelight gold in a rounded ink outline; count: digits 0 to 9 in a full ink box, for',
                 'item counts over the icon (step 4 px per digit).'])
    return keys, keys_lit, counts


# ---------------------------------------------------------------------------------------------
# ui_hotbar: the carved-wood strip
# ---------------------------------------------------------------------------------------------
SW, SH = 22, 30   # frame size; a slot is 22 wide (its pitch) and 26 tall, sitting on the bottom
BEAM = 26         # the strip's height
LIFT = 4          # how far the selected slot rises
WOOD = [c('tar', 1), c('tar', 2), c('tar', 3), c('tar', 4), c('tar', 5), c('bracken', 3),
        c('bracken', 4)]
WELL = (2, 4, 19, 21)  # x0, y0, x1, y1 of the 18 x 18 well inside a 26-row slot


def grain(g, x0, y0, x1, y1, seed):
    """Long, thin streaks of darker grain along the beam."""
    rnd = random.Random(seed)
    for y in range(y0, y1 + 1):
        run = rnd.randint(0, 9)
        for x in range(x0, x1 + 1):
            run += 1
            if run % 13 in (0, 1, 2, 3) and (y * 5 + x // 13) % 3 == 0 and g[y][x] == WOOD[3]:
                g[y][x] = WOOD[2]


def cable(g, y0, x0, x1):
    """A twisted-rope moulding, three rows tall: diagonal strokes lit on their upper left."""
    tones = [WOOD[5], WOOD[3], WOOD[1]]
    for dy in range(3):
        for x in range(x0, x1 + 1):
            g[y0 + dy][x] = tones[(x + dy) % 3]


def beam(w, seed):
    """A plain run of the strip: ink edges, a lit bead along the top, the cable along the foot."""
    g = blank(w, BEAM, WOOD[3])
    for x in range(w):
        g[0][x] = INK
        g[1][x] = WOOD[6]
        g[2][x] = WOOD[5]
        g[3][x] = WOOD[4]
        g[BEAM - 5][x] = WOOD[2]
        g[BEAM - 1][x] = INK
    grain(g, 0, 4, w - 1, BEAM - 6, seed)
    cable(g, BEAM - 4, 0, w - 1)
    return g


def slot_body(selected):
    """A 22 x 26 slot: a run of the beam with a sunken well for the icon."""
    g = beam(SW, 3)
    wx0, wy0, wx1, wy1 = WELL
    for y in range(wy0, wy1 + 1):
        for x in range(wx0, wx1 + 1):
            g[y][x] = c('ink', 1)
    # The floor: a cool, calm dark so every icon's light fill stands off it.
    for y in range(wy0 + 2, wy1):
        for x in range(wx0 + 2, wx1):
            g[y][x] = c('stone', 1)
    # The well is sunk: its top and left walls in shadow, its lower and right lips lit.
    for x in range(wx0, wx1 + 1):
        g[wy0][x] = INK
        g[wy1][x] = WOOD[5]
    for y in range(wy0, wy1 + 1):
        g[y][wx0] = INK
        g[y][wx1] = WOOD[4]
    g[wy1][wx0] = WOOD[1]
    g[wy0][wx1] = WOOD[1]
    g[wy1][wx1] = WOOD[6]
    # The post between wells: a carved groove down the join, with a peg at mid height.
    for y in range(4, BEAM - 5):
        g[y][0] = WOOD[4]
        g[y][SW - 1] = WOOD[1]
    for x, y, ch in [(0, 11, WOOD[6]), (0, 12, WOOD[5]), (0, 13, WOOD[2]),
                     (SW - 1, 11, WOOD[5]), (SW - 1, 12, WOOD[2]), (SW - 1, 13, INK)]:
        g[y][x] = ch
    if selected:
        rim, rim2, rim3 = c('fire', 7), c('fire', 6), c('fire', 5)
        for x in range(wx0 - 1, wx1 + 2):
            g[wy0 - 1][x] = rim2
            g[wy1 + 1][x] = rim3
        for y in range(wy0 - 1, wy1 + 2):
            g[y][wx0 - 1] = rim2
            g[y][wx1 + 1] = rim3
        g[wy0 - 1][wx0 - 1] = rim
        g[wy0 - 1][wx0] = rim
        g[wy0][wx0 - 1] = rim
        # The well's inner walls warm in the selection's light; its floor stays calm and dark
        # so the icon keeps its contrast.
        for x in range(wx0 + 1, wx1):
            g[wy0 + 1][x] = c('fire', 1)
        for y in range(wy0 + 1, wy1):
            g[y][wx0 + 1] = c('fire', 1)
        # Ink round the raised block, so it stands proud of the strip.
        for y in range(BEAM):
            g[y][0] = INK if y not in range(wy0 - 1, wy1 + 2) else g[y][0]
            g[y][SW - 1] = INK if y not in range(wy0 - 1, wy1 + 2) else g[y][SW - 1]
    return g


def slot_frame(selected):
    g = blank(SW, SH)
    paste(g, slot_body(False), 0, LIFT)
    if not selected:
        return g
    paste(g, slot_body(True), 0, 0)
    # Under the raised slot the strip's socket shows, in its shadow.
    for x in range(SW):
        g[BEAM][x] = INK
        for y in range(BEAM + 1, SH - 1):
            g[y][x] = WOOD[0] if (x + y) % 3 else WOOD[1]
        g[SH - 1][x] = INK
    return g


def cap():
    """The strip's left end: a raised end-post with a rounded head and a carved spiral boss, like
    the stem of a boat. The beam joins it on the right (x 21)."""
    g = blank(SW, SH)
    mask = [[0] * SW for _ in range(SH)]
    top = 0
    for y in range(SH):
        for x in range(SW):
            in_beam = x >= 10 and y >= LIFT
            # The post: x 2 to 17, rows 0 to 29, its outer corners rounded with radius 7.
            px0, px1, r = 2, 17, 7.0
            in_post = px0 <= x <= px1 and top <= y < SH
            if in_post:
                cxr = px0 + r if x < px0 + r else None
                if cxr is not None and y < top + r and math.hypot(x + .5 - cxr, y + .5 - (top + r)) > r:
                    in_post = False
                if cxr is not None and y >= SH - r and math.hypot(x + .5 - cxr, y + .5 - (SH - r)) > r:
                    in_post = False
                cxr2 = px1 + 1 - r
                if x >= cxr2 and y < top + r and math.hypot(x + .5 - cxr2, y + .5 - (top + r)) > r and y < LIFT + 1:
                    in_post = False
            if in_beam or in_post:
                mask[y][x] = 1
    # Shade the post: lit on its upper-left rim, shadowed on its lower-right.
    for y in range(SH):
        for x in range(SW):
            if not mask[y][x]:
                continue
            up = y > 0 and mask[y - 1][x]
            left = x > 0 and mask[y][x - 1]
            down = y < SH - 1 and mask[y + 1][x]
            right = x < SW - 1 and mask[y][x + 1]
            if not up or not left:
                g[y][x] = WOOD[6] if not up and not left else WOOD[5]
            elif not down or (not right and x < SW - 1):
                g[y][x] = WOOD[1]
            else:
                g[y][x] = WOOD[3]
    # Second rim tones, for a rounded, carved edge.
    for y in range(SH):
        for x in range(SW):
            if mask[y][x] and g[y][x] == WOOD[3]:
                if (y > 1 and not mask[y - 2][x]) or (x > 1 and not mask[y][x - 2]):
                    g[y][x] = WOOD[4]
                elif (y < SH - 2 and not mask[y + 2][x]):
                    g[y][x] = WOOD[2]
    # The beam's own mouldings run in to the post.
    for x in range(14, SW):
        g[LIFT + 1][x] = WOOD[6]
        g[LIFT + 2][x] = WOOD[5]
        g[LIFT + 3][x] = WOOD[4]
        g[LIFT + BEAM - 5][x] = WOOD[2]
    cable(g, LIFT + BEAM - 4, 14, SW - 1)
    for y in range(LIFT + 1, SH - 1):
        g[y][17] = WOOD[1] if g[y][17] not in (INK,) else g[y][17]
        g[y][18] = WOOD[4]
    # A carved spiral boss on the post: a ring groove, and a spiral cut winding in to a dot.
    cx, cy = 9.5, 14.5
    for y in range(SH):
        for x in range(SW):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            a = math.atan2(y + .5 - cy, x + .5 - cx)
            if 5.0 <= d < 6.0:
                g[y][x] = INK if a > -2.4 and a < 0.8 or True else g[y][x]
            elif 6.0 <= d < 6.9 and mask[y][x]:
                # The boss's outer lip: lit below-right (the groove's far wall), dark above-left.
                g[y][x] = WOOD[6] if (x + .5 - cx) + (y + .5 - cy) > 0 else WOOD[2]
            elif d < 5.0:
                g[y][x] = WOOD[4] if (x + .5 - cx) + (y + .5 - cy) < -1 else WOOD[3]
                # The spiral cut: r grows with the angle.
                turn = ((a + math.pi) / (2 * math.pi))
                rr = 1.2 + 3.4 * turn
                if abs(d - rr) < 0.55:
                    g[y][x] = INK
                elif abs(d - rr - 0.9) < 0.45 and d < 4.8:
                    g[y][x] = WOOD[5]
    g[14][9] = INK
    g[15][9] = INK1
    out = outline(g, INK)
    # No outline across the join with the beam.
    return out


def hotbar():
    normal = slot_frame(False)
    sel = slot_frame(True)
    left = cap()
    right = flip_x(left)
    write_sheet('ui_hotbar', 'decal', SW, SH, (11, SH - 1), (SW, SH),
                [('slot', [normal], 1, False), ('slot_selected', [sel], 1, False),
                 ('cap_left', [left], 1, False), ('cap_right', [right], 1, False)],
                ['The hotbar strip (Book 7 section 10): 12 slots on a 22 px pitch between two caps,',
                 'every frame 22 x 30 with the pivot at its bottom centre (the screen\'s bottom edge).',
                 'slot: the strip is rows 4 to 29; its 18 x 18 well is at (2,8) and the 16 x 16 icon',
                 'area at (3,9). slot_selected: the slot raised 4 px (rows 0 to 25) with a gold rim,',
                 'icon area at (3,5). Slot keys (ui_digits key / key_selected) at (0,3) of the slot',
                 'body; counts (ui_digits count) sit with their last digit\'s cell at the icon area\'s',
                 'lower right. The caps are carved end-posts with a spiral boss; cap_right is',
                 'cap_left mirrored.'])
    return normal, sel, left, right


# ---------------------------------------------------------------------------------------------
# ui_cursor: the target tile, valid and out of reach
# ---------------------------------------------------------------------------------------------
CUR = 28        # canvas; the 24 x 24 tile's top-left is at (2,2), its centre (the pivot) at (14,14)
HL = c('fire', 6)       # the interactive highlight (Book 7 section 13): firelight on bone
HL_HI = c('fire', 7)
HL_LO = c('fire', 4)


def cursor_valid(phase):
    g = blank(CUR, CUR)
    a, b = 2, CUR - 3   # the tile's edge pixels
    # The faint fill: a soft band of light just inside the rim (every other pixel), and a second,
    # sparser band inside that; the middle stays clear so the ground being worked shows.
    for y in range(a + 1, b):
        for x in range(a + 1, b):
            d = min(x - a, b - x, y - a, b - y)
            if d == 1 and (x + y) % 2 == 0:
                g[y][x] = HL_LO
            elif d == 2 and (x + y) % 4 == 1 and phase == 1:
                g[y][x] = HL_LO
    # The one-pixel rim, with ink just outside it so it reads on pale sand.
    rim = HL if phase == 0 else HL_HI
    for i in range(a, b + 1):
        g[a][i] = rim
        g[b][i] = rim
        g[i][a] = rim
        g[i][b] = rim
    for i in range(a - 1, b + 2):
        for x, y in [(i, a - 1), (i, b + 1), (a - 1, i), (b + 1, i)]:
            g[y][x] = INK1
    # Corner ticks: the rim doubled inwards for a few pixels at each corner, longer on the pulse.
    n = 5 + phase
    tick = HL_HI
    for sx, sy, x0, y0 in [(1, 1, a, a), (-1, 1, b, a), (1, -1, a, b), (-1, -1, b, b)]:
        for i in range(n):
            g[y0 + sy][x0 + sx * i] = tick if i < n - 1 else rim
            g[y0 + sy * i][x0 + sx] = tick if i < n - 1 else rim
            g[y0][x0 + sx * i] = tick
            g[y0 + sy * i][x0] = tick
        # Ink inside the tick's end, so the bracket has a clean edge.
        g[y0 + 2 * sy][x0 + 2 * sx] = INK1
        # The outer corner is notched with ink, a carved look.
        g[y0 - sy][x0 - sx] = T
    return g


def cursor_reach():
    g = blank(CUR, CUR)
    a, b = 2, CUR - 3
    red, red_hi = c('madder', 4), c('madder', 5)
    # Dimmed: a sparse diamond lattice of shade over the tile.
    for y in range(a + 1, b):
        for x in range(a + 1, b):
            if y % 2 == 0 and (x - y) % 4 == 0:
                g[y][x] = c('ink', 1)
    # A broken red edge: dashes three pixels long with two-pixel gaps, each backed with ink.
    for i in range(a, b + 1):
        if ((i - a) % 5) >= 3:
            continue
        for x, y, ox, oy in [(i, a, 0, -1), (i, b, 0, 1), (a, i, -1, 0), (b, i, 1, 0)]:
            g[y][x] = red_hi if (oy == -1 or ox == -1) else red
            g[y + oy][x + ox] = INK
            if g[y - oy][x - ox] == T:
                g[y - oy][x - ox] = INK1
    # The corner ticks stay, dimmed to grey.
    grey = c('smoke', 3)
    for sx, sy, x0, y0 in [(1, 1, a, a), (-1, 1, b, a), (1, -1, a, b), (-1, -1, b, b)]:
        for i in range(4):
            g[y0][x0 + sx * i] = grey if i < 3 else g[y0][x0 + sx * i]
            g[y0 + sy * i][x0] = grey if i < 3 else g[y0 + sy * i][x0]
            if i < 3:
                g[y0 + sy][x0 + sx * i] = c('smoke', 1)
                g[y0 + sy * i][x0 + sx] = c('smoke', 1)
        g[y0 - sy][x0 - sx] = T
    return g


GLYPHS = {
    'axe': ['........', '.UUUUU..', '.UUUUUU.', '.U..UUU.', '.U...UU.', '.U....U.', '.U......', '........'],
    'spade': ['........', '..UUUU..', '...UU...', '...UU...', '..UUUU..', '..UUUU..', '...UU...', '........'],
    'seed': ['........', '.UU.....', '.....U..', '.....U..', '........', '..UU....', '........', '........'],
    'pail': ['........', '..UUUU..', '.U....U.', '.UUUUUU.', '.UUUUUU.', '..uuuu..', '..UUUU..', '........'],
    'hammer': ['........', '.UUUUU..', '.UUUUUU.', '...UU...', '...UU...', '...UU...', '...UU...', '........'],
    'hook': ['........', '....U...', '....U...', '....U...', '.U..U...', '.UU.U...', '..UU....', '........'],
    'sword': ['........', '...U....', '...U....', '...U....', '...U....', '.UUUUU..', '...U....', '........'],
}


def glyphs():
    MAT['U'] = (c('wool', 4), c('wool', 6), c('wool', 6))
    MARK['u'] = c('wool', 3)
    out = []
    for name, rows in GLYPHS.items():
        g = shade(parse(rows), {'u': 'U'})
        g = outline(g, INK, 4)
        out.append((name, [g], 1, False))
    write_sheet('ui_cursor_glyph', 'decal', 8, 8, (0, 0), (8, 8), out,
                ['The selected tool\'s action, shown at the target tile\'s upper right corner',
                 '(Book 7 section 10): bone silhouettes in an ink outline, 8 x 8, pivot at the top',
                 'left. Place each at the tile\'s (18,-4) so it overhangs the corner.'])


def cursor():
    write_sheet('ui_cursor', 'decal', CUR, CUR, (14, 14), (24, 24),
                [('valid', [cursor_valid(0), cursor_valid(1)], 24, True),
                 ('reach', [cursor_reach()], 1, False)],
                ['The target tile (Book 7 section 10), 28 x 28 round a 24 x 24 tile whose top left is',
                 'at (2,2); pivot at the tile\'s centre. valid: a one-pixel firelight rim with ink',
                 'outside it, corner ticks and a faint fill that is densest at the edge; frame 1',
                 'brightens the rim and lets the ticks breathe out a pixel (a slow pulse). reach:',
                 'out of reach, dimmed, its edge broken into red dashes (a shape cue, not colour',
                 'alone) and its ticks grey. The refusal word is overlay text.'])


# ---------------------------------------------------------------------------------------------
# ui_aim: aim-line dots, the end cross and the melee facing arrow
# ---------------------------------------------------------------------------------------------
AIM = 11


def centred(rows, n=AIM):
    g = blank(n, n)
    h, w = len(rows), len(rows[0])
    oy, ox = (n - h) // 2, (n - w) // 2
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                g[oy + y][ox + x] = ch
    return g


def aim():
    MAT['A'] = (c('fire', 5), c('fire', 6), c('fire', 7))
    MAT['P'] = (c('wool', 4), c('wool', 6), c('wool', 6))
    dots = [
        outline(shade(centred(['P'])), INK, 4),
        outline(shade(centred(['PP', 'PP'])), INK, 4),
        outline(shade(centred(['.PP.', 'PPPP', 'PPPP', '.PP.'])), INK, 4),
    ]
    cross0 = ['..P..', '..P..', 'PP.PP', '..P..', '..P..']
    cross1 = ['...P...', '...P...', '.......', 'PP...PP', '.......', '...P...', '...P...']
    crosses = [outline(shade(centred(cross0)), INK, 4), outline(shade(centred(cross1)), INK, 4)]
    s = ['AAAAAAA', '.AAAAA.', '..AAA..', '...A...']
    e = ['A....', 'AAA..', 'AAAAA', 'AAA..', 'A....']
    arrows = {
        's': s, 'n': list(reversed(s)), 'e': e, 'w': [r[::-1] for r in e],
    }
    anims = [('dot', dots, 1, False), ('cross', crosses, 12, True)]
    for f, rows in arrows.items():
        anims.append((f'facing_{f}', [outline(shade(centred(rows)), INK, 4)], 1, False))
    write_sheet('ui_aim', 'decal', AIM, AIM, (5, 5), (AIM, AIM), anims,
                ['Aiming (Book 7 section 10), 11 x 11 frames centred on the pivot. dot: the aim',
                 'line\'s dots, frames 0 to 2 as the draw grows (spaced wider by the code); cross:',
                 'the line\'s end, a two-frame pulse; facing_s/n/e/w: the melee facing arrow laid',
                 'flat on the ground, drawn 14 px from the feet in its direction (8 px for n).'])


# ---------------------------------------------------------------------------------------------
# ui_stamina: the bar's pieces and its reason icons
# ---------------------------------------------------------------------------------------------
BW, BH = 8, 9
FILL = (c('trefoil', 1), c('trefoil', 2), c('trefoil', 3), c('trefoil', 4))  # shadow .. glint


def bar_column(kind):
    """One column of a column-uniform piece, top to bottom (BH rows)."""
    if kind == 'frame':
        return [INK, WOOD[6], INK, c('stone', 1), c('stone', 1), c('stone', 1), c('stone', 2),
                WOOD[2], INK]
    if kind == 'frame_flash':
        return [INK, c('fire', 7), INK, c('stone', 1), c('stone', 1), c('stone', 1), c('stone', 2),
                c('fire', 5), INK]
    if kind == 'fill':
        return [T, T, T, FILL[3], FILL[2], FILL[1], FILL[0], T, T]
    if kind == 'groove':
        return [T, T, INK, c('ink', 1), c('ink', 1), c('ink', 1), WOOD[1], T, T]
    if kind == 'glow':
        return [T, T, INK, c('fire', 4), c('fire', 3), c('fire', 3), c('fire', 2), T, T]
    if kind == 'glow2':
        return [T, T, INK, c('fire', 5), c('fire', 4), c('fire', 4), c('fire', 3), T, T]
    raise KeyError(kind)


def uniform(kind, width=BW):
    col = bar_column(kind)
    g = blank(BW, BH)
    for y in range(BH):
        for x in range(width):
            g[y][x] = col[y]
    return g


def bar_cap(left, flash=False):
    """A rounded wooden end, four pixels wide, with a carved stud."""
    lit = c('fire', 7) if flash else WOOD[6]
    mid = c('fire', 5) if flash else WOOD[4]
    dk = WOOD[2]
    rows = [
        '.kkk',
        'khhh',
        'khmm',
        'khmn',
        'khms',
        'khmm',
        'kmdd',
        '.kdd',
        '..kk',
    ]
    pal = {'k': INK, 'h': lit, 'm': mid, 'd': dk, 'n': c('bracken', 4) if not flash else c('fire', 7),
           's': INK1}
    g = blank(BW, BH)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal:
                g[y][x] = pal[ch]
    if not left:
        # The right cap is the left one turned round, still lit from the upper left.
        g2 = blank(BW, BH)
        for y in range(BH):
            for x in range(4):
                ch = g[y][3 - x]
                if ch == lit and x > 0:
                    ch = mid
                g2[y][x] = ch
        for y in range(1, 7):
            g2[y][3] = dk if g2[y][3] != INK else INK
        g2[1][0] = lit
        g2[1][1] = lit
        g2[1][2] = lit
        g = g2
    return g


def stamina():
    fill_end = blank(BW, BH)
    for y, ch in enumerate([T, T, T, c('fire', 7), FILL[3], FILL[3], FILL[2], T, T]):
        if ch != T:
            fill_end[y][0] = ch
            fill_end[y][1] = FILL[3] if y in (4, 5) else ch
    cut = blank(BW, BH)
    for y, ch in enumerate([INK, WOOD[5], WOOD[4], WOOD[4], WOOD[3], WOOD[3], WOOD[2], INK, T]):
        cut[y][1] = ch
    for y in range(0, 8):
        cut[y][0] = INK
        cut[y][2] = INK
    cut[0][1] = INK
    gend = blank(BW, BH)
    for y, ch in enumerate([T, T, INK, INK, INK, INK, INK, T, T]):
        gend[y][1] = ch
    for y, ch in enumerate([T, T, INK, c('ink', 1), c('ink', 1), c('ink', 1), WOOD[1], T, T]):
        if ch != T:
            gend[y][0] = ch
    gend[2][1] = T
    gend[6][1] = T
    gend[3][1] = INK
    write_sheet('ui_stamina', 'decal', BW, BH, (0, 0), (BW, BH), [
        ('cap_left', [bar_cap(True)], 1, False),
        ('frame', [uniform('frame')], 1, False),
        ('cap_right', [bar_cap(False)], 1, False),
        ('fill', [uniform('fill')], 1, False),
        ('fill_end', [fill_end], 1, False),
        ('groove', [uniform('groove')], 1, False),
        ('groove_cut', [cut], 1, False),
        ('groove_end', [gend], 1, False),
        ('glow', [uniform('glow'), uniform('glow2')], 10, True),
        ('flash', [bar_cap(True, True), uniform('frame_flash'), bar_cap(False, True)], 1, False),
    ], ['The stamina bar (Book 7 section 10), pieces 8 x 9 drawn from their top left (pivot 0,0).',
        'cap_left and cap_right use columns 0 to 3; frame, fill, groove and glow are the same in',
        'every column, so the code crops them to any length (the frame is as long as the current',
        'maximum). fill sits over the frame\'s channel (rows 3 to 6) and ends in fill_end (2 px).',
        'Lost capacity runs on to the right as the groove (a darker channel, no frame), split by',
        'groove_cut (3 px) between reasons and closed by groove_end (2 px); each segment\'s reason',
        'icon (ui_stamina_reason) sits centred under it. glow: a segment lit warm as a restorer',
        'lifts it (2-frame pulse). flash: frames 0 to 2 are cap_left, frame and cap_right in their',
        'one-time empty flash (none with reduced flashes).'])


REASONS = {
    # k ink, F frost light, f frost mid, n night blue, W/w/x wood, L linen, l linen shade,
    # r madder, K/q skin, e eyelid crease, s sweat, Z/z woad cloth.
    'cold': [
        '..kkkk..',
        '.knFnnk.',
        'kFnFnFnk',
        'knFFFnnk',
        'kFFLFFFk',
        'knFFFnnk',
        '.kFnFnk.',
        '..kkkk..'],
    'hunger': [
        '........',
        '........',
        '.kkkkkk.',
        'kWxwwxWk',
        'kWWWWWWk',
        '.kxxxxk.',
        '..kwwk..',
        '...kk...'],
    'wounds': [
        '.....kk.',
        '....kLLk',
        '...kLlLk',
        '..kLrLk.',
        '.kLlLk..',
        'kLLLk...',
        'kLlk....',
        '.kk.....'],
    'sickness': [
        '.r..r...',
        '..r..r..',
        '.kkkkk..',
        'kKKKKKk.',
        'krrrrrks',
        'kKeKeKk.',
        'kqKKKqk.',
        '.kkkkk..'],
    'sleep': [
        '........',
        'kk....kk',
        'kKk..kKk',
        'kqKkkKqk',
        '.kqKKqk.',
        '..kkkk..',
        '.k.kk.k.',
        'k......k'],
    'work': [
        '........',
        '...kkk..',
        '..kZZZk.',
        '.kZZZZZk',
        'kKkkkZKk',
        'kKk.kZk.',
        '.k..kZZk',
        '....k.k.'],
}
REASON_CODES = {
    'k': INK, 'F': c('sea', 10), 'f': c('sky', 4), 'n': c('woad', 2), 'W': c('bracken', 4),
    'x': c('bracken', 3), 'w': c('bracken', 1), 'L': c('wool', 6), 'l': c('wool', 3),
    'r': c('madder', 4), 'K': c('skin_light', 4), 'q': c('skin_light', 3),
    'e': c('skin_light', 1), 's': c('sea', 9), 'Z': c('woad', 4), 'z': c('woad', 3),
}


def stamina_icons():
    out = []
    for name, rows in REASONS.items():
        g = [[REASON_CODES.get(ch, T) for ch in row] for row in rows]
        out.append((name, [g], 1, False))
    write_sheet('ui_stamina_reason', 'decal', 8, 8, (0, 0), (8, 8), out,
                ['Why the stamina bar is shorter (Book 7 section 10), 8 x 8 from the top left, drawn',
                 'pixel by pixel with their own ink: cold (a frost crystal on a night-blue token),',
                 'hunger (an empty bowl), wounds (a bound linen strip), sickness (a fevered, flushed',
                 'brow with heat rising and sweat), sleep (a closed eye), work (a bent back, hand on',
                 'it). The plain word is overlay text on hover.'])


# ---------------------------------------------------------------------------------------------
# fx_people: particles for the 40 px people
# ---------------------------------------------------------------------------------------------
FW, FH = 20, 18
PX, PY = 10, 13          # the pivot: where the foot meets the ground or the waterline
DROP = (c('sea', 8), c('sea', 9), c('sea', 10))   # a drop's edge, body and glint
FOAM = c('sea', 10)


def fx_blank():
    return blank(FW, FH)


# Particle frames are drawn by hand, 20 columns wide, with the rows given from `top` down; the
# letters: l m n dust (lit, mid, shade); a b c water (rim, body, bead glint); d e f prints.
FX_CODES = {
    'l': c('sand', 6), 'm': c('sand', 5), 'n': c('sand', 3),
    'a': c('sea', 8), 'b': c('sea', 9), 'c': c('sea', 10),
}


def fx_frame(top, rows, codes=None):
    codes = codes or FX_CODES
    g = fx_blank()
    for i, row in enumerate(rows):
        assert len(row) == FW, (row, len(row))
        for x, ch in enumerate(row):
            if ch in codes:
                g[top + i][x] = codes[ch]
    return g


def dust():
    """Kicked back from a running foot: drawn for running east (it drifts west); mirror for west."""
    return [
        fx_frame(10, [
            '....................',
            '.........ll.........',
            '.......lmmml........',
            '........nmmn........']),
        fx_frame(8, [
            '....................',
            '.......ll...........',
            '......lmml.lm.......',
            '.....lmmmnlmmn......',
            '......mnnn.mnn......',
            '........n...........']),
        fx_frame(6, [
            '.....ll.............',
            '....lmml..ll........',
            '...lm.mnllmmn.......',
            '...mm..n.mmmn.l.....',
            '....n.....nn..m.....',
            '....................']),
        fx_frame(5, [
            '....l...............',
            '...l.m...l..........',
            '..m....n.m.m........',
            '.....m.....n........',
            '...n.........l......']),
    ]


def splash():
    """Entering knee or waist water, or a running step in it: a crown, then drops up and down."""
    return [
        fx_frame(8, [
            '.........c..........',
            '.......c...c........',
            '........b.b.c.......',
            '......b..b..b.......',
            '.....a.b.....b.a....',
            '......abbcbbba......']),
        fx_frame(3, [
            '.........c..........',
            '......c......c......',
            '..........b.........',
            '....b..c.......c....',
            '........b...b.......',
            '...........b........',
            '......b........b....',
            '....................',
            '.....a..........a...',
            '....a.b........b.a..',
            '.....aabbbccbbbaa...']),
        fx_frame(3, [
            '....c..........c....',
            '....................',
            '..b.....c...c....b..',
            '....................',
            '...c.............c..',
            '....................',
            '.........b..........',
            '..b..............b..',
            '....................',
            '...a..............a.',
            '...aabb.bbccbb.bbaa.',
            '......a.......a.....']),
        fx_frame(7, [
            '..b..............b..',
            '....................',
            '.b..................',
            '..................b.',
            '.c.a............a.c.',
            '..a.bb.b.bb.b.bb.a..',
            '...a..a......a..a...']),
        fx_frame(11, [
            '.a................a.',
            'a.a..a.a....a.a..a.a',
            '.a................a.']),
    ]


def oval(w, h):
    """A thin (8-connected) oval ring of w x h pixels, as (x, y, lower half) offsets from its
    centre pixel."""
    cx, cy = w / 2, h / 2
    inside = lambda x, y: ((x + .5 - cx) / (w / 2)) ** 2 + ((y + .5 - cy) / (h / 2)) ** 2 <= 1
    pts = []
    for y in range(h):
        for x in range(w):
            if inside(x, y) and not all(inside(x + dx, y + dy) for dx, dy in
                                        ((1, 0), (-1, 0), (0, 1), (0, -1))):
                pts.append((x - w // 2, y - h // 2, y + .5 > cy))
    return pts


def ripple():
    sizes = [(3, 2), (5, 3), (7, 3), (9, 4), (10, 5), (11, 5)]
    tones = [('c', 'b'), ('b', 'a'), ('b', 'a'), ('a', 'a'), ('a', 'd'), ('d', None)]
    codes = dict(FX_CODES, d=c('sea', 7))
    frames = []
    for i, ((w, h), (near, far)) in enumerate(zip(sizes, tones)):
        g = fx_blank()
        for k, (x, y, lower) in enumerate(oval(w, h)):
            if i >= 4 and k % 3 == 1:
                continue      # breaking up as it fades
            ch = near if lower else far
            if ch is not None:
                g[PY + y][PX + x] = codes[ch]
        frames.append(g)
    return frames


def drip():
    return [
        fx_frame(2, ['..........c.........', '..........b.........']),
        fx_frame(7, ['..........b.........', '..........b.........', '..........c.........']),
        fx_frame(12, ['.........c.c........', '........b.a.b.......']),
    ]


# Footprints (pointing north, left foot): the toe pad, the arch on the inside, the heel.
FOOT_N = ['##', '##', '.#', '##']
FOOT_E = ['##.###', '######']


def footprint(rows, wet):
    """A print, pressed in: the far (upper-left) wall in shadow, the near rim kicked up and lit; a
    wet print holds water that catches the sky."""
    h, w = len(rows), len(rows[0])
    g = blank(w + 2, h + 2)
    hole = lambda x, y: 0 <= y < h and 0 <= x < w and rows[y][x] == '#'
    glint = False
    for y in range(-1, h + 1):
        for x in range(-1, w + 1):
            gx, gy = x + 1, y + 1
            if hole(x, y):
                edge = not hole(x, y - 1) or not hole(x - 1, y)
                if wet:
                    g[gy][gx] = c('sand_wet', 0) if edge else c('sand_wet', 1)
                    if not edge and not glint:
                        g[gy][gx] = c('sky', 2)
                        glint = True
                else:
                    g[gy][gx] = c('sand', 2) if edge else c('sand', 3)
            elif (hole(x, y - 1) or hole(x - 1, y)) and not hole(x - 1, y - 1) or \
                    (hole(x, y - 1) and not hole(x, y + 1)):
                g[gy][gx] = c('sand_wet', 3) if wet else c('sand', 6)
    return g


def prints(wet):
    out = []
    shapes = {'s': list(reversed(FOOT_N)), 'n': FOOT_N, 'e': FOOT_E, 'w': [r[::-1] for r in FOOT_E]}
    for f, rows in shapes.items():
        frames = []
        for side in (-1, 1):  # left, right
            g = fx_blank()
            r = rows
            if f in 'ns' and side == 1:
                r = [row[::-1] for row in rows]       # the right foot is the left one mirrored
            if f in 'ew' and side == 1:
                r = list(reversed(rows))
            p = footprint(r, wet)
            ph, pw = len(p), len(p[0])
            if f in 'ns':
                lr = side if f == 'n' else -side       # facing the viewer, left is on the right
                ox, oy = PX + 2 * lr - pw // 2, PY - ph // 2
            else:
                ox, oy = PX - pw // 2, PY - ph // 2 + side
            paste(g, p, ox, oy)
            frames.append(g)
        out.append((f'print_{"wet" if wet else "dry"}_{f}', frames, 1, False))
    return out


def surf():
    """The wash round the shins of someone standing in the surf line: the near side of a foam
    collar (drawn over the legs) and spray thrown up as each wave strikes."""
    return [
        fx_frame(11, [
            '...a..............a.',
            '...cb............bc.',
            '.....cb.b....b.bc...',
            '.......bccbccb......']),
        fx_frame(5, [
            '........c...c.......',
            '......c.......c.....',
            '.........b.b........',
            '.....b..........b...',
            '......c........c....',
            '.....b.b......b.b...',
            '..c.b............b.c',
            '..cb..............bc',
            '...ccb..........bcc.',
            '.....cbbccccccbbc...',
            '.......aa....aa.....']),
        fx_frame(2, [
            '......c.....c.......',
            '....................',
            '...c.....c.....c....',
            '....................',
            '..b..............b..',
            '....................',
            '.b................b.',
            '....................',
            '..b..............b..',
            '.a................a.',
            '.cb..............bc.',
            '..cb............bc..',
            '...cbbccc..cccbbc...',
            '.....aa..aa..aa.....']),
        fx_frame(9, [
            '.c................c.',
            '....................',
            'b..................b',
            '.a................a.',
            '..ab............ba..',
            '....bb.b.cc.b.bb....',
            '......a..a..a.......']),
    ]


def fx_people():
    anims = [('dust', dust(), 4, False), ('splash', splash(), 3, False), ('ripple', ripple(), 6, False),
             ('drip', drip(), 3, False)]
    anims += prints(False)
    anims += prints(True)
    anims.append(('surf', surf(), 5, True))
    write_sheet('fx_people', 'decal', FW, FH, (PX, PY), (FW, FH), anims,
                ['Particles for people at the 40 px scale (Book 7 sections 07 and 14), 20 x 18 frames',
                 'with the pivot at the foot or the waterline. dust: running on sand and dry earth;',
                 'splash: entering knee or waist water and running in it, drops rising and falling;',
                 'ripple: an oval ring growing to about 10 px; drip: a drop falling from wet clothes',
                 '(spawned 10 px above the ground) and landing; print_dry_* and print_wet_*: frame 0',
                 'the left foot, frame 1 the right, per facing; surf: the wash round the shins of',
                 'someone standing in the surf line, drawn over the person. No outline: water parts',
                 'are light rims and beads from the sea ramp, never solid white.'])


# ---------------------------------------------------------------------------------------------
# prop_broch_door: a stretch of the broch's drystone wall with its doorway
# ---------------------------------------------------------------------------------------------
BWID, BHGT = 96, 80
STONE = [c('stone', i) for i in range(10)]
WARM = [c('stone_warm', i) for i in range(6)]


def broch_door():
    W, H = BWID, BHGT
    rnd = random.Random(1337)
    g = blank(W, H)
    inside = [[False] * W for _ in range(H)]

    def sag(x):
        # The round tower's courses bow towards the viewer in the middle.
        u = (x + .5 - W / 2) / (W / 2)
        return round(3 * (1 - u * u))

    base = lambda x: 74 + sag(x)
    # Ragged ruin top: the courses are broken off at different heights.
    tops = []
    t = 9
    for x in range(W):
        if x % 7 == 0:
            t = 8 + rnd.choice([-1, 0, 0, 1, 1, 2])
        edge = min(x, W - 1 - x)
        drop_ = 0 if edge >= 8 else [14, 10, 8, 6, 4, 3, 2, 1][edge]
        tops.append(t + sag(x) + drop_)
    for x in range(W):
        for y in range(tops[x], base(x) + 1):
            inside[y][x] = True

    # Door geometry: a clear opening 22 px wide at the foot, 20 at the head, 48 px tall.
    D0, D1 = 37, 58
    DTOP, DFOOT = 28, 75
    LT0, LT1, LTY0, LTY1 = 29, 66, 20, 27

    def in_door(x, y):
        if not (DTOP <= y <= DFOOT):
            return False
        narrow = 1 if y < DTOP + 16 else 0
        return D0 + narrow <= x <= D1 - narrow

    # --- Courses of flat stones over the whole face: long, low slabs of uneven height with dark,
    # deep joints; rounded corners and small pinning stones keep it from reading as brick.
    light_shift = lambda x: 1 if x < 26 else (0 if x < 72 else -1)
    joint_deep, joint = STONE[0], STONE[1]
    for yy_ in range(H):
        for xx in range(W):
            if inside[yy_][xx]:
                g[yy_][xx] = joint
    yy = 5
    while yy < 80:
        ch = rnd.choice([2, 3, 3, 3, 4, 4, 5])
        x = -rnd.randint(0, 10)
        while x < W:
            sw = rnd.choice([6, 8, 9, 10, 11, 12, 13, 14, 16, 18])
            if ch >= 5:
                sw = min(sw, 11)
            warm = rnd.random() < 0.14
            ramp = WARM if warm else STONE
            tone = (rnd.choice([3, 4, 4, 5]) if not warm else rnd.choice([2, 3]))
            dh = rnd.choice([0, 0, 0, -1, 1]) if ch > 2 else 0   # stones sit a little proud or low
            sh_ = ch + dh
            for sx in range(max(0, x), min(W, x + sw - 1)):
                s = sag(sx)
                lx = sx - x
                # Each stone's top runs a little uneven: a long, gentle wave.
                lift = 1 if (sw > 9 and 2 < lx < sw - 4 and (x + lx // 3) % 4 == 0) else 0
                y0s = yy + s - lift
                for sy in range(y0s, yy + s + sh_):
                    if not (0 <= sy < H) or not inside[sy][sx]:
                        continue
                    ly = sy - y0s
                    hh = yy + s + sh_ - y0s
                    corner = (lx == 0 or lx == sw - 2) and (ly == 0 or ly == hh - 1)
                    if corner and sw > 5:
                        g[sy][sx] = joint
                        continue
                    k = tone + light_shift(sx)
                    if ly == 0:
                        k += 2 if lx < sw * 0.6 else 1     # the lit top arris
                    elif lx == 0 and ly < hh - 1:
                        k += 1
                    elif ly == hh - 1:
                        k -= 2 if hh > 2 else 1            # the shadowed underside
                    elif lx == sw - 2:
                        k -= 1
                    elif rnd.random() < 0.07:
                        k -= 1                             # pitting
                    g[sy][sx] = ramp[max(0, min(len(ramp) - 1, k))]
            # Dark voids where stone ends meet, and pinning stones wedged into some.
            jx = x + sw - 1
            if 0 <= jx < W:
                jy = yy + sag(jx) + ch // 2
                if 0 <= jy < H and inside[jy][jx]:
                    if rnd.random() < 0.35:
                        g[jy][jx] = STONE[5 + light_shift(jx)]
                        if jy + 1 < H and inside[jy + 1][jx]:
                            g[jy + 1][jx] = STONE[2]
                    else:
                        g[jy][jx] = joint_deep
            x += sw
        yy += ch + 1

    # --- Jambs: tall, squared stones lining the doorway, and the lintel above it.
    def block(x0, y0, x1, y1, tone, ramp=STONE):
        for yy_ in range(y0, y1 + 1):
            for xx in range(x0, x1 + 1):
                if not (0 <= yy_ < H and 0 <= xx < W):
                    continue
                k = tone
                if yy_ == y0:
                    k += 2
                elif xx == x0:
                    k += 1
                elif yy_ == y1:
                    k -= 2
                elif xx == x1:
                    k -= 1
                elif yy_ == y1 - 1:
                    k -= 1
                if (xx * 7 + yy_ * 3) % 17 == 0 or (xx * 5 + yy_ * 11) % 23 == 0:
                    k -= 1
                if yy_ > y0 and xx > x0 and (xx * 3 + yy_ * 13) % 29 == 0:
                    k += 1
                g[yy_][xx] = ramp[max(0, min(len(ramp) - 1, k))]
        for xx in range(x0, x1 + 1):
            if y1 + 1 < H:
                g[y1 + 1][xx] = STONE[1]
        for yy_ in range(y0, y1 + 2):
            if x1 + 1 < W and 0 <= yy_ < H:
                g[yy_][x1 + 1] = STONE[1]
            if x0 - 1 >= 0 and 0 <= yy_ < H:
                g[yy_][x0 - 1] = STONE[1]

    left_jamb = [(29, 30, 36, 41), (30, 43, 36, 56), (29, 58, 36, 74)]
    right_jamb = [(59, 30, 66, 44), (59, 46, 65, 58), (59, 60, 66, 75)]
    for i, (x0, y0, x1, y1) in enumerate(left_jamb):
        block(x0, y0, x1, y1, [5, 3, 4][i], WARM if i == 1 else STONE)
    for i, (x0, y0, x1, y1) in enumerate(right_jamb):
        block(x0, y0, x1, y1, [4, 3, 2][i], STONE if i != 2 else WARM)
    # The lintel: one great slab, its underside in deep shadow.
    block(LT0, LTY0, LT1, LTY1, 5)
    for xx in range(LT0 + 1, LT1):
        g[LTY0][xx] = STONE[8] if xx < 44 else STONE[7]
        g[LTY0 + 1][xx] = STONE[6] if xx < 40 else STONE[5]
    # Its weathered front: a few cracks and its lower arris.
    for xx, yy_ in [(36, 23), (37, 24), (52, 22), (53, 23), (53, 24), (61, 25)]:
        g[yy_][xx] = STONE[3]
    for xx in range(LT0, LT1 + 1):
        g[LTY1][xx] = STONE[2]
    g[LTY0][LT0] = STONE[7]
    # A stone over the lintel's ends to carry it: relieving slabs.
    block(26, 15, 39, 19, 5)
    block(57, 15, 70, 19, 4)

    # --- The passage: deep, dark, lit only near its mouth.
    for yy_ in range(DTOP, DFOOT + 1):
        for xx in range(D0, D1 + 1):
            if not in_door(xx, yy_):
                continue
            depth = (DFOOT - yy_)
            if depth > 30:
                ch = INK
            elif depth > 18:
                ch = INK1
            else:
                ch = STONE[0]
            g[yy_][xx] = ch
    # The underside of the lintel throws the top of the passage into ink.
    # The passage's right-hand wall, seen at a slant and catching the daylight near the mouth:
    # its courses run in towards the far end.
    for yy_ in range(DTOP + 8, DFOOT + 1):
        for xx in range(D1 - 3, D1 + 1):
            if not in_door(xx, yy_):
                continue
            lit = (yy_ - DTOP) / (DFOOT - DTOP)
            k = int(lit * 3.2)
            if yy_ % 5 == 0:
                k = 0                     # a course joint
            elif yy_ % 5 == 1 and xx > D1 - 3:
                k += 1                    # the lit top of the course below it
            if xx == D1 - 3:
                k = max(0, k - 1)
            if xx == D1 - 1 and (yy_ // 5) % 2 == 0 and yy_ % 5 == 3:
                k = 0                     # a vertical joint, staggered
            g[yy_][xx] = STONE[max(0, min(4, k))]
    # The left-hand wall, in shadow: only its coursing shows.
    for yy_ in range(DTOP + 20, DFOOT + 1):
        for xx in range(D0, D0 + 2):
            if in_door(xx, yy_):
                g[yy_][xx] = STONE[1] if (yy_ + xx) % 5 else INK1
    # The far end: the broch's open court, a dim slot of daylight down the passage.
    for yy_ in range(46, 64):
        for xx in range(45, 51):
            if yy_ == 46 or xx in (45, 50):
                g[yy_][xx] = STONE[1]
            else:
                g[yy_][xx] = c('sky', 0) if yy_ < 59 else c('grass', 3)
    for xx in range(46, 50):
        g[47][xx] = c('sky', 1)
    g[48][46] = c('sky', 1)
    g[59][46] = c('grass', 5)
    g[58][48] = c('grass', 4)
    # The passage floor: flags running in, lit at the mouth and darkening inwards.
    for yy_ in range(64, DFOOT + 1):
        for xx in range(D0 + 1, D1 - 3):
            depth = DFOOT - yy_
            k = 3 if depth < 3 else (2 if depth < 7 else 1)
            if (xx * 3 + yy_ * 5) % 11 == 0 or yy_ in (67, 71):
                k = max(0, k - 1)
            g[yy_][xx] = STONE[k]
    for yy_ in range(62, 64):
        for xx in range(45, 51):
            g[yy_][xx] = STONE[1]

    # --- The threshold: a worn slab, polished hollow in the middle by feet.
    for yy_ in range(75, 80):
        for xx in range(33, 63):
            u = (xx - 47.5) / 15
            if yy_ == 79 and abs(u) > 0.9:
                continue
            if yy_ <= 76:
                k = 7 if yy_ == 75 else 6
                if abs(u) < 0.45:
                    k = 5 if yy_ == 76 else 6     # the hollow worn by feet
                if abs(u) < 0.3 and yy_ == 76:
                    k = 8                          # its polished lip
            elif yy_ <= 77:
                k = 5
            else:
                k = 3 if yy_ == 78 else 2          # the slab's front face
            g[yy_][xx] = STONE[k]
            inside[yy_][xx] = True
    g[75][33] = STONE[8]
    g[77][62] = STONE[3]

    # --- The wall head: turf over the broken top, grass tufts standing up from it.
    for x in range(W):
        t0 = tops[x]
        for k in range(4):
            yy_ = t0 + k
            if yy_ >= H or not inside[yy_][x]:
                continue
            noise = (x * 13 + k * 7) % 5
            if k == 0:
                g[yy_][x] = c('grass', 9) if noise < 3 else c('grass', 8)
            elif k == 1:
                g[yy_][x] = c('grass', 7) if noise < 3 else c('grass', 8)
            elif k == 2:
                g[yy_][x] = c('grass', 5) if noise < 4 else c('grass', 6)
            else:
                g[yy_][x] = c('grass', 2)       # the dark undercut of the turf lip
        # Hanging roots and grass over the lip in places.
        if (x * 7) % 11 == 0 and tops[x] + 4 < H and inside[tops[x] + 4][x]:
            g[tops[x] + 4][x] = c('grass', 3)
    for x in range(1, W - 1, 3):
        if rnd.random() < 0.55:
            t0 = tops[x]
            hgt = rnd.choice([1, 2, 2, 3])
            for k in range(1, hgt + 1):
                xx = x + (1 if k == hgt and rnd.random() < 0.5 else 0)
                if t0 - k >= 0:
                    g[t0 - k][xx] = c('marram', 4) if k == hgt else c('grass', 8)
                    inside[t0 - k][xx] = True

    # --- Lichen on the lit faces, moss and weed low down and in the joints.
    for _ in range(140):
        x = rnd.randrange(2, W - 2)
        y = rnd.randrange(14, 70)
        if not inside[y][x] or in_door(x, y):
            continue
        if g[y][x] not in (STONE[7], STONE[8], STONE[6], WARM[5], WARM[4]):
            continue
        if x > 70 and rnd.random() < 0.6:
            continue
        kind = rnd.random()
        col = c('clover_white', 1) if kind < 0.45 else (c('trefoil', 2) if kind < 0.7 else c('clover_white', 0))
        g[y][x] = col
        if rnd.random() < 0.5 and x + 1 < W and inside[y][x + 1] and not in_door(x + 1, y):
            g[y][x + 1] = col
    for x in range(W):
        for yy_ in range(base(x) - 4, base(x) + 1):
            if inside[yy_][x] and not in_door(x, yy_) and not (33 <= x <= 62 and yy_ >= 75):
                if g[yy_][x] in (STONE[1], STONE[2]) and rnd.random() < 0.7:
                    g[yy_][x] = c('moss', 3 + rnd.randint(0, 1))
                elif yy_ == base(x) and rnd.random() < 0.5:
                    g[yy_][x] = c('moss', 2)
    # Grass at the foot of the wall, either side of the threshold.
    for x in list(range(0, 31)) + list(range(65, W)):
        if rnd.random() < 0.4:
            hgt = rnd.choice([1, 2, 2, 3])
            for k in range(hgt):
                yy_ = base(x) - k
                if 0 <= yy_ < H:
                    g[yy_][x] = c('grass', 6 + k) if k < hgt - 1 else c('grass', 8)
    # A few loose stones fallen at the wall's foot.
    for (x0, w_) in [(8, 4), (21, 3), (71, 5), (86, 3)]:
        yb = base(x0) + 1
        for xx in range(x0, x0 + w_):
            if yb < H:
                g[yb][xx] = STONE[6] if xx == x0 else STONE[4]
                inside[yb][xx] = True
            if yb - 1 >= 0 and xx < x0 + w_ - 1:
                g[yb - 1][xx] = STONE[7] if xx == x0 else STONE[5]
    out = outline(g, INK, 4)
    return out


def broch():
    write_sheet('prop_broch_door', 'prop', BWID, BHGT, (48, 79), (88, 10), [
        ('wall', [broch_door()], 1, False),
    ], ['A stretch of the old broch\'s drystone wall with its doorway, at the 40 px people scale',
        '(Book 7 sections 01 and 06): the clear opening is 22 px wide at the foot, 20 at the head and',
        '48 px tall under a heavy lintel; a deep passage runs through the wall to a dim slot of the',
        'open court; the threshold is a worn slab. Courses bow with the tower\'s curve; lit from',
        'the upper left; lichen on the lit faces, moss low down, turf on the broken wall head.'],
        shadow=(92, 10))


# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------
if __name__ == '__main__':
    icons()
    digits()
    hotbar()
    cursor()
    glyphs()
    aim()
    stamina()
    stamina_icons()
    fx_people()
    broch()

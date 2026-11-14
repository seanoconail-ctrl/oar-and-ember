"""Missiles, the pickup glint and the starting weapons lying on the strand (Book 7 sections 07, 11
and 14; Book 10 section 21, "Starting weapons", "Missiles" and "Arrows").

    python3 assets/art/authoring/missiles.py && npm run art:sheets && npm run art:compile

Writes, deterministically:
- assets/art/sheets/fx_missile.txt: an arrow and a thrown spear in flight in 16 directions (0 east,
  clockwise, y south; the renderer picks the nearest to the missile's velocity on screen, the arc's
  rise and fall included), and missiles at rest: stuck in the ground, in wood, in a shield and in a
  body (8 directions each, the head at the pivot), lying at the foot of stone, and broken.
- assets/art/sheets/fx_glint.txt: the glint that marks something worth picking up.
- assets/art/maps/prop_pickup.map.txt: the seax in the wreck's debris, and the hunting bow with its
  quiver by the stern (a material map: the generator adds the outline and the shading).

Missiles are drawn with palette codes by ramp name: an iron head lit at its point, an ash shaft, grey
goose fletching bound with madder thread, and the one-pixel ink outline of every in-world object
(Book 7 section 11). Lines are walked a pixel at a time so every direction keeps one clean stroke.
"""
import json
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SHEETS = os.path.join(REPO, 'assets', 'art', 'sheets')
MAPS = os.path.join(REPO, 'assets', 'art', 'maps')

with open(os.path.join(REPO, 'assets', 'palette', 'book07.json'), encoding='utf8') as f:
    _PAL = json.load(f)
RAMP = {}
for _e in _PAL['entries']:
    if 'ramp' in _e:
        RAMP.setdefault(_e['ramp'], {})[_e['step']] = _e['code']


def c(ramp, step):
    return RAMP[ramp][step]


T = '.'
INK = c('ink', 0)
INK1 = c('ink', 1)
IRON_LIT = c('stone', 9)
IRON = c('stone', 7)
IRON_DARK = c('stone', 5)
ASH_LIT = c('driftwood', 7)
ASH = c('driftwood', 6)
ASH_DARK = c('driftwood', 4)
FEATHER_LIT = c('gull', 5)
FEATHER = c('gull', 3)
FEATHER_DARK = c('gull', 3)
THREAD = c('madder', 4)
SPLINTER = c('driftwood', 5)
DIVOT = c('sand', 1)


def blank(w, h):
    return [[T] * w for _ in range(h)]


def text(g):
    return '\n'.join(''.join(r) for r in g)


def put(g, x, y, ch, over=True):
    xi, yi = int(math.floor(x)), int(math.floor(y))
    if 0 <= yi < len(g) and 0 <= xi < len(g[0]) and (over or g[yi][xi] == T):
        g[yi][xi] = ch


def outline(g, code=INK):
    h, w = len(g), len(g[0])
    out = [r[:] for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] != T:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and g[yy][xx] != T:
                    out[y][x] = code
                    break
    return out


def stroke(g, x0, y0, x1, y1, colour_at):
    """A one-pixel line from (x0, y0) to (x1, y1) (pixel centres), walked along its major axis so
    each step sets exactly one pixel; colour_at(t) colours it by the fraction t along it."""
    dx, dy = x1 - x0, y1 - y0
    n = int(max(abs(dx), abs(dy))) or 1
    pts = []
    for i in range(n + 1):
        t = i / n
        x, y = x0 + dx * t, y0 + dy * t
        p = (int(math.floor(x + 0.5)), int(math.floor(y + 0.5)))
        if not pts or pts[-1] != p:
            pts.append(p)
    for i, (x, y) in enumerate(pts):
        ch = colour_at(i / max(1, len(pts) - 1))
        if ch is not None:
            put(g, x, y, ch)
    return pts


def missile(g, cx, cy, ax, ay, length, kind, lift=1.0):
    """Draws an arrow or a spear whose tail-to-tip vector on screen is (ax, ay) (unit), its middle
    at (cx, cy). `lift` < 1 shortens the visible part (a head buried: only the rear is shown, from
    the pivot back)."""
    hx, hy = cx + ax * length / 2, cy + ay * length / 2
    tx, ty = cx - ax * length / 2, cy - ay * length / 2
    head = 3 if kind == 'arrow' else 6
    feather = 4 if kind == 'arrow' else 0

    def colour(t):
        u = t * length
        if u >= length - head:
            return IRON_LIT if u >= length - 0.6 else IRON_DARK
        if kind == 'arrow' and u < feather:
            return THREAD if abs(u - feather + 0.5) < 0.6 else ASH
        return ASH if kind == 'arrow' else c('bracken', 4)

    pts = stroke(g, tx, ty, hx, hy, colour)
    # The head's barbs (an arrow) or its leaf (a spear): a pixel to each side at its base.
    nx, ny = -ay, ax
    if pts:
        base = len(pts) - 1 - head
        if 0 <= base < len(pts):
            bx, by = pts[base + 1] if base + 1 < len(pts) else pts[base]
            put(g, bx + nx + 0.5, by + ny + 0.5, IRON, over=False)
            put(g, bx - nx + 0.5, by - ny + 0.5, IRON_DARK, over=False)
            if kind == 'spear':
                mx, my = pts[base + 3] if base + 3 < len(pts) else pts[-1]
                put(g, mx + nx + 0.5, my + ny + 0.5, IRON_DARK, over=False)
                put(g, mx - nx + 0.5, my - ny + 0.5, IRON, over=False)
        # Fletching: two vanes along the last few pixels of the tail, swept back.
        if kind == 'arrow':
            # Vanes either side of the shaft just ahead of the nock, never round the nock itself,
            # so the tail reads as feathers and not as a head.
            for k in range(1, min(3, len(pts))):
                px, py = pts[k]
                put(g, px + nx + 0.5, py + ny + 0.5, FEATHER_LIT, over=False)
                put(g, px - nx + 0.5, py - ny + 0.5, FEATHER_DARK, over=False)
            put(g, pts[0][0] + 0.5, pts[0][1] + 0.5, THREAD)
        else:
            # A spear's butt: a dark iron ferrule.
            px, py = pts[0]
            put(g, px + 0.5, py + 0.5, IRON_DARK)
    return pts


# --------------------------------------------------------------------------------- the sheet
W = H = 40
PIVOT = (20, 20)
ARROW_LEN = 15
SPEAR_LEN = 34


def flight(kind, d):
    a = 2 * math.pi * d / 16
    g = blank(W, H)
    missile(g, PIVOT[0] + 0.5, PIVOT[1] + 0.5, round(math.cos(a), 9), round(math.sin(a), 9),
            ARROW_LEN if kind == 'arrow' else SPEAR_LEN, kind)
    return outline(g)


def at_rest(kind, d8, where):
    """A missile come to rest with its head at the pivot. In the ground it stands up out of the sand
    leaning back towards where it came from; in wood, a shield or a body it sticks out level, less
    of it showing the deeper it went in."""
    a = 2 * math.pi * d8 / 8
    ux, uy = round(math.cos(a), 9), round(math.sin(a), 9)
    g = blank(W, H)
    length = ARROW_LEN if kind == 'arrow' else SPEAR_LEN
    if where == 'ground':
        e = math.radians(38)
        # Back towards the shooter on the ground (foreshortened in y), and up.
        bx, by = -ux * math.cos(e), -uy * math.cos(e) * 0.7 - math.sin(e)
        show = length - (4 if kind == 'arrow' else 8)
    else:
        bx, by = -ux, -uy * 0.7 + 0.12
        show = {'wood': length - 4, 'shield': length - 6, 'body': length - 7}[where]
    n = math.hypot(bx, by)
    bx, by = bx / n, by / n
    # The visible part runs from the entry point (at the pivot) back to the tail.
    hx, hy = PIVOT[0] + 0.5, PIVOT[1] + 0.5
    tx, ty = hx + bx * show, hy + by * show
    feather = 4

    def colour(t):
        u = (1 - t) * show  # distance from the tail
        if kind == 'arrow' and u < feather:
            return THREAD if abs(u - feather + 0.5) < 0.6 else ASH
        return ASH if kind == 'arrow' else c('bracken', 4)

    pts = stroke(g, tx, ty, hx, hy, colour)
    nx, ny = -by, bx
    if kind == 'arrow':
        for k in range(1, min(3, len(pts))):
            px, py = pts[k]
            put(g, px + nx + 0.5, py + ny + 0.5, FEATHER_LIT, over=False)
            put(g, px - nx + 0.5, py - ny + 0.5, FEATHER_DARK, over=False)
        put(g, pts[0][0] + 0.5, pts[0][1] + 0.5, THREAD)
    out = outline(g)
    if where == 'ground':
        # The sand thrown up where it went in.
        for dx in (-1, 0, 1):
            if out[PIVOT[1] + 1][PIVOT[0] + dx] == T:
                out[PIVOT[1] + 1][PIVOT[0] + dx] = DIVOT
    return out


def lying(d4):
    """An arrow lying flat where it fell at the foot of stone."""
    a = math.pi * d4 / 4
    g = blank(W, H)
    missile(g, PIVOT[0] + 0.5, PIVOT[1] - 0.5, round(math.cos(a), 9), round(math.sin(a), 9) * 0.7,
            ARROW_LEN, 'arrow')
    return outline(g)


def broken(d4):
    """A broken arrow: the head end and the fletched end apart, splinters between."""
    a = math.pi * d4 / 4 + 0.3
    ux, uy = math.cos(a), math.sin(a) * 0.7
    g = blank(W, H)
    # The fletched half, and the head half kinked away from it.
    missile(g, PIVOT[0] - ux * 4 + 0.5, PIVOT[1] - uy * 4 - 0.5, ux, uy, 8, 'arrow')
    b = a + 0.7
    vx, vy = math.cos(b), math.sin(b) * 0.7
    hx, hy = PIVOT[0] + ux * 3 + 0.5, PIVOT[1] + uy * 3 - 0.5
    stroke(g, hx, hy, hx + vx * 6, hy + vy * 6,
           lambda t: IRON_LIT if t > 0.85 else (IRON if t > 0.6 else ASH))
    put(g, PIVOT[0] + 0.5, PIVOT[1] - 1.5, SPLINTER, over=False)
    put(g, PIVOT[0] + 1.5, PIVOT[1] + 0.5, SPLINTER, over=False)
    return outline(g)


def shadow():
    """The soft 3 x 1 shadow under a missile in flight (Book 10 section 21, shadow): darkest in the
    middle, drawn on the ground below the missile, offset from it by its height."""
    g = blank(W, H)
    g[PIVOT[1]][PIVOT[0] - 1] = c('sand', 2)
    g[PIVOT[1]][PIVOT[0]] = c('sand', 1)
    g[PIVOT[1]][PIVOT[0] + 1] = c('sand', 2)
    return g


def write_sheet(name, w, h, pivot, anims, notes):
    lines = ['# Generated by assets/art/authoring/missiles.py. Do not edit by hand: change the script',
             '# and run python3 assets/art/authoring/missiles.py.']
    lines += [f'# {n}' for n in notes]
    lines += [f'sheet: {name}', 'kind: decal', 'palette: book07', f'size: {w}x{h}',
              f'pivot: {pivot[0]},{pivot[1]}', f'footprint: {w}x{h}', 'facings: -',
              'placeholder: false']
    for state, frames, ticks, loop in anims:
        lines.append(f'anim.{state}: frames {len(frames)}, ticks {ticks}' + (', loop' if loop else ''))
    lines.append('')
    for state, frames, _, _ in anims:
        for i, fr in enumerate(frames):
            assert len(fr) == h and all(len(r) == w for r in fr), f'{name} {state} {i}'
            lines += [f'frame {state} - {i}', text(fr), 'end', '']
    with open(os.path.join(SHEETS, f'{name}.txt'), 'w', encoding='utf8') as f:
        f.write('\n'.join(lines))


def glint(i):
    """The glint: a point of light that swells into a four-pointed star and dies back."""
    g = blank(9, 9)
    cx = cy = 4
    arms = [0, 1, 3, 2, 1][i]
    core = [c('fire', 6), c('fire', 7), c('fire', 7), c('fire', 7), c('fire', 6)][i]
    for k in range(1, arms + 1):
        col = c('fire', 6) if k < arms else c('beak', 2)
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            g[cy + dy][cx + dx] = col
    if i == 2:
        for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            g[cy + dy][cx + dx] = c('beak', 2)
    g[cy][cx] = core
    return g


# ------------------------------------------------------------------ the weapons on the strand
def ground(g, row):
    """Moves a drawing so its lowest drawn row is `row` (the outline then lands on the pivot)."""
    rows = [y for y, r in enumerate(g) if any(ch != T for ch in r)]
    d = row - rows[-1]
    out = blank(len(g[0]), len(g))
    for y in range(len(g)):
        if 0 <= y - d < len(g):
            out[y] = list(g[y - d])
    return out


PW, PH, PFOOT = 40, 18, 16


def seax_lying():
    """The seax in the wreck's debris: a broken, tarred plank end, and the knife lying across it,
    its blade catching the light."""
    g = blank(PW, PH)
    for x in range(6, 30):
        t = (x - 6) / 24
        top = round(10 + 1.5 * t)
        for y in range(top, top + 3):
            g[y][x] = 'P'
        if x % 7 == 3:
            g[top + 1][x] = 'n'
    for x, cut in [(6, 2), (7, 1), (29, 1)]:
        g[10 + (0 if x < 20 else 1)][x] = T if cut else g[10][x]
    # The seax: the grip with a brass ferrule, then the long single-edged blade, its back straight
    # and its edge running up to the point.
    for x in range(9, 15):
        g[8][x] = 'W'
        g[9][x] = 'W'
    g[8][14] = 'B'
    g[9][14] = 'B'
    g[8][8] = 'B'
    g[9][8] = 'B'
    for x in range(15, 31):
        g[8][x] = 'I'
        if x < 28:
            g[9][x] = 'I'
        if x < 24:
            g[10][x] = 'I'
    for x in range(16, 27):
        g[8][x] = 'e'
    return ground(g, PFOOT - 1)


def bow_lying():
    """The hunting bow lying strung by the stern, and its quiver beside it with the fletchings of
    the starting arrows showing."""
    g = blank(PW, PH)
    # The stave: a shallow curve across the canvas, thicker at the grip, its string straight.
    for x in range(3, 37):
        t = (x - 20) / 17
        y = round(9 - 4 * (1 - t * t))
        g[y][x] = 'Y'
        if abs(x - 20) < 3:
            g[y + 1][x] = 'M'
        if x in (3, 36):
            g[y][x] = 'H'
    for x in range(4, 36):
        if g[9][x] == T:
            g[9][x] = 'L'
    # The quiver: a leather tube lying at a slant, its strap, and the fletchings at its mouth.
    for k in range(14):
        x0 = 12 + k
        y0 = 15 - k // 3
        for y in range(y0 - 2, y0 + 1):
            g[y][x0] = 'Q'
    for k in range(3, 12, 4):
        g[15 - k // 3 - 1][12 + k] = 'q'
    for x, y in [(26, 10), (27, 10), (27, 9), (28, 11), (28, 10), (29, 11), (26, 11)]:
        g[y][x] = 'F'
    g[10][28] = 'r'
    return ground(g, PFOOT - 1)


def arrows_lying():
    """A few loose arrows lying together (arrows left over when the quiver is full)."""
    g = blank(PW, PH)
    for y0, x0 in [(9, 11), (11, 13), (13, 10)]:
        for x in range(x0, x0 + 16):
            g[y0][x] = 'S'
        g[y0][x0 + 15] = 'I'
        g[y0][x0 + 14] = 'I'
        g[y0][x0] = 'F'
        g[y0][x0 + 1] = 'F'
        g[y0][x0 + 3] = 'r'
    return ground(g, PFOOT - 1)


def line_lying():
    """The hand line from the salvage (Stage 7): wound on a driftwood winder, a bone hook and a
    stone sinker on its loose end."""
    g = blank(PW, PH)
    # The winder: a flat driftwood board, notched at both ends, lying across.
    for y in range(9, 14):
        for x in range(12, 27):
            g[y][x] = 'H'
    for x in (12, 13, 25, 26):
        g[11][x] = T
    # The line wound round its middle.
    for y in range(9, 14):
        for x in range(15, 24):
            if (x + y) % 2 == 0:
                g[y][x] = 'L'
    # The loose end, a stone sinker and a bone hook.
    for x, y in [(27, 12), (28, 12), (29, 13), (30, 13), (31, 13)]:
        g[y][x] = 'L'
    g[13][32] = 'I'
    g[12][32] = 'I'
    for x, y in [(33, 13), (34, 13), (34, 12)]:
        g[y][x] = 'S'
    return ground(g, PFOOT - 1)


def ring_lying():
    """The silver arm-ring in the rock pool (design addendum 2.4): a twisted ring of silver rod, its
    ends hooked, lying in the clear water of the pool, catching the light."""
    g = blank(PW, PH)
    for k in range(40):
        a = k / 40 * 2 * math.pi
        x = round(20 + math.cos(a) * 5)
        y = round(11 + math.sin(a) * 2.6)
        g[y][x] = 'I' if k % 3 else 'n'
    g[9][17] = 'e'
    g[13][22] = 'e'
    return ground(g, PFOOT - 1)


def binding_lying():
    """Linen bindings from the camp's salvage (combat v2: Book 10 bindingsAtCamp): two rolls of
    pale linen strip, one with its loose end trailing out across the ground, tied with wool."""
    g = blank(PW, PH)
    for cx in (15, 23):
        for y in range(8, 14):
            for x in range(cx - 3, cx + 4):
                if ((x - cx) / 3.4) ** 2 + ((y - 10.8) / 2.9) ** 2 <= 1:
                    g[y][x] = 'F'
        # The roll's turns, seen end-on.
        g[10][cx] = 'F'
        g[11][cx - 1] = 'L'
        g[10][cx + 1] = 'L'
    # The wool tie round the left roll.
    for y in range(8, 14):
        if g[y][15] == 'F':
            g[y][14] = 'M'
    # The loose end of the right roll, trailing out and lying flat.
    for x in range(26, 34):
        g[12 + (x > 29)][x] = 'F'
    g[13][33] = 'L'
    return ground(g, PFOOT - 1)


def spear_lying():
    """The user's third playtest (decision DG-4: the spared foe's weapon lies where it fell, as
    loot): Svart's spear on the ground, its ash shaft across the canvas and its iron head."""
    g = blank(PW, PH)
    for x in range(3, 31):
        y = 12 - (x - 3) // 9
        g[y][x] = 'S'
    for x in range(31, 37):
        g[9][x] = 'I'
        if x < 35:
            g[10][x] = 'I'
    g[9][37] = 'e'
    g[11][30] = 'M'
    return ground(g, PFOOT - 1)


def axe_lying():
    """Ketill's hand axe on the ground (decision DG-4), its haft across and the bearded head up."""
    g = blank(PW, PH)
    for x in range(10, 29):
        g[12 - (x - 10) // 10][x] = 'H'
    for y in range(6, 12):
        for x in range(28, 32 + (y > 8)):
            if not (y < 8 and x > 30):
                g[y][x] = 'I'
    g[6][28] = 'e'
    g[11][32] = 'e'
    return ground(g, PFOOT - 1)


def write_pickups():
    def frame(state, g):
        return f'frame {state} - 0\n{text(g)}\nend'
    body = '\n\n'.join([frame('seax', seax_lying()), frame('bow', bow_lying()),
                         frame('arrow', arrows_lying()), frame('fishing_line', line_lying()),
                         frame('silver_arm_ring', ring_lying()),
                         frame('binding', binding_lying()),
                         frame('spear', spear_lying()), frame('axe', axe_lying())])
    with open(os.path.join(MAPS, 'prop_pickup.map.txt'), 'w', encoding='utf8') as f:
        f.write(f"""# The starting weapons lying on Wreck Strand (Book 10 section 21, \"Starting weapons\"): the seax
# across a tarred plank in the wreck's debris, the hunting bow strung with its quiver by the
# stern, loose arrows, the hand line from the salvage at the broch (Stage 7), the silver arm-ring in
# the rock pool and the linen bindings in the camp's salvage (design addendum 2.4). Each state is named as its item's hotbar icon. Generated by
# assets/art/authoring/missiles.py.
sheet: prop_pickup
kind: prop
palette: book07
size: {PW}x{PH}
pivot: 20,{PFOOT}
footprint: 24x4
shadow: 26x5
facings: -
placeholder: false
anim.seax: frames 1, ticks 1
anim.bow: frames 1, ticks 1
anim.arrow: frames 1, ticks 1
anim.fishing_line: frames 1, ticks 1
anim.silver_arm_ring: frames 1, ticks 1
anim.binding: frames 1, ticks 1
anim.spear: frames 1, ticks 1
anim.axe: frames 1, ticks 1
outline: ink 0 4
material.P: tar 1 3 4
material.W: bracken 2 3 4
material.B: beak 0 1 2
material.I: stone 5 7 9
material.Y: bracken 2 3 4
material.M: madder 1 2 3
material.H: driftwood 4 5 6
material.L: wool 4 5 6
material.Q: earth 2 3 5
material.F: gull 2 3 4
material.S: driftwood 4 6 7
mark.n: stone 6
mark.e: stone 9
mark.q: earth 1
mark.r: madder 3

{body}
""")


if __name__ == '__main__':
    write_pickups()
    write_sheet('fx_missile', W, H, PIVOT, [
        ('arrow', [flight('arrow', d) for d in range(16)], 1, False),
        ('spear', [flight('spear', d) for d in range(16)], 1, False),
        ('stuck_ground', [at_rest('arrow', d, 'ground') for d in range(8)], 1, False),
        ('stuck_wood', [at_rest('arrow', d, 'wood') for d in range(8)], 1, False),
        ('stuck_shield', [at_rest('arrow', d, 'shield') for d in range(8)], 1, False),
        ('stuck_body', [at_rest('arrow', d, 'body') for d in range(8)], 1, False),
        ('lying', [lying(d) for d in range(4)], 1, False),
        ('broken', [broken(d) for d in range(4)], 1, False),
        ('spear_ground', [at_rest('spear', d, 'ground') for d in range(8)], 1, False),
        ('spear_wood', [at_rest('spear', d, 'wood') for d in range(8)], 1, False),
        ('shadow', [shadow()], 1, False),
    ], ['Missiles (Book 10 section 21; Book 7 sections 07 and 11). In flight: frame = direction, 0 east,',
        'clockwise; the middle of the missile at the pivot. At rest: frame = the direction it flew,',
        'in 8 (lying and broken: 4), with the point of entry at the pivot. shadow: the soft 3 x 1',
        'shadow on the ground under a missile in flight (Book 10 section 21), at the pivot.'])
    write_sheet('fx_glint', 9, 9, (4, 4), [('glint', [glint(i) for i in range(5)], 4, False)],
                ['The glint on something worth picking up (Book 7 section 14: a glint on a ledge;',
                 'Book 10 section 21, seaxFoundBy: marked by a glint). Played every few seconds.'])
    print('wrote fx_missile and fx_glint')

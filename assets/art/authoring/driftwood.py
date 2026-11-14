"""Builds the material map for the pieces of driftwood the steerer picks up on Wreck Strand
(decisions PT-2 and PT-5; Book 7 sections 10 and 14).

    python3 assets/art/authoring/driftwood.py && npm run art:sheets && npm run art:compile

Three shapes, each also drawn the other way round: a bleached forked branch, a short log with its
root knot, and a broken spar with a trenail through it. Silver-grey wood from the palette's
driftwood ramp, a darker wet underside, grain and a knot hole; a frond of wrack caught on each that
stirs in the west wind (four frames, its loose end streaming east whichever way the wood lies).
The contact shadow is declared, as for the strand's other props; outlines and the three tones lit
from the upper left are added by the generator (src/tools/art/materials.ts).
"""
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
MAPS = os.path.join(REPO, 'assets', 'art', 'maps')
W, H = 40, 16
FOOT = 14  # the pivot row: the outline under the lowest drawn row lands on it


def blank():
    return [['.'] * W for _ in range(H)]


def limb(g, x0, y0, x1, y1, r0, r1, ch='D'):
    """A tapering limb from (x0, y0) to (x1, y1), radius r0 to r1."""
    for y in range(H):
        for x in range(W):
            px, py = x + .5, y + .5
            dx, dy = x1 - x0, y1 - y0
            t = max(0.0, min(1.0, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)))
            cx, cy = x0 + dx * t, y0 + dy * t
            if math.hypot(px - cx, (py - cy) * 1.15) <= r0 + (r1 - r0) * t:
                g[y][x] = ch


def wet_underside(g):
    """The lowest row of wood in each column is darker and damp: it lay on the wet shingle."""
    for x in range(W):
        col = [y for y in range(H) if g[y][x] in 'DE']
        if col:
            g[col[-1]][x] = 'E'


def grain(g, cells, mark='g'):
    for x, y in cells:
        if 0 <= y < H and 0 <= x < W and g[y][x] == 'D':
            g[y][x] = mark


def branch():
    g = blank()
    limb(g, 6, 10.6, 32, 9.4, 2.4, 1.3)          # the main limb, thinning to the east
    limb(g, 20, 9.2, 31, 2.6, 1.1, 0.6)          # the fork rising from it
    limb(g, 27.5, 4.6, 33.5, 5.4, 0.7, 0.5)      # a twig off the fork
    limb(g, 11, 9.8, 13.5, 6.8, 1.0, 0.7)        # a snapped-off twig stub
    limb(g, 4.2, 10.8, 6.0, 10.6, 2.7, 2.5)      # the thick broken end
    wet_underside(g)
    grain(g, [(9, 11), (10, 11), (11, 11), (15, 10), (16, 10), (17, 10), (24, 10), (25, 10)])
    grain(g, [(22, 7), (23, 6)])
    grain(g, [(5, 10), (5, 11)], 'h')            # the dark heart of the broken end
    return g


def log():
    g = blank()
    limb(g, 9, 9.6, 27, 9.0, 3.1, 2.7)           # a short round log
    for (cx, cy, rx, ry) in [(29.5, 8.2, 3.2, 3.6), (31.5, 11.0, 2.4, 1.8), (28.0, 12.2, 2.2, 1.4)]:
        for y in range(H):                       # the root knot at its east end
            for x in range(W):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    g[y][x] = 'D'
    limb(g, 33, 9.2, 35.5, 7.8, 0.8, 0.6)        # a root's broken end
    wet_underside(g)
    # The broken west end shows its rings (a pale face, a dark ring, the heart); grain runs along.
    for y in range(H):
        for x in range(W):
            d = math.hypot((x + .5 - 7.6) * 1.4, y + .5 - 9.6)
            if g[y][x] == 'D' and x <= 9 and 1.2 <= d < 2.2:
                g[y][x] = 'g'
            elif g[y][x] == 'D' and x <= 9 and d < 0.9:
                g[y][x] = 'h'
    grain(g, [(12, 8), (13, 8), (14, 8), (19, 10), (20, 10), (21, 10), (22, 10), (16, 7), (17, 7)])
    grain(g, [(30, 7), (29, 9)], 'h')            # knot holes in the root
    return g


def spar():
    g = blank()
    for x in range(4, 34):                       # a broken spar, squared by the adze long ago
        t = (x - 4) / 30
        top = 7 + round(t * 1.6)
        for y in range(top, top + 5):
            g[y][x] = 'D'
        g[top + 2][x] = 'g' if x % 7 else 'D'    # the edge of its adzed face
    for (x, y) in [(34, 8), (34, 9), (35, 9), (35, 10), (36, 10), (34, 11), (34, 12), (33, 13)]:
        g[y][x] = 'D'                            # the splintered end
    for (x, y) in [(4, 7), (5, 7), (4, 10)]:
        g[y][x] = '.'                            # the worn west end
    wet_underside(g)
    for (x, y) in [(15, 8), (16, 8), (15, 10), (16, 10)]:
        g[y][x] = 't'                            # a tarred trenail through it
    for (x, y) in [(26, 9)]:
        g[y][x] = 'h'                            # a knot hole
    return g


def mirror(g):
    return [list(reversed(r)) for r in g]


def frond(g, k, phase):
    """A strand of wrack draped over the wood. Its loose end streams east in the wind: frame k."""
    rows = [y for y in range(H) if any(c in 'DEgh' for c in g[y])]
    top = rows[0]
    cols = [x for x in range(W) if any(g[y][x] in 'DEgh' for y in range(H))]
    x0 = cols[0] + (len(cols) * (2 + phase)) // 7
    # Where it lies over the wood: from the top edge down the near side.
    lie = [(x0, top), (x0 + 1, top), (x0 + 1, top + 1), (x0 + 2, top + 1)]
    lift = [0, 1, 2, 1][k]
    reach = [0, 1, 1, 0][k]
    tail = [(x0 + 3, top + 1 - lift // 2), (x0 + 4 + reach, top + 1 - lift),
            (x0 + 5 + reach, top + 1 - lift)]
    if k in (1, 2):
        tail.append((x0 + 6 + reach, top - lift))
    for (x, y) in lie + tail:
        if 0 <= y < H and 0 <= x < W:
            g[y][x] = 'K'
    # The blade's bladder catches the light.
    bx, by = tail[-1]
    if 0 <= by < H and 0 <= bx < W:
        g[by][bx] = 'b'
    return g


def ground(g):
    rows = [y for y, r in enumerate(g) if any(c != '.' for c in r)]
    d = (FOOT - 1) - rows[-1]
    out = [['.'] * W for _ in range(H)]
    for y in range(H):
        if 0 <= y - d < H:
            out[y] = list(g[y - d])
    return out


def text(g):
    return '\n'.join(''.join(r) for r in g)


SHAPES = [('branch', branch(), 0), ('log', log(), 1), ('spar', spar(), 2)]
STATES = []
for name, g, phase in SHAPES:
    STATES.append((name, g, phase))
    STATES.append((f'{name}_r', mirror(g), phase + 1))

body = []
for name, g, phase in STATES:
    for k in range(4):
        f = ground(frond([list(r) for r in g], k, phase))
        body.append(f'\nframe {name} - {k}\n{text(f)}\nend')
anims = '\n'.join(f'anim.{name}: frames 4, ticks 15, loop' for name, _, _ in STATES)

with open(os.path.join(MAPS, 'prop_driftwood.map.txt'), 'w') as f:
    f.write(f"""# Pieces of driftwood to pick up on Wreck Strand (decisions PT-2 and PT-5): a bleached forked
# branch, a short log with its root knot and a broken spar with a trenail, each also drawn the other
# way round, with a frond of wrack that stirs in the west wind. Generated by
# assets/art/authoring/driftwood.py.
sheet: prop_driftwood
kind: prop
palette: book07
size: {W}x{H}
pivot: 20,{FOOT}
footprint: 14x3
shadow: 30x6
facings: -
placeholder: false
{anims}
outline: ink 0 4
material.D: driftwood 3 5 6
material.E: driftwood 2 3 4
material.K: kelp 2 4 6
mark.g: driftwood 4
mark.h: driftwood 2
mark.t: tar 1
mark.b: kelp 6
{''.join(body)}
""")
print('wrote assets/art/maps/prop_driftwood.map.txt')

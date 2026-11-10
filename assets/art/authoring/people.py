"""Builds the material maps for the steerer's body models A and B and for Hild.

    python3 assets/art/authoring/people.py && npm run art:sheets && npm run art:compile
"""
import re, sys
import os
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

def read_blocks(path):
    text = open(path).read()
    blocks = {}
    for m in re.finditer(r'^frame (\S+ \S+ \d+)\n(.*?)\nend$', text, re.S | re.M):
        blocks[m.group(1)] = [list(r) for r in m.group(2).split('\n')]
    return blocks

A = read_blocks(f'{REPO}/assets/art/maps/actor_p_steerer_a.map.txt')
base = {f: A[f'idle {f} 0'] for f in 's n e'.split()}

def blank(w, h):
    return [['.'] * w for _ in range(h)]

def copy(g):
    return [r[:] for r in g]

def fill(g, x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= y < len(g) and 0 <= x < len(g[0]):
                g[y][x] = ch

def replace(g, x0, y0, x1, y1, old, new):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if g[y][x] in old:
                g[y][x] = new

def pad(g, left, right):
    return [['.'] * left + r + ['.'] * right for r in g]

def text(g):
    return '\n'.join(''.join(r) for r in g)

# ---------------------------------------------------------------- gaits
def box(x0, y0, x1, y1, dx, dy, only=None, fill=None):
    tail = f'@{only}/{fill}' if only else ''
    return f'{x0},{y0},{x1},{y1}:{dx},{dy}{tail}'

def gaits(ox, hands_sn, hand_e):
    """Move lists per state and facing (Book 7 section 14: grounded cycles with arm swing)."""
    X = lambda x: x + ox
    L, R = (X(11), X(14)), (X(17), X(20))          # front and back views: screen-left, right leg
    def lower(leg, up):
        return box(leg[0], 31, leg[1], 38, 0, -up)
    def hand(h, dy=0, dx=0):
        return box(h[0], 25, h[1], 26, dx, dy)
    hl, hr = hands_sn
    he = hand_e
    j = lambda *parts: ' '.join(p for p in parts if p) or '-'
    out = {}
    # Walk, 8 frames: contact, down, passing, up for each foot; the opposite arm swings.
    swing_l = lambda: [hand(hl, 1), hand(hr, -1)]
    swing_r = lambda: [hand(hr, 1), hand(hl, -1)]
    out['walk.s'] = out['walk.n'] = [
        '-', j(lower(R, 1), *swing_l()), j(lower(R, 2), *swing_l()), j(lower(R, 1), *swing_l()),
        '-', j(lower(L, 1), *swing_r()), j(lower(L, 2), *swing_r()), j(lower(L, 1), *swing_r())]
    # In profile the near hand swings forward as the near leg goes back.
    arm = lambda dx: box(he[0], 25, he[1], 26, dx, 0, 'F', 'T') if dx else ''
    out['walk.e'] = [j(arm(d)) for d in (-1, -1, 0, 1, 1, 1, 0, -1)]
    # Run, 8 frames: higher lifts and a forward lean.
    out['run.s'] = out['run.n'] = [
        '-', j(lower(L, 2), *swing_r()), j(lower(L, 3), *swing_r()), j(lower(L, 1)),
        '-', j(lower(R, 2), *swing_l()), j(lower(R, 3), *swing_l()), j(lower(R, 1))]
    lean = box(X(0), 0, X(31), 28, 1, 0)
    out['run.e'] = [j(lean, arm(d)) for d in (-2, -1, 0, 1, 2, 1, 0, -1)]
    # Sneak, 6 frames: crouched (drop), short careful steps, leaning in profile.
    out['sneak.s'] = out['sneak.n'] = ['-', j(lower(L, 1)), '-', '-', j(lower(R, 1)), '-']
    stoop = box(X(0), 0, X(31), 29, 2, 0)
    out['sneak.e'] = [stoop] * 6
    # Carry, 6 frames: careful steps, hands up at the shoulders holding the load.
    up_sn = [hand(hl, -8), hand(hr, -8)]
    out['carry.s'] = out['carry.n'] = [j(*up_sn, *(f.split() if f != '-' else [])) for f in [
        '-', lower(L, 1), lower(L, 2), '-', lower(R, 1), lower(R, 2)]]
    out['carry.e'] = [hand(he, -8)] * 6
    # Looking round: the eyes go to one side, then the other (not from behind).
    eyes_s = lambda d: box(13, 12, 18, 12, d, 0, 'e', 'F')
    out['look.s'] = [eyes_s(-1), eyes_s(-1), eyes_s(1), eyes_s(1)]
    out['look.e'] = ['-', box(17, 12, 19, 12, -1, 0, 'e', 'F'), box(17, 12, 19, 12, -1, 0, 'e', 'F'), '-']
    return out

# Profile stride cycles: (ankle offset from the hip, lift) per frame for the near leg; the far leg
# runs half a cycle behind. A planted foot moves back 3 pixels a frame: at 4 ticks a frame that is
# 45 pixels a second against a walk of 48 (2.0 tiles), so the feet do not glide (AP-1).
CYCLES = {
    'walk': [(6, 0), (3, 0), (0, 0), (-3, 0), (-6, 0), (-4, 2), (0, 3), (4, 2)],
    'run': [(7, 0), (3, 0), (-1, 0), (-5, 0), (-7, 2), (-3, 4), (2, 4), (6, 2)],
    'sneak': [(4, 0), (1, 0), (-2, 0), (-4, 0), (-1, 1), (2, 1)],
    'carry': [(4, 0), (1, 0), (-2, 0), (-4, 0), (-1, 1), (2, 1)],
}

def draw_leg(g, hip, dx, lift, far, ox):
    trousers, wraps, shoe = ('M', 'V', 'Z') if far else ('L', 'W', 'S')
    ankle = 36 - lift
    for row in range(29, ankle + 1):
        t = (row - 29) / max(1, ankle - 29)
        # A slight knee bend on the lifted leg: the shin trails behind the thigh.
        bend = (lift > 0) * (1 if 0.3 < t < 0.8 else 0)
        x = round(hip + dx * t) + ox - bend
        ch = trousers if row <= 30 else wraps
        g[row][x] = ch
        g[row][x + 1] = ch
    ax = round(hip + dx) + ox
    for x in range(ax, ax + 3):
        g[ankle + 1][x] = shoe
    for x in range(ax - 1, ax + 3):
        g[ankle + 2][x] = shoe

def profile_frames(pose_e, state, ox=0):
    cycle = CYCLES[state]
    n = len(cycle)
    frames = []
    for i in range(n):
        g = copy(pose_e)
        for y in range(29, 39):
            for x in range(len(g[0])):
                g[y][x] = '.'
        far = cycle[(i + n // 2) % n]
        near = cycle[i]
        draw_leg(g, 15, far[0], far[1], True, ox)
        draw_leg(g, 15, near[0], near[1], False, ox)
        frames.append(g)
    return frames

GAIT_HEADERS = """anim.idle: frames 4, ticks 15, loop
anim.look: frames 4, ticks 22, loop
anim.idlewind: frames 4, ticks 9, loop
anim.walk: frames 8, ticks 4, loop
anim.run: frames 8, ticks 3, loop
anim.sneak: frames 6, ticks 5, loop
anim.carry: frames 6, ticks 5, loop
event.footstep: walk 0, walk 4, run 0, run 4, sneak 0, sneak 3, carry 0, carry 3"""

def gait_lines(moves):
    return '\n'.join(f'move.{k}: {" | ".join(v)}' for k, v in moves.items())

BOBS = """# Idle breath: the head and shoulders settle one pixel on frames 1 and 2.
bob.idle: 0 1 1 0 above 27
bob.look: 0 0 1 1 above 27
bob.idlewind: 0 1 1 0 above 27
# Steps: the body is lowest through contact and down, highest through passing and up.
bob.walk: 1 1 0 0 1 1 0 0 above 29
bob.run: 1 0 0 0 1 0 0 0 above 29
bob.carry: 1 0 0 1 0 0 above 29
derive.look: idle
derive.idlewind: idle
derive.walk: idle
derive.run: idle
derive.sneak: idle
derive.carry: idle
# Sneaking crouches three pixels; carrying bends the knees one.
drop.sneak: 30 32
drop.carry: 30 30"""

STEERER_MATERIALS = """# Hue-shifted ramps (Book 7 section 14): ramp, then shadow, base and highlight steps.
material.H: {hair} 1 2 4
material.F: skin_light 2 3 4
material.T: madder 1 3 4
material.C: weld 1 3 4
material.L: woad 1 2 4
material.W: wool 2 3 5
material.S: tar 1 2 4
material.B: tar 0 1 2
# The far leg in profile, a shade darker so the two legs read apart.
material.M: woad 0 1 2
material.V: wool 1 2 3
material.Z: tar 0 1 2
mark.e: ink 0
mark.p: trefoil 3
# Folds drawn in the material's shadow tone.
mark.f: weld 1
mark.q: madder 1"""

def steerer_map(name, intro, poses, hands_sn, hand_e, hair='hair_brown'):
    head = f"""{intro}
sheet: {name}
kind: sprite
palette: book07
size: 32x40
pivot: 16,39
footprint: 10x4
shadow: 14x5
facings: s n e w
placeholder: false
{GAIT_HEADERS}
outline: ink 0 4
{STEERER_MATERIALS.format(hair=hair)}
{BOBS}
{gait_lines(gaits(0, hands_sn, hand_e))}
# The cloak streams downwind (east) in a gust; applied after mirroring.
flutter.idlewind: C 1 2 3 2
# West is east mirrored before shading, so light still falls from the upper left (unarmed only).
mirror.w: e
"""
    body = '\n'.join(f'\nframe idle {f} 0\n{text(poses[f])}\nend' for f in 's n e'.split())
    # Each gait needs base poses for every facing once its profile frames are drawn.
    for state in CYCLES:
        for f in 's n'.split():
            body += f'\n\nframe {state} {f} 0\n{text(poses[f])}\nend'
        for i, g in enumerate(profile_frames(poses['e'], state)):
            body += f'\n\nframe {state} e {i}\n{text(g)}\nend'
    return head + body + '\n'

INTRO_A = '''# The steerer, body model A (Book 7 section 07: Norse household dress: knee-length tunic,
# trousers with wrapped leg-bindings, a cloak pinned at the shoulder), with idle, a look round, an
# idle in the wind, walk, run, sneak and carry (Book 7 section 14). Authored by Claude, Stages 4
# and 6 and the art-direction pass. The two body models are offered unlabelled.
# Generated by assets/art/authoring/people.py; edit that script, not this map.
# Material map: run npm run art:sheets to generate assets/art/sheets/actor_p_steerer_a.txt.'''

INTRO_B = '''# The steerer, body model B (Book 7 section 07): the same dress and the same animation set and
# collision footprint as model A, on a slighter frame with the hair grown long and tied back.
# Authored by Claude, Stage 6 and the art-direction pass. The two body models are offered unlabelled.
# Generated by assets/art/authoring/people.py; edit that script, not this map.'''

# ---------------------------------------------------------------- body model B
def model_b():
    out = {}
    for f in 's n'.split():
        g = copy(base[f])
        # Narrower shoulders and hips: the outer cloak columns go, the hands come in a pixel.
        for y in range(16, 27):
            for x in (9, 22):
                g[y][x] = '.'
        for y in (25, 26):
            g[y][10] = 'F'
            g[y][21] = 'F'
        for y in (27, 28):
            g[y][11] = '.'
            g[y][20] = '.'
        # A narrower waist above the belt.
        for y in (21, 22, 23):
            if g[y][10] == 'C': g[y][10] = '.'
            if g[y][21] == 'C': g[y][21] = '.'
        out[f] = g
    # Front: the tied-back hair shows as a fuller crown.
    s = out['s']
    s[8][13] = 'H'; s[8][18] = 'H'
    # Back: a long tail of hair down the cloak.
    n = out['n']
    for y in range(16, 25):
        n[y][15] = 'H'; n[y][16] = 'H'
    n[25][15] = 'H'
    e = copy(base['e'])
    # Profile: slighter chest and back, and the tail of hair behind the head.
    for y in range(22, 28):
        if e[y][11] in 'C': e[y][11] = '.'
    for y in range(13, 23):
        e[y][12] = 'H'
    e[23][12] = 'H'; e[14][13] = 'H'
    out['e'] = e
    return out

# ---------------------------------------------------------------- Hild
def hild_standing():
    """Hild standing: from the household template, recoloured and reshaped (Book 5, Book 7)."""
    out = {}
    for f in 's n e'.split():
        g = copy(base[f])
        # A green shawl instead of the cloak; woad tunic; brown trousers.
        replace(g, 0, 0, 31, 39, 'C', 'U')
        out[f] = g
    s, n, e = out['s'], out['n'], out['e']
    # Braid over her right shoulder at the front, down her back, behind the head in profile.
    for y in range(15, 25):
        s[y][19] = 'H'
    s[25][19] = 'h'
    for y in range(16, 26):
        n[y][15] = 'H'; n[y][16] = 'H'
    n[26][15] = 'h'; n[26][16] = 'h'
    for y in range(13, 25):
        e[y][13] = 'H'
    e[25][13] = 'h'
    # The wound: her left leg bound in linen, stained.
    for g, x0, x1 in ((s, 17, 19), (n, 12, 14), (e, 17, 18)):
        fill(g, x0, 32, x1, 34, 'l')
        g[33][x0 + 1] = 'd'
    return out

def hild_down():
    """Lying on her side, knees drawn up, propped on an elbow, one arm raised to call."""
    g = blank(32, 40)
    fill(g, 0, 33, 2, 37, 'S')            # feet
    fill(g, 3, 34, 7, 37, 'W')            # leg-wraps, knees bent
    fill(g, 4, 34, 6, 36, 'l'); g[35][5] = 'd'   # the bound wound
    fill(g, 8, 32, 13, 37, 'L')           # trousers
    fill(g, 12, 30, 24, 36, 'T')          # tunic
    fill(g, 12, 34, 24, 34, 'B')          # belt
    fill(g, 19, 28, 25, 33, 'U')          # shawl over the shoulder
    fill(g, 22, 34, 23, 38, 'F')          # propping forearm
    fill(g, 21, 38, 24, 38, 'F')
    fill(g, 24, 22, 29, 29, 'H')          # head: hair
    g[22][24] = '.'; g[22][29] = '.'; g[29][29] = '.'
    fill(g, 28, 24, 30, 28, 'F')          # face, turned east
    g[24][30] = '.'
    g[25][29] = 'e'
    fill(g, 22, 27, 23, 31, 'H')          # braid falling over the shoulder
    fill(g, 25, 19, 26, 27, 'F')          # the raised, calling arm
    fill(g, 24, 16, 27, 18, 'F')          # her hand
    g[16][24] = '.'; g[16][27] = '.'
    # One column narrower, so the outline fits inside the canvas on both sides.
    return [r[:3] + r[4:] + ['.'] for r in g]

def hild_carried_s():
    """Across the steerer's shoulders, seen from the front: head and arms hang to one side."""
    g = blank(32, 40)
    fill(g, 0, 16, 5, 22, 'H')            # head, hanging
    fill(g, 2, 19, 4, 21, 'F'); g[20][3] = 'e'
    fill(g, 1, 23, 2, 28, 'H')            # braid hanging down
    fill(g, 4, 22, 5, 27, 'F')            # arms hanging
    fill(g, 5, 16, 24, 21, 'T')           # body over the shoulders
    fill(g, 5, 15, 16, 16, 'U')           # shawl on her back
    fill(g, 18, 21, 19, 21, 'B')
    fill(g, 22, 16, 27, 21, 'L')          # thighs
    fill(g, 27, 18, 29, 25, 'W')          # lower legs hanging
    fill(g, 27, 20, 29, 22, 'l'); g[21][28] = 'd'
    fill(g, 27, 26, 30, 27, 'S')          # feet
    # Keep the steerer's face clear: her body passes behind the head, below the chin.
    for y in range(14, 19):
        for x in range(13, 19):
            g[y][x] = '.'
    # One column narrower, so the outline fits inside the canvas on both sides.
    return [r[:8] + r[9:] + ['.'] for r in g]

def hild_carried_e():
    """Across the shoulders, seen from the side: her body end-on, her legs hanging in front."""
    g = blank(40, 40)
    fill(g, 15, 14, 25, 21, 'T')
    fill(g, 15, 13, 24, 14, 'U')
    fill(g, 13, 15, 15, 19, 'H')          # top of her head, hanging behind
    fill(g, 21, 21, 24, 25, 'L')          # thighs over the front
    fill(g, 21, 26, 23, 31, 'W')
    fill(g, 21, 27, 23, 29, 'l'); g[28][22] = 'd'
    fill(g, 21, 32, 24, 33, 'S')
    # The steerer's face, looking east, stays clear.
    for y in range(9, 16):
        for x in range(19, 25):
            g[y][x] = '.'
    return g

def hild_sit_s():
    g = blank(40, 40)
    fill(g, 17, 14, 22, 21, 'H')
    fill(g, 18, 16, 21, 20, 'F'); g[17][18] = 'e'; g[17][21] = 'e'
    g[16][18] = 'F'; g[16][21] = 'F'
    fill(g, 23, 19, 23, 27, 'H')          # braid
    fill(g, 14, 22, 25, 25, 'U')          # shawl
    fill(g, 15, 26, 24, 32, 'T')          # tunic, seated
    fill(g, 15, 31, 24, 31, 'B')
    fill(g, 13, 26, 14, 31, 'F')          # her hand pressing the hurt leg
    fill(g, 14, 33, 18, 35, 'L'); fill(g, 21, 33, 25, 35, 'L')   # legs towards us
    fill(g, 14, 36, 18, 37, 'W'); fill(g, 21, 36, 25, 37, 'l'); g[36][23] = 'd'
    fill(g, 14, 38, 18, 38, 'S'); fill(g, 21, 38, 25, 38, 'S')
    return g

def hild_sit_n():
    g = blank(40, 40)
    fill(g, 17, 14, 22, 21, 'H')
    fill(g, 19, 22, 20, 28, 'H')          # braid down her back
    fill(g, 14, 22, 25, 25, 'U')
    fill(g, 15, 26, 24, 33, 'T')
    for y in range(22, 26):
        g[y][19] = 'H'; g[y][20] = 'H'
    fill(g, 13, 34, 26, 35, 'T')          # the tunic spread on the ground
    fill(g, 13, 36, 15, 37, 'S'); fill(g, 24, 36, 26, 37, 'S')   # feet showing beyond
    return g

def hild_sit_e():
    g = blank(40, 40)
    fill(g, 11, 15, 17, 22, 'H')
    fill(g, 15, 17, 18, 21, 'F'); g[18][17] = 'e'
    g[15][11] = '.'; g[22][17] = '.'
    fill(g, 10, 20, 11, 28, 'H')          # braid behind
    fill(g, 10, 23, 18, 26, 'U')
    fill(g, 11, 27, 18, 35, 'T')
    fill(g, 11, 33, 18, 33, 'B')
    fill(g, 18, 33, 27, 37, 'L')          # legs out east
    fill(g, 28, 33, 32, 37, 'W'); fill(g, 29, 33, 31, 35, 'l'); g[34][30] = 'd'
    fill(g, 33, 30, 35, 37, 'S')
    fill(g, 22, 30, 24, 32, 'F')          # hand resting on her leg
    return g

def margin(g, dx):
    """Shifts a pose right by dx, keeping a pixel clear for the outline at the canvas edge."""
    return [['.'] * dx + r[:len(r) - dx] for r in g]

def crop(g, left):
    """A 40-wide drawing cut to the 32 x 40 adult canvas, `left` columns in."""
    out = [r[left:left + 32] for r in g]
    assert all(c == '.' for r in g for c in r[:left] + r[left + 32:]), 'pose wider than the canvas'
    return out

def ground(g):
    """Lowers a pose so its lowest pixel stands on row 38 (the outline then sits on the pivot)."""
    rows = [y for y, r in enumerate(g) if any(c != '.' for c in r)]
    shift = 38 - rows[-1]
    w = len(g[0])
    return [['.'] * w for _ in range(shift)] + g[:len(g) - shift] if shift > 0 else g

def hild_map():
    st = hild_standing()
    moves = gaits(0, ((9, 10), (21, 22)), (16, 17))
    walk = {k: v for k, v in moves.items() if k.startswith(('walk.', 'look.'))}
    head = f'''# Hild Thorkelsdottir (C_HILD; Book 5): fisher and sailor, Thorkel's daughter, the steerer's
# cousin. Norse household dress (Book 7 section 07) without the cloak she lost to the sea: a shawl
# of weld-green wool, a woad tunic, brown trousers, a blond braid; her left leg is bound where the
# wreck hurt it. States: idle and walk; down (lying, calling, Book 7 downed 2); carried (across the
# steerer's shoulders, in step with the steerer's carry); sit (set down safe, breathing); look and
# idlewind (Book 7 section 14). Authored by Claude, Stage 6 and the art-direction pass.
# Generated by assets/art/authoring/people.py; edit that script, not this map.
sheet: actor_c_hild
kind: sprite
palette: book07
size: 32x40
pivot: 16,39
footprint: 10x4
shadow: 14x5
facings: s n e w
placeholder: false
anim.idle: frames 4, ticks 15, loop
anim.look: frames 4, ticks 22, loop
anim.idlewind: frames 4, ticks 9, loop
anim.walk: frames 8, ticks 4, loop
anim.down: frames 2, ticks 24, loop
anim.carried: frames 6, ticks 12, loop
anim.sit: frames 4, ticks 18, loop
# Poses that are not a standing adult (art lint does not hold them to the standing size).
pose.down: lying
pose.carried: carried
pose.sit: seated
outline: ink 0 4
# Hue-shifted ramps (Book 7 section 14): ramp, then shadow, base and highlight steps.
material.H: hair_blond 2 3 5
material.F: skin_light 2 3 4
material.T: woad 1 3 4
material.U: weld 2 3 5
material.L: earth 2 3 5
material.W: wool 2 3 5
material.S: tar 1 2 4
material.B: tar 0 1 2
material.l: wool 4 5 6
material.M: earth 1 2 3
material.V: wool 1 2 3
material.Z: tar 0 1 2
mark.e: ink 0
mark.p: trefoil 3
mark.f: wool 2
mark.q: woad 0
mark.h: hair_blond 1
mark.d: 7
bob.idle: 0 1 1 0 above 27
bob.look: 0 0 1 1 above 27
bob.idlewind: 0 1 1 0 above 27
bob.walk: 1 1 0 0 1 1 0 0 above 29
bob.sit: 0 1 1 0 above 30
# Carried: in step with the steerer's carry (bent knees, then the step bob).
bob.carried: 2 1 1 2 1 1 above 40
derive.walk: idle
derive.look: idle
derive.idlewind: idle
{gait_lines(walk)}
# Her shawl and braid stream downwind (east) in a gust; applied after mirroring.
flutter.idlewind: U 1 2 2 1
# The calling arm waves.
move.down.e: - | 24,16,27,22:2,-1
# Lying and carried poses have no strong facing: south and north reuse east and west.
alias.down.s: e
alias.down.n: w
alias.carried.n: s mirror
alias.sit.w: e mirror
mirror.w: e
'''
    poses = [
        ('idle s 0', st['s']), ('idle n 0', st['n']), ('idle e 0', st['e']),
        ('walk s 0', st['s']), ('walk n 0', st['n']),
        *[(f'walk e {i}', g) for i, g in enumerate(profile_frames(st['e'], 'walk', 0))],
        ('down e 0', ground(margin(hild_down(), 1))),
        ('carried s 0', margin(hild_carried_s(), 1)), ('carried e 0', crop(hild_carried_e(), 4)),
        ('sit s 0', ground(crop(hild_sit_s(), 4))), ('sit n 0', ground(crop(hild_sit_n(), 4))),
        ('sit e 0', ground(crop(hild_sit_e(), 5))),
    ]
    return head + '\n'.join(f'\nframe {k}\n{text(g)}\nend' for k, g in poses) + '\n'

open(f'{REPO}/assets/art/maps/actor_p_steerer_a.map.txt', 'w').write(
    steerer_map('actor_p_steerer_a', INTRO_A, base, ((9, 10), (21, 22)), (16, 17)))
open(f'{REPO}/assets/art/maps/actor_p_steerer_b.map.txt', 'w').write(
    steerer_map('actor_p_steerer_b', INTRO_B, model_b(), ((10, 10), (21, 21)), (16, 17)))
open(f'{REPO}/assets/art/maps/actor_c_hild.map.txt', 'w').write(hild_map())
print('wrote 3 maps')

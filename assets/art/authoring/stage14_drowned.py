"""The drowned on the Skerry (Stage 14; Book 4 sections 07 and 12, Book 5, Book 7 section 09, Book 8
section 07 "The drowned on the Skerry", Book 9 section 03; decisions S14-18, S14-75 and S14-147 to
S14-150): five adults, new minor characters, and Thorkel among them if his rites were never
given. Each is drawn on the 32 x 48 canvas by the people generator (people48.py: the same
skeleton, projection, shading, outline and loose-cloth lag as every person in the game), from
the survivors' and the household's own builds, then composited from their layers and drawn in
the drowned's colder palette: every ramp stepped to a cold one at the same lightness (skin to the
sky's grey, cloth to the sea's, the stone's and the kelp's), water running from them though the
tide is out. No reserved accent (Book 7 section 08): they are the sea's at rest, not its light.

- Sigrid of Hvitness: a woman in a long dress, her hair pinned up in a knot; she kept her ring.
- Cellach of Skarvholm: a man of the people who kept the island before the Norse, long-haired,
  in a long tunic and a heavy cloak.
- Gunnar of Saltvik: a fisherman, bearded, in a tunic, no cloak, sleeves wet to the shoulder.
- Bergljot, a hostage: a young woman with a long braid, her hands tied in front of her.
- Donngal of the Faoilean: a fisherman, Finan's cousin, hair tied back, in a leine and a brat.
- Thorkel: his own build and dress (people48.py), drowned and unburied.

States: `idle` (at rest, the head a little bowed, water running down them in runnels), `shift`
(a slow sway), `speak` (the mouth moving, for the one who comes forward), `appear` (water
gathering on the rock and rising into the figure, 6 frames) and `fade` (the figure running back
down into the rock, 6 frames), and a person's walk and run (Book 7 section 01: every person's
body sheet has them; the drowned never walk). Adults only (Book 8: no child is among them).

    python3 assets/art/authoring/stage14_drowned.py && npm run art:compile

Writes assets/art/sheets/actor_c_drowned_<who>.txt (one composited sheet each) and the review
renders, docs/art/stage-14/drowned/ (each at 1x and 4x, and a GIF of them appearing, standing,
speaking and fading). Drawn and flagged for the user's review, not waited on (decision DH-2).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import people48 as P  # noqa: E402
import stage13_wreck_people as W  # noqa: E402

SHEETS = f'{P.REPO}/assets/art/sheets'
REVIEW = f'{P.REPO}/docs/art/stage-14/drowned'
_pal = json.load(open(f'{P.REPO}/assets/palette/book07.json'))
CODE = {(e['ramp'], e['step']): e['code'] for e in _pal['entries'] if 'ramp' in e}
HEX = {(e['ramp'], e['step']): e['hex'] for e in _pal['entries'] if 'ramp' in e}
RAMP_LEN = {}
for (_r, _s) in CODE:
    RAMP_LEN[_r] = max(RAMP_LEN.get(_r, 0), _s + 1)


# ---------------------------------------------------------------------------- the poses
def ghost_pose(i, hands=None, elbow=None, mouth=0, sway=0.0):
    p = P.Pose(pel=(sway, 0.0, 0.0), breath=0, head=(0.0, 0.3, -0.4), mouth=mouth)
    if hands is not None:
        p.hands = dict(hands)
        p.elbow = dict(elbow)
        p.grip = {'R': 'fist', 'L': 'fist'}
    p.cloth = (0.0, -0.2)
    p.hair = (0.0, -0.2)
    return p


BOUND = {'R': (-4.6, 2.6, -9.6), 'L': (-4.6, 2.6, -9.6)}
BOUND_ELBOW = {'R': (0.6, 0.4, 0.0), 'L': (0.6, 0.4, 0.0)}


def poses(hands=None, elbow=None):
    def idle():
        return [ghost_pose(i, hands, elbow) for i in range(4)]

    def shift():
        return [ghost_pose(i, hands, elbow, sway=s) for i, s in enumerate((0.0, 0.4, 0.6, 0.3))]

    def speak():
        return [ghost_pose(i, hands, elbow, mouth=m) for i, m in enumerate((1, 0, 1, 1))]
    return idle, shift, speak


def men(hands=None, elbow=None):
    idle, shift, speak = poses(hands, elbow)
    return ([('idle', idle, 16, True), ('shift', shift, 30, True), ('speak', speak, 12, True)]
            + W.moving())


def women(hands=None, elbow=None):
    idle, shift, speak = poses(hands, elbow)
    keep = ('walk', 'run', 'runstart', 'runstop')
    return ([('idle', idle, 16, True), ('shift', shift, 30, True), ('speak', speak, 12, True)]
            + [s for s in P.HILD_STATES if s[0] in keep])


# ---------------------------------------------------------------------------- the people
class Bound(P.Hild):
    """Bergljot: Hild's build and braid; no wound bound on the shin; her wrists tied in front."""

    def __init__(self):
        super().__init__()
        self.mats = dict(P.HILD_MATS, rope=('driftwood', 2, 3, 4))

    def leg_hook(self, part, side, J, facing):
        return

    def extras(self, parts, facing, j, pose, prev, rows, lag_u, lag_f):
        if pose.hands['R'] is None:
            return
        # A turn of rope round both wrists, its end hanging a little (shown, not dwelt on).
        rope = P.Part('clothing', 9.0, 'rope', side=0)
        xs, ys = [], []
        for side in ('R', 'L'):
            x, y, _ = P.P2(facing, j[side]['wrist'])
            xs.append(int(x))
            ys.append(int(y))
        y = max(ys)
        for x in range(min(xs) - 1, max(xs) + 2):
            rope.put(x, y, 'rope')
        if facing != 'n':
            rope.put(min(xs), y + 1, 'rope')
            rope.put(min(xs), y + 2, 'rope')
        parts.append(rope)


class Knot(W.Derbail):
    pass


def survivor(model, cloak):
    return W.Survivor(model, cloak)


MODEL_CELLACH = P.Model('cellach', 6.5, upper=P.MODEL_A.upper, lower=P.MODEL_A.lower,
                        upper_e=P.MODEL_A.upper_e, lower_e=P.MODEL_A.lower_e, heads=P.HEAD_B)
MODEL_GUNNAR = P.Model('gunnar', 6.5, upper=P.MODEL_A.upper, lower=P.MODEL_A.lower,
                       upper_e=P.MODEL_A.upper_e, lower_e=P.MODEL_A.lower_e, heads=W.HEAD_FINAN)
MODEL_DONNGAL = P.Model('donngal', 5.5, forearm=2, upper=P.MODEL_B.upper, lower=P.MODEL_B.lower,
                        upper_e=P.MODEL_B.upper_e, lower_e=P.MODEL_B.lower_e, heads=W.HEAD_IVAR)

# Each one's colder palette: ramp to ramp at the same lightness (the rest to `rest`).
SKIN = {'skin_light': 'sky', 'skin_deep': 'sky'}
WHO = {
    'sigrid': dict(name='Sigrid of Hvitness', make=Knot, head=P.HEAD_RUNA, braid=False,
                   states=women, mats=W.DERBAIL_MATS, order=P.HILD_ORDER,
                   layers={'body': 'b', 'clothing': 'c'},
                   ramps=dict(SKIN, violet='sea', hair_brown='stone', stone='stone'), rest='stone'),
    'cellach': dict(name='Cellach of Skarvholm', make=lambda: survivor(MODEL_CELLACH, True),
                    states=men, mats=W.FINAN_MATS, order=P.ORDER_ARMED,
                    layers={'body': 'b', 'clothing': 'c', 'cloak': 'k'},
                    ramps=dict(SKIN, stone='stone', earth='sea', wool='stone', tar='sea'),
                    rest='stone'),
    'gunnar': dict(name='Gunnar of Saltvik', make=lambda: survivor(MODEL_GUNNAR, False),
                   states=men, mats=W.IVAR_MATS, order=P.ORDER_ARMED,
                   layers={'body': 'b', 'clothing': 'c'},
                   ramps=dict(SKIN, hair_blond='stone', kelp='kelp', wool='sea', tar='sea'),
                   rest='sea'),
    'bergljot': dict(name='Bergljot, a hostage', make=Bound, head=P.HEAD_HILD, braid=True,
                     states=lambda: women(BOUND, BOUND_ELBOW), mats=None, order=P.HILD_ORDER,
                     layers={'body': 'b', 'clothing': 'c'},
                     ramps=dict(SKIN, hair_blond='sand_wet', woad='sea', wool='stone',
                                driftwood='kelp'), rest='stone'),
    'donngal': dict(name='Donngal of the Faoilean', make=lambda: survivor(MODEL_DONNGAL, True),
                    states=men, mats=W.FINAN_MATS, order=P.ORDER_ARMED,
                    layers={'body': 'b', 'clothing': 'c', 'cloak': 'k'},
                    ramps=dict(SKIN, stone='stone', earth='kelp', wool='sea', tar='stone'),
                    rest='sea'),
    'thorkel': dict(name='Thorkel Ketilsson, unburied', make=P.Thorkel, states=men,
                    mats=P.RESIDENT_MATS['thorkel'], order=P.ORDER_ARMED,
                    layers={'body': 'b', 'clothing': 'c', 'cloak': 'k'},
                    ramps=dict(SKIN, hair_brown='stone', earth='sea', driftwood='stone',
                               madder='sea', woad='sea', trefoil='stone'), rest='stone'),
}


# ------------------------------------------------------------------------ the cold palette
def cold(key, ramp, step):
    """A ramp step to the drowned's cold palette at the same lightness, a step darker; ink stays."""
    if ramp == 'ink':
        return (ramp, step)
    w = WHO[key]
    target = w['ramps'].get(ramp, w['rest'])
    n, m = RAMP_LEN[ramp], RAMP_LEN[target]
    s = round(step / max(1, n - 1) * (m - 1)) - 1
    return (target, max(0, min(m - 1, s)))


def composite(key, sheets, order, state, facing, i):
    """The layers drawn over each other in draw order: {(x, y): (ramp, step)}."""
    out = {}
    for L in order[facing]:
        sh = sheets.get(L)
        if sh is None:
            continue
        inv = {v: k for k, v in sh.letters.items()}
        for y, row in enumerate(sh.frames[(state, facing, i)]):
            for x, ch in enumerate(row):
                if ch != '.':
                    out[(x, y)] = inv[ch]
    return {pos: cold(key, *rs) for pos, rs in out.items()}


def hashf(*v):
    h = 2166136261
    for x in v:
        h = ((h ^ (int(x) & 0xffffffff)) * 16777619) & 0xffffffff
    return h / 4294967296


def runnels(img, k, n, seed):
    """Water running down the figure (Book 9: water running from them though the tide is out):
    a few columns each carry a bright head of water that steps down the body frame by frame,
    with a wet trail above it; drawn only inside the outline."""
    out = dict(img)
    ys = [y for (_, y) in img]
    if not ys:
        return out
    top, bottom = min(ys) + 6, max(ys) - 1
    span = max(1, bottom - top)
    cols = sorted({x for (x, _) in img})
    for c in cols:
        if hashf(seed, c) > 0.3:
            continue
        head = top + int(((k / n) + hashf(seed, c, 2)) * span) % span
        for d, step in ((0, 9), (1, 7), (2, 6)):
            pos = (c, head - d)
            if pos in out and out[pos] != ('ink', 0):
                out[pos] = ('sea', step)
    return out


def reoutline(img):
    """Every pixel on the silhouette's edge takes the ink line."""
    out = dict(img)
    for (x, y) in img:
        for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if n not in img:
                out[(x, y)] = ('ink', 0)
                break
    return out


def watery(img, share, seed):
    """Part of the figure turned to water (share 0 none to 1 all), in an ordered dither."""
    bay = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    out = {}
    for (x, y), v in img.items():
        if v != ('ink', 0) and bay[y % 4][x % 4] / 16 < share:
            out[(x, y)] = ('sea', 8 if (x + y + seed) % 5 == 0 else 6 if x % 3 else 5)
        else:
            out[(x, y)] = v
    return out


def gathered(img, height):
    """The figure as water gathered up off the rock to `height` (0 to 1): its silhouette squashed
    down onto the feet's row, all water, its edge inked."""
    ys = [y for (_, y) in img]
    foot, top = max(ys), min(ys)
    full = foot - top + 1
    h = max(2, round(full * height))
    out = {}
    for (x, y) in img:
        ny = foot - round((foot - y) * (h - 1) / max(1, full - 1))
        shade = 5 + round(3 * (1 - (foot - ny) / h))
        out[(x, ny)] = ('sea', 7 if (x * 7 + ny) % 6 == 0 else shade)
    return reoutline(out)


APPEAR = [('gather', 0.12), ('gather', 0.3), ('gather', 0.55), ('gather', 0.82),
          ('water', 0.65), ('water', 0.3)]


def appear_frames(still):
    out = []
    for kind, v in APPEAR:
        out.append(gathered(still, v) if kind == 'gather' else watery(still, v, 3))
    return out


# ------------------------------------------------------------------------------ writing
def write(key):
    w = WHO[key]
    if 'head' in w:
        P.CUR.update(head=w['head'], braid=w['braid'])
    ch = w['make']()
    mats = w['mats'] if w['mats'] is not None else ch.mats
    states = w['states']()
    names = {L: f'drowned_{key}_{L}' for L in w['layers']}
    sheets = P.render_character(ch, states, mats, w['order'], names, {},
                                getattr(ch, 'soft', P.SOFT))
    P.CUR.update(head=P.HEAD_HILD, braid=True, cloth='dress')
    frames = {}
    anims = {}
    for state, fn, ticks, loop in states:
        n = P.frames_of(state, fn)
        anims[state] = (n, ticks, loop)
        for f in P.FACINGS:
            for i in range(n):
                img = composite(key, sheets, w['order'], state, f, i)
                if state in ('idle', 'shift', 'speak'):
                    img = runnels(img, i, n, sum(ord(ch) * (k + 1) for k, ch in enumerate(key)))
                frames[(state, f, i)] = img
    for state in ('appear', 'fade'):
        anims[state] = (len(APPEAR), 7, False)
    for f in P.FACINGS:
        rise = appear_frames(frames[('idle', f, 0)])
        for i, img in enumerate(rise):
            frames[('appear', f, i)] = img
            frames[('fade', f, len(rise) - 1 - i)] = img
    lines = [
        f'# {w["name"]}, one of the drowned on the Skerry (Stage 14; Book 8 section 07; Book 9 section',
        '# 03; decisions S14-18 and S14-147 to S14-150): an adult on the 32 x 48 canvas, composited from',
        '# the people generator\'s layers and drawn in the drowned\'s colder palette, water running from',
        '# them. Drawn by Claude and flagged for the user\'s review (decision DH-2). Generated by',
        '# assets/art/authoring/stage14_drowned.py; edit that script, not this sheet.',
        '# appear and fade (6 frames each): water gathering off the rock and rising into the figure,',
        '# and back; marked seated so the art lint does not hold their low frames to a standing size.',
        f'sheet: actor_c_drowned_{key}', 'kind: sprite', 'palette: book07', 'size: 32x48',
        'pivot: 16,47', 'footprint: 10x4', 'shadow: 16x5', 'facings: s n e w', 'placeholder: false',
    ]
    for state, (n, ticks, loop) in anims.items():
        lines.append(f'anim.{state}: frames {n}, ticks {ticks}' + (', loop' if loop else ''))
    lines.append('event.footstep: walk 0, walk 3, run 0, run 4')
    lines += ['pose.appear: seated', 'pose.fade: seated']
    body = []
    for state in anims:
        for f in P.FACINGS:
            for i in range(anims[state][0]):
                img = frames[(state, f, i)]
                rows = []
                for y in range(48):
                    rows.append(''.join(CODE[img[(x, y)]] if (x, y) in img else '.'
                                        for x in range(32)))
                body += ['', f'frame {state} {f} {i}', *rows, 'end']
    with open(f'{SHEETS}/actor_c_drowned_{key}.txt', 'w') as fh:
        fh.write('\n'.join(lines + body) + '\n')
    print(f'wrote {SHEETS}/actor_c_drowned_{key}.txt')
    return frames, anims


# ------------------------------------------------------------------------------ the review
def review(all_frames):
    from PIL import Image
    os.makedirs(REVIEW, exist_ok=True)
    ground = (58, 57, 64)

    def img_of(img):
        im = Image.new('RGBA', (32, 48), ground + (255,))
        px = im.load()
        for (x, y), rs in img.items():
            hx = HEX[rs]
            px[x, y] = tuple(int(hx[k:k + 2], 16) for k in (1, 3, 5)) + (255,)
        return im
    keys = list(all_frames)
    order = ['appear', 'idle', 'shift', 'speak', 'fade']
    for key in keys:
        frames, anims = all_frames[key]
        cols = sum(anims[s][0] for s in order)
        sheet = Image.new('RGBA', (cols * 34 + 2, 4 * 50 + 2), ground + (255,))
        c = 0
        for s in order:
            for i in range(anims[s][0]):
                for r, f in enumerate(P.FACINGS):
                    sheet.paste(img_of(frames[(s, f, i)]), (2 + c * 34, 2 + r * 50))
                c += 1
        sheet.save(f'{REVIEW}/{key}@1x.png')
        sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(f'{REVIEW}/{key}@4x.png')
    # All of them together, facing south: appearing, standing with water running, speaking in
    # turn, swaying, and fading back into the rock.
    gif = []
    seq = [('appear', i) for i in range(6)] + [('idle', i % 4) for i in range(8)] + \
          [('speak', i % 4) for i in range(8)] + [('shift', i % 4) for i in range(4)] + \
          [('fade', i) for i in range(6)]
    for s, i in seq:
        f = Image.new('RGBA', (len(keys) * 34 + 2, 52), ground + (255,))
        for k, key in enumerate(keys):
            frames, _ = all_frames[key]
            f.paste(img_of(frames[(s, 's', i)]), (2 + k * 34, 2))
        gif.append(f.resize((f.width * 3, f.height * 3), Image.NEAREST).convert('P'))
    gif[0].save(f'{REVIEW}/drowned.gif', save_all=True, append_images=gif[1:], duration=140,
                loop=0, disposal=2)
    line = Image.new('RGBA', (len(keys) * 34 + 2, 52), ground + (255,))
    for k, key in enumerate(keys):
        line.paste(img_of(all_frames[key][0][('idle', 's', 0)]), (2 + k * 34, 2))
    line.save(f'{REVIEW}/drowned_line@1x.png')
    line.resize((line.width * 4, line.height * 4), Image.NEAREST).save(f'{REVIEW}/drowned_line@4x.png')
    print(f'wrote the review renders to {REVIEW}')


def main():
    built = {key: write(key) for key in WHO}
    if P.CUT:
        for c in sorted(P.CUT):
            print('cut off by the canvas:', c)
        raise SystemExit(1)
    review(built)


if __name__ == '__main__':
    main()

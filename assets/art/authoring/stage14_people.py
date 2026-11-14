"""Builds the movement verbs' frames for the steerer's two bodies and the heavy build (Stage 14;
Book 2 section 10, "Movement verbs and hazards"; Book 7 sections 01 and 07; decisions S14-14 and
S14-62), posed and drawn by the people generator (people48.py: the same skeleton, projection,
shading, outline, layers and loose-cloth lag as every person in the game):

- climb (4 frames): facing the rock, a hand reaching up to the next hold while the other grips and
  a foot steps up onto a hold; then the other side. A climber always faces the rock (north), so
  every facing holds the north frames.
- swim (4 frames x 4 facings): treading and stroking, arms sweeping at the shoulders; drawn whole,
  and masked by the renderer to the head and shoulders at the waterline (Book 10 Deep: swimming).
- sink (4 frames x 4 facings): out of breath and going under, the head tipped back, the arms
  thrashing up out of the water, the mouth open for air; masked deeper than the swim.
- crawl (4 frames x 4 facings): bent double under a low roof, low on folded knees, a hand out
  ahead feeling the way, creeping (a seated pose for the art lint: not a standing figure).
- push and pull (4 frames x 4 facings each): leaning into a heavy stone with both hands on it,
  short driving steps; and leaning back from it, hands gripping, stepping back.
- jump (3 frames x 4 facings): the crouch and spring at the take-off, the stride in the air (the
  renderer lifts the frame on the jump's arc), the landing on bent knees.

    python3 assets/art/authoring/stage14_people.py [--preview out.png]
    npm run art:sheets && npm run art:compile

Writes the steerer's and the heavy build's maps (body and every layer, with every state they had
before and these new ones) to assets/art/proposed/maps (the people generator's output, so a
later run of people48.py stays the same) and, adopted, to assets/art/maps (decision DH-2: new
frames go in without waiting; flagged for the user's review). The review renders are made by
stage14_review.py.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import people48 as P  # noqa: E402

PROPOSED = f'{P.REPO}/assets/art/proposed/maps'
ADOPTED = f'{P.REPO}/assets/art/maps'

# ---------------------------------------------------------------------------- the poses
GRIP = {'R': 'fist', 'L': 'fist'}


def anim_climb():
    """Hand over hand up the face (north): one hand reaches high for the next hold while the
    other grips at the head; the foot under the reaching hand steps up onto a hold; the body
    hugs the rock. Frames 1 and 3 are the pull between, the weight on both hands."""
    spec = [
        # R hand (o, f, u), L hand, R foot (f, lift), L foot, pelvis u
        ((0.0, 2.0, 8.6), (0.4, 2.0, 2.4), (1.0, 5), (0.0, 0), 0.0),
        ((0.2, 2.0, 6.4), (0.3, 2.0, 4.0), (1.0, 3), (0.0, 0), 1.0),
        ((0.4, 2.0, 2.4), (0.0, 2.0, 8.6), (0.0, 0), (1.0, 5), 0.0),
        ((0.3, 2.0, 4.0), (0.2, 2.0, 6.4), (0.0, 0), (1.0, 3), 1.0),
    ]
    out = []
    for rh, lh, rf, lf, pu in spec:
        p = P.Pose(pel=(0.0, 1.0, pu), lean=(0.0, 1.0), head=(0.0, 0.4, 0.0))
        p.hands = {'R': rh, 'L': lh}
        p.elbow = {'R': (0.3, 0.6, -0.6), 'L': (0.3, 0.6, -0.6)}
        p.grip = dict(GRIP)
        p.feet = {'R': rf, 'L': lf}
        p.toe = {'R': 1 if rf[1] > 0 else 0, 'L': 1 if lf[1] > 0 else 0}
        p.cloth = (0.0, 0.4)
        out.append(p)
    return out


def anim_swim():
    """Treading water and stroking: the arms reach forward at the shoulders, sweep out and round,
    draw in to the chest and push forward again; the legs kick below (hidden under the water)."""
    arms = [
        ((0.4, 8.0, -1.4), (0.4, 8.0, -1.4)),
        ((1.4, 6.6, -1.0), (1.4, 6.6, -1.0)),
        ((0.8, 3.8, -3.4), (0.8, 3.8, -3.4)),
        ((0.5, 6.2, -2.2), (0.5, 6.2, -2.2)),
    ]
    kicks = [((1.5, 0), (-1.5, 2)), ((0.5, 0), (-0.5, 1)), ((-1.5, 2), (1.5, 0)), ((-0.5, 1), (0.5, 0))]
    out = []
    for i, ((r, l), (kr, kl)) in enumerate(zip(arms, kicks)):
        p = P.Pose(pel=(0.0, 0.0, -1.0), lean=(0.0, 1.2), head=(0.0, 0.8, 0.0),
                   breath=-1 if i % 2 else 0)
        p.hands = {'R': r, 'L': l}
        p.elbow = {'R': (0.2, 0.0, -1.0), 'L': (0.2, 0.0, -1.0)}
        p.grip = {'R': 'open', 'L': 'open'}
        p.feet = {'R': kr, 'L': kl}
        p.cloth = (0.0, 1.0)
        p.hair = (0.0, 0.6)
        out.append(p)
    return out


def anim_sink():
    """Spent and going under: the head tipped back for air, the mouth open, the arms thrashing up
    out of the water one after the other, the shoulders dropping."""
    spec = [
        ((0.6, 1.4, 7.6), (0.8, 2.4, 1.4), 1, 0.0),
        ((0.8, 2.0, 3.4), (0.6, 1.6, 6.4), 0, -1.0),
        ((0.8, 2.4, 1.4), (0.6, 1.4, 7.6), 1, 0.0),
        ((0.6, 1.6, 6.4), (0.8, 2.0, 3.4), 0, -1.0),
    ]
    out = []
    for i, (r, l, mouth, b) in enumerate(spec):
        p = P.Pose(pel=(0.0, 0.0, -2.0), lean=(0.0, -0.6), head=(0.0, -0.8, 0.4),
                   mouth=mouth, breath=b)
        p.hands = {'R': r, 'L': l}
        p.elbow = {'R': (0.4, 0.6, -0.4), 'L': (0.4, 0.6, -0.4)}
        p.grip = {'R': 'open', 'L': 'open'}
        p.feet = {'R': (1.0 if i % 2 else -1.0, 0), 'L': (-1.0 if i % 2 else 1.0, 2)}
        p.cloth = (0.0, 1.4)
        p.hair = (0.0, 1.0)
        out.append(p)
    return out


def anim_crawl():
    """Bent double under a low roof, low on folded knees: a hand out ahead feeling the way and the
    other braced low, creeping a knee forward at a time."""
    spec = [
        # R hand, L hand, R foot (f, lift), L foot
        ((0.8, 6.6, -9.6), (1.4, 2.4, -10.6), (3.0, 0), (-3.0, 0)),
        ((1.0, 5.0, -10.4), (1.2, 4.0, -10.0), (1.0, 1), (-1.0, 0)),
        ((1.4, 2.4, -10.6), (0.8, 6.6, -9.6), (-3.0, 0), (3.0, 0)),
        ((1.2, 4.0, -10.0), (1.0, 5.0, -10.4), (-1.0, 0), (1.0, 1)),
    ]
    out = []
    for i, (rh, lh, rf, lf) in enumerate(spec):
        p = P.Pose(pel=(0.0, -1.0, -7.0 + (0.5 if i % 2 else 0.0)), lean=(0.0, 5.4),
                   head=(0.0, 2.0, -1.6))
        p.hands = {'R': rh, 'L': lh}
        p.elbow = {'R': (1.0, -0.2, 0.6), 'L': (1.0, -0.2, 0.6)}
        p.grip = {'R': 'open', 'L': 'open'}
        p.feet = {'R': rf, 'L': lf}
        p.toe = {'R': 1, 'L': 1}
        p.cloth = (-0.6, 0.0)
        p.hair = (0.0, 0.0)
        out.append(p)
    return out


def anim_push():
    """Leaning into a heavy stone, both hands flat on it at the chest, the back foot driving:
    short planted steps, the head down."""
    R = [3.0, 1.0, -3.0, -1.0]
    L = [-3.0, -1.0, 3.0, 1.0]
    lift = [(0, 0), (0, 1), (0, 0), (1, 0)]
    out = []
    for i in range(4):
        p = P.Pose(pel=(0.0, 0.0, -2.0 + (0.0 if i % 2 else -0.5)), lean=(0.0, 3.4),
                   head=(0.0, 1.0, -0.6))
        p.hands = {'R': (-0.6, 6.0, -4.6), 'L': (-0.6, 6.0, -4.6)}
        p.elbow = {'R': (0.3, -0.6, -0.6), 'L': (0.3, -0.6, -0.6)}
        p.grip = {'R': 'open', 'L': 'open'}
        p.feet = {'R': (R[i], lift[i][0]), 'L': (L[i], lift[i][1])}
        p.toe = {'R': 1 if R[i] < 0 else 0, 'L': 1 if L[i] < 0 else 0}
        p.cloth = (-0.4, 0.0)
        p.hair = p.cloth
        out.append(p)
    return out


def anim_pull():
    """Leaning back from a heavy stone with both hands gripping its edge low in front, stepping
    back a short step at a time; the weight on the back foot."""
    R = [-1.0, -3.0, 1.0, 3.0]
    L = [1.0, 3.0, -1.0, -3.0]
    lift = [(0, 0), (1, 0), (0, 0), (0, 1)]
    out = []
    for i in range(4):
        p = P.Pose(pel=(0.0, -0.6, -2.0 + (0.0 if i % 2 else -0.5)), lean=(0.0, -1.6),
                   head=(0.0, 0.2, 0.0))
        p.hands = {'R': (-0.8, 5.0, -7.4), 'L': (-0.8, 5.0, -7.4)}
        p.elbow = {'R': (0.8, -0.6, 0.0), 'L': (0.8, -0.6, 0.0)}
        p.grip = dict(GRIP)
        p.feet = {'R': (R[i], lift[i][0]), 'L': (L[i], lift[i][1])}
        p.toe = {'R': 0, 'L': 0}
        p.cloth = (0.6, 0.0)
        p.hair = p.cloth
        out.append(p)
    return out


def anim_jump():
    """The take-off (crouched, arms swung back, springing off the toes), the stride in the air
    (front knee driven up, arms forward; the renderer lifts the frame on the arc), and the
    landing (both feet down, knees bent, arms out for balance)."""
    a = P.Pose(pel=(0.0, 0.6, -4.0), lean=(0.0, 2.4), head=(0.0, 0.8, 0.0))
    a.hands = {'R': (0.8, -4.4, -8.6), 'L': (0.8, -4.4, -8.6)}
    a.feet = {'R': (1.0, 0), 'L': (-2.0, 0)}
    a.toe = {'R': 1, 'L': 1}
    a.cloth = (-0.6, 0.0)
    a.hair = a.cloth
    b = P.Pose(pel=(0.0, 0.0, -1.0), lean=(0.0, 1.6), head=(0.0, 0.6, 0.0))
    b.hands = {'R': (-1.0, 4.4, -4.0), 'L': (0.6, -2.6, -8.4)}
    b.grip = {'R': 'fist', 'L': 'fist'}
    b.feet = {'R': (5.0, 4), 'L': (-5.0, 0)}
    b.toe = {'R': 0, 'L': 1}
    b.cloth = (-1.8, -0.6)
    b.hair = b.cloth
    c = P.Pose(pel=(0.0, 0.2, -4.0), lean=(0.0, 1.6), head=(0.0, 0.4, 0.0))
    c.hands = {'R': (2.4, 3.0, -6.4), 'L': (2.4, 3.0, -6.4)}
    c.feet = {'R': (2.0, 0), 'L': (-1.0, 0)}
    c.cloth = (0.8, 0.6)
    c.hair = c.cloth
    return [a, b, c]


# state, poses, ticks a frame, loop (Book 7 section 01: 4-frame loops; the jump plays once)
STATES = [
    ('climb', anim_climb, 12, True),
    ('swim', anim_swim, 12, True),
    ('sink', anim_sink, 9, True),
    ('crawl', anim_crawl, 14, True),
    ('push', anim_push, 14, True),
    ('pull', anim_pull, 14, True),
    ('jump', anim_jump, 8, False),
]
POSES = {'crawl': 'seated'}
# A climber faces the rock: every facing holds the north frames.
NORTH_ONLY = ('climb',)


def adopted(text):
    return text.replace(
        "proposed, staged for the user's approval; nothing here is read by the game.",
        'approved by the user and adopted into the game (npm run art:adopt).')


def _remember(text):
    """Sheet.text, keeping what each sheet was written with, to write it again."""
    def wrapped(self, *args):
        self.args = args
        return text(self, *args)
    wrapped.__wrapped__ = text
    return wrapped


def build(keys=('a', 'b', 'heavy')):
    """Writes each character's maps with the new states added after its own."""
    if not hasattr(P.Sheet.text, '__wrapped__'):
        P.Sheet.text = _remember(P.Sheet.text)
    P.STEERER_STATES = P.states_for(False) + STATES
    P.HEAVY_STATES = P.states_for(True) + STATES
    P.WORK_POSES = dict(P.WORK_POSES, **POSES)
    P.OUT = PROPOSED
    out = {}
    for key in keys:
        sheets, names = P.write_character(key)
        # The climb's north frames in every facing, written again.
        for sh in sheets.values():
            for (state, facing, i) in list(sh.frames):
                if state in NORTH_ONLY and facing != 'n':
                    sh.frames[(state, facing, i)] = sh.frames[(state, 'n', i)]
        for sh in sheets.values():
            text = P.Sheet.text.__wrapped__(sh, *sh.args)
            with open(f'{PROPOSED}/{sh.name}.map.txt', 'w') as fh:
                fh.write(text)
            with open(f'{ADOPTED}/{sh.name}.map.txt', 'w') as fh:
                fh.write(adopted(text))
        out[key] = (sheets, names)
    if P.CUT:
        for c in sorted(P.CUT):
            print('cut off by the canvas:', c)
        raise SystemExit(1)
    return out


def main():
    preview = None
    if '--preview' in sys.argv:
        preview = sys.argv[sys.argv.index('--preview') + 1]
    only = os.environ.get('PEOPLE_ONLY')
    built = build(tuple(only.split(',')) if only else ('a', 'b', 'heavy'))
    if preview is not None:
        for key, (sheets, names) in built.items():
            by_layer = {L: sh for L, sh in sheets.items()}
            order = lambda f: [L for L in P.ORDER_ARMED[f] if L in by_layer and L not in ('helmet', 'blood')]  # noqa: E731
            cells = []
            for state, fn, _, _ in STATES:
                n = len(fn())
                for f in P.FACINGS:
                    cells.append([(state, f, i, None) for i in range(n)])
            P.preview(preview.replace('.png', f'_{key}.png'), by_layer, order, cells, scale=4)
    print('wrote the Stage 14 people maps')


if __name__ == '__main__':
    main()

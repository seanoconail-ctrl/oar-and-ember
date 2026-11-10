"""The 10-second walking capture: from the wet sand at the water's edge, along the strand, up the
sandy cut in the bank and on to the machair, with the camera following."""
import math
import os
import subprocess
import sys
import numpy as np
from PIL import Image
import fx
import people
from core import C, to_u8
from scene_strand import StrandRenderer, Trails
from strand import CUT_X, H, W, shore_y

OUT = os.path.join(os.path.dirname(__file__), '..', 'reference')
FPS = 25
SECONDS = 10.0
SPEED = 3.5 * 24            # Book 10 walk, tiles per second, in pixels


def path_points(R):
    s = R.world.s
    def wet_y(x):
        col = s[:, int(x)]
        return float(np.nonzero(col > -6)[0][0])
    pts = [(470, wet_y(470))]
    for x in range(450, CUT_X + 20, -20):
        pts.append((x, wet_y(x) + 2 * math.sin(x / 40)))
    pts += [(CUT_X + 6, 400), (CUT_X + 2, 360), (CUT_X - 2, 320), (CUT_X - 4, 290), (CUT_X + 10, 262),
            (CUT_X + 60, 245), (CUT_X + 120, 240), (CUT_X + 200, 236), (CUT_X + 300, 234)]
    return pts


def along(pts, dist):
    acc = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if acc + L >= dist:
            f = (dist - acc) / L
            return x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, (x1 - x0) / L, (y1 - y0) / L
        acc += L
    (x0, y0), (x1, y1) = pts[-2], pts[-1]
    L = math.hypot(x1 - x0, y1 - y0)
    return x1, y1, (x1 - x0) / L, (y1 - y0) / L


def facing_of(dx, dy):
    if abs(dx) > abs(dy):
        return 'e' if dx > 0 else 'w'
    return 's' if dy > 0 else 'n'


def main():
    R = StrandRenderer()
    pts = path_points(R)
    trails = Trails()
    # Warm the sea up, so the sand has been wetted before the clip starts.
    for i in range(25):
        R.world.water(R.base.copy(), -2 + i * 0.08, R.wet)
    cam = None
    frames = []
    last_step = -1
    splashes = []
    puffs = []
    for i in range(int(SECONDS * FPS)):
        t = i / FPS
        x, y, dx, dy = along(pts, t * SPEED)
        facing = facing_of(dx, dy)
        step = int(t * 8.6) % 6
        bounce = -1 if step in (1, 4) else 0
        # A footstep on frames 0 and 3: a print, a puff of dry sand, or a splash.
        stepping = step in (0, 3) and int(t * 8.6) != last_step
        if stepping:
            last_step = int(t * 8.6)
            side = 2 if step == 0 else -2
            fx_, fy_ = x - dy * side, y + dx * side * 0.5
            mat = R.world.material[int(fy_), int(fx_)]
            in_water = R.wet[int(fy_), int(fx_)] > t - 0.1
            if in_water:
                splashes.append((fx_, fy_, t))
            elif mat in (2, 3, 4, 5):
                trails.add(fx_, fy_, t, mat == 5)
                if mat in (2, 3):
                    puffs.append((fx_, fy_, t))
        gust = R.world.gust(x, y, t)
        spr = people.flutter(people.sprite('actor_p_steerer_a', 'walk', facing, step), gust, facing, i)
        # The camera follows with a little look-ahead, smoothly, snapped to whole pixels.
        target = (x + dx * 46 - 320, y + dy * 30 - 196)
        if cam is None:
            cam = list(target)
        cam[0] += (target[0] - cam[0]) * 0.09
        cam[1] += (target[1] - cam[1]) * 0.09
        cx = int(round(min(W - 640, max(0, cam[0]))))
        cy = int(round(min(H - 360, max(0, cam[1]))))
        hild = people.sprite('actor_c_hild', 'sit', 'e', int(t * 3.3) % 4)
        actors = [{'x': x, 'y': y + bounce, 'sprite': spr},
                  {'x': R.world.fire[0] - 22, 'y': R.world.fire[1] + 4, 'sprite': hild}]
        f = R.frame(t, (cx, cy), actors, trails)
        # Splashes and ripples round the feet in the swash; dust on dry sand.
        for (sx, sy, t0) in splashes:
            age = t - t0
            if age < 0.9:
                rad = age * 9
                for a in range(0, 360, 20):
                    px_ = sx + math.cos(math.radians(a)) * rad - cx
                    py_ = sy + math.sin(math.radians(a)) * rad * 0.5 - cy
                    fx._px(f, px_, py_, C('sea', 9) * (1 - age) + f[min(359, max(0, int(py_))), min(639, max(0, int(px_)))] * age)
                for k in range(5):
                    fx._px(f, sx - cx + (k - 2) * 1.5, sy - cy - age * 14 + age * age * 18 - k % 2, C('sea', 10))
        for (sx, sy, t0) in puffs:
            age = t - t0
            if age < 0.6:
                for k in range(4):
                    fx._px(f, sx - cx + age * 10 + k, sy - cy - age * 4 - (k % 2), C('sand', 6))
        frames.append(Image.fromarray(to_u8(f)))
        print(f'\rframe {i + 1}', end='', file=sys.stderr)
    print(file=sys.stderr)
    tmp = os.path.join(os.path.dirname(__file__), '.walk')
    os.makedirs(tmp, exist_ok=True)
    for k, im in enumerate(frames):
        im.resize((1280, 720), Image.NEAREST).save(os.path.join(tmp, f'{k:04d}.png'))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i',
                    os.path.join(tmp, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16',
                    os.path.join(OUT, 'target-walk.mp4')], check=True)


if __name__ == '__main__':
    main()

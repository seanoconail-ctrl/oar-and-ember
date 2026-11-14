"""Writes docs/art/wreck-strand-target.png and .gif (a seamless 6.4 s loop)."""
import os
import sys
import numpy as np
from PIL import Image
import fx
import people
from core import FPS, FRAMES, LOOP, to_u8
from scene_strand import StrandRenderer
from strand import VIEW

OUT = os.path.join(os.path.dirname(__file__), '..', 'reference')


def actors(R, t):
    fire = R.world.fire
    gust = R.world.gust(fire[0] - 12, fire[1], t)
    # The steerer warms their hands, shifts weight and looks round now and then; Hild sits.
    look = fx.loopsin(t, 1, 0.5)
    facing = 'n' if look < 0.4 else ('e' if look < 0.85 else 's')
    idle = int(t * 4) % 4
    steerer = people.flutter(people.sprite('actor_p_steerer_a', 'idle', facing, idle), gust, facing, int(t * 8))
    hild = people.flutter(people.sprite('actor_c_hild', 'sit', 'e', int(t * 3.3) % 4), gust * 0.6, 'e', int(t * 8))
    sway = round(0.6 * fx.loopsin(t, 2))
    return [{'x': fire[0] - 12 + sway, 'y': fire[1] + 16, 'sprite': steerer},
            {'x': fire[0] - 22, 'y': fire[1] + 4, 'sprite': hild}]


def main(frames=FRAMES):
    R = StrandRenderer()
    # Warm up one loop so the wet sand has a history, then record the second.
    imgs = []
    for i in range(frames * 2):
        t = (i % frames) / FPS + (0 if i < frames else 0)
        out = R.frame(t if i >= frames else t - LOOP, VIEW, actors(R, t))
        if i >= frames:
            imgs.append(Image.fromarray(to_u8(out)))
        print(f'\rframe {i + 1}/{frames * 2}', end='', file=sys.stderr)
    print(file=sys.stderr)
    imgs[int(frames * 0.3)].save(os.path.join(OUT, 'wreck-strand-target.png'))
    pal = [im.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in imgs]
    pal[0].save(os.path.join(OUT, 'wreck-strand-target.gif'), save_all=True, append_images=pal[1:],
                duration=int(1000 / FPS), loop=0, optimize=False, disposal=1)
    return imgs


if __name__ == '__main__':
    main()

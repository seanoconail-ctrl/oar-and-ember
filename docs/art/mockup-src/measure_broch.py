"""Motion with the camera still for the Stage 7 mockups, measured as the references were
(measure.py), with the cloud shadows moving and with them frozen.

    python3 docs/art/mockup-src/measure_broch.py s0 day
"""
import os
import sys
os.environ['MOCKUP_STILL_CLOUDS'] = '1'
import numpy as np
from PIL import Image
import measure
from core import FPS, FRAMES, to_u8
from scene_broch import BrochRenderer, NAMES, OUT

stage, night = sys.argv[1], sys.argv[2] == 'night'
name = NAMES[(stage, night)]
moving = measure.frames_of(os.path.join(OUT, f'{name}.gif'))
c1, _ = measure.continuous(moving)
R = BrochRenderer(stage, night)
frozen = [to_u8(R.frame(i / FPS)).astype(np.int16) for i in range(FRAMES)]
c2, cells = measure.continuous(frozen)
print(f'{name}: continuous motion {c1 * 100:.1f}% of cells; with cloud shadows frozen {c2 * 100:.1f}%')
# The motion map with clouds frozen: still cells tinted red over the still frame.
img = np.asarray(Image.open(os.path.join(OUT, f'{name}.png')).convert('RGB')).astype(np.float32)
for gy in range(cells.shape[0]):
    for gx in range(cells.shape[1]):
        if not cells[gy, gx]:
            sl = img[gy * 20:(gy + 1) * 20, gx * 20:(gx + 1) * 20]
            sl[:] = sl * 0.5 + np.array([200, 30, 30]) * 0.5
Image.fromarray(img.astype(np.uint8)).save(os.path.join(OUT, f'{name}-motion.png'))

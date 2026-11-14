"""The stricter motion figure: the loops re-rendered with cloud shadows frozen."""
import os
os.environ['MOCKUP_STILL_CLOUDS'] = '1'
import numpy as np
import make_strand
import measure
from core import FPS, FRAMES, to_u8
from scene_kelda import KeldaRenderer
from scene_strand import StrandRenderer
from strand import VIEW

R = StrandRenderer()
fr = []
for i in range(FRAMES * 2):
    t = (i % FRAMES) / FPS
    out = R.frame(t if i >= FRAMES else t - 6.4, VIEW, make_strand.actors(R, t))
    if i >= FRAMES:
        fr.append(to_u8(out).astype(np.int16))
a, _, _ = measure.coverage(fr)
c, _ = measure.continuous(fr)
print(f'Wreck Strand, clouds frozen: any change {a * 100:.1f}%, continuous {c * 100:.1f}%')
K = KeldaRenderer()
fr = [to_u8(K.frame(i / FPS)).astype(np.int16) for i in range(FRAMES)]
a, _, _ = measure.coverage(fr)
c, cells = measure.continuous(fr)
print(f'Kelda, clouds frozen: any change {a * 100:.1f}%, continuous {c * 100:.1f}%')

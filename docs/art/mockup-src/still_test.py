import time, sys
import numpy as np
from PIL import Image
import people
from core import to_u8
from scene_strand import StrandRenderer
from strand import VIEW
t0 = time.time()
R = StrandRenderer()
print('build', round(time.time() - t0, 1))
fire = R.world.fire
actors = [
    {'x': fire[0] + 24, 'y': fire[1] + 4, 'sprite': people.flutter(people.sprite('actor_p_steerer_a', 'idle', 'w', 0), 0.6, 'w', 0)},
    {'x': fire[0] - 22, 'y': fire[1] + 4, 'sprite': people.sprite('actor_c_hild', 'sit', 'e', 0)},
]
t1 = time.time()
out = R.frame(float(sys.argv[1]) if len(sys.argv) > 1 else 1.0, VIEW, actors)
print('frame', round(time.time() - t1, 2))
img = Image.fromarray(to_u8(out))
img.save('/tmp/claude-0/-home-user-oar-and-ember/16c80e56-1f62-56fa-a317-d501a042e90d/scratchpad/strand1x.png')
img.resize((1280, 720), Image.NEAREST).save('/tmp/claude-0/-home-user-oar-and-ember/16c80e56-1f62-56fa-a317-d501a042e90d/scratchpad/strand2x.png')

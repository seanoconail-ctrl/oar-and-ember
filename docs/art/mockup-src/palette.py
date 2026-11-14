"""The proposed expanded palette (art direction pass): hue-shifted ramps, dark to light.

Shadows lean cool (blue-violet), highlights lean warm but stay muted: North Atlantic light.
Every ramp runs from its deepest shadow to its brightest highlight. Warm saturated colour is kept
for fire, lamps, skin and dyed cloth.
"""

RAMPS = {
    # Outline ink: a deep blue-violet, never pure black.
    'ink': ['#161a28', '#232838'],
    # Water, deep to foam.
    'sea': ['#0f1d2e', '#142a3c', '#19374a', '#20465a', '#295669', '#356877', '#4a7d88',
            '#6a979c', '#93b5b3', '#bfd4cd', '#e4eee8'],
    'sky': ['#3c4656', '#56626f', '#738089', '#929ea3', '#b2bbbb', '#d0d6d2'],
    # Sand: wet (cool, dark) then dry.
    'sand_wet': ['#2f3138', '#3d3e44', '#4d4c4f', '#5e5b59', '#716b64'],
    'sand': ['#5d5650', '#736a5f', '#8a7f6e', '#a0947e', '#b6a98f', '#cbbfa3', '#ddd3ba'],
    # Stone: shingle, boulders, cliffs. Violet shadows, warm grey lights.
    'stone': ['#1c1d2a', '#282a38', '#373948', '#484a58', '#5c5d69', '#72727b', '#8a888d',
              '#a3a0a0', '#bdb8b3', '#d6d0c8'],
    'stone_warm': ['#3a302f', '#504340', '#685851', '#816e63', '#9b8676', '#b59f8b'],
    # Grass, cool grey-greens; moss; marram.
    'grass': ['#18221f', '#1f2d27', '#283a2f', '#334838', '#3f5640', '#4c6448', '#5a7150',
              '#6a7e58', '#7d8c62', '#93a070', '#aab384'],
    'moss': ['#19271f', '#213426', '#2b442c', '#375533', '#46663a', '#587843', '#6d8a4e', '#86a05d'],
    'marram': ['#3f4535', '#545a45', '#6c7155', '#878a68', '#a2a37e', '#bcbb95', '#d3d0ad'],
    'fern': ['#1a2a1f', '#243826', '#30492c', '#3e5c31', '#4f7038', '#648543'],
    'bracken': ['#2e2218', '#47321f', '#634527', '#80592f', '#9c703a'],
    # Weed: kelp and wrack, olive-brown.
    'kelp': ['#191a14', '#25251a', '#333221', '#434129', '#565331', '#6b673b', '#827d47'],
    # Wood.
    'driftwood': ['#2e2a2e', '#433d3e', '#5a524f', '#736961', '#8d8274', '#a89c89', '#c4b8a1',
                  '#dcd2bb'],
    'tar': ['#181312', '#251c19', '#352720', '#47332a', '#5c4234', '#745440'],
    'earth': ['#1f1a1c', '#2e2523', '#40322b', '#544233', '#6a543f', '#80684d'],
    # Fire and warm light.
    'fire': ['#3c1a1d', '#6b2622', '#9c3a26', '#c8592c', '#e3823a', '#f0ad4c', '#f8d576',
             '#fff2bf'],
    'smoke': ['#3a3d46', '#4f525a', '#676a70', '#828487', '#9d9e9e', '#b8b8b5'],
    # Flowers.
    'thrift': ['#4d2c40', '#6f3a55', '#94516e', '#b86f8a', '#d595a8', '#ebbfc9'],
    'clover_white': ['#9aa197', '#bcc1b6', '#dcdfd4', '#f1f1e8'],
    'trefoil': ['#6d5a24', '#94802f', '#b9a43c', '#d9c457', '#ece08a'],
    'redclover': ['#5a2a3a', '#7c3a4c', '#a05062', '#c0707e'],
    'violet': ['#33304f', '#46426b', '#5d5a88', '#7a77a5', '#9c99c2'],
    'iris': ['#6e5c1e', '#9c8628', '#c7ae35', '#e3cd57'],
    # People.
    'skin_light': ['#4a302f', '#6e4840', '#956554', '#b98569', '#d4a383', '#e9c5a6'],
    'skin_deep': ['#2c1d1c', '#432b26', '#5e3d31', '#7d5340', '#9c6c53', '#b98868'],
    'hair_brown': ['#231816', '#36241d', '#4c3324', '#64452e', '#7d5939'],
    'hair_blond': ['#4f3b22', '#735630', '#98763f', '#bb9652', '#d7b46b', '#ead08c'],
    'madder': ['#3a1a20', '#58232a', '#7a2f32', '#9e413a', '#bd5b47', '#d27e5f'],
    'woad': ['#191d2f', '#252b42', '#333c59', '#465072', '#5d688c', '#7c86a6'],
    'weld': ['#232a1e', '#323c27', '#445032', '#58653d', '#6e7a4a', '#878f5b'],
    'wool': ['#4e4840', '#6a6255', '#877d6c', '#a49884', '#bfb39c', '#d8cdb5', '#ece4cf'],
    # Animals.
    'gull': ['#3b4150', '#5f6672', '#8d929a', '#b9bcbf', '#dfe0dd', '#f6f5ef'],
    'seal': ['#1d1f27', '#2a2d36', '#3a3d47', '#4d505a', '#62646c', '#7b7c82'],
    'fleece': ['#5a554e', '#7b7468', '#9c9384', '#bbb19f', '#d6ccb8', '#eae2cf'],
    'crab': ['#3c1e1a', '#622b22', '#8a3c2a', '#b0573a'],
    'beak': ['#7a5a1e', '#b8892c', '#e0b447'],
}


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(name):
    return [hex_rgb(c) for c in RAMPS[name]]


def count():
    return sum(len(r) for r in RAMPS.values())


if __name__ == '__main__':
    print(len(RAMPS), 'ramps,', count(), 'colours')

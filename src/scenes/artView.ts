/**
 * Renderer check views, reached from the title page's address:
 *   ?view=art-test&case=front|behind|dusk|night    the Stage 4 test scenes
 *   ?view=sheet&sheet=actor_p_steerer_a            every frame of one sheet
 * They draw through the WebGL2 renderer; the browser tests compare them with the CPU reference.
 */
import renderJson from '../../assets/art/render.json';
import type { Manifest } from '../render/atlas.ts';
import { createSceneRenderer } from '../render/glRenderer.ts';
import type { Palette } from '../render/palette.ts';
import type { Presenter } from '../render/presenter.ts';
import { buildDrawList, parseRenderStyle } from '../render/scene.ts';
import { ART_TEST_CASES, artTestScene, sheetPreviewScene } from './artTest.ts';
import type { ArtTestCase } from './artTest.ts';

const manifests = import.meta.glob<Manifest>('../../assets/atlases/*.json', {
  eager: true,
  import: 'default',
});
const images = import.meta.glob<string>('../../assets/atlases/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error(`Could not load ${url}`));
    };
    image.src = url;
  });
}

export function artViewRequested(search: string): boolean {
  const view = new URLSearchParams(search).get('view');
  return view === 'art-test' || view === 'sheet';
}

export async function showArtView(
  search: string,
  presenter: Presenter,
  palette: Palette,
): Promise<string> {
  const params = new URLSearchParams(search);
  const renderer = createSceneRenderer(presenter, palette, parseRenderStyle(renderJson));
  const byName = new Map<string, Manifest>();
  for (const [path, manifest] of Object.entries(manifests)) {
    const url = images[path.replace(/\.json$/, '.png')];
    if (url === undefined) throw new Error(`No atlas image for ${path}`);
    renderer.addAtlas(manifest, await loadImage(url));
    byName.set(manifest.sheet, manifest);
  }
  let scene;
  let label: string;
  if (params.get('view') === 'sheet') {
    const name = params.get('sheet') ?? 'actor_p_steerer_a';
    const manifest = byName.get(name);
    if (manifest === undefined) throw new Error(`No sheet "${name}"`);
    scene = sheetPreviewScene(name, manifest, manifest.frames);
    label = `sheet ${name}`;
  } else {
    const which = params.get('case') ?? 'front';
    const known = ART_TEST_CASES.find((c) => c === which);
    if (known === undefined) throw new Error(`No art test case "${which}"`);
    scene = artTestScene(known satisfies ArtTestCase);
    label = `art test ${known}`;
  }
  renderer.render(scene, buildDrawList(scene, byName, parseRenderStyle(renderJson).cutawayFade));
  return label;
}

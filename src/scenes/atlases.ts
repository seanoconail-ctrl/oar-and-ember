/** The compiled atlases (assets/atlases), as bundled into the browser build. */
import type { Manifest } from '../render/atlas.ts';

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

export interface LoadedAtlas {
  readonly manifest: Manifest;
  readonly image: HTMLImageElement;
}

/** Every atlas with its decoded image, by sheet name. */
export async function loadAtlases(): Promise<Map<string, LoadedAtlas>> {
  const out = new Map<string, LoadedAtlas>();
  await Promise.all(
    Object.entries(manifests).map(async ([path, manifest]) => {
      const url = images[path.replace(/\.json$/, '.png')];
      if (url === undefined) throw new Error(`No atlas image for ${path}`);
      out.set(manifest.sheet, { manifest, image: await loadImage(url) });
    }),
  );
  return out;
}

/** People's layer files (assets/art/layers), as bundled into the browser build. */
import type { LayerFile } from './people.ts';

const files = import.meta.glob<LayerFile>('../../assets/art/layers/*.layers.json', {
  eager: true,
  import: 'default',
});

export function bundledLayerFiles(): ReadonlyMap<string, LayerFile> {
  return new Map(Object.values(files).map((f) => [f.name, f]));
}

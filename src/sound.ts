/** The sound test page (sound.html): every generated tune and sound, before it is wired in. */
import { bundledStrings } from './scenes/bundledArt.ts';
import { showSoundTest } from './scenes/soundTest.ts';

const root = document.getElementById('sound');
if (root === null) throw new Error('sound.html must contain <main id="sound">');
try {
  showSoundTest(root, bundledStrings());
} catch (error) {
  root.dataset['error'] = error instanceof Error ? error.message : String(error);
  throw error;
}

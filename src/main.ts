import { BUILD_ID } from './core/build.ts';
import { boot } from './scenes/boot.ts';

const canvas = document.getElementById('screen');
const notice = document.getElementById('notice');
if (!(canvas instanceof HTMLCanvasElement) || notice === null) {
  throw new Error('index.html must contain <canvas id="screen"> and <p id="notice">');
}
boot({ canvas, notice }, BUILD_ID);

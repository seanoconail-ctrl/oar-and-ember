/**
 * Prints what WebGL2 a browser offers on this machine (renderer, version, whether a shader
 * compiles and whether the context survives), so a CI runner's graphics can be judged from its
 * log. Not a test: `node tests/browser/webgl-probe.ts firefox|webkit|chromium [headed]`.
 */
import { chromium, firefox, webkit } from '@playwright/test';

const name = process.argv[2] ?? 'firefox';
const headed = process.argv[3] === 'headed';
const type = name === 'webkit' ? webkit : name === 'chromium' ? chromium : firefox;
const browser = await type.launch({
  headless: !headed,
  ...(name === 'firefox' ? { firefoxUserPrefs: { 'webgl.force-enabled': true } } : {}),
});
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="64" height="64"></canvas>');
const info = await page.evaluate(() => {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2');
  if (gl === null) return { webgl2: false };
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const shader = gl.createShader(gl.VERTEX_SHADER);
  if (shader !== null) {
    gl.shaderSource(
      shader,
      '#version 300 es\nin vec2 a;\nvoid main() { gl_Position = vec4(a, 0.0, 1.0); }',
    );
    gl.compileShader(shader);
  }
  return {
    webgl2: true,
    renderer: String(gl.getParameter(debug === null ? gl.RENDERER : debug.UNMASKED_RENDERER_WEBGL)),
    version: String(gl.getParameter(gl.VERSION)),
    compiled: shader !== null && gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true,
    log: shader === null ? 'no shader' : (gl.getShaderInfoLog(shader) ?? ''),
    lost: gl.isContextLost(),
  };
});
console.log(`WebGL2 in ${name}${headed ? ' (headed)' : ''}: ${JSON.stringify(info)}`);
await browser.close();

/**
 * Prints what WebGL2 a browser offers on this machine (renderer, version, whether a shader
 * compiles and whether the context survives), so a CI runner's graphics can be judged from its
 * log. Not a test: `node tests/browser/webgl-probe.ts webkit|chromium [headed] [base URL]`.
 * With the address of a served build, it also says how much of the art test view and of play is
 * drawn (not black) in a screenshot, just after the view is shown and two seconds later.
 */
import { chromium, webkit } from '@playwright/test';
import type { Page } from '@playwright/test';
import { decodePng } from '../../src/tools/art/png.ts';

const name = process.argv[2] ?? 'webkit';
const headed = process.argv[3] === 'headed';
const type = name === 'chromium' ? chromium : webkit;
const browser = await type.launch({
  headless: !headed,
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

/** The share of a screenshot's pixels that are not black. */
async function drawn(at: Page): Promise<string> {
  const shot = decodePng(await at.screenshot());
  let lit = 0;
  for (let i = 0; i < shot.data.length; i += 4)
    if ((shot.data[i] ?? 0) + (shot.data[i + 1] ?? 0) + (shot.data[i + 2] ?? 0) > 24) lit++;
  return `${((100 * lit) / (shot.width * shot.height)).toFixed(1)}%`;
}

const base = process.argv[4];
if (base !== undefined) {
  for (const [query, state] of [
    ['view=art-test&case=front', 'art'],
    ['view=play&name=Ash&body=A', 'play'],
  ] as const) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${base}?${query}`);
    await page.locator(`canvas#screen[data-state=${state}]`).waitFor({ timeout: 60_000 });
    const first = await drawn(page);
    await page.waitForTimeout(2000);
    console.log(`${query}: drawn ${first} at once, ${await drawn(page)} two seconds later`);
  }
}
await browser.close();

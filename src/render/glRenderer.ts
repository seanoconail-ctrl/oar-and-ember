/**
 * The WebGL2 scene renderer (Book 2 section 19, Book 7 sections 01 and 08). It draws a draw list
 * into an off-screen 640 x 360 target, then hands the target to the presenter, which scales it by
 * a whole number and letterboxes it.
 *
 * Every sprite pixel is fetched exactly (texelFetch at whole-pixel positions), so nothing is
 * filtered. Cutaways drop pixels in the 4 x 4 Bayer pattern. Light is ambient plus banded pools,
 * the same arithmetic as the CPU reference renderer (src/render/cpuRenderer.ts).
 */
import type { Manifest } from './atlas.ts';
import type { Palette } from './palette.ts';
import { paletteIndex } from './palette.ts';
import { frameTexture, linkProgram } from './presenter.ts';
import type { Presenter } from './presenter.ts';
import { BAYER4 } from './scene.ts';
import type { DrawItem, RenderStyle, Scene } from './scene.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport.ts';

export const MAX_POOLS = 8;

const VERTEX = `#version 300 es
in vec2 a_pos;      // logical pixels, y down
in vec2 a_texel;    // atlas texel at this corner
in float a_fade;
out vec2 v_texel;
flat out float v_fade;
void main() {
  v_texel = a_texel;
  v_fade = a_fade;
  // y down maps to clip -1 at the top, so the target's row 0 is the frame's top row.
  gl_Position = vec4(a_pos.x / ${LOGICAL_WIDTH / 2}.0 - 1.0, a_pos.y / ${LOGICAL_HEIGHT / 2}.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_atlas;
uniform bool u_solid;
uniform vec3 u_solidColour;       // 0 to 255
uniform vec3 u_ambient;           // 0 to 255
uniform int u_poolCount;
uniform vec3 u_poolAt[${MAX_POOLS}];       // x, y, radius
uniform vec3 u_poolColour[${MAX_POOLS}];   // 0 to 255
uniform float u_bands;
uniform int u_bayer[16];
in vec2 v_texel;
flat in float v_fade;
out vec4 outColour;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 c;
  if (u_solid) {
    c = u_solidColour;
  } else {
    vec4 t = texelFetch(u_atlas, ivec2(floor(v_texel)), 0);
    if (t.a < 0.5) discard;
    if (v_fade > 0.0 && float(u_bayer[(p.y & 3) * 4 + (p.x & 3)]) < floor(v_fade * 16.0 + 0.5)) discard;
    c = floor(t.rgb * 255.0 + 0.5);
  }
  vec3 light = u_ambient;
  for (int i = 0; i < ${MAX_POOLS}; i++) {
    if (i >= u_poolCount) break;
    float d = distance(vec2(p) + 0.5, u_poolAt[i].xy);
    if (d < u_poolAt[i].z) light += u_poolColour[i] * (ceil(u_bands * (1.0 - d / u_poolAt[i].z)) / u_bands);
  }
  light = min(light, vec3(255.0));
  outColour = vec4(floor(c * light / 255.0 + 1e-6) / 255.0, 1.0);
}`;

interface Atlas {
  readonly manifest: Manifest;
  readonly image: TexImageSource;
  texture: WebGLTexture | null;
}

export interface SceneRenderer {
  /** Registers a compiled atlas (its manifest and decoded image). */
  addAtlas(manifest: Manifest, image: TexImageSource): void;
  /** Draws `items` over `scene.background` under the scene's light, and presents the frame. */
  render(scene: Scene, items: readonly DrawItem[]): void;
}

export function createSceneRenderer(
  presenter: Presenter,
  palette: Palette,
  style: RenderStyle,
): SceneRenderer {
  const { gl } = presenter;
  const atlases = new Map<string, Atlas>();
  let program!: WebGLProgram;
  let vao!: WebGLVertexArrayObject;
  let buffer!: WebGLBuffer;
  let target!: WebGLTexture;
  let framebuffer!: WebGLFramebuffer;

  const upload = (atlas: Atlas): void => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, atlas.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    atlas.texture = texture;
  };

  const build = (): void => {
    program = linkProgram(gl, VERTEX, FRAGMENT);
    vao = gl.createVertexArray();
    buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = 5 * 4;
    const attr = (name: string, size: number, offset: number): void => {
      const at = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride, offset);
    };
    attr('a_pos', 2, 0);
    attr('a_texel', 2, 8);
    attr('a_fade', 1, 16);
    gl.bindVertexArray(null);
    target = frameTexture(gl);
    framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const atlas of atlases.values()) upload(atlas);
  };
  build();
  presenter.onRestore(build);

  const quad = (
    out: number[],
    x: number,
    y: number,
    w: number,
    h: number,
    tx: number,
    ty: number,
    fade: number,
  ): void => {
    const corners = [
      [x, y, tx, ty],
      [x + w, y, tx + w, ty],
      [x, y + h, tx, ty + h],
      [x, y + h, tx, ty + h],
      [x + w, y, tx + w, ty],
      [x + w, y + h, tx + w, ty + h],
    ];
    for (const [px = 0, py = 0, u = 0, v = 0] of corners) out.push(px, py, u, v, fade);
  };

  return {
    addAtlas(manifest, image) {
      const atlas: Atlas = { manifest, image, texture: null };
      atlases.set(manifest.sheet, atlas);
      upload(atlas);
    },
    render(scene, items) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      const u = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
      gl.uniform1iv(u('u_bayer'), Int32Array.from(BAYER4));
      gl.uniform1i(u('u_atlas'), 0);
      gl.uniform1f(u('u_bands'), style.poolBands);
      const ambient = style.phases[scene.phase].ambient;
      gl.uniform3f(u('u_ambient'), ambient[0], ambient[1], ambient[2]);
      const pools = scene.pools.slice(0, MAX_POOLS);
      gl.uniform1i(u('u_poolCount'), pools.length);
      if (pools.length > 0) {
        gl.uniform3fv(
          u('u_poolAt'),
          pools.flatMap((p) => [p.x, p.y, p.radius]),
        );
        gl.uniform3fv(
          u('u_poolColour'),
          pools.flatMap((p) => [...p.colour]),
        );
      }

      // The background, lit like everything else.
      const bg = palette.entries[paletteIndex(palette, scene.background)]?.rgb ?? [0, 0, 0];
      gl.uniform1i(u('u_solid'), 1);
      gl.uniform3f(u('u_solidColour'), bg[0], bg[1], bg[2]);
      const full: number[] = [];
      quad(full, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(full), gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Sprites in draw-list order, batched while they share an atlas.
      gl.uniform1i(u('u_solid'), 0);
      gl.activeTexture(gl.TEXTURE0);
      let i = 0;
      while (i < items.length) {
        const sheet = items[i]?.sheet ?? '';
        const atlas = atlases.get(sheet);
        if (atlas?.texture == null) throw new Error(`No atlas loaded for sheet "${sheet}"`);
        const vertices: number[] = [];
        while (i < items.length && items[i]?.sheet === sheet) {
          const item = items[i];
          i++;
          if (item === undefined) continue;
          const at = atlas.manifest.frames[item.frame];
          if (at === undefined) throw new Error(`Atlas ${sheet} has no frame ${item.frame}`);
          quad(vertices, item.x, item.y, item.width, item.height, at[0], at[1], item.fade);
        }
        gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 5);
      }
      gl.bindVertexArray(null);
      presenter.presentTexture(target);
    },
  };
}

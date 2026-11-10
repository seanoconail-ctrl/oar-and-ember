/**
 * The WebGL2 scene renderer (Book 2 section 19, Book 7 sections 01, 08 and 14). It draws a draw
 * list into an off-screen 640 x 360 target, then a post pass lights it into a second target that
 * the presenter scales by a whole number and letterboxes.
 *
 * Passes:
 *   1. the background and the ground and decal layers, unlit;
 *   2. water over the zone's height field (with effects);
 *   3. ground shadows: contact ellipses and long cast silhouettes into a mask, multiplied in;
 *   4. the actor layer (props, plants, people, wildlife, particles) by foot line;
 *   5. post: ambient light and banded pools, then cloud shadows, shafts, grade, mist, flashes.
 *
 * Without effects (the Stage 4 art scenes) passes 2, 3 and the effect half of 5 are skipped, and
 * the output equals the CPU reference renderer (src/render/cpuRenderer.ts) pixel for pixel: every
 * sprite pixel is fetched exactly, cutaways drop pixels in the 4 x 4 Bayer pattern, and the light
 * is the same arithmetic.
 */
import type { Manifest } from './atlas.ts';
import type { Elevation } from './elevation.ts';
import {
  ELLIPSE_FRAGMENT,
  ELLIPSE_VERTEX,
  FULLSCREEN_VERTEX,
  lowDetail,
  MAX_POOLS,
  POST_FRAGMENT,
  POST_PLAIN_FRAGMENT,
  SHADOW_FRAGMENT,
  WATER_FRAGMENT,
} from './glEffects.ts';
import type { Palette } from './palette.ts';
import { paletteIndex } from './palette.ts';
import { frameTexture, linkProgram } from './presenter.ts';
import type { Presenter } from './presenter.ts';
import { BAYER4 } from './scene.ts';
import type { DrawItem, RenderStyle, Scene, SceneEffects } from './scene.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport.ts';

export { MAX_POOLS };

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
uniform float u_mask;             // > 0: write this value where the sprite is opaque (a cast shadow)
uniform int u_bayer[16];
in vec2 v_texel;
flat in float v_fade;
out vec4 outColour;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (u_solid) {
    outColour = vec4(u_solidColour / 255.0, 1.0);
    return;
  }
  vec4 t = texelFetch(u_atlas, ivec2(floor(v_texel)), 0);
  if (t.a < 0.5) discard;
  if (u_mask > 0.0) {
    outColour = vec4(u_mask, u_mask, u_mask, 1.0);
    return;
  }
  if (v_fade > 0.0 && float(u_bayer[(p.y & 3) * 4 + (p.x & 3)]) < floor(v_fade * 16.0 + 0.5)) discard;
  outColour = vec4(floor(t.rgb * 255.0 + 0.5) / 255.0, 1.0);
}`;

interface Atlas {
  readonly manifest: Manifest;
  readonly image: TexImageSource;
  texture: WebGLTexture | null;
}

interface ElevationTexture {
  readonly elevation: Elevation;
  texture: WebGLTexture | null;
}

export interface SceneRenderer {
  /** Registers a compiled atlas (its manifest and decoded image). */
  addAtlas(manifest: Manifest, image: TexImageSource): void;
  /** Registers a zone's height field for its water and open-ground effects. */
  addElevation(zone: string, elevation: Elevation): void;
  /** Draws `items` over `scene.background` under the scene's light, and presents the frame. */
  render(scene: Scene, items: readonly DrawItem[]): void;
  /** Links the water and post programs a scene at `detail` draws with, ahead of the first frame. */
  compile(detail: number, pass: 'water' | 'post'): void;
}

/** Colours the water shader draws with, from the palette's ramps (0 to 255). */
function waterColours(palette: Palette): {
  sea: number[];
  foam: number[];
  glint: number[];
  kelp: number[];
} {
  const ramp = (name: string): number[][] =>
    (palette.ramps.get(name) ?? []).map((i) => [...(palette.entries[i]?.rgb ?? [0, 0, 0])]);
  const sea = ramp('sea');
  const wool = ramp('wool');
  const sky = ramp('sky');
  const pick = (r: number[][], i: number): number[] => r[Math.min(r.length - 1, i)] ?? [0, 0, 0];
  return {
    sea: Array.from({ length: 11 }, (_, i) => pick(sea, i)).flat(),
    foam: [pick(sea, 8), pick(sea, 9), pick(sea, 10)].flat(),
    glint: [...pick(wool, 6).map((v) => Math.min(255, v + 8)), ...pick(sky, 5)].slice(0, 3),
    kelp: pick(ramp('kelp'), 1),
  };
}

export function createSceneRenderer(
  presenter: Presenter,
  palette: Palette,
  style: RenderStyle,
): SceneRenderer {
  const { gl } = presenter;
  const atlases = new Map<string, Atlas>();
  const elevations = new Map<string, ElevationTexture>();
  const colours = waterColours(palette);
  let sprite!: WebGLProgram;
  let ellipse!: WebGLProgram;
  let shade!: WebGLProgram;
  // The water and post programs, compiled on first use: a software renderer takes seconds to
  // compile the full ones, so they are only built when full or lite detail is drawn (AP-16).
  const lazy = new Map<string, WebGLProgram>();
  const SOURCES: Readonly<Record<string, () => string>> = {
    water: () => WATER_FRAGMENT,
    'water-low': () => lowDetail(WATER_FRAGMENT),
    post: () => POST_FRAGMENT,
    'post-low': () => lowDetail(POST_FRAGMENT),
    'post-plain': () => POST_PLAIN_FRAGMENT,
  };
  const program = (key: string): WebGLProgram => {
    let p = lazy.get(key);
    if (p === undefined) {
      p = linkProgram(gl, FULLSCREEN_VERTEX, SOURCES[key]?.() ?? POST_PLAIN_FRAGMENT);
      lazy.set(key, p);
    }
    return p;
  };
  let spriteVao!: WebGLVertexArrayObject;
  let ellipseVao!: WebGLVertexArrayObject;
  let fullVao!: WebGLVertexArrayObject;
  let spriteBuffer!: WebGLBuffer;
  let ellipseBuffer!: WebGLBuffer;
  let sceneTarget!: WebGLTexture;
  let bedCopy!: WebGLTexture;
  let maskTarget!: WebGLTexture;
  let outTarget!: WebGLTexture;
  let sceneFbo!: WebGLFramebuffer;
  let maskFbo!: WebGLFramebuffer;
  let outFbo!: WebGLFramebuffer;
  let blankElevation!: WebGLTexture;

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

  const uploadElevation = (e: ElevationTexture): void => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      e.elevation.width,
      e.elevation.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      e.elevation.rgba,
    );
    // Linear: the height field is smooth between samples, so the waterline is too.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    e.texture = texture;
  };

  const fbo = (texture: WebGLTexture): WebGLFramebuffer => {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return f;
  };

  const build = (): void => {
    sprite = linkProgram(gl, VERTEX, FRAGMENT);
    ellipse = linkProgram(gl, ELLIPSE_VERTEX, ELLIPSE_FRAGMENT);
    shade = linkProgram(gl, FULLSCREEN_VERTEX, SHADOW_FRAGMENT);
    lazy.clear();

    spriteVao = gl.createVertexArray();
    spriteBuffer = gl.createBuffer();
    gl.bindVertexArray(spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuffer);
    const attr = (p: WebGLProgram, name: string, size: number, offset: number, stride: number) => {
      const at = gl.getAttribLocation(p, name);
      if (at < 0) return;
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride, offset);
    };
    attr(sprite, 'a_pos', 2, 0, 20);
    attr(sprite, 'a_texel', 2, 8, 20);
    attr(sprite, 'a_fade', 1, 16, 20);

    ellipseVao = gl.createVertexArray();
    ellipseBuffer = gl.createBuffer();
    gl.bindVertexArray(ellipseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipseBuffer);
    attr(ellipse, 'a_pos', 2, 0, 16);
    attr(ellipse, 'a_local', 2, 8, 16);

    // One VAO for the full-screen passes; every full-screen program binds a_pos to location 0.
    fullVao = gl.createVertexArray();
    gl.bindVertexArray(fullVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    sceneTarget = frameTexture(gl);
    bedCopy = frameTexture(gl);
    maskTarget = frameTexture(gl);
    outTarget = frameTexture(gl);
    sceneFbo = fbo(sceneTarget);
    maskFbo = fbo(maskTarget);
    outFbo = fbo(outTarget);
    blankElevation = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blankElevation);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 0, 0, 255]),
    );
    for (const atlas of atlases.values()) upload(atlas);
    for (const e of elevations.values()) uploadElevation(e);
  };
  build();
  presenter.onRestore(build);

  /** Vertex scratch, reused every frame: 6 corners x (x, y, u, v, fade) a sprite. */
  let scratch = new Float32Array(30 * 1024);
  const quad = (
    at: number,
    x: number,
    y: number,
    w: number,
    h: number,
    tx: number,
    ty: number,
    fade: number,
  ): number => {
    if (at + 30 > scratch.length) {
      const bigger = new Float32Array(scratch.length * 2);
      bigger.set(scratch);
      scratch = bigger;
    }
    const v = scratch;
    let i = at;
    const put = (px: number, py: number, u: number, w2: number): void => {
      v[i] = px;
      v[i + 1] = py;
      v[i + 2] = u;
      v[i + 3] = w2;
      v[i + 4] = fade;
      i += 5;
    };
    put(x, y, tx, ty);
    put(x + w, y, tx + w, ty);
    put(x, y + h, tx, ty + h);
    put(x, y + h, tx, ty + h);
    put(x + w, y, tx + w, ty);
    put(x + w, y + h, tx + w, ty + h);
    return i;
  };

  const uniform = (p: WebGLProgram, name: string): WebGLUniformLocation | null =>
    gl.getUniformLocation(p, name);

  /** Draws sprite items in order, batched while they share an atlas. */
  const drawSprites = (items: readonly DrawItem[]): void => {
    gl.useProgram(sprite);
    gl.bindVertexArray(spriteVao);
    gl.uniform1iv(uniform(sprite, 'u_bayer'), Int32Array.from(BAYER4));
    gl.uniform1i(uniform(sprite, 'u_atlas'), 0);
    gl.uniform1i(uniform(sprite, 'u_solid'), 0);
    gl.uniform1f(uniform(sprite, 'u_mask'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuffer);
    let i = 0;
    while (i < items.length) {
      const sheet = items[i]?.sheet ?? '';
      const atlas = atlases.get(sheet);
      if (atlas?.texture == null) throw new Error(`No atlas loaded for sheet "${sheet}"`);
      let n = 0;
      while (i < items.length && items[i]?.sheet === sheet) {
        const item = items[i];
        i++;
        if (item === undefined) continue;
        const at = atlas.manifest.frames[item.frame];
        if (at === undefined) throw new Error(`Atlas ${sheet} has no frame ${item.frame}`);
        n = quad(n, item.x, item.y, item.width, item.height, at[0], at[1], item.fade);
      }
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.bufferData(gl.ARRAY_BUFFER, scratch.subarray(0, n), gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, n / 5);
    }
  };

  const drawWater = (fx: SceneEffects, elev: ElevationTexture): void => {
    if (fx.water === null || elev.texture === null) return;
    // The water reads the ground drawn so far from a copy of the target.
    gl.bindTexture(gl.TEXTURE_2D, bedCopy);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    const water = program((fx.detail ?? 2) === 0 ? 'water-low' : 'water');
    gl.useProgram(water);
    gl.bindVertexArray(fullVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bedCopy);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, elev.texture);
    gl.uniform1i(uniform(water, 'u_bed'), 0);
    gl.uniform1i(uniform(water, 'u_elev'), 1);
    gl.uniform2f(uniform(water, 'u_elevSize'), elev.elevation.width, elev.elevation.height);
    gl.uniform2f(uniform(water, 'u_cam'), fx.camera.x, fx.camera.y);
    gl.uniform1f(uniform(water, 'u_t'), fx.seconds);
    gl.uniform1f(uniform(water, 'u_tide'), fx.water.tide);
    gl.uniform1f(uniform(water, 'u_wetTo'), fx.water.wetTo);
    gl.uniform1f(uniform(water, 'u_sun'), fx.sun.strength);
    gl.uniform3fv(uniform(water, 'u_sea'), colours.sea);
    gl.uniform3fv(uniform(water, 'u_foam'), colours.foam);
    gl.uniform3fv(uniform(water, 'u_glint'), colours.glint);
    gl.uniform3fv(uniform(water, 'u_kelp'), colours.kelp);
    gl.uniform1i(uniform(water, 'u_detail'), fx.detail ?? 2);
    gl.uniform1iv(uniform(water, 'u_bayer'), Int32Array.from(BAYER4));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
  };

  const drawShadows = (fx: SceneEffects): void => {
    if (fx.shadows.length === 0) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, maskFbo);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    // Contact ellipses.
    const ev: number[] = [];
    for (const s of fx.shadows) {
      const lift = s.lift ?? 0;
      const rx = s.w / 2;
      const ry = s.h / 2;
      const cx = Math.round(s.x);
      const cy = Math.round(s.y + lift) - 0.5;
      const corners = [
        [cx - rx, cy - ry, -1, -1],
        [cx + rx, cy - ry, 1, -1],
        [cx - rx, cy + ry, -1, 1],
        [cx - rx, cy + ry, -1, 1],
        [cx + rx, cy - ry, 1, -1],
        [cx + rx, cy + ry, 1, 1],
      ];
      for (const [a = 0, b = 0, c = 0, d = 0] of corners) ev.push(a, b, c, d);
    }
    gl.useProgram(ellipse);
    gl.bindVertexArray(ellipseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipseBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ev), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, ev.length / 4);
    // Long cast shadows: each silhouette sheared along the ground away from the sun.
    if (fx.sun.strength > 0.05 && (fx.detail ?? 2) >= 2) {
      gl.useProgram(sprite);
      gl.bindVertexArray(spriteVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuffer);
      gl.uniform1i(uniform(sprite, 'u_solid'), 0);
      gl.uniform1i(uniform(sprite, 'u_atlas'), 0);
      gl.uniform1f(uniform(sprite, 'u_mask'), 0.7 * fx.sun.strength);
      gl.activeTexture(gl.TEXTURE0);
      for (const s of fx.shadows) {
        if (s.sheet === undefined || s.frame === undefined) continue;
        const atlas = atlases.get(s.sheet);
        const at = atlas?.manifest.frames[s.frame];
        if (atlas?.texture == null || at === undefined) continue;
        const m = atlas.manifest;
        const item = {
          x: Math.round(s.x) - m.pivot.x,
          y: Math.round(s.y) - m.pivot.y,
          width: m.width,
          height: m.height,
        };
        const foot = Math.round(s.y) + (s.lift ?? 0);
        const v: number[] = [];
        const corner = (px: number, py: number, u: number, w: number): void => {
          const hgt = foot - py;
          v.push(px + fx.sun.x * hgt, foot + fx.sun.y * hgt, u, w, 0);
        };
        const x0 = item.x;
        const y0 = item.y;
        const x1 = item.x + item.width;
        const y1 = item.y + item.height;
        corner(x0, y0, at[0], at[1]);
        corner(x1, y0, at[0] + item.width, at[1]);
        corner(x0, y1, at[0], at[1] + item.height);
        corner(x0, y1, at[0], at[1] + item.height);
        corner(x1, y0, at[0] + item.width, at[1]);
        corner(x1, y1, at[0] + item.width, at[1] + item.height);
        gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.uniform1f(uniform(sprite, 'u_mask'), 0);
    }
    gl.blendEquation(gl.FUNC_ADD);
    // Multiply the ground by the mask.
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    gl.useProgram(shade);
    gl.bindVertexArray(fullVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskTarget);
    gl.uniform1i(uniform(shade, 'u_mask'), 0);
    gl.uniform3f(uniform(shade, 'u_tint'), 0.5, 0.55, 0.7);
    gl.uniform1f(uniform(shade, 'u_depth'), 0.62);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ZERO);
  };

  const drawPost = (scene: Scene, elev: ElevationTexture | undefined): void => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, outFbo);
    const fxDetail = scene.effects?.detail ?? 2;
    const post = program(
      scene.effects === undefined ? 'post-plain' : fxDetail === 0 ? 'post-low' : 'post',
    );
    gl.useProgram(post);
    gl.bindVertexArray(fullVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTarget);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, elev?.texture ?? blankElevation);
    const u = (name: string): WebGLUniformLocation | null => uniform(post, name);
    gl.uniform1i(u('u_scene'), 0);
    gl.uniform1i(u('u_elev'), 1);
    gl.uniform1i(u('u_hasElev'), elev?.texture == null ? 0 : 1);
    gl.uniform2f(u('u_elevSize'), elev?.elevation.width ?? 1, elev?.elevation.height ?? 1);
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
    const fx = scene.effects;
    gl.uniform1i(u('u_effects'), fx === undefined ? 0 : 1);
    if (fx !== undefined) {
      gl.uniform2f(u('u_cam'), fx.camera.x, fx.camera.y);
      gl.uniform1f(u('u_t'), fx.seconds);
      gl.uniform3f(u('u_wind'), fx.wind.dirX, fx.wind.dirY, fx.wind.strength);
      gl.uniform1f(u('u_clouds'), fx.clouds);
      gl.uniform1f(u('u_shafts'), fx.shafts);
      gl.uniform3f(u('u_gain'), fx.grade.gain[0], fx.grade.gain[1], fx.grade.gain[2]);
      gl.uniform3f(u('u_lift'), fx.grade.lift[0], fx.grade.lift[1], fx.grade.lift[2]);
      gl.uniform1f(u('u_fog'), fx.fog);
      gl.uniform3f(u('u_fogColour'), 178, 187, 187);
      gl.uniform1f(u('u_flash'), fx.flash);
      gl.uniform1i(u('u_detail'), fx.detail ?? 2);
      gl.uniform1f(u('u_dryAbove'), fx.water === null ? -9 : fx.water.wetTo + 0.16);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };

  return {
    compile(detail, pass) {
      program(detail === 0 ? `${pass}-low` : pass);
    },
    addAtlas(manifest, image) {
      const atlas: Atlas = { manifest, image, texture: null };
      atlases.set(manifest.sheet, atlas);
      upload(atlas);
    },
    addElevation(zone, elevation) {
      const e: ElevationTexture = { elevation, texture: null };
      elevations.set(zone, e);
      uploadElevation(e);
    },
    render(scene, items) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
      // The last present left the output texture bound; let go of every texture first, so no
      // pass draws into a texture it is also reading.
      for (const unit of [gl.TEXTURE1, gl.TEXTURE0]) {
        gl.activeTexture(unit);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      gl.viewport(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      gl.disable(gl.BLEND);

      // The background.
      gl.useProgram(sprite);
      gl.bindVertexArray(spriteVao);
      const bg = palette.entries[paletteIndex(palette, scene.background)]?.rgb ?? [0, 0, 0];
      gl.uniform1i(uniform(sprite, 'u_solid'), 1);
      gl.uniform3f(uniform(sprite, 'u_solidColour'), bg[0], bg[1], bg[2]);
      const fullN = quad(0, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, scratch.subarray(0, fullN), gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      const split = items.findIndex((d) => d.layer === 'actor');
      const lower = split < 0 ? items : items.slice(0, split);
      const upper = split < 0 ? [] : items.slice(split);
      drawSprites(lower);
      const fx = scene.effects;
      const elev =
        fx?.water === undefined || fx.water === null ? undefined : elevations.get(fx.water.zone);
      if (fx !== undefined) {
        if (elev !== undefined) drawWater(fx, elev);
        // Low detail (a slow machine) skips the shadow pass.
        if ((fx.detail ?? 2) > 0) drawShadows(fx);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
      }
      drawSprites(upper);
      drawPost(scene, elev);
      gl.bindVertexArray(null);
      presenter.presentTexture(outTarget);
    },
  };
}

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
import type { Flow } from '../content/terrain/flow.ts';
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
import { rimColour } from './cpuRenderer.ts';
import { BAYER4, RIM_MIX, STREAK_MIX, WET_DARKEN } from './scene.ts';
import type {
  DrawItem,
  DrawPlan,
  PlantRun,
  Recolour,
  RenderStyle,
  Scene,
  SceneEffects,
} from './scene.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport.ts';

export { MAX_POOLS };

/** Floats a sprite vertex: x, y, u, v, fade, cut, water r g b, dark. */
const STRIDE = 10;
const NO_WATER = [0, 0, 0] as const;

/** One corner of a sprite's quad: position, atlas texel, fade, the waterline, its colour, dark. */
function corner(
  v: Float32Array,
  i: number,
  px: number,
  py: number,
  u: number,
  w2: number,
  fade: number,
  cut: number,
  water: readonly [number, number, number],
  dark: number,
): void {
  v[i] = px;
  v[i + 1] = py;
  v[i + 2] = u;
  v[i + 3] = w2;
  v[i + 4] = fade;
  v[i + 5] = cut;
  v[i + 6] = water[0];
  v[i + 7] = water[1];
  v[i + 8] = water[2];
  v[i + 9] = dark;
}

const VERTEX = `#version 300 es
in vec2 a_pos;      // logical pixels, y down
in vec2 a_texel;    // atlas texel at this corner
in float a_fade;
in float a_cut;     // first screen row drawn as water (a wading person), or -1
in vec3 a_water;    // the water's colour, 0 to 255
in float a_dark;    // 0 to 1: wet and darker
out vec2 v_texel;
flat out float v_fade;
flat out float v_cut;
flat out vec3 v_water;
flat out float v_dark;
void main() {
  v_texel = a_texel;
  v_fade = a_fade;
  v_cut = a_cut;
  v_water = a_water;
  v_dark = a_dark;
  // y down maps to clip -1 at the top, so the target's row 0 is the frame's top row.
  gl_Position = vec4(a_pos.x / ${LOGICAL_WIDTH / 2}.0 - 1.0, a_pos.y / ${LOGICAL_HEIGHT / 2}.0 - 1.0, 0.0, 1.0);
}`;

/**
 * The same sprite drawn as one instance (decision DH-161): its rectangle, its atlas texel at the
 * top-left and the rest once a sprite, the six corners from a static buffer. Each corner's
 * position and texel are the rectangle's whole numbers plus 0 or its size, exact in float, so
 * every sprite covers the same pixels with the same texels as the six-vertex quad.
 */
const INSTANCED_VERTEX = `#version 300 es
layout(location = 0) in vec2 a_corner; // 0 or 1 on each axis
in vec4 a_rect;     // x, y, w, h: logical pixels, y down
in vec2 a_uv;       // atlas texel at the top-left corner
in float a_fade;
in float a_cut;
in vec3 a_water;
in float a_dark;
out vec2 v_texel;
flat out float v_fade;
flat out float v_cut;
flat out vec3 v_water;
flat out float v_dark;
void main() {
  vec2 size = a_corner * a_rect.zw;
  vec2 pos = a_rect.xy + size;
  v_texel = a_uv + size;
  v_fade = a_fade;
  v_cut = a_cut;
  v_water = a_water;
  v_dark = a_dark;
  gl_Position = vec4(pos.x / ${LOGICAL_WIDTH / 2}.0 - 1.0, pos.y / ${LOGICAL_HEIGHT / 2}.0 - 1.0, 0.0, 1.0);
}`;
/** Floats an instance: the rectangle (4), the texel (2), fade, cut, water (3), dark. */
const INSTANCE = 12;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_atlas;
uniform bool u_solid;
uniform vec3 u_solidColour;       // 0 to 255
uniform float u_mask;             // > 0: write this value where the sprite is opaque (a cast shadow)
uniform int u_bayer[16];
uniform float u_t;                // visual clock, seconds (the waterline's ripple)
uniform vec3 u_rim;               // the waterline's light, 0 to 255
in vec2 v_texel;
flat in float v_fade;
flat in float v_cut;
flat in vec3 v_water;
flat in float v_dark;
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
  vec3 c = floor(t.rgb * 255.0 + 0.5);
  if (v_dark > 0.0) c = c * (1.0 - ${WET_DARKEN.toFixed(2)} * v_dark);
  if (v_cut >= 0.0) {
    // The same arithmetic as rimWobble and streakRow (src/render/scene.ts).
    float wob = floor(sin(u_t * 5.0 + float(p.x) * 0.9) * 0.6 + 0.5);
    float y = float(p.y);
    if (y == v_cut + wob) c = c * ${(1 - RIM_MIX).toFixed(2)} + u_rim * ${RIM_MIX.toFixed(2)};
    else if (y >= v_cut) {
      int r = int(y - v_cut) + int(floor(u_t * 6.0));
      float k = (r % 3) != 0 ? ${STREAK_MIX.toFixed(2)} : 0.0;
      c = v_water * (1.0 - k) + c * k;
    }
    c = floor(c);
  }
  outColour = vec4(c / 255.0, 1.0);
}`;

interface Atlas {
  readonly manifest: Manifest;
  readonly image: TexImageSource;
  texture: WebGLTexture | null;
  /** The texture as drawn, and its season's recolourings by key (Stage 14). */
  base: WebGLTexture | null;
  readonly seasons: Map<string, WebGLTexture>;
}

interface ElevationTexture {
  readonly elevation: Elevation;
  texture: WebGLTexture | null;
  /** Stage 14: the stream's flow (decision S14-91), and its texture. */
  readonly flow: Flow | null;
  flowTexture: WebGLTexture | null;
}

export interface SceneRenderer {
  /** Registers a compiled atlas (its manifest and decoded image). */
  addAtlas(manifest: Manifest, image: TexImageSource): void;
  /** Registers a zone's height field for its water and open-ground effects (and its flow). */
  addElevation(zone: string, elevation: Elevation, flow?: Flow): void;
  /**
   * Draws `items` (or a draw plan: its items with its plants among them, decision DH-161) over
   * `scene.background` under the scene's light, and presents the frame.
   */
  render(scene: Scene, items: readonly DrawItem[] | DrawPlan): void;
  /** Links the water and post programs a scene at `detail` draws with, ahead of the first frame. */
  compile(detail: number, pass: 'water' | 'post'): void;
}

/** Colours the water shader draws with, from the palette's ramps (0 to 255). */
function waterColours(palette: Palette): {
  sea: number[];
  foam: number[];
  glint: number[];
  kelp: number[];
  snow: number[];
  stone: number[];
  anemone: number[];
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
    // Snow in shadow, in half light and lit (Stage 14): the sky's pale steps and the sea's foam.
    snow: [pick(sky, 3), pick(sky, 5), pick(sea, 10)].flat(),
    // A dry stream bed's stones (Stage 14): shadowed, middle and lit steps of the stone ramp.
    stone: [pick(ramp('stone'), 3), pick(ramp('stone'), 5), pick(ramp('stone'), 6)].flat(),
    // Anemones in the passage's pools (Stage 14): the madder ramp's deep and lit reds.
    anemone: [pick(ramp('madder'), 3), pick(ramp('madder'), 5)].flat(),
  };
}

/** Recolours an atlas image's pixels by the palette's index map (Stage 14, the seasons). */
function recolourImage(
  image: TexImageSource,
  palette: Palette,
  index: Uint8Array,
): ImageData | null {
  const w = (image as { width?: number }).width ?? 0;
  const h = (image as { height?: number }).height ?? 0;
  if (w === 0 || h === 0 || typeof OffscreenCanvas === 'undefined') return null;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;
  ctx.drawImage(image as CanvasImageSource, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const to = new Map<number, number>();
  palette.entries.forEach((e, i) => {
    const j = index[i] ?? i;
    if (j === i) return;
    const f = palette.entries[j]?.rgb;
    if (f === undefined) return;
    to.set((e.rgb[0] << 16) | (e.rgb[1] << 8) | e.rgb[2], (f[0] << 16) | (f[1] << 8) | f[2]);
  });
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if ((px[i + 3] ?? 0) === 0) continue;
    const v = to.get(((px[i] ?? 0) << 16) | ((px[i + 1] ?? 0) << 8) | (px[i + 2] ?? 0));
    if (v === undefined) continue;
    px[i] = (v >> 16) & 0xff;
    px[i + 1] = (v >> 8) & 0xff;
    px[i + 2] = v & 0xff;
  }
  return data;
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
  const rim = rimColour(palette);
  let sprite!: WebGLProgram;
  /** The sprite program drawn by instances (decision DH-161), for the sprites' own pass. */
  let spriteInst!: WebGLProgram;
  let instVao!: WebGLVertexArrayObject;
  let instBuffer!: WebGLBuffer;
  /** The instance attributes' locations, sizes and offsets in an instance (bytes). */
  let instAttrs: { at: number; size: number; offset: number }[] = [];
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
  /** No flow: the stream runs south, as it did before Stage 14. */
  let blankFlow!: WebGLTexture;

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
    atlas.base = texture;
    atlas.seasons.clear();
  };

  /** The season's colours on its sheets (Stage 14): made once per recolouring, then kept. */
  let recoloured = '';
  const applyRecolour = (r: Recolour | undefined): void => {
    const key = r?.key ?? '';
    if (key === recoloured) return;
    recoloured = key;
    for (const atlas of atlases.values()) {
      if (r?.sheets.has(atlas.manifest.sheet) !== true) {
        atlas.texture = atlas.base;
        continue;
      }
      let t = atlas.seasons.get(key);
      if (t === undefined) {
        const data = recolourImage(atlas.image, palette, r.index);
        if (data === null) continue;
        t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        atlas.seasons.set(key, t);
      }
      atlas.texture = t;
    }
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
      e.flow?.elevationRgba ?? e.elevation.rgba,
    );
    // Linear: the height field is smooth between samples, so the waterline is too.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    e.texture = texture;
    // The stream's flow, smooth between samples like the heights (Stage 14).
    e.flowTexture = null;
    if (e.flow === null) return;
    const ft = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ft);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      e.flow.width,
      e.flow.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      e.flow.rgba,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    e.flowTexture = ft;
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
    spriteInst = linkProgram(gl, INSTANCED_VERTEX, FRAGMENT);
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
    attr(sprite, 'a_pos', 2, 0, STRIDE * 4);
    attr(sprite, 'a_texel', 2, 8, STRIDE * 4);
    attr(sprite, 'a_fade', 1, 16, STRIDE * 4);
    attr(sprite, 'a_cut', 1, 20, STRIDE * 4);
    attr(sprite, 'a_water', 3, 24, STRIDE * 4);
    attr(sprite, 'a_dark', 1, 36, STRIDE * 4);

    // The instanced sprites: the six corners once, then one instance a sprite.
    instVao = gl.createVertexArray();
    gl.bindVertexArray(instVao);
    const corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    instBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuffer);
    instAttrs = [];
    const per = (name: string, size: number, offset: number): void => {
      const at = gl.getAttribLocation(spriteInst, name);
      if (at < 0) return;
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, INSTANCE * 4, offset);
      gl.vertexAttribDivisor(at, 1);
      instAttrs.push({ at, size, offset });
    };
    per('a_rect', 4, 0);
    per('a_uv', 2, 16);
    per('a_fade', 1, 24);
    per('a_cut', 1, 28);
    per('a_water', 3, 32);
    per('a_dark', 1, 44);

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
    blankFlow = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blankFlow);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([128, 255, 166, 0]),
    );
    recoloured = '';
    for (const atlas of atlases.values()) upload(atlas);
    for (const e of elevations.values()) uploadElevation(e);
  };
  build();
  presenter.onRestore(build);

  /** Vertex scratch, reused every frame: 6 corners x STRIDE floats a sprite. */
  let scratch = new Float32Array(6 * STRIDE * 1024);
  const quad = (
    at: number,
    x: number,
    y: number,
    w: number,
    h: number,
    tx: number,
    ty: number,
    fade: number,
    item?: DrawItem,
  ): number => {
    if (at + 6 * STRIDE > scratch.length) {
      const bigger = new Float32Array(scratch.length * 2);
      bigger.set(scratch);
      scratch = bigger;
    }
    const cut = item?.cutY ?? -1;
    const water = item?.water ?? NO_WATER;
    const dark = item?.dark ?? 0;
    // The six corners written straight in (no closure a sprite: thousands a frame, DH-161).
    corner(scratch, at, x, y, tx, ty, fade, cut, water, dark);
    corner(scratch, at + STRIDE, x + w, y, tx + w, ty, fade, cut, water, dark);
    corner(scratch, at + 2 * STRIDE, x, y + h, tx, ty + h, fade, cut, water, dark);
    corner(scratch, at + 3 * STRIDE, x, y + h, tx, ty + h, fade, cut, water, dark);
    corner(scratch, at + 4 * STRIDE, x + w, y, tx + w, ty, fade, cut, water, dark);
    corner(scratch, at + 5 * STRIDE, x + w, y + h, tx + w, ty + h, fade, cut, water, dark);
    return at + 6 * STRIDE;
  };

  /** Instance scratch, reused every frame: INSTANCE floats a sprite. */
  let instScratch = new Float32Array(INSTANCE * 2048);
  const instance = (
    at: number,
    x: number,
    y: number,
    w: number,
    h: number,
    tx: number,
    ty: number,
    fade: number,
    item?: DrawItem,
  ): number => {
    if (at + INSTANCE > instScratch.length) {
      const bigger = new Float32Array(instScratch.length * 2);
      bigger.set(instScratch);
      instScratch = bigger;
    }
    const v = instScratch;
    const water = item?.water ?? NO_WATER;
    v[at] = x;
    v[at + 1] = y;
    v[at + 2] = w;
    v[at + 3] = h;
    v[at + 4] = tx;
    v[at + 5] = ty;
    v[at + 6] = fade;
    v[at + 7] = item?.cutY ?? -1;
    v[at + 8] = water[0];
    v[at + 9] = water[1];
    v[at + 10] = water[2];
    v[at + 11] = item?.dark ?? 0;
    return at + INSTANCE;
  };

  const uniform = (p: WebGLProgram, name: string): WebGLUniformLocation | null =>
    gl.getUniformLocation(p, name);

  /** Each plant frame name's atlas texel (u, v), NaN where the atlas lacks it: once a table. */
  const texelCache = new WeakMap<readonly string[], { atlas: Atlas; uv: Float64Array }>();
  const plantTexels = (atlas: Atlas, run: PlantRun): Float64Array => {
    const hit = texelCache.get(run.frames);
    if (hit?.atlas === atlas) return hit.uv;
    const uv = new Float64Array(run.frames.length * 2).fill(Number.NaN);
    run.frames.forEach((name, id) => {
      const at = atlas.manifest.frames[name];
      if (at === undefined) return;
      uv[2 * id] = at[0];
      uv[2 * id + 1] = at[1];
    });
    texelCache.set(run.frames, { atlas, uv });
    return uv;
  };

  /**
   * Draws items[from..to) in order, batched while they share an atlas, with a plant run's plants
   * among them where the plan puts them (decision DH-161): the same draw calls as the plants drawn
   * as items. With `last`, the run's plants after the last item are drawn too.
   */
  const drawSprites = (
    items: readonly DrawItem[],
    from: number,
    to: number,
    run: PlantRun | null,
    last: boolean,
    seconds = 0,
  ): void => {
    // Both sprite programs get the pass's uniforms: the six-vertex one keeps the state the shadow
    // pass and the next frame's background have always found it in.
    for (const prog of [sprite, spriteInst]) {
      gl.useProgram(prog);
      gl.uniform1iv(uniform(prog, 'u_bayer'), Int32Array.from(BAYER4));
      gl.uniform1i(uniform(prog, 'u_atlas'), 0);
      gl.uniform1i(uniform(prog, 'u_solid'), 0);
      gl.uniform1f(uniform(prog, 'u_mask'), 0);
      gl.uniform1f(uniform(prog, 'u_t'), seconds);
      gl.uniform3f(uniform(prog, 'u_rim'), rim[0], rim[1], rim[2]);
    }
    gl.bindVertexArray(instVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuffer);
    let sheet = '';
    let atlas: Atlas | undefined;
    let n = 0;
    // The pass's instances go up in one upload; each run of one atlas is drawn from its place in
    // it (decision DH-161: a hundred and more small uploads a frame cost more than the drawing).
    const batches: { texture: WebGLTexture; from: number; to: number }[] = [];
    let begun = 0;
    const flush = (): void => {
      if (n > begun && atlas?.texture != null)
        batches.push({ texture: atlas.texture, from: begun, to: n });
      begun = n;
    };
    const use = (name: string): Atlas => {
      if (name !== sheet || atlas === undefined) {
        flush();
        sheet = name;
        atlas = atlases.get(name);
        if (atlas?.texture == null) throw new Error(`No atlas loaded for sheet "${name}"`);
      }
      return atlas;
    };
    let p = run === null || from === 0 ? 0 : (run.before[from - 1] ?? 0);
    const plantsTo = (end: number): void => {
      if (run === null || p >= end) return;
      const uv = plantTexels(use(run.sheet), run);
      for (; p < end; p++) {
        const id = run.frameId[p] ?? 0;
        const u = uv[2 * id] ?? Number.NaN;
        if (Number.isNaN(u))
          throw new Error(`Atlas ${run.sheet} has no frame ${run.frames[id] ?? String(id)}`);
        n = instance(
          n,
          run.x[p] ?? 0,
          run.y[p] ?? 0,
          run.width,
          run.height,
          u,
          uv[2 * id + 1] ?? 0,
          0,
        );
      }
    };
    for (let k = from; k < to; k++) {
      if (run !== null) plantsTo(run.before[k] ?? 0);
      const item = items[k];
      if (item === undefined) continue;
      const at = use(item.sheet).manifest.frames[item.frame];
      if (at === undefined) throw new Error(`Atlas ${item.sheet} has no frame ${item.frame}`);
      n = instance(n, item.x, item.y, item.width, item.height, at[0], at[1], item.fade, item);
    }
    if (last && run !== null) plantsTo(run.count);
    flush();
    if (batches.length === 0) return;
    gl.bufferData(gl.ARRAY_BUFFER, instScratch.subarray(0, n), gl.STREAM_DRAW);
    for (const batch of batches) {
      for (const a of instAttrs)
        gl.vertexAttribPointer(
          a.at,
          a.size,
          gl.FLOAT,
          false,
          INSTANCE * 4,
          batch.from * 4 + a.offset,
        );
      gl.bindTexture(gl.TEXTURE_2D, batch.texture);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, (batch.to - batch.from) / INSTANCE);
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
    // Stage 14: the stream's flow and the land by season.
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, elev.flowTexture ?? blankFlow);
    gl.uniform1i(uniform(water, 'u_flow'), 2);
    const land = fx.water.land;
    gl.uniform4f(
      uniform(water, 'u_land'),
      land?.snow ?? 0,
      land?.freeze === true ? 1 : 0,
      land?.shrink === true ? 1 : 0,
      land?.calm === true ? 1 : 0,
    );
    gl.uniform3fv(uniform(water, 'u_snow'), colours.snow);
    gl.uniform3fv(uniform(water, 'u_stone'), colours.stone);
    gl.uniform1f(uniform(water, 'u_anemones'), land?.anemones === true ? 1 : 0);
    gl.uniform1f(uniform(water, 'u_causeway'), land?.causeway === true ? 1 : 0);
    gl.uniform3fv(uniform(water, 'u_anemone'), colours.anemone);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null);
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
          v.push(px + fx.sun.x * hgt, foot + fx.sun.y * hgt, u, w, 0, -1, 0, 0, 0, 0);
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
      // Design addendum 2.5 (DF-16): the light varies in drifting patches, never a flat blue.
      const pt = fx.patches;
      gl.uniform4f(
        u('u_patches'),
        pt?.share ?? 0,
        pt?.size ?? 1,
        (pt?.vx ?? 0) * fx.seconds,
        (pt?.vy ?? 0) * fx.seconds,
      );
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
      const atlas: Atlas = { manifest, image, texture: null, base: null, seasons: new Map() };
      atlases.set(manifest.sheet, atlas);
      upload(atlas);
    },
    addElevation(zone, elevation, flow) {
      const e: ElevationTexture = {
        elevation,
        texture: null,
        flow: flow ?? null,
        flowTexture: null,
      };
      elevations.set(zone, e);
      uploadElevation(e);
    },
    render(scene, list) {
      const plan: DrawPlan = Array.isArray(list)
        ? { items: list as readonly DrawItem[], plants: null }
        : (list as DrawPlan);
      const items = plan.items;
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
      // The last present left the output texture bound; let go of every texture first, so no
      // pass draws into a texture it is also reading.
      for (const unit of [gl.TEXTURE1, gl.TEXTURE0]) {
        gl.activeTexture(unit);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      gl.viewport(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      gl.disable(gl.BLEND);
      applyRecolour(scene.recolour);

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

      // Below the actors (the ground and decals), then the water and shadows, then the actors with
      // the plants among them (every plant is an actor, so none falls below the split).
      const found = items.findIndex((d) => d.layer === 'actor');
      const split = found < 0 ? items.length : found;
      drawSprites(items, 0, split, null, false);
      const fx = scene.effects;
      const elev =
        fx?.water === undefined || fx.water === null ? undefined : elevations.get(fx.water.zone);
      if (fx !== undefined) {
        if (elev !== undefined) drawWater(fx, elev);
        // Low detail (a slow machine) skips the shadow pass.
        if ((fx.detail ?? 2) > 0) drawShadows(fx);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
      }
      drawSprites(items, split, items.length, plan.plants, true, fx?.seconds ?? 0);
      drawPost(scene, elev);
      gl.bindVertexArray(null);
      presenter.presentTexture(outTarget);
    },
  };
}

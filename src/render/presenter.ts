/**
 * Presents a 640 x 360 RGBA frame on a WebGL2 canvas at a whole-number scale with letterbox bars
 * (Book 7 section 01). Each device pixel fetches exactly one frame texel, so there is no
 * filtering, no mipmapping and no half-pixel blur at any scale.
 *
 * Stage 1 composes frames on the CPU from palette indices; Stage 4 adds GPU sprite batching,
 * atlases, lighting and decals in front of this presenter.
 */
import { computeViewport, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport.ts';
import type { Viewport } from './viewport.ts';

const VERTEX_SHADER = `#version 300 es
in vec2 a_corner;
void main() {
  // One triangle that covers the whole canvas (corners from a 3-vertex buffer; gl_VertexID is
  // avoided because some WebKit builds have rejected it).
  gl_Position = vec4(a_corner, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_frame;
uniform vec2 u_origin;   // frame's bottom-left corner in canvas pixels (GL orientation)
uniform float u_scale;   // whole-number scale
uniform ivec2 u_size;    // frame size in logical pixels
uniform vec4 u_letterbox;
out vec4 outColour;
void main() {
  ivec2 p = ivec2(floor((gl_FragCoord.xy - u_origin) / u_scale));
  if (p.x < 0 || p.y < 0 || p.x >= u_size.x || p.y >= u_size.y) {
    outColour = u_letterbox;
  } else {
    outColour = texelFetch(u_frame, ivec2(p.x, u_size.y - 1 - p.y), 0);
  }
}`;

export interface Presenter {
  readonly gl: WebGL2RenderingContext;
  /** Sets the drawing surface size in device pixels and redraws the last frame. */
  resize(deviceWidth: number, deviceHeight: number): void;
  /** Uploads and shows a frame of LOGICAL_WIDTH x LOGICAL_HEIGHT RGBA bytes. */
  present(rgba: Uint8Array): void;
  /** Shows a LOGICAL_WIDTH x LOGICAL_HEIGHT texture whose row 0 is the top of the frame. */
  presentTexture(texture: WebGLTexture): void;
  /** Runs `rebuild` after a lost context is restored, so other renderers can recreate resources. */
  onRestore(rebuild: () => void): void;
  readonly viewport: Viewport;
}

interface GlResources {
  readonly program: WebGLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly texture: WebGLTexture;
  readonly uniforms: {
    readonly origin: WebGLUniformLocation | null;
    readonly scale: WebGLUniformLocation | null;
    readonly size: WebGLUniformLocation | null;
    readonly letterbox: WebGLUniformLocation | null;
  };
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const name = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
  const shader = gl.createShader(type);
  if (shader === null) {
    throw new Error(
      `WebGL2: could not create the ${name} shader (context lost: ${gl.isContextLost()})`,
    );
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    const log = gl.getShaderInfoLog(shader);
    throw new Error(
      `WebGL2 ${name} shader failed: ${log === null || log === '' ? 'no log' : log} ` +
        `(context lost: ${gl.isContextLost()}, error: ${gl.getError()})`,
    );
  }
  return shader;
}

export function linkProgram(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    throw new Error(`WebGL2 program failed: ${gl.getProgramInfoLog(program) ?? 'no log'}`);
  }
  return program;
}

/** A logical-size RGBA8 texture with nearest sampling. */
export function frameTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function setUp(gl: WebGL2RenderingContext): GlResources {
  const program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'a_corner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.disable(gl.DITHER);
  return {
    program,
    vao,
    texture: frameTexture(gl),
    uniforms: {
      origin: gl.getUniformLocation(program, 'u_origin'),
      scale: gl.getUniformLocation(program, 'u_scale'),
      size: gl.getUniformLocation(program, 'u_size'),
      letterbox: gl.getUniformLocation(program, 'u_letterbox'),
    },
  };
}

/**
 * Creates a presenter on `canvas`, or returns null when the browser offers no WebGL2.
 * `letterbox` is the RGB of the bars around the frame.
 */
export function createPresenter(
  canvas: HTMLCanvasElement,
  letterbox: readonly [number, number, number],
): Presenter | null {
  const options: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  };
  const gl = canvas.getContext('webgl2', options);
  if (gl === null) return null;

  let resources: GlResources | null = setUp(gl);
  let lastFrame: Uint8Array | null = null;
  let source: WebGLTexture | null = null;
  let viewport = computeViewport(canvas.width, canvas.height);
  const restorers: (() => void)[] = [];

  const draw = (): void => {
    if (resources === null || source === null) return;
    const { program, vao, uniforms } = resources;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.uniform1i(gl.getUniformLocation(program, 'u_frame'), 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.origin, viewport.x, canvas.height - viewport.y - viewport.height);
    gl.uniform1f(uniforms.scale, viewport.scale);
    gl.uniform2i(uniforms.size, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    gl.uniform4f(uniforms.letterbox, letterbox[0] / 255, letterbox[1] / 255, letterbox[2] / 255, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    resources = null;
    source = null;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    resources = setUp(gl);
    if (lastFrame !== null) presenter.present(lastFrame);
    for (const rebuild of restorers) rebuild();
  });

  const presenter: Presenter = {
    gl,
    get viewport() {
      return viewport;
    },
    resize(deviceWidth, deviceHeight) {
      const w = Math.max(1, Math.floor(deviceWidth));
      const h = Math.max(1, Math.floor(deviceHeight));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      viewport = computeViewport(w, h);
      draw();
    },
    present(rgba) {
      if (rgba.length !== LOGICAL_WIDTH * LOGICAL_HEIGHT * 4) {
        throw new Error(`A frame must be ${LOGICAL_WIDTH} x ${LOGICAL_HEIGHT} RGBA bytes`);
      }
      lastFrame = rgba;
      if (resources === null) return;
      gl.bindTexture(gl.TEXTURE_2D, resources.texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        rgba,
      );
      source = resources.texture;
      draw();
    },
    presentTexture(texture) {
      lastFrame = null;
      source = texture;
      draw();
    },
    onRestore(rebuild) {
      restorers.push(rebuild);
    },
  };
  return presenter;
}

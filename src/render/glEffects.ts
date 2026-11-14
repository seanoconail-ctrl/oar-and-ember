/**
 * Shader sources for the living-world passes (Book 7 section 14): water over the shore's height
 * field, the ground-shadow mask and its composite, and the post grade (light, cloud shadows,
 * light shafts, mist, flashes). Visual only. Every pass writes whole logical pixels; noise is
 * looked up on whole world pixels, so the world does not crawl as the camera moves.
 */
import { GUST_SPACING, GUST_SPEED } from './wind.ts';
import { ELEVATION_CELL, SWASH, SWASH_PERIOD } from './elevation.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport.ts';

export const MAX_POOLS = 8;

/** A triangle covering the whole target. */
export const FULLSCREEN_VERTEX = `#version 300 es
layout(location = 0) in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const NOISE = `
float hash2(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 65536);
  uint h = (q.x * 0x27d4eb2du) ^ (q.y * 0x165667b1u);
  h ^= h >> 15; h *= 0x85ebca6bu; h ^= h >> 13; h *= 0xc2b2ae35u; h ^= h >> 16;
  return float(h & 0xffffu) / 65535.0;
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float gust(vec2 w, vec2 dir, float t) {
  float along = w.x * dir.x + w.y * dir.y;
  float across = -w.x * dir.y + w.y * dir.x;
  float k = 6.2831853 / ${GUST_SPACING.toFixed(1)};
  float a = sin((along - t * ${GUST_SPEED.toFixed(1)}) * k + 1.7 * sin(across * 0.011 + t * 0.13));
  float b = sin((along - t * ${(GUST_SPEED * 0.8).toFixed(2)}) * k * 0.53 + across * 0.019 + 2.1);
  float v = max(0.0, a) * (0.55 + 0.45 * max(0.0, b));
  return v * v * (3.0 - 2.0 * v);
}
float swash(float x, float t) {
  float s = 0.5 + 0.5 * sin(t / ${SWASH_PERIOD.toFixed(2)} * 6.2831853 + x * 0.021 + 0.6 * sin(x * 0.05 + t * 0.3));
  return ${SWASH.toFixed(3)} * s * s;
}`;

/**
 * Water. Reads the ground drawn so far (u_bed) and the height field; writes water, foam, the
 * swash and its wet sheen, drying sand, the stream's flow and glints. Discards dry ground.
 */
export const WATER_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_bed;
uniform sampler2D u_elev;
uniform vec2 u_elevSize;
uniform vec2 u_cam;
uniform float u_t;
uniform float u_tide;
uniform float u_wetTo;
uniform float u_sun;
uniform vec3 u_sea[11];
uniform vec3 u_foam[3];
uniform vec3 u_glint;
uniform vec3 u_kelp;
uniform int u_detail;   // 2 full, 1 lite, 0 low (slow machines)
uniform int u_bayer[16];
// Stage 14 (decisions S14-90 to S14-99): the stream's flow (R, G its way, B its speed, A foam,
// a fall's lip and sheet), and the land by season: x snow cover on high ground, y the still
// pools frozen, z the stream shrunk to its pools, w reduced motion (a calmer flow).
uniform sampler2D u_flow;
uniform vec4 u_land;
uniform vec3 u_snow[3];
out vec4 outColour;
${NOISE}
vec3 seaStep(float i) { return u_sea[int(clamp(i, 0.0, 10.0))]; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 w = vec2(p) + u_cam + 0.5;
  vec2 uv = w / (${ELEVATION_CELL.toFixed(1)} * u_elevSize);
  vec4 E = texture(u_elev, uv);
  float e = E.r * 3.0 - 1.0;
  bool stream = E.g > 0.5;
  float b = float(u_bayer[(p.y & 3) * 4 + (p.x & 3)]) / 16.0;
  if (e > 1.1 && !stream) {
    // Snow lying in patches on the high ground in winter, thickest highest (Book 7 section 13).
    if (u_land.x <= 0.0) discard;
    float lie = vnoise(w / 46.0) * 0.62 + vnoise(w / 15.0) * 0.28 + vnoise(w / 4.0) * 0.1;
    float high = clamp((e - 1.1) / 0.8, 0.0, 1.0);
    float edge = u_land.x * (0.3 + 0.7 * high) - lie;
    if (edge < 0.0) discard;
    vec3 sbed = texelFetch(u_bed, p, 0).rgb * 255.0;
    // Thin at its edge, the ground showing through in a dither; shaded by the ground under it.
    if (edge < 0.05 && b > edge * 18.0) discard;
    float lum = dot(sbed, vec3(0.3, 0.5, 0.2)) / 255.0;
    vec3 sc = lum < 0.25 ? u_snow[0] : lum < 0.4 && b > 0.5 ? u_snow[1] : u_snow[2];
    outColour = vec4(sc / 255.0, 1.0);
    return;
  }
  // A ragged waterline: the height field plus fine noise on whole world pixels.
  e += (vnoise(w / 9.0) - 0.5) * 0.035 + (vnoise(w / 3.0) - 0.5) * 0.014;
  vec3 bed = texelFetch(u_bed, p, 0).rgb * 255.0;
  float level = u_tide + swash(w.x, u_t);
  float depth = level - e;
  if (stream && depth <= 0.0) {
    // Running water over stones (Book 9 section 01): streaks drifting down the stream's own way,
    // fastest at the narrows, foam along the banks, at rocks and below a fall; pools lie still.
    vec4 F = texture(u_flow, uv);
    vec2 dir = F.rg * 2.0 - 1.0;
    float len = length(dir);
    dir = len > 0.05 ? dir / len : vec2(0.0, 1.0);
    float spd = F.b * min(1.0, len * 1.6);
    float code = F.a;
    float tt = u_t * (1.0 - 0.6 * u_land.w);
    vec2 across = vec2(-dir.y, dir.x);
    float al = dot(w, dir);
    float ac = dot(w, across);
    float bank = E.b * 255.0 / 40.0;
    if (code > 0.9) {
      // The falling sheet: white water pouring down the face, ropes of it racing past each other.
      if (u_land.z > 0.5 && abs(fract(w.x / 11.0) - 0.5) > 0.16) {
        // A dry summer: only a thread falls; the rest is wet rock.
        vec3 rock = texelFetch(u_bed, p, 0).rgb * 255.0 * 0.62;
        outColour = vec4(rock / 255.0, 1.0);
        return;
      }
      float rope = vnoise(vec2(w.x / 1.7, 0.5)) * 0.7 + vnoise(vec2(w.x / 5.0, 3.0)) * 0.3;
      float pour = vnoise(vec2(w.x / 1.5 + 7.0, (w.y - tt * 96.0 * (0.8 + 0.4 * rope)) / 9.0));
      vec3 c = pour > 0.62 ? u_foam[2] : pour > 0.4 ? u_foam[1] : rope > 0.55 ? u_foam[0] : seaStep(7.0);
      if (u_land.y > 0.5) {
        // Winter: the sheet hung with ice, a thin core still running in it.
        float icicle = vnoise(vec2(w.x / 2.2, w.y / 30.0));
        c = abs(fract(w.x / 13.0) - 0.5) < 0.12 ? c : icicle > 0.55 ? seaStep(10.0) : icicle > 0.3 ? seaStep(9.0) : seaStep(7.0);
      }
      outColour = vec4(c / 255.0, 1.0);
      return;
    }
    vec3 c = mix(bed * 0.55, seaStep(4.0), 0.62);
    if (u_land.y > 0.5 && spd < 0.3) {
      // Winter: the still pools frozen over, grey-white ice with cracks and a frosted rim.
      float crack = abs(vnoise(w / 7.0) - 0.5);
      c = mix(bed, seaStep(8.0), 0.55);
      if (crack < 0.03) c = seaStep(5.0);
      if (bank < 1.4 + vnoise(w / 3.0) * 0.8) c = u_snow[2];
      if (u_sun > 0.2 && hash2(floor(w / 2.0) + floor(u_t * 2.0) * vec2(5.0, 9.0)) > 0.996) c = u_glint;
      outColour = vec4(c / 255.0, 1.0);
      return;
    }
    if (u_land.z > 0.5 && spd >= 0.3 && code < 0.7) {
      // A dry summer: the running stretches shrink to their pools, leaving damp stones.
      vec3 damp = bed * mix(0.7, 0.86, floor(vnoise(w / 3.0) * 3.0 + b) / 3.0);
      if (u_sun > 0.2 && hash2(floor(w / 2.0) + floor(u_t * 3.0) * vec2(11.0, 3.0)) > 0.995) damp = mix(damp, u_glint, 0.5);
      outColour = vec4(damp / 255.0, 1.0);
      return;
    }
    float v = (6.0 + 34.0 * spd) * (1.0 - 0.5 * u_land.w);
    float flow = vnoise(vec2(ac / 3.0, (al - tt * v) / 7.0));
    float flow2 = vnoise(vec2(ac / 5.0 + 9.0, (al - tt * v * 0.65) / 4.0));
    // A pool turns slowly on itself instead.
    float still = 1.0 - smoothstep(0.15, 0.35, spd);
    flow = mix(flow, vnoise(w / 6.0 + vec2(sin(tt * 0.31), cos(tt * 0.27)) * 1.6), still);
    if (flow > 0.66) c = seaStep(6.0);
    if (flow2 > 0.78 - 0.1 * spd) c = seaStep(7.0);
    float churn = vnoise(vec2(ac / 2.0, (al - tt * (10.0 + 24.0 * spd)) / 3.0));
    // Foam along the banks: broken, thicker where the water runs fast, a thin wet rim on a pool.
    if (bank < (0.5 + churn * 1.3) * (0.35 + spd)) c = churn > 0.55 ? u_foam[1] : u_foam[0];
    // Foam where the plan puts rocks and narrows, racing with the water; spray over a fall's pool.
    float foam = min(code, 0.6) / 0.6;
    if (foam > 0.04) {
      float lace = vnoise(vec2(ac / 2.5, (al - tt * v * 1.2) / 2.5));
      if (lace < foam * 0.75) c = lace < foam * 0.35 ? u_foam[2] : u_foam[1];
      if (foam > 0.55 && hash2(floor(w / 1.5) + floor(tt * 9.0) * vec2(3.0, 17.0)) > 0.72) c = u_foam[2];
    }
    if (code > 0.7) {
      // A fall's lip: the water glassy and bright as it tips over.
      c = fract(w.x / 4.0 + tt * 0.7) < 0.5 ? u_foam[0] : seaStep(9.0);
    }
    if (u_sun > 0.2 && hash2(w + floor(u_t * 4.0) * vec2(13.0, 7.0)) > 0.994) c = u_glint;
    outColour = vec4(c / 255.0, 1.0);
    return;
  }
  if (depth > 0.0) {
    // Colour by the depth of water: pale over the sand in the shallows, darker out to the deep.
    float d = depth + max(0.0, -e) * 0.6;
    // A smooth ramp from pale shallows to the deep, ordered-dithered between palette steps.
    float idxf = 9.0 - 6.2 * pow(clamp(d / 1.2, 0.0, 1.0), 0.6);
    // Broad swells: a lighter crest band and a darker trough, wavy, rolling in to the shore.
    float sw = fract(d * 2.4 + vnoise(w / 34.0) * 0.9 + vnoise(w / 12.0) * 0.2 - u_t * 0.09);
    if (d > 0.15) idxf += sw < 0.22 ? 0.9 : sw > 0.62 && sw < 0.85 ? -0.8 : 0.0;
    float idx = floor(idxf + b * 0.999);
    vec3 c = seaStep(idx);
    float a = depth < 0.02 ? 0.42 : depth < 0.05 ? 0.62 : depth < 0.11 ? 0.82 : 1.0;
    c = mix(bed * 0.6, c, a);
    // Kelp under the surface, its fronds leaning back and forth with the swell.
    float kelpPatch = u_detail >= 2 ? vnoise(w / 22.0 + 17.0) : 0.0;
    if (u_detail >= 2 && d > 0.15 && d < 0.65 && kelpPatch > 0.66) {
      float sway = sin(u_t * 1.1 + w.y * 0.12) * 1.8;
      float frond = vnoise(vec2((w.x + sway) / 2.5, w.y / 7.0) + 31.0);
      if (frond > 0.7) c = mix(c, u_kelp, 0.35);
    }
    // Swells: a few bands parallel to the shore (contours of depth) rolling in, broken into
    // lengths. In the shallows they break white; out in the deep they are lighter streaks.
    if (u_detail >= 1) {
    float n = vnoise(w / 30.0) * 0.8 + vnoise(w / 11.0) * 0.25;
    float phase = fract(d * 3.2 + n - u_t * 0.11);
    float broken = vnoise(vec2(w.x / 16.0, w.y / 7.0) + u_t * 0.1);
    // White crest lines on the swell, and a surf zone of breaking lines in the shallows.
    if (d > 0.04 && phase < 0.045 && broken > 0.42) c = d < 0.25 ? u_foam[1] : seaStep(idx + 2.0);
    else if (d > 0.04 && phase < 0.09 && broken > 0.55) c = d < 0.25 ? u_foam[0] : seaStep(idx + 1.0);
    if (u_detail >= 2) {
    float surf = fract(d * 14.0 + vnoise(w / 10.0) * 0.8 - u_t * 0.35);
    if (d < 0.16 && surf < 0.16 + 0.3 * (1.0 - d / 0.16) && vnoise(w / 3.0 + u_t * 0.3) > 0.4)
      c = surf < 0.07 ? u_foam[2] : u_foam[1];
    // Ripples catching the light on the open water.
    if (d > 0.3 && vnoise(vec2(w.x / 7.0 - u_t * 0.3, w.y / 2.0 + u_t * 0.5)) > 0.8) c = seaStep(idx + 1.0);
    }
    }
    // The shore break: bright foam at the run-up's edge, lace and bubbles behind it.
    float edge = 0.014 + vnoise(w / 4.0 + u_t * 0.4) * 0.016;
    if (depth < edge) c = u_foam[2];
    else if (u_detail >= 1 && depth < edge * 2.4 && vnoise(w / 2.5 + vec2(u_t * 0.5, -u_t * 0.3)) > 0.5) c = u_foam[1];
    else if (u_detail >= 1 && depth < edge * 4.5 && vnoise(w / 2.0 - u_t * 0.2) > 0.66) c = u_foam[0];
    // Glints where the light catches a crest.
    if (u_sun > 0.05 && d > 0.05 && hash2(w + floor(u_t * 3.0) * vec2(17.0, 31.0)) > 0.9975 - 0.002 * u_sun) c = u_glint;
    outColour = vec4(c / 255.0, 1.0);
    return;
  }
  if (e > 1.0) discard;
  // Above the water: the swash's wet film, then sand drying from the last high water.
  float dry = -depth;
  vec3 c = bed;
  if (e < u_tide + ${SWASH.toFixed(3)}) {
    // Where the last wave ran: dark, with a film of sky on it just behind the edge.
    c = bed * 0.62;
    if (dry < 0.016 && vnoise(w / 2.0 + u_t) > 0.38) c = mix(bed, u_glint, 0.35);
  } else if (e < u_tide + ${SWASH.toFixed(3)} + 0.06) {
    // The dark band of sand the waves keep wet.
    c = bed * 0.7;
  } else if (e < u_wetTo + 0.16) {
    // Sand still wet from the tide, drying lighter up the beach in dithered steps.
    float k = smoothstep(u_tide + ${SWASH.toFixed(3)}, u_wetTo + 0.16, e);
    c = bed * mix(0.74, 0.97, floor(k * 4.0 + b) / 4.0);
  } else discard;
  outColour = vec4(c / 255.0, 1.0);
}`;

/** A contact shadow: a soft-edged ellipse, written into the shadow mask (MAX blending). */
export const ELLIPSE_VERTEX = `#version 300 es
in vec2 a_pos;      // logical pixels
in vec2 a_local;    // -1..1 across the ellipse
out vec2 v_local;
void main() {
  v_local = a_local;
  gl_Position = vec4(a_pos.x / ${LOGICAL_WIDTH / 2}.0 - 1.0, a_pos.y / ${LOGICAL_HEIGHT / 2}.0 - 1.0, 0.0, 1.0);
}`;

export const ELLIPSE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_local;
out vec4 outColour;
void main() {
  float d = length(v_local);
  if (d >= 1.0) discard;
  float v = d < 0.62 ? 1.0 : 0.55;
  outColour = vec4(v, v, v, 1.0);
}`;

/** Multiplies the ground by the shadow mask, in a cool shadow colour. */
export const SHADOW_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_mask;
uniform vec3 u_tint;
uniform float u_depth;
out vec4 outColour;
void main() {
  float m = texelFetch(u_mask, ivec2(gl_FragCoord.xy), 0).r;
  outColour = vec4(mix(vec3(1.0), u_tint, m * u_depth), 1.0);
}`;

/**
 * The post pass: ambient light and banded pools exactly as the CPU reference renderer, then (with
 * effects) cloud shadows, light shafts, a gust sheen over open ground, the grade, mist and flashes.
 */
export const POST_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_scene;
uniform sampler2D u_elev;
uniform vec2 u_elevSize;
uniform bool u_effects;
uniform vec3 u_ambient;
uniform int u_poolCount;
uniform vec3 u_poolAt[${MAX_POOLS}];
uniform vec3 u_poolColour[${MAX_POOLS}];
uniform float u_bands;
uniform vec2 u_cam;
uniform float u_t;
uniform vec3 u_wind;     // dir x, dir y, strength
uniform float u_clouds;
uniform float u_shafts;
uniform vec3 u_gain;
uniform vec3 u_lift;
uniform float u_fog;
uniform vec3 u_fogColour;
uniform float u_flash;
uniform vec4 u_patches;   // share either way, patch size (px), drift x, drift y (px)
uniform bool u_hasElev;
uniform float u_dryAbove;
uniform int u_detail;
out vec4 outColour;
${NOISE}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 c = floor(texelFetch(u_scene, p, 0).rgb * 255.0 + 0.5);
  vec3 light = u_ambient;
  for (int i = 0; i < ${MAX_POOLS}; i++) {
    if (i >= u_poolCount) break;
    float d = distance(vec2(p) + 0.5, u_poolAt[i].xy);
    if (d < u_poolAt[i].z) light += u_poolColour[i] * (ceil(u_bands * (1.0 - d / u_poolAt[i].z)) / u_bands);
  }
  light = min(light, vec3(255.0));
  if (!u_effects) {
    outColour = vec4(floor(c * light / 255.0 + 1e-6) / 255.0, 1.0);
    return;
  }
  vec2 w = vec2(p) + u_cam + 0.5;
  vec2 drift = u_wind.xy * u_t * 9.0;
  float cloud = u_detail >= 1
    ? smoothstep(0.52, 0.7, vnoise((w - drift) / 150.0) * 0.7 + vnoise((w - drift * 1.3) / 60.0) * 0.3)
    : 0.0;
  float k = 1.0 - 0.17 * cloud * u_clouds;
  if (u_detail >= 2) {
    float shaft = smoothstep(0.62, 0.86, vnoise(vec2((w.x + w.y * 0.55) / 64.0 + u_t * 0.018, 0.5)));
    k *= 1.0 + 0.08 * shaft * u_shafts * (1.0 - cloud);
  }
  if (u_hasElev && u_detail >= 1) {
    // The terrain under the pixel (nearest sample): a sheen runs over the grass in the gusts,
    // and dry sand drifts along the beach in streamers.
    vec4 E = texelFetch(u_elev, ivec2(w / ${ELEVATION_CELL.toFixed(1)}), 0);
    int layer = int(E.a * 255.0) / 16;
    // Stage 8: the foreshore below the tide line, wet shingle and weed, glistens: stones catch the
    // light in brief glints that come and go (Book 7 section 14: water, light), more in sun.
    if (layer == 2 && u_detail >= 2) {
      float glint = hash2(floor(w / 2.0) + floor(u_t * 4.0 + hash2(floor(w / 2.0)) * 4.0) * vec2(13.0, 7.0));
      if (glint > 0.965) k *= 1.32;
    }
    // Stage 11: the tidal flats left by the ebb hold a film of water: it shimmers as the wind runs
    // over it, and the light catches in it, so the open sand at low water is never still.
    if (layer == 1 && u_detail >= 1) {
      float film = vnoise(vec2((w.x - u_t * 14.0) / 11.0, (w.y + u_t * 5.0) / 5.0));
      if (film > 0.62) k *= 1.12;
      float glint = hash2(floor(w / 2.0) + floor(u_t * 4.0 + hash2(floor(w / 2.0)) * 4.0) * vec2(7.0, 19.0));
      if (u_detail >= 2 && glint > 0.97) k *= 1.3;
    }
    if (layer == 2 && E.r * 3.0 - 1.0 < u_dryAbove) layer = -1;
    float g = gust(w, u_wind.xy, u_t) * u_wind.z;
    if (layer == 6) k *= 1.0 + 0.05 * g;
    if (layer == 4 || layer == 2) {
      float along = dot(w, u_wind.xy);
      float across = dot(w, vec2(-u_wind.y, u_wind.x));
      float streak = vnoise(vec2((along - u_t * 70.0) / 7.0, across / 1.6));
      float wisp = vnoise(vec2((along - u_t * 40.0) / 30.0, across / 9.0));
      if (streak > 0.72 && wisp > 0.42 && g + 0.25 * u_wind.z > 0.3) k *= 1.07;
    }
  }
  if (u_patches.x > 0.0)
    k *= 1.0 + u_patches.x * (vnoise((w - u_patches.zw) / u_patches.y) * 2.0 - 1.0);
  vec3 g = c * u_gain + u_lift;
  if (u_fog > 0.0) g = mix(g, u_fogColour, u_fog * (0.55 + 0.45 * vnoise((w - drift * 0.6) / 90.0)));
  vec3 outc = floor(clamp(g * light * k / 255.0, 0.0, 255.0) + 1e-6);
  outc = mix(outc, vec3(235.0, 240.0, 255.0), u_flash);
  outColour = vec4(outc / 255.0, 1.0);
}`;

/**
 * The low-detail water and post shaders: u_detail fixed at 0, so the compiler drops every branch
 * that needs it. A software renderer compiles these quickly; the full ones are compiled only
 * when full or lite detail is first drawn (AP-16).
 */
export function lowDetail(source: string): string {
  return source.replace(/uniform int u_detail;[^\n]*/, 'const int u_detail = 0;');
}

/** The post pass without effects (the Stage 4 art scenes): light only, no noise at all. */
export const POST_PLAIN_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_scene;
uniform vec3 u_ambient;
uniform int u_poolCount;
uniform vec3 u_poolAt[${MAX_POOLS}];
uniform vec3 u_poolColour[${MAX_POOLS}];
uniform float u_bands;
out vec4 outColour;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 c = floor(texelFetch(u_scene, p, 0).rgb * 255.0 + 0.5);
  vec3 light = u_ambient;
  for (int i = 0; i < ${MAX_POOLS}; i++) {
    if (i >= u_poolCount) break;
    float d = distance(vec2(p) + 0.5, u_poolAt[i].xy);
    if (d < u_poolAt[i].z) light += u_poolColour[i] * (ceil(u_bands * (1.0 - d / u_poolAt[i].z)) / u_bands);
  }
  light = min(light, vec3(255.0));
  outColour = vec4(floor(c * light / 255.0 + 1e-6) / 255.0, 1.0);
}`;

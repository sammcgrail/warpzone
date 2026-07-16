// ─────────────────────────────────────────────────────────────────────────────
//  VHS / found-footage post pass — one full-screen ShaderPass on the composer.
//  Ported from the godotshaders "VHS and CRT monitor effect" (CC0). Chromatic
//  bleed + tape wobble + scanlines + banded noise + vignette + desaturate. The
//  softness IS the aesthetic, so we render at a low pixel ratio and lean in.
// ─────────────────────────────────────────────────────────────────────────────
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const VHSShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 1.0 },   // 0..1, ramps up during a scale-warp
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                 mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
    }

    void main(){
      vec2 uv = vUv;
      float t = uTime;

      // ── tape wobble: per-line horizontal jitter + a slow roll ──
      float line = uv.y * 240.0;
      float wob = (noise(vec2(line*0.5, t*3.0)) - 0.5) * 0.006;
      wob += sin(uv.y*8.0 + t*1.7) * 0.0016;
      // occasional bad-tracking tear near a moving band
      float band = smoothstep(0.02, 0.0, abs(fract(uv.y - t*0.12) - 0.5) - 0.02);
      wob += band * (hash(vec2(line, floor(t*20.0))) - 0.5) * 0.03;
      uv.x += wob;

      // ── chromatic aberration (RGB split), stronger during a warp ──
      float ab = (0.0016 + 0.004*uAberration) + band*0.002;
      float r = texture2D(tDiffuse, uv + vec2(ab, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(ab, 0.0)).b;
      vec3 col = vec3(r, g, b);

      // ── luminance bleed (soft horizontal smear) ──
      vec3 smear = texture2D(tDiffuse, uv + vec2(0.004, 0.0)).rgb;
      col = mix(col, max(col, smear*0.8), 0.35);

      // ── scanlines + RGB grille ──
      col *= 0.86 + 0.14*sin(uv.y * 900.0);
      col.r *= 1.02; col.b *= 1.02;

      // ── tape noise (banded speckle) ──
      float n = noise(vec2(uv.y*180.0, t*12.0));
      float speck = step(0.86, hash(vec2(floor(uv.x*320.0), floor(uv.y*240.0 + t*90.0))));
      col += (n - 0.5) * 0.06 + speck * 0.10 * step(0.5, hash(vec2(uv.y*30.0, floor(t*6.0))));

      // ── desaturate slightly + warm toward the sodium yellow ──
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 0.82);
      col *= vec3(1.03, 1.0, 0.92);

      // ── vignette + soft edge darkening ──
      vec2 d = uv - 0.5;
      col *= 1.0 - dot(d, d) * 0.9;

      // brightness flicker (fluorescent-ish)
      col *= 0.97 + 0.03*sin(t*40.0) + 0.02*noise(vec2(t*8.0, 0.0));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export function makeVHSPass(): ShaderPass {
  return new ShaderPass(VHSShader);
}

import type { PresentationSlide, PresentationTheme } from "./types";

export const FIELD_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const FIELD_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_res;
uniform float u_time;
uniform float u_mood;
uniform float u_accent;
uniform float u_layout;
uniform float u_seed;
uniform float u_density;
uniform float u_composing;
uniform float u_reduced;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.52;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p = p * 2.02 + 13.1;
    amp *= 0.5;
  }
  return sum;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * (0.22 + u_composing * 0.35);
  float seed = u_seed * 0.17;

  vec3 deep = mix(vec3(0.027, 0.047, 0.043), vec3(0.06, 0.035, 0.02), clamp(u_mood, 0.0, 1.0));
  deep = mix(deep, vec3(0.02, 0.055, 0.05), clamp(u_mood - 1.0, 0.0, 1.0));
  vec3 lift = mix(vec3(0.12, 0.2, 0.17), vec3(0.28, 0.16, 0.07), clamp(u_mood, 0.0, 1.0));
  lift = mix(lift, vec3(0.08, 0.28, 0.22), clamp(u_mood - 1.0, 0.0, 1.0));
  vec3 accent = mix(vec3(0.89, 0.79, 0.53), vec3(0.25, 0.56, 0.45), clamp(u_accent, 0.0, 1.0));
  accent = mix(accent, vec3(0.95, 0.93, 0.86), clamp(u_accent - 1.0, 0.0, 1.0));

  float fog = fbm(vec3(p * 1.6 + seed, t * 0.35));
  float filament = fbm(vec3(p * 3.4 + vec2(seed, -seed), t * 0.55 + 4.0));
  float caustic = pow(max(0.0, 1.0 - abs(sin((p.x * 3.2 + p.y * 1.4 + t) * 1.6))), 8.0);

  float room = 0.0;
  if (u_layout < 0.5) {
    float horizon = smoothstep(0.12, 0.0, abs(p.y + 0.12));
    float orb = smoothstep(0.42, 0.18, length(p - vec2(0.42, 0.02)));
    float rim = smoothstep(0.34, 0.28, length(p - vec2(0.42, 0.02))) * smoothstep(0.22, 0.32, length(p - vec2(0.42, 0.02)));
    room = horizon * 0.7 + orb * 0.55 + rim;
  } else if (u_layout < 1.5) {
    float columns = max(0.0, 1.0 - abs(sin(p.x * 6.4 + seed)) * 2.4);
    room = columns * smoothstep(0.42, 0.08, abs(p.y)) * 0.55;
  } else if (u_layout < 2.5) {
    float seam = smoothstep(0.05, 0.0, abs(p.x));
    float left = smoothstep(0.62, 0.18, length(p - vec2(-0.34, 0.0)));
    float right = smoothstep(0.62, 0.18, length(p - vec2(0.34, 0.0)));
    room = seam * 0.85 + left * 0.4 + right * 0.4;
  } else if (u_layout < 3.5) {
    vec2 g = vec2(mod(p.x + 0.66, 0.44) - 0.22, p.y);
    room = smoothstep(0.2, 0.05, length(g)) * 0.7;
  } else if (u_layout < 5.5) {
    float lane = smoothstep(0.18, 0.0, abs(p.y - 0.04));
    float ticks = smoothstep(0.08, 0.0, abs(fract((p.x + 0.7) * 2.1) - 0.5));
    room = lane * 0.45 + ticks * 0.35;
  } else {
    float well = smoothstep(0.7, 0.12, length(p - vec2(0.0, 0.08)));
    room = well * 0.62;
  }

  float vignette = smoothstep(1.15, 0.35, length(p * vec2(0.78, 1.0)));
  float grain = (hash(vec3(uv * u_res.xy, floor(t * 24.0))) - 0.5) * 0.045;
  float editorial = mix(1.0, 0.72, u_density);

  vec3 col = deep;
  col += lift * (0.22 + fog * 0.55) * editorial;
  col += accent * (filament * 0.22 + caustic * 0.18 + room * 0.42);
  col += vec3(0.02, 0.04, 0.035) * (0.3 + u_composing * 0.4);
  col *= vignette;
  col += grain;
  if (u_reduced > 0.5) col = mix(deep, col, 0.55);
  col = aces(col * 1.15);
  fragColor = vec4(col, 1.0);
}
`;

export function moodIndex(mood: PresentationTheme["mood"]) {
  return { obsidian: 0, ember: 1, aurora: 2 }[mood];
}

export function accentIndex(accent: PresentationTheme["accent"]) {
  return { gold: 0, emerald: 1, ivory: 2 }[accent];
}

export function layoutIndex(layout: PresentationSlide["layout"]) {
  return { hero: 0, manifesto: 1, split: 2, stats: 3, timeline: 4, quote: 5, path: 6, next: 7 }[layout];
}

export function densityIndex(density: PresentationTheme["density"]) {
  return density === "editorial" ? 1 : 0;
}

export function seedFromId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 1000;
  }
  return hash / 100;
}

export const DEFAULT_THEME: PresentationTheme = {
  mood: "obsidian",
  accent: "gold",
  density: "editorial"
};

export const ATMOSPHERE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const ATMOSPHERE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_res;
uniform float u_time;
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
  float amp = 0.55;
  for (int i = 0; i < 6; i++) {
    sum += amp * noise(p);
    p = p * 2.03 + 11.7;
    amp *= 0.51;
  }
  return sum;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 uv = v_uv;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * 0.07;

  vec3 obsidian = vec3(0.031, 0.047, 0.043);
  vec3 deep = vec3(0.043, 0.176, 0.133);
  vec3 emerald = vec3(0.141, 0.514, 0.408);
  vec3 gold = vec3(0.780, 0.643, 0.353);
  vec3 pale = vec3(0.886, 0.788, 0.533);

  float fog = fbm(vec3(p * 1.15 + vec2(0.0, t * 0.35), t * 0.22));
  float ribbon = fbm(vec3(p * 2.4 + vec2(-t * 0.2, t * 0.08), 3.2 + t * 0.4));
  float well = smoothstep(0.78, 0.12, length(p - vec2(0.0, 0.04)));
  float halo = smoothstep(0.42, 0.08, length(p - vec2(0.0, 0.02)));
  float caustic = pow(max(0.0, sin((p.x * 2.8 + p.y * 1.6 + ribbon * 2.0 + t) * 1.8)), 10.0);
  float grain = (hash(vec3(uv * u_res.xy, floor(u_time * 18.0))) - 0.5) * 0.035;
  float vignette = smoothstep(1.22, 0.28, length(p * vec2(0.72, 1.02)));

  vec3 col = obsidian;
  col = mix(col, deep, fog * 0.55 + well * 0.28);
  col += emerald * (ribbon * 0.16 + well * 0.22);
  col += gold * (caustic * 0.14 + halo * 0.18);
  col += pale * halo * 0.08;
  col *= vignette;
  col += grain;
  if (u_reduced > 0.5) col = mix(obsidian, col, 0.62);
  fragColor = vec4(aces(col * 1.18), 1.0);
}
`;

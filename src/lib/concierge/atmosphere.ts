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
  for (int i = 0; i < 5; i++) {
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
  float t = u_time * 0.035;

  vec3 obsidian = vec3(0.02, 0.027, 0.024);
  vec3 charcoal = vec3(0.047, 0.067, 0.059);
  vec3 deep = vec3(0.043, 0.176, 0.133);
  vec3 gold = vec3(0.780, 0.643, 0.353);
  vec3 pale = vec3(0.886, 0.788, 0.533);

  float fog = fbm(vec3(p * 0.85 + vec2(0.0, t * 0.18), t * 0.12));
  float well = smoothstep(0.34, 0.04, length(p - vec2(0.0, 0.02)));
  float lamp = smoothstep(0.22, 0.0, length(p - vec2(0.0, -0.08)));
  float floorDisc = exp(-pow((p.y - 0.18) * 6.2, 2.0)) * exp(-pow(p.x * 1.55, 2.0));
  float grain = (hash(vec3(uv * u_res.xy, floor(u_time * 8.0))) - 0.5) * 0.02;
  float vignette = smoothstep(1.18, 0.22, length(p * vec2(0.78, 1.05)));

  float r1 = length(p * vec2(1.0, 1.18) - vec2(0.0, 0.04));
  float ring1 = smoothstep(0.012, 0.0, abs(r1 - 0.42));
  float ring2 = smoothstep(0.01, 0.0, abs(r1 - 0.62));
  float meridian = pow(max(0.0, cos(atan(p.y - 0.02, p.x) * 6.0 + t * 0.4)), 42.0);
  meridian *= smoothstep(0.72, 0.18, r1) * smoothstep(0.08, 0.2, r1);

  vec3 col = obsidian;
  col = mix(col, charcoal, fog * 0.28);
  col += deep * well * 0.16;
  col += gold * lamp * 0.07;
  col += pale * floorDisc * 0.08;
  col += gold * (ring1 * 0.1 + ring2 * 0.06 + meridian * 0.08);
  col *= vignette;
  col += grain;
  if (u_reduced > 0.5) col = mix(obsidian, col, 0.7);
  fragColor = vec4(aces(col * 0.92), 1.0);
}
`;

export const PARTICLE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec4 a_particle;
uniform vec2 u_res;
uniform float u_time;
uniform float u_spin;
uniform float u_wave;
uniform float u_energy;
uniform float u_listen;
uniform float u_think;
uniform float u_speak;
uniform float u_reduced;
out float v_depth;
out float v_gold;
out float v_alpha;

// Spin and wave arrive already integrated (phase += speed * dt on the CPU),
// so voice energy changes the pace of the swirl without ever snapping it.
void main() {
  vec3 p = a_particle.xyz;
  float seed = a_particle.w;
  float energy = u_energy;
  float band = p.y * 2.4 + sin(p.y * 7.4 + u_wave) * (0.22 + energy * 0.06);
  float angle = u_reduced > 0.5 ? p.y * 2.2 : u_spin + band;
  float c = cos(angle);
  float s = sin(angle);
  float lift = u_reduced > 0.5 ? 0.0 : sin(u_time * 1.15 + p.y * 3.1) * (0.012 + energy * 0.012);
  vec3 q = vec3(p.x * c - p.z * s, p.y + lift, p.x * s + p.z * c);
  float breath = u_reduced > 0.5 ? 0.0 : 0.018 * sin(u_time * 0.8);
  float ripple = u_reduced > 0.5 ? 0.0 : sin(q.y * 4.2 - u_wave * 1.4) * energy * 0.016;
  float radius = 0.84 + breath + energy * 0.045 + ripple - u_think * 0.03;
  q *= radius;
  v_depth = clamp(q.z * 0.5 + 0.5, 0.0, 1.0);
  v_gold = clamp(1.0 - abs(q.y) / (0.085 + energy * 0.02), 0.0, 1.0);
  float rim = u_listen * energy * clamp(abs(q.y) * 1.4, 0.0, 1.0);
  v_alpha = 0.12 + v_depth * 0.7 + v_gold * (0.22 + energy * 0.12) + u_speak * energy * 0.1 + rim * 0.16;
  gl_Position = vec4(q.x, q.y, 0.0, 1.0);
  gl_PointSize = max(1.0, (1.1 + v_depth * 2.2 + v_gold * 0.8 + seed * 0.4) * (u_res.y / 520.0));
}
`;

export const PARTICLE_FRAG = `#version 300 es
precision highp float;
in float v_depth;
in float v_gold;
in float v_alpha;
uniform vec3 u_emerald;
uniform vec3 u_goldPale;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = dot(uv, uv);
  if (d > 1.0) discard;
  float soft = exp(-d * 2.8);
  vec3 color = mix(u_emerald * (0.55 + v_depth * 0.7), u_goldPale, v_gold * 0.92);
  color += vec3(0.18, 0.28, 0.16) * v_depth;
  float a = v_alpha * soft;
  fragColor = vec4(color * a, a);
}
`;

export const GLASS_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const GLASS_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_res;
uniform float u_time;
uniform float u_input;
uniform float u_output;
uniform float u_idle;
uniform float u_listen;
uniform float u_think;
uniform float u_speak;
uniform float u_reduced;
uniform vec3 u_deep;
uniform vec3 u_emerald;
uniform vec3 u_gold;
uniform vec3 u_goldPale;
uniform vec3 u_obsidian;

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
    mix(
      mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.52;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p = p * 2.03 + 11.7;
    amp *= 0.5;
  }
  return sum;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

bool hitSphere(vec3 ro, vec3 rd, float r, out float t0, out float t1) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return false;
  h = sqrt(h);
  t0 = -b - h;
  t1 = -b + h;
  return t1 > 0.0;
}

void main() {
  vec2 uv = (v_uv * 2.0 - 1.0);
  uv.x *= u_res.x / max(u_res.y, 1.0);
  uv *= 0.56;

  float breath = u_reduced > 0.5 ? 0.0 : 0.01 * sin(u_time * 0.55);
  float radius = 0.82 + breath + u_output * 0.03 - u_think * 0.03;
  float drift = u_reduced > 0.5 ? 0.4 : u_time * 0.035;
  vec3 ro = vec3(
    sin(drift) * 0.02 + sin(drift * 1.6) * u_output * 0.028,
    0.03 + cos(drift * 0.82) * 0.014 + cos(drift * 1.9) * u_output * 0.02,
    2.48
  );
  vec3 rd = normalize(vec3(uv, -1.6));

  float t0, t1;
  vec3 color = u_obsidian * 0.15;
  float alpha = 0.0;
  float dist = length(uv);

  float floorGlow = exp(-pow((uv.y + 0.92) * 3.4, 2.0)) * exp(-pow(uv.x * 1.7, 2.0));
  color += mix(u_deep, u_emerald, 0.35) * floorGlow * 0.16;
  alpha = max(alpha, floorGlow * 0.22);

  if (hitSphere(ro, rd, radius, t0, t1)) {
    float tHit = max(t0, 0.0);
    vec3 pos = ro + rd * tHit;
    vec3 n = normalize(pos);
    vec3 view = normalize(-rd);
    float ndv = max(dot(n, view), 0.0);
    float fres = pow(1.0 - ndv, 3.15);

    vec3 refrDir = refract(rd, n, 0.92);
    if (dot(refrDir, refrDir) < 0.01) refrDir = reflect(rd, n);

      float chord = max(t1 - tHit, 0.02);
      vec3 volume = vec3(0.0);
    float flow = 0.028 + u_think * 0.08 + u_speak * 0.045 + u_output * 0.05;
    vec3 advect = vec3(
      sin(u_time * 0.11) * (0.03 + u_speak * 0.05),
      u_time * flow,
      u_time * 0.022 + cos(u_time * 0.09) * 0.03
    );
    float warp = 0.03 + u_output * 0.05;

    for (int i = 0; i < 4; i++) {
      float ft = (float(i) + 0.5) / 4.0;
      vec3 samplePos = pos + refrDir * chord * ft;
      samplePos += (fbm(samplePos * 1.8 + advect) - 0.5) * warp;
      float field = fbm(samplePos * 2.35 + advect);
      float ribbon = smoothstep(0.32, 0.72, field);
      float caustic = smoothstep(0.5, 0.84, fbm(samplePos * 3.4 + advect * 1.3));
      vec3 layer = mix(u_obsidian * 1.55, u_deep, 0.38 + ribbon * 0.32);
      layer = mix(layer, u_emerald, ribbon * 0.42);
      layer = mix(layer, u_gold, caustic * (0.34 + u_output * 0.42) * (1.0 - u_listen * 0.15));
      layer += u_goldPale * caustic * (0.1 + u_output * 0.22);
      volume += layer * (0.16 + ft * 0.1);
    }

    float spec = pow(max(dot(reflect(-view, n), normalize(vec3(-0.35, 0.72, 0.55))), 0.0), 28.0);
    float core = pow(max(1.0 - length(pos.xy) * 1.2, 0.0), 2.6) * (0.12 + u_output * 0.4);

    float rip = 0.0;
    if (u_listen > 0.01) {
      float ring = sin(length(pos.xy) * 11.0 - u_time * 1.5);
      rip = smoothstep(0.35, 1.0, fres) * ring * u_input * u_listen;
    }

    vec3 glass = volume;
    glass += u_goldPale * fres * (0.55 + u_listen * 0.42 + rip * 0.28);
    glass += u_gold * fres * 0.18;
    glass += vec3(0.96, 0.9, 0.72) * spec * 0.32;
    glass += mix(u_deep, u_emerald, 0.4) * core;
    glass = mix(glass, glass * 0.7, u_think * 0.4);
    glass *= 0.92;

    float caR = fbm(pos * 2.6 + advect + vec3(0.12, 0.0, 0.0));
    float caB = fbm(pos * 2.6 + advect - vec3(0.12, 0.0, 0.0));
    glass.r += (caR - 0.5) * 0.045;
    glass.b += (caB - 0.5) * 0.04;

    float cover = smoothstep(0.0, 0.02, t1 - t0) * (0.78 + ndv * 0.18);
    color = mix(color, glass, cover);
    alpha = max(alpha, cover * (0.7 + fres * 0.25));
  }

  float bloom = exp(-pow(max(dist - radius * 0.62, 0.0) * 3.3, 2.0));
  vec3 bloomCol = mix(u_deep, u_emerald, 0.55 + u_output * 0.25);
  bloomCol = mix(bloomCol, u_gold, 0.12 + u_output * 0.18);
  color += bloomCol * bloom * (0.18 + u_output * 0.16 + u_listen * u_input * 0.12);
  alpha = max(alpha, bloom * 0.34);

  color = aces(color * 0.98);
  color = pow(color, vec3(1.02));
  fragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`;

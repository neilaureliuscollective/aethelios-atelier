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

float line(float v, float w) {
  return smoothstep(w, 0.0, abs(v));
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 uv = v_uv;
  vec2 p = (uv - vec2(0.5, 0.5)) * vec2(aspect, 1.0);
  float t = u_reduced > 0.5 ? 0.4 : u_time * 0.018;
  p.x += sin(t * 0.31) * 0.01;
  p.y += cos(t * 0.24) * 0.006;

  vec3 obsidian = vec3(0.015, 0.018, 0.016);
  vec3 stone = vec3(0.038, 0.046, 0.042);
  vec3 gold = vec3(0.70, 0.56, 0.28);
  vec3 pale = vec3(0.86, 0.76, 0.50);
  vec3 deep = vec3(0.03, 0.09, 0.07);

  float horizon = 0.05;
  vec3 col = obsidian;

  if (p.y < horizon) {
    float fy = max(horizon - p.y, 0.012);
    float z = 1.0 / fy;
    float x = p.x * z;
    float fog = exp(-z * 0.055);

    col = mix(obsidian, stone, fog * 0.7);
    col += deep * exp(-pow(x * 0.2, 2.0)) * fog * 0.22;

    float jointX = line(fract(x * 0.16 + 0.5) - 0.5, 0.03);
    float jointZ = line(fract(z * 0.075 + t * 0.12) - 0.5, 0.028);
    col += gold * max(jointX, jointZ) * fog * 0.62;

    float aisle = exp(-pow(x * 0.24, 2.0)) * fog;
    col += gold * aisle * 0.06;

    float well = exp(-pow(x * 0.62, 2.0) - pow((z - 3.1) * 0.36, 2.0));
    col = mix(col, obsidian * 1.8, well * 0.62);
    col += deep * well * 0.28;
    col += gold * well * 0.08;

    float rib = line(fract(abs(x) * 0.1) - 0.5, 0.08);
    col = mix(col, obsidian * 0.35, rib * fog * 0.7);
    col += gold * line(fract(abs(x) * 0.1) - 0.5, 0.012) * fog * 0.38;
  } else {
    float uy = max(p.y - horizon, 0.012);
    float z = 1.0 / (uy * 1.12);
    float x = p.x * z;
    float fog = exp(-z * 0.06);

    col = mix(obsidian, stone * 0.8, fog * 0.34);

    float vault = line(fract(x * 0.12 + 0.5) - 0.5, 0.022);
    float coffer = line(fract(z * 0.06) - 0.5, 0.02);
    col += gold * vault * fog * 0.32;
    col += gold * coffer * fog * 0.16;

    float shaft = exp(-pow(p.x * 3.1, 2.0)) * smoothstep(0.18, 0.64, p.y);
    col += pale * shaft * 0.07;
    col += gold * shaft * 0.045;

    float oculus = exp(-pow(p.x * 4.2, 2.0) - pow((p.y - 0.38) * 3.6, 2.0));
    col += pale * oculus * 0.06;
  }

  float wall = smoothstep(0.62, 1.05, abs(p.x) / max(aspect * 0.52, 0.25));
  col = mix(col, obsidian * 0.55, wall * 0.62);
  float slit = pow(max(0.0, cos((p.x / max(aspect, 0.2)) * 11.0)), 64.0);
  col += gold * slit * (1.0 - wall) * 0.035;

  float vignette = smoothstep(1.2, 0.18, length(p * vec2(0.72, 1.05)));
  col *= vignette;
  col += (hash(vec3(uv * u_res.xy, floor(u_time * 6.0))) - 0.5) * 0.018;
  if (u_reduced > 0.5) col = mix(obsidian, col, 0.72);
  fragColor = vec4(aces(col * 0.9), 1.0);
}
`;

export function paintChamber(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  reduced = false
) {
  const t = reduced ? 0.4 : time * 0.018;
  context.fillStyle = "#050706";
  context.fillRect(0, 0, width, height);

  const horizonY = height * 0.47;
  const vanishingX = width * 0.5 + Math.sin(t * 0.31) * width * 0.008;

  const floor = context.createLinearGradient(0, horizonY, 0, height);
  floor.addColorStop(0, "#0a100e");
  floor.addColorStop(1, "#050706");
  context.fillStyle = floor;
  context.fillRect(0, horizonY, width, height - horizonY);

  const vault = context.createLinearGradient(0, 0, 0, horizonY);
  vault.addColorStop(0, "#070a08");
  vault.addColorStop(0.7, "#080c0b");
  vault.addColorStop(1, "#0a100e");
  context.fillStyle = vault;
  context.fillRect(0, 0, width, horizonY);

  context.save();
  context.beginPath();
  context.rect(0, horizonY, width, height - horizonY);
  context.clip();
  context.strokeStyle = "rgba(199, 164, 90, 0.28)";
  context.lineWidth = 1;
  const aisles = 11;
  for (let i = 0; i <= aisles; i += 1) {
    const edge = ((i / aisles) * 2 - 1) * width * 1.35;
    context.beginPath();
    context.moveTo(vanishingX, horizonY);
    context.lineTo(vanishingX + edge, height + 40);
    context.stroke();
  }
  for (let i = 1; i <= 8; i += 1) {
    const y = horizonY + Math.pow(i / 8, 1.65) * (height - horizonY);
    const span = ((y - horizonY) / (height - horizonY)) * width * 1.4;
    context.beginPath();
    context.moveTo(vanishingX - span, y);
    context.lineTo(vanishingX + span, y);
    context.stroke();
  }
  const well = context.createRadialGradient(vanishingX, horizonY + height * 0.08, 8, vanishingX, horizonY + height * 0.1, width * 0.28);
  well.addColorStop(0, "rgba(11, 70, 53, 0.28)");
  well.addColorStop(1, "rgba(5, 7, 6, 0)");
  context.fillStyle = well;
  context.fillRect(0, horizonY, width, height - horizonY);
  context.restore();

  context.save();
  context.beginPath();
  context.rect(0, 0, width, horizonY);
  context.clip();
  context.strokeStyle = "rgba(199, 164, 90, 0.2)";
  context.lineWidth = 1;
  for (let i = 0; i <= 9; i += 1) {
    const edge = ((i / 9) * 2 - 1) * width * 1.1;
    context.beginPath();
    context.moveTo(vanishingX, horizonY);
    context.lineTo(vanishingX + edge, -40);
    context.stroke();
  }
  const shaft = context.createLinearGradient(vanishingX, 0, vanishingX, horizonY);
  shaft.addColorStop(0, "rgba(226, 201, 136, 0.08)");
  shaft.addColorStop(1, "rgba(226, 201, 136, 0)");
  context.fillStyle = shaft;
  context.fillRect(vanishingX - width * 0.08, 0, width * 0.16, horizonY);
  context.restore();

  const sides = context.createLinearGradient(0, 0, width, 0);
  sides.addColorStop(0, "rgba(5, 7, 6, 0.72)");
  sides.addColorStop(0.18, "rgba(5, 7, 6, 0)");
  sides.addColorStop(0.82, "rgba(5, 7, 6, 0)");
  sides.addColorStop(1, "rgba(5, 7, 6, 0.72)");
  context.fillStyle = sides;
  context.fillRect(0, 0, width, height);
}

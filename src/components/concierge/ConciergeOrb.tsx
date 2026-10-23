"use client";

import { useEffect, useRef } from "react";
import styles from "./concierge.module.css";

export type OrbState = "idle" | "listening" | "thinking" | "composing" | "speaking";

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_level;
uniform float u_state;
void main() {
  vec2 uv = (gl_FragCoord.xy / u_res) * 2.0 - 1.0;
  uv.x *= u_res.x / u_res.y;
  float r = length(uv);
  float breathe = 0.03 * sin(u_time * (0.7 + u_state * 0.5));
  float sphere = smoothstep(0.96 + breathe, 0.52, r);
  float rim = smoothstep(0.88, 0.7, r) * smoothstep(1.05, 0.78, r);
  float filament = 0.5 + 0.5 * sin(u_time * 0.8 + r * 9.0 + uv.y * 6.0 + u_level * 4.0);
  vec3 gold = vec3(0.89, 0.79, 0.53);
  vec3 deep = vec3(0.05, 0.12, 0.1);
  vec3 emerald = vec3(0.25, 0.56, 0.45);
  vec3 col = mix(deep, emerald, clamp(0.35 + filament * 0.4 + u_state * 0.08, 0.0, 1.0));
  col = mix(col, gold, rim * (0.55 + u_level * 0.35));
  col += sphere * gold * (0.12 + u_level * 0.2);
  float alpha = smoothstep(1.02, 0.62, r);
  gl_FragColor = vec4(col * sphere, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ConciergeOrb({
  state,
  label,
  onToggle
}: {
  state: OrbState;
  label: string;
  onToggle: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uLevel = gl.getUniformLocation(program, "u_level");
    const uState = gl.getUniformLocation(program, "u_state");
    let frame = 0;
    const stateValue = { idle: 0, listening: 1, thinking: 2, composing: 3, speaking: 1.4 }[state];
    const started = performance.now();
    const draw = (now: number) => {
      const size = Math.ceil(wrap.clientWidth * (window.devicePixelRatio || 1));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
        gl.viewport(0, 0, size, size);
      }
      gl.useProgram(program);
      gl.uniform2f(uRes, size, size);
      gl.uniform1f(uTime, (now - started) / 1000);
      gl.uniform1f(uLevel, 0.18 + Math.sin(now / 420) * 0.08);
      gl.uniform1f(uState, stateValue);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  return (
    <button className={styles.orbButton} type="button" onClick={onToggle} aria-label={label}>
      <div className={styles.orb} data-state={state} ref={wrapRef}>
        <span className={styles.orbRing} aria-hidden="true" />
        <span className={styles.orbFallback} aria-hidden="true" />
        <canvas ref={canvasRef} className={styles.orbCanvas} aria-hidden="true" />
      </div>
    </button>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { ATMOSPHERE_FRAG, ATMOSPHERE_VERT } from "@/lib/concierge/atmosphere";
import styles from "./concierge.module.css";

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
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

export function StageAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedMedia.matches;
    const onMotion = () => {
      reduced = reducedMedia.matches;
    };
    reducedMedia.addEventListener("change", onMotion);
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) return;
    const vert = compile(gl, gl.VERTEX_SHADER, ATMOSPHERE_VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, ATMOSPHERE_FRAG);
    if (!vert || !frag) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    const loc = (name: string) => gl.getUniformLocation(program, name);
    let frame = 0;
    let running = true;
    const draw = (now: number) => {
      if (!running) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(loc("u_res"), width, height);
      gl.uniform1f(loc("u_time"), reduced ? 1.2 : now / 1000);
      gl.uniform1f(loc("u_reduced"), reduced ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) frame = window.requestAnimationFrame(draw);
    };
    if (reduced) draw(0);
    else frame = window.requestAnimationFrame(draw);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      reducedMedia.removeEventListener("change", onMotion);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.atmosphere} aria-hidden="true" />;
}

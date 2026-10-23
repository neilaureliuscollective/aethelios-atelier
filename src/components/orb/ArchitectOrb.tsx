"use client";

import { useEffect, useRef, useState } from "react";
import { GLASS_FRAG, GLASS_VERT } from "@/lib/orb/glassShader";
import {
  clamp01,
  hexToRgb,
  ORB_DEEP,
  ORB_EMERALD,
  ORB_GOLD,
  ORB_GOLD_PALE,
  ORB_OBSIDIAN,
  springStep,
  stateWeights,
  type OrbStateMix,
  type RtaCallState,
  type SpringValue
} from "@/lib/orb/orb";

export type { RtaCallState };

type LevelRef = { current: number };

type ArchitectOrbProps = {
  state: RtaCallState;
  inputRef: LevelRef;
  outputRef: LevelRef;
  compact?: boolean;
  label?: string;
  className?: string;
};

const COLOR_UNIFORMS = {
  u_deep: hexToRgb(ORB_DEEP),
  u_emerald: hexToRgb(ORB_EMERALD),
  u_gold: hexToRgb(ORB_GOLD),
  u_goldPale: hexToRgb(ORB_GOLD_PALE),
  u_obsidian: hexToRgb(ORB_OBSIDIAN)
} as const;

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

function createProgram(gl: WebGL2RenderingContext) {
  const vert = compile(gl, gl.VERTEX_SHADER, GLASS_VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, GLASS_FRAG);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function loc(gl: WebGL2RenderingContext, program: WebGLProgram, name: string) {
  return gl.getUniformLocation(program, name);
}

function springMix(current: Record<keyof OrbStateMix, SpringValue>, target: OrbStateMix, dt: number) {
  (Object.keys(target) as Array<keyof OrbStateMix>).forEach((key) => {
    current[key] = springStep(current[key], target[key], dt);
  });
}

function paintFallback(
  context: CanvasRenderingContext2D,
  size: number,
  state: RtaCallState,
  input: number,
  output: number,
  time: number,
  reduced: boolean
) {
  const cx = size / 2;
  const cy = size / 2;
  const breath = reduced ? 0 : 0.018 * Math.sin(time * 0.85);
  const radius = size * (0.34 + breath + output * 0.03 - (state === "thinking" ? 0.02 : 0));
  context.clearRect(0, 0, size, size);

  const floor = context.createRadialGradient(cx, cy + radius * 0.92, 4, cx, cy + radius * 1.05, radius * 1.2);
  floor.addColorStop(0, "rgba(36, 131, 104, 0.16)");
  floor.addColorStop(1, "rgba(8, 12, 11, 0)");
  context.fillStyle = floor;
  context.fillRect(0, 0, size, size);

  const bloom = context.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.55);
  bloom.addColorStop(0, `rgba(36, 131, 104, ${0.16 + output * 0.16})`);
  bloom.addColorStop(0.55, `rgba(11, 70, 53, ${0.1 + input * 0.08})`);
  bloom.addColorStop(1, "rgba(8, 12, 11, 0)");
  context.fillStyle = bloom;
  context.fillRect(0, 0, size, size);

  const body = context.createRadialGradient(cx - radius * 0.22, cy - radius * 0.28, radius * 0.08, cx, cy, radius);
  body.addColorStop(0, `rgba(226, 201, 136, ${0.28 + output * 0.2})`);
  body.addColorStop(0.28, `rgba(36, 131, 104, ${0.72 + output * 0.12})`);
  body.addColorStop(0.7, "rgba(11, 70, 53, 0.92)");
  body.addColorStop(1, "rgba(8, 12, 11, 0.15)");
  context.fillStyle = body;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();

  const sheen = context.createRadialGradient(cx - radius * 0.28, cy - radius * 0.32, 2, cx, cy, radius * 0.7);
  sheen.addColorStop(0, "rgba(255, 246, 220, 0.42)");
  sheen.addColorStop(0.35, "rgba(199, 164, 90, 0.12)");
  sheen.addColorStop(1, "rgba(199, 164, 90, 0)");
  context.fillStyle = sheen;
  context.beginPath();
  context.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
  context.fill();

  if (state === "listening" && !reduced) {
    context.strokeStyle = `rgba(226, 201, 136, ${0.18 + input * 0.35})`;
    context.lineWidth = 1.4;
    context.beginPath();
    context.arc(cx, cy, radius * (1.02 + input * 0.06), 0, Math.PI * 2);
    context.stroke();
  }
}

export function ArchitectOrb({
  state,
  inputRef,
  outputRef,
  compact = false,
  label = "Aethelios",
  className
}: ArchitectOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const [backend, setBackend] = useState<"gl" | "canvas2d">("gl");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedMedia.matches;
    const onMotion = () => {
      reduced = reducedMedia.matches;
    };
    reducedMedia.addEventListener("change", onMotion);

    const use2d = backend === "canvas2d";
    const gl = use2d
      ? null
      : canvas.getContext("webgl2", {
          alpha: true,
          antialias: false,
          premultipliedAlpha: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: true
        });
    const mix: Record<keyof OrbStateMix, SpringValue> = {
      idle: { value: 1, vel: 0 },
      listen: { value: 0, vel: 0 },
      think: { value: 0, vel: 0 },
      speak: { value: 0, vel: 0 }
    };
    let frame = 0;
    let running = true;
    let visible = true;
    let last = performance.now();

    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    });
    observer.observe(canvas);
    const onVis = () => {
      visible = document.visibilityState !== "hidden";
    };
    document.addEventListener("visibilitychange", onVis);

    const resize = (dprCap: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const size = Math.max(1, canvas.clientWidth);
      const width = Math.floor(size * dpr);
      const height = Math.floor(size * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return { size, width, height };
    };

    if (!gl) {
      if (backend === "gl") {
        reducedMedia.removeEventListener("change", onMotion);
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        setBackend("canvas2d");
        return;
      }
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) {
        reducedMedia.removeEventListener("change", onMotion);
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        return;
      }
      const draw = (now: number) => {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        springMix(mix, stateWeights(stateRef.current), dt);
        const { size } = resize(2);
        context.setTransform(canvas.width / size, 0, 0, canvas.height / size, 0, 0);
        paintFallback(
          context,
          size,
          stateRef.current,
          clamp01(inputRef.current),
          clamp01(outputRef.current),
          now / 1000,
          reduced
        );
        if (!reduced && visible) frame = window.requestAnimationFrame(draw);
      };
      if (reduced) draw(0);
      else frame = window.requestAnimationFrame(draw);
      return () => {
        running = false;
        window.cancelAnimationFrame(frame);
        reducedMedia.removeEventListener("change", onMotion);
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVis);
      };
    }

    const program = createProgram(gl);
    if (!program) {
      reducedMedia.removeEventListener("change", onMotion);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      setBackend("canvas2d");
      return;
    }
    const onLost = (event: Event) => {
      event.preventDefault();
      setBackend("canvas2d");
    };
    canvas.addEventListener("webglcontextlost", onLost);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const uniforms = {
      res: loc(gl, program, "u_res"),
      time: loc(gl, program, "u_time"),
      input: loc(gl, program, "u_input"),
      output: loc(gl, program, "u_output"),
      idle: loc(gl, program, "u_idle"),
      listen: loc(gl, program, "u_listen"),
      think: loc(gl, program, "u_think"),
      speak: loc(gl, program, "u_speak"),
      reduced: loc(gl, program, "u_reduced"),
      deep: loc(gl, program, "u_deep"),
      emerald: loc(gl, program, "u_emerald"),
      gold: loc(gl, program, "u_gold"),
      goldPale: loc(gl, program, "u_goldPale"),
      obsidian: loc(gl, program, "u_obsidian")
    };
    gl.uniform3fv(uniforms.deep, COLOR_UNIFORMS.u_deep);
    gl.uniform3fv(uniforms.emerald, COLOR_UNIFORMS.u_emerald);
    gl.uniform3fv(uniforms.gold, COLOR_UNIFORMS.u_gold);
    gl.uniform3fv(uniforms.goldPale, COLOR_UNIFORMS.u_goldPale);
    gl.uniform3fv(uniforms.obsidian, COLOR_UNIFORMS.u_obsidian);

    const draw = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      springMix(mix, stateWeights(stateRef.current), dt);
      const { width, height } = resize(1.75);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.res, width, height);
      gl.uniform1f(uniforms.time, reduced ? 0.4 : now / 1000);
      gl.uniform1f(uniforms.input, clamp01(inputRef.current));
      gl.uniform1f(uniforms.output, clamp01(outputRef.current));
      gl.uniform1f(uniforms.idle, mix.idle.value);
      gl.uniform1f(uniforms.listen, mix.listen.value);
      gl.uniform1f(uniforms.think, mix.think.value);
      gl.uniform1f(uniforms.speak, mix.speak.value);
      gl.uniform1f(uniforms.reduced, reduced ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced && visible) frame = window.requestAnimationFrame(draw);
    };

    if (reduced) draw(0);
    else frame = window.requestAnimationFrame(draw);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      reducedMedia.removeEventListener("change", onMotion);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [backend, inputRef, outputRef]);

  return (
    <canvas
      key={backend}
      ref={canvasRef}
      className={`rta-orb${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      width={640}
      height={640}
      role="img"
      aria-label={`${label} voice presence, ${state}`}
    />
  );
}

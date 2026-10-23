"use client";

import { useEffect, useRef, useState } from "react";
import {
  createParticleCloud,
  paintParticleOrb,
  PARTICLE_COUNT_2D,
  PARTICLE_COUNT_GL
} from "@/lib/orb/particleField";
import { PARTICLE_FRAG, PARTICLE_VERT } from "@/lib/orb/particleShader";
import {
  clamp01,
  hexToRgb,
  ORB_EMERALD,
  ORB_GOLD_PALE,
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
  const vert = compile(gl, gl.VERTEX_SHADER, PARTICLE_VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAG);
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

function webgl2WithAlpha(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: true
  });
  if (!gl || !gl.getContextAttributes()?.alpha) return null;
  return gl;
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
  const paintedRef = useRef(false);
  const [backend, setBackend] = useState<"gl" | "canvas2d">("gl");
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    paintedRef.current = false;
    setPainted(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedMedia.matches;
    const onMotion = () => {
      reduced = reducedMedia.matches;
    };
    reducedMedia.addEventListener("change", onMotion);

    const use2d = backend === "canvas2d";
    const gl = use2d ? null : webgl2WithAlpha(canvas);
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
      const cloud = createParticleCloud(compact ? 1400 : PARTICLE_COUNT_2D);
      const draw = (now: number) => {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        springMix(mix, stateWeights(stateRef.current), dt);
        const { size } = resize(2);
        context.setTransform(canvas.width / size, 0, 0, canvas.height / size, 0, 0);
        paintParticleOrb(
          context,
          cloud,
          size,
          stateRef.current,
          clamp01(inputRef.current),
          clamp01(outputRef.current),
          now / 1000,
          reduced
        );
        if (!paintedRef.current) {
          paintedRef.current = true;
          setPainted(true);
        }
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
    const cloud = createParticleCloud(compact ? 7000 : PARTICLE_COUNT_GL);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, cloud, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const uniforms = {
      res: loc(gl, program, "u_res"),
      time: loc(gl, program, "u_time"),
      input: loc(gl, program, "u_input"),
      output: loc(gl, program, "u_output"),
      listen: loc(gl, program, "u_listen"),
      think: loc(gl, program, "u_think"),
      speak: loc(gl, program, "u_speak"),
      reduced: loc(gl, program, "u_reduced"),
      emerald: loc(gl, program, "u_emerald"),
      goldPale: loc(gl, program, "u_goldPale")
    };
    gl.uniform3fv(uniforms.emerald, hexToRgb(ORB_EMERALD));
    gl.uniform3fv(uniforms.goldPale, hexToRgb(ORB_GOLD_PALE));

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
      gl.uniform1f(uniforms.listen, mix.listen.value);
      gl.uniform1f(uniforms.think, mix.think.value);
      gl.uniform1f(uniforms.speak, mix.speak.value);
      gl.uniform1f(uniforms.reduced, reduced ? 1 : 0);
      gl.drawArrays(gl.POINTS, 0, cloud.length / 4);
      if (!paintedRef.current) {
        paintedRef.current = true;
        setPainted(true);
      }
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
  }, [backend, compact, inputRef, outputRef]);

  return (
    <canvas
      key={backend}
      ref={canvasRef}
      className={`rta-orb${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      width={640}
      height={640}
      data-ready={painted ? "true" : "false"}
      style={{ opacity: painted ? 1 : 0 }}
      role="img"
      aria-label={`${label} voice presence, ${state}`}
    />
  );
}

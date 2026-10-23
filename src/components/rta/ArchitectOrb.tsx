"use client";

import { useEffect, useRef } from "react";
import {
  buildOrbParticles,
  ORB_DEEP,
  ORB_EMERALD,
  ORB_GOLD,
  ORB_GOLD_PALE,
  type OrbParticle
} from "@/lib/rta/orb";

export type RtaCallState = "idle" | "listening" | "thinking" | "speaking" | "ended";

type ArchitectOrbProps = {
  state: RtaCallState;
  levelRef: { current: number };
  compact?: boolean;
  label?: string;
};

function hex(color: string, alpha: number) {
  const value = color.replace("#", "");
  const n = Number.parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function project(particle: OrbParticle, angleY: number, angleX: number, radius: number) {
  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);
  const x1 = particle.x * cosY - particle.z * sinY;
  const z1 = particle.x * sinY + particle.z * cosY;
  const y2 = particle.y * cosX - z1 * sinX;
  const z2 = particle.y * sinX + z1 * cosX;
  return { x: x1 * radius, y: y2 * radius, z: z2, kind: particle.kind, shade: particle.shade };
}

export function ArchitectOrb({
  state,
  levelRef,
  compact = false,
  label = "Aethelios"
}: ArchitectOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<OrbParticle[] | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    particlesRef.current ??= buildOrbParticles();
    const particles = particlesRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let running = true;

    const draw = (time: number) => {
      if (!running) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth;
      if (canvas.width !== Math.floor(size * dpr) || canvas.height !== Math.floor(size * dpr)) {
        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, size, size);

      const level = Math.max(0, Math.min(1, levelRef.current));
      const mode = stateRef.current;
      const speaking = mode === "speaking";
      const listening = mode === "listening";
      const thinking = mode === "thinking";
      const breath = reduced ? 0 : 0.034 * Math.sin(time / 980);
      const energy = reduced ? 0.08 : breath + level * (speaking ? 0.16 : listening ? 0.11 : 0.05);
      const radius = size * (0.34 + energy);
      const spin = reduced ? 0.55 : time / 1000;
      const angleY = spin * (speaking ? 0.55 : listening ? 0.38 : thinking ? 0.16 : 0.22);
      const angleX = -0.32 + Math.sin(spin * 0.35) * 0.08;
      const cx = size / 2;
      const cy = size / 2;

      const glow = context.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius * 1.55);
      glow.addColorStop(0, hex(ORB_EMERALD, 0.1 + level * 0.18));
      glow.addColorStop(0.42, hex(ORB_DEEP, 0.08 + level * 0.08));
      glow.addColorStop(1, "rgba(8, 12, 11, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);

      const points = particles.map((particle) => {
        const jitter = speaking && !reduced ? 1 + level * 0.08 * (particle.shade - 0.5) : 1;
        return project(
          { ...particle, x: particle.x * jitter, y: particle.y * jitter, z: particle.z * jitter },
          angleY,
          angleX,
          radius
        );
      });
      points.sort((a, b) => a.z - b.z);

      context.save();
      context.translate(cx, cy);
      context.rotate(angleY * 0.35 - 0.32);
      context.strokeStyle = hex(ORB_GOLD, 0.28 + level * 0.22);
      context.lineWidth = 1.15;
      context.beginPath();
      context.ellipse(0, 0, radius * 1.16, radius * 0.3, 0, 0, Math.PI * 2);
      context.stroke();
      context.rotate(0.72);
      context.strokeStyle = hex(ORB_GOLD_PALE, 0.18 + level * 0.16);
      context.lineWidth = 0.8;
      context.beginPath();
      context.ellipse(0, 0, radius * 1.04, radius * 0.22, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();

      context.save();
      context.globalCompositeOperation = "lighter";
      for (const point of points) {
        const depth = (point.z / radius + 1) / 2;
        if (depth < 0.12) continue;
        const gold = point.kind === "gold";
        const alpha = (gold ? 0.4 : 0.16) + depth * (gold ? 0.7 : 0.46) + level * 0.14;
        const dot = (gold ? 1.55 : 0.82) + depth * 1.3 + (speaking ? level * 0.7 : 0);
        context.fillStyle = gold
          ? hex(point.shade > 0.45 ? ORB_GOLD_PALE : ORB_GOLD, alpha)
          : hex(point.shade > 0.7 ? ORB_EMERALD : ORB_DEEP, alpha);
        context.beginPath();
        context.arc(cx + point.x, cy + point.y, dot, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      if (reduced) return;
      frame = window.requestAnimationFrame(draw);
    };

    if (reduced) {
      draw(0);
      return () => {
        running = false;
      };
    }
    frame = window.requestAnimationFrame(draw);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };
  }, [levelRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`rta-orb${compact ? " is-compact" : ""}`}
      width={640}
      height={640}
      role="img"
      aria-label={`${label} voice presence, ${state}`}
    />
  );
}

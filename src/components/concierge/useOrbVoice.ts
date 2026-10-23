"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rmsFromTimeDomain, SPEECH_RMS } from "@/lib/concierge/voiceListen";

export type SpokenPhase = "idle" | "starting" | "listening" | "speaking";

function extractSpokenText(payload: { type?: string; transcript?: string; delta?: string; text?: string }) {
  const type = payload.type ?? "";
  if (type.includes("transcription.completed") || type.includes("audio_transcript.done")) {
    return payload.transcript ?? payload.text ?? "";
  }
  if (type.includes("audio_transcript.delta") || type.includes("transcript.delta")) {
    return payload.delta ?? "";
  }
  return payload.transcript ?? payload.delta ?? "";
}

export function useOrbVoice(options?: { onHeard?: (text: string) => void }) {
  const [phase, setPhase] = useState<SpokenPhase>("idle");
  const [error, setError] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);
  const [hearing, setHearing] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef(0);
  const generationRef = useRef(0);
  const startingRef = useRef(false);
  const levelRef = useRef(0);
  const onHeardRef = useRef(options?.onHeard);
  onHeardRef.current = options?.onHeard;

  const cleanup = useCallback(() => {
    generationRef.current += 1;
    startingRef.current = false;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (contextRef.current) {
      void contextRef.current.close().catch(() => undefined);
      contextRef.current = null;
    }
    localRef.current?.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });
    localRef.current = null;
    remoteRef.current = null;
    if (channelRef.current) {
      channelRef.current.onmessage = null;
      channelRef.current.close();
    }
    channelRef.current = null;
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.close();
    }
    peerRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    levelRef.current = 0;
    setHearing(false);
    setPhase("idle");
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/concierge/voice")
      .then((response) => response.json())
      .then((data: { ready?: boolean }) => {
        if (!cancelled) setReady(Boolean(data.ready));
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const watchLevels = useCallback((local: MediaStream, remote: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    contextRef.current = context;
    void context.resume().catch(() => undefined);
    const localAnalyser = context.createAnalyser();
    const remoteAnalyser = context.createAnalyser();
    localAnalyser.fftSize = 512;
    remoteAnalyser.fftSize = 512;
    context.createMediaStreamSource(local).connect(localAnalyser);
    try {
      context.createMediaStreamSource(remote).connect(remoteAnalyser);
    } catch {
      // Remote tracks may arrive after the first frame.
    }
    const localSamples = new Uint8Array(localAnalyser.fftSize);
    const remoteSamples = new Uint8Array(remoteAnalyser.fftSize);
    const tick = () => {
      localAnalyser.getByteTimeDomainData(localSamples);
      remoteAnalyser.getByteTimeDomainData(remoteSamples);
      const localRms = rmsFromTimeDomain(localSamples);
      const remoteRms = rmsFromTimeDomain(remoteSamples);
      levelRef.current = Math.max(localRms, remoteRms);
      const loudIn = localRms >= SPEECH_RMS;
      setHearing((current) => (current === loudIn ? current : loudIn));
      setPhase((current) => {
        if (current === "idle" || current === "starting") return current;
        return remoteRms >= SPEECH_RMS ? "speaking" : "listening";
      });
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || phase !== "idle") return;
    startingRef.current = true;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setError("");
    setPhase("starting");
    if (audioRef.current) {
      void audioRef.current.play().catch(() => undefined);
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        throw new Error("This browser cannot hold a live spoken conversation. Type instead.");
      }
      const stream = await navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
      if (generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localRef.current = stream;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const remote = new MediaStream();
      remoteRef.current = remote;
      if (audioRef.current) {
        audioRef.current.srcObject = remote;
        void audioRef.current.play().catch(() => undefined);
      }
      peer.ontrack = (event) => {
        if (generationRef.current !== generation) return;
        event.streams[0]?.getTracks().forEach((track) => remote.addTrack(track));
        if (event.track) remote.addTrack(event.track);
      };
      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onmessage = (event) => {
        if (generationRef.current !== generation) return;
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            transcript?: string;
            delta?: string;
            text?: string;
          };
          const next = extractSpokenText(payload);
          if (next && (payload.type ?? "").includes("input_audio_transcription")) {
            onHeardRef.current?.(next);
          }
        } catch {
          /* non-JSON control frames are ignored */
        }
      };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      if (generationRef.current !== generation) {
        cleanup();
        return;
      }
      await peer.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (peer.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const onState = () => {
          if (peer.iceGatheringState === "complete") {
            peer.removeEventListener("icegatheringstatechange", onState);
            resolve();
          }
        };
        peer.addEventListener("icegatheringstatechange", onState);
      });
      if (generationRef.current !== generation) {
        cleanup();
        return;
      }
      const result = await fetch("/api/concierge/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: peer.localDescription?.sdp })
      });
      const data = (await result.json().catch(() => ({}))) as { sdp?: string; message?: string };
      if (!result.ok || !data.sdp) {
        throw new Error(data.message ?? "The orb could not open a spoken conversation.");
      }
      if (generationRef.current !== generation) {
        cleanup();
        return;
      }
      await peer.setRemoteDescription({ type: "answer", sdp: data.sdp });
      watchLevels(stream, remote);
      setPhase("listening");
    } catch (err) {
      if (generationRef.current === generation) {
        cleanup();
        setError(err instanceof Error ? err.message : "The orb could not speak. Type instead.");
      }
    } finally {
      if (generationRef.current === generation) startingRef.current = false;
    }
  }, [cleanup, phase, watchLevels]);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return { phase, error, ready, hearing, levelRef, audioRef, start, stop };
}

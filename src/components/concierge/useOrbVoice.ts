"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { envelopeToward } from "@/lib/orb/orb";
import { rmsFromTimeDomain, speechGain, SPEECH_RMS } from "@/lib/concierge/voiceListen";

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

function unlockSpokenAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.muted = false;
  audio.volume = 1;
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  void audio.play().catch(() => undefined);
}

function waitForIce(peer: RTCPeerConnection, timeoutMs = 2500) {
  return new Promise<void>((resolve) => {
    if (peer.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const finish = () => {
      peer.removeEventListener("icegatheringstatechange", onState);
      window.clearTimeout(timer);
      resolve();
    };
    const onState = () => {
      if (peer.iceGatheringState === "complete") finish();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    peer.addEventListener("icegatheringstatechange", onState);
  });
}

function askOrbToSpeak(channel: RTCDataChannel) {
  const greet = () => {
    if (channel.readyState !== "open") return;
    channel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions:
            "Speak first. Greet them in one short spoken sentence and invite them to tell you about their business."
        }
      })
    );
  };
  if (channel.readyState === "open") greet();
  else channel.addEventListener("open", greet, { once: true });
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
  const inputLevelRef = useRef(0);
  const outputLevelRef = useRef(0);
  const lastLevelAt = useRef(0);
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
    inputLevelRef.current = 0;
    outputLevelRef.current = 0;
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
    lastLevelAt.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastLevelAt.current) / 1000);
      lastLevelAt.current = now;
      localAnalyser.getByteTimeDomainData(localSamples);
      remoteAnalyser.getByteTimeDomainData(remoteSamples);
      const localRms = rmsFromTimeDomain(localSamples);
      const remoteRms = rmsFromTimeDomain(remoteSamples);
      inputLevelRef.current = envelopeToward(inputLevelRef.current, speechGain(localRms), dt, 0.06, 0.2);
      outputLevelRef.current = envelopeToward(outputLevelRef.current, speechGain(remoteRms), dt, 0.05, 0.22);
      levelRef.current = Math.max(inputLevelRef.current, outputLevelRef.current);
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
    unlockSpokenAudio(audioRef.current);
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
        unlockSpokenAudio(audioRef.current);
      }
      peer.ontrack = (event) => {
        if (generationRef.current !== generation) return;
        const incoming = event.streams[0];
        if (incoming) {
          remoteRef.current = incoming;
          if (audioRef.current) {
            audioRef.current.srcObject = incoming;
            unlockSpokenAudio(audioRef.current);
          }
          return;
        }
        if (event.track && !remote.getTracks().includes(event.track)) {
          remote.addTrack(event.track);
          if (audioRef.current) {
            audioRef.current.srcObject = remote;
            unlockSpokenAudio(audioRef.current);
          }
        }
      };
      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      askOrbToSpeak(channel);
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
      await waitForIce(peer);
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
      unlockSpokenAudio(audioRef.current);
      watchLevels(stream, remoteRef.current ?? remote);
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

  return { phase, error, ready, hearing, levelRef, inputLevelRef, outputLevelRef, audioRef, start, stop };
}

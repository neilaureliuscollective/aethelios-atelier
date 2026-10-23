"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rmsFromTimeDomain, shouldFinishRecording, SPEECH_RMS } from "@/lib/concierge/voiceListen";

export type VoicePhase = "idle" | "starting" | "recording" | "transcribing";

export { appendTranscript } from "@/lib/concierge/voiceText";

function pickRecorderType() {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

export function useOrbTranscription(options?: { onTranscript?: (text: string) => void }) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [error, setError] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);
  const [hearing, setHearing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const phaseRef = useRef<VoicePhase>("idle");
  const levelRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const listenFrameRef = useRef(0);
  const finishingRef = useRef(false);
  const onTranscriptRef = useRef(options?.onTranscript);
  onTranscriptRef.current = options?.onTranscript;

  const setVoicePhase = useCallback((next: VoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const stopMonitor = useCallback(() => {
    window.cancelAnimationFrame(listenFrameRef.current);
    listenFrameRef.current = 0;
    if (audioRef.current) {
      void audioRef.current.close().catch(() => undefined);
      audioRef.current = null;
    }
    levelRef.current = 0;
    setHearing(false);
  }, []);

  const stopTracks = useCallback(() => {
    stopMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, [stopMonitor]);

  useEffect(() => () => stopTracks(), [stopTracks]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/concierge/transcribe")
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

  const cancel = useCallback(() => {
    finishingRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    stopTracks();
    finishingRef.current = false;
    setVoicePhase("idle");
  }, [setVoicePhase, stopTracks]);

  const finish = useCallback(
    async (origin: "manual" | "auto"): Promise<string> => {
      const recorder = recorderRef.current;
      if (!recorder || phaseRef.current !== "recording" || finishingRef.current) return "";
      finishingRef.current = true;
      setVoicePhase("transcribing");
      stopMonitor();
      const type = recorder.mimeType || "audio/webm";
      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunksRef.current, { type }));
        if (recorder.state === "recording" && typeof recorder.requestData === "function") {
          recorder.requestData();
        }
        if (recorder.state !== "inactive") recorder.stop();
        else resolve(new Blob(chunksRef.current, { type }));
      });
      stopTracks();
      try {
        const body = new FormData();
        body.append("audio", blob, `speech.${type.includes("mp4") ? "mp4" : "webm"}`);
        const result = await fetch("/api/concierge/transcribe", { method: "POST", body });
        const data = (await result.json().catch(() => ({}))) as { text?: string; message?: string };
        if (!result.ok) {
          throw new Error(data.message ?? "That speech could not be transcribed.");
        }
        const text = data.text?.trim() ?? "";
        if (!text) throw new Error("Nothing could be heard. Speak again, or type.");
        setVoicePhase("idle");
        finishingRef.current = false;
        if (origin === "auto") onTranscriptRef.current?.(text);
        return text;
      } catch (err) {
        setVoicePhase("idle");
        finishingRef.current = false;
        setError(err instanceof Error ? err.message : "That speech could not be transcribed.");
        return "";
      }
    },
    [setVoicePhase, stopMonitor, stopTracks]
  );

  const start = useCallback(async () => {
    const phaseNow = () => phaseRef.current;
    if (phaseNow() !== "idle") return;
    setError("");
    finishingRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record speech. Type instead.");
      return;
    }
    setVoicePhase("starting");
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
      if (phaseNow() !== "starting") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const type = pickRecorderType();
      const recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("This browser could not keep the recording. Type instead.");
        cancel();
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setVoicePhase("recording");
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const context = new AudioCtx();
        audioRef.current = context;
        await context.resume().catch(() => undefined);
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const startedAt = performance.now();
        let lastLoudAt = startedAt;
        let heardSpeech = false;
        const tick = (now: number) => {
          if (phaseRef.current !== "recording") return;
          analyser.getByteTimeDomainData(samples);
          const rms = rmsFromTimeDomain(samples);
          levelRef.current = rms;
          const loud = rms >= SPEECH_RMS;
          setHearing((current) => (current === loud ? current : loud));
          if (loud) {
            heardSpeech = true;
            lastLoudAt = now;
          }
          if (
            shouldFinishRecording({
              heardSpeech,
              lastLoudAt,
              startedAt,
              now
            })
          ) {
            void finish("auto");
            return;
          }
          listenFrameRef.current = window.requestAnimationFrame(tick);
        };
        listenFrameRef.current = window.requestAnimationFrame(tick);
      }
    } catch {
      stopTracks();
      setVoicePhase("idle");
      setError("The microphone was blocked. Allow it for this site, or type.");
    }
  }, [cancel, finish, setVoicePhase, stopTracks]);

  const stop = useCallback(() => finish("manual"), [finish]);

  return { phase, error, ready, hearing, levelRef, start, stop, cancel };
}

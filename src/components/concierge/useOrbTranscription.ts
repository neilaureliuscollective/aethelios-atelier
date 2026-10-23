"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoicePhase = "idle" | "starting" | "recording" | "transcribing";

export { appendTranscript } from "@/lib/concierge/voiceText";

function pickRecorderType() {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

export function useOrbTranscription() {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [error, setError] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const phaseRef = useRef<VoicePhase>("idle");

  const setVoicePhase = useCallback((next: VoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

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
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    stopTracks();
    setVoicePhase("idle");
  }, [setVoicePhase, stopTracks]);

  const start = useCallback(async () => {
    const phaseNow = () => phaseRef.current;
    if (phaseNow() !== "idle") return;
    setError("");
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
      recorder.start(250);
      recorderRef.current = recorder;
      setVoicePhase("recording");
    } catch {
      stopTracks();
      setVoicePhase("idle");
      setError("The microphone was blocked. Allow it for this site, or type.");
    }
  }, [setVoicePhase, stopTracks]);

  const stop = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder || phaseRef.current !== "recording") return "";
    setVoicePhase("transcribing");
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
      if (!text) throw new Error("Nothing could be heard. Tap the orb and speak again, or type.");
      setVoicePhase("idle");
      return text;
    } catch (err) {
      setVoicePhase("idle");
      setError(err instanceof Error ? err.message : "That speech could not be transcribed.");
      return "";
    }
  }, [setVoicePhase, stopTracks]);

  return { phase, error, ready, start, stop, cancel };
}

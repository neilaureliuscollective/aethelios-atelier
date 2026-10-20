"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { useSession } from "@/components/shell/SessionShell";

type VoiceInfo = {
  ready: boolean;
  commissioned?: boolean;
  reason?: string;
  prerequisite?: string;
  limitation?: string;
};

export function VoiceControl({ businessId }: { businessId?: string }) {
  const { user } = useSession();
  const [info, setInfo] = useState<VoiceInfo | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [workspaceBound, setWorkspaceBound] = useState<boolean | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const generationRef = useRef(0);
  const startingRef = useRef(false);
  const ownerRef = useRef(user?.id ?? null);
  const usageEventIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<string | null>(null);

  useEffect(() => {
    void api<{ voice: VoiceInfo }>("/api/companion/voice")
      .then((data) => setInfo(data.voice))
      .catch(() =>
        setInfo({
          ready: false,
          reason: "Voice status could not be loaded.",
          prerequisite: "Voice status endpoint"
        })
      );
  }, []);

  useEffect(() => {
    if (ownerRef.current && ownerRef.current !== (user?.id ?? null)) {
      cleanup();
    }
    ownerRef.current = user?.id ?? null;
    const onNav = () => cleanup();
    window.addEventListener("atelier:client-navigate", onNav);
    return () => {
      window.removeEventListener("atelier:client-navigate", onNav);
      cleanup();
    };
    // cleanup reads refs and must run on owner change and unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function endServerSession() {
    const usageEventId = usageEventIdRef.current;
    const startedAt = startedAtRef.current;
    usageEventIdRef.current = null;
    startedAtRef.current = null;
    if (!usageEventId || !businessId) return;
    void api("/api/companion/voice", {
      method: "PATCH",
      body: JSON.stringify({
        businessId,
        usageEventId,
        action: "end",
        startedAt: startedAt ?? new Date().toISOString()
      })
    }).catch(() => undefined);
  }

  function cleanup() {
    generationRef.current += 1;
    startingRef.current = false;
    endServerSession();
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });
    streamRef.current = null;
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
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setActive(false);
    setStarting(false);
    setMuted(false);
  }

  async function start() {
    if (startingRef.current || active) return;
    if (!info?.ready || !info.commissioned) {
      setError(info?.limitation ?? info?.prerequisite ?? info?.reason ?? "Voice is gated.");
      return;
    }
    startingRef.current = true;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const ownerId = user?.id ?? null;
    setStarting(true);
    setError("");
    setTranscript("");
    setWorkspaceBound(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generationRef.current !== generation || ownerRef.current !== ownerId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const peer = new RTCPeerConnection();
      if (generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        peer.close();
        return;
      }
      peerRef.current = peer;
      const remote = new MediaStream();
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
          const payload = JSON.parse(String(event.data)) as { type?: string; transcript?: string; delta?: string };
          const next = payload.transcript ?? payload.delta ?? "";
          if (next) setTranscript((current) => `${current}${next}`.slice(-1200));
        } catch {
          setTranscript((current) => `${current}${String(event.data)}`.slice(-1200));
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
      if (generationRef.current !== generation || ownerRef.current !== ownerId) {
        cleanup();
        return;
      }
      const result = await api<{
        sdp: string;
        workspaceBound?: boolean;
        usageEventId?: string;
      }>("/api/companion/voice", {
        method: "POST",
        body: JSON.stringify({ businessId, sdp: peer.localDescription?.sdp })
      });
      if (generationRef.current !== generation || ownerRef.current !== ownerId) {
        if (result.usageEventId) {
          usageEventIdRef.current = result.usageEventId;
          startedAtRef.current = new Date().toISOString();
        }
        cleanup();
        return;
      }
      usageEventIdRef.current = result.usageEventId ?? null;
      startedAtRef.current = new Date().toISOString();
      await peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
      setWorkspaceBound(result.workspaceBound === true);
      setActive(true);
    } catch (err) {
      if (generationRef.current === generation) {
        cleanup();
        setError(actionErrorMessage(err, "Voice could not start. Text Talk remains available."));
      }
    } finally {
      if (generationRef.current === generation) {
        startingRef.current = false;
        setStarting(false);
      }
    }
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }

  return (
    <div>
      <audio ref={audioRef} autoPlay playsInline />
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn btn-ghost btn-compact"
          type="button"
          disabled={!info?.ready || !info.commissioned || active || starting}
          onClick={() => void start()}
        >
          {starting ? "Starting…" : "Start voice"}
        </button>
        <button className="btn btn-ghost btn-compact" type="button" disabled={!active} onClick={toggleMute}>
          {muted ? "Unmute" : "Mute"}
        </button>
        <button className="btn btn-ghost btn-compact" type="button" disabled={!active && !starting} onClick={cleanup}>
          End voice
        </button>
      </div>
      <p className="tiny" style={{ marginTop: 8 }}>
        {info?.limitation ??
          (info?.ready
            ? active
              ? workspaceBound
                ? "Microphone is live with this workspace’s confirmed facts. End stops tracks, remote audio, and the data channel."
                : "Microphone is live, but the server did not confirm workspace-bound session configuration. Prefer text Talk if the context sounds generic."
              : "Browser voice uses the authorized OpenAI WebRTC path and the same workspace boundary as text."
            : info?.prerequisite ?? info?.reason ?? "Checking voice…")}
      </p>
      {transcript ? <p className="tiny">Transcript: {transcript}</p> : null}
      {error ? <p className="notice notice-warn">{error}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { useSession } from "@/components/shell/SessionShell";

type VoiceInfo = { ready: boolean; reason?: string; prerequisite?: string };

export function VoiceControl({ businessId }: { businessId?: string }) {
  const { user } = useSession();
  const [info, setInfo] = useState<VoiceInfo | null>(null);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [workspaceBound, setWorkspaceBound] = useState<boolean | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    void api<{ voice: VoiceInfo }>("/api/companion/voice")
      .then((data) => setInfo(data.voice))
      .catch(() => setInfo({ ready: false, reason: "Voice status could not be loaded.", prerequisite: "Voice status endpoint" }));
  }, []);

  useEffect(() => {
    const stop = () => cleanup();
    const onNav = () => stop();
    window.addEventListener("atelier:client-navigate", onNav);
    return () => {
      window.removeEventListener("atelier:client-navigate", onNav);
      stop();
    };
  }, [user?.id]);

  function cleanup() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setActive(false);
    setMuted(false);
  }

  async function start() {
    setError("");
    setTranscript("");
    setWorkspaceBound(null);
    if (!info?.ready) {
      setError(info?.prerequisite ?? info?.reason ?? "Voice is disabled.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const remote = new MediaStream();
      if (audioRef.current) {
        audioRef.current.srcObject = remote;
        void audioRef.current.play().catch(() => undefined);
      }
      peer.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => remote.addTrack(track));
        if (event.track) remote.addTrack(event.track);
      };
      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onmessage = (event) => {
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
      const result = await api<{ sdp: string; workspaceBound?: boolean }>("/api/companion/voice", {
        method: "POST",
        body: JSON.stringify({ businessId, sdp: peer.localDescription?.sdp })
      });
      await peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
      setWorkspaceBound(result.workspaceBound === true);
      setActive(true);
    } catch (err) {
      cleanup();
      setError(actionErrorMessage(err, "Voice could not start. Text Talk remains available."));
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
        <button className="btn btn-ghost btn-compact" type="button" disabled={!info?.ready || active} onClick={() => void start()}>
          Start voice
        </button>
        <button className="btn btn-ghost btn-compact" type="button" disabled={!active} onClick={toggleMute}>
          {muted ? "Unmute" : "Mute"}
        </button>
        <button className="btn btn-ghost btn-compact" type="button" disabled={!active} onClick={cleanup}>
          End voice
        </button>
      </div>
      <p className="tiny" style={{ marginTop: 8 }}>
        {info?.ready
          ? active
            ? workspaceBound
              ? "Microphone is live with this workspace’s confirmed facts. End stops tracks, remote audio, and the data channel."
              : "Microphone is live, but the server did not confirm workspace-bound session configuration. Prefer text Talk if the context sounds generic."
            : "Browser voice uses the authorized OpenAI WebRTC path and the same workspace boundary as text."
          : info?.prerequisite ?? info?.reason ?? "Checking voice…"}
      </p>
      {transcript ? <p className="tiny">Transcript: {transcript}</p> : null}
      {error ? <p className="notice notice-warn">{error}</p> : null}
    </div>
  );
}

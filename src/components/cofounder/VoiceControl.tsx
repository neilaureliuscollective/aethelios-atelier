"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { useSession } from "@/components/shell/SessionShell";

type VoiceInfo = { ready: boolean; reason?: string };

export function VoiceControl({ businessId }: { businessId?: string }) {
  const { user } = useSession();
  const [info, setInfo] = useState<VoiceInfo | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    void api<{ voice: VoiceInfo }>("/api/companion/voice")
      .then((data) => setInfo(data.voice))
      .catch(() => setInfo({ ready: false, reason: "Voice status could not be loaded." }));
  }, []);

  useEffect(() => {
    const stop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      peerRef.current?.close();
      peerRef.current = null;
      setActive(false);
    };
    const onNav = () => stop();
    window.addEventListener("atelier:client-navigate", onNav);
    return () => {
      window.removeEventListener("atelier:client-navigate", onNav);
      stop();
    };
  }, [user?.id]);

  async function start() {
    setError("");
    if (!info?.ready) {
      setError(info?.reason ?? "Voice is disabled.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
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
      const result = await api<{ sdp: string }>("/api/companion/voice", {
        method: "POST",
        body: JSON.stringify({ businessId, sdp: peer.localDescription?.sdp })
      });
      await peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
      setActive(true);
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setError(actionErrorMessage(err, "Voice could not start. Text Talk remains available."));
      setActive(false);
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    setActive(false);
  }

  return (
    <div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-compact" type="button" disabled={!info?.ready || active} onClick={() => void start()}>
          Start voice
        </button>
        <button className="btn btn-ghost btn-compact" type="button" disabled={!active} onClick={stop}>
          Stop voice
        </button>
      </div>
      <p className="tiny" style={{ marginTop: 8 }}>
        {info?.ready
          ? active
            ? "Microphone is live. Stop ends tracks and the WebRTC connection."
            : "Browser voice uses the authorized OpenAI WebRTC path and the same workspace boundary."
          : info?.reason ?? "Checking voice…"}
      </p>
      {error ? <p className="notice notice-warn">{error}</p> : null}
    </div>
  );
}

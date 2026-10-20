"use client";

import { useEffect, useRef } from "react";
import { briefDifferences, wordingMatchesMessage } from "@/lib/client/briefDiff";
import type { Brief } from "@/lib/types";

export function DraftCompare({
  title,
  explanation,
  local,
  server,
  onKeepLocal,
  onTakeServer,
  keepLabel = "Keep this device copy",
  takeLabel = "Use the saved copy"
}: {
  title: string;
  explanation: string;
  local: Brief;
  server: Brief;
  onKeepLocal: () => void;
  onTakeServer: () => void;
  keepLabel?: string;
  takeLabel?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const differences = briefDifferences(local, server);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="recovery-panel surface-dimensional" role="region" aria-labelledby="recovery-title">
      <p className="kicker">Review before continuing</p>
      <h2 id="recovery-title" className="recovery-title" tabIndex={-1} ref={headingRef}>
        {title}
      </h2>
      <p className="lede">{explanation}</p>
      <div className="row recovery-actions">
        <button className="btn btn-gold" type="button" onClick={onKeepLocal}>
          {keepLabel}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onTakeServer}>
          {takeLabel}
        </button>
      </div>
      {differences.length === 0 ? (
        <p className="muted">{wordingMatchesMessage(differences)}</p>
      ) : (
        <div className="recovery-grid">
          {differences.map((item) => (
            <article className="recovery-field surface-dense" key={item.key}>
              <p className="tiny">{item.label}</p>
              <div className="recovery-pair">
                <div>
                  <p className="tiny">On this device</p>
                  <p>{item.local}</p>
                </div>
                <div>
                  <p className="tiny">Saved copy</p>
                  <p>{item.server}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import { CONCIERGE_OPEN_EVENT } from "@/lib/concierge/types";

export function ConciergeOpenButton({
  className = "btn btn-ghost",
  children = "Talk with Aethelios",
  starter
}: {
  className?: string;
  children?: ReactNode;
  starter?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent(CONCIERGE_OPEN_EVENT, {
            detail: starter ? { starter } : {}
          })
        );
      }}
    >
      {children}
    </button>
  );
}

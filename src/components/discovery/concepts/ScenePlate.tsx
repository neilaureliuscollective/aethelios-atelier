"use client";

import { useState } from "react";

export function ScenePlate({
  src,
  fallbackSrc,
  alt,
  width,
  height,
  className
}: {
  src: string;
  fallbackSrc: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const href = failed ? fallbackSrc : src;
  return (
    <img
      className={className}
      src={href}
      alt={failed ? `${alt} (local fallback)` : alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!failed && fallbackSrc && fallbackSrc !== src) setFailed(true);
      }}
    />
  );
}

import { AppLink } from "@/components/ui/AppLink";
import { FULL_LOGO, FULL_LOGO_ASPECT, MARK_ASPECT } from "@/lib/brand/fullLogo";

type Props = {
  size?: number;
  variant?: "icon" | "mark" | "lockup" | "wordmark";
  withWordmark?: boolean;
  href?: string | null;
  priority?: boolean;
  lockupSrc?: string;
};

export function BrandMark({
  size = 72,
  variant = "lockup",
  withWordmark = false,
  href = "/",
  priority = false,
  lockupSrc
}: Props) {
  const usingMark = variant === "mark";
  const usingIcon = variant === "icon";
  const src = usingIcon
    ? "/brand/icon.webp"
    : usingMark
      ? FULL_LOGO.markSrc
      : (lockupSrc ?? FULL_LOGO.lockupSrc);
  const aspect = usingIcon ? 1 : usingMark ? MARK_ASPECT : FULL_LOGO_ASPECT;
  const height = Math.max(28, size);
  const width = Math.round(height * aspect);
  const inner = (
    <>
      <img
        className={usingIcon ? "brand-mark" : "brand-lockup"}
        src={src}
        alt={withWordmark ? "" : "Aethelios Atelier"}
        width={width}
        height={height}
        style={{
          width: usingIcon ? height : "auto",
          height,
          maxWidth: usingIcon ? height : `min(${Math.max(width, 72)}px, 42vw)`,
          background: "transparent"
        }}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "low"}
      />
      {withWordmark ? (
        <span className="brand-copy">
          <strong>AETHELIOS ATELIER</strong>
          <span>Founder-led digital infrastructure</span>
        </span>
      ) : null}
    </>
  );
  if (!href) return <span className="brand">{inner}</span>;
  return (
    <AppLink className="brand" href={href}>
      {inner}
    </AppLink>
  );
}

import { AppLink } from "@/components/ui/AppLink";

type Props = {
  size?: number;
  variant?: "icon" | "wordmark";
  withWordmark?: boolean;
  href?: string | null;
  priority?: boolean;
  lockupSrc?: string;
};

export function BrandMark({
  size = 40,
  variant = "icon",
  withWordmark = true,
  href = "/",
  priority = false,
  lockupSrc
}: Props) {
  const usingLockup = Boolean(lockupSrc);
  const src = lockupSrc ?? (variant === "wordmark" ? "/brand/logo.webp" : "/brand/icon.webp");
  const lockup = usingLockup || variant === "wordmark";
  const lockupHeight = Math.max(48, size);
  const lockupWidth = Math.round(lockupHeight * (1192 / 1160));
  const inner = (
    <>
      <img
        className={lockup ? "brand-lockup" : "brand-mark"}
        src={src}
        alt={withWordmark ? "" : "Aethelios Atelier"}
        width={usingLockup ? lockupWidth : lockup ? Math.round(size * 1.5) : size}
        height={usingLockup ? lockupHeight : size}
        style={
          usingLockup
            ? { width: "auto", height: lockupHeight, maxWidth: "min(220px, 42vw)", background: "transparent" }
            : undefined
        }
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

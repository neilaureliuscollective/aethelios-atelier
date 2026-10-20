import { AppLink } from "@/components/ui/AppLink";
import { FULL_LOGO } from "@/lib/brand/fullLogo";

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
  const usingCrest = Boolean(lockupSrc) || variant === "wordmark";
  const src = lockupSrc ?? (usingCrest ? FULL_LOGO.src : "/brand/icon.webp");
  const crestSize = Math.max(36, size);
  const inner = (
    <>
      <img
        className={usingCrest ? "brand-lockup" : "brand-mark"}
        src={src}
        alt={withWordmark ? "" : "Aethelios Atelier"}
        width={crestSize}
        height={crestSize}
        style={
          usingCrest
            ? { width: crestSize, height: crestSize, maxWidth: crestSize, background: "transparent" }
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

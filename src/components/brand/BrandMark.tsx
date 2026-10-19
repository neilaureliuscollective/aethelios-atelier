import { AppLink } from "@/components/ui/AppLink";

type Props = {
  size?: number;
  variant?: "icon" | "wordmark";
  withWordmark?: boolean;
  href?: string | null;
  priority?: boolean;
};

export function BrandMark({
  size = 40,
  variant = "icon",
  withWordmark = true,
  href = "/",
  priority = false
}: Props) {
  const src = variant === "wordmark" ? "/brand/logo.webp" : "/brand/icon.webp";
  const inner = (
    <>
      <img
        src={src}
        alt={withWordmark ? "" : "Aethelios Atelier"}
        width={size}
        height={size}
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

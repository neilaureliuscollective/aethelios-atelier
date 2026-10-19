import { AppLink } from "@/components/ui/AppLink";

type Props = {
  size?: number;
  withWordmark?: boolean;
  href?: string;
};

export function BrandMark({ size = 46, withWordmark = true, href = "/" }: Props) {
  const inner = (
    <>
      <img
        src="/brand/logo.webp"
        alt=""
        width={size}
        height={size}
        decoding="async"
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

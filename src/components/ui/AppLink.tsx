import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

export function AppLink({
  href,
  className,
  children,
  onClick,
  "aria-current": ariaCurrent
}: {
  href: Route | string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  "aria-current"?: "page" | undefined;
}) {
  return (
    <Link
      href={href as Route}
      className={className}
      onClick={onClick}
      aria-current={ariaCurrent}
      aria-label={href === "/" ? "Aethelios Atelier home" : undefined}
    >
      {children}
    </Link>
  );
}

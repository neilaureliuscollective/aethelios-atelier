"use client";

import { useEffect, useRef, type ElementType, type HTMLAttributes, type ReactNode } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: ElementType;
  delay?: 0 | 1 | 2 | 3;
  variant?: "section" | "material";
};

export function Reveal({
  children,
  className = "",
  as: Tag = "div",
  delay = 0,
  variant = "section",
  ...rest
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      node.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const classes = [
    variant === "material" ? "material-reveal" : "reveal",
    delay ? `reveal-delay-${delay}` : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag ref={ref} className={classes} {...rest}>
      {children}
    </Tag>
  );
}

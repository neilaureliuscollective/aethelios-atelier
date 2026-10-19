import type { DirectionId, VisualDirectionId } from "@/lib/discovery";
import { sceneAssets } from "@/lib/design-spec";

export function platesFor(visual: VisualDirectionId, directionId: DirectionId = "lumen") {
  const assets = sceneAssets(directionId, visual);
  const primary = assets[0] ?? {
    href: "/discovery/materials/arch.svg",
    fallbackHref: "/discovery/materials/arch.svg",
    alt: "Visual study",
    width: 1600,
    height: 1000
  };
  const secondary = assets[1] ?? primary;
  return {
    primary: primary.href,
    secondary: secondary.href,
    fallback: primary.fallbackHref,
    alt: primary.alt,
    width: primary.width,
    height: primary.height
  };
}

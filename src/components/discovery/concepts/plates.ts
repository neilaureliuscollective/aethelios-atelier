import type { VisualDirectionId } from "@/lib/discovery";

export function platesFor(visual: VisualDirectionId): { primary: string; secondary: string; alt: string } {
  switch (visual) {
    case "glass":
      return {
        primary: "/discovery/materials/arch.svg",
        secondary: "/discovery/materials/orb.svg",
        alt: "Architectural glass study"
      };
    case "material":
      return {
        primary: "/discovery/materials/linen.svg",
        secondary: "/discovery/materials/marble.svg",
        alt: "Tactile material study"
      };
    default:
      return {
        primary: "/discovery/materials/grid.svg",
        secondary: "/discovery/materials/filament.svg",
        alt: "Graphic mark study"
      };
  }
}

import { describe, expect, it } from "vitest";
import { atelierSurfaceForPath } from "@/lib/atelierSurface";

describe("atelierSurfaceForPath", () => {
  it("scopes the owner workspace without recoloring public or discovery routes", () => {
    expect(atelierSurfaceForPath("/companion")).toBe("atelier");
    expect(atelierSurfaceForPath("/companion/studio")).toBe("atelier");
    expect(atelierSurfaceForPath("/")).toBe("luminous");
    expect(atelierSurfaceForPath("/services")).toBe("luminous");
    expect(atelierSurfaceForPath("/discover")).toBe("studio");
    expect(atelierSurfaceForPath("/account")).toBe("workroom");
  });
});

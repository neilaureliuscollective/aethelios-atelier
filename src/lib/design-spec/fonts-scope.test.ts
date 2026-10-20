import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("font variable scope", () => {
  it("installs next/font variables on html so :root aliases can resolve them", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("variable: \"--font-display-loaded\"");
    expect(layout).toContain("variable: \"--font-body-loaded\"");
    expect(layout).toMatch(/<html lang="en" className=\{`\$\{display\.variable\} \$\{body\.variable\}`\}>/);
    expect(layout).not.toMatch(/<body className=\{`\$\{display\.variable\} \$\{body\.variable\}`\}>/);
  });

  it("does not load a fifth marketing font family on Discovery", () => {
    const discover = fs.readFileSync(path.join(process.cwd(), "src/app/discover/page.tsx"), "utf8");
    expect(discover).not.toContain("Fraunces");
    expect(discover).toContain("Outfit");
    expect(discover).toContain("Syne");
    const layout = fs.readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/export const dynamic = "force-dynamic"/);
  });

  it("keeps designed fallback stacks on :root", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain("--font-body: var(--font-body-loaded");
    expect(css).toContain("Figtree");
    expect(css).toContain("sans-serif");
    expect(css).toContain("html { color-scheme: dark; font-family: var(--font-body); }");
  });
});

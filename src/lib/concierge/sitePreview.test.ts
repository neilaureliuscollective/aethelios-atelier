import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extractSiteHtml, labeledSitePreview } from "./sitePreview";

describe("site preview extraction", () => {
  it("pulls a complete HTML document out of a fenced model reply", () => {
    const html = extractSiteHtml(`Here you go:\n\`\`\`html\n<!doctype html><html><head></head><body><h1>Northridge</h1></body></html>\n\`\`\``);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("</html>");
    expect(
      labeledSitePreview({
        title: "Northridge",
        html: html ?? "",
        model: "gpt-6-astra"
      })?.labeled
    ).toBe("illustrative_sketch");
  });

  it("keeps talk on Sol and site sketches on Astra", () => {
    const config = readFileSync("src/lib/config.ts", "utf8");
    const env = readFileSync(".env.example", "utf8");
    expect(config).toContain('default("gpt-6.1-sol")');
    expect(config).toContain('default("gpt-6-astra")');
    expect(env).toContain("OPENAI_MODEL=gpt-6.1-sol");
    expect(env).toContain("OPENAI_CODE_MODEL=gpt-6-astra");
    expect(config).not.toContain("gpt-4o-mini");
  });
});

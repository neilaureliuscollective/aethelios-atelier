import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BEGIN_HREF, RETIRED_API_PREFIXES, RETIRED_ROUTES, isRetiredPath } from "./publicSite";

describe("public launch surface", () => {
  it("retires accounts, workspaces, and the older brief tools", () => {
    for (const path of ["/project", "/project/new", "/discover", "/account/adopt", "/companion/studio", "/workspace/x", "/founder", "/api/projects", "/api/auth/signin"]) {
      expect(isRetiredPath(path), path).toBe(true);
    }
    for (const path of ["/", "/services", "/pricing", "/inquire", "/privacy", "/terms", "/projects-showcase", "/api/concierge/talk", "/api/concierge/handoff", "/api/inquiries", "/api/session"]) {
      expect(isRetiredPath(path), path).toBe(false);
    }
  });

  it("keeps the middleware matcher in step with the retired lists", () => {
    const middleware = readFileSync("src/middleware.ts", "utf8");
    for (const prefix of [...RETIRED_ROUTES.map((route) => route.prefix), ...RETIRED_API_PREFIXES]) {
      expect(middleware).toContain(`"${prefix}/:path*"`);
    }
  });

  it("sends visitors to Aethelios and offers no sign-in", () => {
    const header = readFileSync("src/components/shell/SiteHeader.tsx", "utf8");
    const footer = readFileSync("src/components/shell/SiteFooter.tsx", "utf8");
    const stage = readFileSync("src/components/concierge/ConciergeStage.tsx", "utf8");
    expect(BEGIN_HREF).toBe("/#aethelios");
    expect(stage).toContain('id="aethelios"');
    for (const source of [header, footer]) {
      expect(source).not.toMatch(/Sign in|\/account|\/companion|\/workspace|\/founder|"\/project|"\/discover/);
      expect(source).toContain("BEGIN_HREF");
    }
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
  });
});

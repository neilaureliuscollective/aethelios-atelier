import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextRovingIndex } from "@/lib/a11y/rovingTab";
import { fieldDecisionLabel } from "@/lib/copy";
import { serviceBriefHref } from "@/lib/serviceCategories";

const CUSTOMER_FILES = [
  "src/app/page.tsx",
  "src/app/about/page.tsx",
  "src/app/approach/page.tsx",
  "src/app/error.tsx",
  "src/app/services/page.tsx",
  "src/app/services/barbers-salons/page.tsx",
  "src/lib/offers/barbersSalons.ts",
  "src/components/project/OfferImport.tsx",
  "src/lib/catalog.ts",
  "src/lib/serviceCategories.ts",
  "src/lib/pricing/presentation.ts",
  "src/components/pricing/PricingExperience.tsx",
  "src/components/account/AccountClient.tsx",
  "src/components/account/ContinueClient.tsx",
  "src/components/account/InstallGuidance.tsx",
  "src/lib/account/installCopy.ts",
  "src/app/install/page.tsx",
  "src/components/founder/FounderClient.tsx",
  "src/components/marketing/PossibilitiesStage.tsx",
  "src/components/marketing/HeroComposition.tsx",
  "src/components/project/GuidedBrief.tsx",
  "src/components/project/PlanInterest.tsx",
  "src/components/project/DiscoveryImport.tsx",
  "src/components/shell/SiteHeader.tsx",
  "src/components/workspace/WorkspaceClient.tsx"
];

const BANNED = [
  /Pricing is not published here/i,
  /Clear limits without invented contract language/i,
  /disabled or future boundaries/i,
  /no fabricated social proof/i,
  /Bring the work into the existing journey/i,
  /Linking an existing booking provider is only asked/i,
  /simulated founder identity/i,
  /local store/i,
  /Sign in with Google or an email link/i,
  /Nothing was marked saved, submitted, generated, or sent/i
];

describe("launch copy acceptance", () => {
  it("keeps customer-facing surfaces free of audit language and unpublished-price claims", () => {
    for (const file of CUSTOMER_FILES) {
      const source = readFileSync(file, "utf8");
      for (const banned of BANNED) {
        expect(source, `${file} still contains ${banned}`).not.toMatch(banned);
      }
    }
  });

  it("keeps service CTAs on the promised brief destinations", () => {
    const possibilities = readFileSync("src/components/marketing/PossibilitiesStage.tsx", "utf8");
    const hero = readFileSync("src/components/marketing/HeroComposition.tsx", "utf8");
    const showcase = readFileSync("src/components/marketing/ServiceShowcase.tsx", "utf8");
    const services = readFileSync("src/app/services/page.tsx", "utf8");
    expect(possibilities).toContain("nextRovingIndex");
    expect(possibilities).toContain("serviceBriefHref(active)");
    expect(hero).toContain('serviceBriefHref("custom_apps_platforms")');
    expect(hero).toContain('serviceBriefHref("digital_infrastructure")');
    expect(showcase).toContain("serviceBriefHref");
    expect(services).toContain("serviceBriefHref");
    expect(services).toContain("/services/barbers-salons");
    const barbers = readFileSync("src/app/services/barbers-salons/page.tsx", "utf8");
    expect(barbers).toContain('href={BARBERS_SALONS_BRIEF_HREF}');
    expect(barbers).toContain("Start my website brief");
    expect(barbers).not.toMatch(/\$79|20 minutes|two launch revision/i);
    expect(serviceBriefHref("custom_apps_platforms")).toContain("purpose=business");
    expect(serviceBriefHref("digital_infrastructure")).toContain("purpose=business");
  });

  it("restores mobile access to Commissions and labels Business Studio separately", () => {
    const header = readFileSync("src/components/shell/SiteHeader.tsx", "utf8");
    expect(header).toContain("Commissions");
    expect(header).toContain("Business Studio");
    expect(header).toMatch(/!companion && user[\s\S]*href="\/workspace"[\s\S]*Commissions/);
  });

  it("labels field decisions in human language", () => {
    expect(fieldDecisionLabel("append")).toBe("Add to existing notes");
    expect(fieldDecisionLabel("replace")).toBe("Replace existing notes");
    expect(fieldDecisionLabel("skip")).toBe("Leave unchanged");
    const plan = readFileSync("src/components/project/PlanInterest.tsx", "utf8");
    const discovery = readFileSync("src/components/project/DiscoveryImport.tsx", "utf8");
    expect(plan).toContain("fieldDecisionLabel");
    expect(discovery).toContain("fieldDecisionLabel");
  });

  it("moves possibility tabs with arrow keys, Home, and End", () => {
    expect(nextRovingIndex(0, "ArrowRight", 4)).toBe(1);
    expect(nextRovingIndex(0, "ArrowLeft", 4)).toBe(3);
    expect(nextRovingIndex(2, "Home", 4)).toBe(0);
    expect(nextRovingIndex(1, "End", 4)).toBe(3);
    expect(nextRovingIndex(1, "Enter", 4)).toBeNull();
  });

  it("does not wrap the project-type group in a label", () => {
    const brief = readFileSync("src/components/project/GuidedBrief.tsx", "utf8");
    expect(brief).toContain('id="project-type-label"');
    expect(brief).toContain('role="group"');
    expect(brief).not.toMatch(/<label>[\s\S]*project-type-label[\s\S]*role="group"/);
  });
});

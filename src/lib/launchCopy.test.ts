import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextRovingIndex } from "@/lib/a11y/rovingTab";
import { fieldDecisionLabel } from "@/lib/copy";
import { BEGIN_HREF } from "@/lib/publicSite";
import { serviceBriefHref } from "@/lib/serviceCategories";

const CUSTOMER_FILES = [
  "src/app/page.tsx",
  "src/components/marketing/AtelierManifesto.tsx",
  "src/components/concierge/ConciergeStage.tsx",
  "src/lib/concierge/compose.ts",
  "src/lib/aethelios/persona.ts",
  "src/app/about/page.tsx",
  "src/app/approach/page.tsx",
  "src/app/error.tsx",
  "src/app/services/page.tsx",
  "src/app/services/barbers-salons/page.tsx",
  "src/app/services/commerce/page.tsx",
  "src/lib/offers/commerce.ts",
  "src/lib/offers/barbersSalons.ts",
  "src/components/project/OfferImport.tsx",
  "src/lib/catalog.ts",
  "src/lib/serviceCategories.ts",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/components/pricing/PricingExperience.tsx",
  "src/components/account/AccountClient.tsx",
  "src/components/founder/FounderClient.tsx",
  "src/components/marketing/PossibilitiesStage.tsx",
  "src/components/marketing/HeroComposition.tsx",
  "src/components/project/GuidedBrief.tsx",
  "src/components/project/InquiryForm.tsx",
  "src/app/inquire/page.tsx",
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
    expect(services).toContain("/services/commerce");
    const barbers = readFileSync("src/app/services/barbers-salons/page.tsx", "utf8");
    expect(barbers).toContain('href={BARBERS_SALONS_BRIEF_HREF}');
    expect(barbers).toContain("Start my website brief");
    expect(barbers).not.toMatch(/\$79|20 minutes|two launch revision/i);
    const commerce = readFileSync("src/app/services/commerce/page.tsx", "utf8");
    expect(commerce).toContain("COMMERCE_LAUNCH_BRIEF_HREF");
    expect(commerce).toContain("COMMERCE_FOUNDATION_BRIEF_HREF");
    expect(commerce).toContain("Start a Commerce Launch brief");
    expect(commerce).not.toMatch(/\$8,000|\$12,000|winning products/i);
    expect(serviceBriefHref("custom_apps_platforms")).toMatch(new RegExp(`${BEGIN_HREF.split("#")[1]}$`));
    expect(serviceBriefHref("digital_infrastructure")).toContain("interest=digital_infrastructure");
  });

  it("keeps the header to public pages, with no workspace or account entries", () => {
    const header = readFileSync("src/components/shell/SiteHeader.tsx", "utf8");
    expect(header).not.toContain("Commissions");
    expect(header).not.toContain("Business Studio");
    expect(header).toContain('label: "Investment"');
  });

  it("publishes no subscription prices on the investment page", () => {
    const investment = readFileSync("src/components/pricing/PricingExperience.tsx", "utf8");
    const page = readFileSync("src/app/pricing/page.tsx", "utf8");
    for (const source of [investment, page]) {
      expect(source).not.toMatch(/\$\d|\/month|per month|subscription plan/i);
    }
    expect(investment).toContain("Priced to the work.");
    expect(investment).toContain("BEGIN_HREF");
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

  it("lets a guest send an inquiry without signing in", () => {
    const brief = readFileSync("src/components/project/GuidedBrief.tsx", "utf8");
    const inquire = readFileSync("src/app/inquire/page.tsx", "utf8");
    const header = readFileSync("src/components/shell/SiteHeader.tsx", "utf8");
    expect(brief).toContain("InquiryForm");
    expect(brief).not.toContain("Sign in to send");
    expect(inquire).toContain("No account is required");
    expect(header).toContain('href: "/inquire"');
  });

  it("does not wrap the project-type group in a label", () => {
    const brief = readFileSync("src/components/project/GuidedBrief.tsx", "utf8");
    expect(brief).toContain('id="project-type-label"');
    expect(brief).toContain('role="group"');
    expect(brief).not.toMatch(/<label>[\s\S]*project-type-label[\s\S]*role="group"/);
  });
});

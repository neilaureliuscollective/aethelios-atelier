# Research notes — Aethelios public concierge

Findings that shaped the visitor-facing concierge. Evidence is distinguished from studio-specific judgment. Consumer-ecommerce tactics were not copied onto this founder-led services studio.

## Sources reviewed

- Nielsen Norman Group, “The 5 Qualities of Site-Specific AI Chatbots” (Kenderova & Kohler, 10 July 2026): https://www.nngroup.com/articles/dimensions-of-ai-chatbots/
- Nielsen Norman Group, “10 Guidelines for Designing Your Site’s AI Chatbots” (Kenderova, Rosala & Kohler, 24 April 2026): https://www.nngroup.com/articles/ai-chatbots-design-guidelines/
- Nielsen Norman Group, “The User Experience of Chatbots” (2016 overview of conversational UX limits): https://www.nngroup.com/articles/chatbots/
- Visa, “Earning Consumer Trust in the Age of Agentic Commerce” (2025 survey, US/AU/NZ): https://corporate.visa.com/en/products/intelligent-commerce/earning-trust-report.html
- BMC Psychology, “Interactivity, Humanness, and Trust in E-Commerce AI Chatbots” (2024): https://link.springer.com/article/10.1186/s40359-024-02083-z
- Acta Psychologica / PubMed, “Is AI Chatbot Recommendation Convincing Customers?” (2024): https://pubmed.ncbi.nlm.nih.gov/39357416/

The two academic papers and the Visa report are **consumer or e-commerce** studies. They inform trust and disclosure, not luxury language or checkout funnels.

## Conversational UX (NN/g)

| Finding | Evidence quality | Implementation |
| --- | --- | --- |
| Disclose AI identity in the interface, not only a policy page | NN/g qualitative studies + upcoming EU AI disclosure rules (cited by NN/g) | Persistent “AI / digital concierge” labeling; welcome copy states Aethelios is not Neil |
| Do not gatekeep a human handoff | Strong, repeated user quotes | Inquiry / founder request is always available; no fake calendar |
| Stay page-aware and persist across pages | Users assume a site bot can see the current page if told so | Starters and welcome change with route; conversation is stored on-device |
| Suggested prompts as buttons, then one useful question | Reduces formulation cost; repeated unused prompts feel pushy | Contextual chips at open; at most one follow-up question |
| Solve the asked question before promoting | Directional proactivity after resolution | Immediate answers for about/pricing/proof; next steps after |
| Acknowledge the situation, do not fake feelings | Emotional mimicry reads as performative | Voice rules forbid “I understand how you feel” |
| Do not autoscroll past the start of a long reply | Observed frustration with streaming UIs | New messages scroll into view at the start |
| One chatbot, not competing widgets | Home Depot dual-bot confusion | Hidden on `/project`, `/companion`, `/workspace`, `/founder` where other Aethelios threads already exist |
| Do not interrupt with a popup | Classic overlay-distraction guidance | No auto-open; launcher is visitor-initiated |

Limitation: NN/g samples are task-oriented retail and support users, not buyers of custom studio work. Applied as interaction principles, not as a sales script.

## Conversion and premium services

Premium digital-studio buyers evaluate **risk, fit, and founder judgment** more than cart friction.

Applied here:

- **Perceived risk.** Clear request-not-booking language already exists in Atelier. The concierge reuses the inquiry consent path and never claims a send, booking, or quote unless the existing inquiry pipeline succeeds.
- **Cognitive load.** Adaptive discovery instead of a fixed questionnaire. A visitor with a precise question is not forced through intake.
- **Problem recognition.** Outdated-site examples are treated as symptoms (messaging, mobile, trust, CTA) before a redesign is recommended.
- **Proof.** Only Fix It Shop is cited as verified public work. Demonstrations stay labeled. No invented lifts.
- **Choice architecture.** One or two next steps (relevant service, brief, inquiry) instead of every CTA at once.
- **Not-ready visitors.** Conversation persists on the device so someone can return without starting over. No retargeting claim.

Visa’s agentic-commerce survey (familiarity ~43–59%; ~85% want data control) supports disclosure and visitor control. It does **not** justify purchase automation on this site. Payments are not collected in Atelier.

BMC Psychology (2024) links interactivity and perceived humanness to trust in e-commerce chatbots. Used only as a caution: distinctive voice is useful; pretending to be human is not.

Acta Psychologica (2024) studies whether chatbot recommendations convince customers. Used as a reminder that recommendation quality and rationale matter more than volume. Aethelios explains *why* a path fits and will recommend a simpler site over a custom app when that is enough.

## Premium positioning

Empty luxury copy (“bespoke excellence”, “world-class”) does not reduce uncertainty. The existing studio voice — founder-led, request-not-booking, catalog with includes/excludes — is the source of truth. The concierge explains capabilities from `SERVICE_CATALOG` and `AURELIUS_FACTS` rather than decorating them.

## Technical constraints observed in this repository

- OpenAI is fail-closed (`ATELIER_OPENAI_ENABLED` + `OPENAI_API_KEY`). Live model calls are optional.
- Existing intelligence: commission brief (`AureliusBoundary`) and Companion Talk. Discovery Aethelios is curated only.
- Guest inquiries already have validation, honeypot, rate limit, Resend / capture / mailto.
- No third-party analytics SDK. Concierge events are first-party named events without message bodies.
- Do not invent CRM, calendar, or email success.

## Evidence limits

- No Atelier-specific usability sample yet. Events exist so later comparison is possible; no lift is promised.
- Academic chatbot trust papers are mostly B2C.
- NN/g chatbot studies are qualitative; they guide design, they do not prove conversion rates.

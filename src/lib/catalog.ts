import type { ServiceOffer } from "@/lib/types";

export const SERVICE_CATALOG: {
  version: 1;
  source: "approved_local_catalog";
  pricingStatus: "not_finalized";
  primaryOfferId: "booking_connected_website";
  offers: ServiceOffer[];
} = {
  version: 1,
  source: "approved_local_catalog",
  pricingStatus: "not_finalized",
  primaryOfferId: "booking_connected_website",
  offers: [
    {
      id: "website",
      status: "offered",
      title: "Branded website",
      summary:
        "A considered, founder-reviewed website that presents the business clearly and can later connect to existing tools.",
      includes: [
        "Strategy conversation and written brief",
        "Founder review of scope before work is accepted",
        "A branded marketing website shaped around the business"
      ],
      excludes: [
        "Unlimited custom work",
        "Autonomous website generation",
        "A subscription product from Aethelios"
      ]
    },
    {
      id: "booking_connected_website",
      status: "offered",
      title: "Booking-connected website",
      summary:
        "A branded website and installable web app that links clients to the booking destination you already use. That provider continues to handle appointments and payments.",
      includes: [
        "A branded website shaped around the business",
        "Installable web-app presentation",
        "A clear link into an existing booking provider"
      ],
      excludes: [
        "Building a replacement booking engine",
        "Calendar synchronization as a scheduling product",
        "Taking appointment payments inside Atelier",
        "Unlimited custom work"
      ]
    },
    {
      id: "digital_infrastructure",
      status: "exploratory",
      title: "Digital infrastructure",
      summary:
        "Longer-horizon operational systems. This is not a packaged self-serve product. Neil reviews whether it is a fit after a brief exists.",
      includes: ["A founder conversation about operational needs"],
      excludes: [
        "A claim that every niche is already supported",
        "Immediate delivery without review"
      ]
    },
    {
      id: "undecided",
      status: "offered",
      title: "Not sure yet",
      summary:
        "Begin with the idea. Aethelios can help organize it; Neil decides what can be accepted.",
      includes: ["A guided brief with no obligation to buy"],
      excludes: ["A commitment to a specific package before review"]
    }
  ]
};

export function offerById(id: string) {
  return SERVICE_CATALOG.offers.find((offer) => offer.id === id);
}

export const AURELIUS_FACTS = [
  "Aethelios Atelier is founder-led by Neil Stutes.",
  "Aethelios is the in-app intelligence for Aethelios Atelier. It does not accept work, set price, or bind timing. Aurelius is Neil’s separate personal assistant and is not this guide.",
  "Owners can begin a brief without buying a subscription.",
  "The first focused offer is a branded website / installable web app connected to an existing booking provider.",
  "Booking-connected means linking to the client’s current booking destination, not replacing it.",
  "Pricing is not finalized. Any range Aethelios mentions must come from the approved catalog and is nonbinding.",
  "Submitted is not the same as under founder review.",
  "Private founder notes and internal prices never belong in client-visible replies."
];

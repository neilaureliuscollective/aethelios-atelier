import { BARBERS_SALONS_OFFER_ID, type ServiceOfferId } from "@/lib/offers/ids";

export const BARBERS_SALONS_PUBLIC_TITLE = "Atelier for Barbers & Salons";

export const BARBERS_SALONS_CORE_MESSAGE =
  "Your business. Beautifully presented. Connected to the booking system you already use.";

export const BARBERS_SALONS_HREF = "/services/barbers-salons";

export const BARBERS_SALONS_BRIEF_HREF =
  "/project?offer=barbers_salons&interest=website&purpose=business&booking=1";

export const KATIE_FIX_IT_PUBLIC_HREF = "https://fixitshop-app.vercel.app/";
export const KATIE_FIX_IT_BOOKING_HREF = "https://fixitshop.glossgenius.com/";

export const BARBERS_SALONS_PUBLIC_TERMS =
  "This focused offer has a one-time build fee plus ongoing hosting and care. Neil confirms the exact proposal. It does not replace the published Atelier plan prices.";

export type BarbersSalonStarterKey =
  | "vision"
  | "audience"
  | "existingWebsite"
  | "bookingProvider"
  | "goals"
  | "priorities"
  | "constraints";

export type BarbersSalonOffer = {
  id: typeof BARBERS_SALONS_OFFER_ID;
  title: string;
  short: string;
  kicker: string;
  summary: string;
  briefHref: string;
  pageHref: string;
  starter: Record<BarbersSalonStarterKey, string>;
};

export const BARBERS_SALONS_OFFER: BarbersSalonOffer = {
  id: BARBERS_SALONS_OFFER_ID,
  title: BARBERS_SALONS_PUBLIC_TITLE,
  short: "Barbers & salons",
  kicker: "Focused website offer",
  summary:
    "A custom branded website and installable web app for one location, connected to the booking provider already in use. Neil builds and maintains the agreed digital presence. Appointments, client records, and appointment payments stay with that provider.",
  briefHref: BARBERS_SALONS_BRIEF_HREF,
  pageHref: BARBERS_SALONS_HREF,
  starter: {
    vision: "A branded public website and installable web app for my barber shop or salon.",
    audience: "",
    existingWebsite: "",
    bookingProvider: "",
    goals: "Present the work, services, team, and a clear booking action that opens my existing provider.",
    priorities: "Story, services, gallery, location and hours, and a booking action that leaves my current booking tool in place.",
    constraints:
      "Keep my current booking provider, appointments, client records, and appointment payments. Do not build a scheduler or move those records into Atelier."
  }
};

export const BARBERS_SALON_FIELD_LABELS = {
  vision: "Business name",
  projectType: "Project type",
  audience: "Professional type",
  existingWebsite: "Existing website",
  bookingProvider: "Booking provider and public URL",
  goals: "Services to present",
  references: "Brand assets and photography",
  priorities: "Desired sections, main priority, and requested changes",
  timing: "Timing",
  budget: "Budget (optional)",
  constraints: "Location, hours, and what must stay unchanged"
} as const;

export const BARBERS_SALON_FIELD_HINTS = {
  vision: "The name clients already know — or the name this site should carry.",
  projectType: "This offer is a branded website with a booking handoff. You can still change the type.",
  audience: "Barber, independent stylist, salon owner, or another professional type. Unknown is fine.",
  existingWebsite: "A current site, if there is one. Leave blank if there is not.",
  bookingProvider: "The tool that already handles appointments and payments, plus its public booking page if you have it.",
  goals: "Which services should be presented? Names only — prices can stay with the booking provider.",
  references: "Logo, colors, type, and photography we may use. Note anything that must not be assumed.",
  priorities: "Which sections matter first, what the site must achieve, and what you would change from today.",
  timing: "Is there a real window, or is timing still to confirm?",
  budget: "Optional. Leave blank if you would rather discuss this with Neil.",
  constraints: "Location, hours, and anything that must stay with the current booking or business tools."
} as const;

export const BARBERS_SALON_PROFESSIONAL_TYPES = [
  "Barber",
  "Independent stylist",
  "Salon owner",
  "Barber shop and salon"
] as const;

export const BARBERS_SALON_DESIRED_SECTIONS = [
  "Story and team",
  "Services",
  "Gallery",
  "Location and hours",
  "Booking action",
  "Installable phone experience"
] as const;

export const BARBERS_SALON_BENEFITS = [
  {
    title: "Your own branded presence",
    body: "A site that looks and reads as your business — not a generic template and not a booking-software skin."
  },
  {
    title: "The booking system you already use",
    body: "Visitors explore the work here, then continue into GlossGenius, Square, Booksy, or another verified public booking page."
  },
  {
    title: "An installable phone experience",
    body: "Clients can add the site to a home screen. That is not an App Store or Google Play listing."
  },
  {
    title: "Straightforward ongoing care",
    body: "Hosting, implementation care, important-link checks, and agreed small content changes — scoped before larger work begins."
  }
] as const;

export const BARBERS_SALON_WALKTHROUGH = [
  {
    title: "Explore the work",
    body: "A visitor reads the story, meets the team, and looks through the gallery."
  },
  {
    title: "View services",
    body: "Service information is presented clearly. Live prices and availability stay with the booking provider when that is where they already live."
  },
  {
    title: "Book with the existing provider",
    body: "The booking action opens the public page already used for appointments and payments. Atelier does not create the appointment."
  }
] as const;

export const BARBERS_SALON_FAQ = [
  {
    id: "booking",
    question: "Do I have to change booking software?",
    answer:
      "No. The professional keeps the current booking provider, appointments, client records, and appointment-payment system. Atelier presents the business and points to that public booking destination."
  },
  {
    id: "providers",
    question: "Which booking tools can be connected?",
    answer:
      "Verified public booking links come first. A GlossGenius public booking URL is enough. Square and Booksy document website connection options; embeds are used only when supported and tested, with a useful external-link fallback. Not every provider supports embedded scheduling or booking without an account."
  },
  {
    id: "install",
    question: "Is this a native app in the App Store?",
    answer:
      "No. The client receives an installable web app that a phone can add to the home screen. Each delivered site is accepted by that browser and device. One shared Atelier manifest does not create a separate app for every client."
  },
  {
    id: "care",
    question: "What does ongoing care include?",
    answer:
      "Keeping the site available, maintaining the implementation, checking important links, and handling agreed small content changes. Provider fees and domain renewal sit outside this. Larger additions are scoped before work begins. This page does not invent support-response times, contracts, free domains, unlimited edits, notifications, or search-ranking promises."
  },
  {
    id: "price",
    question: "What does it cost?",
    answer: BARBERS_SALONS_PUBLIC_TERMS
  },
  {
    id: "scope",
    question: "What is in the focused first version?",
    answer:
      "One location, one existing booking connection, branded presentation, story and team, service information, gallery, location and hours, and a clear booking action. Products, Reserve commissions, wholesale inventory, and private labeling are not part of this offer."
  }
] as const;

export function offerById(id: string | undefined | null) {
  if (id === BARBERS_SALONS_OFFER.id) return BARBERS_SALONS_OFFER;
  return undefined;
}

export function displayOfferLabel(id: string | undefined | null) {
  return offerById(id)?.title ?? "";
}

export function isBarbersSalonOfferId(value: string | undefined | null): value is ServiceOfferId {
  return value === BARBERS_SALONS_OFFER_ID;
}

export function isBarbersSalonOffer(brief: { context?: { offerId?: string } | undefined } | null | undefined) {
  return brief?.context?.offerId === BARBERS_SALONS_OFFER_ID;
}

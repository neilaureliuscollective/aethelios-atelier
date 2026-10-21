import { SALON_INDUSTRY_ASSETS } from "@/lib/industry/assets";

export const VALE_CROWN_DEMO = {
  id: "vale_crown_demo",
  name: "Vale & Crown",
  kicker: "Fictional demonstration",
  location: "One chair · a quiet street",
  hours: "Tue–Sat · 9 to 6",
  tagline: "Cut, color, and care — presented as the shop itself.",
  story:
    "Vale & Crown is a labeled fictional shop used to show what a professional actually receives: a branded public site, a short story, the work, the services, and a booking action that leaves the current provider in place.",
  team: "An independent stylist and a barber sharing one room. Names, faces, and results below are sample content — not a client, testimonial, or completed commission.",
  services: [
    { name: "Signature cut", note: "Shape and finish. Live duration and price stay with the booking provider." },
    { name: "Color and gloss", note: "Consultation first. This card does not invent a menu of add-ons." },
    { name: "Beard and finish", note: "A considered tidy, not a separate product line." }
  ],
  storyImage: {
    src: SALON_INDUSTRY_ASSETS.valeStory.src,
    alt: SALON_INDUSTRY_ASSETS.valeStory.alt,
    width: SALON_INDUSTRY_ASSETS.valeStory.width,
    height: SALON_INDUSTRY_ASSETS.valeStory.height
  },
  gallery: [
    {
      src: SALON_INDUSTRY_ASSETS.valeCraft.src,
      alt: SALON_INDUSTRY_ASSETS.valeCraft.alt,
      width: SALON_INDUSTRY_ASSETS.valeCraft.width,
      height: SALON_INDUSTRY_ASSETS.valeCraft.height
    },
    {
      src: SALON_INDUSTRY_ASSETS.valeAlcove.src,
      alt: SALON_INDUSTRY_ASSETS.valeAlcove.alt,
      width: SALON_INDUSTRY_ASSETS.valeAlcove.width,
      height: SALON_INDUSTRY_ASSETS.valeAlcove.height
    },
    {
      src: SALON_INDUSTRY_ASSETS.valeDetail.src,
      alt: SALON_INDUSTRY_ASSETS.valeDetail.alt,
      width: SALON_INDUSTRY_ASSETS.valeDetail.width,
      height: SALON_INDUSTRY_ASSETS.valeDetail.height
    }
  ],
  visit: {
    address: "Shown as one location. A real brief keeps the actual address if the professional wants it public.",
    hours: "Hours belong on the site. Appointment times belong with the booking provider.",
    note: "This demonstration does not publish a map pin, reviews, or invented walk-in availability."
  },
  booking: {
    provider: "Existing booking provider",
    explanation:
      "On a delivered site, this action opens the professional’s verified public booking page — GlossGenius, Square, Booksy, or another tool already in use. Appointments and appointment payments are completed there. This demonstration does not create a booking, show live times, or open a real calendar."
  }
} as const;

export const DEMO_VIEWS = ["story", "gallery", "services", "visit", "book"] as const;
export type DemoView = (typeof DEMO_VIEWS)[number];

export const DEMO_VIEW_LABELS: Record<DemoView, string> = {
  story: "Story",
  gallery: "Work",
  services: "Services",
  visit: "Visit",
  book: "Book"
};

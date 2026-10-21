import { FIX_IT_SHOP_SHOWCASE_ID } from "@/lib/work/ids";

export const FIX_IT_SHOP_PUBLIC_HREF = "https://fixitshop-app.vercel.app/";
export const FIX_IT_SHOP_BOOKING_HREF = "https://fixitshop.glossgenius.com/";

export const FIX_IT_SHOP_BRIEF_HREF = "/project?source=fix_it_shop";

export const FIX_IT_SHOP = {
  id: FIX_IT_SHOP_SHOWCASE_ID,
  eyebrow: "Selected work",
  title: "Fix It Shop",
  description: "A distinct digital home. Built around the business behind it.",
  business: "A men’s salon with a branded public website that points to the booking system already in use.",
  facts: [
    "Custom brand presentation",
    "Mobile experience",
    "Connection to existing booking"
  ],
  liveLabel: "Explore the live website",
  liveHref: FIX_IT_SHOP_PUBLIC_HREF,
  bookingLabel: "Appointments stay on GlossGenius",
  bookingHref: FIX_IT_SHOP_BOOKING_HREF,
  playPreviewLabel: "Play preview",
  pauseLabel: "Pause",
  resumeLabel: "Resume",
  inquireLabel: "Start your project",
  inquireHref: FIX_IT_SHOP_BRIEF_HREF,
  specialistInquireHref: "/project?offer=barbers_salons&interest=website&purpose=business&booking=1&source=fix_it_shop",
  media: {
    masterSrc: "/work/fix-it-shop/cinematic-showcase.mp4",
    loopSrc: "/work/fix-it-shop/cinematic-loop.mp4",
    posterSrc: "/work/fix-it-shop/poster.webp",
    posterJpg: "/work/fix-it-shop/poster.jpg",
    previewSrc: "/work/fix-it-shop/poster-preview.webp",
    width: 1280,
    height: 832,
    durationSeconds: 34,
    loopDurationSeconds: 23.1,
    aspect: "20 / 13",
    silent: true,
    posterTimestamp: "00:00"
  },
  videoDescription:
    "A silent presentation of the live Fix It Shop website, assembled from locked page frames of the original capture. It opens on the homepage hero (“A little time. A lot of care.”), moves through the personal-standard story, three process scenes, an interactive visit-guide pace control, and returns to the hero. On-screen disclosures in the footage remain part of the recording: illustrative setting, not the finished location; illustrative process imagery, not Katie, her clients, or the finished space. Appointments stay on GlossGenius. This is not a testimonial and does not invent business results.",
  distinction: {
    real: "Fix It Shop is a completed public website for a men’s salon.",
    illustrative: "Vale & Crown is a labeled fictional direction used to show how a shop site can move."
  }
} as const;

export function displayShowcaseLabel(id: string | undefined | null) {
  if (id === FIX_IT_SHOP.id) return FIX_IT_SHOP.title;
  return "";
}

export const INDUSTRY_IMAGE_SOURCES = {
  generated:
    "Illustrative images generated for Atelier’s barber-and-salon demonstration. They are not photographs of Fix It Shop, Katie Guidry, her clients, or a delivered premises.",
  references:
    "Visual direction only: Hershesons store interiors and The Murdock Experience. Photography from those brands was not copied."
} as const;

export const SALON_INDUSTRY_ASSETS = {
  specialistHero: {
    src: "/industry/salon-hero.webp",
    jpg: "/industry/salon-hero.jpg",
    width: 1280,
    height: 720,
    alt: ""
  },
  valeStory: {
    src: "/industry/vale-story.webp",
    jpg: "/industry/vale-story.jpg",
    width: 1152,
    height: 864,
    alt: "Illustrative Vale & Crown chair and marble station — fictional shop, not a client premises"
  },
  valeCraft: {
    src: "/industry/vale-craft.webp",
    jpg: "/industry/vale-craft.jpg",
    width: 1152,
    height: 864,
    alt: "Illustrative cut in progress, shown from behind — sample craft, not a client result"
  },
  valeAlcove: {
    src: "/industry/vale-alcove.webp",
    jpg: "/industry/vale-alcove.jpg",
    width: 1152,
    height: 864,
    alt: "Illustrative waiting alcove with linen and tonic bottles — fictional shop interior"
  },
  valeDetail: {
    src: "/industry/vale-detail.webp",
    jpg: "/industry/vale-detail.jpg",
    width: 1152,
    height: 864,
    alt: "Illustrative still life of shears, comb, and finished hair texture — sample styling tools"
  }
} as const;

export function salonAssetPaths() {
  return [
    SALON_INDUSTRY_ASSETS.specialistHero.src,
    SALON_INDUSTRY_ASSETS.valeStory.src,
    SALON_INDUSTRY_ASSETS.valeCraft.src,
    SALON_INDUSTRY_ASSETS.valeAlcove.src,
    SALON_INDUSTRY_ASSETS.valeDetail.src
  ];
}

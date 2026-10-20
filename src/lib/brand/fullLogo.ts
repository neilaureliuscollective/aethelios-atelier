/** Official lockup and the isolated A used as a quiet house mark. */
export const FULL_LOGO = {
  src: "/brand/logo.webp",
  pngSrc: "/brand/logo.png",
  lockupSrc: "/brand/atelier-lockup.png",
  markSrc: "/brand/mark.webp",
  markPngSrc: "/brand/mark.png",
  ogSrc: "/brand/og.png",
  width: 1155,
  height: 1206,
  markWidth: 1151,
  markHeight: 855
} as const;

export const FULL_LOGO_ASPECT = FULL_LOGO.width / FULL_LOGO.height;
export const MARK_ASPECT = FULL_LOGO.markWidth / FULL_LOGO.markHeight;

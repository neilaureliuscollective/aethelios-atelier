export const INSTALL_COPY = {
  kicker: "On your phone",
  title: "Install Atelier on this device.",
  lede: "The public site can live on your home screen. Your signed-in session stays on this phone. Offline work is a public shell, not a synced draft.",
  android: {
    label: "Android",
    steps: [
      "Open Atelier in Chrome.",
      "Tap the menu, then Install app or Add to Home screen.",
      "Open the icon to return. The public site is the start page; sign-in stays until you sign out."
    ]
  },
  ios: {
    label: "iPhone",
    steps: [
      "Open Atelier in Safari — not an in-app browser.",
      "Tap Share, then Add to Home Screen.",
      "Open the icon to return. Saved commissions remain on this account after you sign in again."
    ]
  },
  limits: [
    "Installing does not create a subscription or a payment.",
    "If this phone is offline, you will see a public shell. Edits made offline are not sent and are not treated as saved.",
    "Another person who uses this browser could still see a guest draft stored on the device."
  ]
} as const;

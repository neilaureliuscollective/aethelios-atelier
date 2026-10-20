#!/usr/bin/env python3
"""Build Atelier install icons from the official gold-and-emerald emblem.

The supplied mark is already the installable app icon: a full-bleed
sculptural A on an obsidian field. Research notes locked here:

- Do not ship the isolated mark on white. Android pads non-maskable icons
  with white, and a white plate fights Atelier's obsidian/emerald brand.
- Do not pre-round the canvas. iOS, iPadOS, and Android apply their own
  squircle / circle / rounded-rect masks. A baked gold frame gets double-cut.
- Keep the triangular tips inside the maskable safe circle (radius 40% of
  the canvas). A wide A needs a smaller fill than a circular emblem.
- Preserve the official black field for any-purpose icons. Seat maskable
  derivatives on the same obsidian plate (#080C0B) so home-screen crops
  do not flash a different color.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MARK_SRC = ROOT / "public" / "brand" / "original" / "icon-mark.png"
INSTALL_VERSION = "v10"
OBSIDIAN = (8, 12, 11)
DEEP = (11, 70, 53)
ANY_FILL = 0.96
MASKABLE_FILL = 0.68


def lerp(start: tuple[int, int, int], end: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(start[i] + (end[i] - start[i]) * t) for i in range(3))  # type: ignore[return-value]


def official_plate(size: int) -> Image.Image:
    """Soft obsidian plate that matches the official icon field."""
    sample = 256
    plate = Image.new("RGB", (sample, sample), OBSIDIAN)
    pixels = plate.load()
    cx = cy = (sample - 1) / 2
    maxd = (cx**2 + cy**2) ** 0.5
    for y in range(sample):
        for x in range(sample):
            t = min(1.0, ((((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / maxd) ** 1.35)
            pixels[x, y] = lerp((6, 10, 8), OBSIDIAN, t)
    return plate.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")


def fit_mark(mark: Image.Image, size: int, fill: float) -> Image.Image:
    target = max(1, int(size * fill))
    scale = target / max(mark.width, mark.height)
    return mark.resize(
        (max(1, round(mark.width * scale)), max(1, round(mark.height * scale))),
        Image.Resampling.LANCZOS,
    )


def compose(mark: Image.Image, size: int, fill: float) -> Image.Image:
    canvas = official_plate(size)
    fitted = fit_mark(mark, size, fill)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    flat = Image.new("RGBA", (size, size), (*OBSIDIAN, 255))
    flat.alpha_composite(canvas)
    return flat


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=92, method=6)


def load_mark() -> Image.Image:
    if not MARK_SRC.exists():
        raise SystemExit(f"missing emblem source {MARK_SRC}")
    return Image.open(MARK_SRC).convert("RGBA")


def main() -> None:
    mark = load_mark()
    brand = ROOT / "public" / "brand"
    install = brand / "install"
    versioned = install / INSTALL_VERSION
    app_dir = ROOT / "src" / "app"

    master = compose(mark, 1024, ANY_FILL)
    save_png(master, brand / "original" / "icon.png")

    any_192 = compose(mark, 192, ANY_FILL)
    any_512 = compose(mark, 512, ANY_FILL)
    mask_192 = compose(mark, 192, MASKABLE_FILL)
    mask_512 = compose(mark, 512, MASKABLE_FILL)
    apple = compose(mark, 180, ANY_FILL)
    favicon_32 = compose(mark, 32, ANY_FILL)
    app_icon = compose(mark, 512, ANY_FILL)

    for directory in (install, versioned):
        save_png(any_192, directory / "icon-192.png")
        save_png(any_512, directory / "icon-512.png")
        save_png(mask_192, directory / "icon-192-maskable.png")
        save_png(mask_512, directory / "icon-512-maskable.png")
        save_png(apple, directory / "apple-touch-icon.png")

    save_png(any_512, brand / "icon.png")
    save_webp(any_512, brand / "icon.webp")
    save_png(any_192, brand / "icon-192.png")
    save_png(any_512, brand / "icon-512.png")
    save_png(apple, brand / "apple-touch-icon.png")
    save_png(apple, ROOT / "public" / "apple-touch-icon.png")
    save_png(favicon_32, brand / "favicon-32.png")
    save_png(app_icon, app_dir / "icon.png")
    save_png(apple, app_dir / "apple-icon.png")
    save_png(master, ROOT / "docs" / "visual-direction" / "approved-icon.png")

    ico_source = compose(mark, 256, ANY_FILL)
    ico_source.save(ROOT / "public" / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    ico_source.save(versioned / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    print(
        "built install icons",
        INSTALL_VERSION,
        "from",
        MARK_SRC.name,
        "any_fill",
        ANY_FILL,
        "maskable_fill",
        MASKABLE_FILL,
    )


if __name__ == "__main__":
    main()

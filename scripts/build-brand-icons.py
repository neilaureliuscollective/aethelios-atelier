#!/usr/bin/env python3
"""Build Atelier install icons from the supplied sculptural emblem.

Research notes (locked in this builder):
- Do not ship the isolated mark on white. Android pads non-maskable icons
  with white, and a white plate fights Atelier's obsidian/emerald brand.
- Do not pre-round the canvas. iOS, iPadOS, and Android apply their own
  squircle / circle / rounded-rect masks. A baked gold frame gets double-cut.
- Keep the triangular tips inside the maskable safe circle (radius 40% of
  the canvas). A wide A needs a smaller fill than a circular emblem.
- Seat the mark on a full-bleed radial plate: deep emerald (#0B4635) to
  obsidian (#080C0B), matching theme_color and the inlay in the sculpture.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
MARK_SRC = ROOT / "public" / "brand" / "original" / "icon-mark.png"
INSTALL_VERSION = "v7"
OBSIDIAN = (8, 12, 11)
DEEP = (11, 70, 53)
ANY_FILL = 0.78
MASKABLE_FILL = 0.62


def knockout(image: Image.Image) -> Image.Image:
    px = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if a < 12 or luma > 248:
                px[x, y] = (r, g, b, 0)
            elif luma > 236:
                px[x, y] = (r, g, b, max(0, min(a, int(255 * (248 - luma) / 12))))
    return image


def content_bbox(image: Image.Image, threshold: int = 18) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit("source emblem has no visible pixels")
    return box


def crop_mark(image: Image.Image, pad: int = 8) -> Image.Image:
    left, top, right, bottom = content_bbox(image)
    return image.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(image.width, right + pad),
            min(image.height, bottom + pad),
        )
    )


def lerp(start: tuple[int, int, int], end: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(start[i] + (end[i] - start[i]) * t) for i in range(3))  # type: ignore[return-value]


def radial_plate(size: int) -> Image.Image:
    sample = 256
    plate = Image.new("RGB", (sample, sample), OBSIDIAN)
    pixels = plate.load()
    cx = cy = (sample - 1) / 2
    maxd = (cx ** 2 + cy ** 2) ** 0.5
    for y in range(sample):
        for x in range(sample):
            t = min(1.0, (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / maxd) ** 1.15)
            pixels[x, y] = lerp(DEEP, OBSIDIAN, t)
    return plate.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")


def fit_mark(mark: Image.Image, size: int, fill: float) -> Image.Image:
    target = max(1, int(size * fill))
    scale = target / max(mark.width, mark.height)
    return mark.resize(
        (max(1, round(mark.width * scale)), max(1, round(mark.height * scale))),
        Image.Resampling.LANCZOS,
    )


def compose(mark: Image.Image, size: int, fill: float) -> Image.Image:
    canvas = radial_plate(size)
    fitted = fit_mark(mark, size, fill)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2 + round(size * 0.015)
    shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    blob = Image.new("RGBA", fitted.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(blob)
    inset = max(4, fitted.width // 18)
    draw.ellipse(
        (inset, int(fitted.height * 0.55), fitted.width - inset, fitted.height - inset // 4),
        fill=(0, 0, 0, 90),
    )
    blob = blob.filter(ImageFilter.GaussianBlur(radius=max(6, size // 28)))
    shade.alpha_composite(blob, (x, y + size // 40))
    canvas.alpha_composite(shade)
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
    return crop_mark(knockout(Image.open(MARK_SRC).convert("RGBA")))


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

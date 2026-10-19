#!/usr/bin/env python3
"""Build Atelier in-app marks and installable PWA icons from the approved emblem."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "brand" / "original" / "icon.png"
OBSIDIAN = (8, 12, 11, 255)
EMERALD = (36, 131, 104)
GOLD = (199, 164, 90)


def alpha_bbox(image: Image.Image, threshold: int = 10) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    box = mask.getbbox()
    if box is None:
        raise SystemExit("source emblem has no visible pixels")
    return box


def load_emblem() -> Image.Image:
    source = Image.open(SRC).convert("RGBA")
    left, top, right, bottom = alpha_bbox(source)
    return source.crop((left, top, right, bottom))


def atmosphere(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), OBSIDIAN)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    center = size / 2
    for radius in range(size // 2, 0, -max(1, size // 220)):
        t = radius / (size / 2)
        emerald = int(48 * (1 - t) ** 2)
        gold = int(22 * (1 - t) ** 3)
        draw.ellipse(
            [center - radius, center - radius, center + radius, center + radius],
            fill=(EMERALD[0], EMERALD[1], EMERALD[2], emerald),
        )
        if gold:
            draw.ellipse(
                [
                    center - radius * 0.72,
                    center - radius * 0.72,
                    center + radius * 0.72,
                    center + radius * 0.72,
                ],
                fill=(GOLD[0], GOLD[1], GOLD[2], gold),
            )
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius=max(1, size / 28))))
    return canvas


def place(emblem: Image.Image, size: int, fill: float, *, opaque: bool) -> Image.Image:
    canvas = atmosphere(size) if opaque else Image.new("RGBA", (size, size), (0, 0, 0, 0))
    width, height = emblem.size
    target = max(1, int(size * fill))
    scale = target / max(width, height)
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    fitted = emblem.resize(new_size, Image.Resampling.LANCZOS)
    x = (size - new_size[0]) // 2
    y = (size - new_size[1]) // 2
    canvas.alpha_composite(fitted, (x, y))
    if opaque:
        flat = Image.new("RGBA", (size, size), OBSIDIAN)
        flat.alpha_composite(canvas)
        return flat
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=92, method=6)


def main() -> None:
    emblem = load_emblem()
    brand = ROOT / "public" / "brand"
    install = brand / "install"
    app_dir = ROOT / "src" / "app"

    ui_512 = place(emblem, 512, 0.98, opaque=False)
    save_png(ui_512, brand / "icon.png")
    save_webp(ui_512, brand / "icon.webp")

    any_192 = place(emblem, 192, 0.92, opaque=True)
    any_512 = place(emblem, 512, 0.92, opaque=True)
    mask_192 = place(emblem, 192, 0.72, opaque=True)
    mask_512 = place(emblem, 512, 0.72, opaque=True)
    apple = place(emblem, 180, 0.88, opaque=True)
    favicon_32 = place(emblem, 32, 0.92, opaque=True)
    app_icon = place(emblem, 512, 0.92, opaque=True)

    save_png(any_192, install / "icon-192.png")
    save_png(any_512, install / "icon-512.png")
    save_png(mask_192, install / "icon-192-maskable.png")
    save_png(mask_512, install / "icon-512-maskable.png")
    save_png(any_192, brand / "icon-192.png")
    save_png(any_512, brand / "icon-512.png")
    save_png(apple, brand / "apple-touch-icon.png")
    save_png(apple, install / "apple-touch-icon.png")
    save_png(apple, ROOT / "public" / "apple-touch-icon.png")
    save_png(favicon_32, brand / "favicon-32.png")
    save_png(app_icon, app_dir / "icon.png")
    save_png(apple, app_dir / "apple-icon.png")

    ico_source = place(emblem, 256, 0.92, opaque=True)
    ico_path = ROOT / "public" / "favicon.ico"
    ico_source.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    save_png(Image.open(SRC).convert("RGBA"), ROOT / "docs" / "visual-direction" / "approved-icon.png")
    print("built install and in-app icons from", SRC)


if __name__ == "__main__":
    main()

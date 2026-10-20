#!/usr/bin/env python3
"""Build Atelier in-app marks and installable PWA icons from the approved emblem."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "brand" / "original" / "icon.png"
INSTALL_VERSION = "v5"
OBSIDIAN = (8, 12, 11, 255)


def alpha_bbox(image: Image.Image, threshold: int = 10) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    box = mask.getbbox()
    if box is None:
        raise SystemExit("source emblem has no visible pixels")
    return box


def load_source() -> Image.Image:
    source = Image.open(SRC).convert("RGBA")
    left, top, right, bottom = alpha_bbox(source)
    covers = (right - left) >= source.width * 0.97 and (bottom - top) >= source.height * 0.97
    if covers:
        return source
    return source.crop((left, top, right, bottom))


def letterbox_color(source: Image.Image) -> tuple[int, int, int, int]:
    pixel = source.getpixel((0, 0))
    if pixel[3] < 16:
        return OBSIDIAN
    return (pixel[0], pixel[1], pixel[2], 255)


def place(source: Image.Image, size: int, fill: float, *, opaque: bool) -> Image.Image:
    bg = letterbox_color(source) if opaque else (0, 0, 0, 0)
    canvas = Image.new("RGBA", (size, size), bg)
    width, height = source.size
    target = max(1, int(size * fill))
    scale = target / max(width, height)
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    fitted = source.resize(new_size, Image.Resampling.LANCZOS)
    x = (size - new_size[0]) // 2
    y = (size - new_size[1]) // 2
    canvas.alpha_composite(fitted, (x, y))
    if opaque:
        flat = Image.new("RGBA", (size, size), bg)
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
    source = load_source()
    brand = ROOT / "public" / "brand"
    install = brand / "install"
    versioned = install / INSTALL_VERSION
    app_dir = ROOT / "src" / "app"

    ui_512 = place(source, 512, 1.0, opaque=True)
    save_png(ui_512, brand / "icon.png")
    save_webp(ui_512, brand / "icon.webp")

    any_192 = place(source, 192, 1.0, opaque=True)
    any_512 = place(source, 512, 1.0, opaque=True)
    mask_192 = place(source, 192, 0.8, opaque=True)
    mask_512 = place(source, 512, 0.8, opaque=True)
    apple = place(source, 180, 1.0, opaque=True)
    favicon_32 = place(source, 32, 1.0, opaque=True)
    app_icon = place(source, 512, 1.0, opaque=True)

    for directory in (install, versioned):
        save_png(any_192, directory / "icon-192.png")
        save_png(any_512, directory / "icon-512.png")
        save_png(mask_192, directory / "icon-192-maskable.png")
        save_png(mask_512, directory / "icon-512-maskable.png")
        save_png(apple, directory / "apple-touch-icon.png")

    save_png(any_192, brand / "icon-192.png")
    save_png(any_512, brand / "icon-512.png")
    save_png(apple, brand / "apple-touch-icon.png")
    save_png(apple, ROOT / "public" / "apple-touch-icon.png")
    save_png(favicon_32, brand / "favicon-32.png")
    save_png(app_icon, app_dir / "icon.png")
    save_png(apple, app_dir / "apple-icon.png")

    ico_source = place(source, 256, 1.0, opaque=True)
    ico_source.save(ROOT / "public" / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    ico_source.save(versioned / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    save_png(Image.open(SRC).convert("RGBA"), ROOT / "docs" / "visual-direction" / "approved-icon.png")
    print("built install icons version", INSTALL_VERSION, "from", SRC)


if __name__ == "__main__":
    main()

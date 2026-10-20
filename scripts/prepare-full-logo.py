#!/usr/bin/env python3
"""Knock the official emblem off black and write the transparent site crest."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public" / "brand" / "original" / "logo.png"


def luma_of(r: int, g: int, b: int) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def chroma_of(r: int, g: int, b: int) -> int:
    return max(r, g, b) - min(r, g, b)


def is_gold(r: int, g: int, b: int) -> bool:
    return r > 72 and g > 40 and r + g > b * 2.6 and r >= b + 18


def is_emerald(r: int, g: int, b: int) -> bool:
    return g >= 36 and g > r + 8 and g > b + 4 and (max(r, g, b) - min(r, g, b)) >= 18


def core_mask(image: Image.Image) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    src = image.load()
    dst = mask.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, _a = src[x, y]
            luma = luma_of(r, g, b)
            if is_gold(r, g, b) or luma >= 96:
                dst[x, y] = 255
    return mask.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(radius=4))


def knockout_black(image: Image.Image) -> Image.Image:
    near = core_mask(image)
    near_px = near.load()
    px = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            luma = luma_of(r, g, b)
            chroma = chroma_of(r, g, b)
            hug = near_px[x, y] / 255
            if is_gold(r, g, b) or luma >= 70:
                continue
            if is_emerald(r, g, b) and hug > 0.18:
                px[x, y] = (r, g, b, max(0, min(a, int(a * (0.45 + 0.55 * hug)))))
                continue
            if luma < 26 or chroma < 12 or hug < 0.08:
                px[x, y] = (r, g, b, 0)
            elif luma < 48:
                fade = ((luma - 26) / 22) * hug * min(1.0, chroma / 30)
                px[x, y] = (r, g, b, max(0, min(a, int(a * fade))))
    return image


def circular_crest(image: Image.Image, inner: float = 0.48, outer: float = 0.54) -> Image.Image:
    px = image.load()
    width, height = image.size
    cx = (width - 1) / 2
    cy = (height - 1) / 2
    maxd = (cx**2 + cy**2) ** 0.5
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            t = (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / maxd
            if t <= inner:
                continue
            if t >= outer:
                px[x, y] = (r, g, b, 0)
                continue
            fade = 1 - (t - inner) / (outer - inner)
            px[x, y] = (r, g, b, int(a * fade))
    return image


def crop_to_content(image: Image.Image, pad: int = 28) -> Image.Image:
    px = image.load()
    width, height = image.size
    min_x, min_y, max_x, max_y = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a > 18 and luma_of(r, g, b) >= 20:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if max_x < min_x:
        raise SystemExit("source emblem has no visible pixels")
    box = (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(width, max_x + pad + 1),
        min(height, max_y + pad + 1),
    )
    return image.crop(box)


def contain_in_square(image: Image.Image, size: int) -> Image.Image:
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fitted = image.copy()
    fitted.thumbnail((size, size), Image.Resampling.LANCZOS)
    square.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2), fitted)
    return square


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=92, method=6)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing logo source {SOURCE}")
    original_dest = ROOT / "public" / "brand" / "original" / "logo.png"
    original_dest.parent.mkdir(parents=True, exist_ok=True)
    if SOURCE.resolve() != original_dest.resolve():
        original_dest.write_bytes(SOURCE.read_bytes())

    raw = Image.open(SOURCE).convert("RGBA")
    crest = crop_to_content(circular_crest(knockout_black(raw)))
    lockup_w = 480
    lockup_h = max(1, round(crest.height * (lockup_w / crest.width)))
    lockup = crest.resize((lockup_w, lockup_h), Image.Resampling.LANCZOS)

    brand = ROOT / "public" / "brand"
    save_png(crest, brand / "logo.png")
    save_png(lockup, brand / "atelier-lockup.png")
    save_png(contain_in_square(crest, 1024), brand / "logo-1024.png")
    save_png(contain_in_square(crest, 512), brand / "logo-512.png")
    save_png(contain_in_square(crest, 256), brand / "logo-256.png")
    save_png(contain_in_square(crest, 128), brand / "logo-128.png")
    save_png(contain_in_square(crest, 512), ROOT / "public" / "discovery" / "brand" / "logo.png")
    save_png(contain_in_square(crest, 256), ROOT / "public" / "discovery" / "brand" / "logo-256.png")
    save_png(crest, ROOT / "docs" / "visual-direction" / "approved-logo.png")
    save_webp(crest, brand / "logo.webp")
    save_webp(contain_in_square(crest, 512), ROOT / "public" / "discovery" / "brand" / "logo.webp")

    print(
        json.dumps(
            {
                "source": str(SOURCE),
                "logo": {"width": crest.width, "height": crest.height},
                "lockup": {
                    "width": lockup_w,
                    "height": lockup_h,
                    "aspect": round(lockup_w / lockup_h, 6),
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

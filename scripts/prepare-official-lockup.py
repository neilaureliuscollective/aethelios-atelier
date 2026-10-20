#!/usr/bin/env python3
"""Seat the official gold-and-emerald lockup as transparent brand assets."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public" / "brand" / "original" / "logo.png"
OBSIDIAN = (8, 12, 11)


def luma_of(r: int, g: int, b: int) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def knockout_paper(image: Image.Image) -> Image.Image:
    """Clear leftover paper / near-white so the lockup sits on any surface."""
    px = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a < 8:
                px[x, y] = (r, g, b, 0)
                continue
            luma = luma_of(r, g, b)
            chroma = max(r, g, b) - min(r, g, b)
            if luma > 246 and chroma < 14:
                px[x, y] = (r, g, b, 0)
            elif luma > 236 and chroma < 18:
                fade = (248 - luma) / 12
                px[x, y] = (r, g, b, max(0, min(a, int(a * fade))))
    return image


def content_bbox(image: Image.Image, threshold: int = 18) -> tuple[int, int, int, int]:
    px = image.load()
    width, height = image.size
    min_x, min_y, max_x, max_y = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            if px[x, y][3] > threshold:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if max_x < min_x:
        raise SystemExit("source lockup has no visible pixels")
    return min_x, min_y, max_x, max_y


def crop(image: Image.Image, box: tuple[int, int, int, int], pad: int = 16) -> Image.Image:
    left, top, right, bottom = box
    return image.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(image.width, right + pad + 1),
            min(image.height, bottom + pad + 1),
        )
    )


def row_counts(image: Image.Image, threshold: int = 18) -> list[int]:
    px = image.load()
    width, height = image.size
    counts = [0] * height
    for y in range(height):
        for x in range(width):
            if px[x, y][3] > threshold:
                counts[y] += 1
    return counts


def split_mark_bottom(image: Image.Image) -> int:
    """Find the quiet band between the sculptural A and AETHELIOS."""
    counts = row_counts(image)
    height = image.height
    interior = counts[int(height * 0.45) : int(height * 0.78)]
    if not interior:
        return int(height * 0.68)
    quietest = min(interior)
    for offset, count in enumerate(interior):
        if count <= max(24, quietest + 6):
            return int(height * 0.45) + offset
    return int(height * 0.68)


def contain_in_square(image: Image.Image, size: int) -> Image.Image:
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fitted = image.copy()
    fitted.thumbnail((size, size), Image.Resampling.LANCZOS)
    square.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2), fitted)
    return square


def og_plate(lockup: Image.Image, width: int = 1200, height: int = 630) -> Image.Image:
    plate = Image.new("RGBA", (width, height), (*OBSIDIAN, 255))
    fitted = lockup.copy()
    fitted.thumbnail((int(width * 0.42), int(height * 0.72)), Image.Resampling.LANCZOS)
    x = (width - fitted.width) // 2
    y = (height - fitted.height) // 2
    plate.alpha_composite(fitted, (x, y))
    return plate


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=92, method=6)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing lockup source {SOURCE}")
    original_dest = ROOT / "public" / "brand" / "original" / "logo.png"
    original_dest.parent.mkdir(parents=True, exist_ok=True)
    if SOURCE.resolve() != original_dest.resolve():
        original_dest.write_bytes(SOURCE.read_bytes())

    raw = knockout_paper(Image.open(SOURCE).convert("RGBA"))
    full_box = content_bbox(raw)
    lockup = crop(raw, full_box, pad=18)
    mark_cut = split_mark_bottom(raw)
    mark_box = (full_box[0], full_box[1], full_box[2], max(full_box[1] + 8, mark_cut - 28))
    mark = crop(raw, mark_box, pad=8)

    lockup_w = 720
    lockup_h = max(1, round(lockup.height * (lockup_w / lockup.width)))
    header = lockup.resize((lockup_w, lockup_h), Image.Resampling.LANCZOS)
    mark_master = mark

    brand = ROOT / "public" / "brand"
    save_png(lockup, brand / "logo.png")
    save_png(header, brand / "atelier-lockup.png")
    save_png(mark_master, brand / "mark.png")
    save_png(mark_master, brand / "original" / "icon-mark.png")
    save_png(contain_in_square(lockup, 1024), brand / "logo-1024.png")
    save_png(contain_in_square(lockup, 512), brand / "logo-512.png")
    save_png(contain_in_square(lockup, 256), brand / "logo-256.png")
    save_png(contain_in_square(lockup, 128), brand / "logo-128.png")
    save_png(contain_in_square(lockup, 512), ROOT / "public" / "discovery" / "brand" / "logo.png")
    save_png(contain_in_square(lockup, 256), ROOT / "public" / "discovery" / "brand" / "logo-256.png")
    save_png(lockup, ROOT / "docs" / "visual-direction" / "approved-logo.png")
    save_png(og_plate(lockup), brand / "og.png")
    save_webp(lockup, brand / "logo.webp")
    save_webp(mark_master, brand / "mark.webp")
    save_webp(contain_in_square(lockup, 512), ROOT / "public" / "discovery" / "brand" / "logo.webp")

    print(
        json.dumps(
            {
                "source": str(SOURCE),
                "logo": {"width": lockup.width, "height": lockup.height},
                "lockup": {"width": lockup_w, "height": lockup_h, "aspect": round(lockup_w / lockup_h, 6)},
                "mark": {"width": mark_master.width, "height": mark_master.height},
                "split": mark_cut,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

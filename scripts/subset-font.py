#!/usr/bin/env python3
"""Builds src/assets/fonts/yzcj-brush.woff2: the Ma Shan Zheng brush font (SIL OFL 1.1), subset to the
characters the game actually draws, so the web font stays tiny. Re-run after adding new Chinese text:

    pnpm font /path/to/MaShanZheng-Regular.ttf

The source TTF comes from https://github.com/google/fonts/tree/main/ofl/mashanzheng
"""
import pathlib
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "assets" / "fonts" / "yzcj-brush.woff2"
# Digits and punctuation brush text may use, besides the CJK characters found in the source files.
EXTRA = "0123456789·：！？，。「」（）+-× "


def is_cjk(ch: str) -> bool:
    return "㐀" <= ch <= "鿿" or "　" <= ch <= "〿" or "＀" <= ch <= "￯"


# Files whose Chinese is only ever drawn in the system sans font: their characters don't need brush glyphs.
# Reason: the privacy policy and user agreement alone would add ~200 characters (~80 KB) to the brush subset.
SANS_ONLY = {ROOT / "src" / "config" / "legal.ts"}


def collect() -> str:
    chars = set(EXTRA)
    for path in [*(ROOT / "src").rglob("*.ts"), ROOT / "index.html"]:
        if path in SANS_ONLY:
            continue
        chars.update(ch for ch in path.read_text(encoding="utf-8") if is_cjk(ch))
    return "".join(sorted(chars))


def main() -> None:
    src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/MaShanZheng-Regular.ttf")
    if not src.exists():
        sys.exit(f"source font not found: {src}")
    text = collect()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(str(src), opts)
    subsetter = subset.Subsetter(opts)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, str(OUT), opts)
    print(f"{len(text)} characters -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()

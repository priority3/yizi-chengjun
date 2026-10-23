#!/usr/bin/env python3
"""Builds src/assets/fonts/yzcj-brush.woff2: the Ma Shan Zheng brush font (SIL OFL 1.1), subset to the
characters the game actually draws, so the web font stays tiny. Re-run after adding new Chinese text:

    pnpm font                      # cuts from the committed fonts/MaShanZheng-Regular.ttf
    pnpm font /path/to/other.ttf   # or from another copy

The source TTF (kept in fonts/ with its OFL.txt, never shipped to players) comes from
https://github.com/google/fonts/tree/main/ofl/mashanzheng
"""
import pathlib
import re
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "assets" / "fonts" / "yzcj-brush.woff2"
# The full source font, committed so a re-cut needs no download; only the subset above reaches the game.
SOURCE = ROOT / "fonts" / "MaShanZheng-Regular.ttf"
# Digits and punctuation brush text may use, besides the CJK characters found in the source files, and every
# printable ASCII character: the English text (i18n/) is drawn in the brush font's own Latin letters.
EXTRA = "0123456789·：！？，。「」（）+-× …" + "".join(chr(c) for c in range(0x20, 0x7F))
# Characters brush text asks for that Ma Shan Zheng simply has no glyph for: the source font cannot provide them, so
# the browser falls back to the system face for these marks alone. `--check` skips them instead of failing forever.
NO_GLYPH_IN_SOURCE = "·"


def is_cjk(ch: str) -> bool:
    return "㐀" <= ch <= "鿿" or "　" <= ch <= "〿" or "＀" <= ch <= "￯"


def strip_comments(text: str) -> str:
    """Drops // and /* */ comments before any character is collected.

    Reason: comments carry Chinese the game never draws — `// its own (抖音 tt.*, 微信 wx.*)` alone asks for three
    brush glyphs nobody renders. Collecting them only bloats the subset.
    """
    return re.sub(r"//[^\n]*", "", re.sub(r"/\*.*?\*/", "", text, flags=re.S))


# Files whose Chinese is only ever drawn in the system sans font: their characters don't need brush glyphs.
# Reason: the privacy policy and user agreement alone would add ~200 characters (~80 KB) to the brush subset.
SANS_ONLY = {ROOT / "src" / "config" / "legal.ts", ROOT / "src" / "config" / "legal-en.ts"}


def collect() -> str:
    chars = set(EXTRA)
    for path in [*(ROOT / "src").rglob("*.ts"), ROOT / "index.html"]:
        if path in SANS_ONLY:
            continue
        chars.update(ch for ch in strip_comments(path.read_text(encoding="utf-8")) if is_cjk(ch))
    return "".join(sorted(chars))


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        sys.exit(check())
    src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE
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


def built_chars() -> set[str]:
    """The characters the built woff2 actually covers, read from its cmap."""
    from fontTools.ttLib import TTFont

    return {chr(code) for code in TTFont(str(OUT)).getBestCmap()}


def check() -> int:
    """Fails when the built subset is missing characters the source now draws in the brush font.

    Reason: brush() falls back to the system sans font, so a stale subset never renders a tofu box — it just draws
    the wrong typeface. Without this check the only way to notice is spotting one odd glyph on a real device.
    """
    if not OUT.exists():
        print(f"{OUT.relative_to(ROOT)} is missing — run `pnpm font`")
        return 1
    try:
        have = built_chars()
    except ImportError as exc:  # brotli is needed to read woff2
        print(f"cannot read the woff2 ({exc}) — pip install brotli")
        return 2
    missing = sorted(ch for ch in collect() if ch not in have and ch not in NO_GLYPH_IN_SOURCE)
    if missing:
        print(f"{len(missing)} character(s) missing from the brush subset: {''.join(missing)}")
        print("run `pnpm font` and commit the new woff2")
        return 1
    print(f"OK: the brush subset covers all {len(set(collect()))} characters the source draws")
    return 0


if __name__ == "__main__":
    main()

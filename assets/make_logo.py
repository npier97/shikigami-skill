"""Builds the shikigami logo SVGs from pixel grids (crisp rects, no raster).

A shikigami is a spirit a master summons; folklore often shows it as a katashiro, a
human-shaped paper cut-out. Here: a pixel paper doll with anime eyes, a vermilion seal
(a 日-like stamp) on its body, floating in a violet glow with gold sparkles.
"""
import sys
from pathlib import Path

OUT = Path(sys.argv[1])

DOLL = [
    "..........oooo..........",
    "........oowwwwoo........",
    ".......owwwwwwwwo.......",
    "......owwwwwwwwwwo......",
    "......owwwwwwwwwwo......",
    "......owhewwwwhewo......",
    "......oweewwwweewo......",
    "......obwwwwwwwwbo......",
    ".......owwwmmwwwo.......",
    "........oowwwwoo........",
    "..........owwo..........",
    "..oooooooowwwwoooooooo..",
    ".owwwwwwwwwwwwwwwwwwwwo.",
    ".owwwwwwwwwwwwwwwwwwwwo.",
    "..ooooowwwwwwwwwwooooo..",
    ".......owwwwwwwwo.......",
    ".......owwwwwwwwo.......",
    ".......owwqrrrwwo.......",
    ".......owwrRRrwwo.......",
    ".......owwrRRrwwo.......",
    ".......owwrrrrwwo.......",
    "......owwwwwwwwwwo......",
    ".....owwwwwwwwwwwwo.....",
    ".....owwwwo..owwwwo.....",
    ".....oooooo..oooooo.....",
]

# 5 × 8 pixel letters for the wordmark (row 7 is the descender).
FONT = {
    "s": [".....", ".....", ".####", "#....", ".###.", "....#", "####.", "....."],
    "h": ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "#...#", "....."],
    "i": ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###.", "....."],
    "k": ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "....."],
    "g": [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", ".###."],
    "a": [".....", ".....", ".###.", "....#", ".####", "#...#", ".####", "....."],
    "m": [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#", "....."],
}

INK = "#2b2440"
PAPER = "#fffaf0"
PAPER_SHADE = "#e9e0f5"
SEAL = "#e8424f"
BLUSH = "#ff9fb2"
EYE = "#2b2440"
GLINT = "#ffffff"
MOUTH = "#c0607a"
GOLD = "#ffd84d"
BG_TOP, BG_BOTTOM = "#2e2645", "#1b1628"
GLOW = "#8b6bff"
TEXT = "#f4f0ff"
TEXT_MUTED = "#b9b0d6"

for row in DOLL:
    assert len(row) == len(DOLL[0]), row


def shaded(grid):
    """Paper next to the outline on the right or below gets a shade: a hint of volume."""
    g = [list(r) for r in grid]
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch != "w":
                continue
            right = row[x + 1] if x + 1 < len(row) else "."
            below = grid[y + 1][x] if y + 1 < len(grid) else "."
            if right == "o" or below == "o":
                g[y][x] = "s"
    return ["".join(r) for r in g]


COLORS = {"o": INK, "w": PAPER, "s": PAPER_SHADE, "r": SEAL, "R": "#b02e3a", "q": "#ff8a92", "b": BLUSH, "e": EYE, "h": GLINT, "m": MOUTH}


def rects(grid, colors, x0, y0, px):
    """Horizontal runs of one colour become one rect, to keep the SVG small."""
    out = []
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            ch = row[x]
            if ch not in colors:
                x += 1
                continue
            end = x
            while end + 1 < len(row) and row[end + 1] == ch:
                end += 1
            out.append(f'<rect x="{x0 + x * px:g}" y="{y0 + y * px:g}" width="{(end - x + 1) * px:g}" height="{px:g}" fill="{colors[ch]}"/>')
            x = end + 1
    return out


def sparkle(cx, cy, px, color=GOLD):
    return [
        f'<rect x="{cx - px * 0.5:g}" y="{cy - px * 1.5:g}" width="{px:g}" height="{px * 3:g}" fill="{color}"/>',
        f'<rect x="{cx - px * 1.5:g}" y="{cy - px * 0.5:g}" width="{px * 3:g}" height="{px:g}" fill="{color}"/>',
    ]


def defs():
    return f"""<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BG_TOP}"/><stop offset="1" stop-color="{BG_BOTTOM}"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="{GLOW}" stop-opacity="0.75"/><stop offset="0.55" stop-color="{GLOW}" stop-opacity="0.25"/><stop offset="1" stop-color="{GLOW}" stop-opacity="0"/></radialGradient>
</defs>"""


def doll_group(x0, y0, px):
    """The doll, its glow, a floor shadow and sparkles, with the doll's top-left at (x0, y0)."""
    w, h = len(DOLL[0]) * px, len(DOLL) * px
    cx, cy = x0 + w / 2, y0 + h * 0.45
    parts = [f'<circle cx="{cx:g}" cy="{cy:g}" r="{w * 0.62:g}" fill="url(#glow)"/>']
    parts.append(f'<ellipse cx="{cx:g}" cy="{y0 + h + px * 2.2:g}" rx="{w * 0.28:g}" ry="{px * 0.9:g}" fill="#000" opacity="0.28"/>')
    parts += rects(shaded(DOLL), COLORS, x0, y0, px)
    for sx, sy, size in [(-1.5, 3, 1), (25.5, 6, 1), (23.5, -0.5, 0.75), (0.5, 17, 0.75)]:
        parts += sparkle(x0 + sx * px, y0 + sy * px, px * size)
    return parts


def wordmark(text, x0, y0, px, color):
    parts, x = [], x0
    for ch in text:
        glyph = FONT[ch]
        parts += rects(glyph, {"#": color}, x, y0, px)
        x += (len(glyph[0]) + 1) * px
    return parts, x - px - x0


# --- square icon (avatar, social card, skill icon) ---
ICON = 32
icon_px = 1
doll_w, doll_h = len(DOLL[0]), len(DOLL)
ix, iy = (ICON - doll_w) / 2, 2.5
icon = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ICON} {ICON}" width="512" height="512" shape-rendering="crispEdges" role="img" aria-labelledby="t">',
    '<title id="t">shikigami</title>',
    defs(),
    f'<rect width="{ICON}" height="{ICON}" rx="6" fill="url(#bg)" shape-rendering="geometricPrecision"/>',
    *doll_group(ix, iy, icon_px),
    "</svg>",
]
(OUT / "logo.svg").write_text("\n".join(icon) + "\n")

# --- banner for the README ---
BW, BH = 720, 200
dpx = 6.5
bx, by = 34, (BH - doll_h * dpx) / 2 - 6
letters, word_w = wordmark("shikigami", 0, 0, 6, TEXT)  # measure first
wx, wy = 230, 52
word, _ = wordmark("shikigami", wx, wy, 6, TEXT)
banner = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BW} {BH}" width="{BW}" height="{BH}" shape-rendering="crispEdges" role="img" aria-labelledby="t d">',
    '<title id="t">shikigami</title>',
    '<desc id="d">A pixel paper doll with a red seal, the shikigami, beside the word shikigami.</desc>',
    defs(),
    f'<rect width="{BW}" height="{BH}" rx="20" fill="url(#bg)" shape-rendering="geometricPrecision"/>',
    *doll_group(bx, by, dpx),
    *word,
    f'<text x="{wx + word_w + 16}" y="{wy + 40}" font-family="\'Hiragino Mincho ProN\', \'Yu Mincho\', \'Noto Serif JP\', serif" font-size="34" fill="{SEAL}" shape-rendering="geometricPrecision">式神</text>',
    f'<text x="{wx}" y="{wy + 92}" font-family="system-ui, -apple-system, \'Segoe UI\', sans-serif" font-size="18" fill="{TEXT_MUTED}" shape-rendering="geometricPrecision">Claude Code skills · watch your sub-agents work</text>',
    *sparkle(BW - 40, 34, 4), *sparkle(BW - 70, 160, 3),
    "</svg>",
]
(OUT / "banner.svg").write_text("\n".join(banner) + "\n")

# --- GitHub social preview (1280 × 640; keep content 40 px inside the edges) ---
SW, SH = 1280, 640
spx = 15
sx, sy = 110, (SH - doll_h * spx) / 2 - 12
swx, swy = 560, 196
sword, sword_w = wordmark("shikigami", swx, swy, 12, TEXT)
social = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SW} {SH}" width="{SW}" height="{SH}" shape-rendering="crispEdges">',
    defs(),
    f'<rect width="{SW}" height="{SH}" fill="url(#bg)"/>',
    *doll_group(sx, sy, spx),
    *sword,
    f'<text x="{swx}" y="{swy + 196}" font-family="\'Hiragino Mincho ProN\', \'Yu Mincho\', \'Noto Serif JP\', serif" font-size="72" fill="{SEAL}" shape-rendering="geometricPrecision">式神</text>',
    f'<text x="{swx}" y="{swy + 262}" font-family="system-ui, -apple-system, \'Segoe UI\', sans-serif" font-size="30" fill="{TEXT_MUTED}" shape-rendering="geometricPrecision">Claude Code skills · watch your sub-agents work</text>',
    *sparkle(SW - 90, 90, 8), *sparkle(SW - 170, 540, 6),
    "</svg>",
]
(OUT / "social.svg").write_text("\n".join(social) + "\n")
print("wrote", OUT / "logo.svg", OUT / "banner.svg", OUT / "social.svg", "wordmark widths", word_w, sword_w)

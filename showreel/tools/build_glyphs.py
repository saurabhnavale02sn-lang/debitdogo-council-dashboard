#!/usr/bin/env python3
"""Extract glyph outlines + kerning from the reel's fonts into JSON.

Roboto Flex is a variable font. Its gvar regions on the wght/wdth axes only
break at wght 100/400/700/1000 and wdth 25/100/151 (at opsz 144), so every
point is piecewise-bilinear in (wght, wdth) between those breakpoints.
Sampling those 12 masters and interpolating bilinearly in the browser
reproduces any intermediate instance exactly, which lets the renderer animate
weight and width per glyph, per frame, as real vector paths.

Output format (font units, y-up):
  { upm, asc, desc, cap, xh, axes: {wght: [...], wdth: [...]},
    glyphs: { ch: { c: "MLQZ...", a: [adv per master], p: [[x,y,...] per master] } },
    kern:   { "AV": [kern per master], ... } }
Masters are ordered wght-major: index = wi * len(wdth) + di.
"""
import io
import json
import os
import sys

import uharfbuzz as hb
from fontTools.pens.basePen import decomposeQuadraticSegment
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "assets", "fonts")
OUT = os.path.join(ROOT, "assets", "glyphs")

CHARSET = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    ".,:;!?-–—'’\"()/&@#%+×•·*_ "
)


def outline(glyphset, name):
    """Return (commands, flat coords) with quadratic runs split into Q segments."""
    pen = DecomposingRecordingPen(glyphset)
    glyphset[name].draw(pen)
    cmds, pts = [], []
    for op, args in pen.value:
        if op == "moveTo":
            cmds.append("M"); pts.extend(args[0])
        elif op == "lineTo":
            cmds.append("L"); pts.extend(args[0])
        elif op == "qCurveTo":
            if args[-1] is None:
                raise ValueError(f"all-off-curve contour in {name}")
            for off, on in decomposeQuadraticSegment(args):
                cmds.append("Q"); pts.extend(off); pts.extend(on)
        elif op == "curveTo":
            cmds.append("C")
            for p in args:
                pts.extend(p)
        elif op in ("closePath", "endPath"):
            cmds.append("Z")
        else:
            raise ValueError(f"unexpected pen op {op}")
    return "".join(cmds), [round(v, 2) for v in pts]


def hb_font(path, variations):
    # HarfBuzz cannot read WOFF2; hand it the decompressed sfnt bytes.
    ft = TTFont(path)
    ft.flavor = None
    buf = io.BytesIO()
    ft.save(buf)
    face = hb.Face(hb.Blob(buf.getvalue()))
    font = hb.Font(face)
    if variations:
        font.set_variations(variations)
    return font


def shape_adv(font, text):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": False})
    return [p.x_advance for p in buf.glyph_positions]


def build(path, out_name, masters, fixed=None):
    ft = TTFont(path)
    cmap = ft.getBestCmap()
    chars = [ch for ch in CHARSET if ord(ch) in cmap]
    missing = [ch for ch in CHARSET if ord(ch) not in cmap]
    if missing:
        print(f"  {out_name}: missing {missing!r}", file=sys.stderr)

    locs = [dict(fixed or {}, **m) for m in masters]
    glyphsets = [ft.getGlyphSet(location=loc) if loc else ft.getGlyphSet() for loc in locs]
    hbfonts = [hb_font(path, loc) for loc in locs]

    os2 = ft["OS/2"]
    data = {
        "upm": ft["head"].unitsPerEm,
        "asc": ft["hhea"].ascent,
        "desc": ft["hhea"].descent,
        "cap": getattr(os2, "sCapHeight", 0),
        "xh": getattr(os2, "sxHeight", 0),
        "glyphs": {},
        "kern": {},
    }

    for ch in chars:
        name = cmap[ord(ch)]
        per = [outline(gs, name) for gs in glyphsets]
        cmds = per[0][0]
        for c, _ in per[1:]:
            if c != cmds:
                raise ValueError(f"{out_name}: inconsistent outline structure for {ch!r}")
        advs = [round(gs[name].width, 2) for gs in glyphsets]
        data["glyphs"][ch] = {"c": cmds, "a": advs, "p": [p for _, p in per]}

    # Pair kerning (GPOS, variation-aware via HarfBuzz): kern = advance of the
    # first glyph inside the pair minus its advance alone.
    alone = [{ch: shape_adv(f, ch)[0] for ch in chars} for f in hbfonts]
    kchars = [ch for ch in chars if not ch.isspace()]
    for a in kchars:
        for b in kchars:
            ks = []
            for mi, f in enumerate(hbfonts):
                adv = shape_adv(f, a + b)
                ks.append(adv[0] - alone[mi][a] if len(adv) == 2 else 0)
            if any(abs(k) > 0.5 for k in ks):
                data["kern"][a + b] = [round(k, 1) for k in ks]

    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, out_name)
    with open(dst, "w") as fh:
        json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"  wrote {dst}: {len(data['glyphs'])} glyphs, {len(data['kern'])} kern pairs, "
          f"{os.path.getsize(dst) / 1024:.0f} KB")
    return data


def main():
    wght = [100, 400, 700, 1000]
    wdth = [25, 100, 151]
    flex = build(
        os.path.join(FONTS, "RobotoFlex-Variable.woff2"),
        "roboto-flex.json",
        [{"wght": w, "wdth": d} for w in wght for d in wdth],
        fixed={"opsz": 144},
    )
    flex["axes"] = {"wght": wght, "wdth": wdth}
    with open(os.path.join(OUT, "roboto-flex.json"), "w") as fh:
        json.dump(flex, fh, separators=(",", ":"), ensure_ascii=False)

    serif = build(os.path.join(FONTS, "InstrumentSerif-Italic.woff2"), "instrument-serif-italic.json", [{}])
    serif["axes"] = {}
    with open(os.path.join(OUT, "instrument-serif-italic.json"), "w") as fh:
        json.dump(serif, fh, separators=(",", ":"), ensure_ascii=False)


if __name__ == "__main__":
    main()

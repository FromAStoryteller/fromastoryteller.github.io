"""Rebuild common webfont subsets from the retained full fonts.
Install: python -m pip install -r scripts/font-subsets-requirements.txt
Run from the repository root: python scripts/build-font-subsets.py [--check]
Full fonts remain the fallback for every other supported character.
"""
import argparse
import io
import json
import re
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
RANGES = [(0x0000,0x00FF),(0x0100,0x0101),(0x0112,0x0113),
          (0x012A,0x012B),(0x014C,0x014D),(0x016A,0x016B),
          (0x0300,0x036F),(0x2000,0x206F),
          (0x20A0,0x20CF),(0x2190,0x2193),(0x2212,0x2212),
          (0x25B2,0x25B2),(0x25BC,0x25BC),(0x25C6,0x25C6),
          (0x2726,0x2726),(0xFEFF,0xFEFF),(0xFFFD,0xFFFD)]
COMMON = {c for first,last in RANGES for c in range(first,last+1)}
FILES = [
 "montecarlo/montecarlo-regular",
 "source-sans-3/source-sans-3-variable",
 "source-sans-3/source-sans-3-italic-variable",
 "literata/literata-variable",
 "literata/literata-italic-variable",
]
parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
css = (ROOT / "css/foundations.css").read_text(encoding="utf8")
faces = re.findall(r"@font-face\s*\{([^}]+)\}", css)
def declared_ranges(filename):
    face = next(f for f in faces if ('../assets/fonts/' + filename + '"') in f)
    raw = re.search(r"unicode-range:\s*([^;]+)", face).group(1)
    return [(int(a,16),int(z or a,16)) for a,z in
            re.findall(r"U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?", raw)]

for name in FILES:
    original = ROOT / "assets/fonts" / (name + ".woff2")
    output = ROOT / "assets/fonts" / (name + ".latin.woff2")
    source = TTFont(original, recalcTimestamp=False)
    font = TTFont(original, recalcTimestamp=False)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.glyph_names = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    worker = subset.Subsetter(options=options)
    requested = set(range(0x80)) if name.startswith("montecarlo/") else COMMON
    common_ranges = declared_ranges(name + ".latin.woff2")
    full_ranges = declared_ranges(name + ".woff2")
    cursor = 0
    for first,last in sorted(common_ranges + full_ranges):
        assert first == cursor, name + ": CSS ranges overlap or leave a gap"
        cursor = last + 1
    assert cursor == 0x110000, name + ": CSS fallback range is incomplete"
    for code in source.getBestCmap():
        in_common = any(first <= code <= last for first,last in common_ranges)
        assert in_common == (code in requested), (name, code, "CSS/subset mismatch")
    worker.populate(unicodes=requested)
    worker.subset(font)
    font.flavor = "woff2"
    data = io.BytesIO()
    font.save(data)
    data = data.getvalue()
    result = TTFont(io.BytesIO(data), recalcTimestamp=False)
    cmap, old = result.getBestCmap(), source.getBestCmap()
    assert set(cmap) == set(old) & requested, name + ": lost common character"
    for code, glyph in cmap.items():
        assert result["hmtx"].metrics[glyph] == source["hmtx"].metrics[old[code]], (name, code)
    if "fvar" in source:
        axes = lambda f: [(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in f["fvar"].axes]
        assert axes(result) == axes(source), name + ": changed variable axes"
    assert len(data) < original.stat().st_size
    if args.check:
        assert output.read_bytes() == data, name + ": stale subset; rebuild it"
    else:
        output.write_bytes(data)
    print("FONT_SUBSET " + json.dumps({"path":str(output.relative_to(ROOT)).replace("\\","/"),
          "original":original.stat().st_size,"bytes":len(data),"characters":len(cmap),
          "glyphs":len(result.getGlyphOrder())}))

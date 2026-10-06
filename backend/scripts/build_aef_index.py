"""Build the compact global AlphaEarth tile index shipped in app/data/aef_index.json.gz.

Needs pyarrow (dev only, not a runtime dependency). Source: the dataset's GeoParquet index
https://data.source.coop/tge-labs/aef/v1/annual/aef_index.parquet (78 MB, 302 466 files, 2017-2025, every UTM zone).

    python scripts/build_aef_index.py aef_index.parquet

Layout of the source. Every COG is 8192x8192 px at 10 m on one regular grid per UTM zone: eastings start at 8480 m,
northings at 0 m (zone 'N') or 5760 m (zone 'S', i.e. 10 000 000 m minus a whole number of cells), cell size 81 920 m.
A file is named `<hash>-<oy>-<ox>.tiff` where `<hash>` is shared by the (at most 2x2) cells exported together for one
year and zone, and oy / ox are the pixel offsets (0 or 8192) of the cell inside that export block.

Output (all cells of a year and zone as 2x2 blocks):
    {"v": 2, "grid": {"west0": 8480, "size": 81920, "south0": {"N": 0, "S": 5760}},
     "blocks": {"2024/43N": [[hash, cx0, cy0, mask], ...]}}
cx0, cy0 are the grid indices of the block origin; mask bit (dy * 2 + dx) says which of the four cells exist. The file name of
cell (cx0 + dx, cy0 + dy) is f"{hash}-{dy * 8192:010d}-{dx * 8192:010d}".
"""
import argparse
import gzip
import json
import re
from collections import defaultdict
from pathlib import Path

import pyarrow.parquet as pq

SIZE, WEST0, FILE_PX = 81920, 8480, 8192
SOUTH0 = {"N": 0, "S": 5760}
NAME = re.compile(r"/([0-9a-z]+)-(\d{10})-(\d{10})\.tiff$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("parquet")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "app" / "data" / "aef_index.json.gz"))
    a = ap.parse_args()
    cols = ["path", "year", "utm_zone", "utm_west", "utm_south"]
    t = pq.read_table(a.parquet, columns=cols).to_pydict()
    blocks: dict[str, dict[tuple, int]] = defaultdict(dict)
    n = 0
    for path, year, zone, west, south in zip(*(t[c] for c in cols)):
        m = NAME.search(path)
        oy, ox = int(m[2]) // FILE_PX, int(m[3]) // FILE_PX
        assert (west - WEST0) % SIZE == 0 and (south - SOUTH0[zone[-1]]) % SIZE == 0 and oy in (0, 1) and ox in (0, 1)
        cx, cy = int((west - WEST0) // SIZE), int((south - SOUTH0[zone[-1]]) // SIZE)
        origin = (m[1], cx - ox, cy - oy)
        blocks[f"{year}/{zone}"][origin] = blocks[f"{year}/{zone}"].get(origin, 0) | 1 << (oy * 2 + ox)
        n += 1
    doc = {"v": 2, "grid": {"west0": WEST0, "size": SIZE, "south0": SOUTH0},
           "blocks": {k: [[h, x, y, mask] for (h, x, y), mask in sorted(v.items(), key=lambda i: (i[0][2], i[0][1]))]
                      for k, v in sorted(blocks.items())}}
    Path(a.out).parent.mkdir(exist_ok=True)
    with gzip.open(a.out, "wt", compresslevel=9) as f:
        json.dump(doc, f, separators=(",", ":"))
    print(n, "files in", sum(len(v) for v in doc["blocks"].values()), "blocks ->", a.out, Path(a.out).stat().st_size, "bytes")


if __name__ == "__main__":
    main()

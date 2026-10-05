"""Build the compact AlphaEarth tile index shipped in app/data/aef_index.json.gz.

Needs pyarrow (dev only, not a runtime dependency). Source: the dataset's GeoParquet index
https://data.source.coop/tge-labs/aef/v1/annual/aef_index.parquet (78 MB).

    python scripts/build_aef_index.py aef_index.parquet --zones 42N-47N --max-northing 4400000
"""
import argparse
import gzip
import json
import re
from pathlib import Path

import pyarrow.parquet as pq

GRID_SIZE, WEST0 = 81920, 8480  # every AEF file is 8192 px at 10 m on one regular UTM grid


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("parquet")
    ap.add_argument("--zones", default="42N-47N")
    ap.add_argument("--max-northing", type=float, default=4400000)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "app" / "data" / "aef_index.json.gz"))
    a = ap.parse_args()
    lo, hi = (int(v) for v in re.findall(r"\d+", a.zones))
    hemi = a.zones[-1]
    wanted = {f"{n}{hemi}" for n in range(lo, hi + 1)}
    cols = ["path", "year", "utm_zone", "utm_west", "utm_south"]
    t = pq.read_table(a.parquet, columns=cols).to_pydict()
    files: dict[str, dict[str, str]] = {}
    for path, year, zone, west, south in zip(*(t[c] for c in cols)):
        if zone not in wanted or south >= a.max_northing:
            continue
        assert (west - WEST0) % GRID_SIZE == 0 and south % GRID_SIZE == 0
        key = f"{year}/{zone}"
        cell = f"{int((west - WEST0) // GRID_SIZE)},{int(south // GRID_SIZE)}"
        files.setdefault(key, {})[cell] = path.rsplit("/", 1)[1].removesuffix(".tiff")
    doc = {"grid": {"west0": WEST0, "size": GRID_SIZE}, "files": files}
    Path(a.out).parent.mkdir(exist_ok=True)
    with gzip.open(a.out, "wt") as f:
        json.dump(doc, f, separators=(",", ":"))
    print(sum(len(v) for v in files.values()), "files ->", a.out, Path(a.out).stat().st_size, "bytes")


if __name__ == "__main__":
    main()

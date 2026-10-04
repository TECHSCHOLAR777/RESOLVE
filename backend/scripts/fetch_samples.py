"""Fetch 4-band (B4 B3 B2 B8) 10 m Sentinel-2 L2A crops over India from Planetary Computer.

Run from backend/:  .venv/Scripts/python scripts/fetch_samples.py

Stored convention: float32 surface reflectance (0..1), band order B4 B3 B2 B8.
The L2A offset (-1000 DN) is applied here when the processing baseline is >= 04.00,
then values are divided by 10 000 and clipped at 0. The main pipeline therefore sees
plain reflectance and applies no further scaling.
"""
import json
from pathlib import Path

import numpy as np
import planetary_computer
import pystac_client
import rasterio
from rasterio.warp import transform as warp_transform
from rasterio.windows import Window

OUT = Path(__file__).resolve().parents[1] / "samples"
SIZE = 256
BANDS = ["B04", "B03", "B02", "B08"]

SAMPLES = [
    dict(id="punjab-farmland", name="Punjab farmland", location="Near Ludhiana, Punjab",
         lat=30.80, lon=75.75, dates="2025-02-01/2025-03-31"),
    dict(id="delhi-city", name="Delhi urban", location="Central Delhi",
         lat=28.62, lon=77.21, dates="2025-01-01/2025-03-31"),
    dict(id="brahmaputra-assam", name="Brahmaputra floodplain", location="Near Majuli, Assam",
         lat=26.95, lon=94.20, dates="2025-01-01/2025-03-31"),
    dict(id="sikkim-hills", name="Sikkim hills", location="Near Gangtok, Sikkim",
         lat=27.33, lon=88.61, dates="2024-11-01/2025-03-31"),
]


def baseline_at_least_4(baseline: str) -> bool:
    return float(baseline) >= 4.0


def fetch(s: dict, catalog) -> dict:
    items = catalog.search(
        collections=["sentinel-2-l2a"], intersects={"type": "Point", "coordinates": [s["lon"], s["lat"]]},
        datetime=s["dates"], query={"eo:cloud_cover": {"lt": 5}},
    ).item_collection()
    for item in sorted(items, key=lambda i: i.properties["eo:cloud_cover"]):
        stack = []
        for b in BANDS:
            with rasterio.open(item.assets[b].href) as src:
                x, y = warp_transform("EPSG:4326", src.crs, [s["lon"]], [s["lat"]])
                row, col = src.index(x[0], y[0])
                win = Window(col - SIZE // 2, row - SIZE // 2, SIZE, SIZE)
                stack.append(src.read(1, window=win, boundless=False))
                transform, crs = src.window_transform(win), src.crs
        dn = np.stack(stack).astype("float32")
        if (dn == 0).mean() > 0.01:  # nodata edge of the tile
            continue
        baseline = item.properties["s2:processing_baseline"]
        offset = 1000 if baseline_at_least_4(baseline) else 0
        refl = np.clip(dn - offset, 0, None) / 10000.0
        with rasterio.open(OUT / f"{s['id']}.tif", "w", driver="GTiff", count=4, width=SIZE, height=SIZE,
                           dtype="float32", crs=crs, transform=transform, compress="deflate",
                           predictor=3) as dst:
            dst.write(refl.astype("float32"))
            dst.update_tags(band_order="B4,B3,B2,B8", processing_baseline=baseline,
                         reflectance_offset_applied=str(offset), source_item=item.id)
            for i, b in enumerate(["B4", "B3", "B2", "B8"], 1):
                dst.set_band_description(i, b)
        print(s["id"], item.id, item.datetime.date(), item.properties["eo:cloud_cover"], baseline)
        return dict(id=s["id"], name=s["name"], location=s["location"], date=str(item.datetime.date()),
                    width=SIZE, height=SIZE, source_item=item.id, processing_baseline=baseline,
                    offset_applied_dn=offset, stored_as="float32 reflectance 0-1 (offset removed, /10000)")
    raise RuntimeError(f"no usable scene for {s['id']}")


def main():
    OUT.mkdir(exist_ok=True)
    catalog = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1",
                                        modifier=planetary_computer.sign_inplace)
    index = [fetch(s, catalog) for s in SAMPLES]
    (OUT / "samples.json").write_text(json.dumps(index, indent=2))


if __name__ == "__main__":
    main()

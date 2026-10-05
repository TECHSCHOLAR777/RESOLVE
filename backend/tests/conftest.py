import os

# Keep the suite fast and offline by default; individual tests switch these back on.
os.environ.setdefault("RESOLVE_ALPHAEARTH", "0")
os.environ.setdefault("RESOLVE_TTA", "2")

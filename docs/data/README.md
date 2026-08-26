# Real query-tool data

The three real tools (Explore, Compare, Signature Search) load a versioned static
dataset. This folder holds only small fixtures committed to Git:

- `meta.json` — dataset version, counts, definitions, validation metrics (`is_demo:false`)
- `catalog.json` — selectors: cell lines, drugs, doses, organs

The large derived files (`conditions.json`, `explore/`, `profiles/`, `sig/`) are
**not** committed. Host them on Hugging Face and point the site at them via
`assets/config.js` (`window.TAHOE_DATA_BASE`) — see `UPLOAD_DERIVED_DATA.md` and
`DEPLOYMENT.md`. For local testing, build/copy the full `data/` here and open a
page with `?data=./data/`.

The legacy illustrative widget's demo data lives under `demo/` (kept separate; the
real tools never read it).

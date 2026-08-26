# Deployment — Tahoe-100M real query tools

The three query tools (Explore, Compare, Signature Search) are a **fully static**
site. There is no server, database, or paid API. All computation runs in the
browser over a versioned static dataset.

## Architecture

```
GitHub Pages (docs/)            Derived data (data/)             Hugging Face (optional)
─────────────────────          ────────────────────             ───────────────────────
index.html, *.html             meta.json, catalog.json          large files hosted here:
assets/*.css, *.js       ─────► conditions.json                 - sig/post_cond.i32
config.js (data base URL)       explore/drug/*.json              - sig/post_w.f32
                                explore/cell/*.json              - profiles/*.json
                                profiles/*.json                  - conditions.json
                                sig/genes.json + *.i32/*.f32
```

- **Small selector JSON** (`meta.json`, `catalog.json`, `explore/…`) can live next
  to the site under `docs/data/`.
- **Large derived files** (the signature inverted index `sig/*.i32|*.f32`, the
  per-condition `profiles/*.json`, and `conditions.json`) are **not** committed to
  Git. Host them on Hugging Face (or any static host / CDN / object store) and point
  the site at them.

## Configure the data base URL

Resolution order (see `docs/assets/data.js`):

1. `?data=<url>` query parameter (handy for testing a staging dataset)
2. `localStorage['tahoe_data_base']`
3. `window.TAHOE_DATA_BASE` set in `docs/assets/config.js`
4. `./data/` (co-located)

For production with Hugging Face, edit `docs/assets/config.js`:

```js
window.TAHOE_DATA_BASE =
  "https://huggingface.co/datasets/<user>/tahoe100m-query-tools/resolve/main/data/";
```

## GitHub Pages

1. Commit `docs/` on the deployment branch.
2. In repo Settings → Pages, set source to the branch and `/docs` folder.
3. Ensure `docs/.nojekyll` is present (it is) so `assets/` is served verbatim.
4. Upload the derived `data/` to Hugging Face (see `UPLOAD_DERIVED_DATA.md`) and set
   the base URL, **or** copy a `data/` folder into `docs/data/` for a self-contained
   deploy (watch the repo size — the index is tens of MB).

## Local testing

```bash
# serve the site + a local copy of the data
cd docs
python3 -m http.server 8000
# open http://localhost:8000/explore.html?data=./data/
```

Or point at any served data folder with `?data=http://localhost:9000/data/`.

## Performance targets (met)

- First interaction on Explore/Compare loads only small JSON (< ~1 MB).
- Signature Search lazily loads the binary index once (tens of MB), then every
  query scores all ~65k conditions client-side in well under 1 second.
- No file explosion: one binary index + a few hundred profile shards, not tens of
  thousands of per-gene files.

## Data realness

All three tools display real results only (`meta.json → is_demo: false`). Missing
combinations render an explicit **Not computed** state. The legacy illustrative
widget on the landing page is clearly separated and never mixed with real results.

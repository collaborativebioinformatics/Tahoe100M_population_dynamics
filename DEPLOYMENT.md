# Deployment — Tahoe-100M real query tools

The three query tools (Explore, Compare, Signature Search) are a **fully static**
site. There is no application server, database, or paid API. All computation runs
in the browser over a versioned static dataset.

## Architecture

```
GitHub Pages (docs/)          Compressed data (docs/data/)              Optional mirror
─────────────────────        ────────────────────────────              ───────────────
index.html, *.html           meta.json, catalog.json                   the same paths on
assets/*.css, *.js     ─────► conditions.json.gz                      Hugging Face or any
config.js                    explore/**/*.json.gz                     CORS-enabled static
                              profiles/*.json.gz                       object host
                              sig/genes.json.gz + two compact .bin files
```

- Small provenance and selector JSON remains human-readable.
- Large JSON is committed only in individually gzipped form and loaded lazily.
- The two signature arrays are already compact 16-bit binary files.
- An external mirror remains optional; set `window.TAHOE_DATA_BASE` to use one.

## Configure the data base URL

Resolution order (see `docs/assets/data.js`):

1. `?data=<url>` query parameter (handy for testing a staging dataset)
2. `localStorage['tahoe_data_base']`
3. `window.TAHOE_DATA_BASE` set in `docs/assets/config.js`
4. `./data/` (co-located)

For an optional Hugging Face mirror, edit `docs/assets/config.js`:

```js
window.TAHOE_DATA_BASE =
  "https://huggingface.co/datasets/<user>/tahoe100m-query-tools/resolve/main/data/";
```

## GitHub Pages

1. Commit `docs/`, including the compressed data shards, on the deployment branch.
2. The repository's Pages workflow publishes `docs/` from `main`.
3. Keep `docs/.nojekyll` so binary and compressed assets are served verbatim.
4. The deployed query dataset is about 154 MB and the full site remains below the
   GitHub Pages 1 GB published-site limit. A mirror can be configured later.

## Local testing

```bash
# serve the site and its compressed data
cd docs
python3 -m http.server 8000
# open http://localhost:8000/explore.html
```

Or point at an uncompressed HPC export or mirror with `?data=<base-url>`; the
loader first tries `.json.gz` and falls back to `.json`.

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

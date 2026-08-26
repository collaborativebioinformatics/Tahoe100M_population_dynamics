# Real query-tool data

The three real tools (Explore, Compare, Signature Search) load a versioned static
dataset. The production GitHub Pages package contains:

- `meta.json` — dataset version, counts, definitions, validation metrics (`is_demo:false`)
- `catalog.json` — selectors: cell lines, drugs, doses, organs
- `conditions.json.gz` — compact metadata for all 65,218 conditions
- `explore/**/*.json.gz` — per-drug and per-cell-line response rankings
- `profiles/*.json.gz` — 128 lazy-loaded top-gene profile shards
- `sig/genes.json.gz`, `post_cond.bin`, `post_w.bin` — signature/reversal index

The raw 386 MB JSON export is never committed. Each large JSON object is stored
as `.json.gz`, reducing the deployed query dataset to about 154 MB while keeping
all computation static and browser-side. `assets/data.js` can also read the
original uncompressed HPC release or a separately hosted mirror.

The legacy illustrative widget's demo data lives under `demo/` (kept separate; the
real tools never read it).

## Provenance and integrity

- Source HPC archive SHA-256: `ee3826ae979dea06a1a663001c1c234e83d12ecb383ecf56f8f8d1e963523dec`
- `real_query_manifest.sha256` records every compressed JSON shard and binary
  index file deployed with the site.
- The source release declares `is_demo: false`; no raw single-cell matrix or
  credentials are included in this browser package.

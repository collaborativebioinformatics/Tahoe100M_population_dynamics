# Tahoe-100M Atlas — static site & public data package

Static website with no application server or database, built from a validated,
read-only atlas run. GitHub Pages serves the UI, compressed browser indexes, and a
curated set of derived tables. Cloudflare Web Analytics is the only optional external
script; analysis functions remain usable if it is blocked.

## Pages
- `index.html` — overview & key stats
- `ranking.html` — drug × cell-line response ranking + heatmap
- `compare.html` — side-by-side comparison of two conditions (shared genes/pathways, signature distance)
- `search.html` — gene-signature search over the validated top-DE
- `downloads.html` — validated Parquet/CSV tables with SHA-256

## Data layout (`data/`)
- `catalog.json`, `site_stats.json` — dropdown catalog & landing stats
- `ranking.json`, `drug_cellline_ranking.parquet/csv`
- `compare/<cell_line>.json.gz` — per-condition genes/pathways/embedding (one compressed shard per cell line)
- `search/conditions.json.gz`, `gene_list.json`, `search/buckets/b*.json.gz` — compressed bucketed inverted index
- `downloads/` — curated validated tables with SHA-256 checksums
- `METHODS.md`, `LIMITATIONS.md`, `DATA_DICTIONARY.md`

## Provenance & integrity
Every reused source table was verified by SHA-256 against the source run's
`release_manifest.json` before the site build. The transferred site archive was then
verified independently with SHA-256
`f709360677d8ffaf1ea88dff347c115a573b17f255aef6edd6b27e5b7f55f264`.
All records carry `is_demo: false`; release metadata live in `data/release.json`.

## Key limits (see LIMITATIONS.md)
Response = truncated top-N log2FC magnitude (not full transcriptome). No single-cell
expression was used. Multi-dose curves are assembled across plate triplets; the DMSO
origin is synthetic. Signature search operates on truncated DE, requires at least three
observed query genes, and reports matches and reversals as exploratory scores rather
than significance tests.

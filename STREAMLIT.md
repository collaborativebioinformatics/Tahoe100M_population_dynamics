# Streamlit app & Argon pipeline — Tahoe-100M Explorer

This document covers the **Streamlit** strand of the Tahoe-100M Explorer: a
no-code web app that opens the [**Tahoe-100M**](https://huggingface.co/datasets/tahoebio/Tahoe-100M)
single-cell drug-perturbation atlas to biologists, plus the Argon (SGE) pipeline
that builds the compact tables it reads. The public GitHub Pages prototype is
described in the main [README](README.md); this file is the companion for running
the Streamlit app and regenerating its data.

> Browse the screen by drug or cell line, launch a statistical view for a chosen
> condition, and show linked metadata.

**Focus question:** can we identify residual subpopulations that may be
non-responders? The UI surfaces per-condition DE summaries as a first step
toward that question.

---

## Project purpose

Tahoe-100M is huge (~100 million single cells; ~50 cancer cell lines × ~379
drugs × 3–4 doses, profiled by single-cell RNA-seq). The raw data and even the
precomputed differential-expression (DE) tables (~89 GB) are far too big for a
biologist to open and explore. **This app opens the screen to non-coders**: pick
a drug or a cell line and immediately see how many genes changed, which
direction, how strong the effect was, and the drug/cell-line metadata behind it
— all served from small precomputed tables, with no data download required by
the end user.

## Public-interface goals

1. **Explore** — browse by drug or cell line; filter by dose and plate; plot
   significant-DEG counts, up- vs down-regulation, top DE genes, dose response,
   and replicate-plate concordance (6 vs 14).
2. **Statistical analysis** — pick drug × cell line × dose × plate, press *Run*,
   and read effect sizes, p-values, adjusted p-values, significant-gene counts,
   and the uncertainty (`lfcSE`) — clearly labelled as precomputed **pseudobulk**
   DE statistics.
3. **Metadata** — drug targets / mechanism / PubChem, cell-line
   Cellosaurus & DepMap identifiers, dose, plate, sample provenance, with
   clickable external links and a link to the source dataset.

## Architecture

```
                Hugging Face: tahoebio/Tahoe-100M
                          │  (Argon preprocessing, offline)
   pseudobulk DE (~89 GB, 1026 parquet shards)   metadata (parquet)
                          │  DuckDB: filter plates 6 & 14, aggregate
                          ▼
   web_data/                          ← compact, ZSTD parquet (a few MB)
     condition_summary.parquet          one row per plate×cell×drug×dose
     top_de_genes.parquet               top-25 up / top-25 down per condition
     {drug,cell_line,sample,gene}_metadata.parquet
                          │  TAHOE_WEB_DATA_DIR
                          ▼
   streamlit_app.py + app/{data_loader,plots,statistics}.py   ← the public UI
```

- `pipeline/build_web_tables.py` — DuckDB job that turns the 89 GB DE directory
  into the compact `web_data/` tables (streaming, spills to disk, memory-capped).
- `app/` — Streamlit-agnostic data access, Plotly figures, and per-condition
  statistics (unit-tested).
- `streamlit_app.py` — the three-tab UI; reads only the compact tables.
- `data/demo/` — a tiny committed sample (8 conditions) so the app runs with
  **no download**.

## Local run

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Option A — demo mode (nothing to download):
streamlit run streamlit_app.py

# Option B — full MVP data built on Argon:
export TAHOE_WEB_DATA_DIR=/path/to/web_data
streamlit run streamlit_app.py
```

Run the tests with `pytest`.

## Argon preprocessing (SGE / qsub)

Argon uses **SGE**, not Slurm. Large data lives on `/nfsscratch`
(`$TAHOE_ROOT`); the code repo and the Python venv live in `$HOME` (scratch NFS
is too slow for many-small-file operations like venvs and git). Adjust the paths
at the top of each script, then:

```bash
# 1. smoke test (downloads 6 small files, prints sizes + schemas)
qsub pipeline/qsub/tahoe_smoke.sh

# 2. full pseudobulk DE download (~89 GB, resumable)
qsub pipeline/qsub/tahoe_download_de.sh

# 3. build the compact web tables for plates 6 & 14 (after the download)
qsub -hold_jid TahoeDownloadDE pipeline/qsub/tahoe_build_webdata.sh
```

The build writes `condition_summary.parquet` and `top_de_genes.parquet` into
`$TAHOE_ROOT/web_data` and copies the four small metadata tables alongside them.
Point `TAHOE_WEB_DATA_DIR` at that directory.

> **pyarrow is pinned to `<17`** in `requirements.txt`: pyarrow ≥17 wheels
> require glibc 2.28, but Argon (CentOS 7) has glibc 2.17.

## Streamlit Community Cloud deployment

1. Push this branch and open it on <https://share.streamlit.io>.
2. Main file: `streamlit_app.py`; Python deps: `requirements.txt`.
3. The app runs in **demo mode** out of the box (the demo data is committed).
   To serve the full plates-6/14 tables, upload `condition_summary.parquet`,
   `top_de_genes.parquet` and the metadata tables into `data/demo/` (they stay
   well under the file-size limit) or attach external storage and set
   `TAHOE_WEB_DATA_DIR`.

## Data provenance

- **Source:** `tahoebio/Tahoe-100M` on Hugging Face (single-cell RNA-seq drug
  perturbation atlas; Ultima Genomics profiling; DMSO controls per plate).
- **What this app uses:** the precomputed `pseudobulk_differential_expression`
  tables (DESeq2-style per condition) and the drug / cell-line / sample / gene
  metadata tables — **not** the 100M-cell expression matrix.
- **Identifiers:** cell lines carry Cellosaurus and DepMap IDs; drugs carry
  PubChem CIDs — all linked out from the Metadata tab.

## Scientific limitations

- Statistics are **pseudobulk**: each condition is collapsed to aggregated
  counts before testing. **Individual cells are not independent biological
  replicates** and are never treated as such here.
- Cells were grown as **5-cell-line spheroid co-cultures** in RPMI + bovine
  serum — non-physiological, with possible cross-line crosstalk.
- Cell-line genotypes shown come from **public annotation** (DepMap/ATCC), not
  from sequencing the exact cells in each well.
- The MVP covers **plates 6 and 14 only**; absolute counts depend on the
  significance threshold (padj ≤ 0.05) and the DESeq2 pipeline upstream.

## Current MVP scope

Replicate **plates 6 and 14** (same 95-drug panel, each with DMSO controls),
chosen so results can be checked for reproducibility across the two plates. The
pipeline generalises to all 14 plates by changing `--plates` in
`build_web_tables.py`.

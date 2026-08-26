# Uploading the derived data (Hugging Face)

The large derived files are **not** committed to Git. They are produced by the
Argon pipeline into `web_release/data/` and should be hosted on a static host.
This guide uses a Hugging Face **dataset** repo. (This document does not upload
anything and stores no credentials — run the steps yourself when ready.)

## What to upload

Everything under `web_release/data/`:

```
data/
  meta.json                 # version, counts, definitions, validation metrics
  catalog.json              # selectors (cell lines, drugs, doses, organs)
  conditions.json           # compact per-condition metadata (by cond_idx)
  explore/drug/*.json       # per-drug cell-line rankings
  explore/cell/*.json       # per-cell-line drug rankings
  profiles/*.json           # per-condition top up/down genes (sharded)
  profiles/_index.json
  sig/genes.json            # gene -> [col, df, idf, start, count] + ensembl alias
  sig/post_cond.i32         # Int32 condition ids (concatenated postings)
  sig/post_w.f32            # Float32 signed IDF-weighted normalized weights
```

## Steps

```bash
# 1. Install the CLI (user space; do NOT install system-wide on Argon)
pip install --user huggingface_hub

# 2. Log in interactively (paste a WRITE token). In this Claude Code session you
#    can run it inline so the prompt appears here:
#    ! huggingface-cli login
huggingface-cli login

# 3. Create the dataset repo (once)
huggingface-cli repo create tahoe100m-query-tools --type dataset

# 4. Upload the data folder
huggingface-cli upload <user>/tahoe100m-query-tools \
    web_release/data /data --repo-type dataset
```

The files are then served from:

```
https://huggingface.co/datasets/<user>/tahoe100m-query-tools/resolve/main/data/
```

Put that URL in `docs/assets/config.js` (`window.TAHOE_DATA_BASE`).

## Notes

- Hugging Face static resolve URLs support HTTP range and CORS, so the browser
  can fetch the binary index and JSON shards directly.
- Re-uploading with a new `meta.json → data_version` cleanly versions the dataset;
  keep the site and data versions in step.
- The raw Tahoe-100M DE tables (63 GB) are **not** part of this upload — only the
  compact derived index is.

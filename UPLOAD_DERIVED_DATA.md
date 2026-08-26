# Optional derived-data mirror (Hugging Face)

The production GitHub Pages release includes compressed static query data, so a
separate host is not required. A Hugging Face **dataset** repo can optionally be
used as a mirror when traffic or future releases outgrow GitHub Pages. This guide
does not upload anything or store credentials.

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
  sig/post_cond.bin         # Uint16 condition ids (concatenated postings)
  sig/post_w.bin            # quantized Int16 signed weights
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

- The browser loader accepts either the original `.json` export or the compressed
  `.json.gz` Pages layout.
- Re-uploading with a new `meta.json → data_version` cleanly versions the dataset;
  keep the site and data versions in step.
- The raw Tahoe-100M DE tables (63 GB) are **not** part of this upload — only the
  compact derived index is.

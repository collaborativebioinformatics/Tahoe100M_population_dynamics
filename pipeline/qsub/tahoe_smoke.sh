#!/bin/bash -l
#$ -N TahoeSmoke
#$ -cwd
#$ -V
#$ -M xwu76@uiowa.edu
#$ -m beas
#$ -j Y
#$ -pe smp 4
#$ -l h_vmem=8G
#$ -l h_rt=04:0:0
# ---------------------------------------------------------------------------
# Smoke test: download the 6 smallest Tahoe-100M files, print their sizes, and
# print their PyArrow schemas. Validates the venv, network, and data layout
# before committing to the ~89 GB DE download.
# ---------------------------------------------------------------------------
set -euo pipefail

TAHOE_ROOT="/nfsscratch/Users/xwu76/tahoe100m"
VENV="/Users/xwu76/tahoe100m_venv"          # venv lives in home (scratch NFS is
                                            # too slow for many-small-file envs)
export HF_HOME="$TAHOE_ROOT/hf_cache"
export HF_HUB_DOWNLOAD_TIMEOUT=60

source "$VENV/bin/activate"
echo "host=$(hostname)  python=$(python --version 2>&1)  $(date)"

FILES=(
  "metadata/sample_metadata.parquet"
  "metadata/gene_metadata.parquet"
  "metadata/drug_metadata.parquet"
  "metadata/cell_line_metadata.parquet"
  "metadata/pseudobulk_differential_expression/train-00000-of-01026.parquet"
  "data/train-00000-of-03388.parquet"
)

echo "=== downloading ${#FILES[@]} files -> $TAHOE_ROOT/source ==="
hf download tahoebio/Tahoe-100M --repo-type dataset \
  "${FILES[@]}" \
  --local-dir "$TAHOE_ROOT/source" \
  --max-workers 4

echo "=== sizes ==="
for f in "${FILES[@]}"; do
  p="$TAHOE_ROOT/source/$f"
  [ -f "$p" ] && du -h "$p" || echo "MISSING $p"
done

echo "=== schemas (PyArrow) ==="
python - "$TAHOE_ROOT/source" "${FILES[@]}" <<'PY'
import sys, os, pyarrow.parquet as pq
root, files = sys.argv[1], sys.argv[2:]
for f in files:
    p = os.path.join(root, f)
    print(f"\n--- {f} ---")
    md = pq.ParquetFile(p).metadata
    print(f"rows={md.num_rows:,} cols={md.num_columns}")
    print(pq.ParquetFile(p).schema_arrow)
PY

echo "=== smoke test OK $(date) ==="

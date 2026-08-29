#!/bin/bash -l
#$ -N TahoeDownloadDE
#$ -cwd
#$ -V
#$ -M xwu76@uiowa.edu
#$ -m beas
#$ -j Y
#$ -pe smp 4
#$ -l h_vmem=8G
#$ -l h_rt=48:0:0
# ---------------------------------------------------------------------------
# Download the complete pseudobulk differential-expression directory
# (metadata/pseudobulk_differential_expression/*.parquet, ~89 GB, 1026 shards)
# into $TAHOE_ROOT/source. Resumable: hf download skips files already present
# with a matching size, so re-submitting continues where it left off.
# ---------------------------------------------------------------------------
set -euo pipefail

TAHOE_ROOT="/nfsscratch/Users/xwu76/tahoe100m"
VENV="/Users/xwu76/tahoe100m_venv"
export HF_HOME="$TAHOE_ROOT/hf_cache"
export HF_HUB_DOWNLOAD_TIMEOUT=60

source "$VENV/bin/activate"
echo "host=$(hostname)  $(date)"
echo "free space on scratch:"; df -h "$TAHOE_ROOT" | tail -1

echo "=== downloading full pseudobulk DE directory (resumable) ==="
hf download tahoebio/Tahoe-100M --repo-type dataset \
  --include "metadata/pseudobulk_differential_expression/*.parquet" \
  --local-dir "$TAHOE_ROOT/source" \
  --max-workers 4

N=$(find "$TAHOE_ROOT/source/metadata/pseudobulk_differential_expression" \
      -name '*.parquet' | wc -l)
echo "=== done: $N shard(s) present  $(date) ==="
du -sh "$TAHOE_ROOT/source/metadata/pseudobulk_differential_expression"

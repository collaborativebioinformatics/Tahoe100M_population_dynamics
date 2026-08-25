#!/bin/bash -l
#$ -N TahoeWebData
#$ -cwd
#$ -V
#$ -M xwu76@uiowa.edu
#$ -m beas
#$ -j Y
#$ -pe smp 8
#$ -l h_vmem=8G
#$ -l h_rt=48:0:0
# ---------------------------------------------------------------------------
# Build the compact web tables (plates 6 & 14) from the full pseudobulk DE
# directory using DuckDB, then copy the four small metadata tables into
# web_data. DuckDB is capped to a conservative memory limit and spills to
# $TAHOE_ROOT/tmp/duckdb so it never blows past the job's RAM.
#
# Submit AFTER the DE download completes, e.g.:
#   qsub -hold_jid TahoeDownloadDE pipeline/qsub/tahoe_build_webdata.sh
# ---------------------------------------------------------------------------
set -euo pipefail

TAHOE_ROOT="/nfsscratch/Users/xwu76/tahoe100m"
VENV="/Users/xwu76/tahoe100m_venv"
REPO="/Users/xwu76/tahoe100m_repo"
DE_DIR="$TAHOE_ROOT/source/metadata/pseudobulk_differential_expression"
OUT="$TAHOE_ROOT/web_data"
export HF_HOME="$TAHOE_ROOT/hf_cache"

source "$VENV/bin/activate"
echo "host=$(hostname)  $(date)"
mkdir -p "$OUT" "$TAHOE_ROOT/tmp/duckdb"

echo "=== building condition_summary + top_de_genes (plates 6,14) ==="
python "$REPO/pipeline/build_web_tables.py" \
  --source "$DE_DIR" \
  --out "$OUT" \
  --plates 6,14 \
  --top-n 25 \
  --threads 8 \
  --mem 6GB \
  --tmp "$TAHOE_ROOT/tmp/duckdb"

echo "=== copying the 4 small metadata tables into web_data ==="
for m in sample_metadata gene_metadata drug_metadata cell_line_metadata; do
  src="$TAHOE_ROOT/source/metadata/$m.parquet"
  [ -f "$src" ] && cp -f "$src" "$OUT/$m.parquet" && echo "copied $m" \
    || echo "WARN: missing $src (run smoke/download first)"
done

echo "=== web_data contents ==="
ls -lh "$OUT"
echo "=== build OK $(date) ==="

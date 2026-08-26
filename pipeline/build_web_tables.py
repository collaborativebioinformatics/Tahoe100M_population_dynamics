#!/usr/bin/env python3
"""Build compact web tables for the Tahoe-100M public UI from the pseudobulk
differential-expression (DE) Parquet shards.

The full DE dataset is ~4.1 billion rows (~89 GB) — one row per
(plate x cell line x drug x concentration x gene). This script uses DuckDB to
stream every shard, keep only the replicate plates of interest (6 and 14 by
default), and emit two small ZSTD-compressed Parquet tables that the Streamlit
app can query instantly:

  condition_summary.parquet
      one row per (plate, cell line, drug, concentration) with DE count summaries

  top_de_genes.parquet
      the top-N significant up- and down-regulated genes per condition

Nothing here loads the 100M-cell expression matrix; it operates purely on the
precomputed pseudobulk DE statistics.

Example (Argon build, plates 6 & 14):
    python pipeline/build_web_tables.py \
        --source "$TAHOE_ROOT/source/metadata/pseudobulk_differential_expression" \
        --out    "$TAHOE_ROOT/web_data" \
        --plates 6,14 --threads 8 --mem 6GB --tmp "$TAHOE_ROOT/tmp/duckdb"

Example (tiny committed demo from a single shard):
    python pipeline/build_web_tables.py \
        --source "$TAHOE_ROOT/source/metadata/pseudobulk_differential_expression" \
        --out data/demo --plates 1 --max-conditions 8 --threads 2 --mem 2GB
"""
from __future__ import annotations

import argparse
import glob
import os
import sys

import duckdb

SIG_PADJ = 0.05  # significance threshold used throughout the app


def parse_args(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--source", required=True,
                   help="directory containing pseudobulk DE *.parquet shards")
    p.add_argument("--out", required=True, help="output directory for web tables")
    p.add_argument("--plates", default="6,14",
                   help="comma-separated plate ids to keep (default: 6,14)")
    p.add_argument("--top-n", type=int, default=25,
                   help="top N up and N down genes per condition (default: 25)")
    p.add_argument("--sig-padj", type=float, default=SIG_PADJ,
                   help="adjusted p-value significance cutoff (default: 0.05)")
    p.add_argument("--max-conditions", type=int, default=0,
                   help="cap number of conditions (0 = no cap; used for the demo)")
    p.add_argument("--threads", type=int, default=8)
    p.add_argument("--mem", default="6GB", help="DuckDB memory_limit (default: 6GB)")
    p.add_argument("--tmp", default=None, help="DuckDB spill directory")
    return p.parse_args(argv)


def connect(threads: int, mem: str, tmp: str | None) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute(f"PRAGMA threads={int(threads)}")
    con.execute(f"SET memory_limit='{mem}'")
    con.execute("SET preserve_insertion_order=false")
    if tmp:
        os.makedirs(tmp, exist_ok=True)
        con.execute(f"SET temp_directory='{tmp}'")
    return con


def main(argv=None) -> int:
    args = parse_args(argv)

    shards = sorted(glob.glob(os.path.join(args.source, "*.parquet")))
    if not shards:
        sys.exit(f"ERROR: no .parquet shards found under {args.source}")
    plates = [s.strip() for s in args.plates.split(",") if s.strip()]
    os.makedirs(args.out, exist_ok=True)
    print(f"[build] {len(shards)} shard(s); plates={plates}; top_n={args.top_n}; "
          f"sig padj<={args.sig_padj}", flush=True)

    con = connect(args.threads, args.mem, args.tmp)

    # Read via a directory glob (NOT a 1026-element file list with
    # union_by_name): union_by_name unifies schemas across every file upfront
    # and, with a long list, spikes memory to tens of GB during the scan. All
    # shards share one schema, so a plain glob streams file-by-file with bounded
    # reader buffers. The plate filter is pushed down.
    plate_list = ", ".join(f"'{p}'" for p in plates)
    source_glob = os.path.join(args.source, "*.parquet").replace("'", "''")
    con.execute(
        f"""
        CREATE OR REPLACE VIEW de AS
        SELECT * FROM read_parquet('{source_glob}')
        WHERE plate IN ({plate_list})
        """
    )

    # Optionally restrict to the first N conditions (keeps the demo tiny and
    # deterministic — ordered by identifiers, not by any random sample).
    if args.max_conditions and args.max_conditions > 0:
        con.execute(
            f"""
            CREATE OR REPLACE TABLE keep AS
            SELECT DISTINCT plate, Cell_Name_Vevo, drug, concentration
            FROM de
            ORDER BY plate, Cell_Name_Vevo, drug, concentration
            LIMIT {int(args.max_conditions)}
            """
        )
        # Materialise the restricted rows into a distinct table (no recursive
        # view reference), then repoint the `de` view at it.
        con.execute(
            """
            CREATE OR REPLACE TABLE de_mat AS
            SELECT d.* FROM de d
            SEMI JOIN keep k
              ON d.plate=k.plate AND d.Cell_Name_Vevo=k.Cell_Name_Vevo
             AND d.drug=k.drug AND d.concentration=k.concentration
            """
        )
        con.execute("CREATE OR REPLACE VIEW de AS SELECT * FROM de_mat")

    # ---- condition_summary -------------------------------------------------
    summary_sql = f"""
        COPY (
            SELECT
                plate,
                Cell_Name_Vevo                      AS cell_line,
                Cell_ID_Cellosaur                   AS cellosaurus_id,
                Cell_ID_DepMap                      AS depmap_id,
                drug,
                concentration,
                any_value(concentration_unit)       AS concentration_unit,
                max(n_cells_trt)                    AS n_treatment_cells,
                max(n_cells_ctrl)                   AS n_control_cells,
                count(*) FILTER (padj IS NOT NULL)  AS n_genes_tested,
                count(*) FILTER (padj <= {args.sig_padj})                          AS n_sig,
                count(*) FILTER (padj <= {args.sig_padj} AND log2FoldChange > 0)    AS n_up,
                count(*) FILTER (padj <= {args.sig_padj} AND log2FoldChange < 0)    AS n_down,
                -- approx_quantile (t-digest) instead of exact median(): the exact
                -- holistic median buffers every value per group in RAM and does
                -- not spill, which OOM-kills the full build. The t-digest state is
                -- tiny and spillable; the approximation is negligible for a
                -- summary of thousands of per-gene effect sizes.
                approx_quantile(abs(log2FoldChange), 0.5) FILTER (padj <= {args.sig_padj}) AS median_abs_sig_log2fc,
                max(abs(log2FoldChange))    FILTER (padj <= {args.sig_padj})        AS max_abs_sig_log2fc
            FROM de
            GROUP BY plate, cell_line, cellosaurus_id, depmap_id, drug, concentration
            ORDER BY plate, cell_line, drug, concentration
        ) TO '{os.path.join(args.out, "condition_summary.parquet")}'
        (FORMAT parquet, COMPRESSION zstd)
    """
    con.execute(summary_sql)

    # ---- top_de_genes ------------------------------------------------------
    top_sql = f"""
        COPY (
            WITH sig AS (
                SELECT
                    gene_name, baseMean, log2FoldChange, lfcSE, stat, pvalue, padj,
                    plate,
                    Cell_Name_Vevo    AS cell_line,
                    Cell_ID_Cellosaur AS cellosaurus_id,
                    Cell_ID_DepMap    AS depmap_id,
                    drug, concentration, concentration_unit,
                    n_cells_trt       AS n_treatment_cells,
                    n_cells_ctrl      AS n_control_cells,
                    CASE WHEN log2FoldChange > 0 THEN 'up' ELSE 'down' END AS direction
                FROM de
                WHERE padj <= {args.sig_padj} AND log2FoldChange IS NOT NULL
                  AND log2FoldChange <> 0
            ),
            ranked AS (
                SELECT *,
                    row_number() OVER (
                        PARTITION BY plate, cell_line, drug, concentration, direction
                        ORDER BY CASE WHEN direction='up'
                                      THEN log2FoldChange ELSE -log2FoldChange END DESC
                    ) AS rnk
                FROM sig
            )
            SELECT gene_name, baseMean, log2FoldChange, lfcSE, stat, pvalue, padj,
                   plate, cell_line, cellosaurus_id, depmap_id,
                   drug, concentration, concentration_unit,
                   n_treatment_cells, n_control_cells, direction
            FROM ranked
            WHERE rnk <= {args.top_n}
            ORDER BY plate, cell_line, drug, concentration, direction, rnk
        ) TO '{os.path.join(args.out, "top_de_genes.parquet")}'
        (FORMAT parquet, COMPRESSION zstd)
    """
    con.execute(top_sql)

    n_cond = con.execute(
        f"SELECT count(*) FROM read_parquet('{os.path.join(args.out, 'condition_summary.parquet')}')"
    ).fetchone()[0]
    n_top = con.execute(
        f"SELECT count(*) FROM read_parquet('{os.path.join(args.out, 'top_de_genes.parquet')}')"
    ).fetchone()[0]
    print(f"[build] wrote condition_summary.parquet ({n_cond:,} conditions)", flush=True)
    print(f"[build] wrote top_de_genes.parquet ({n_top:,} rows)", flush=True)
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

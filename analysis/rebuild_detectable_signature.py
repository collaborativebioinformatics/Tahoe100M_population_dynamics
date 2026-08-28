#!/usr/bin/env python3
"""Rebuild a plate-6 gene signature restricted to genes detectable at single-cell
resolution in the calibration (DMSO) group.

The original c32_homoharringtonine_5um_signature.json picked the top-25-per-direction
genes by |log2FC| from the bulk pseudobulk Atlas. That ranking is dominated by genes
with near-zero raw counts in one condition, which are frequently undetectable at
single-cell resolution (dropout) -- diagnosed via diagnose_signature_variance.py,
which showed all 25 "up" genes and 23/25 "down" genes have <1.4826*MAD==0 (i.e. <=50%
of calibration cells have a nonzero count) for this condition.

This script re-derives up/down gene lists directly from the plate-6 h5ad for the same
(cell_line, drug, dose) condition, restricted to genes detectable in >= min-detection-frac
of the calibration DMSO cells -- the same statistic run_plate_pair_h5ad.py's MAD
filter implicitly requires -- then ranks the survivors by a scanpy-style log2 fold change
between the treated and calibration groups.

Stays entirely within the same cell_line/samples/drug/dose already prespecified in the
runbook; it does not choose a new condition or peek at plate 14.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from run_plate_pair_h5ad import _subset


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--plate6", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--cell-line", required=True)
    p.add_argument("--cell-name", default=None, help="human-readable cell line name for provenance")
    p.add_argument("--drug", required=True)
    p.add_argument("--dose", type=float, required=True)
    p.add_argument("--p6-treated", required=True)
    p.add_argument("--p6-calibration", required=True)
    p.add_argument("--p6-matched", required=True)
    p.add_argument("--top-n", type=int, default=25)
    p.add_argument("--min-detection-frac", type=float, default=0.55,
                    help="min fraction of calibration cells with nonzero raw count; "
                         "must exceed 0.5 for the downstream MAD-based scale to be nonzero, "
                         "with margin since ties at exactly 50% can still yield a zero median")
    p.add_argument("--scale-factor", type=float, default=1e4)
    args = p.parse_args()

    if args.min_detection_frac <= 0.5:
        raise SystemExit("--min-detection-frac must be > 0.5, or the downstream MAD scale "
                          "will still be zero for borderline genes (median needs >50% nonzero)")

    samples = {args.p6_treated, args.p6_calibration, args.p6_matched}
    adata = _subset(args.plate6, cell_line=args.cell_line, samples=samples)

    names = pd.Index(adata.var_names.astype(str))
    if names.has_duplicates:
        raise ValueError("H5AD var_names contains duplicates; resolve before scoring")

    sample = adata.obs["sample"].astype(str).to_numpy()
    treated_mask = sample == args.p6_treated
    cal_mask = sample == args.p6_calibration
    if treated_mask.sum() < 30 or cal_mask.sum() < 30:
        raise ValueError(
            f"Fewer than 30 passing cells: treated={int(treated_mask.sum())} "
            f"calibration={int(cal_mask.sum())}"
        )

    x = adata.X.tocsr()
    totals = np.asarray(x.sum(axis=1)).ravel()
    if np.any(totals <= 0):
        raise ValueError("Encountered cells with zero library size after pass_filter")

    # Normalize in place on the sparse structure, then log1p in place (log1p(0) == 0,
    # so this never densifies or changes sparsity pattern).
    from scipy.sparse import diags
    norm = diags(args.scale_factor / totals) @ x
    norm = norm.tocsr()
    norm.data = np.log1p(norm.data)

    cal = norm[cal_mask, :]
    treated = norm[treated_mask, :]

    n_cal = cal.shape[0]
    detection_frac = cal.getnnz(axis=0) / n_cal
    detectable = detection_frac >= args.min_detection_frac
    print(f"genes clearing detection threshold ({args.min_detection_frac:.0%} of "
          f"{n_cal} calibration cells): {int(detectable.sum())} / {len(detectable)}")

    if detectable.sum() < 2 * args.top_n:
        print(f"WARNING: only {int(detectable.sum())} genes clear the threshold; "
              f"requested {args.top_n} per direction ({2 * args.top_n} total)")

    mean_log_cal = np.asarray(cal.mean(axis=0)).ravel()
    mean_log_treated = np.asarray(treated.mean(axis=0)).ravel()
    eps = 1e-9
    logfc = np.log2(np.expm1(mean_log_treated) + eps) - np.log2(np.expm1(mean_log_cal) + eps)

    idx = np.where(detectable)[0]
    idx_sorted_desc = idx[np.argsort(-logfc[idx])]
    idx_sorted_asc = idx[np.argsort(logfc[idx])]

    up_idx = [i for i in idx_sorted_desc if logfc[i] > 0][: args.top_n]
    down_idx = [i for i in idx_sorted_asc if logfc[i] < 0][: args.top_n]

    if len(up_idx) < args.top_n:
        print(f"WARNING: only found {len(up_idx)} up genes with positive logFC "
              f"clearing the detection threshold (requested {args.top_n})")
    if len(down_idx) < args.top_n:
        print(f"WARNING: only found {len(down_idx)} down genes with negative logFC "
              f"clearing the detection threshold (requested {args.top_n})")

    def _entry(i):
        return {
            "symbol": names[i],
            "log2fc": round(float(logfc[i]), 4),
            "calibration_detection_frac": round(float(detection_frac[i]), 4),
            "calibration_mean_lognorm": round(float(mean_log_cal[i]), 4),
            "treated_mean_lognorm": round(float(mean_log_treated[i]), 4),
        }

    up_entries = [_entry(i) for i in up_idx]
    down_entries = [_entry(i) for i in down_idx]

    out = {
        "name": f"plate6_{args.cell_line}_{args.drug.replace(' ', '')}_{args.dose:g}um_"
                f"detectable_top{args.top_n}_each_direction",
        "selection": (
            "Re-derived from the plate-6 single-cell h5ad directly (not the bulk pseudobulk "
            "Atlas) for the same prespecified condition. Genes restricted to "
            f">= {args.min_detection_frac:.0%} nonzero-count detection in the calibration "
            "DMSO cells (required for the downstream per-gene MAD scale to be nonzero), then "
            "ranked by log2 fold change (expm1 of mean log1p-normalized expression, treated "
            "vs calibration DMSO, scanpy-style). Supersedes the earlier top-25-by-bulk-log2FC "
            "version, which selected genes essentially undetected at single-cell resolution "
            "(diagnosed via diagnose_signature_variance.py: 25/25 up genes and 23/25 down "
            "genes had zero MAD in the calibration group)."
        ),
        "source_condition": {
            "plate": "plate6",
            "sample": args.p6_treated,
            "cell_line": args.cell_line,
            "cell_name": args.cell_name,
            "drug": args.drug,
            "dose": args.dose,
            "unit": "uM",
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "up_genes": [e["symbol"] for e in up_entries],
        "down_genes": [e["symbol"] for e in down_entries],
        "gene_annotations": {"up": up_entries, "down": down_entries},
        "plate14_not_used_to_fit_gene_weights": True,
        "plate14_blinded": False,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {args.output}")
    print(f"up_genes ({len(out['up_genes'])}): {out['up_genes']}")
    print(f"down_genes ({len(out['down_genes'])}): {out['down_genes']}")


if __name__ == "__main__":
    main()

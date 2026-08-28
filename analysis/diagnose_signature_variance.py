#!/usr/bin/env python3
"""Diagnose why signature genes get filtered out of the plate-6 calibration MAD step.

Reuses the loading/normalization logic from run_plate_pair_h5ad_PATCHED.py so results
match exactly what the real run does, and prints per-gene MAD values instead of just
raising when a whole direction is empty.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from run_plate_pair_h5ad_PATCHED import _subset, _load_signature, _lognorm_selected


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--plate6", type=Path, required=True)
    p.add_argument("--signature", type=Path, required=True)
    p.add_argument("--cell-line", required=True)
    p.add_argument("--p6-treated", required=True)
    p.add_argument("--p6-calibration", required=True)
    p.add_argument("--p6-matched", required=True)
    p.add_argument("--scale-factor", type=float, default=1e4)
    args = p.parse_args()

    sig = _load_signature(args.signature)
    samples = {args.p6_treated, args.p6_calibration, args.p6_matched}
    a6 = _subset(args.plate6, cell_line=args.cell_line, samples=samples)

    genes = sig["up_genes"] + sig["down_genes"]
    x6 = _lognorm_selected(a6, genes, args.scale_factor)

    sample = a6.obs["sample"].astype(str).to_numpy()
    cal = sample == args.p6_calibration
    print(f"calibration (DMSO) cells: {int(cal.sum())}")

    center = np.median(x6[cal], axis=0)
    gene_mad = np.median(np.abs(x6[cal] - center), axis=0) * 1.4826

    up_n = len(sig["up_genes"])
    print("\n--- UP genes: symbol, median_lognorm, MAD ---")
    for g, c, m in zip(sig["up_genes"], center[:up_n], gene_mad[:up_n]):
        print(f"{g:15s} median={c:.4f}  MAD={m:.4f}")

    print("\n--- DOWN genes: symbol, median_lognorm, MAD ---")
    for g, c, m in zip(sig["down_genes"], center[up_n:], gene_mad[up_n:]):
        print(f"{g:15s} median={c:.4f}  MAD={m:.4f}")

    print("\n--- summary at a few thresholds ---")
    for thresh in (0.05, 0.01, 0.001, 0.0):
        keep = gene_mad >= thresh
        up_kept = int(keep[:up_n].sum())
        down_kept = int(keep[up_n:].sum())
        print(f"threshold={thresh:<7} up_kept={up_kept}/{up_n}  down_kept={down_kept}/{len(sig['down_genes'])}")

    # Also show raw (pre-log) count sparsity in calibration cells, for context.
    x = a6.X
    loc = a6.var_names.get_indexer(genes)
    raw = x[:, loc]
    if hasattr(raw, "toarray"):
        raw = raw.toarray()
    raw_cal = np.asarray(raw)[cal]
    nonzero_frac = (raw_cal > 0).mean(axis=0)
    print("\n--- fraction of calibration cells with nonzero raw count, per gene ---")
    for g, f in zip(genes, nonzero_frac):
        print(f"{g:15s} nonzero_frac={f:.4f}")


if __name__ == "__main__":
    main()

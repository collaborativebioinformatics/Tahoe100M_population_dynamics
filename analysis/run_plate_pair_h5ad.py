#!/usr/bin/env python3
"""Run one prespecified Tahoe plate-6/14 response-completeness analysis.

This script is intended for the DNAnexus Jupyter/terminal environment where the
large H5AD files are mounted. It loads only one cell line and the prespecified
treatment/control samples into memory. Plate 14 is scored with the unchanged
plate-6 gene signature and parameters.

The script does not discover a signature, choose a condition, or tune thresholds.
Those inputs must be supplied explicitly and recorded in the output provenance.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import anndata as ad
import numpy as np
import pandas as pd
from scipy import sparse

try:
    from .response_completeness import summarize_condition
except ImportError:
    from response_completeness import summarize_condition

REQUIRED_OBS = {"sample", "drug", "cell_line", "plate", "pass_filter"}


def _load_signature(path: Path) -> dict:
    obj = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(obj.get("up_genes"), list) or not isinstance(obj.get("down_genes"), list):
        raise ValueError("Signature JSON requires up_genes and down_genes lists")
    up = list(dict.fromkeys(map(str, obj["up_genes"])))
    down = list(dict.fromkeys(map(str, obj["down_genes"])))
    overlap = sorted(set(up) & set(down))
    if overlap:
        raise ValueError(f"Genes cannot be both up and down: {overlap}")
    if not up or not down:
        raise ValueError("Both signature directions must be non-empty")
    obj["up_genes"], obj["down_genes"] = up, down
    return obj


def _gene_names(adata: ad.AnnData) -> pd.Index:
    # Tahoe H5AD var index is expected to contain stable gene names/IDs. Keep the
    # fallback explicit rather than guessing among arbitrary annotation columns.
    names = pd.Index(adata.var_names.astype(str))
    if names.has_duplicates:
        raise ValueError("H5AD var_names contains duplicates; resolve before scoring")
    return names


def _qc_mask(obs: pd.DataFrame, *, cell_line: str, samples: set[str]) -> np.ndarray:
    missing = REQUIRED_OBS - set(obs.columns)
    if missing:
        raise ValueError(f"Missing H5AD obs columns: {sorted(missing)}")
    pf = obs["pass_filter"]
    if pf.dtype != bool:
        pf = pf.astype(str).str.lower().isin({"true", "1", "yes"})
    return (
        (obs["cell_line"].astype(str) == cell_line)
        & obs["sample"].astype(str).isin(samples)
        & pf.to_numpy()
    ).to_numpy()


def _subset(path: Path, *, cell_line: str, samples: set[str]) -> ad.AnnData:
    backed = ad.read_h5ad(path, backed="r")
    try:
        mask = _qc_mask(backed.obs, cell_line=cell_line, samples=samples)
        if not mask.any():
            raise ValueError(f"No passing cells for {cell_line} and samples {sorted(samples)} in {path}")
        return backed[mask, :].to_memory()
    finally:
        backed.file.close()


def _lognorm_selected(adata: ad.AnnData, genes: list[str], scale_factor: float) -> np.ndarray:
    names = _gene_names(adata)
    loc = names.get_indexer(genes)
    missing = [g for g, i in zip(genes, loc, strict=True) if i < 0]
    if missing:
        raise ValueError(f"Signature genes absent from H5AD var_names: {missing}")
    x = adata.X
    totals = np.asarray(x.sum(axis=1)).ravel()
    if np.any(totals <= 0):
        raise ValueError("Encountered cells with zero library size after pass_filter")
    selected = x[:, loc]
    if sparse.issparse(selected):
        selected = selected.toarray()
    selected = np.asarray(selected, dtype=np.float64)
    return np.log1p(selected * (scale_factor / totals[:, None]))


def _score_against_plate6_calibration(
    plate6: ad.AnnData,
    plate14: ad.AnnData,
    *,
    signature: dict,
    calibration_sample_p6: str,
    min_gene_sd: float,
    scale_factor: float,
) -> tuple[np.ndarray, np.ndarray, dict]:
    genes = signature["up_genes"] + signature["down_genes"]
    x6 = _lognorm_selected(plate6, genes, scale_factor)
    x14 = _lognorm_selected(plate14, genes, scale_factor)
    cal = plate6.obs["sample"].astype(str).to_numpy() == calibration_sample_p6
    if cal.sum() < 30:
        raise ValueError("Plate-6 calibration DMSO has fewer than 30 passing cells")
    center = np.median(x6[cal], axis=0)
    # Robust scale is estimated only from plate-6 calibration DMSO and then frozen.
    gene_mad = np.median(np.abs(x6[cal] - center), axis=0) * 1.4826
    keep = gene_mad >= min_gene_sd
    up_n = len(signature["up_genes"])
    signs = np.r_[np.ones(up_n), -np.ones(len(signature["down_genes"]))]
    if not np.any(keep & (signs > 0)) or not np.any(keep & (signs < 0)):
        raise ValueError("No variable genes remain in one signature direction")
    z6 = (x6[:, keep] - center[keep]) / gene_mad[keep]
    z14 = (x14[:, keep] - center[keep]) / gene_mad[keep]
    kept_signs = signs[keep]
    # Equal total weight per retained direction prevents unequal dropout from
    # changing the balance between up and down programs.
    w = np.where(kept_signs > 0, 1 / np.sum(kept_signs > 0), -1 / np.sum(kept_signs < 0))
    provenance = {
        "normalization": f"log1p(counts / cell_total * {scale_factor:g})",
        "gene_center": "plate6 calibration-DMSO median",
        "gene_scale": "1.4826 * plate6 calibration-DMSO MAD",
        "min_gene_scale": min_gene_sd,
        "retained_up_genes": [g for g, k, s in zip(genes, keep, signs, strict=True) if k and s > 0],
        "retained_down_genes": [g for g, k, s in zip(genes, keep, signs, strict=True) if k and s < 0],
    }
    return z6 @ w, z14 @ w, provenance


def _plate_result(adata, scores, *, treated_sample, calibration_sample, matched_sample, alpha, confidence, reference_interval):
    sample = adata.obs["sample"].astype(str).to_numpy()
    groups = {}
    for label, sid in (("treated", treated_sample), ("calibration", calibration_sample), ("matched_control", matched_sample)):
        groups[label] = scores[sample == sid]
        if len(groups[label]) < 30:
            raise ValueError(f"{label} sample {sid} has only {len(groups[label])} passing cells")
    result = summarize_condition(
        groups["treated"], groups["matched_control"], groups["calibration"],
        alpha=alpha, confidence_level=confidence, reference_interval=reference_interval,
    ).to_dict()
    negative = summarize_condition(
        groups["matched_control"], groups["calibration"], groups["calibration"],
        alpha=alpha, confidence_level=confidence, reference_interval=reference_interval,
    ).to_dict()
    return {"result": result, "dmso_negative_control": negative,
            "sample_cell_counts": {k: len(v) for k, v in groups.items()}}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--plate6", type=Path, required=True)
    p.add_argument("--plate14", type=Path, required=True)
    p.add_argument("--signature", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--cell-line", required=True)
    p.add_argument("--drug", required=True)
    p.add_argument("--dose", type=float, required=True)
    p.add_argument("--p6-treated", required=True)
    p.add_argument("--p6-calibration", required=True)
    p.add_argument("--p6-matched", required=True)
    p.add_argument("--p14-treated", required=True)
    p.add_argument("--p14-calibration", required=True)
    p.add_argument("--p14-matched", required=True)
    p.add_argument("--alpha", type=float, default=0.05)
    p.add_argument("--confidence-level", type=float, default=0.95)
    p.add_argument("--scale-factor", type=float, default=1e4)
    p.add_argument("--min-gene-scale", type=float, default=0.05)
    args = p.parse_args()

    sig = _load_signature(args.signature)
    p6_samples = {args.p6_treated, args.p6_calibration, args.p6_matched}
    p14_samples = {args.p14_treated, args.p14_calibration, args.p14_matched}
    a6 = _subset(args.plate6, cell_line=args.cell_line, samples=p6_samples)
    a14 = _subset(args.plate14, cell_line=args.cell_line, samples=p14_samples)
    # Fail closed if supplied samples do not match the declared treatment.
    for adata, treated, plate in ((a6, args.p6_treated, "plate6"), (a14, args.p14_treated, "plate14")):
        observed = set(adata.obs.loc[adata.obs["sample"].astype(str) == treated, "drug"].astype(str))
        if observed != {args.drug}:
            raise ValueError(f"{plate} treated sample maps to {observed}, expected {args.drug!r}")

    s6, s14, score_prov = _score_against_plate6_calibration(
        a6, a14, signature=sig, calibration_sample_p6=args.p6_calibration,
        min_gene_sd=args.min_gene_scale, scale_factor=args.scale_factor,
    )
    # Freeze the score-space control region from plate-6 calibration DMSO once.
    p6_sample = a6.obs["sample"].astype(str).to_numpy()
    p6_cal_scores = s6[p6_sample == args.p6_calibration]
    reference_interval = tuple(np.quantile(p6_cal_scores, [args.alpha / 2, 1 - args.alpha / 2]))

    out = {
        "schema_version": "plate_pair_response_completeness_v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "is_demo": False,
        "condition": {"cell_line": args.cell_line, "drug": args.drug, "dose": args.dose, "unit": "uM"},
        "development_plate": "plate6",
        "validation_plate": "plate14",
        "signature": sig,
        "signature_sha256": hashlib.sha256(args.signature.read_bytes()).hexdigest(),
        "score_provenance": score_prov,
        "parameters": {"alpha": args.alpha, "confidence_level": args.confidence_level,
                       "scale_factor": args.scale_factor, "min_gene_scale": args.min_gene_scale,
                       "frozen_plate6_reference_interval": list(map(float, reference_interval))},
        "plate6": _plate_result(a6, s6, treated_sample=args.p6_treated,
            calibration_sample=args.p6_calibration, matched_sample=args.p6_matched,
            alpha=args.alpha, confidence=args.confidence_level, reference_interval=reference_interval),
        "plate14": _plate_result(a14, s14, treated_sample=args.p14_treated,
            calibration_sample=args.p14_calibration, matched_sample=args.p14_matched,
            alpha=args.alpha, confidence=args.confidence_level, reference_interval=reference_interval),
        "limitations": [
            "Wilson intervals quantify cell-sampling uncertainty, not biological-replicate uncertainty.",
            "Plate 6 and plate 14 provide one development/validation plate pair.",
            "Control-like is an operational score-region label, not proof of resistance or persistence.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "plate6": out["plate6"], "plate14": out["plate14"]}, indent=2))


if __name__ == "__main__":
    main()

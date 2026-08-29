"""Query precomputed pseudobulk DE statistics for a single condition.

IMPORTANT SCIENTIFIC FRAMING
----------------------------
Every number surfaced here is a *precomputed pseudobulk* differential-expression
statistic (DESeq2-style: baseMean, log2FoldChange, lfcSE, Wald stat, pvalue,
BH-adjusted padj). Pseudobulk means each (cell line x drug x concentration)
condition was collapsed to aggregated counts before testing — so the replicate
unit is the sample/condition, NOT the individual cell. This module must never
present individual cells as independent biological replicates.

These functions read only the compact web tables, never the 100M-cell matrix.
"""
from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from . import SIG_PADJ
from .data_loader import get_condition_row, get_top_genes

PRECOMPUTED_NOTE = (
    "Values are precomputed **pseudobulk** differential-expression statistics "
    "(DESeq2-style Wald test, Benjamini–Hochberg adjusted). The replicate unit "
    "is the sample/condition, not the individual cell — individual cells are "
    "not treated as independent biological replicates."
)


def analyze_condition(condition_df: pd.DataFrame, top_df: pd.DataFrame, *,
                      plate, cell_line, drug, concentration,
                      sig_padj: float = SIG_PADJ) -> dict:
    """Return a structured result for one (plate, cell line, drug, dose).

    Always returns a dict with a ``found`` flag so callers can handle missing
    combinations gracefully.
    """
    row = get_condition_row(condition_df, plate=plate, cell_line=cell_line,
                            drug=drug, concentration=concentration)
    if row is None:
        return {
            "found": False,
            "plate": plate, "cell_line": cell_line, "drug": drug,
            "concentration": concentration,
            "message": ("No precomputed DE result for this combination. "
                        "It may not have been part of plates 6/14, or the drug "
                        "was not screened on this cell line."),
            "note": PRECOMPUTED_NOTE,
        }

    genes = get_top_genes(top_df, plate=plate, cell_line=cell_line, drug=drug,
                          concentration=concentration)

    def _num(x):
        return None if x is None or (isinstance(x, float) and np.isnan(x)) else float(x)

    result = {
        "found": True,
        "plate": plate,
        "cell_line": cell_line,
        "cellosaurus_id": row.get("cellosaurus_id"),
        "depmap_id": row.get("depmap_id"),
        "drug": drug,
        "concentration": _num(row.get("concentration")),
        "concentration_unit": row.get("concentration_unit"),
        "n_treatment_cells": int(row.get("n_treatment_cells") or 0),
        "n_control_cells": int(row.get("n_control_cells") or 0),
        "n_genes_tested": int(row.get("n_genes_tested") or 0),
        "n_sig": int(row.get("n_sig") or 0),
        "n_up": int(row.get("n_up") or 0),
        "n_down": int(row.get("n_down") or 0),
        "median_abs_sig_log2fc": _num(row.get("median_abs_sig_log2fc")),
        "max_abs_sig_log2fc": _num(row.get("max_abs_sig_log2fc")),
        "sig_padj": sig_padj,
        "top_genes": genes,
        "note": PRECOMPUTED_NOTE,
    }
    return result


def dose_response_table(condition_df: pd.DataFrame, *, cell_line, drug,
                        plate: Optional[str] = None) -> pd.DataFrame:
    """Significant-DEG counts across concentrations for a cell line x drug.

    Returns rows sorted by concentration; empty if fewer than one dose exists.
    """
    if condition_df.empty:
        return condition_df
    m = (condition_df["cell_line"] == cell_line) & (condition_df["drug"] == drug)
    if plate is not None:
        m &= condition_df["plate"] == plate
    cols = ["plate", "concentration", "concentration_unit",
            "n_sig", "n_up", "n_down",
            "median_abs_sig_log2fc", "max_abs_sig_log2fc"]
    sub = condition_df.loc[m, [c for c in cols if c in condition_df.columns]]
    return sub.sort_values(["plate", "concentration"]).reset_index(drop=True)


def replicate_comparison(condition_df: pd.DataFrame, *, plate_a="6", plate_b="14",
                         metric="n_sig") -> pd.DataFrame:
    """Join two replicate plates on (cell line, drug, concentration).

    Returns one row per shared condition with the metric from each plate, for a
    replicate-concordance scatter. Empty if either plate is absent.
    """
    if condition_df.empty or "plate" not in condition_df.columns:
        return pd.DataFrame()
    keys = ["cell_line", "drug", "concentration"]
    a = condition_df[condition_df["plate"] == plate_a]
    b = condition_df[condition_df["plate"] == plate_b]
    if a.empty or b.empty or metric not in condition_df.columns:
        return pd.DataFrame()
    merged = a.merge(b, on=keys, suffixes=(f"_{plate_a}", f"_{plate_b}"))
    out_cols = keys + [f"{metric}_{plate_a}", f"{metric}_{plate_b}"]
    return merged[[c for c in out_cols if c in merged.columns]].copy()

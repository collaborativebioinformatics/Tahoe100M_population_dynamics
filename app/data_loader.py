"""Data access for the Tahoe-100M public UI.

Resolves where the compact web tables live and loads them with pandas. The
resolution order is:

  1. ``$TAHOE_WEB_DATA_DIR``           (Argon build output; the real MVP data)
  2. repo ``data/demo/``              (tiny committed fallback so the app always runs)

Only small precomputed tables are ever read here:

  condition_summary.parquet   one row per (plate, cell line, drug, concentration)
  top_de_genes.parquet        top-N up/down significant genes per condition
  (optional) drug_metadata / cell_line_metadata / sample_metadata / gene_metadata

These functions are Streamlit-agnostic so they can be unit-tested directly; the
Streamlit layer wraps them with ``st.cache_data``.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import pandas as pd

# Repo-relative demo directory (…/app/data_loader.py -> repo root -> data/demo).
_REPO_ROOT = Path(__file__).resolve().parent.parent
DEMO_DIR = _REPO_ROOT / "data" / "demo"

CONDITION_FILE = "condition_summary.parquet"
TOP_GENES_FILE = "top_de_genes.parquet"

METADATA_FILES = {
    "drug": "drug_metadata.parquet",
    "cell_line": "cell_line_metadata.parquet",
    "sample": "sample_metadata.parquet",
    "gene": "gene_metadata.parquet",
}


def resolve_data_dir() -> tuple[Path, bool]:
    """Return ``(directory, is_demo)`` for the active data source.

    Prefers ``$TAHOE_WEB_DATA_DIR`` when it exists and actually contains the
    condition summary; otherwise falls back to the committed demo dataset.
    """
    env = os.environ.get("TAHOE_WEB_DATA_DIR", "").strip()
    if env:
        d = Path(env).expanduser()
        if (d / CONDITION_FILE).is_file():
            return d, False
    return DEMO_DIR, True


def _read_parquet(path: Path) -> pd.DataFrame:
    return pd.read_parquet(path)


def load_condition_summary(data_dir: Optional[Path] = None) -> pd.DataFrame:
    """Load the per-condition DE summary table (empty frame if missing)."""
    d = Path(data_dir) if data_dir is not None else resolve_data_dir()[0]
    path = d / CONDITION_FILE
    if not path.is_file():
        return pd.DataFrame()
    return _read_parquet(path)


def load_top_de_genes(data_dir: Optional[Path] = None) -> pd.DataFrame:
    """Load the top up/down DE genes table (empty frame if missing)."""
    d = Path(data_dir) if data_dir is not None else resolve_data_dir()[0]
    path = d / TOP_GENES_FILE
    if not path.is_file():
        return pd.DataFrame()
    return _read_parquet(path)


def load_metadata(name: str, data_dir: Optional[Path] = None) -> pd.DataFrame:
    """Load one optional metadata table by short name (drug/cell_line/sample/gene)."""
    if name not in METADATA_FILES:
        raise KeyError(f"unknown metadata table {name!r}; "
                       f"expected one of {sorted(METADATA_FILES)}")
    d = Path(data_dir) if data_dir is not None else resolve_data_dir()[0]
    path = d / METADATA_FILES[name]
    if not path.is_file():
        return pd.DataFrame()
    return _read_parquet(path)


# --- small convenience selectors -------------------------------------------

def list_values(df: pd.DataFrame, column: str) -> list:
    """Sorted unique non-null values of a column (``[]`` if absent)."""
    if df.empty or column not in df.columns:
        return []
    return sorted(v for v in df[column].dropna().unique().tolist())


def filter_conditions(df: pd.DataFrame, *, plate=None, cell_line=None,
                      drug=None, concentration=None) -> pd.DataFrame:
    """Filter the condition summary by any subset of the four keys."""
    if df.empty:
        return df
    out = df
    for col, val in (("plate", plate), ("cell_line", cell_line),
                     ("drug", drug), ("concentration", concentration)):
        if val is not None and col in out.columns:
            out = out[out[col] == val]
    return out


def get_condition_row(df: pd.DataFrame, *, plate, cell_line, drug,
                      concentration) -> Optional[pd.Series]:
    """Return the single matching condition row, or ``None`` if not present."""
    sub = filter_conditions(df, plate=plate, cell_line=cell_line,
                            drug=drug, concentration=concentration)
    if sub.empty:
        return None
    return sub.iloc[0]


def get_top_genes(df: pd.DataFrame, *, plate, cell_line, drug, concentration,
                  direction: Optional[str] = None) -> pd.DataFrame:
    """Top genes for one condition, optionally restricted to 'up' or 'down'."""
    if df.empty:
        return df
    m = ((df.get("plate") == plate) & (df.get("cell_line") == cell_line)
         & (df.get("drug") == drug) & (df.get("concentration") == concentration))
    sub = df[m]
    if direction is not None and "direction" in sub.columns:
        sub = sub[sub["direction"] == direction]
    return sub

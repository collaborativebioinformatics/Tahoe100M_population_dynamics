"""Tahoe-100M public UI — application package (Group 6 hackathon project).

Modules:
    data_loader  load compact web tables + metadata, with a demo fallback
    plots        Plotly figures for the Explore tab
    statistics   query precomputed pseudobulk DE stats for one condition

Nothing in this package loads the full 100M-cell expression matrix or the
~89 GB DE dataset; the app reads only the small precomputed web tables.
"""

__version__ = "0.1.0"
GROUP = "Group 6"
DATASET_URL = "https://huggingface.co/datasets/tahoebio/Tahoe-100M"
SIG_PADJ = 0.05
MVP_PLATES = ("6", "14")  # replicate plates used for the current MVP

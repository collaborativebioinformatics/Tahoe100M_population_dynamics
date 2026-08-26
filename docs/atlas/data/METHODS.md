# Methods
1. Pseudobulk DESeq2 DE per (plate, cell_line, drug, concentration) vs that plate's DMSO (plate-matched).
2. Compact tables (all 14 plates) via DuckDB, top-25 up/down genes per condition.
3. Truncated SVD (k=20) of the signed log2FC condition x gene sparse matrix, uncentered -> NOT PCA / NOT single-cell PCA. Fit on plates 1-13; plate14 projected as held-out replicate. seed=42.
4. UMAP (umap-learn 0.5.7) on the 20 SVD components, seed=42.
5. Pathway: over-representation analysis (hypergeometric/Fisher) over MSigDB Hallmark 2020; BH-FDR. Not GSEA (input DE is truncated).
6. Dose-response: observed response magnitude vs log10 concentration + isotonic monotonic fit; 3 nonzero doses -> no EC50/Hill claim.
7. Response ranking: L2 magnitude of each retained top-N log2FC signature. Drug x cell-line rankings use the maximum observed magnitude across the three nominal doses. This measures transcriptional shift, not potency or viability.
8. Signature search: mean signed log2FC across all recognized query genes (up minus down), with genes absent from a condition's retained top-N contributing zero. At least 3 observed query genes are required (up to 10 for larger signatures). Positive and negative scores are reported separately as exploratory matches and reversals.

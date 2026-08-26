# Data Dictionary
- condition key = (plate, cell_line, drug, concentration, concentration_unit)
- condition_summary: per-condition pseudobulk DE counts (n_sig/up/down), effect (median/max abs sig log2FC), cell counts.
- top_de_genes: TRUNCATED top-N (25 up + 25 down) signed log2FoldChange per condition. NOT the full transcriptome.
- condition_embedding: 20-D truncated-SVD scores; response_magnitude = L2 of stored log2FC row; in_fit_set (plates 1-13) vs held-out plate14.
- plate_concordance: plate6 vs held-out plate14 replicate (cosine, magnitudes).
- pathway_summary: Hallmark ORA (hypergeometric), BH-FDR<0.10, per condition x direction. ORA (not GSEA) because DE is truncated.
- dose_response_summary / dose_paths: observed magnitude vs concentration; one synthetic DMSO origin per cell_line x drug.
- drug_cellline_ranking: aggregated response magnitude and rank within each cell line or drug, plus descriptive dose-trend and metadata fields.
- browser signature index: condition ID -> (cell line, drug, dose, plate, n_sig, magnitude), with gene postings storing condition ID and signed retained log2FC. Search scores are computed in the browser and are not persisted statistical estimates.

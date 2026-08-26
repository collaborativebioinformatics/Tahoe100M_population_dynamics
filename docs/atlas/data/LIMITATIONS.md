# Limitations
- NO single-cell expression used: only 1 of 3388 expression shards is present (28,225 cells, plate4 only, 0 DMSO cells). Population mean/variance, bootstrap CI, responder/non-responder fractions and cellular heterogeneity are NOT COMPUTABLE and are omitted, not estimated.
- DE is TRUNCATED to top-N genes per condition; response magnitude and the SVD basis use this selected subset. Not a full transcriptome analysis.
- DMSO origin in trajectories is SYNTHETIC (zero vector), flagged is_synthetic_dmso; it is a plotting baseline, not measured data.
- Dose trajectories aggregate a cell_line x drug across plate triplets (0.05/0.5/5.0 uM); 3 points -> observed/monotonic only, no EC50.
- Batch effects across plates are not explicitly removed beyond within-plate DMSO normalization.
- Signature-search scores are not p-values and are not full-transcriptome connectivity scores. Browser/CLI parity demonstrates implementation agreement, not biological validation.
- The 20-component uncentered SVD is a compact response-geometry view with limited explained sparse-matrix energy; similarity in this space should be interpreted together with gene and pathway overlap.

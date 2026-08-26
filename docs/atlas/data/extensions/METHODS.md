# Methods (extended modules) — ctx-cell-dose-v1, 2026-08-26, git 95c5a54
## A. Pathway × mutation context
Driver = listed in Tahoe cell-line driver annotation ('driver_altered'); all other realized cell
lines are 'not_annotated_as_driver' (NOT wild type — no full CCLE/DepMap mutation matrix was joined).
Only drivers with >=5 altered AND >=5 reference cell lines and tissue overlap tested. Per drug×dose×driver:
OLS response ~ driver_altered + C(organ), with HC3 robust standard errors; median response difference,
Cliff's delta, Hedges g, tissue composition, plate coverage, and plate14 held-out direction were also
reported. BH-FDR was computed per driver (`fdr`) and across all tests (`fdr_global`). Pathways: Hallmark
**ORA** (not GSEA; DE is truncated), followed by the same organ-adjusted HC3 model. Signed pathway score
= direction × min(-log10 FDR, 10). Result = mutation-ASSOCIATED transcriptional response (association,
not causation; not a biomarker or dependency claim).
## B. Cell-level candidate control-like population
Real raw counts from HuggingFace tahoebio/Tahoe-100M plate14 shards (sentinel gene_id=1/value=-2 dropped).
Signature = plate6 pseudobulk DE (plates 1-13) scored on **held-out plate14 cells** (no circularity).
QC = library-size + mitochondrial proxy (public schema lacks singlet/demuxlet/pass_filter). Score =
mean(z up) - mean(z down) vs matched plate14 DMSO_TF. candidate_control_like = treated score <= DMSO Xth
percentile (primary 95; 90/99 sensitivity). Uncertainty = cell-sampling bootstrap only (single plate =
NOT biological-replicate). Validation: DMSO-label permutation, signature reversal, threshold sensitivity,
downsampling.
## C. Dose response with real DMSO
Pseudobulk full atlas: 3 measured doses per cell_line×drug, plate-annotated, analytical zero from
plate-matched DMSO (NOT synthetic). Observed/monotonic/isotonic only — NO EC50/IC50/Emax. Cell-level pilot:
one measured plate14 dose per condition with real matched DMSO; multi-dose cell curve NOT assembled.

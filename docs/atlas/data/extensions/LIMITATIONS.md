# Limitations
- Mutation labels are annotation-based; 'not_annotated_as_driver' is NOT verified wild type. 50 cancer cell
  lines are NOT patient samples; findings are associations, not causal/biomarker/therapeutic claims.
- Pathways use ORA over truncated top-N DE (not GSEA, not full transcriptome).
- Cell-level is a PILOT: plate14 only, one dose per drug, ~cell lines limited by >=500-DMSO availability.
  QC lacks singlet/demuxlet (not in public schema). CI is cell-sampling only, NOT biological-replicate.
- No full multi-dose cell-level trajectory (would need plate4/5/6 cell downloads). No EC50/Hill.
- DMSO zero in dose plots is an analytical baseline from measured plate-matched DMSO, not a measured
  concentration point and not the synthetic origin used in the full-atlas latent paths.
- No raw single-cell counts are shipped in this package — summaries only.

# Data dictionary
mutation_response_associations: driver_gene, drug, concentration, n_altered/n_reference, median_diff,
  cliffs_delta, hedges_g, beta_altered, hc3_p, t_stat, fdr (per-driver BH), fdr_global,
  plate14_median_diff, plate14_replicates_direction.
mutation_pathway_associations: driver_gene, pathway, signed_score_diff, cliffs_delta, beta_altered,
  hc3_p, fdr (per-driver BH), fdr_global.
control_like_fraction: cell_line, drug, concentration, n_treated_qc, n_dmso_qc, control_like_frac_p95 + CI.
control_like_threshold_sensitivity: per condition x {90,95,99} DMSO percentile.
dose_response_pseudobulk_full: cell_line, drug, concentration, response_magnitude, plates.
dose_response_cell_level_pilot: measured plate14 dose point + control_like_frac_p95 + pseudobulk curve link.

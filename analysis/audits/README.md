# Verified plate 6/14 metadata audit

Source: official `tahoebio/Tahoe-100M` `sample_metadata.parquet` and `obs_metadata.parquet`, accessed 2026-08-27.

- DMSO label: `DMSO_TF`
- Sample column: `sample`
- Cell-line column: `cell_line` (Cellosaurus IDs)
- Treatment column: `drug`
- Concentration is embedded in `drugname_drugconc`; there is no standalone dose column in the official cell metadata.
- The JSON report contains aggregates only, with no barcodes or expression values.
- DMSO samples differ on QC, so role-swapping and QC sensitivity are required.

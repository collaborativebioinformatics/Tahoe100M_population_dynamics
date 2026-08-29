# DNAnexus plate 6 -> plate 14 runbook

This runbook produces one real, condition-level response-completeness result. It does not export cell barcodes or expression matrices.

## Prespecified retrospective example

- cell line: C32 (`CVCL_1097`)
- perturbation: Homoharringtonine, 5 uM
- plate 6 treatment sample: `smp_2047`
- plate 14 treatment sample: `smp_2815`
- plate 6 DMSO: `smp_2069`, `smp_2070`
- plate 14 DMSO: `smp_2837`, `smp_2838`
- signature: `analysis/configs/c32_homoharringtonine_5um_signature_detectable.json`

The signature contains the top 25 up genes and top 25 down genes by `log2_meanlog_ratio`, re-derived directly from the plate-6 single-cell h5ad and restricted to genes detected in >=55% of calibration (DMSO) cells. This supersedes an earlier signature built from the top-25-by-bulk-log2FC pseudobulk Atlas ranking (`c32_homoharringtonine_5um_signature.json`), which turned out to be undetectable at single-cell resolution for this condition (25/25 up genes and 23/25 down genes had zero MAD in the calibration group; see `diagnose_signature_variance.py`) and, separately, still carried 14/50 Ensembl IDs against an h5ad indexed by gene symbol. See `rebuild_detectable_signature.py` for how the current signature was built. Plate-14 aggregate concordance was already visible when this condition was chosen. Plate 14 is therefore a retrospective replication check, not a blinded validation set.

## Run in the DNAnexus Jupyter terminal

```bash
cd /path/to/Tahoe100M_population_dynamics
python -m pip install -r analysis/requirements.txt

python analysis/run_plate_pair_h5ad.py \
  --plate6 /mnt/project/tahoe-100/data/anndata/h5ad/plate6_filt_Vevo_Tahoe100M_WServicesFrom_ParseGigalab.h5ad \
  --plate14 /mnt/project/tahoe-100/data/anndata/h5ad/plate14_filt_Vevo_Tahoe100M_WServicesFrom_ParseGigalab.h5ad \
  --signature analysis/configs/c32_homoharringtonine_5um_signature_detectable.json \
  --output results/c32_homoharringtonine_5um_primary.json \
  --cell-line CVCL_1097 \
  --drug Homoharringtonine \
  --dose 5 \
  --p6-treated smp_2047 \
  --p6-calibration smp_2069 \
  --p6-matched smp_2070 \
  --p14-treated smp_2815 \
  --p14-calibration smp_2837 \
  --p14-matched smp_2838
```

Then repeat with DMSO roles swapped. This is required because the metadata audit found material QC differences between paired DMSO samples.

```bash
python analysis/run_plate_pair_h5ad.py \
  --plate6 /mnt/project/tahoe-100/data/anndata/h5ad/plate6_filt_Vevo_Tahoe100M_WServicesFrom_ParseGigalab.h5ad \
  --plate14 /mnt/project/tahoe-100/data/anndata/h5ad/plate14_filt_Vevo_Tahoe100M_WServicesFrom_ParseGigalab.h5ad \
  --signature analysis/configs/c32_homoharringtonine_5um_signature_detectable.json \
  --output results/c32_homoharringtonine_5um_dmso_swap.json \
  --cell-line CVCL_1097 \
  --drug Homoharringtonine \
  --dose 5 \
  --p6-treated smp_2047 \
  --p6-calibration smp_2070 \
  --p6-matched smp_2069 \
  --p14-treated smp_2815 \
  --p14-calibration smp_2838 \
  --p14-matched smp_2837
```

## Acceptance checks

Do not present a residual fraction alone. Before calling the example replicated, verify all of the following:

1. Both JSON files report at least 30 passing cells in every treatment/control group.
2. The held-out DMSO negative-control coverage is close to the nominal 5% and is reported even when it is not.
3. The direction of `response_magnitude` agrees on plates 6 and 14.
4. Residual/coverage conclusions do not reverse when DMSO roles are swapped.
5. Plate-14 uses the exact `frozen_plate6_reference_interval` recorded in the JSON.
6. Any confidence interval is described as cell-sampling uncertainty, not biological-replicate uncertainty.
7. Use “control-like residual” rather than “resistant” or “persister”.

If DMSO role swapping changes the conclusion, report the analysis as control-sensitive and do not feature it as the main biological example.

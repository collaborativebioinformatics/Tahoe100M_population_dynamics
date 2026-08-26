# Response-completeness analysis specification

## Scientific question

For each plate × cell line × drug × dose condition, estimate:

1. **Response magnitude:** how far the treated population moves from plate-matched DMSO.
2. **Response coverage:** what fraction of treated cells fall outside a DMSO-calibrated reference region.
3. **Distribution change:** whether treatment expands or compresses the response-score distribution.
4. **Uncertainty and quality-control sensitivity:** whether an apparent residual fraction is precise and whether it tracks technical or biological covariates.

The output is condition-level. Individual cells are not labelled as resistant or persister cells.

## Evidence ladder

1. Use plate 6 for development and calibration.
2. Split independent DMSO samples into calibration and held-out negative-control roles where the design permits.
3. Quantify DMSO-versus-DMSO behavior before interpreting treated-versus-DMSO overlap.
4. Freeze the score definition, feature representation, thresholds, and quality-control rules.
5. Apply the frozen configuration unchanged to matched plate 14 conditions.
6. Report concordant and discordant validation results.

Plate 14 must not be used for parameter selection if it is retained as the validation set.

## Unit of analysis and dependence

Cells from the same sample are not independent biological replicates. Cell-level intervals quantify within-sample sampling uncertainty only. Biological replication is assessed through the plate 6/14 comparison and any additional independent samples identified in the metadata.

## Required inputs

A one-dimensional response score per cell is the minimum input to the baseline implementation. The score may be:

- a prespecified pathway score;
- expression of a selected gene, for gene-specific exploration;
- a component learned using plate-6 training data only;
- another documented response representation.

Pathway or local response representations should be prioritized for the primary analysis. Frameshift reported that global energy distance and mean squared error did not distinguish its selected KRAS-inhibitor responses, whereas Augur and CellCap did.

## Baseline estimands

Let treated scores be $S_T$ and plate-matched control scores be $S_C$.

### Robust response magnitude

$$
M = \frac{\mathrm{median}(S_T)-\mathrm{median}(S_C)}{1.4826\ × \mathrm{MAD}(S_C)}.
$$

The sign gives direction. The absolute value gives standardized magnitude. If control dispersion is zero, the result is undefined and must be flagged.

### DMSO-calibrated residual fraction and coverage

Using a calibration DMSO sample, define a central reference interval
$\mathcal C_{DMSO}=[q_{\alpha/2},q_{1-\alpha/2}]$.

$$
R = \frac{1}{n_T}\sum_i I(S_{Ti}\in\mathcal C_{DMSO}), \qquad
C = 1-R.
$$

$R$ is the control-like residual fraction and $C$ is response coverage. A Wilson 95% confidence interval is reported for the observed fraction. The expected coverage in held-out DMSO is not exactly zero because the reference region excludes its tails; this negative-control value must be shown.

### Distribution expansion or compression

$$
D = \frac{\mathrm{MAD}(S_T)}{\mathrm{MAD}(S_C)}.
$$

Values above one indicate expansion and values below one indicate compression. No fixed biological threshold is assumed; interpretation is calibrated against DMSO-versus-DMSO comparisons.

## Quality-control sensitivity

At minimum inspect:

- total counts or reads;
- detected genes;
- mitochondrial fraction;
- cell-cycle scores or phase;
- sample/library identity.

Cell cycle should not automatically be regressed out because it may be part of the drug response. Report unadjusted results and a sensitivity analysis based on matching, stratification, or regression where possible.

## Dose ordering

Multiple concentrations form an experimentally ordered **dose-response path**, not a temporal single-cell trajectory. The analysis may assess monotonicity of magnitude, coverage, and dispersion across dose without claiming that individual cells travelled along an inferred path.

## Minimum report for each condition

- plate, sample, cell line, drug, and dose;
- treated and control cell counts;
- score/feature definition;
- robust response magnitude;
- residual fraction and 95% confidence interval;
- response coverage and 95% confidence interval;
- dispersion ratio;
- held-out DMSO negative-control metrics;
- quality-control flags;
- validation status on plate 14;
- complete provenance and software configuration.

## Limitations

Tahoe-100M is a 24-hour endpoint without lineage tracing or a matched viability readout. A control-like residual population is therefore a candidate incomplete-response state, not demonstrated resistance, persistence, survival, or clonal selection. Associations with genotype, mechanism of action, or external viability data are observational unless separately validated.

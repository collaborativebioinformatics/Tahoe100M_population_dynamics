# Methods — Tahoe-100M real query tools

## Data source

- **Input:** Tahoe-100M pseudobulk differential-expression tables at
  `source/metadata/pseudobulk_differential_expression/train-*-of-01026.parquet`
  (1,026 shards, ~4.09 billion gene×condition rows, 63 GB).
- **Metadata:** `cell_line_metadata`, `drug_metadata`, `gene_metadata`,
  `sample_metadata` parquet (DepMap / Cellosaurus ids, organ, driver genes;
  drug targets / MOA / SMILES / PubChem; gene symbol ↔ Ensembl ↔ token id).
- A condition = **(plate, cell line [DepMap], drug, concentration)**. Each
  condition is fully contained in a single shard, except conditions that straddle
  a shard boundary (one per boundary, 1,025 total) — these are re-read from the two
  adjacent shards and recomputed on the full gene set (see `build_derived.py`).

## Differential expression contrast

- Direction is **treated − matched DMSO** (DESeq2); positive log2FoldChange =
  up-regulated by the drug. Confirmed biologically: Bortezomib (proteasome
  inhibitor) yields the canonical heat-shock induction (HSPA6, HSPA1A/B) as its
  strongest up genes.
- The full gene universe (62,710 genes) is tested per condition. Low-expression
  genes are DESeq2 independent-filtered and stored as null log2FC; they are
  excluded from that condition's tested set. The finite gene set therefore differs
  slightly across conditions.

## Response magnitude

For each condition, over its finite (tested) genes:

- `rms_log2fc_robust = sqrt(mean(clip(log2FC, ±cap)²))` — the primary,
  cross-condition-comparable response-strength metric.
- `response_magnitude_l2 = sqrt(sum(log2FC²))` — stored for reference; **not** used
  for ranking (not comparable across differing gene counts).
- Winsor `cap` = global 99.5th percentile of |log2FC| from a seed-42 subsample of
  40 shards (recorded in `winsor_info.json`).
- Also stored: `n_genes_tested`, `n_sig` (padj < 0.05), `n_up`, `n_down`,
  `median_abs_sig_log2fc`, `max_abs_log2fc`, `n_treatment_cells`, `n_control_cells`.

Response strength is a transcriptional-signature magnitude — **not** drug
sensitivity, viability, killing, or clinical efficacy.

## Rankings (Module 1)

- **Drug → cell lines:** within each (drug, dose), cell lines ranked by
  `rms_log2fc_robust` (descending).
- **Cell line → drugs:** within each (cell line, dose), drugs ranked likewise.
- **Best observed dose:** per target, the strongest response across any measured
  dose, explicitly labelled *best observed* (doses are not equalized).

## Signatures, index & search (Module 3)

- Per condition keep top-200 up and top-200 down genes (by |log2FC| among
  significant genes; fallback to |log2FC| among finite genes if < 5 significant).
- Signed weight = `sign · clip(|log2FC|, cap)` × IDF, where
  `IDF(gene) = log(N_conditions / (1 + df))` and `df` = number of conditions with
  that gene in their top-K. Weights are **L2-normalized per condition**.
- The browser index keeps top-K per direction (recorded in `meta.json`,
  `web_index_topk_per_direction`).
- **Query scoring:** query gene = +1 (up) / −1 (down); `score(condition) =
  Σ_gene query_sign · weight`. Positive = similar (top matches); negative =
  candidate reversal (top reversers). This is an **exploratory similarity score** —
  no validated null model, so no p-values are reported. Results with ≤ 2
  overlapping genes are de-ranked and flagged.

## Compare (Module 2)

- Two conditions' stored top-K signatures give: response-magnitude difference,
  **top-K signature cosine** (over the union, using the IDF-weighted normalized
  weights), shared up / shared down genes, opposite-direction genes, and the
  largest differential-response genes. Cosine is a top-K measure, never a
  full-transcriptome correlation.

## Replicate reliability (QC)

- For each (cell line, drug, dose) measured on ≥ 2 plates, compute pairwise top-K
  cosine and Spearman over shared genes. Reported as a separate QC badge; never
  folded into response ranking.

## Signature-search validation

- Sample 200 high-quality conditions (≥ 15 up and ≥ 15 down genes), seed 42.
- **Self-recall:** build a query from the even-ranked half of each condition's
  signature; record whether the original condition is returned at rank 1 / 10 / 50.
- **Reversal recall:** sign-flip the query; check the original condition appears as
  a top reverser.
- **Replicate vs random:** compare replicate top-K cosine to random-pair cosine
  (Mann–Whitney, one-sided).
- Outputs: `signature_search_validation.parquet`, `signature_search_metrics.json`.

## Compute

- University of Iowa **Argon** cluster, SGE / `qsub`, UI queue. Extraction:
  32 slots, single-threaded workers (threads = slots), ~4.4 shards/s. Build +
  validation: 8 slots. All paths absolute; no work on the login node.

## Reproducibility

- Fixed seed 42 throughout (winsor subsample, validation sampling, random pairs).
- Scripts: `extract_conditions.py`, `run_extraction.py`, `build_derived.py`,
  `validate_signature.py`, `package_web.py`.

# Data dictionary — Tahoe-100M real query tools

Primary key for a **condition** everywhere: `condition_id = plate|depmap|drug|concentration`.

## Raw input — `pseudobulk_differential_expression/train-*.parquet`
| column | type | meaning |
|---|---|---|
| gene_name | str | HGNC gene symbol |
| baseMean | float | DESeq2 mean normalized count |
| log2FoldChange | float | log2 fold change, **treated − matched DMSO** (null = independent-filtered) |
| lfcSE | float | standard error of log2FC |
| stat | float | Wald statistic |
| pvalue | float | raw p-value |
| padj | float | BH-adjusted p-value (FDR) |
| plate | str | plate id (encodes dose group) |
| n_cells_trt / n_cells_ctrl | int | pseudobulk cell counts |
| Cell_ID_Cellosaur / Cell_ID_DepMap | str | cell-line ids |
| drug | str | compound name |
| concentration / concentration_unit | float / str | dose (µM) |
| Cell_Name_Vevo | str | cell-line display name |

## `condition_summary.parquet` — one row per condition
| column | type | meaning |
|---|---|---|
| condition_id | str | primary key |
| plate, cell_line, cellosaurus_id, depmap_id | str | identifiers |
| drug, concentration, concentration_unit | str/float/str | perturbation & dose |
| n_treatment_cells, n_control_cells | int | pseudobulk cell counts |
| n_genes_tested | int | genes with finite log2FC |
| n_sig | int | genes with padj < 0.05 |
| n_up, n_down | int | significant up / down genes |
| median_abs_sig_log2fc | float | median |log2FC| over significant genes |
| max_abs_log2fc | float | max |log2FC| over tested genes |
| rms_log2fc_robust | float | **primary response strength** (winsorized RMS log2FC) |
| response_magnitude_l2 | float | L2 norm of log2FC (reference only; not ranked on) |

## `condition_catalog.parquet`
`condition_summary` joined with cell-line metadata (organ, drivers) and drug
metadata (targets, moa_broad, moa_fine, human_approved, pubchem_cid).

## `top_de_genes.parquet` — per-condition top-K signatures (long)
| column | type | meaning |
|---|---|---|
| condition_id | str | condition |
| gene_name | str | gene |
| log2FoldChange | float | effect |
| log2fc_winsor | float | winsorized effect |
| padj | float | FDR |
| direction | str | "up" / "down" |
| rank | int | 0-based rank within direction (by |log2FC|) |

## `response_ranking.parquet` (+ `.csv.zst`)
| column | meaning |
|---|---|
| view | "drug_to_cell" or "cell_to_drug" |
| anchor | the fixed drug (or cell line) |
| dose_key | concentration+unit |
| target, cell_line, drug, plate, condition_id | ranked item + identifiers |
| rank | 1-based rank within (anchor, dose) |
| rms_log2fc_robust, response_magnitude_l2, max_abs_log2fc | response metrics |
| n_sig, n_up, n_down | significance counts |
| organ, moa_broad | context |

## `replicate_reliability.parquet`
| column | meaning |
|---|---|
| cell_line, drug, concentration, concentration_unit | replicate group |
| condition_a, condition_b | the two plate conditions |
| n_union_genes, n_shared_genes | top-K overlap sizes |
| topk_cosine | cosine of winsorized-log2FC over union of top-K genes |
| shared_spearman | Spearman over shared genes |

## `signature_index.parquet` / web `sig/`
| column | meaning |
|---|---|
| gene_id | gene token id (from gene_metadata) |
| cond_idx | integer condition index |
| wn | IDF-weighted, L2-normalized signed weight |
| direction, rank | provenance |

Web binary form: `sig/post_cond.i32` (Int32 cond_idx), `sig/post_w.f32` (Float32
wn), `sig/genes.json` (`symbol → [col, df, idf, start, count]` + Ensembl aliases).

## `gene_index.parquet`
`gene_name, gene_id, ensembl_id, df, idf` — document frequency and inverse
document frequency per gene across condition top-K signatures.

## `conditions_index.parquet` / web `conditions.json`
`cond_idx → condition metadata + metrics + replicate cosine/Spearman`.

## `signature_search_validation.parquet` / `signature_search_metrics.json`
Per-sampled-condition recall/reversal ranks; aggregate Recall@1/10/50, reversal
recall, replicate-vs-random comparison. Seed 42.

## `input_audit.json`
Schema, entity counts, plates, doses, direction confirmation, gene-universe
consistency note, winsor definition, null handling, and QC summary statistics.

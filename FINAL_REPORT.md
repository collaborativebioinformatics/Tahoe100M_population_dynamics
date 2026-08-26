# Final report — Tahoe-100M real query tools

## 1. Overall status: **SUCCESS**

Three real, static query tools were implemented end-to-end on the actual
Tahoe-100M pseudobulk differential-expression data, submitted and completed as SGE
jobs on Argon, validated, packaged into an upload-ready web release, tested
against a local server, committed to an isolated branch, and exported as a
verifiable git bundle. The original working tree was never modified.

## 2. Module status
| Module | Status | Notes |
|---|---|---|
| 1 · Drug × Cell-line response ranking | SUCCESS | drug→cell, cell→drug, dose + best-observed, replicate badges |
| 2 · Compare two conditions | SUCCESS | top-K signature cosine, shared/opposite genes, downloads, share URLs |
| 3 · Signature / reversal search | SUCCESS | compact binary inverted index; Recall@1/10/50 = 100%, reversal = 100% |

## 3. Jobs (all SGE / qsub, UI queue)
| Job ID | Name | Slots | Exit | Wallclock | CPU | maxvmem | Notes |
|---|---|---|---|---|---|---|---|
| 6434866 | tahoe_extract | 32 | 0 | 267 s | 6412 s | 33.9 GB | per-condition extraction from 1026 shards |
| 6434898 | tahoe_build | 8 | (cancelled) | — | — | — | pre-boundary-fix; superseded |
| 6434968 | tahoe_build | 8 | (cancelled) | — | — | — | inefficient boundary recompute; superseded |
| 6434999 | tahoe_build | 8 | 0 | 4126 s | 19081 s | 21.0 GB | corrected build (boundary fix) + derived products |
| 6435228 | tahoe_finalize | 4 | 0 | 450 s | 277 s | 4.9 GB | fixed validation + package + verify |
| 6435244 | tahoe_repack | 4 | 1* | 470 s | 271 s | 4.9 GB | compact index; *trailing debug-print NameError AFTER all data written; outputs verified |

Two early build jobs (6434898, 6434968) were cancelled with cause: the first ran
an obsolete pre-boundary-fix validation; the second used an O(n·shard) boundary
recompute. Both were replaced by 6434999. No pre-existing jobs were touched.

## 4. Actual input schema + first rows

Raw shard `train-*-of-01026.parquet` columns: `gene_name, baseMean,
log2FoldChange, lfcSE, stat, pvalue, padj, plate, n_cells_trt, n_cells_ctrl,
Cell_ID_Cellosaur, Cell_ID_DepMap, drug, concentration, concentration_unit,
Cell_Name_Vevo`. 4,089,820,780 rows total; full gene universe (62,710) per
condition, with null log2FC for DESeq2 independent-filtered genes.

`condition_summary.parquet` first 5 rows (A549, plate 1, 0.05 µM):
```
condition_id                cell_line drug      conc  n_genes_tested n_sig n_up n_down rms_log2fc_robust
1|ACH-000681|4EGI-1|0.05    A549      4EGI-1    0.05  28230          789   322  467    1.187
1|ACH-000681|9-ING-41|0.05  A549      9-ING-41  0.05  28570          981   458  523    1.148
1|ACH-000681|APTO-253|0.05  A549      APTO-253  0.05  28566          1084  508  576    1.178
1|ACH-000681|AT7519|0.05    A549      AT7519    0.05  28485          1060  520  540    1.153
1|ACH-000681|AZD1390|0.05   A549      AZD1390   0.05  28646          1503  714  789    1.180
```

## 5. Scale (real, verified)
- Conditions: **65,218** (unique (plate, cell line, drug, concentration))
- Cell lines: **50** · DepMap/Cellosaurus-annotated
- Drugs: **379** (target / MOA / SMILES / PubChem where available)
- Plates: **14** (1–14) · Doses: **3** — **0.05, 0.5, 5.0 µM**
- Gene universe: **62,710** (symbol ↔ Ensembl ↔ token id)
- Top-K signature rows: 22,461,576 · Web index postings: 11,974,249 over 39,654 genes
- Replicate groups (≥2 plates): 12,441 · Boundary-split conditions recomputed: 1,025

## 6. Response-ranking definition
Primary metric = **robust RMS log2 fold-change**:
`rms = sqrt(mean(clip(log2FC, ±cap)²))` over each condition's tested (finite) genes,
cap = global 99.5th percentile of |log2FC| (= 4.462, seed-42 subsample). This is a
**transcriptional-response magnitude** (treated − matched DMSO), not drug
sensitivity, viability, killing, or clinical efficacy. `response_magnitude_l2`
(L2 norm) is stored for reference but not ranked on (not comparable across
differing gene counts).

## 7. Compare: signature type
Uses **top-K signature cosine** (union of each condition's top-K IDF-weighted,
L2-normalized signed weights) — explicitly a top-K measure, not a
full-transcriptome correlation. Metrics (RMS, n_sig, up/down) use the full tested
universe.

## 8. Signature Search: algorithm + validation
Per-condition signed signature = `sign · clip(|log2FC|, cap) · IDF`, L2-normalized
(top-100 per direction in the web index). Query up = +1, down = −1; score = signed
dot product. Positive = similar, negative = reversal. **Exploratory similarity, no
p-values** (no validated null model). Validation (seed 42, 200 sampled conditions,
62,526 eligible):
- **Recall@1 = 1.000, Recall@10 = 1.000, Recall@50 = 1.000**
- **Reversal Recall@1 = 1.000, @10 = 1.000, @50 = 1.000**
- Replicate agreement ≫ random: median shared-gene Spearman **0.758** (replicates)
  vs median cosine **0.0019** (random pairs); Mann–Whitney one-sided p ≈ 0.

## 9. Three real example queries
- **Explore (cell→drug), A549 @ 5 µM (top 3):** Idarubicin (RMS 2.23, 14,902 sig),
  Dinaciclib (2.14, 3,314), Homoharringtonine (1.84, 10,953). *(L-Thyroxine ranks
  #1 by RMS 3.23 but only 91 sig genes — a low-power case; n_sig is always shown.)*
- **Explore (drug→cell), Bortezomib @ 5 µM (top 3):** A-427 (lung, RMS 1.80),
  HS-578T (breast, 1.75), NCI-H1792 (lung, 1.72).
- **Signature Search**, up = HSPA6/HSPA1A/HSPA1B/DNAJB1/BAG3/DNAJA1/HSPH1,
  down = MYC/MKI67/CCNB1/TOP2A/CCNA2 → top matches SW 1271×Infigratinib,
  SW 1088×Auranofin, SW 1271×Bortezomib, NCI-H661×Bortezomib (proteostasis-stress
  drugs induce HSPs / suppress proliferation — biologically sensible).

## 10. Output files (absolute paths, rows, size)
Base: `/nfsscratch/Users/xwu76/tahoe/runs/real_query_tools_20260826T190305Z/out/derived/`
| File | Rows | Cols | Size |
|---|---|---|---|
| condition_summary.parquet | 65,218 | 18 | 2.94 MB |
| condition_catalog.parquet | 65,218 | 26 | 2.98 MB |
| conditions_index.parquet | 65,218 | 27 | 3.18 MB |
| response_ranking.parquet | 130,436 | 19 | 3.61 MB |
| response_ranking.csv.zst | 130,436 | — | 4.96 MB |
| replicate_reliability.parquet | 12,441 | 10 | 0.33 MB |
| top_de_genes.parquet | 22,461,576 | 7 | 321.8 MB |
| signature_profiles.parquet | 11,974,249 | 9 | 241.3 MB |
| signature_index.parquet | 11,974,249 | 5 | 87.1 MB |
| gene_index.parquet | 39,654 | 5 | 0.73 MB |
| signature_search_validation.parquet | 200 | 4 | 0.01 MB |
| input_audit.json / signature_search_metrics.json / winsor_info.json | — | — | small |

Web release: `/nfsscratch/Users/xwu76/tahoe/runs/real_query_tools_20260826T190305Z/web_release/`
(`data/`: meta 12 KB, catalog 42 KB, conditions.json 10.6 MB, explore 30 MB across
429 files, profiles 312 MB across 128 shards, sig 48 MB = post_cond 24 MB [uint16] +
post_w 24 MB [int16] + genes.json 2.8 MB).

## 11. Browser performance (measured, localhost)
- Explore / Compare first interaction: small JSON only (catalog 42 KB + one ranking
  file ≈ 70 KB; a Compare profile shard ≈ 2.4 MB on demand).
- Signature Search first load: ~51 MB (sig index + genes.json + conditions.json),
  ~1.6 s to load+dequantize once (cached thereafter).
- **Query latency: ~17 ms** to score all 65,218 conditions (target < 2 s). ✔

## 12. Scientific limitations
See `LIMITATIONS.md`. Key: response strength ≠ efficacy/viability; web index is
top-K (labelled); per-condition gene universe differs (independent filtering);
scores are exploratory (no p-values); high RMS with low n_sig can be noise;
replicate coverage partial; doses plate-encoded and sparse.

## 13. Branch / commit / bundle
- Local branch: **feature/real-query-tools** (base: `origin/docs/resources-citation`
  — **stacked dependency**, not yet in `origin/main`)
- Feature commit: **038584d** (tools); this report is the branch tip commit.
- Bundle: `/nfsscratch/Users/xwu76/tahoe/feature-real-query-tools.bundle`
  (exported from the branch tip; the authoritative SHA-256 for the tip bundle is
  recorded in `out/manifest.sha256` and printed in the session summary).
- Output SHA-256 manifest: `…/out/manifest.sha256`

## 14. Original repo git status (start = end, untouched)
- Start: branch `feature/public-ui`, HEAD `95c5a549…`, `?? analysis/`
- End:   branch `feature/public-ui`, HEAD `95c5a549…`, `?? analysis/`
No reset/clean/stash/checkout/overwrite/delete was performed on the original tree.
All development happened in an isolated clone under
`/nfsscratch/Users/xwu76/tahoe/runs/real_query_tools_20260826T190305Z/work/repo`.

## 15. Confirmations
No push, no merge, no PR, no remote modification. No pre-existing SGE job was
cancelled or altered (only two of this session's own build jobs were cancelled,
with cause). Source data was read-only. The Team roster is preserved, including
**Xia (Candice) Wu — Interface & website design** and **Anna Sokolova**; no removed
non-members were re-added. All three tools display real results only
(`is_demo: false`); the legacy illustrative widget's data is isolated under
`docs/data/demo/` and never mixed with real results.

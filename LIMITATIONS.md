# Limitations — Tahoe-100M real query tools

These tools summarize **transcriptional responses** from pseudobulk differential
expression. Read the results with these limits in mind.

1. **Response strength ≠ efficacy.** "Transcriptional response strength" is the
   magnitude of the differential-expression signature (treated vs DMSO). It does
   **not** measure drug sensitivity, cell viability, killing, apoptosis, or clinical
   response. A large transcriptome shift can occur without cell death, and a lethal
   drug can act with a modest transcriptional footprint. The wording is enforced
   throughout the UI.

2. **Truncated signatures for the browser.** The full DE metrics use every tested
   gene, but the browser signature index and Compare cosine use only the top-K
   up/down genes per condition. All such overlaps and cosines are **top-K signature**
   measures, explicitly labelled, and are not full-transcriptome correlations.

3. **Per-condition gene universe differs.** DESeq2 independent filtering removes
   low-expression genes per condition, so the finite gene set is not identical
   across conditions. Ranking uses a mean-based robust RMS to stay comparable;
   the raw L2 magnitude is reported but not ranked on.

4. **Exploratory similarity, no p-values.** Signature-search scores are a signed,
   IDF-weighted cosine-like similarity. There is no validated null model, so no
   p-values or FDR are attached. Treat scores as a ranking aid, not a test.

5. **Low-overlap results are weak.** A match resting on 1–2 shared genes is
   de-ranked and flagged; do not over-interpret it.

6. **Replicate coverage is partial.** Replicate reliability exists only where the
   same cell line × drug × dose was measured on ≥ 2 plates. Where it is absent the
   badge reads "no replicate", and reliability is unknown — not zero. Replicate
   agreement at the gene level is modest, as expected for pseudobulk DE.

7. **Dose is plate-encoded and sparse.** Concentrations available are those actually
   measured (a small set of doses across plates). "Best observed dose" rankings mix
   doses and are labelled as such; they are not dose-matched comparisons.

8. **Winsorization.** log2FC is winsorized at the global 99.5th percentile of
   |log2FC| before RMS and signature weighting, to prevent a few extreme genes from
   dominating. The cap is recorded; results near it are compressed by design.

9. **Not a diagnostic tool.** Research use only. Organization and drug names denote
   data provenance and do not imply endorsement or validated findings.

10. **Boundary conditions.** ~1,025 conditions straddle raw-shard boundaries; they
    are re-read and recomputed on the full gene set so their metrics are complete.

11. **Magnitude vs significance.** RMS response strength is a magnitude over all
    tested genes and can be inflated by a low-power condition (few cells → large but
    non-significant fold-change estimates). A high RMS paired with a small `n_sig`
    (significant-gene count, always shown next to the rank) should be read with
    caution — it may reflect noise rather than a broad, confident response. Sort or
    filter with `n_sig` in view.

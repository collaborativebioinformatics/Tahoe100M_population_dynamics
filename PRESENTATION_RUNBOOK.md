# Group 6 final presentation runbook

**Format:** +- 8 minutes. The team should assign speakers based on availability!

## The one-sentence story

**Tahoe-100M shows how far an average expression profile moves after treatment. We built tools to ask the complementary question: how completely did the cell population move, and did that conclusion repeat across plates?**

Keep the presentation as one story. Do not give a separate progress report for every workstream.

---

# Recommended four-slide structure

## Slide 1 — From a huge dataset to something people can use

### Show

- The public **Real Atlas** in the browser.
- One drug or cell-line query.
- Ranking, condition comparison, or signature search.

### Say

> Tahoe-100M contains more than 100 million single-cell profiles, which is too large to explore interactively in a browser. We therefore precomputed compact summaries and built a static public interface that does not require a server, cloud account, or local installation.
>
> The current Real Atlas covers 65,218 drug × concentration × cell-line conditions across all 14 plates. Users can rank transcriptional response magnitude, compare conditions, search for similar or opposing signatures, and download versioned results.

### Important wording

- Say **transcriptional response magnitude**, not drug efficacy, sensitivity, killing, or clinical benefit.
- The Real Atlas is **pseudobulk**. It does not estimate cell-level residual populations.
- The separate interface prototype contains illustrative elements. Do not describe those as real single-cell results.

---

## Slide 2 — The average can hide an incomplete response

### Show

A simple schematic or the repository workflow figure:

```text
matched DMSO distribution       treated distribution
          │                              │
          ├── response magnitude ────────┤  How far did the population move?
          └── response coverage ─────────┘  How completely did it move?
```

### Say

> A large mean shift does not necessarily mean that every cell moved. A treated population can shift uniformly, remain mostly control-like, broaden, compress, or split into different states.
>
> We therefore separate two quantities. Response magnitude is the median score shift relative to matched DMSO, standardized by the DMSO median absolute deviation. Response coverage is the fraction of treated cells outside a reference region calibrated from an independent DMSO sample. The complementary fraction inside that region is called the control-like residual.
>
> A second DMSO sample acts as a negative control. We also swap the DMSO roles because the paired controls differ in RNA-depth and mitochondrial-quality distributions.

### Method in one line

```text
Plate 6: define score + calibration interval → freeze everything → transfer unchanged to plate 14
```

### Important wording

- Say **control-like residual**, not resistant cells or persisters.
- A cell being inside the DMSO score region is an operational classification, not a biological fate.
- Wilson intervals describe uncertainty in an observed cell fraction. They do not create additional biological replicates.

---

## Slide 3 — First real plate-pair example

### Show

**C32 × Homoharringtonine × 5 µM**

| Analysis | Plate 6 | Plate 14 |
|---|---:|---:|
| Treated cells | 1,332 | 1,678 |
| Primary robust magnitude | 5.92 control MAD | 5.75 control MAD |
| Primary coverage | 99.55% | 99.46% |
| Coverage after DMSO-role swap | 99.92% | 99.82% |
| Primary control-like residual, 95% CI | 0.45% (0.21–0.98%) | 0.54% (0.28–1.02%) |

### Say

> For this first real-data example, the selected transcriptional score moved strongly away from the DMSO region on plate 6. When the frozen plate-6 scoring and reference rule was transferred to plate 14, the same qualitative pattern appeared.
>
> The conclusion also survived swapping the two DMSO roles: coverage remained above 99% on both plates. The exact residual estimate changed with the DMSO assignment, so the defensible result is near-complete separation under both assignments, not one exact percentage of “nonresponding” cells.

### Required caveat

> This is a retrospective workflow demonstration, not blinded validation. The signature was rebuilt using plate-6 treated and control data after the original bulk-derived genes proved unsuitable at single-cell resolution, and plate-14 concordance was already visible when the example was selected.

### Artifact status

The numerical summaries and all Wilson intervals have been independently checked. Before treating the GitHub result files as provenance-complete artifacts, PR #17 should contain the full JSON files produced by `--output`, including the signature hash, frozen parameters, score provenance, accepted `pass_filter` value, and limitations.
Before merge, PR #17 should align the documented DNAnexus commands with the detectable signature used for this analysis and include the complete JSON files produced by `--output`, including the signature hash, frozen parameters, score provenance, accepted `pass_filter` value and limitations.

---

## Slide 4 — What the hackathon produced, and what comes next

### Show

```text
DONE
✓ Public real-data Atlas: 65,218 conditions across 14 plates
✓ Static browser interface and downloadable, versioned outputs
✓ Tested response-completeness estimators and batch CLI
✓ Barcode-free plate 6/14 metadata audit
✓ Memory-conscious DNAnexus plate-pair runner
✓ First retrospective real-data plate-pair execution

NEXT
→ Align the DNAnexus runbook with the detectable signature, commit provenance-complete outputs, and merge PR #17
→ Freeze the revised score-building procedure prospectively
→ Run the 4,155 matched conditions with ≥200 cells on both plates
→ Add QC sensitivity and evidence grades
→ Connect verified single-cell outputs to the public interface
```

### Say

> The hackathon produced both a usable real-data browser and the infrastructure for a replicate-aware single-cell population analysis. The metadata audit found 4,696 exact drug × concentration × cell-line matches between plates 6 and 14, including 4,155 with at least 200 cells on both plates.
>
> The next scientific step is not to hunt for the best-looking example. It is to freeze the revised method prospectively, run all eligible matched conditions, grade evidence using DMSO controls and QC sensitivity, and then publish those aggregate results through the same interface.

### Closing line

> **The Atlas tells us how far the average moved. The response-completeness layer is designed to show how much of the population moved, how reproducible that conclusion is, and what the average left behind.**

---

# Live-demo plan

1. Open the repository README before the session starts.
2. Open the Real Atlas in a second tab and preselect one working query.
3. Demonstrate no more than two functions. Ranking plus Compare or Signature Search is enough.
4. Return to GitHub for the response-completeness workflow and result table.
5. Do not run DNAnexus, notebooks, or a fresh analysis live.
6. Keep the result JSON or PR #17 open only as backup for technical questions.
7. Finish on Slide 4 and the closing line above.

## Failure-safe version

If the live site or internet fails:

- use the dashboard screenshot already stored in the repository;
- show the workflow diagram;
- show the verified table on Slide 3;
- continue with the same script.

The scientific story must not depend on a live service.

---

# Team coordination

The team should choose presenters based on who is available and comfortable speaking. One person may present all four slides, or the team may hand off between slides. Suggested ownership only:

- **Interface/Atlas:** someone familiar with the public site.
- **Response-completeness method:** someone comfortable explaining the two metrics and DMSO calibration.
- **Real-data example:** someone familiar with the DNAnexus run and PR #17.
- **Closing/next steps:** the group lead, presentation coordinator, or any available team member.

---

# Questions the audience may ask

## “Did you find resistant cells?”

> No. We identified a score-based control-like residual fraction. Tahoe has a single 24-hour endpoint and no lineage tracing or direct viability measurement, so resistance and persistence cannot be inferred from this analysis.

## “Is plate 14 a blinded validation?”

> Not for this first example. The scoring rule was transferred from plate 6, but this example was selected retrospectively and plate-14 concordance was already known. A future atlas-wide run should freeze the revised procedure before evaluating additional held-out conditions.

## “Why did you rebuild the signature?”

> The original bulk-derived genes were largely undetectable or had zero DMSO variance at single-cell resolution. The replacement signature was restricted to genes detectable in plate-6 calibration cells. That made the workflow executable, but it also makes this a development example rather than independent validation.

## “Does 99% coverage mean 99% of cells were killed?”

> No. Coverage means that 99% of treated cells fell outside a DMSO-calibrated transcriptional score region. It is not a viability or killing measurement.

## “Why does the residual fraction change after swapping DMSO controls?”

> The two DMSO samples have different QC distributions. The role swap tests whether the qualitative conclusion depends on one arbitrary control assignment. Here, the exact estimate changed, but near-complete separation remained on both plates.

## “What is the main finished product?”

> The strongest finished product is the public pseudobulk Real Atlas. The single-cell response-completeness result is the first retrospective real-data execution of the next analysis layer.

---

# Do not claim

- “We discovered resistant or persister cells.”
- “This proves drug efficacy or cell killing.”
- “Plate 14 is a blinded validation of this example.”
- “The response-completeness method has been run atlas-wide.”
- “PCA, trajectory analysis, PanDrugs integration, or variant calling is complete.”
- “The exact residual percentage is robust.”

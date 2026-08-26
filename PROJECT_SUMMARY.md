# Tahoe-100M Hackathon — Working Summary

<p align="center">
  <img src="img/logo.jpg" alt="Tahoe-100M Population Dynamics" width="600">
</p>

**Event window:** Tue 2026-08-25 → Thu 2026-08-27 (3-day hackathon)
**Last updated:** 2026-08-25 (Day 1)

> This is a living document. It will be updated it after each huddle/standup so anyone (including async/remote teammates) can get oriented quickly.


## 1. Team

| Name | Background | Focus area |
|---|---|---|
| Don Baldwin | Biology; former lead, UPenn bioinformatics corps | Raw sequence data access, figures |
| Anna Sokolova | Computational biology, signal processing, EEG/BCI, ML pipelines | Response-completeness scoring: plate 6 prototype → DMSO calibration → plate 14 validation |
| Candice Wu | PhD candidate, sequencing & bioinformatics (Univ. of Iowa) | Data interface / browser widget |
| Tuneer | PhD candidate, genomics (oral cancer), single-cell + WGS + transcriptomics | Trajectory / state-space branching analysis |
| Abdul Shiwoku | Math/stats, systems analyst, transitioning into bioinformatics | Repo infrastructure; statistical methods for subpopulation detection |
| Cecilia Mathó | Assistant professor of genetics (Universidad de la República) | PCA visualization; pandrugs.org / annotation feasibility |
| Gerald McCollam | MS in Bioinformatics, Johns Hopkins University | Writer


---

## 2. What we're building

Tahoe-100M reports, for each drug/dose/cell-line condition, how far the *average* cell moved relative to DMSO controls. But population averages hide heterogeneity: a "weak" mean response can conceal a strong response in most cells plus a residual, control-like subpopulation that didn't respond at all.

We're building a **replicate-tested response-completeness screen**: for each drug × dose × cell line, we measure not just *how strongly* the treated population moved away from plate-matched DMSO, but *how completely* it moved — i.e., what fraction of cells remain control-like. The scoring rule is calibrated on one plate and frozen before being tested, unchanged, on an independent biological replicate plate.

> *"Tahoe tells us how far the average cell moved. We measure how completely the population moved, show that the pattern repeats, and flag what the average left behind."*

This is **not** pitched as the first analysis to look beyond pseudobulk — other work (including the Tahoe-100M paper itself) already discusses responder/non-responder mixtures qualitatively. The gap we're targeting is a **quantitative, uncertainty-aware, replicate-validated** completeness metric, evaluated systematically across conditions.

## 3. Dataset: Tahoe-100M

- Full resource: **100.6M single-cell transcriptomes (95.6M passing full filters), 50 cancer cell lines, >1,100 small-molecule perturbations**, generated on the **Mosaic platform** using "cell village" co-culture spheroids + Parse GigaLab combinatorial barcoding scRNA-seq, sequenced by Ultima Genomics.
- Analysis-ready subset used in the paper's own downstream analyses (and the one this project targets): **47 cell lines** (13 organs; TP53/KRAS/CDKN2A altered in ~half), **379 drugs** (180 mapped to 25 mechanisms of action), **1,135 drug-dose combinations**, **52,886 unique cell line-drug-dose conditions**, median ~1,287 cells/condition. This matches the "47 lines / ~390 drugs" figure from Huddle 1 closely enough to treat as the same subset — ✅ resolved, no longer an open question.
- 14 total 96-well plates; **Plate 14 is confirmed in the paper as the designated biological replicate of Plate 6** (pseudobulk Pearson correlation: matched treatment/cell-line q25–q75 0.97–0.98, vs. 0.89–0.93 unmatched) — strong independent support for the team's plate 6 (dev) → plate 14 (validation) plan.
- Paper explicitly documents the heterogeneity/subpopulation angle qualitatively (cell-cycle-state variation across drug classes, RAS/RAF-dependent transcriptomic shifts, biomarker potential) but does **not** appear to implement a quantitative, replicate-validated response-completeness/residual-fraction metric — this is consistent with the claim that there's a real gap.
- Single-cell RNA profiling at **24 hours post-treatment**, via Ultima Genomics. Data format: AnnData/H5AD (paper itself trained on 1,685 `.h5ad` sublibrary files) + annotations.
- Available: metadata + expression counts. **Not available:** raw sequence data (FASTQ/BAM) — needed for splicing, allele-specific expression, variant calling. Don is attempting to get access via DNA Nexus / Tahoe-100M team.
- Access point: **HuggingFace** — confirmed by the team. DNA Nexus is Don's separate track for raw FASTQ/BAM access, not the expression-matrix source.
- Both plate 6 and plate 14 have two DMSO control samples each, used for dev (plate 6) / validation (plate 14) split.
- Practical constraint: full dataset too large to load into Seurat at once (Tuneer) — start with plates 6/14 or use batch processing.
- Culture conditions caveat: RPMI + bovine serum is non-physiological; co-culture setup introduces uncertainty about cross-cell-line signaling/crosstalk.

---

## 4. Scientific direction

### Core question (converged framing — treat as current best framing pending team confirmation)
For each **drug × dose × cell line**, measure both:
1. **How strongly** the treated population moved away from plate-matched DMSO (magnitude), and
2. **How completely** the population moved — i.e., what fraction remains "control-like" (a residual/non-responder subpopulation).

Framed as: *"Tahoe tells us how far the average cell moved. We measure how completely the population moved, show the pattern repeats [plate 6 → plate 14], and flag what the average left behind."*

This explicitly moves beyond pseudo-bulk/mean-expression analysis, which masks population heterogeneity — but should **not** be pitched as "the first analysis beyond pseudobulk". The actual gap/novelty is: **a replicate-tested (plate 6 → plate 14) response-completeness screen across the dataset**, with calibrated uncertainty.

### Method notes / guardrails
- **Evidence ladder:** calibrate scoring rule on plate 6, freeze it, then test unchanged on plate 14 (pre-registration-style discipline — no peeking at plate 14 while tuning).
- **Don't hard-threshold "2 std devs from median" as final method** — useful as a quick baseline only. Treatment/DMSO distributions can be asymmetric and naturally overlapping.
- **Calibrate against DMSO-vs-DMSO comparisons** to establish the baseline rate of apparent non-response/separation between controls.
- Report a **condition-level control-like residual fraction with uncertainty** — do not make hard responder/non-responder calls on individual cells.
- Check whether an apparent residual/non-responder population is actually explained by confounders: **RNA depth, mitochondrial fraction, cell-cycle state**.
- **Trajectory/branching language:** Tahoe is a single 24h endpoint, not a time course or lineage-traced experiment. Prefer **"state-space branching," "multimodality," or "response geometry"** over "trajectory" (which implies an observed path). Similarly avoid "resistant"/"persister" labels — prefer **"control-like residual population"** or **"candidate incomplete-response state."**
- Consider also measuring **change in dispersion** (does treatment widen/compress/split the population, not just shift it).

### Proposed deliverables (priority order)
1. **Core (Day 1–2 priority):** One ranked response-completeness table across conditions.
2. One **plate-14-replicated example** where the mean hides a residual/split response (mean vs. distribution story).
3. One **testable follow-up compound hypothesis**, chosen because its Tahoe signature opposes the residual expression program in the same cell line — explicitly framed as a *hypothesis for a future combination experiment*, not evidence of synergy.
4. **Stretch:** Data browser/widget (Candice) — most compelling if it displays a validated real result (drug + cell line → mean shift, response coverage, distribution shape, plate replication, pathways) rather than being the main deliverable itself.
5. **Stretch:** External annotation tie-ins — pandrugs.org / DepMap for genotype interpretation or follow-up compound nomination (Cecilia investigating).
6. **Out of core scope for now:** Variant calling / splicing / allele-specific expression — blocked on FASTQ/BAM availability (Don pursuing). Public release only has expression matrices + metadata; not sufficient for defensible variant calling.

---

## 5. Action items (as of Huddle 1)

| Owner | Task | Status |
|---|---|---|
| Candice Wu | Lead investigation of tools/platforms for data interface / browser widget | Open |
| Tuneer | Investigate trajectory / state-space branching analysis methods & tools | Open |
| Cecilia Mathó | Research PCA visualization tools; assess pandrugs.org applicability | Open |
| Abdul Shiwoku | Set up GitHub repo (contact Ben Busby for project access) | ✅ Done — [`Tahoe100M_population_dynamics`](https://github.com/collaborativebioinformatics/Tahoe100M_population_dynamics) created under the `collaborativebioinformatics` org (MIT licensed) |
| Don Baldwin | Pursue raw sequence data (FASTQ/BAM) via DNA Nexus / Tahoe-100M team | Open |
| Abdul Shiwoku | Research statistical methods for subpopulation detection with confidence measures (p-values, detection sensitivity) | Open |
| Anna Sokolova | Response-completeness scoring module: plate 6 prototype, DMSO calibration, uncertainty estimates, plate 14 validation, figure + Methods text | Open (volunteered; confirm no overlap with anyone else claiming this) |

---

## 6. Open questions / things to confirm at next huddle

- Which exact dataset subset are we analyzing (47 lines/390 drugs vs. full ~50 lines/~1,100 compounds)? Needed before README/slides.
- Confirm ownership of the response-completeness module is Anna's alone, or whether it should be split (she offered to coordinate if someone else already started).
- Finalize the scoring rule / calibration approach (DMSO-vs-DMSO baseline) — needs concrete method before plate 6 prototyping can be "frozen."
- Status of raw FASTQ/BAM access request (Don) — determines whether splicing/variant-calling work is unlocked at all this hackathon.
- GitHub repo status / access (Abdul + Ben Busby).
- Terminology alignment across team: use "state-space branching / response geometry," "control-like residual population," "candidate incomplete-response state" — avoid "trajectory," "resistant," "persister" in write-ups.

---

## 7. Day-by-day log

### Day 1 — Tue 2026-08-25
- Huddle 1: team intros, dataset overview, initial direction (trajectory/branching + PCA + population completeness), action items assigned.
- Anna Sokolova (async, could not attend follow-up): proposed refined scope — response-completeness as core deliverable, evidence-ladder validation (plate 6 → plate 14), guardrails on thresholding/labeling, deliverable priority list.
- Read the Tahoe-100M paper (Zhang/Ubas/de Borja et al. 2025, bioRxiv) for background context — confirmed dataset numbers, confirmed plate 6/14 replicate status independently, resolved the "which subset" open question (see §2).
- Received a draft architecture flowchart: **User Interface** (goals: visualize by drug/cell line, launch stat analysis tool, show linked metadata) dispatching to two parallel analysis modules — **Trajectory analysis** and **PCA analysis** — each taking UI input, calling a tool or running compute, and returning a plot to the UI. This matches Candice's (UI/widget) + Tuneer's (trajectory) + Cecilia's (PCA) assignments.
- Drafted repo `README.md`.
- Team's actual GitHub repo, [`Tahoe100M_population_dynamics`](https://github.com/collaborativebioinformatics/Tahoe100M_population_dynamics) (`collaborativebioinformatics` org, MIT license, Abdul's setup), was cloned into this working directory. It had a placeholder README (title + mermaid architecture diagram matching `flowchart.docx`) and a LICENSE. Merged the drafted README content into it (preserving the existing mermaid diagram as-authored) and copied this `PROJECT_SUMMARY.md` in as the repo's living log. Changes are in the local working tree only — not yet committed/pushed.

### Day 2 — Wed 2026-08-26
- *(to be filled in)*

### Day 3 — Thu 2026-08-27
- *(to be filled in)*

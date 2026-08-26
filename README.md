<div align="center">

<h1>Tahoe-100M Perturbation Explorer</h1>

<p><strong>A public, dose-aware interface for population-level single-cell perturbation modeling.</strong></p>

<p>
  <a href="https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/">
    <img alt="Launch live site" src="https://img.shields.io/badge/LAUNCH-LIVE%20SITE-2563EB?style=for-the-badge&logo=githubpages&logoColor=white">
  </a>
  <img alt="Tahoe-100M" src="https://img.shields.io/badge/DATA-TAHOE--100M-0F766E?style=for-the-badge">
  <img alt="Atlas status" src="https://img.shields.io/badge/ATLAS-REAL%20DERIVED%20DATA-15803D?style=for-the-badge">
  <a href="https://fritzsedlazeck.github.io/blog/2026/hackathon-2026/">
    <img alt="Built at the Baylor and Rice SV Hackathon" src="https://img.shields.io/badge/BUILT%20AT-BAYLOR%20%2B%20RICE%20SV%20HACKATHON-154734?style=for-the-badge">
  </a>
</p>

<p>Explore by drug or cell line, refine by dose and feature, launch a team analysis module, and inspect returned plots, tables, and linked metadata.</p>

</div>

> [!IMPORTANT]
> The polished homepage retains an explicitly labeled **illustrative interface demo**. Its linked [Real Atlas](https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/atlas/) uses 65,218 real pseudobulk conditions from all 14 public plates. It does **not** claim cell-level heterogeneity or responder fractions because the required complete single-cell input is not public.

## Live interface

<div align="center">
  <a href="https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/">
    <img src="docs/assets/dashboard-preview.png" alt="Tahoe-100M Perturbation Explorer dashboard preview" width="100%">
  </a>
  <p><a href="https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/atlas/"><strong>Launch the real-data Atlas →</strong></a> · <a href="https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/">View the interface demo</a></p>
  <p><strong>Interface and website design by Xia (Candice) Wu.</strong></p>
</div>

The site is static GitHub Pages, so it needs no AWS account, paid hosting, custom domain, database, or application server. The browser receives compact, precomputed and compressed result objects rather than the 100-million-cell expression matrix.

## What the interface supports

| Explore | Analyze | Interpret | Share |
|---|---|---|---|
| Browse by **drug** or **cell line** | Send the selected condition to an available analysis module | Compare dose-aware response patterns | View interactive plots and result tables |
| Filter by **dose**, **gene**, or **pathway** | Connect population statistics, PCA, and trajectory services | Inspect DE genes, pathways, response geometry, and stated limits | Follow linked drug, cell-line, and sample metadata |

## System workflow

![Tahoe-100M Group 6 system workflow](docs/group6-workflow.svg)

<div align="center">
  <a href="docs/group6-workflow.svg">Open full-size diagram</a> ·
  <a href="docs/group6-workflow.mmd">Edit Mermaid source</a> ·
  <a href="docs/group6-workflow.png">Download presentation PNG</a>
</div>

### Module responsibilities

| Module | Receives | Returns |
|---|---|---|
| **Public interface** | Drug, cell line, dose, gene, pathway, and requested analysis | Interactive views, linked metadata, result tables, and analysis requests |
| **Population statistics** | Selected condition and expression summaries | Effect size, heterogeneity, differential expression, uncertainty, and candidate non-responder signals |
| **PCA analysis** | Selected drug and cell-line condition | PCA coordinates and visualization |
| **Dose trajectory** | DMSO and available drug concentrations | Dose-aware transcriptional trajectory and plot |

The population-statistics module is specified in [`docs/RESPONSE_COMPLETENESS.md`](docs/RESPONSE_COMPLETENESS.md), with baseline utilities under [`analysis/`](analysis/).

## Integration contract

The UI is intentionally separated from heavy computation. Each team analysis can accept the same condition request and return a standardized result object.

```json
{
  "cell_line": "A549",
  "drug": "Trametinib",
  "dose_um": 1.0,
  "feature": "MAPK signaling",
  "analysis": "population"
}
```

This lets the interface use HPC-generated JSON/Parquet summaries without shipping the full expression matrix or running heavy analysis in a visitor's browser.

Team-facing files are documented in the [`docs/data` integration guide](docs/data/README.md), with versioned [catalog](docs/schemas/catalog.schema.json) and [result](docs/schemas/result.schema.json) JSON schemas.

## Current scope

- [x] Responsive public interface prototype
- [x] Drug, cell-line, dose, feature, and analysis selectors
- [x] Interactive demo charts and linked metadata panel
- [x] Shareable query URLs and standardized JSON/CSV/SVG downloads
- [x] File-backed catalog and precomputed-result loading with demo fallback
- [x] Editable architecture diagram and presentation export
- [x] Connect versioned Tahoe-100M response rankings, condition comparison, pathways, and signature search
- [x] Publish compact real-data downloads with SHA-256 checksums, methods, and limitations
- [x] Add privacy-friendly traffic analytics and release metadata
- [ ] Connect production PCA, trajectory, and population-statistics outputs
- [ ] Add cell-level responder/non-responder analysis when adequate public expression and controls are available

## Sources, citation, and downloads

| Resource | Link |
|---|---|
| Original Tahoe-100M paper | [Zhang et al., bioRxiv 2025](https://doi.org/10.1101/2025.02.20.639398) |
| Public expression data and metadata | [Tahoe-100M on Hugging Face](https://huggingface.co/datasets/tahoebio/Tahoe-100M) |
| Official h5ad / AnnData access | [Arc Virtual Cell Atlas](https://github.com/ArcInstitute/arc-virtual-cell-atlas/tree/main/tahoe-100M) |
| DNAnexus dataset and notebook guide | [DNAnexus Academy](https://academy.dnanexus.com/public-datasets-on-the-dnanexus-platform/single-cell/tahoe-100m) |
| Downloadable citation | [`docs/tahoe100m-citations.bib`](docs/tahoe100m-citations.bib) |
| Real derived tables | [Atlas data, methods, and checksums](https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/atlas/downloads.html) |
| Demo integration artifacts | [Catalog](docs/data/catalog.json) · [Example result](docs/data/results/a549-trametinib-1-mapk-population.json) · [Workflow SVG](docs/group6-workflow.svg) |

The Tahoe-100M data are distributed under [**CC0 1.0**](https://creativecommons.org/publicdomain/zero/1.0/); this repository's code is under the [**MIT License**](LICENSE). Please cite the original Tahoe-100M paper when using the dataset. Derived outputs are research artifacts with explicit methods and limitations, not clinical evidence.

## Acknowledgements

This Group 6 project was developed during the [8th Pan-Structural Variation Hackathon in the Cloud](https://fritzsedlazeck.github.io/blog/2026/hackathon-2026/), held August 25–28, 2026. We sincerely thank **Baylor College of Medicine** and **Rice University** for hosting the event, and the hackathon organizers, mentors, and collaborators from the GREGoR and SMAHT consortia, NCBI, and the broader genomics community for creating the collaborative environment and providing the support that made this work possible.

We acknowledge the Tahoe-100M authors and the teams at Tahoe Bio/Tahoe Therapeutics, Parse Biosciences, and Ultima Genomics for generating the atlas; Arc Institute and Hugging Face for public data access; and DNAnexus for public-dataset and notebook resources used by hackathon participants. Organization names identify provenance and do not imply validation or endorsement of this prototype's scientific results.

## Group 6

| Team member | Current focus |
| :--- | :--- |
| **Don Baldwin** — Lead | Sequence-data access and project coordination |
| Abolaji Shiwoku | Statistical models for population dynamics |
| Anna Sokolova | Response-completeness scoring, DMSO calibration, QC checks, and plate 6/14 validation |
| Cecilia Mathó | PCA tool |
| Tuneer R. Mallick | Trajectory tool |
| Xia (Candice) Wu | Interface and website design |
| Gerald McCollum | Writing and documentation |

## Run locally

No build step is required.

```bash
python3 -m http.server 8000 --directory docs
```

Then open `http://localhost:8000`; the real-data tools are under `http://localhost:8000/atlas/`. The site is plain HTML, CSS, and JavaScript so it can be reviewed quickly and deployed anywhere.

## Research focus

> Future question: can adequate cell-level expression and matched controls identify residual subpopulations that may be non-responders? The current public pseudobulk Atlas does not estimate them.

## License

This project is available under the [MIT License](LICENSE).
